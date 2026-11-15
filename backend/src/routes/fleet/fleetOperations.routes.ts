import { Router } from 'express';
import { pool } from '../../config/db';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// FLEET DAILY LOGS, FUEL TELEMETRY & RUNNING LOGS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET Fleet Operational Stats (Rollup by project and overall fleet KPI)
router.get('/api/tenant/fleet-logs/stats', async (req, res) => {
  try {
    const statsRes = await pool.query(`
      SELECT 
        COUNT(DISTINCT asset_number) AS "activeAssetsCount",
        COALESCE(SUM(distance_run), 0) AS "totalKmRun",
        COALESCE(SUM(fuel_filled_liters), 0) AS "totalFuelLiters",
        COALESCE(SUM(fuel_total_cost), 0) AS "totalFuelCost",
        COALESCE(SUM(toll_amount + fastag_deduction), 0) AS "totalTollExpenses",
        COALESCE(SUM(trips_count), 0) AS "totalTripsCount",
        CASE 
          WHEN SUM(fuel_filled_liters) > 0 THEN ROUND(SUM(distance_run) / SUM(fuel_filled_liters), 2)
          ELSE 0 
        END AS "avgMileageKmPerLiter"
      FROM tenant_fleet_daily_logs
    `);

    // Project breakdown
    const projRes = await pool.query(`
      SELECT 
        COALESCE(project_name, 'Unassigned Project') AS "projectName",
        COUNT(*) AS "logsCount",
        COALESCE(SUM(distance_run), 0) AS "totalKm",
        COALESCE(SUM(fuel_filled_liters), 0) AS "totalFuelLiters",
        COALESCE(SUM(fuel_total_cost), 0) AS "totalFuelCost",
        COALESCE(SUM(toll_amount + fastag_deduction), 0) AS "totalToll"
      FROM tenant_fleet_daily_logs
      GROUP BY project_name
      ORDER BY "totalKm" DESC
    `);

    res.json({
      summary: statsRes.rows[0],
      projectRollup: projRes.rows
    });
  } catch (err: any) {
    console.error('[GET /api/tenant/fleet-logs/stats] Error:', err);
    res.status(500).json({ error: err.message });
  }
});


// GET Fleet Daily Logs
router.get(['/api/tenant/fleet-logs/:firebaseUid', '/api/tenant/fleet-logs'], async (req, res) => {
  try {
    const { projectId, assetNumber, stage, dateFrom, dateTo } = req.query;
    let query = `
      SELECT 
        id,
        tenant_id AS "tenantId",
        asset_id AS "assetId",
        asset_type AS "assetType",
        asset_number AS "assetNumber",
        asset_title AS "assetTitle",
        assignment_id AS "assignmentId",
        project_id AS "projectId",
        project_name AS "projectName",
        worksite_id AS "worksiteId",
        worksite_name AS "worksiteName",
        driver_id AS "driverId",
        driver_name AS "driverName",
        driver_phone AS "driverPhone",
        helper_id AS "helperId",
        helper_name AS "helperName",
        helper_role AS "helperRole",
        helper_phone AS "helperPhone",
        TO_CHAR(log_date, 'YYYY-MM-DD') AS "logDate",
        shift,
        stage,
        start_odometer AS "startOdometer",
        end_odometer AS "endOdometer",
        distance_run AS "distanceRun",
        engine_hours_start AS "engineHoursStart",
        engine_hours_end AS "engineHoursEnd",
        engine_hours_total AS "engineHoursTotal",
        fuel_filled_liters AS "fuelFilledLiters",
        fuel_rate_per_liter AS "fuelRatePerLiter",
        fuel_total_cost AS "fuelTotalCost",
        fuel_station AS "fuelStation",
        fuel_bill_number AS "fuelBillNumber",
        fuel_efficiency AS "fuelEfficiency",
        toll_amount AS "tollAmount",
        fastag_deduction AS "fastagDeduction",
        other_expenses AS "otherExpenses",
        trips_count AS "tripsCount",
        remarks,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM tenant_fleet_daily_logs
      WHERE 1=1
    `;
    const params: any[] = [];
    let pIdx = 1;

    if (projectId && projectId !== 'All') {
      query += ` AND project_name = ${pIdx++}`;
      params.push(projectId);
    }
    if (assetNumber && assetNumber !== 'All') {
      query += ` AND asset_number = ${pIdx++}`;
      params.push(assetNumber);
    }
    if (stage && stage !== 'All') {
      query += ` AND stage = ${pIdx++}`;
      params.push(stage);
    }
    if (dateFrom) {
      query += ` AND log_date >= ${pIdx++}`;
      params.push(dateFrom);
    }
    if (dateTo) {
      query += ` AND log_date <= ${pIdx++}`;
      params.push(dateTo);
    }

    query += ` ORDER BY log_date DESC, id DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('[GET /api/tenant/fleet-logs] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Create Fleet Daily Log
router.post('/api/tenant/fleet-logs', async (req, res) => {
  try {
    const b = req.body;
    const startOdo = parseFloat(b.startOdometer) || 0;
    const endOdo = parseFloat(b.endOdometer) || 0;
    const distRun = b.distanceRun !== undefined ? parseFloat(b.distanceRun) : Math.max(0, endOdo - startOdo);
    const engHoursStart = parseFloat(b.engineHoursStart) || 0;
    const engHoursEnd = parseFloat(b.engineHoursEnd) || 0;
    const engHoursTotal = b.engineHoursTotal !== undefined ? parseFloat(b.engineHoursTotal) : Math.max(0, engHoursEnd - engHoursStart);
    const fuelLiters = parseFloat(b.fuelFilledLiters) || 0;
    const fuelRate = parseFloat(b.fuelRatePerLiter) || 0;
    const fuelCost = b.fuelTotalCost !== undefined ? parseFloat(b.fuelTotalCost) : (fuelLiters * fuelRate);

    let efficiency = 0;
    if (b.fuelEfficiency !== undefined && parseFloat(b.fuelEfficiency) > 0) {
      efficiency = parseFloat(b.fuelEfficiency);
    } else if (b.assetType === 'equipment') {
      efficiency = fuelLiters > 0 && engHoursTotal > 0 ? parseFloat((fuelLiters / engHoursTotal).toFixed(2)) : 0;
    } else {
      efficiency = fuelLiters > 0 && distRun > 0 ? parseFloat((distRun / fuelLiters).toFixed(2)) : 0;
    }

    const insRes = await pool.query(`
      INSERT INTO tenant_fleet_daily_logs (
        tenant_id, asset_id, asset_type, asset_number, asset_title, assignment_id,
        project_id, project_name, worksite_id, worksite_name,
        driver_id, driver_name, driver_phone,
        helper_id, helper_name, helper_role, helper_phone,
        log_date, shift, stage,
        start_odometer, end_odometer, distance_run,
        engine_hours_start, engine_hours_end, engine_hours_total,
        fuel_filled_liters, fuel_rate_per_liter, fuel_total_cost,
        fuel_station, fuel_bill_number, fuel_efficiency,
        toll_amount, fastag_deduction, other_expenses,
        trips_count, remarks
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20,
        $21, $22, $23,
        $24, $25, $26,
        $27, $28, $29,
        $30, $31, $32,
        $33, $34, $35,
        $36, $37
      ) RETURNING *;
    `, [
      b.tenantId || 'demo-tenant', b.assetId || null, b.assetType || 'vehicle', b.assetNumber, b.assetTitle || null, b.assignmentId || null,
      b.projectId || null, b.projectName || null, b.worksiteId || null, b.worksiteName || null,
      b.driverId || null, b.driverName || null, b.driverPhone || null,
      b.helperId || null, b.helperName || null, b.helperRole || null, b.helperPhone || null,
      b.logDate || new Date().toISOString().split('T')[0], b.shift || 'Day', b.stage || 'Working',
      startOdo, endOdo, distRun,
      engHoursStart, engHoursEnd, engHoursTotal,
      fuelLiters, fuelRate, fuelCost,
      b.fuelStation || null, b.fuelBillNumber || null, efficiency,
      parseFloat(b.tollAmount) || 0, parseFloat(b.fastagDeduction) || 0, parseFloat(b.otherExpenses) || 0,
      parseInt(b.tripsCount, 10) || 1, b.remarks || null
    ]);

    // Also update assignment status/odometer if assignmentId is present
    if (b.assignmentId && (endOdo > 0 || engHoursEnd > 0)) {
      const closingVal = b.assetType === 'equipment' && engHoursEnd > 0 ? engHoursEnd : endOdo;
      const progressVal = b.assetType === 'equipment' && engHoursTotal > 0 ? engHoursTotal : distRun;
      await pool.query(`
        UPDATE tenant_vehicle_assignments
        SET odometer_closing_km = $1, distance_travelled = COALESCE(distance_travelled, 0) + $2, updated_at = NOW()
        WHERE id = $3;
      `, [closingVal, progressVal, b.assignmentId]);
    }

    if (b.assetType === 'equipment' && engHoursEnd > 0) {
      try {
        await pool.query(`
          UPDATE tenant_heavy_equipment
          SET hour_meter_reading = $1, updated_at = NOW()
          WHERE equipment_number = $2 OR id::text = $3;
        `, [engHoursEnd, b.assetNumber, String(b.assetId || '')]);
      } catch (e: any) { }
    } else if (b.assetType === 'vehicle' && b.worksiteName) {
      try {
        await pool.query(`
          UPDATE tenant_vehicles
          SET current_location = $1, updated_at = NOW()
          WHERE vehicle_number = $2 OR id::text = $3;
        `, [b.worksiteName, b.assetNumber, String(b.assetId || '')]);
      } catch (e: any) { }
    }

    res.status(201).json(insRes.rows[0]);
  } catch (err: any) {
    console.error('[POST /api/tenant/fleet-logs] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Fleet Daily Log
router.delete('/api/tenant/fleet-logs/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const delRes = await pool.query('DELETE FROM tenant_fleet_daily_logs WHERE id = $1 RETURNING *', [id]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }
    res.json({ message: 'Fleet log deleted', log: delRes.rows[0] });
  } catch (err: any) {
    console.error('[DELETE /api/tenant/fleet-logs/:id] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Driver Context & My Assigned Vehicles for FMS Employee Portal
router.get(['/api/tenant/fms-employee/driver-portal/:firebaseUid', '/api/tenant/fms-employee/driver-portal'], async (req, res) => {
  const firebaseUid = req.params.firebaseUid || req.query.firebaseUid || req.query.uid;
  const { driverPhone, driverName } = req.query;
  try {
    let tenantId = null;
    let employeeProfile: any = null;

    if (firebaseUid) {
      const adminRes = await pool.query('SELECT tenant_id, admin_name, mobile, email, designation FROM tenant_admins WHERE firebase_uid = $1', [firebaseUid]);
      if (adminRes.rows.length > 0) {
        tenantId = adminRes.rows[0].tenant_id;
        employeeProfile = {
          name: adminRes.rows[0].admin_name,
          mobile: adminRes.rows[0].mobile,
          email: adminRes.rows[0].email,
          role: adminRes.rows[0].designation || 'Admin',
          department: 'Management',
          isAdmin: true
        };
      } else {
        const userRes = await pool.query('SELECT tenant_id, name, mobile, email, role, department, member_id FROM tenant_users WHERE firebase_uid = $1', [firebaseUid]);
        if (userRes.rows.length > 0) {
          tenantId = userRes.rows[0].tenant_id;
          employeeProfile = {
            name: userRes.rows[0].name,
            mobile: userRes.rows[0].mobile,
            email: userRes.rows[0].email,
            role: userRes.rows[0].role,
            department: userRes.rows[0].department,
            memberId: userRes.rows[0].member_id,
            isAdmin: false
          };
        }
      }
    }

    if (!tenantId) {
      const firstTenant = await pool.query('SELECT tenant_id FROM tenant_admins ORDER BY id ASC LIMIT 1');
      if (firstTenant.rows.length > 0) tenantId = firstTenant.rows[0].tenant_id;
    }
    if (!tenantId) tenantId = '1';

    // Fetch all drivers/operators in this tenant (for switcher or matching)
    const driversListRes = await pool.query(`
      SELECT id, name, mobile, role, department, member_id as "memberId"
      FROM tenant_users
      WHERE tenant_id = $1
        AND (
          LOWER(department) LIKE '%fms%' OR 
          LOWER(department) LIKE '%fleet%' OR 
          LOWER(department) LIKE '%operat%' OR 
          LOWER(role) LIKE '%driver%' OR 
          LOWER(role) LIKE '%operator%' OR 
          LOWER(role) LIKE '%pilot%'
        )
      ORDER BY name ASC
    `, [tenantId]);

    let driversList = driversListRes.rows;
    if (driversList.length === 0) {
      const allUsersRes = await pool.query(`
        SELECT id, name, mobile, role, department, member_id as "memberId"
        FROM tenant_users
        WHERE tenant_id = $1 AND COALESCE(status, 'Active') != 'Deactivated'
        ORDER BY name ASC
      `, [tenantId]);
      driversList = allUsersRes.rows;
    }

    // Target phone/name: If user is Admin and didn't specify a driver filter, show all tenant assignments
    let targetPhone = driverPhone ? String(driverPhone) : '';
    let targetName = driverName ? String(driverName) : '';
    if (!targetPhone && !targetName && !employeeProfile?.isAdmin) {
      targetPhone = employeeProfile?.mobile || '';
      targetName = employeeProfile?.name || '';
    }
    const cleanPhone = String(targetPhone).replace(/^\+?91/, '').replace(/\D/g, '');

    let assignmentQuery = `
      SELECT 
        a.id,
        a.tenant_id as "tenantId",
        a.asset_type as "assetType",
        a.asset_id as "assetId",
        a.asset_number as "assetNumber",
        a.asset_title as "assetTitle",
        a.project_id as "projectId",
        a.project_name as "projectName",
        a.worksite_id as "worksiteId",
        a.worksite_name as "worksiteName",
        a.assigned_to_type as "assignedToType",
        a.assigned_to_name as "assignedToName",
        a.assigned_to_phone as "assignedToPhone",
        a.helper_name as "helperName",
        a.helper_phone as "helperPhone",
        a.helper_role as "helperRole",
        a.start_date as "startDate",
        a.meter_reading_at_assign as "meterReadingAtAssign",
        a.odometer_closing_km as "odometerClosingKm",
        a.distance_travelled as "distanceTravelled",
        a.status,
        a.notes,
        COALESCE(v.fuel_power_type, eq.fuel_power_type, 'Diesel') as "fuelPowerType",
        COALESCE(v.fuel_consumption, eq.fuel_consumption, '') as "fuelConsumptionBenchmark",
        COALESCE(v.vehicle_type, eq.equipment_type, '') as "categoryType",
        COALESCE(v.current_location, eq.assigned_worksite_name, a.worksite_name, '') as "currentLocation"
      FROM tenant_vehicle_assignments a
      LEFT JOIN tenant_vehicles v ON a.asset_type = 'vehicle' AND (a.asset_id = v.id::text OR a.asset_number = v.vehicle_number)
      LEFT JOIN tenant_heavy_equipment eq ON a.asset_type = 'equipment' AND (a.asset_id = eq.id::text OR a.asset_number = eq.equipment_number)
      WHERE a.tenant_id = $1
    `;
    const assignParams: any[] = [tenantId];

    if (cleanPhone || targetName) {
      assignParams.push(`%${cleanPhone || targetName}%`);
      assignmentQuery += ` AND (
        REGEXP_REPLACE(COALESCE(a.assigned_to_phone, ''), '\\D', '', 'g') LIKE $${assignParams.length} OR 
        a.assigned_to_phone LIKE $${assignParams.length} OR 
        LOWER(a.assigned_to_name) LIKE LOWER($${assignParams.length}) OR 
        REGEXP_REPLACE(COALESCE(a.helper_phone, ''), '\\D', '', 'g') LIKE $${assignParams.length} OR 
        a.helper_phone LIKE $${assignParams.length} OR 
        LOWER(a.helper_name) LIKE LOWER($${assignParams.length})
      )`;
    }

    assignmentQuery += ` ORDER BY a.status ASC, a.id DESC`;
    const assignmentsRes = await pool.query(assignmentQuery, assignParams);

    const assignmentsMap = new Map();
    for (const row of assignmentsRes.rows) {
      assignmentsMap.set(row.assetNumber, row);
    }

    try {
      const directVehicles = await pool.query(`
        SELECT 
          id, tenant_id as "tenantId", 'vehicle' as "assetType", id::text as "assetId",
          vehicle_number as "assetNumber", COALESCE(make || ' ' || model, vehicle_type, 'Truck') as "assetTitle",
          assigned_project_id as "projectId", assigned_project_name as "projectName",
          current_location as "worksiteName", 'driver' as "assignedToType",
          COALESCE(assigned_driver_name, 'Unassigned') as "assignedToName", 
          assigned_driver_phone as "assignedToPhone",
          fuel_power_type as "fuelPowerType", fuel_consumption as "fuelConsumptionBenchmark", vehicle_type as "categoryType",
          current_location as "currentLocation",
          COALESCE(status, 'Active') as status
        FROM tenant_vehicles
        WHERE tenant_id = $1
      `, [tenantId]);

      for (const v of directVehicles.rows) {
        const vPhoneClean = String(v.assignedToPhone || '').replace(/\D/g, '');
        const match = !cleanPhone && !targetName ? true : (
          (cleanPhone && vPhoneClean.includes(cleanPhone)) ||
          (targetName && v.assignedToName && v.assignedToName.toLowerCase().includes(String(targetName).toLowerCase()))
        );
        if (match && !assignmentsMap.has(v.assetNumber)) {
          assignmentsMap.set(v.assetNumber, v);
        }
      }
    } catch (e: any) { }

    try {
      const directEquipment = await pool.query(`
        SELECT 
          id, tenant_id as "tenantId", 'equipment' as "assetType", id::text as "assetId",
          equipment_number as "assetNumber", COALESCE(equipment_type || ' ' || equipment_id, 'Heavy Equipment') as "assetTitle",
          assigned_project_id as "projectId", assigned_project_name as "projectName",
          assigned_worksite_name as "worksiteName", 'operator' as "assignedToType",
          COALESCE(assigned_operator_name, 'Unassigned') as "assignedToName", 
          assigned_operator_phone as "assignedToPhone",
          hour_meter_reading as "meterReadingAtAssign",
          fuel_power_type as "fuelPowerType", fuel_consumption as "fuelConsumptionBenchmark", equipment_type as "categoryType",
          assigned_worksite_name as "currentLocation",
          COALESCE(status, 'Active') as status
        FROM tenant_heavy_equipment
        WHERE tenant_id = $1
      `, [tenantId]);

      for (const eq of directEquipment.rows) {
        const eqPhoneClean = String(eq.assignedToPhone || '').replace(/\D/g, '');
        const match = !cleanPhone && !targetName ? true : (
          (cleanPhone && eqPhoneClean.includes(cleanPhone)) ||
          (targetName && eq.assignedToName && eq.assignedToName.toLowerCase().includes(String(targetName).toLowerCase()))
        );
        if (match && !assignmentsMap.has(eq.assetNumber)) {
          assignmentsMap.set(eq.assetNumber, eq);
        }
      }
    } catch (e: any) { }
    const finalAssignments = Array.from(assignmentsMap.values());
    // Fetch shift logs for this driver
    let logsQuery = `
      SELECT 
        id, asset_number as "assetNumber", asset_title as "assetTitle", asset_type as "assetType",
        assignment_id as "assignmentId", project_name as "projectName", worksite_name as "worksiteName",
        driver_name as "driverName", driver_phone as "driverPhone",
        log_date as "logDate", shift, stage,
        start_odometer as "startOdometer", end_odometer as "endOdometer", distance_run as "distanceRun",
        engine_hours_start as "engineHoursStart", engine_hours_end as "engineHoursEnd", engine_hours_total as "engineHoursTotal",
        fuel_filled_liters as "fuelFilledLiters", fuel_rate_per_liter as "fuelRatePerLiter", fuel_total_cost as "fuelTotalCost",
        fuel_station as "fuelStation", fuel_bill_number as "fuelBillNumber", fuel_efficiency as "fuelEfficiency",
        toll_amount as "tollAmount", fastag_deduction as "fastagDeduction", other_expenses as "otherExpenses",
        trips_count as "tripsCount", remarks, created_at as "createdAt"
      FROM tenant_fleet_daily_logs
      WHERE tenant_id = $1
    `;
    const logsParams: any[] = [tenantId];
    if (cleanPhone || targetName) {
      logsParams.push(`%${cleanPhone || targetName}%`);
      logsQuery += ` AND (
        REGEXP_REPLACE(COALESCE(driver_phone, ''), '\\D', '', 'g') LIKE $${logsParams.length} OR 
        driver_phone LIKE $${logsParams.length} OR 
        LOWER(driver_name) LIKE LOWER($${logsParams.length})
      )`;
    }
    logsQuery += ` ORDER BY log_date DESC, id DESC LIMIT 50`;
    const logsRes = await pool.query(logsQuery, logsParams);
    res.json({
      profile: employeeProfile,
      driversList: driversList,
      myAssignments: finalAssignments,
      myLogs: logsRes.rows
    });
  } catch (err: any) {
    console.error('[GET /api/tenant/fms-employee/driver-portal] Error:', err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
