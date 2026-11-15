import { Router } from 'express';
import { pool } from '../../config/db';

const router = Router();

// ─── PROJECTS ─────────────────────────────────────────────────────────────

// GET Projects
router.get(['/api/tenant/projects/:firebaseUid', '/api/tenant/projects'], async (req, res) => {
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

    const projectsRes = await pool.query(
      `SELECT id, project_id as "id", name, location, location_block as "locationBlock", 
              customer, commodity, contract_quantity as "contractQuantity", 
              contract_quantity_unit as "contractQuantityUnit", 
              contract_start_date as "contractStartDate", 
              contract_end_date as "contractEndDate", 
              other_data as "otherData", status, is_pinned as "is_pinned",
              custom_fields as "customFields"
       FROM tenant_projects WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    res.json(projectsRes.rows);
  } catch (err: any) {
    console.error(`[GET /api/tenant/projects] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Ensure tenant_project_transactions table ────────────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS tenant_project_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    project_id VARCHAR(100) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type VARCHAR(100) NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    party_name VARCHAR(255) DEFAULT '',
    entry_flow VARCHAR(20) NOT NULL DEFAULT 'debit',
    voucher_no VARCHAR(100) DEFAULT '',
    note TEXT DEFAULT '',
    status VARCHAR(50) DEFAULT 'Posted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_proj_tx_pid ON tenant_project_transactions(project_id);
`).then(() => console.log('Checked/Created tenant_project_transactions table'))
  .catch((e: any) => console.error('Error creating tenant_project_transactions:', e.message));

// GET Single Project Details (Comprehensive A-to-Z Project Dossier, Financials, Work Order, Team)
router.get(['/api/tenant/project/:id', '/api/tenant/projects/detail/:id'], async (req, res) => {
  const { id } = req.params;
  try {
    const projRes = await pool.query(
      `SELECT id, tenant_id as "tenantId", project_id as "id", project_id as "projectId", name, location, location_block as "locationBlock", 
              customer, commodity, contract_quantity as "contractQuantity", 
              contract_quantity_unit as "contractQuantityUnit", 
              contract_start_date as "contractStartDate", 
              contract_end_date as "contractEndDate", 
              other_data as "otherData", status, is_pinned as "is_pinned",
              custom_fields as "customFields", created_at as "createdAt"
       FROM tenant_projects 
       WHERE project_id = $1 OR id::text = $1
       LIMIT 1`,
      [id]
    );

    if (projRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const proj = projRes.rows[0];
    const pId = proj.projectId;
    const tId = proj.tenantId;

    // Parse otherData
    let parsedOtherData: any = {};
    try {
      if (typeof proj.otherData === 'string') {
        parsedOtherData = JSON.parse(proj.otherData);
      } else if (proj.otherData && typeof proj.otherData === 'object') {
        parsedOtherData = proj.otherData;
      }
    } catch (e) {
      parsedOtherData = {};
    }

    // 1. Fetch Linked Work Order
    let workOrder = null;
    const originWO = parsedOtherData.originWorkOrder;
    const originWOId = parsedOtherData.originWorkOrderId;

    const woRes = await pool.query(
      `SELECT id, order_number as "orderNumber", title, description, notes, 
              project_id as "projectId", worksite_name as "worksiteName", 
              assigned_staff_name as "assignedStaffName", division_name as "divisionName",
              priority, status, start_date as "startDate", due_date as "dueDate", 
              end_date as "endDate", estimated_cost as "estimatedCost", 
              actual_cost as "actualCost", client_name as "clientName", 
              client_code as "clientCode", project_location_address as "projectLocationAddress",
              commodity, contract_quantity as "contractQuantity", 
              contract_quantity_unit as "contractQuantityUnit", 
              loading_location as "loadingLocation",
              unloading_location as "unloadingLocation",
              transport_modes as "transportModes",
              is_loss_applicable as "isLossApplicable",
              allowed_loss_percent as "allowedLossPercent",
              rate_type as "rateType",
              rate_per_unit as "ratePerUnit",
              payment_terms as "paymentTerms",
              created_at as "createdAt"
       FROM tenant_work_orders 
       WHERE project_id = $1 
          OR ($2::text != '' AND order_number = $2)
          OR ($3::text IS NOT NULL AND id::text = $3::text)
       ORDER BY id DESC
       LIMIT 1`,
      [pId, originWO || '', originWOId || null]
    );
    if (woRes.rows.length > 0) {
      workOrder = woRes.rows[0];
    }

    // 2. Fetch All Unified Transactions
    let transactions: any[] = [];
    try {
      const txRes = await pool.query(`
        SELECT id::text, date::text, type, category, amount::numeric, party_name as "partyName", 
               entry_flow as "entryFlow", voucher_no as "voucherNo", note, status, 
               'Project Direct' as source, created_at as "createdAt"
        FROM tenant_project_transactions
        WHERE project_id = $1
        
        UNION ALL
        
        SELECT l.id::text, l.date::text, l.type, 'Client Billing' as category, l.amount::numeric, 
               COALESCE(c.name, 'Client') as "partyName", 'credit' as "entryFlow",
               l.voucher_no as "voucherNo", l.note, l.status, 'Client Ledger' as source,
               l.created_at as "createdAt"
        FROM tenant_client_ledger_entries l
        LEFT JOIN tenant_clients c ON c.id = l.client_id
        WHERE l.project_id = $1 OR l.project_tag = $1
        
        UNION ALL
        
        SELECT l.id::text, l.date::text, l.type, 'Vendor Bill' as category, l.amount::numeric, 
               COALESCE(v.name, 'Vendor') as "partyName", 'debit' as "entryFlow",
               l.voucher_no as "voucherNo", l.note, l.status, 'Vendor Ledger' as source,
               l.created_at as "createdAt"
        FROM tenant_vendor_ledger_entries l
        LEFT JOIN tenant_vendors v ON v.id = l.vendor_id
        WHERE l.project_id = $1 OR l.project_tag = $1

        UNION ALL

        SELECT id::text, date::text, type, COALESCE(category, 'Petty Cash') as category, amount::numeric, 
               COALESCE(custodian_id, 'Site Custodian') as "partyName", 'debit' as "entryFlow",
               voucher_no as "voucherNo", note, status, 'Petty Cash' as source,
               created_at as "createdAt"
        FROM tenant_petty_cash_entries
        WHERE project_tag = $1

        UNION ALL

        SELECT id::text, date::text, 'Expense' as type, category, amount::numeric, 
               person_name as "partyName", 'debit' as "entryFlow",
               '' as "voucherNo", bill as note, 'Approved' as status, 'Project Petty Cash' as source,
               created_at as "createdAt"
        FROM tenant_project_petty_cash_expenses
        WHERE project_id = $1

        ORDER BY "createdAt" DESC, date DESC
      `, [pId]);
      transactions = txRes.rows;
    } catch (txErr: any) {
      console.warn('Error fetching unified transactions:', txErr.message);
    }

    // 3. Compute Financial Summary & P&L
    const rawBudget = workOrder?.estimatedCost || parsedOtherData.estimatedCost || (proj.customFields && proj.customFields['Estimated Budget']) || 0;
    const estimatedBudget = parseFloat(String(rawBudget)) || 0;

    let totalRevenue = 0;
    let totalExpenses = 0;
    const categoryTotals: Record<string, number> = {};

    for (const tx of transactions) {
      const amt = parseFloat(String(tx.amount)) || 0;
      if (tx.entryFlow === 'credit') {
        totalRevenue += amt;
      } else {
        totalExpenses += amt;
        const cat = tx.category || 'General';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
      }
    }

    // Calculate Net Profit / Loss
    // If client revenue has been received/invoiced, P&L is Revenue - Expenses.
    // If revenue hasn't been billed yet, P&L is Budget - Expenses (remaining profit margin on budget).
    const netProfitLoss = totalRevenue > 0 ? (totalRevenue - totalExpenses) : (estimatedBudget - totalExpenses);
    const isNetProfit = netProfitLoss >= 0;
    const baseline = totalRevenue > 0 ? totalRevenue : (estimatedBudget > 0 ? estimatedBudget : 0);
    const profitMargin = baseline > 0 ? Math.round(((netProfitLoss / baseline) * 100) * 10) / 10 : 0;
    const budgetUtilization = estimatedBudget > 0 ? Math.round((totalExpenses / estimatedBudget) * 100) : 0;

    const expenseBreakdown = Object.entries(categoryTotals).map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      percentage: totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0
    }));

    // 4. Assigned Team Roster
    const projectHeadName = parsedOtherData.projectHeadName || (proj.customFields && proj.customFields['Assigned Project Lead']) || (workOrder && workOrder.assignedStaffName) || '';
    const projectHeadRole = parsedOtherData.projectHeadRole || (proj.customFields && proj.customFields['Staff Role']) || 'Project Head';
    const divisionName = parsedOtherData.division || (workOrder && workOrder.divisionName) || proj.locationBlock || '';

    let customTeam = [];
    if (proj.customFields && Array.isArray(proj.customFields.team)) {
      customTeam = proj.customFields.team;
    } else if (parsedOtherData && Array.isArray(parsedOtherData.team)) {
      customTeam = parsedOtherData.team;
    }

    // Also fetch available employees for this tenant
    let companyUsers: any[] = [];
    if (tId) {
      try {
        const uRes = await pool.query(
          `SELECT id, name, role, department, email, mobile, status, member_id as "memberId" 
           FROM tenant_users 
           WHERE tenant_id = $1 
           ORDER BY name ASC`,
          [tId]
        );
        companyUsers = uRes.rows;
      } catch (uErr: any) { }
    }

    // 5. Fetch Multi-Modal Operations Corridors for this Project
    let corridors: any[] = [];
    try {
      const corrRes = await pool.query(`
        SELECT 
          id,
          corridor_code as "corridorCode",
          name,
          topology_type as "topologyType",
          description,
          origin_summary as "originSummary",
          destination_summary as "destinationSummary",
          transshipment_hub as "transshipmentHub",
          total_distance_km as "totalDistanceKm",
          estimated_cycle_time_hours as "estimatedCycleTimeHours",
          status
        FROM tenant_operations_corridors
        WHERE project_id = $1 OR project_name ILIKE $2
        ORDER BY id DESC
      `, [pId, `%${proj.name}%`]);

      for (const c of corrRes.rows) {
        const legsRes = await pool.query(`
          SELECT 
            id, leg_sequence as "legSequence", leg_name as "legName",
            origin_name as "originName", origin_type as "originType",
            destination_name as "destinationName", destination_type as "destinationType",
            transport_mode as "transportMode", distance_km as "distanceKm",
            estimated_tat_hours as "estimatedTatHours", transshipment_required as "transshipmentRequired",
            lead_transporter as "leadTransporter"
          FROM tenant_corridor_legs
          WHERE corridor_id = $1
          ORDER BY leg_sequence ASC
        `, [c.id]);

        const assetsRes = await pool.query(`
          SELECT 
            id, leg_id as "legId", asset_type as "assetType", asset_id as "assetId",
            asset_number as "assetNumber", asset_title as "assetTitle",
            assigned_person_name as "assignedPersonName", assigned_person_phone as "assignedPersonPhone",
            assigned_person_role as "assignedPersonRole", shift, operating_status as "operatingStatus"
          FROM tenant_corridor_assets
          WHERE corridor_id = $1
        `, [c.id]);

        corridors.push({
          ...c,
          legs: legsRes.rows,
          assets: assetsRes.rows
        });
      }
    } catch (cErr: any) {
      console.warn('Error fetching project corridors:', cErr.message);
    }

    // 6. Fetch Assigned Vehicles & Heavy Equipment
    let assignedVehicles: any[] = [];
    let assignedEquipment: any[] = [];
    try {
      const vRes = await pool.query(`
        SELECT 
          id, vehicle_number as "vehicleNumber", vehicle_type as "vehicleType",
          make, model, ton_capacity as "tonCapacity",
          assigned_driver_name as "assignedDriverName", assigned_driver_phone as "assignedDriverPhone",
          fuel_power_type as "fuelPowerType", fuel_consumption as "fuelConsumption",
          current_location as "currentLocation", status
        FROM tenant_vehicles
        WHERE assigned_project_id = $1 OR assigned_project_name ILIKE $2
        ORDER BY id DESC
      `, [pId, `%${proj.name}%`]);
      assignedVehicles = vRes.rows;

      const eqRes = await pool.query(`
        SELECT 
          id, equipment_id as "equipmentId", equipment_number as "equipmentNumber",
          equipment_type as "equipmentType", make, model,
          excavator_bucket_capacity as "bucketCapacity", hour_meter_reading as "hourMeterReading",
          assigned_operator_name as "assignedOperatorName", assigned_operator_phone as "assignedOperatorPhone",
          fuel_power_type as "fuelPowerType", status
        FROM tenant_heavy_equipment
        WHERE assigned_project_id = $1 OR assigned_project_name ILIKE $2
        ORDER BY id DESC
      `, [pId, `%${proj.name}%`]);
      assignedEquipment = eqRes.rows;
    } catch (fErr: any) {
      console.warn('Error fetching project fleet:', fErr.message);
    }

    // 7. Fetch Project Fuel & Trip Logs from Fleet Daily Logs
    let fuelLogs: any[] = [];
    let fuelSummary = { totalLiters: 0, totalFuelCost: 0, totalKm: 0, totalTrips: 0 };
    try {
      const flRes = await pool.query(`
        SELECT 
          id, asset_number as "assetNumber", asset_type as "assetType",
          driver_name as "driverName", driver_phone as "driverPhone",
          TO_CHAR(log_date, 'YYYY-MM-DD') as "logDate", shift, stage,
          distance_run as "distanceRun", fuel_filled_liters as "fuelFilledLiters",
          fuel_total_cost as "fuelTotalCost", fuel_station as "fuelStation",
          trips_count as "tripsCount", remarks
        FROM tenant_fleet_daily_logs
        WHERE project_id = $1 OR project_name ILIKE $2
        ORDER BY log_date DESC LIMIT 50
      `, [pId, `%${proj.name}%`]);
      fuelLogs = flRes.rows;

      for (const fl of fuelLogs) {
        fuelSummary.totalLiters += parseFloat(fl.fuelFilledLiters || 0);
        fuelSummary.totalFuelCost += parseFloat(fl.fuelTotalCost || 0);
        fuelSummary.totalKm += parseFloat(fl.distanceRun || 0);
        fuelSummary.totalTrips += parseInt(fl.tripsCount || 0, 10);
      }
    } catch (flErr: any) {
      console.warn('Error fetching project fuel logs:', flErr.message);
    }

    // 8. Fetch Project Dispatch Waybills
    let dispatchPassports: any[] = [];
    try {
      const wbRes = await pool.query(`
        SELECT 
          id, waybill_number as "waybillNumber", corridor_name as "corridorName",
          origin_yard_name as "originYardName", destination_yard_name as "destinationYardName",
          material_name as "materialName", grade, net_weight as "netWeight",
          vehicle_number as "vehicleNumber", driver_name as "driverName", driver_phone as "driverPhone",
          status, dispatched_at as "dispatchedAt", delivered_at as "deliveredAt"
        FROM tenant_dispatch_waybills
        WHERE project_id = $1 OR project_name ILIKE $2
        ORDER BY dispatched_at DESC LIMIT 50
      `, [pId, `%${proj.name}%`]);
      dispatchPassports = wbRes.rows;
    } catch (wbErr: any) {
      console.warn('Error fetching project waybills:', wbErr.message);
    }

    // 9. Combined Crew Roster (Leadership, Supervisors, Drivers, Operators)
    const crewRoster: any[] = [];
    if (projectHeadName) {
      crewRoster.push({
        name: projectHeadName,
        role: projectHeadRole || 'Project Lead',
        category: 'Leadership',
        phone: '',
        email: ''
      });
    }
    // Add drivers from assigned vehicles
    for (const v of assignedVehicles) {
      if (v.assignedDriverName && !crewRoster.some(c => c.name === v.assignedDriverName)) {
        crewRoster.push({
          name: v.assignedDriverName,
          role: `Driver (${v.vehicleNumber})`,
          category: 'Fleet Crew',
          phone: v.assignedDriverPhone || '',
          email: ''
        });
      }
    }
    // Add operators from assigned equipment
    for (const eq of assignedEquipment) {
      if (eq.assignedOperatorName && !crewRoster.some(c => c.name === eq.assignedOperatorName)) {
        crewRoster.push({
          name: eq.assignedOperatorName,
          role: `Heavy Operator (${eq.equipmentNumber})`,
          category: 'Heavy Equipment Crew',
          phone: eq.assignedOperatorPhone || '',
          email: ''
        });
      }
    }

    // 8. Fetch Project Heavy Equipment Utilization History from Stockyards
    let equipmentUtilization: any[] = [];
    let equipmentUtilizationSummary = {
      totalHours: 0,
      totalOperations: 0,
      totalQuantity: 0,
      distinctEquipmentCount: 0
    };
    try {
      const utilRes = await pool.query(`
        SELECT 
          u.id,
          u.stockyard_id as "stockyardId",
          u.stockyard_name as "stockyardName",
          u.project_id as "projectId",
          u.project_name as "projectName",
          u.transaction_id as "transactionId",
          u.shift_id as "shiftId",
          u.equipment_id as "equipmentId",
          u.equipment_number as "equipmentNumber",
          u.equipment_name as "equipmentName",
          u.equipment_type as "equipmentType",
          u.operation_type as "operationType",
          u.material_name as "materialName",
          u.quantity,
          u.unit,
          u.source_rack_name as "sourceRackName",
          u.destination_rack_name as "destinationRackName",
          u.start_time as "startTime",
          u.end_time as "endTime",
          u.duration_hours as "durationHours",
          u.operator_name as "operatorName",
          u.operator_phone as "operatorPhone",
          u.status,
          u.remarks,
          u.recorded_by as "recordedBy",
          u.created_at as "createdAt"
        FROM tenant_stockyard_equipment_utilization u
        WHERE u.project_id = $1 OR u.project_name ILIKE $2
        ORDER BY u.start_time DESC
      `, [pId, `%${proj.name}%`]);
      equipmentUtilization = utilRes.rows;

      const distinctEq = new Set();
      for (const row of equipmentUtilization) {
        equipmentUtilizationSummary.totalHours += parseFloat(row.durationHours || 0);
        equipmentUtilizationSummary.totalOperations += 1;
        equipmentUtilizationSummary.totalQuantity += parseFloat(row.quantity || 0);
        if (row.equipmentId || row.equipmentNumber) {
          distinctEq.add(row.equipmentId || row.equipmentNumber);
        }
      }
      equipmentUtilizationSummary.distinctEquipmentCount = distinctEq.size;
      equipmentUtilizationSummary.totalHours = parseFloat(equipmentUtilizationSummary.totalHours.toFixed(2));
      equipmentUtilizationSummary.totalQuantity = parseFloat(equipmentUtilizationSummary.totalQuantity.toFixed(2));
    } catch (uErr: any) {
      console.warn('Error fetching project equipment utilization:', uErr.message);
    }

    res.json({
      ...proj,
      workOrder,
      financialSummary: {
        estimatedBudget,
        totalRevenue,
        totalExpenses,
        netProfitLoss,
        isNetProfit,
        profitMargin,
        budgetUtilization,
        expenseBreakdown
      },
      transactions,
      assignedHead: {
        name: projectHeadName,
        role: projectHeadRole,
        division: divisionName
      },
      teamMembers: customTeam,
      companyUsers,
      corridors,
      assignedVehicles,
      assignedEquipment,
      equipmentUtilization,
      equipmentUtilizationSummary,
      fuelLogs,
      fuelSummary,
      dispatchPassports,
      crewRoster
    });
  } catch (err: any) {
    console.error(`[GET /api/tenant/project/:id] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});
// POST Record Project Transaction
router.post('/api/tenant/project/:id/transactions', async (req, res) => {
  const { id } = req.params;
  const { date, type, category, amount, partyName, entryFlow, voucherNo, note, status } = req.body;
  try {
    const projRes = await pool.query('SELECT tenant_id, project_id FROM tenant_projects WHERE project_id = $1 OR id::text = $1', [id]);
    if (projRes.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const { tenant_id, project_id } = projRes.rows[0];

    const insertRes = await pool.query(`
      INSERT INTO tenant_project_transactions 
        (tenant_id, project_id, date, type, category, amount, party_name, entry_flow, voucher_no, note, status)
      VALUES 
        ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, $6, $7, $8, $9, $10, COALESCE($11, 'Posted'))
      RETURNING id::text, date::text, type, category, amount::numeric, party_name as "partyName", 
                entry_flow as "entryFlow", voucher_no as "voucherNo", note, status, 
                'Project Direct' as source, created_at as "createdAt"
    `, [tenant_id, project_id, date || new Date().toISOString().split('T')[0], type || 'General Expense', category || 'General', amount || 0, partyName || '', entryFlow || 'debit', voucherNo || '', note || '', status || 'Posted']);

    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    console.error(`[POST /api/tenant/project/:id/transactions] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Project Transaction
router.delete('/api/tenant/project/:id/transactions/:txId', async (req, res) => {
  const { id, txId } = req.params;
  try {
    const deleteRes = await pool.query('DELETE FROM tenant_project_transactions WHERE id::text = $1 AND (project_id = $2 OR tenant_id IN (SELECT tenant_id FROM tenant_projects WHERE project_id = $2 OR id::text = $2)) RETURNING *', [txId, id]);
    if (deleteRes.rows.length === 0) return res.status(404).json({ error: 'Transaction not found or non-deletable' });
    res.json({ message: 'Transaction removed successfully' });
  } catch (err: any) {
    console.error(`[DELETE /api/tenant/project/:id/transactions/:txId] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// POST Add Team Member to Project
router.post('/api/tenant/project/:id/team', async (req, res) => {
  const { id } = req.params;
  const { memberId, name, role, email, mobile } = req.body;
  try {
    const projRes = await pool.query('SELECT id, project_id, custom_fields FROM tenant_projects WHERE project_id = $1 OR id::text = $1', [id]);
    if (projRes.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const p = projRes.rows[0];
    const customFields = p.custom_fields || {};
    const team = Array.isArray(customFields.team) ? customFields.team : [];

    if (!team.some((m: any) => m.id === memberId)) {
      team.push({
        id: memberId || Date.now().toString(),
        name,
        role: role || 'Site Staff',
        email: email || '',
        mobile: mobile || '',
        assignedAt: new Date().toISOString()
      });
      customFields.team = team;
      await pool.query('UPDATE tenant_projects SET custom_fields = $1 WHERE id = $2', [JSON.stringify(customFields), p.id]);
    }
    res.json({ message: 'Team member assigned successfully', team });
  } catch (err: any) {
    console.error(`[POST /api/tenant/project/:id/team] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Team Member from Project
router.delete('/api/tenant/project/:id/team/:memberId', async (req, res) => {
  const { id, memberId } = req.params;
  try {
    const projRes = await pool.query('SELECT id, project_id, custom_fields FROM tenant_projects WHERE project_id = $1 OR id::text = $1', [id]);
    if (projRes.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const p = projRes.rows[0];
    const customFields = p.custom_fields || {};
    let team = Array.isArray(customFields.team) ? customFields.team : [];
    team = team.filter((m: any) => m.id !== memberId);
    customFields.team = team;
    await pool.query('UPDATE tenant_projects SET custom_fields = $1 WHERE id = $2', [JSON.stringify(customFields), p.id]);
    res.json({ message: 'Team member removed successfully', team });
  } catch (err: any) {
    console.error(`[DELETE /api/tenant/project/:id/team/:memberId] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// POST Project
router.post('/api/tenant/projects', async (req, res) => {
  const { adminUid, name, location, locationBlock, customer, commodity, contractQuantity, contractQuantityUnit, contractStartDate, contractEndDate, otherData, customFields } = req.body;
  try {
    const adminRes = await pool.query(
      `SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1
       UNION
       SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1`,
      [adminUid]
    );
    if (adminRes.rows.length === 0) return res.status(404).json({ error: 'Tenant identity not found' });
    const tenantId = adminRes.rows[0].tenant_id;

    // Fetch company name for prefix
    const tenantRes = await pool.query(`SELECT company_name FROM tenants WHERE id = $1`, [tenantId]);
    const companyName = tenantRes.rows[0]?.company_name || 'TNT';

    const companyPrefix = companyName.replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 3).padEnd(3, 'X');
    const finalName = name || 'Project';
    const projectPrefix = finalName.replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 3).padEnd(3, 'X');

    // Sequence Generator for project_id (e.g. USH-MET-0001)
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

    const actualName = name || `Project #${nextProjId}`;

    const insertRes = await pool.query(
      `INSERT INTO tenant_projects 
       (tenant_id, project_id, name, location, location_block, customer, commodity, contract_quantity, contract_quantity_unit, contract_start_date, contract_end_date, other_data, custom_fields) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *, project_id as "id", project_id as "projectId", custom_fields as "customFields"`,
      [tenantId, nextProjId, actualName, location || 'N/A', locationBlock, customer, commodity, contractQuantity, contractQuantityUnit, contractStartDate, contractEndDate, otherData, customFields ? JSON.stringify(customFields) : null]
    );

    // If otherData links to a work order, update tenant_work_orders to set project_id and project_name
    try {
      let parsedOD: any = {};
      if (typeof otherData === 'string') parsedOD = JSON.parse(otherData);
      else if (typeof otherData === 'object' && otherData) parsedOD = otherData;

      if (parsedOD.originWorkOrder || parsedOD.originWorkOrderId) {
        await pool.query(
          `UPDATE tenant_work_orders 
           SET project_id = $1, project_name = $2, updated_at = CURRENT_TIMESTAMP
           WHERE tenant_id = $3 AND (order_number = $4 OR id::text = $5)`,
          [nextProjId, actualName, tenantId, parsedOD.originWorkOrder || '', parsedOD.originWorkOrderId ? String(parsedOD.originWorkOrderId) : '']
        );
      }
    } catch (woLinkErr: any) {
      console.warn('Could not link work order to created project:', woLinkErr.message);
    }

    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    console.error(`[POST /api/tenant/projects] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH Pin/Unpin Project
router.patch('/api/tenant/projects/:id/pin', async (req, res) => {
  const { id } = req.params;
  const { isPinned } = req.body;
  try {
    const updateRes = await pool.query(
      'UPDATE tenant_projects SET is_pinned = $1 WHERE project_id = $2 RETURNING *, project_id as "id"',
      [isPinned, id]
    );
    if (updateRes.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error(`[PATCH /api/tenant/projects/pin] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH Update Project Details
router.patch('/api/tenant/projects/:id', async (req, res) => {
  const { id } = req.params;
  const { name, location, locationBlock, customer, commodity, contractQuantity, contractQuantityUnit, contractStartDate, contractEndDate, status, otherData, customFields } = req.body;
  try {
    const updateRes = await pool.query(
      `UPDATE tenant_projects
       SET name = COALESCE($1, name),
           location = COALESCE($2, location),
           location_block = COALESCE($3, location_block),
           customer = COALESCE($4, customer),
           commodity = COALESCE($5, commodity),
           contract_quantity = COALESCE($6, contract_quantity),
           contract_quantity_unit = COALESCE($7, contract_quantity_unit),
           contract_start_date = COALESCE($8, contract_start_date),
           contract_end_date = COALESCE($9, contract_end_date),
           status = COALESCE($10, status),
           other_data = COALESCE($11, other_data),
           custom_fields = COALESCE($12, custom_fields)
       WHERE project_id = $13 OR id::text = $13
       RETURNING id, project_id as "id", project_id as "projectId", name, location, location_block as "locationBlock", 
                 customer, commodity, contract_quantity as "contractQuantity", 
                 contract_quantity_unit as "contractQuantityUnit", 
                 contract_start_date as "contractStartDate", 
                 contract_end_date as "contractEndDate", 
                 other_data as "otherData", status, is_pinned as "is_pinned",
                 custom_fields as "customFields"`,
      [name, location, locationBlock, customer, commodity, contractQuantity, contractQuantityUnit, contractStartDate, contractEndDate, status, otherData, customFields ? JSON.stringify(customFields) : null, id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error(`[PATCH /api/tenant/projects/:id] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Project
router.delete('/api/tenant/projects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleteRes = await pool.query('DELETE FROM tenant_projects WHERE project_id = $1 OR id::text = $1 RETURNING *', [id]);
    if (deleteRes.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project deleted successfully' });
  } catch (err: any) {
    console.error(`[DELETE /api/tenant/projects] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
