import { Router } from 'express';
import { pool } from '../../config/db';

const router = Router();

// Helper: Resolve tenantId from request
const resolveTenantId = async (req: any): Promise<number> => {
  if (req.user?.tenantId) return req.user.tenantId;
  const firebaseUid = req.query?.firebaseUid || req.body?.firebaseUid || (req.headers['x-firebase-uid'] as string);
  if (firebaseUid) {
    const aRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [firebaseUid]);
    if (aRes.rows.length > 0) return aRes.rows[0].tenant_id;
    const uRes = await pool.query('SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1', [firebaseUid]);
    if (uRes.rows.length > 0) return uRes.rows[0].tenant_id;
  }
  return 1;
};

// ====================================================================
// 1. GET ALL OPERATIONS / CURRENT OPERATIONS
// ====================================================================
router.get('/api/tenant/operations', async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    const { status, search, projectId } = req.query as any;

    const params: any[] = [tenantId];
    let filterClauses = '';

    if (status && status !== 'ALL') {
      if (status === 'RUNNING' || status === 'Running' || status === 'ACTIVE') {
        filterClauses += ` AND LOWER(o.status) IN ('running', 'active', 'in_progress')`;
      } else {
        params.push(status);
        filterClauses += ` AND LOWER(o.status) = LOWER($${params.length})`;
      }
    }

    if (projectId && projectId !== 'ALL') {
      params.push(projectId);
      filterClauses += ` AND o.project_id = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      filterClauses += ` AND (o.name ILIKE $${params.length} OR o.op_code ILIKE $${params.length} OR o.material_name ILIKE $${params.length} OR o.project_name ILIKE $${params.length})`;
    }

    const query = `
      SELECT 
        o.id,
        o.tenant_id as "tenantId",
        o.op_code as "opCode",
        o.name,
        o.project_id as "projectId",
        o.project_name as "projectName",
        o.material_name as "materialName",
        o.unit_of_measure as "unitOfMeasure",
        o.transport_mode as "transportMode",
        o.origin_type as "originType",
        o.origin_id as "originId",
        o.origin_name as "originName",
        o.corridor_id as "corridorId",
        o.corridor_name as "corridorName",
        o.route_checkpoints as "routeCheckpoints",
        o.overall_supervisor_uid as "overallSupervisorUid",
        o.overall_supervisor_name as "overallSupervisorName",
        o.overall_supervisor_phone as "overallSupervisorPhone",
        COALESCE(o.planned_quantity_tons, 0)::NUMERIC as "plannedQuantityTons",
        COALESCE(o.dispatched_quantity_tons, 0)::NUMERIC as "dispatchedQuantityTons",
        COALESCE(o.received_quantity_tons, 0)::NUMERIC as "receivedQuantityTons",
        o.status,
        o.remarks,
        o.created_by as "createdBy",
        o.created_at as "createdAt",
        o.updated_at as "updatedAt",
        (SELECT COUNT(*)::INTEGER FROM tenant_operation_trips t WHERE t.operation_id = o.id) as "totalTripsCount",
        (SELECT COUNT(*)::INTEGER FROM tenant_operation_trips t WHERE t.operation_id = o.id AND t.current_stage IN ('LOADED', 'IN_TRANSIT', 'WEIGHBRIDGE_IN', 'UNLOADING')) as "activeVehiclesCount",
        (SELECT COUNT(*)::INTEGER FROM tenant_operation_stockyards sy WHERE sy.operation_id = o.id) as "stockyardsCount"
      FROM tenant_operations o
      WHERE o.tenant_id = $1 ${filterClauses}
      ORDER BY 
        CASE WHEN LOWER(o.status) IN ('running', 'active') THEN 1 ELSE 2 END,
        o.created_at DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('[GET /api/tenant/operations] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 2. GET SINGLE OPERATION FULL DETAILS (PANORAMIC TRACKER)
// ====================================================================
router.get('/api/tenant/operations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = await resolveTenantId(req);

    const opRes = await pool.query(`
      SELECT 
        o.id,
        o.tenant_id as "tenantId",
        o.op_code as "opCode",
        o.name,
        o.project_id as "projectId",
        o.project_name as "projectName",
        o.material_name as "materialName",
        o.unit_of_measure as "unitOfMeasure",
        o.transport_mode as "transportMode",
        o.origin_type as "originType",
        o.origin_id as "originId",
        o.origin_name as "originName",
        o.corridor_id as "corridorId",
        o.corridor_name as "corridorName",
        o.route_checkpoints as "routeCheckpoints",
        o.overall_supervisor_uid as "overallSupervisorUid",
        o.overall_supervisor_name as "overallSupervisorName",
        o.overall_supervisor_phone as "overallSupervisorPhone",
        COALESCE(o.planned_quantity_tons, 0)::NUMERIC as "plannedQuantityTons",
        COALESCE(o.dispatched_quantity_tons, 0)::NUMERIC as "dispatchedQuantityTons",
        COALESCE(o.received_quantity_tons, 0)::NUMERIC as "receivedQuantityTons",
        o.status,
        o.remarks,
        o.created_by as "createdBy",
        o.created_at as "createdAt",
        o.updated_at as "updatedAt"
      FROM tenant_operations o
      WHERE o.id = $1 AND o.tenant_id = $2
    `, [id, tenantId]);

    if (opRes.rows.length === 0) {
      return res.status(404).json({ error: 'Operation not found' });
    }

    const operation = opRes.rows[0];

    // Fetch Stockyards associated with operation
    const syRes = await pool.query(`
      SELECT 
        sy.id,
        sy.stockyard_id as "stockyardId",
        sy.stockyard_name as "stockyardName",
        sy.supervisor_uid as "supervisorUid",
        sy.supervisor_name as "supervisorName",
        sy.supervisor_phone as "supervisorPhone",
        sy.target_stock_point_id as "targetStockPointId",
        sy.target_stock_point_name as "targetStockPointName",
        COALESCE(sy.planned_allocation_tons, 0)::NUMERIC as "plannedAllocationTons",
        COALESCE(sy.received_tons, 0)::NUMERIC as "receivedTons",
        sy.status,
        sy.created_at as "createdAt",
        y.location as "stockyardLocation"
      FROM tenant_operation_stockyards sy
      LEFT JOIN tenant_stockyards y ON sy.stockyard_id = y.id
      WHERE sy.operation_id = $1
      ORDER BY sy.id ASC
    `, [id]);

    // Fetch Trips (Dispatches & Consignments)
    const tripsRes = await pool.query(`
      SELECT 
        t.id,
        t.trip_number as "tripNumber",
        t.transport_mode as "transportMode",
        t.is_temporary as "isTemporary",
        t.vehicle_id as "vehicleId",
        t.vehicle_number as "vehicleNumber",
        t.driver_name as "driverName",
        t.driver_phone as "driverPhone",
        t.train_number as "trainNumber",
        t.rake_number as "rakeNumber",
        t.wagon_numbers as "wagonNumbers",
        t.challan_number as "challanNumber",
        t.waybill_number as "waybillNumber",
        t.invoice_numbers as "invoiceNumbers",
        COALESCE(t.gross_weight, 0)::NUMERIC as "grossWeight",
        COALESCE(t.tare_weight, 0)::NUMERIC as "tareWeight",
        COALESCE(t.net_weight, 0)::NUMERIC as "netWeight",
        COALESCE(t.received_gross_weight, 0)::NUMERIC as "receivedGrossWeight",
        COALESCE(t.received_tare_weight, 0)::NUMERIC as "receivedTareWeight",
        COALESCE(t.received_net_weight, 0)::NUMERIC as "receivedNetWeight",
        COALESCE(t.weight_difference, 0)::NUMERIC as "weightDifference",
        t.destination_stockyard_id as "destinationStockyardId",
        y.yard_name as "destinationStockyardName",
        t.destination_stock_point_id as "destinationStockPointId",
        t.destination_stock_point_name as "destinationStockPointName",
        t.machinery_id as "machineryId",
        t.machinery_name as "machineryName",
        COALESCE(t.machinery_hours_used, 0)::NUMERIC as "machineryHoursUsed",
        t.current_stage as "currentStage",
        t.dispatched_by_name as "dispatchedByName",
        t.dispatched_at as "dispatchedAt",
        t.received_by_name as "receivedByName",
        t.received_at as "receivedAt",
        t.remarks,
        t.created_at as "createdAt"
      FROM tenant_operation_trips t
      LEFT JOIN tenant_stockyards y ON t.destination_stockyard_id = y.id
      WHERE t.operation_id = $1
      ORDER BY t.created_at DESC
    `, [id]);

    // Fetch Change Requests history
    const crRes = await pool.query(`
      SELECT 
        cr.id,
        cr.requested_by_name as "requestedByName",
        cr.requested_by_role as "requestedByRole",
        cr.change_type as "changeType",
        cr.summary,
        cr.proposed_changes as "proposedChanges",
        cr.current_values as "currentValues",
        cr.status,
        cr.reviewed_by_name as "reviewedByName",
        cr.reviewer_remarks as "reviewerRemarks",
        cr.reviewed_at as "reviewedAt",
        cr.created_at as "createdAt"
      FROM tenant_operation_change_requests cr
      WHERE cr.operation_id = $1
      ORDER BY cr.created_at DESC
    `, [id]);

    res.json({
      ...operation,
      stockyards: syRes.rows,
      trips: tripsRes.rows,
      changeRequests: crRes.rows
    });
  } catch (err: any) {
    console.error('[GET /api/tenant/operations/:id] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 3. POST CREATE NEW OPERATION
// ====================================================================
router.post('/api/tenant/operations', async (req, res) => {
  const client = await pool.connect();
  try {
    const tenantId = await resolveTenantId(req);
    const {
      name, opCode, projectId, projectName, materialName, unitOfMeasure = 'MT',
      transportMode = 'TRUCK', originType = 'WORKSITE', originId, originName,
      corridorId, corridorName, routeCheckpoints = [],
      overallSupervisorUid, overallSupervisorName, overallSupervisorPhone,
      plannedQuantityTons = 0, remarks, stockyards = [], createdBy
    } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Operation Name is required' });
    if (!projectId || !projectName) return res.status(400).json({ error: 'Project association is required' });
    if (!materialName || !materialName.trim()) return res.status(400).json({ error: 'Material name is required' });
    if (!originName || !originName.trim()) return res.status(400).json({ error: 'Origin location is required' });

    let finalOpCode = (opCode || '').trim().toUpperCase();
    if (!finalOpCode) {
      finalOpCode = `OP-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    await client.query('BEGIN');

    // 1. Insert Operation
    const insertOpRes = await client.query(`
      INSERT INTO tenant_operations (
        tenant_id, op_code, name, project_id, project_name, material_name, unit_of_measure,
        transport_mode, origin_type, origin_id, origin_name, corridor_id, corridor_name,
        route_checkpoints, overall_supervisor_uid, overall_supervisor_name, overall_supervisor_phone,
        planned_quantity_tons, status, remarks, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING id, op_code as "opCode", name, status, created_at as "createdAt"
    `, [
      tenantId, finalOpCode, name.trim(), projectId, projectName, materialName.trim(), unitOfMeasure,
      transportMode, originType, originId || null, originName.trim(), corridorId || null, corridorName || null,
      JSON.stringify(routeCheckpoints), overallSupervisorUid || null, overallSupervisorName || null, overallSupervisorPhone || null,
      parseFloat(plannedQuantityTons) || 0, 'Running', remarks || '', createdBy || 'Admin'
    ]);

    const operationId = insertOpRes.rows[0].id;

    // 2. Insert Associated Stockyards with supervisors
    if (Array.isArray(stockyards) && stockyards.length > 0) {
      for (const sy of stockyards) {
        if (!sy.stockyardId) continue;
        await client.query(`
          INSERT INTO tenant_operation_stockyards (
            tenant_id, operation_id, stockyard_id, stockyard_name,
            supervisor_uid, supervisor_name, supervisor_phone,
            target_stock_point_id, target_stock_point_name,
            planned_allocation_tons, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          tenantId, operationId, sy.stockyardId, sy.stockyardName || 'Stockyard',
          sy.supervisorUid || overallSupervisorUid || null,
          sy.supervisorName || overallSupervisorName || null,
          sy.supervisorPhone || overallSupervisorPhone || null,
          sy.targetStockPointId || null,
          sy.targetStockPointName || null,
          parseFloat(sy.plannedAllocationTons) || 0,
          'Active'
        ]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Operation created successfully',
      operation: insertOpRes.rows[0]
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[POST /api/tenant/operations] Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ====================================================================
// 4. POST DISPATCH VEHICLE / TRIP (AT LOADING START POINT)
// ====================================================================
router.post('/api/tenant/operations/:id/trips/dispatch', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const tenantId = await resolveTenantId(req);
    const {
      transportMode = 'TRUCK', isTemporary = false,
      vehicleId, vehicleNumber, driverName, driverPhone,
      trainNumber, rakeNumber, wagonNumbers = [],
      challanNumber, waybillNumber, invoiceNumbers = [],
      grossWeight = 0, tareWeight = 0, netWeight = 0,
      destinationStockyardId, destinationStockPointId, destinationStockPointName,
      dispatchedByUid, dispatchedByName, remarks
    } = req.body;

    if (!vehicleNumber && !trainNumber) {
      return res.status(400).json({ error: 'Vehicle number or Train number is required for dispatch' });
    }

    // Verify operation exists
    const opCheck = await client.query('SELECT id, op_code, name, material_name FROM tenant_operations WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (opCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Operation not found' });
    }
    const op = opCheck.rows[0];

    const calcNet = parseFloat(netWeight) || Math.max(0, (parseFloat(grossWeight) || 0) - (parseFloat(tareWeight) || 0));
    const tripNumber = `TRP-${op.op_code}-${Math.floor(1000 + Math.random() * 9000)}`;

    await client.query('BEGIN');

    // 1. Insert Trip Record
    const insertTrip = await client.query(`
      INSERT INTO tenant_operation_trips (
        tenant_id, operation_id, trip_number, transport_mode, is_temporary,
        vehicle_id, vehicle_number, driver_name, driver_phone,
        train_number, rake_number, wagon_numbers, challan_number, waybill_number,
        invoice_numbers, gross_weight, tare_weight, net_weight,
        destination_stockyard_id, destination_stock_point_id, destination_stock_point_name,
        current_stage, dispatched_by_uid, dispatched_by_name, dispatched_at, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, CURRENT_TIMESTAMP, $25)
      RETURNING *
    `, [
      tenantId, id, tripNumber, transportMode, !!isTemporary,
      vehicleId || null, (vehicleNumber || trainNumber || '').toUpperCase().trim(),
      driverName || 'Driver', driverPhone || '',
      trainNumber || null, rakeNumber || null, JSON.stringify(wagonNumbers),
      challanNumber || null, waybillNumber || `WB-${Math.floor(100000 + Math.random() * 900000)}`,
      JSON.stringify(invoiceNumbers), parseFloat(grossWeight) || 0, parseFloat(tareWeight) || 0, calcNet,
      destinationStockyardId || null, destinationStockPointId || null, destinationStockPointName || null,
      'IN_TRANSIT', dispatchedByUid || null, dispatchedByName || 'Supervisor', remarks || ''
    ]);

    // 2. Increment Operation Dispatched Total
    await client.query(`
      UPDATE tenant_operations
      SET dispatched_quantity_tons = COALESCE(dispatched_quantity_tons, 0) + $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [calcNet, id]);

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Consignment successfully dispatched into transit',
      trip: insertTrip.rows[0]
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[POST /trips/dispatch] Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ====================================================================
// 5. POST RECEIVE VEHICLE & UNLOAD (AT DESTINATION STOCKYARD)
// ====================================================================
router.post('/api/tenant/operations/trips/:tripId/receive', async (req, res) => {
  const client = await pool.connect();
  try {
    const { tripId } = req.params;
    const tenantId = await resolveTenantId(req);
    const {
      receivedGrossWeight = 0, receivedTareWeight = 0, receivedNetWeight = 0,
      destinationStockyardId, destinationStockPointId, destinationStockPointName,
      machineryId, machineryName, machineryHoursUsed = 0,
      receivedByUid, receivedByName, remarks
    } = req.body;

    // Fetch trip and parent operation
    const tripRes = await client.query(`
      SELECT t.*, o.project_id, o.project_name, o.material_name, o.unit_of_measure
      FROM tenant_operation_trips t
      JOIN tenant_operations o ON t.operation_id = o.id
      WHERE t.id = $1 AND t.tenant_id = $2
    `, [tripId, tenantId]);

    if (tripRes.rows.length === 0) {
      return res.status(404).json({ error: 'Trip record not found' });
    }
    const trip = tripRes.rows[0];

    const finalReceivedNet = parseFloat(receivedNetWeight) || Math.max(0, (parseFloat(receivedGrossWeight) || 0) - (parseFloat(receivedTareWeight) || 0)) || trip.net_weight;
    const weightDiff = parseFloat((finalReceivedNet - (parseFloat(trip.net_weight) || 0)).toFixed(2));
    const targetYardId = destinationStockyardId || trip.destination_stockyard_id;
    const targetPointId = destinationStockPointId || trip.destination_stock_point_id;
    const targetPointName = destinationStockPointName || trip.destination_stock_point_name;

    await client.query('BEGIN');

    // 1. Update Trip Stage to COMPLETED
    const updatedTrip = await client.query(`
      UPDATE tenant_operation_trips
      SET 
        received_gross_weight = $1,
        received_tare_weight = $2,
        received_net_weight = $3,
        weight_difference = $4,
        destination_stockyard_id = COALESCE($5, destination_stockyard_id),
        destination_stock_point_id = COALESCE($6, destination_stock_point_id),
        destination_stock_point_name = COALESCE($7, destination_stock_point_name),
        machinery_id = $8,
        machinery_name = $9,
        machinery_hours_used = $10,
        current_stage = 'COMPLETED',
        received_by_uid = $11,
        received_by_name = $12,
        received_at = CURRENT_TIMESTAMP,
        remarks = COALESCE($13, remarks)
      WHERE id = $14
      RETURNING *
    `, [
      parseFloat(receivedGrossWeight) || 0,
      parseFloat(receivedTareWeight) || 0,
      finalReceivedNet,
      weightDiff,
      targetYardId || null,
      targetPointId || null,
      targetPointName || null,
      machineryId || null,
      machineryName || null,
      parseFloat(machineryHoursUsed) || 0,
      receivedByUid || null,
      receivedByName || 'Supervisor',
      remarks || null,
      tripId
    ]);

    // 2. Increment Operation Received Total
    await client.query(`
      UPDATE tenant_operations
      SET received_quantity_tons = COALESCE(received_quantity_tons, 0) + $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [finalReceivedNet, trip.operation_id]);

    // 3. Increment Operation Stockyard Allocation Received Total
    if (targetYardId) {
      await client.query(`
        UPDATE tenant_operation_stockyards
        SET received_tons = COALESCE(received_tons, 0) + $1
        WHERE operation_id = $2 AND stockyard_id = $3
      `, [finalReceivedNet, trip.operation_id, targetYardId]);

      // 4. Auto-Credit Stockyard Inventory Ledger (Creates official INWARD transaction)
      await client.query(`
        INSERT INTO tenant_stockyard_transactions (
          tenant_id, stockyard_id, project_id, project_name,
          material_name, unit, transaction_type, quantity,
          vehicle_number, driver_name, driver_phone,
          waybill_number, remarks, rack_id, rack_name, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'INWARD', $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
      `, [
        tenantId, targetYardId, trip.project_id, trip.project_name,
        trip.material_name, trip.unit_of_measure || 'MT', finalReceivedNet,
        trip.vehicle_number, trip.driver_name, trip.driver_phone,
        trip.waybill_number || `OP-${trip.trip_number}`,
        `Received via Operation #${trip.operation_id} (Unloaded via ${machineryName || 'Equipment'})`,
        targetPointId || null, targetPointName || null
      ]);
    }

    // 5. If heavy machinery was used, log utilization in tenant_stockyard_equipment_utilization
    if (machineryId && targetYardId) {
      try {
        await client.query(`
          INSERT INTO tenant_stockyard_equipment_utilization (
            tenant_id, stockyard_id, equipment_type, equipment_name,
            hours_run, fuel_consumed_liters, supervisor_name, work_done_description
          ) VALUES ($1, $2, 'Machinery', $3, $4, 0, $5, $6)
        `, [
          tenantId, targetYardId, machineryName || 'Unloading Equipment',
          parseFloat(machineryHoursUsed) || 1, receivedByName || 'Supervisor',
          `Unloading trip ${trip.trip_number} (${finalReceivedNet} MT ${trip.material_name})`
        ]);
      } catch (_) { }
    }

    await client.query('COMMIT');
    res.json({
      message: 'Consignment successfully received and inventory credited to stockyard',
      trip: updatedTrip.rows[0]
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[POST /trips/:tripId/receive] Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ====================================================================
// 6. POST SUBMIT CHANGE REQUEST (PROJECT MANAGER -> ADMIN/HR)
// ====================================================================
router.post('/api/tenant/operations/:id/change-requests', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = await resolveTenantId(req);
    const {
      requestedByUid, requestedByName, requestedByRole = 'Project Manager',
      changeType, summary, proposedChanges, currentValues
    } = req.body;

    if (!changeType || !summary || !proposedChanges) {
      return res.status(400).json({ error: 'Change Type, Summary, and Proposed Changes are required' });
    }

    const insertCR = await pool.query(`
      INSERT INTO tenant_operation_change_requests (
        tenant_id, operation_id, requested_by_uid, requested_by_name, requested_by_role,
        change_type, summary, proposed_changes, current_values, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
      RETURNING *
    `, [
      tenantId, id, requestedByUid || null, requestedByName || 'Project Manager', requestedByRole,
      changeType, summary, JSON.stringify(proposedChanges), JSON.stringify(currentValues || {}),
    ]);

    res.status(201).json({
      message: 'Change request submitted for Admin / HR approval',
      changeRequest: insertCR.rows[0]
    });
  } catch (err: any) {
    console.error('[POST change-requests] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 7. GET ALL APPROVALS / CHANGE REQUESTS (FOR ADMIN / HR INBOX)
// ====================================================================
router.get('/api/tenant/operations-approvals/all', async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    const { status = 'ALL' } = req.query as any;

    const params: any[] = [tenantId];
    let filter = '';
    if (status && status !== 'ALL') {
      params.push(status.toUpperCase());
      filter = ` AND cr.status = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT 
        cr.id,
        cr.operation_id as "operationId",
        o.name as "operationName",
        o.op_code as "opCode",
        o.project_name as "projectName",
        cr.requested_by_uid as "requestedByUid",
        cr.requested_by_name as "requestedByName",
        cr.requested_by_role as "requestedByRole",
        cr.change_type as "changeType",
        cr.summary,
        cr.proposed_changes as "proposedChanges",
        cr.current_values as "currentValues",
        cr.status,
        cr.reviewed_by_name as "reviewedByName",
        cr.reviewer_remarks as "reviewerRemarks",
        cr.reviewed_at as "reviewedAt",
        cr.created_at as "createdAt"
      FROM tenant_operation_change_requests cr
      JOIN tenant_operations o ON cr.operation_id = o.id
      WHERE cr.tenant_id = $1 ${filter}
      ORDER BY 
        CASE WHEN cr.status = 'PENDING' THEN 1 ELSE 2 END,
        cr.created_at DESC
    `, params);

    res.json(result.rows);
  } catch (err: any) {
    console.error('[GET operations-approvals] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 8. PUT APPROVE OR REJECT CHANGE REQUEST (ADMIN / HR ACTION)
// ====================================================================
router.put('/api/tenant/operations-approvals/:requestId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { requestId } = req.params;
    const tenantId = await resolveTenantId(req);
    const { action, reviewerUid, reviewerName, remarks } = req.body; // action: 'APPROVE' or 'REJECT'

    if (!action || !['APPROVE', 'REJECT'].includes(action.toUpperCase())) {
      return res.status(400).json({ error: 'Valid action (APPROVE or REJECT) is required' });
    }

    const crRes = await client.query(`
      SELECT * FROM tenant_operation_change_requests
      WHERE id = $1 AND tenant_id = $2
    `, [requestId, tenantId]);

    if (crRes.rows.length === 0) {
      return res.status(404).json({ error: 'Change request not found' });
    }
    const cr = crRes.rows[0];

    if (cr.status !== 'PENDING') {
      return res.status(400).json({ error: `Change request is already ${cr.status}` });
    }

    const isApprove = action.toUpperCase() === 'APPROVE';
    const newStatus = isApprove ? 'APPROVED' : 'REJECTED';

    await client.query('BEGIN');

    // 1. Update Change Request
    const updatedCR = await client.query(`
      UPDATE tenant_operation_change_requests
      SET status = $1,
          reviewed_by_uid = $2,
          reviewed_by_name = $3,
          reviewer_remarks = $4,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [newStatus, reviewerUid || null, reviewerName || 'Admin / Approver', remarks || '', requestId]);

    // 2. If Approved, apply proposed changes to the operation!
    if (isApprove && cr.proposed_changes) {
      const changes = typeof cr.proposed_changes === 'string' ? JSON.parse(cr.proposed_changes) : cr.proposed_changes;

      // Update operation master fields if present
      if (changes.name || changes.corridorName || changes.plannedQuantityTons || changes.overallSupervisorName) {
        await client.query(`
          UPDATE tenant_operations
          SET 
            name = COALESCE($1, name),
            corridor_name = COALESCE($2, corridor_name),
            planned_quantity_tons = COALESCE($3, planned_quantity_tons),
            overall_supervisor_name = COALESCE($4, overall_supervisor_name),
            overall_supervisor_uid = COALESCE($5, overall_supervisor_uid),
            overall_supervisor_phone = COALESCE($6, overall_supervisor_phone),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $7
        `, [
          changes.name || null,
          changes.corridorName || null,
          changes.plannedQuantityTons ? parseFloat(changes.plannedQuantityTons) : null,
          changes.overallSupervisorName || null,
          changes.overallSupervisorUid || null,
          changes.overallSupervisorPhone || null,
          cr.operation_id
        ]);
      }

      // Add new stockyard if proposed
      if (changes.newStockyard && changes.newStockyard.stockyardId) {
        const nsy = changes.newStockyard;
        await client.query(`
          INSERT INTO tenant_operation_stockyards (
            tenant_id, operation_id, stockyard_id, stockyard_name,
            supervisor_uid, supervisor_name, supervisor_phone,
            target_stock_point_id, target_stock_point_name,
            planned_allocation_tons, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Active')
        `, [
          tenantId, cr.operation_id, nsy.stockyardId, nsy.stockyardName || 'Stockyard',
          nsy.supervisorUid || null, nsy.supervisorName || null, nsy.supervisorPhone || null,
          nsy.targetStockPointId || null, nsy.targetStockPointName || null,
          parseFloat(nsy.plannedAllocationTons) || 0
        ]);
      }
    }

    await client.query('COMMIT');
    res.json({
      message: `Change request successfully ${newStatus.toLowerCase()}`,
      changeRequest: updatedCR.rows[0]
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[PUT operations-approvals] Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ====================================================================
// 9. GET AVAILABLE RESOURCES (DROPDOWN HELPER)
// ====================================================================
router.get('/api/tenant/operations-resources', async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);

    // 1. Projects
    const projectsRes = await pool.query(`
      SELECT id, name as "projectName", code as "projectCode", status
      FROM tenant_projects
      WHERE tenant_id = $1
      ORDER BY name ASC
    `, [tenantId]);

    // 2. Stockyards
    const stockyardsRes = await pool.query(`
      SELECT 
        y.id,
        y.yard_name as "yardName",
        y.yard_code as "yardCode",
        y.location,
        y.supervisor_name as "supervisorName",
        y.supervisor_phone as "supervisorPhone",
        y.weighbridge_installed as "weighbridgeInstalled"
      FROM tenant_stockyards y
      WHERE y.tenant_id = $1
      ORDER BY y.yard_name ASC
    `, [tenantId]);

    // 3. Stock points / Racks for each yard
    const stockPointsRes = await pool.query(`
      SELECT 
        id,
        stockyard_id as "stockyardId",
        rack_code as "rackCode",
        rack_name as "rackName",
        material_type as "materialType",
        current_tonnage as "currentTonnage"
      FROM tenant_stockyard_racks
      WHERE tenant_id = $1
      ORDER BY rack_name ASC
    `, [tenantId]);

    // 4. Corridors
    const corridorsRes = await pool.query(`
      SELECT id, corridor_code as "corridorCode", name, origin_summary as "originSummary", destination_summary as "destinationSummary"
      FROM tenant_operations_corridors
      WHERE tenant_id = $1
      ORDER BY name ASC
    `, [tenantId]);

    // 5. Company Vehicles (Trucks & Fleets)
    const vehiclesRes = await pool.query(`
      SELECT 
        v.id,
        v.registration_number as "registrationNumber",
        v.vehicle_type as "vehicleType",
        v.driver_name as "driverName",
        v.driver_phone as "driverPhone",
        v.capacity_tons as "capacityTons",
        v.status
      FROM tenant_vehicles v
      WHERE v.tenant_id = $1 AND LOWER(v.status) != 'inactive'
      ORDER BY v.registration_number ASC
    `, [tenantId]);

    // 6. Heavy Machinery (Excavators, Loaders, Cranes)
    let machinery: any[] = [];
    try {
      const machRes = await pool.query(`
        SELECT id, machine_name as "machineName", machine_code as "machineCode", category, assigned_operator_name as "operatorName"
        FROM tenant_fms_machinery
        WHERE tenant_id = $1
        ORDER BY machine_name ASC
      `, [tenantId]);
      machinery = machRes.rows;
    } catch (_) {
      try {
        const heRes = await pool.query(`
          SELECT id, equipment_number as "machineCode", equipment_type as "category", make || ' ' || model as "machineName", assigned_operator_name as "operatorName"
          FROM tenant_heavy_equipment
          WHERE tenant_id = $1
        `, [tenantId]);
        machinery = heRes.rows;
      } catch (_) { }
    }

    // 7. Supervisors / Team Members
    const supervisorsRes = await pool.query(`
      SELECT id, name, designation, department, mobile, email, firebase_uid as "firebaseUid"
      FROM tenant_users
      WHERE tenant_id = $1
      ORDER BY name ASC
    `, [tenantId]);

    res.json({
      projects: projectsRes.rows,
      stockyards: stockyardsRes.rows,
      stockPoints: stockPointsRes.rows,
      corridors: corridorsRes.rows,
      vehicles: vehiclesRes.rows,
      machinery,
      supervisors: supervisorsRes.rows
    });
  } catch (err: any) {
    console.error('[GET operations-resources] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
