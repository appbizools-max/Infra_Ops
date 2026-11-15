import { Router } from 'express';
import { pool } from '../../config/db';
import { getTenantIdForUser, checkIsAdminOrHR } from '../../utils/tenantAuth';

const router = Router();

// TENANT ROLES ENDPOINTS
// ==========================================

// GET Roles
router.get('/api/tenant/roles/:userUid', async (req, res) => {
  const { userUid } = req.params;
  try {
    const tenantId = await getTenantIdForUser(userUid);
    if (!tenantId) {
      return res.status(404).json({ error: 'Tenant profile not found' });
    }

    const rolesRes = await pool.query(
      `SELECT r.id, r.name, r.department, r.description, r.access_level, r.status,
              r.permissions, r.allowed_modules, r.landing_module, r.created_at,
              COALESCE(COUNT(u.id), 0)::INTEGER AS member_count
       FROM tenant_roles r
       LEFT JOIN tenant_users u ON LOWER(TRIM(u.role)) = LOWER(TRIM(r.name)) AND u.tenant_id = r.tenant_id
       WHERE r.tenant_id = $1
       GROUP BY r.id
       ORDER BY r.created_at ASC`,
      [tenantId]
    );
    res.json(rolesRes.rows);
  } catch (err: any) {
    console.error(`[GET /api/tenant/roles] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// POST Role
router.post('/api/tenant/roles', async (req, res) => {
  const { userUid, name, department, description, access_level, status, permissions, allowed_modules, landing_module } = req.body;
  if (!userUid || !name) {
    return res.status(400).json({ error: 'Missing required fields: userUid and name are required' });
  }

  try {
    const { authorized, tenantId } = await checkIsAdminOrHR(userUid);
    if (!tenantId) {
      return res.status(404).json({ error: 'Tenant identity not found' });
    }
    if (!authorized) {
      return res.status(403).json({ error: 'Access Denied: Only Tenant Admins and HR Executives can manage roles' });
    }

    const checkDup = await pool.query(
      'SELECT id FROM tenant_roles WHERE tenant_id = $1 AND LOWER(name) = LOWER($2)',
      [tenantId, name.trim()]
    );
    if (checkDup.rows.length > 0) {
      return res.status(409).json({ error: `A role named "${name.trim()}" already exists` });
    }

    // Ensure department exists in tenant_departments
    if (department && department.trim()) {
      await pool.query(
        `INSERT INTO tenant_departments (tenant_id, name, code, description) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (tenant_id, name) DO NOTHING`,
        [tenantId, department.trim(), department.trim().substring(0, 6).toUpperCase(), 'Operational Department']
      );
    }

    const insertRes = await pool.query(
      `INSERT INTO tenant_roles (tenant_id, name, department, description, access_level, status, permissions, allowed_modules, landing_module)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        tenantId,
        name.trim(),
        department ? department.trim() : null,
        description ? description.trim() : null,
        access_level || 'Standard',
        status || 'Active',
        permissions ? JSON.stringify(permissions) : '{}',
        Array.isArray(allowed_modules) ? allowed_modules : [],
        landing_module || 'dashboard'
      ]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    console.error(`[POST /api/tenant/roles] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// PUT Role
router.put('/api/tenant/roles/:id', async (req, res) => {
  const { id } = req.params;
  const { userUid, name, department, description, access_level, status, permissions, allowed_modules, landing_module } = req.body;

  if (!userUid || !name) {
    return res.status(400).json({ error: 'Missing required fields: userUid and name are required' });
  }

  try {
    const { authorized, tenantId } = await checkIsAdminOrHR(userUid);
    if (!tenantId) {
      return res.status(404).json({ error: 'Tenant identity not found' });
    }
    if (!authorized) {
      return res.status(403).json({ error: 'Access Denied: Only Tenant Admins and HR Executives can manage roles' });
    }

    const checkDup = await pool.query(
      'SELECT id FROM tenant_roles WHERE tenant_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3',
      [tenantId, name.trim(), id]
    );
    if (checkDup.rows.length > 0) {
      return res.status(409).json({ error: `Another role named "${name.trim()}" already exists` });
    }

    // Ensure department exists in tenant_departments
    if (department && department.trim()) {
      await pool.query(
        `INSERT INTO tenant_departments (tenant_id, name, code, description) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (tenant_id, name) DO NOTHING`,
        [tenantId, department.trim(), department.trim().substring(0, 6).toUpperCase(), 'Operational Department']
      );
    }

    const oldRoleRes = await pool.query('SELECT name FROM tenant_roles WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    const oldName = oldRoleRes.rows[0]?.name;

    const updateRes = await pool.query(
      `UPDATE tenant_roles
       SET name = $1, department = $2, description = $3, access_level = $4, status = $5,
           permissions = COALESCE($6, permissions),
           allowed_modules = COALESCE($7, allowed_modules),
           landing_module = COALESCE($8, landing_module)
       WHERE id = $9 AND tenant_id = $10
       RETURNING *`,
      [
        name.trim(),
        department ? department.trim() : null,
        description ? description.trim() : null,
        access_level || 'Standard',
        status || 'Active',
        permissions ? JSON.stringify(permissions) : null,
        Array.isArray(allowed_modules) ? allowed_modules : null,
        landing_module || null,
        id,
        tenantId
      ]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Cascade role rename to team members
    if (oldName && oldName.trim().toLowerCase() !== name.trim().toLowerCase()) {
      await pool.query(
        'UPDATE tenant_users SET role = $1 WHERE tenant_id = $2 AND LOWER(TRIM(role)) = LOWER(TRIM($3))',
        [name.trim(), tenantId, oldName.trim()]
      ).catch(() => { });
    }

    res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error(`[PUT /api/tenant/roles] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH Role Permissions & Access Matrix
router.patch('/api/tenant/roles/:id/permissions', async (req, res) => {
  const { id } = req.params;
  const { userUid, permissions, allowed_modules, landing_module } = req.body;

  if (!userUid) {
    return res.status(400).json({ error: 'userUid is required' });
  }

  try {
    const { authorized, tenantId } = await checkIsAdminOrHR(userUid);
    if (!tenantId) {
      return res.status(404).json({ error: 'Tenant identity not found' });
    }
    if (!authorized) {
      return res.status(403).json({ error: 'Access Denied: Only Tenant Admins and HR Executives can modify permissions' });
    }

    const updateRes = await pool.query(
      `UPDATE tenant_roles
       SET permissions = COALESCE($1, permissions),
           allowed_modules = COALESCE($2, allowed_modules),
           landing_module = COALESCE($3, landing_module)
       WHERE id = $4 AND tenant_id = $5
       RETURNING *`,
      [
        permissions ? JSON.stringify(permissions) : null,
        Array.isArray(allowed_modules) ? allowed_modules : null,
        landing_module || null,
        id,
        tenantId
      ]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json({ message: 'Permissions updated successfully', role: updateRes.rows[0] });
  } catch (err: any) {
    console.error(`[PATCH /api/tenant/roles/:id/permissions] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Role
router.delete('/api/tenant/roles/:id', async (req, res) => {
  const { id } = req.params;
  const { userUid } = req.body;
  const queryUserUid = req.query.userUid as string;
  const finalUserUid = userUid || queryUserUid;

  if (!finalUserUid) {
    return res.status(400).json({ error: 'userUid is required in query or body' });
  }

  try {
    const { authorized, tenantId } = await checkIsAdminOrHR(finalUserUid);
    if (!tenantId) {
      return res.status(404).json({ error: 'Tenant identity not found' });
    }
    if (!authorized) {
      return res.status(403).json({ error: 'Access Denied: Only Tenant Admins and HR Executives can manage roles' });
    }

    const deleteRes = await pool.query(
      'DELETE FROM tenant_roles WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json({ message: 'Role deleted successfully', role: deleteRes.rows[0] });
  } catch (err: any) {
    console.error(`[DELETE /api/tenant/roles] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
