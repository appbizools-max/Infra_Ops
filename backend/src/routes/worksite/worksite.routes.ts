import { Router } from 'express';
import { pool } from '../../config/db';

const router = Router();

// ─── WORKSITES ─────────────────────────────────────────────────────────────

// GET Worksites
router.get(['/api/tenant/worksites/:firebaseUid', '/api/tenant/worksites'], async (req, res) => {
  const firebaseUid = req.params.firebaseUid || req.query.firebaseUid || req.query.uid;
  try {
    let tenantId = null;
    if (firebaseUid) {
      const tenantRes = await pool.query(
        `SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1
         UNION
         SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1`,
        [firebaseUid]
      );
      if (tenantRes.rows.length > 0) tenantId = tenantRes.rows[0].tenant_id;
    }
    if (!tenantId) {
      const firstTenant = await pool.query('SELECT tenant_id FROM tenant_admins ORDER BY id ASC LIMIT 1');
      if (firstTenant.rows.length > 0) tenantId = firstTenant.rows[0].tenant_id;
    }
    if (!tenantId) {
      tenantId = '1';
    }

    const worksitesRes = await pool.query(
      `SELECT id, worksite_id as "id", worksite_id as "worksiteId", name, location, type, supervisor, contact, 
              workers_count as "workersCount", geofence_status as "geofenceStatus", 
              operational_status as "operationalStatus", safety_rating as "safetyRating",
              custom_fields as "customFields"
       FROM tenant_worksites WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    res.json(worksitesRes.rows);
  } catch (err: any) {
    console.error(`[GET /api/tenant/worksites] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// POST Worksite
router.post('/api/tenant/worksites', async (req, res) => {
  const { firebaseUid, name, location, type, supervisor, contact, customFields } = req.body;
  try {
    const tenantRes = await pool.query(
      `SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1
       UNION
       SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1`,
      [firebaseUid]
    );
    if (tenantRes.rows.length === 0) return res.status(404).json({ error: 'Tenant identity not found' });
    const tenantId = tenantRes.rows[0].tenant_id;

    const tenantDetails = await pool.query(`SELECT company_name FROM tenants WHERE id = $1`, [tenantId]);
    const companyName = tenantDetails.rows[0]?.company_name || 'TNT';
    const companyPrefix = companyName.replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 3).padEnd(3, 'X');

    // Sequence Generator for worksite_id (e.g. USH-SIT-0001)
    let assigned = false;
    let seqNum = 1;
    let nextWorkSiteId = '';
    while (!assigned) {
      const padded = String(seqNum).padStart(4, '0');
      nextWorkSiteId = `${companyPrefix}-SIT-${padded}`;
      const checkRes = await pool.query('SELECT id FROM tenant_worksites WHERE worksite_id = $1', [nextWorkSiteId]);
      if (checkRes.rows.length === 0) {
        assigned = true;
      } else {
        seqNum++;
      }
    }

    const insertRes = await pool.query(
      `INSERT INTO tenant_worksites 
       (tenant_id, worksite_id, name, location, type, supervisor, contact, workers_count, geofence_status, operational_status, safety_rating, custom_fields) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'Disabled', 'Active', 'A', $8) RETURNING *, worksite_id as "id", worksite_id as "worksiteId", custom_fields as "customFields"`,
      [tenantId, nextWorkSiteId, name || `Work Site #${nextWorkSiteId}`, location || 'N/A', type || 'N/A', supervisor || 'N/A', contact || 'N/A', customFields ? JSON.stringify(customFields) : null]
    );
    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    console.error(`[POST /api/tenant/worksites] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Worksite
router.put('/api/tenant/worksites/:id', async (req, res) => {
  const { id } = req.params;
  const { name, location, type, supervisor, contact, customFields } = req.body;
  try {
    const updateRes = await pool.query(
      `UPDATE tenant_worksites 
       SET name = COALESCE($1, name),
           location = COALESCE($2, location),
           type = COALESCE($3, type),
           supervisor = COALESCE($4, supervisor),
           contact = COALESCE($5, contact),
           custom_fields = COALESCE($6, custom_fields)
       WHERE worksite_id = $7 OR id::text = $7
       RETURNING *, worksite_id as "id", worksite_id as "worksiteId", custom_fields as "customFields"`,
      [name, location, type, supervisor, contact, customFields ? JSON.stringify(customFields) : null, id]
    );
    if (updateRes.rows.length === 0) return res.status(404).json({ error: 'Worksite not found' });
    res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error(`[PUT /api/tenant/worksites/:id] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Worksite
router.delete('/api/tenant/worksites/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleteRes = await pool.query('DELETE FROM tenant_worksites WHERE worksite_id = $1 RETURNING *', [id]);
    if (deleteRes.rows.length === 0) return res.status(404).json({ error: 'Worksite not found' });
    res.json({ message: 'Worksite deleted successfully' });
  } catch (err: any) {
    console.error(`[DELETE /api/tenant/worksites] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH Toggle Geofence
router.patch('/api/tenant/worksites/:id/geofence', async (req, res) => {
  const { id } = req.params;
  const { geofenceStatus } = req.body;
  try {
    const updateRes = await pool.query(
      `UPDATE tenant_worksites SET geofence_status = $1 WHERE worksite_id = $2 RETURNING *, worksite_id as "id", worksite_id as "worksiteId"`,
      [geofenceStatus, id]
    );
    if (updateRes.rows.length === 0) return res.status(404).json({ error: 'Worksite not found' });
    res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error(`[PATCH /api/tenant/worksites/geofence] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
