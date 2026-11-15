import { Router } from 'express';
import { pool } from '../../config/db';

const router = Router();


// ─── VEHICLE & EQUIPMENT ASSIGNMENT ENDPOINTS ──────────────────────────────
// GET All Vehicle Assignments
router.get(['/api/tenant/vehicle-assignments/:firebaseUid', '/api/tenant/vehicle-assignments'], async (req, res) => {
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
    if (!tenantId) tenantId = '1';

    const { status, assetType, projectId } = req.query;
    let query = `
      SELECT 
        id,
        tenant_id as "tenantId",
        asset_type as "assetType",
        asset_id as "assetId",
        asset_number as "assetNumber",
        asset_title as "assetTitle",
        project_id as "projectId",
        project_name as "projectName",
        worksite_id as "worksiteId",
        worksite_name as "worksiteName",
        assigned_to_type as "assignedToType",
        assigned_to_name as "assignedToName",
        assigned_to_phone as "assignedToPhone",
        start_date as "startDate",
        expected_end_date as "expectedEndDate",
        actual_end_date as "actualEndDate",
        meter_reading_at_assign as "meterReadingAtAssign",
        meter_reading_at_release as "meterReadingAtRelease",
        status,
        notes,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM tenant_vehicle_assignments
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (status && status !== 'All') {
      params.push(status);
      query += ` AND status = ${params.length}`;
    }
    if (assetType && assetType !== 'All') {
      params.push(assetType);
      query += ` AND asset_type = ${params.length}`;
    }
    if (projectId) {
      params.push(projectId);
      query += ` AND project_id = ${params.length}`;
    }

    query += ' ORDER BY id DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('[GET /api/tenant/vehicle-assignments] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Create Vehicle Assignment
router.post('/api/tenant/vehicle-assignments', async (req, res) => {
  const items = Array.isArray(req.body.items)
    ? req.body.items
    : (Array.isArray(req.body) ? req.body : [req.body]);

  try {
    let tenantId = null;
    const firebaseUid = req.body.firebaseUid || (items[0] && items[0].firebaseUid);
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
    if (!tenantId) tenantId = '1';

    const createdAssignments = [];

    for (const item of items) {
      const {
        assetType,
        assetId,
        assetNumber,
        assetTitle,
        projectId,
        projectName,
        worksiteId,
        worksiteName,
        assignedToType,
        assignedToName,
        assignedToPhone,
        helperName,
        helperPhone,
        helperRole,
        helperId,
        startDate,
        expectedEndDate,
        meterReadingAtAssign,
        status,
        notes
      } = item;

      if (!assetId || !assetNumber) continue;

      const insertRes = await pool.query(
        `INSERT INTO tenant_vehicle_assignments (
          tenant_id,
          asset_type,
          asset_id,
          asset_number,
          asset_title,
          project_id,
          project_name,
          worksite_id,
          worksite_name,
          assigned_to_type,
          assigned_to_name,
          assigned_to_phone,
          helper_name,
          helper_phone,
          helper_role,
          helper_id,
          start_date,
          expected_end_date,
          meter_reading_at_assign,
          status,
          notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING 
          id,
          tenant_id as "tenantId",
          asset_type as "assetType",
          asset_id as "assetId",
          asset_number as "assetNumber",
          asset_title as "assetTitle",
          project_id as "projectId",
          project_name as "projectName",
          worksite_id as "worksiteId",
          worksite_name as "worksiteName",
          assigned_to_type as "assignedToType",
          assigned_to_name as "assignedToName",
          assigned_to_phone as "assignedToPhone",
          helper_name as "helperName",
          helper_phone as "helperPhone",
          helper_role as "helperRole",
          helper_id as "helperId",
          start_date as "startDate",
          expected_end_date as "expectedEndDate",
          actual_end_date as "actualEndDate",
          meter_reading_at_assign as "meterReadingAtAssign",
          meter_reading_at_release as "meterReadingAtRelease",
          status,
          notes,
          created_at as "createdAt",
          updated_at as "updatedAt"`,
        [
          tenantId,
          assetType || 'vehicle',
          String(assetId),
          assetNumber?.trim() || '',
          assetTitle?.trim() || null,
          projectId || null,
          projectName?.trim() || null,
          worksiteId || null,
          worksiteName?.trim() || null,
          assignedToType || 'driver',
          assignedToName?.trim() || null,
          assignedToPhone?.trim() || null,
          helperName?.trim() || null,
          helperPhone?.trim() || null,
          helperRole?.trim() || null,
          helperId ? String(helperId) : null,
          startDate || new Date().toISOString().split('T')[0],
          expectedEndDate || null,
          meterReadingAtAssign !== undefined ? parseFloat(meterReadingAtAssign) : 0,
          status || 'Active',
          notes?.trim() || null
        ]
      );

      // Sync vehicle / equipment status
      if (assetType === 'vehicle') {
        await pool.query(
          `UPDATE tenant_vehicles 
           SET status = 'In Operation',
               assigned_project_id = $1,
               assigned_project_name = $2,
               assigned_driver_name = $3,
               assigned_driver_phone = $4,
               updated_at = CURRENT_TIMESTAMP
           WHERE id::text = $5 OR vehicle_number = $6`,
          [projectId || null, projectName || null, assignedToName || null, assignedToPhone || null, String(assetId), assetNumber]
        );
      } else {
        await pool.query(
          `UPDATE tenant_heavy_equipment 
           SET status = 'In Operation',
               assigned_project_id = $1,
               assigned_project_name = $2,
               assigned_worksite_name = $3,
               assigned_operator_name = $4,
               assigned_operator_phone = $5,
               updated_at = CURRENT_TIMESTAMP
           WHERE id::text = $6`,
          [projectId || null, projectName || null, worksiteName || null, assignedToName || null, assignedToPhone || null, String(assetId)]
        );
      }

      createdAssignments.push(insertRes.rows[0]);
    }

    if (Array.isArray(req.body.items) || Array.isArray(req.body)) {
      res.status(201).json(createdAssignments);
    } else {
      res.status(201).json(createdAssignments[0] || { message: 'Created' });
    }
  } catch (err: any) {
    console.error('[POST /api/tenant/vehicle-assignments] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/tenant/vehicle-assignments/:id', async (req, res) => {
  const { id } = req.params;
  const {
    projectId,
    projectName,
    worksiteId,
    worksiteName,
    assignedToType,
    assignedToName,
    assignedToPhone,
    startDate,
    expectedEndDate,
    meterReadingAtAssign,
    notes,
    status
  } = req.body;

  try {
    const updateRes = await pool.query(
      `UPDATE tenant_vehicle_assignments
       SET project_id = $1,
           project_name = $2,
           worksite_id = $3,
           worksite_name = $4,
           assigned_to_type = $5,
           assigned_to_name = $6,
           assigned_to_phone = $7,
           start_date = $8,
           expected_end_date = $9,
           meter_reading_at_assign = $10,
           notes = $11,
           status = COALESCE($12, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $13
       RETURNING 
         id,
         tenant_id as "tenantId",
         asset_type as "assetType",
         asset_id as "assetId",
         asset_number as "assetNumber",
         asset_title as "assetTitle",
         project_id as "projectId",
         project_name as "projectName",
         worksite_id as "worksiteId",
         worksite_name as "worksiteName",
         assigned_to_type as "assignedToType",
         assigned_to_name as "assignedToName",
         assigned_to_phone as "assignedToPhone",
         start_date as "startDate",
         expected_end_date as "expectedEndDate",
         actual_end_date as "actualEndDate",
         meter_reading_at_assign as "meterReadingAtAssign",
         meter_reading_at_release as "meterReadingAtRelease",
         status,
         notes,
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      [
        projectId || null,
        projectName?.trim() || null,
        worksiteId || null,
        worksiteName?.trim() || null,
        assignedToType || 'driver',
        assignedToName?.trim() || null,
        assignedToPhone?.trim() || null,
        startDate || null,
        expectedEndDate || null,
        meterReadingAtAssign !== undefined ? parseFloat(meterReadingAtAssign) : 0,
        notes?.trim() || null,
        status || null,
        id
      ]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error('[PUT /api/tenant/vehicle-assignments/:id] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH Release / Complete Assignment
router.patch('/api/tenant/vehicle-assignments/:id/release', async (req, res) => {
  const { id } = req.params;
  const { actualEndDate, meterReadingAtRelease, notes } = req.body;

  try {
    const updateRes = await pool.query(
      `UPDATE tenant_vehicle_assignments
       SET status = 'Released',
           actual_end_date = COALESCE($1, CURRENT_DATE::text),
           meter_reading_at_release = $2,
           notes = COALESCE($3, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING 
         id,
         asset_type as "assetType",
         asset_id as "assetId"`,
      [
        actualEndDate || new Date().toISOString().split('T')[0],
        meterReadingAtRelease !== undefined ? parseFloat(meterReadingAtRelease) : null,
        notes?.trim() || null,
        id
      ]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const { assetType, assetId } = updateRes.rows[0];
    if (assetType === 'vehicle') {
      await pool.query(
        `UPDATE tenant_vehicles 
         SET status = 'Idle',
             assigned_project_id = NULL,
             assigned_project_name = NULL,
             assigned_driver_name = NULL,
             assigned_driver_phone = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [assetId]
      );
    } else {
      await pool.query(
        `UPDATE tenant_heavy_equipment 
         SET status = 'Idle',
             assigned_project_id = NULL,
             assigned_project_name = NULL,
             assigned_worksite_name = NULL,
             assigned_operator_name = NULL,
             assigned_operator_phone = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [assetId]
      );
    }

    res.json({ message: 'Asset assignment released successfully', assignment: updateRes.rows[0] });
  } catch (err: any) {
    console.error('[PATCH /api/tenant/vehicle-assignments/:id/release] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Assignment
router.delete('/api/tenant/vehicle-assignments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleteRes = await pool.query('DELETE FROM tenant_vehicle_assignments WHERE id = $1 RETURNING *', [id]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json({ message: 'Assignment record deleted', assignment: deleteRes.rows[0] });
  } catch (err: any) {
    console.error('[DELETE /api/tenant/vehicle-assignments/:id] Error:', err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
