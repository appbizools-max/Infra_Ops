import { Router } from 'express';
import { pool } from '../../config/db';
import { getTenantIdForUser, checkIsAdminOrHR } from '../../utils/tenantAuth';

const router = Router();

// TENANT DEPARTMENTS ENDPOINTS
// ==========================================
// GET Departments
router.get('/api/tenant/departments/:userUid', async (req, res) => {
  const { userUid } = req.params;
  try {
    const tenantId = await getTenantIdForUser(userUid);
    if (!tenantId) {
      return res.status(404).json({ error: 'Tenant profile not found' });
    }

    // Auto-seed default departments if none exist for this tenant
    const deptCountCheck = await pool.query('SELECT COUNT(*) FROM tenant_departments WHERE tenant_id = $1', [tenantId]);
    if (parseInt(deptCountCheck.rows[0].count, 10) === 0) {
      const defaultDepts = [
        ['Operational Staff', 'OPS-STAFF', 'Field operational staff, site support, and auxiliary execution personnel'],
        ['FMS', 'FMS', 'Fleet Management Services, heavy machinery, operators, and drivers'],
        ['Accounts', 'ACC', 'Financial ledgers, client invoices, billing, and vouchers'],
        ['HR', 'HR', 'Human resources, employee onboarding, records, and attendance']
      ];
      for (const [dName, dCode, dDesc] of defaultDepts) {
        await pool.query(
          'INSERT INTO tenant_departments (tenant_id, name, code, description) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [tenantId, dName, dCode, dDesc]
        );
      }
    }

    // Auto-seed default roles linked to departments (Operations & FMS only, none for HR & Accounts)
    const roleCountCheck = await pool.query('SELECT COUNT(*) FROM tenant_roles WHERE tenant_id = $1', [tenantId]);
    if (parseInt(roleCountCheck.rows[0].count, 10) === 0) {
      const defaultRoles = [
        ['Operations Manager', 'Operational Staff', 'Head of site operations, project timelines, and execution', 'Executive'],
        ['Operations Supervisor', 'Operational Staff', 'Direct operations supervision, worker oversight, and daily shift coordination', 'Operational'],
        ['Site Incharge', 'Operational Staff', 'Site-level leadership, resource allocation, and reporting', 'Managerial'],
        ['Driver', 'FMS', 'Tipper, dumper, and commercial transit vehicle operation', 'Operational'],
        ['Site Supervisor', 'FMS', 'Site equipment supervisor, machine allocation, and fleet oversight', 'Operational'],
        ['Dozer Operator', 'FMS', 'Heavy bulldozer, grader, loader, and earthmoving machine operations', 'Operational'],
        ['Crane Operator', 'FMS', 'Heavy mobile crane and boom lift lifting operations', 'Operational'],
        ['Accountant', 'Accounts', 'Financial accounting, vouchers, ledgers, and billing management', 'Financial'],
        ['HR', 'HR', 'Human resources executive, employee management, and attendance', 'HR']
      ];
      for (const [rName, rDept, rDesc, rLevel] of defaultRoles) {
        await pool.query(
          'INSERT INTO tenant_roles (tenant_id, name, department, description, access_level) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
          [tenantId, rName, rDept, rDesc, rLevel]
        );
      }
    }
    // Query departments with counts
    const deptsRes = await pool.query(
      `SELECT d.id, d.name, d.code, d.description, d.head_of_department, d.status, d.created_at,
              COALESCE(COUNT(DISTINCT u.id), 0)::INTEGER AS member_count,
              COALESCE(COUNT(DISTINCT r.id), 0)::INTEGER AS role_count
       FROM tenant_departments d
       LEFT JOIN tenant_users u ON LOWER(TRIM(u.department)) = LOWER(TRIM(d.name)) AND u.tenant_id = d.tenant_id
       LEFT JOIN tenant_roles r ON LOWER(TRIM(r.department)) = LOWER(TRIM(d.name)) AND r.tenant_id = d.tenant_id
       WHERE d.tenant_id = $1
       GROUP BY d.id
       ORDER BY d.created_at ASC`,
      [tenantId]
    );

    // Fetch all roles for this tenant to attach to their matching departments
    const allRolesRes = await pool.query(
      'SELECT id, name, department, access_level, status FROM tenant_roles WHERE tenant_id = $1 ORDER BY name ASC',
      [tenantId]
    );

    const departmentsWithRoles = deptsRes.rows.map(dept => {
      const deptRoles = allRolesRes.rows.filter(
        r => (r.department || '').trim().toLowerCase() === dept.name.trim().toLowerCase()
      );
      return {
        ...dept,
        roles: deptRoles
      };
    });

    res.json(departmentsWithRoles);
  } catch (err: any) {
    console.error(`[GET /api/tenant/departments] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// GET Department Details with full roles & team members
router.get('/api/tenant/departments/:id/details', async (req, res) => {
  const { id } = req.params;
  const userUid = (req.query.userUid as string) || (req.headers['x-user-uid'] as string);
  try {
    const deptRes = await pool.query('SELECT * FROM tenant_departments WHERE id = $1', [id]);
    if (deptRes.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }
    const dept = deptRes.rows[0];

    const [rolesRes, membersRes] = await Promise.all([
      pool.query(
        'SELECT * FROM tenant_roles WHERE tenant_id = $1 AND LOWER(TRIM(department)) = LOWER(TRIM($2)) ORDER BY name ASC',
        [dept.tenant_id, dept.name]
      ),
      pool.query(
        'SELECT id, name, role, email, mobile, status, member_id FROM tenant_users WHERE tenant_id = $1 AND LOWER(TRIM(department)) = LOWER(TRIM($2)) ORDER BY name ASC',
        [dept.tenant_id, dept.name]
      )
    ]);

    res.json({
      department: dept,
      roles: rolesRes.rows,
      members: membersRes.rows
    });
  } catch (err: any) {
    console.error(`[GET /api/tenant/departments/:id/details] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// POST Department
router.post('/api/tenant/departments', async (req, res) => {
  const { userUid, name, code, description, head_of_department, status } = req.body;
  if (!userUid || !name) {
    return res.status(400).json({ error: 'Missing required fields: userUid and name are required' });
  }

  try {
    const { authorized, tenantId } = await checkIsAdminOrHR(userUid);
    if (!tenantId) {
      return res.status(404).json({ error: 'Tenant identity not found' });
    }
    if (!authorized) {
      return res.status(403).json({ error: 'Access Denied: Only Tenant Admins and HR Executives can manage departments' });
    }

    const checkDup = await pool.query(
      'SELECT id FROM tenant_departments WHERE tenant_id = $1 AND LOWER(name) = LOWER($2)',
      [tenantId, name.trim()]
    );
    if (checkDup.rows.length > 0) {
      return res.status(409).json({ error: `A department named "${name.trim()}" already exists` });
    }

    const insertRes = await pool.query(
      `INSERT INTO tenant_departments (tenant_id, name, code, description, head_of_department, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        tenantId,
        name.trim(),
        code ? code.trim().toUpperCase() : null,
        description ? description.trim() : null,
        head_of_department ? head_of_department.trim() : null,
        status || 'Active'
      ]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    console.error(`[POST /api/tenant/departments] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// PUT Department
router.put('/api/tenant/departments/:id', async (req, res) => {
  const { id } = req.params;
  const { userUid, name, code, description, head_of_department, status } = req.body;

  if (!userUid || !name) {
    return res.status(400).json({ error: 'Missing required fields: userUid and name are required' });
  }

  try {
    const { authorized, tenantId } = await checkIsAdminOrHR(userUid);
    if (!tenantId) {
      return res.status(404).json({ error: 'Tenant identity not found' });
    }
    if (!authorized) {
      return res.status(403).json({ error: 'Access Denied: Only Tenant Admins and HR Executives can manage departments' });
    }

    const checkDup = await pool.query(
      'SELECT id FROM tenant_departments WHERE tenant_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3',
      [tenantId, name.trim(), id]
    );
    if (checkDup.rows.length > 0) {
      return res.status(409).json({ error: `Another department named "${name.trim()}" already exists` });
    }

    const oldDeptRes = await pool.query('SELECT name FROM tenant_departments WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    const oldName = oldDeptRes.rows[0]?.name;

    const updateRes = await pool.query(
      `UPDATE tenant_departments
       SET name = $1, code = $2, description = $3, head_of_department = $4, status = $5
       WHERE id = $6 AND tenant_id = $7
       RETURNING *`,
      [
        name.trim(),
        code ? code.trim().toUpperCase() : null,
        description ? description.trim() : null,
        head_of_department ? head_of_department.trim() : null,
        status || 'Active',
        id,
        tenantId
      ]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Cascade department rename to roles and team members
    if (oldName && oldName.trim().toLowerCase() !== name.trim().toLowerCase()) {
      await pool.query(
        'UPDATE tenant_roles SET department = $1 WHERE tenant_id = $2 AND LOWER(TRIM(department)) = LOWER(TRIM($3))',
        [name.trim(), tenantId, oldName.trim()]
      ).catch(() => { });
      await pool.query(
        'UPDATE tenant_users SET department = $1 WHERE tenant_id = $2 AND LOWER(TRIM(department)) = LOWER(TRIM($3))',
        [name.trim(), tenantId, oldName.trim()]
      ).catch(() => { });
    }

    res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error(`[PUT /api/tenant/departments] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Department
router.delete('/api/tenant/departments/:id', async (req, res) => {
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
      return res.status(403).json({ error: 'Access Denied: Only Tenant Admins and HR Executives can manage departments' });
    }

    const deleteRes = await pool.query(
      'DELETE FROM tenant_departments WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json({ message: 'Department deleted successfully', department: deleteRes.rows[0] });
  } catch (err: any) {
    console.error(`[DELETE /api/tenant/departments] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
