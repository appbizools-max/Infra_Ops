import { Router } from 'express';
import { pool } from '../../config/db';

const router = Router();

// ─── WORK ORDERS ─────────────────────────────────────────────────────────

// GET Work Orders
router.get(['/api/tenant/work-orders/:firebaseUid', '/api/tenant/work-orders'], async (req, res) => {
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
      return res.json([]);
    }

    const woRes = await pool.query(
      `SELECT 
         id,
         order_number as "orderNumber",
         title,
         description,
         project_id as "projectId",
         project_name as "projectName",
         client_id as "clientId",
         client_name as "clientName",
         client_code as "clientCode",
         worksite_id as "worksiteId",
         worksite_name as "worksiteName",
         assigned_staff_id as "assignedStaffId",
         assigned_staff_name as "assignedStaffName",
         division_name as "divisionName",
         department_name as "departmentName",
         priority,
         status,
         start_date as "startDate",
         due_date as "dueDate",
         end_date as "endDate",
         project_location_address as "projectLocationAddress",
         commodity,
         contract_quantity as "contractQuantity",
         contract_quantity_unit as "contractQuantityUnit",
         loading_location as "loadingLocation",
         unloading_location as "unloadingLocation",
         transport_modes as "transportModes",
         is_loss_applicable as "isLossApplicable",
         allowed_loss_percent as "allowedLossPercent",
         rate_type as "rateType",
         rate_per_unit as "ratePerUnit",
         payment_terms as "paymentTerms",
         estimated_cost as "estimatedCost",
         actual_cost as "actualCost",
         notes,
         created_at as "createdAt",
         updated_at as "updatedAt"
       FROM tenant_work_orders 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC`,
      [tenantId]
    );
    res.json(woRes.rows);
  } catch (err: any) {
    console.error(`[GET /api/tenant/work-orders] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// POST Work Order
router.post('/api/tenant/work-orders', async (req, res) => {
  const {
    firebaseUid,
    title,
    description,
    projectId,
    projectName,
    clientId,
    clientName,
    clientCode,
    worksiteId,
    worksiteName,
    assignedStaffId,
    assignedStaffName,
    divisionName,
    departmentName,
    priority,
    status,
    startDate,
    dueDate,
    endDate,
    projectLocationAddress,
    commodity,
    contractQuantity,
    contractQuantityUnit,
    loadingLocation,
    unloadingLocation,
    transportModes,
    isLossApplicable,
    allowedLossPercent,
    rateType,
    ratePerUnit,
    paymentTerms,
    estimatedCost,
    actualCost,
    notes
  } = req.body;

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

    // Sequence Generator for order_number (e.g. USH-WO-0001)
    let assigned = false;
    let seqNum = 1;
    let nextOrderNumber = '';
    while (!assigned) {
      const padded = String(seqNum).padStart(4, '0');
      nextOrderNumber = `${companyPrefix}-WO-${padded}`;
      const checkRes = await pool.query('SELECT id FROM tenant_work_orders WHERE order_number = $1', [nextOrderNumber]);
      if (checkRes.rows.length === 0) {
        assigned = true;
      } else {
        seqNum++;
      }
    }

    const effectiveEndDate = endDate || dueDate || null;
    const finalTransportModes = Array.isArray(transportModes) ? transportModes.join(', ') : (transportModes || '');

    const insertRes = await pool.query(
      `INSERT INTO tenant_work_orders 
       (tenant_id, order_number, title, description, project_id, project_name, 
        client_id, client_name, client_code,
        worksite_id, worksite_name, assigned_staff_id, assigned_staff_name, 
        division_name, department_name, priority, status, 
        start_date, due_date, end_date, project_location_address, commodity, 
        contract_quantity, contract_quantity_unit, 
        loading_location, unloading_location, transport_modes,
        is_loss_applicable, allowed_loss_percent, rate_type, rate_per_unit, payment_terms,
        estimated_cost, actual_cost, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)
       RETURNING 
         id,
         order_number as "orderNumber",
         title,
         description,
         project_id as "projectId",
         project_name as "projectName",
         client_id as "clientId",
         client_name as "clientName",
         client_code as "clientCode",
         worksite_id as "worksiteId",
         worksite_name as "worksiteName",
         assigned_staff_id as "assignedStaffId",
         assigned_staff_name as "assignedStaffName",
         division_name as "divisionName",
         department_name as "departmentName",
         priority,
         status,
         start_date as "startDate",
         due_date as "dueDate",
         end_date as "endDate",
         project_location_address as "projectLocationAddress",
         commodity,
         contract_quantity as "contractQuantity",
         contract_quantity_unit as "contractQuantityUnit",
         loading_location as "loadingLocation",
         unloading_location as "unloadingLocation",
         transport_modes as "transportModes",
         is_loss_applicable as "isLossApplicable",
         allowed_loss_percent as "allowedLossPercent",
         rate_type as "rateType",
         rate_per_unit as "ratePerUnit",
         payment_terms as "paymentTerms",
         estimated_cost as "estimatedCost",
         actual_cost as "actualCost",
         notes,
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      [
        tenantId,
        nextOrderNumber,
        title || `Work Order ${nextOrderNumber}`,
        description || '',
        projectId || null,
        projectName || null,
        clientId || null,
        clientName || null,
        clientCode || null,
        worksiteId || null,
        worksiteName || null,
        assignedStaffId || null,
        assignedStaffName || null,
        divisionName || null,
        departmentName || null,
        priority || 'Medium',
        status || 'Pending',
        startDate || null,
        effectiveEndDate,
        effectiveEndDate,
        projectLocationAddress || null,
        commodity || 'General Cargo',
        contractQuantity || null,
        contractQuantityUnit || 'Tons',
        loadingLocation || null,
        unloadingLocation || null,
        finalTransportModes || null,
        Boolean(isLossApplicable),
        Number(allowedLossPercent) || 0,
        rateType || 'Per Ton',
        Number(ratePerUnit) || 0,
        paymentTerms || 'Net 30 Days',
        Number(estimatedCost) || 0,
        Number(actualCost) || 0,
        notes || ''
      ]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    console.error(`[POST /api/tenant/work-orders] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Work Order
router.put('/api/tenant/work-orders/:id', async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    projectId,
    projectName,
    clientId,
    clientName,
    clientCode,
    worksiteId,
    worksiteName,
    assignedStaffId,
    assignedStaffName,
    divisionName,
    departmentName,
    priority,
    status,
    startDate,
    dueDate,
    endDate,
    projectLocationAddress,
    commodity,
    contractQuantity,
    contractQuantityUnit,
    loadingLocation,
    unloadingLocation,
    transportModes,
    isLossApplicable,
    allowedLossPercent,
    rateType,
    ratePerUnit,
    paymentTerms,
    estimatedCost,
    actualCost,
    notes
  } = req.body;

  const effectiveEndDate = endDate !== undefined ? endDate : dueDate;
  const finalTransportModes = transportModes !== undefined ? (Array.isArray(transportModes) ? transportModes.join(', ') : transportModes) : undefined;

  try {
    const updateRes = await pool.query(
      `UPDATE tenant_work_orders 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           project_id = COALESCE($3, project_id),
           project_name = COALESCE($4, project_name),
           client_id = COALESCE($5, client_id),
           client_name = COALESCE($6, client_name),
           client_code = COALESCE($7, client_code),
           worksite_id = COALESCE($8, worksite_id),
           worksite_name = COALESCE($9, worksite_name),
           assigned_staff_id = COALESCE($10, assigned_staff_id),
           assigned_staff_name = COALESCE($11, assigned_staff_name),
           division_name = COALESCE($12, division_name),
           department_name = COALESCE($13, department_name),
           priority = COALESCE($14, priority),
           status = COALESCE($15, status),
           start_date = COALESCE($16, start_date),
           due_date = COALESCE($17, due_date),
           end_date = COALESCE($18, end_date),
           project_location_address = COALESCE($19, project_location_address),
           commodity = COALESCE($20, commodity),
           contract_quantity = COALESCE($21, contract_quantity),
           contract_quantity_unit = COALESCE($22, contract_quantity_unit),
           loading_location = COALESCE($23, loading_location),
           unloading_location = COALESCE($24, unloading_location),
           transport_modes = COALESCE($25, transport_modes),
           is_loss_applicable = COALESCE($26, is_loss_applicable),
           allowed_loss_percent = COALESCE($27, allowed_loss_percent),
           rate_type = COALESCE($28, rate_type),
           rate_per_unit = COALESCE($29, rate_per_unit),
           payment_terms = COALESCE($30, payment_terms),
           estimated_cost = COALESCE($31, estimated_cost),
           actual_cost = COALESCE($32, actual_cost),
           notes = COALESCE($33, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id::text = $34 OR order_number = $34
       RETURNING 
         id,
         order_number as "orderNumber",
         title,
         description,
         project_id as "projectId",
         project_name as "projectName",
         client_id as "clientId",
         client_name as "clientName",
         client_code as "clientCode",
         worksite_id as "worksiteId",
         worksite_name as "worksiteName",
         assigned_staff_id as "assignedStaffId",
         assigned_staff_name as "assignedStaffName",
         division_name as "divisionName",
         department_name as "departmentName",
         priority,
         status,
         start_date as "startDate",
         due_date as "dueDate",
         end_date as "endDate",
         project_location_address as "projectLocationAddress",
         commodity,
         contract_quantity as "contractQuantity",
         contract_quantity_unit as "contractQuantityUnit",
         loading_location as "loadingLocation",
         unloading_location as "unloadingLocation",
         transport_modes as "transportModes",
         is_loss_applicable as "isLossApplicable",
         allowed_loss_percent as "allowedLossPercent",
         rate_type as "rateType",
         rate_per_unit as "ratePerUnit",
         payment_terms as "paymentTerms",
         estimated_cost as "estimatedCost",
         actual_cost as "actualCost",
         notes,
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      [
        title,
        description,
        projectId,
        projectName,
        clientId,
        clientName,
        clientCode,
        worksiteId,
        worksiteName,
        assignedStaffId,
        assignedStaffName,
        divisionName,
        departmentName,
        priority,
        status,
        startDate,
        effectiveEndDate,
        effectiveEndDate,
        projectLocationAddress,
        commodity,
        contractQuantity,
        contractQuantityUnit,
        loadingLocation,
        unloadingLocation,
        finalTransportModes,
        isLossApplicable !== undefined ? Boolean(isLossApplicable) : null,
        allowedLossPercent !== undefined ? Number(allowedLossPercent) : null,
        rateType,
        ratePerUnit !== undefined ? Number(ratePerUnit) : null,
        paymentTerms,
        estimatedCost !== undefined ? Number(estimatedCost) : null,
        actualCost !== undefined ? Number(actualCost) : null,
        notes,
        id
      ]
    );

    if (updateRes.rows.length === 0) return res.status(404).json({ error: 'Work order not found' });
    res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error(`[PUT /api/tenant/work-orders/:id] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH Status
router.patch('/api/tenant/work-orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const updateRes = await pool.query(
      `UPDATE tenant_work_orders 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id::text = $2 OR order_number = $2
       RETURNING 
         id,
         order_number as "orderNumber",
         title,
         description,
         project_id as "projectId",
         project_name as "projectName",
         worksite_id as "worksiteId",
         worksite_name as "worksiteName",
         assigned_staff_id as "assignedStaffId",
         assigned_staff_name as "assignedStaffName",
         division_name as "divisionName",
         department_name as "departmentName",
         priority,
         status,
         start_date as "startDate",
         due_date as "dueDate",
         end_date as "endDate",
         project_location_address as "projectLocationAddress",
         commodity,
         contract_quantity as "contractQuantity",
         contract_quantity_unit as "contractQuantityUnit",
         estimated_cost as "estimatedCost",
         actual_cost as "actualCost",
         notes,
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      [status, id]
    );
    if (updateRes.rows.length === 0) return res.status(404).json({ error: 'Work order not found' });
    res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error(`[PATCH /api/tenant/work-orders/status] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Work Order
router.delete('/api/tenant/work-orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleteRes = await pool.query('DELETE FROM tenant_work_orders WHERE id::text = $1 OR order_number = $1 RETURNING *', [id]);
    if (deleteRes.rows.length === 0) return res.status(404).json({ error: 'Work order not found' });
    res.json({ message: 'Work order deleted successfully' });
  } catch (err: any) {
    console.error(`[DELETE /api/tenant/work-orders] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// POST Convert Work Order to Project
router.post('/api/tenant/work-orders/:id/convert-to-project', async (req, res) => {
  const { id } = req.params;
  const { firebaseUid, projectHeadName, projectHeadRole, divisionName } = req.body;

  try {
    const tenantRes = await pool.query(
      `SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1
       UNION
       SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1`,
      [firebaseUid]
    );
    if (tenantRes.rows.length === 0) return res.status(404).json({ error: 'Tenant identity not found' });
    const tenantId = tenantRes.rows[0].tenant_id;

    // Fetch the work order
    const woRes = await pool.query(
      `SELECT * FROM tenant_work_orders WHERE (id::text = $1 OR order_number = $1) AND tenant_id = $2`,
      [id, tenantId]
    );
    if (woRes.rows.length === 0) return res.status(404).json({ error: 'Work order not found' });
    const wo = woRes.rows[0];

    // Check if already converted
    if (wo.project_id) {
      return res.status(400).json({ error: `Already converted to project ${wo.project_id}` });
    }

    const effectiveDivision = divisionName || wo.division_name || '';

    // Sequence Generator for project_id (e.g. ASD-PRJ-0001)
    const tenantDetails = await pool.query(`SELECT company_name FROM tenants WHERE id = $1`, [tenantId]);
    const companyName = tenantDetails.rows[0]?.company_name || 'TNT';
    const companyPrefix = companyName.replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 3).padEnd(3, 'X');
    const projectName = wo.title || 'Project';
    const projectPrefix = projectName.replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 3).padEnd(3, 'X');

    let assigned = false;
    let seqNum = 1;
    let nextProjId = '';
    while (!assigned) {
      const padded = String(seqNum).padStart(4, '0');
      nextProjId = `${companyPrefix}-${projectPrefix}-${padded}`;
      const checkId = await pool.query(
        'SELECT id FROM tenant_projects WHERE tenant_id = $1 AND project_id = $2',
        [tenantId, nextProjId]
      );
      if (checkId.rows.length === 0) {
        assigned = true;
      } else {
        seqNum++;
      }
    }

    const customerInfo = wo.client_name
      ? `${wo.client_name}${wo.client_code ? ` (${wo.client_code})` : ''}`
      : (projectHeadName ? `Lead: ${projectHeadName}` : 'Work Order Conversion');
    const customFieldsObj = projectHeadName
      ? {
        'Assigned Project Lead': projectHeadName,
        'Staff Role': projectHeadRole || 'Project Head',
        'Client Name / ID': wo.client_name ? `${wo.client_name}${wo.client_code ? ` (${wo.client_code})` : ''}` : 'N/A'
      }
      : null;

    // Insert into tenant_projects with location, commodity, quantity, dates, and assigned project head
    const insertProj = await pool.query(
      `INSERT INTO tenant_projects 
       (tenant_id, project_id, name, location, location_block, customer, commodity, contract_quantity, contract_quantity_unit, contract_start_date, contract_end_date, other_data, custom_fields, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'Active')
       RETURNING *, project_id as "id"`,
      [
        tenantId,
        nextProjId,
        wo.title,
        wo.unloading_location || wo.project_location_address || wo.loading_location || wo.worksite_name || 'N/A',
        effectiveDivision,
        customerInfo,
        wo.commodity || 'General Cargo',
        wo.contract_quantity || null,
        wo.contract_quantity_unit || 'Tons',
        wo.start_date || new Date().toISOString().split('T')[0],
        wo.end_date || wo.due_date || '',
        JSON.stringify({
          originWorkOrder: wo.order_number,
          estimatedCost: wo.estimated_cost,
          projectHeadName: projectHeadName || null,
          projectHeadRole: projectHeadRole || null,
          clientId: wo.client_id || null,
          clientName: wo.client_name || null,
          clientCode: wo.client_code || null,
          division: effectiveDivision,
          notes: wo.notes,
          description: wo.description,
          loadingLocation: wo.loading_location || null,
          unloadingLocation: wo.unloading_location || null,
          transportModes: wo.transport_modes || null,
          isLossApplicable: wo.is_loss_applicable || false,
          allowedLossPercent: wo.allowed_loss_percent || 0,
          rateType: wo.rate_type || null,
          ratePerUnit: wo.rate_per_unit || 0,
          paymentTerms: wo.payment_terms || null
        }),
        customFieldsObj ? JSON.stringify(customFieldsObj) : null
      ]
    );
    const createdProj = insertProj.rows[0];

    // Update the work order with project linkage, assigned staff, and division if newly set
    const updateWo = await pool.query(
      `UPDATE tenant_work_orders
       SET project_id = $1, 
           project_name = $2, 
           assigned_staff_name = COALESCE($3, assigned_staff_name), 
           division_name = COALESCE(NULLIF($4, ''), division_name),
           status = 'Created', 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING 
         id,
         order_number as "orderNumber",
         title,
         description,
         project_id as "projectId",
         project_name as "projectName",
         client_id as "clientId",
         client_name as "clientName",
         client_code as "clientCode",
         worksite_id as "worksiteId",
         worksite_name as "worksiteName",
         assigned_staff_id as "assignedStaffId",
         assigned_staff_name as "assignedStaffName",
         division_name as "divisionName",
         department_name as "departmentName",
         priority,
         status,
         start_date as "startDate",
         due_date as "dueDate",
         end_date as "endDate",
         project_location_address as "projectLocationAddress",
         commodity,
         contract_quantity as "contractQuantity",
         contract_quantity_unit as "contractQuantityUnit",
         loading_location as "loadingLocation",
         unloading_location as "unloadingLocation",
         transport_modes as "transportModes",
         is_loss_applicable as "isLossApplicable",
         allowed_loss_percent as "allowedLossPercent",
         rate_type as "rateType",
         rate_per_unit as "ratePerUnit",
         payment_terms as "paymentTerms",
         estimated_cost as "estimatedCost",
         actual_cost as "actualCost",
         notes,
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      [createdProj.project_id, createdProj.name, projectHeadName || null, effectiveDivision || null, wo.id]
    );

    res.json({
      message: `Work order successfully converted to project ${createdProj.project_id}`,
      project: createdProj,
      workOrder: updateWo.rows[0]
    });
  } catch (err: any) {
    console.error(`[POST /api/tenant/work-orders/:id/convert-to-project] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
