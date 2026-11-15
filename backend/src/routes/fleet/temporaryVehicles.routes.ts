import { Router } from 'express';
import { pool } from '../../config/db';

const router = Router();

// ====================================================================
// 🚜 TEMPORARY / HIRED VEHICLES & RUNNING TIME ENDPOINTS
// ====================================================================

// GET All Temporary Vehicles with running time summaries & calculation tiles
router.get('/api/tenant/temporary-vehicles', async (req, res) => {
  try {
    const { projectId, status, search } = req.query as any;
    let query = `
      SELECT 
        tv.id,
        tv.tenant_id as "tenantId",
        tv.vehicle_number as "vehicleNumber",
        tv.vehicle_type as "vehicleType",
        tv.vendor_name as "vendorName",
        tv.vendor_phone as "vendorPhone",
        tv.project_id as "projectId",
        tv.project_name as "projectName",
        tv.worksite_id as "worksiteId",
        tv.worksite_name as "worksiteName",
        tv.driver_name as "driverName",
        tv.driver_phone as "driverPhone",
        tv.rate_type as "rateType",
        tv.agreed_rate as "agreedRate",
        tv.standby_rate as "standbyRate",
        tv.start_date as "startDate",
        tv.end_date as "endDate",
        tv.status,
        tv.remarks,
        tv.created_at as "createdAt",
        COALESCE(SUM(l.running_minutes), 0)::integer as "totalRunningMinutes",
        COALESCE(SUM(l.idle_minutes), 0)::integer as "totalIdleMinutes",
        COALESCE(SUM(l.calculated_cost), 0)::numeric as "totalCalculatedCost",
        COUNT(l.id)::integer as "logsCount",
        MAX(l.log_date) as "lastLogDate"
      FROM tenant_temporary_vehicles tv
      LEFT JOIN tenant_temporary_vehicle_logs l ON tv.id = l.temporary_vehicle_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (projectId && projectId !== 'ALL') {
      params.push(projectId);
      query += ` AND tv.project_id = $${params.length}`;
    }
    if (status && status !== 'ALL') {
      params.push(status);
      query += ` AND tv.status = $${params.length}`;
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (tv.vehicle_number ILIKE $${params.length} OR tv.vendor_name ILIKE $${params.length} OR tv.driver_name ILIKE $${params.length} OR tv.project_name ILIKE $${params.length})`;
    }

    query += `
      GROUP BY tv.id
      ORDER BY tv.created_at DESC
    `;

    const result = await pool.query(query, params);
    const vehicles = result.rows;

    let totalRunningMins = 0;
    let totalIdleMins = 0;
    let totalCost = 0;
    let activeCount = 0;
    let standbyCount = 0;
    let releasedCount = 0;

    const projectRollupMap: Record<string, { projectName: string; vehicleCount: number; runningMinutes: number; totalCost: number }> = {};

    vehicles.forEach((v: any) => {
      const rMins = parseInt(v.totalRunningMinutes, 10) || 0;
      const iMins = parseInt(v.totalIdleMinutes, 10) || 0;
      const cost = parseFloat(v.totalCalculatedCost) || 0;

      totalRunningMins += rMins;
      totalIdleMins += iMins;
      totalCost += cost;

      if (v.status === 'Active') activeCount++;
      else if (v.status === 'Standby') standbyCount++;
      else if (v.status === 'Released') releasedCount++;

      const pKey = v.projectId || 'Unassigned';
      if (!projectRollupMap[pKey]) {
        projectRollupMap[pKey] = {
          projectName: v.projectName || 'Unassigned Project',
          vehicleCount: 0,
          runningMinutes: 0,
          totalCost: 0
        };
      }
      projectRollupMap[pKey].vehicleCount++;
      projectRollupMap[pKey].runningMinutes += rMins;
      projectRollupMap[pKey].totalCost += cost;
    });

    const formatHoursMinutes = (totalMinutes: number) => {
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${hrs}h ${mins > 0 ? mins + 'm' : '00m'}`;
    };

    res.json({
      summary: {
        totalVehicles: vehicles.length,
        activeVehicles: activeCount,
        standbyVehicles: standbyCount,
        releasedVehicles: releasedCount,
        totalRunningHours: Number((totalRunningMins / 60).toFixed(1)),
        totalRunningHoursFormatted: formatHoursMinutes(totalRunningMins),
        totalIdleHours: Number((totalIdleMins / 60).toFixed(1)),
        totalIdleHoursFormatted: formatHoursMinutes(totalIdleMins),
        totalCost: Number(totalCost.toFixed(2)),
        projectRollup: Object.values(projectRollupMap).map(p => ({
          ...p,
          runningHours: Number((p.runningMinutes / 60).toFixed(1)),
          runningHoursFormatted: formatHoursMinutes(p.runningMinutes)
        }))
      },
      vehicles
    });
  } catch (err: any) {
    console.error('[GET /api/tenant/temporary-vehicles] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Create Temporary Vehicle
router.post('/api/tenant/temporary-vehicles', async (req, res) => {
  try {
    const {
      vehicleNumber,
      vehicleType,
      vendorName,
      vendorPhone,
      projectId,
      projectName,
      worksiteId,
      worksiteName,
      driverName,
      driverPhone,
      rateType,
      agreedRate,
      standbyRate,
      startDate,
      endDate,
      status,
      remarks
    } = req.body;

    if (!vehicleNumber || !vehicleType || !vendorName || !projectId) {
      return res.status(400).json({ error: 'Vehicle number, type, vendor name, and project are required' });
    }

    const insRes = await pool.query(`
      INSERT INTO tenant_temporary_vehicles (
        tenant_id, vehicle_number, vehicle_type, vendor_name, vendor_phone,
        project_id, project_name, worksite_id, worksite_name,
        driver_name, driver_phone, rate_type, agreed_rate, standby_rate,
        start_date, end_date, status, remarks
      ) VALUES (
        '1', $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17
      ) RETURNING *,
        id,
        tenant_id as "tenantId",
        vehicle_number as "vehicleNumber",
        vehicle_type as "vehicleType",
        vendor_name as "vendorName",
        vendor_phone as "vendorPhone",
        project_id as "projectId",
        project_name as "projectName",
        worksite_id as "worksiteId",
        worksite_name as "worksiteName",
        driver_name as "driverName",
        driver_phone as "driverPhone",
        rate_type as "rateType",
        agreed_rate as "agreedRate",
        standby_rate as "standbyRate",
        start_date as "startDate",
        end_date as "endDate",
        status, remarks, created_at as "createdAt"
    `, [
      vehicleNumber.trim().toUpperCase(),
      vehicleType.trim(),
      vendorName.trim(),
      vendorPhone || null,
      projectId,
      projectName || 'Project',
      worksiteId || null,
      worksiteName || null,
      driverName || null,
      driverPhone || null,
      rateType || 'hourly',
      parseFloat(agreedRate) || 0,
      parseFloat(standbyRate) || 0,
      startDate || new Date().toISOString().split('T')[0],
      endDate || null,
      status || 'Active',
      remarks || null
    ]);

    res.status(201).json(insRes.rows[0]);
  } catch (err: any) {
    console.error('[POST /api/tenant/temporary-vehicles] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH Update Temporary Vehicle Status
router.patch('/api/tenant/temporary-vehicles/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const updRes = await pool.query(`
      UPDATE tenant_temporary_vehicles
      SET status = COALESCE($1, status),
          remarks = COALESCE($2, remarks),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [status, remarks, id]);
    if (updRes.rows.length === 0) {
      return res.status(404).json({ error: 'Temporary vehicle not found' });
    }
    res.json(updRes.rows[0]);
  } catch (err: any) {
    console.error('[PATCH /api/tenant/temporary-vehicles/:id/status] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Running Time Logs for a Temporary Vehicle
router.get('/api/tenant/temporary-vehicles/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const logsRes = await pool.query(`
      SELECT 
        l.id,
        l.temporary_vehicle_id as "temporaryVehicleId",
        l.project_id as "projectId",
        l.project_name as "projectName",
        l.log_date as "logDate",
        l.shift,
        l.start_time as "startTime",
        l.end_time as "endTime",
        l.idle_break_minutes as "idleBreakMinutes",
        l.running_minutes as "runningMinutes",
        l.idle_minutes as "idleMinutes",
        l.start_meter as "startMeter",
        l.end_meter as "endMeter",
        l.calculated_cost as "calculatedCost",
        l.operator_name as "operatorName",
        l.work_description as "workDescription",
        l.status,
        l.created_at as "createdAt"
      FROM tenant_temporary_vehicle_logs l
      WHERE l.temporary_vehicle_id = $1
      ORDER BY l.log_date DESC, l.created_at DESC
    `, [id]);
    res.json(logsRes.rows);
  } catch (err: any) {
    console.error('[GET /api/tenant/temporary-vehicles/:id/logs] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Add Running Time Log for a Temporary Vehicle
router.post('/api/tenant/temporary-vehicles/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      logDate,
      shift,
      startTime,
      endTime,
      idleBreakMinutes,
      startMeter,
      endMeter,
      operatorName,
      workDescription
    } = req.body;

    const vRes = await pool.query('SELECT * FROM tenant_temporary_vehicles WHERE id = $1', [id]);
    if (vRes.rows.length === 0) {
      return res.status(404).json({ error: 'Temporary vehicle not found' });
    }
    const vehicle = vRes.rows[0];

    // Compute running time in minutes from startTime (HH:mm) to endTime (HH:mm)
    let totalSpanMins = 0;
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(':').map((n: string) => parseInt(n, 10));
      const [eh, em] = endTime.split(':').map((n: string) => parseInt(n, 10));
      let startM = (sh * 60) + (sm || 0);
      let endM = (eh * 60) + (em || 0);
      if (endM < startM) {
        endM += 24 * 60; // crossed midnight
      }
      totalSpanMins = endM - startM;
    }
    const idleMins = parseInt(idleBreakMinutes, 10) || 0;
    const runningMins = Math.max(0, totalSpanMins - idleMins);

    // Compute cost
    const agreedRate = parseFloat(vehicle.agreed_rate) || 0;
    const standbyRate = parseFloat(vehicle.standby_rate) || 0;
    let computedCost = 0;
    if (vehicle.rate_type === 'hourly') {
      computedCost = ((runningMins / 60) * agreedRate) + ((idleMins / 60) * standbyRate);
    } else if (vehicle.rate_type === 'daily') {
      computedCost = agreedRate;
    } else {
      computedCost = agreedRate; // trip
    }

    const insRes = await pool.query(`
      INSERT INTO tenant_temporary_vehicle_logs (
        tenant_id, temporary_vehicle_id, project_id, project_name, log_date,
        shift, start_time, end_time, idle_break_minutes, running_minutes, idle_minutes,
        start_meter, end_meter, calculated_cost, operator_name, work_description, status
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, 'Approved'
      ) RETURNING *,
        id,
        temporary_vehicle_id as "temporaryVehicleId",
        project_id as "projectId",
        project_name as "projectName",
        log_date as "logDate",
        shift,
        start_time as "startTime",
        end_time as "endTime",
        idle_break_minutes as "idleBreakMinutes",
        running_minutes as "runningMinutes",
        idle_minutes as "idleMinutes",
        start_meter as "startMeter",
        end_meter as "endMeter",
        calculated_cost as "calculatedCost",
        operator_name as "operatorName",
        work_description as "workDescription",
        status,
        created_at as "createdAt"
    `, [
      vehicle.tenant_id,
      id,
      vehicle.project_id,
      vehicle.project_name,
      logDate || new Date().toISOString().split('T')[0],
      shift || 'Day',
      startTime || '08:00',
      endTime || '18:00',
      idleMins,
      runningMins,
      idleMins,
      parseFloat(startMeter) || 0,
      parseFloat(endMeter) || 0,
      Number(computedCost.toFixed(2)),
      operatorName || vehicle.driver_name || 'Operator',
      workDescription || 'Project Operations'
    ]);

    res.status(201).json(insRes.rows[0]);
  } catch (err: any) {
    console.error('[POST /api/tenant/temporary-vehicles/:id/logs] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Temporary Vehicle
router.delete('/api/tenant/temporary-vehicles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const delRes = await pool.query('DELETE FROM tenant_temporary_vehicles WHERE id = $1 RETURNING *', [id]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: 'Temporary vehicle not found' });
    }
    res.json({ message: 'Temporary vehicle removed', vehicle: delRes.rows[0] });
  } catch (err: any) {
    console.error('[DELETE /api/tenant/temporary-vehicles/:id] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
