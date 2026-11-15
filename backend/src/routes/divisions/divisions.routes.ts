import { Router } from 'express';
import { pool } from '../../config/db';
import { getTenantIdForUser, checkIsAdminOrHR } from '../../utils/tenantAuth';

const router = Router();

router.get(['/api/tenant/divisions', '/api/tenant/divisions/:userUid'], async (req, res) => {
  const userUid = req.params.userUid || (req.query as any).userUid || (req.query as any).firebaseUid || (req.query as any).uid;
  try {
    let tenantId = userUid ? await getTenantIdForUser(userUid) : 1;
    if (!tenantId) tenantId = 1;
    let divisionsRes;
    try {
      divisionsRes = await pool.query(
        `SELECT d.id, d.name, d.state, d.city, d.pincodes, d.description, d.status, d.created_at,
                COALESCE(COUNT(DISTINCT u.id), 0)::INTEGER AS member_count
         FROM tenant_divisions d
         LEFT JOIN tenant_users u ON (u.division_id = d.id OR (u.division_ids IS NOT NULL AND d.id::text = ANY(u.division_ids)))
         WHERE d.tenant_id = $1
         GROUP BY d.id
         ORDER BY d.created_at DESC`,
        [tenantId]
      );
    } catch (joinErr: any) {
      // Safe fallback if division_ids array column does not exist yet
      divisionsRes = await pool.query(
        `SELECT d.id, d.name, d.state, d.city, d.pincodes, d.description, d.status, d.created_at,
                COALESCE(COUNT(DISTINCT u.id), 0)::INTEGER AS member_count
         FROM tenant_divisions d
         LEFT JOIN tenant_users u ON u.division_id = d.id
         WHERE d.tenant_id = $1
         GROUP BY d.id
         ORDER BY d.created_at DESC`,
        [tenantId]
      );
    }
    res.json(divisionsRes.rows);
  } catch (err: any) {
    console.error(`[GET /api/tenant/divisions] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});
// GET Team Members of a Division
router.get('/api/tenant/divisions/:id/team', async (req, res) => {
  const { id } = req.params;
  try {
    let teamRes;
    try {
      teamRes = await pool.query(
        'SELECT id, name, role, department, email, mobile, status, member_id FROM tenant_users WHERE division_id = $1 OR (division_ids IS NOT NULL AND $1::text = ANY(division_ids)) ORDER BY name ASC',
        [id]
      );
    } catch {
      teamRes = await pool.query(
        'SELECT id, name, role, department, email, mobile, status, member_id FROM tenant_users WHERE division_id = $1 ORDER BY name ASC',
        [id]
      );
    }
    res.json(teamRes.rows);
  } catch (err: any) {
    console.error(`[GET /api/tenant/divisions/team] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});
// POST Division
router.post('/api/tenant/divisions', async (req, res) => {
  const { userUid, name, state, city, pincodes, description, status } = req.body;
  if (!userUid || !name || !name.trim()) {
    return res.status(400).json({ error: 'Missing required field: name is required' });
  }
  const effectiveState = (state && state.trim()) ? state.trim() : 'General';
  const effectiveCity = (city && city.trim()) ? city.trim() : 'General';

  try {
    const { authorized, tenantId } = await checkIsAdminOrHR(userUid);
    if (!tenantId) {
      return res.status(404).json({ error: 'Tenant identity not found' });
    }
    if (!authorized) {
      return res.status(403).json({ error: 'Access Denied: Only Tenant Admins and HR Executives can manage divisions' });
    }
    // Name uniqueness check for this tenant
    const checkDup = await pool.query(
      'SELECT id FROM tenant_divisions WHERE tenant_id = $1 AND LOWER(name) = LOWER($2)',
      [tenantId, name.trim()]
    );
    if (checkDup.rows.length > 0) {
      return res.status(400).json({ error: `A division with the name "${name}" already exists.` });
    }

    const insertRes = await pool.query(
      `INSERT INTO tenant_divisions (tenant_id, name, state, city, pincodes, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, name.trim(), effectiveState, effectiveCity, pincodes || '', description || '', status || 'Active']
    );
    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    console.error(`[POST /api/tenant/divisions] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});
// PUT Division
router.put('/api/tenant/divisions/:id', async (req, res) => {
  const { id } = req.params;
  const { userUid, name, state, city, pincodes, description, status } = req.body;
  if (!userUid || !name || !name.trim()) {
    return res.status(400).json({ error: 'Missing required field: name is required' });
  }
  const effectiveState = (state && state.trim()) ? state.trim() : 'General';
  const effectiveCity = (city && city.trim()) ? city.trim() : 'General';
  try {
    const { authorized, tenantId } = await checkIsAdminOrHR(userUid);
    if (!tenantId) {
      return res.status(404).json({ error: 'Tenant identity not found' });
    }
    if (!authorized) {
      return res.status(403).json({ error: 'Access Denied: Only Tenant Admins and HR Executives can manage divisions' });
    }
    // Name uniqueness check for other divisions
    const checkDup = await pool.query(
      'SELECT id FROM tenant_divisions WHERE tenant_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3',
      [tenantId, name.trim(), id]
    );
    if (checkDup.rows.length > 0) {
      return res.status(400).json({ error: `Another division with the name "${name}" already exists.` });
    }
    const updateRes = await pool.query(
      `UPDATE tenant_divisions
       SET name = $1, state = $2, city = $3, pincodes = $4, description = $5, status = $6
       WHERE id = $7 AND tenant_id = $8
       RETURNING *`,
      [name.trim(), effectiveState, effectiveCity, pincodes || '', description || '', status || 'Active', id, tenantId]
    );
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Division not found' });
    }
    res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error(`[PUT /api/tenant/divisions] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});
// DELETE Division
router.delete('/api/tenant/divisions/:id', async (req, res) => {
  const { id } = req.params;
  const { userUid } = req.body;
  const finalUserUid = userUid || req.query.userUid;
  if (!finalUserUid) {
    return res.status(400).json({ error: 'Missing required parameter: userUid is required' });
  }
  try {
    const { authorized, tenantId } = await checkIsAdminOrHR(finalUserUid);
    if (!tenantId) {
      return res.status(404).json({ error: 'Tenant identity not found' });
    }
    if (!authorized) {
      return res.status(403).json({ error: 'Access Denied: Only Tenant Admins and HR Executives can manage divisions' });
    }
    const deleteRes = await pool.query(
      'DELETE FROM tenant_divisions WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Division not found' });
    }
    res.json({ message: 'Division deleted successfully', division: deleteRes.rows[0] });
  } catch (err: any) {
    console.error(`[DELETE /api/tenant/divisions] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
