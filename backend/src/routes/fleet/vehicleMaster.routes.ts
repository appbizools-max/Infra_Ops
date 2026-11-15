import { Router } from 'express';
import { pool } from '../../config/db';

const router = Router();

// ─── VEHICLE MASTER & HEAVY EQUIPMENT MASTER ENDPOINTS ───────────────────────

// GET Vehicles
router.get(['/api/tenant/vehicles/:firebaseUid', '/api/tenant/vehicles'], async (req, res) => {
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
    const vRes = await pool.query(
      `SELECT 
         id,
         tenant_id as "tenantId",
         vehicle_number as "vehicleNumber",
         fleet_code as "fleetCode",
         vehicle_type as "vehicleType",
         make,
         model,
         year,
         registration_number as "registrationNumber",
         chassis_number as "chassisNumber",
         engine_number as "engineNumber",
         ton_capacity as "tonCapacity",
         volume_capacity as "volumeCapacity",
         volume_unit as "volumeUnit",
         purchase_date as "purchaseDate",
         purchase_cost as "purchaseCost",
         vendor,
         insurance_value as "insuranceValue",
         insurance_start_date as "insuranceStartDate",
         insurance_expiry_date as "insuranceExpiryDate",
         insurance_cost as "insuranceCost",
         insurance_duration as "insuranceDuration",
         insurance_policy_number as "insurancePolicyNumber",
         insurance_history as "insuranceHistory",
         fitness_expiry_date as "fitnessExpiryDate",
         assigned_driver_name as "assignedDriverName",
         assigned_driver_phone as "assignedDriverPhone",
         assigned_project_id as "assignedProjectId",
         assigned_project_name as "assignedProjectName",
         current_location as "currentLocation",
         fuel_power_type as "fuelPowerType",
         fuel_consumption as "fuelConsumption",
         status,
         notes,
         created_at as "createdAt",
         updated_at as "updatedAt"
       FROM tenant_vehicles
       WHERE tenant_id::text = $1::text
       ORDER BY created_at DESC`,
      [tenantId]
    );
    res.json(vRes.rows);
  } catch (err: any) {
    console.error(`[GET /api/tenant/vehicles] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});
// POST Vehicle
router.post('/api/tenant/vehicles', async (req, res) => {
  const {
    firebaseUid,
    vehicleNumber,
    fleetCode,
    vehicleType,
    make,
    model,
    year,
    registrationNumber,
    chassisNumber,
    engineNumber,
    tonCapacity,
    volumeCapacity,
    volumeUnit,
    purchaseDate,
    purchaseCost,
    vendor,
    insuranceValue,
    insuranceStartDate,
    insuranceExpiryDate,
    insuranceCost,
    insuranceDuration,
    insurancePolicyNumber,
    fitnessExpiryDate,
    assignedDriverName,
    assignedDriverPhone,
    assignedProjectId,
    assignedProjectName,
    currentLocation,
    fuelPowerType,
    fuelConsumption,
    status,
    notes
  } = req.body;
  if (!vehicleNumber || !vehicleType) {
    return res.status(400).json({ error: 'Vehicle number and vehicle type are required' });
  }
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

    const insertRes = await pool.query(
      `INSERT INTO tenant_vehicles (
         tenant_id, vehicle_number, fleet_code, vehicle_type, make, model, year,
         registration_number, chassis_number, engine_number, ton_capacity, volume_capacity,
         volume_unit, purchase_date, purchase_cost, vendor, insurance_value, 
         insurance_start_date, insurance_expiry_date, insurance_cost, insurance_duration, insurance_policy_number,
         fitness_expiry_date, assigned_driver_name, assigned_driver_phone, assigned_project_id,
         assigned_project_name, current_location, fuel_power_type, fuel_consumption, status, notes
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12,
         $13, $14, $15, $16, $17,
         $18, $19, $20, $21, $22,
         $23, $24, $25, $26,
         $27, $28, $29, $30, $31, $32
       ) RETURNING 
         id,
         tenant_id as "tenantId",
         vehicle_number as "vehicleNumber",
         fleet_code as "fleetCode",
         vehicle_type as "vehicleType",
         make,
         model,
         year,
         registration_number as "registrationNumber",
         chassis_number as "chassisNumber",
         engine_number as "engineNumber",
         ton_capacity as "tonCapacity",
         volume_capacity as "volumeCapacity",
         volume_unit as "volumeUnit",
         purchase_date as "purchaseDate",
         purchase_cost as "purchaseCost",
         vendor,
         insurance_value as "insuranceValue",
         insurance_start_date as "insuranceStartDate",
         insurance_expiry_date as "insuranceExpiryDate",
         insurance_cost as "insuranceCost",
         insurance_duration as "insuranceDuration",
         insurance_policy_number as "insurancePolicyNumber",
         fitness_expiry_date as "fitnessExpiryDate",
         assigned_driver_name as "assignedDriverName",
         assigned_driver_phone as "assignedDriverPhone",
         assigned_project_id as "assignedProjectId",
         assigned_project_name as "assignedProjectName",
         current_location as "currentLocation",
         fuel_power_type as "fuelPowerType",
         fuel_consumption as "fuelConsumption",
         status,
         notes,
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      [
        tenantId,
        vehicleNumber.trim(),
        fleetCode?.trim() || null,
        vehicleType.trim(),
        make?.trim() || null,
        model?.trim() || null,
        year ? parseInt(year, 10) : null,
        registrationNumber?.trim() || null,
        chassisNumber?.trim() || null,
        engineNumber?.trim() || null,
        tonCapacity ? parseFloat(tonCapacity) : 0,
        volumeCapacity ? parseFloat(volumeCapacity) : 0,
        volumeUnit || 'CUM',
        purchaseDate || null,
        purchaseCost ? parseFloat(purchaseCost) : 0,
        vendor?.trim() || null,
        insuranceValue ? parseFloat(insuranceValue) : 0,
        insuranceExpiryDate || null,
        fitnessExpiryDate || null,
        assignedDriverName?.trim() || null,
        assignedDriverPhone?.trim() || null,
        assignedProjectId || null,
        assignedProjectName?.trim() || null,
        currentLocation?.trim() || null,
        fuelPowerType?.trim() || 'Diesel',
        fuelConsumption?.trim() || null,
        status || 'Active',
        notes?.trim() || null
      ]
    );

    const createdVehicle = insertRes.rows[0];
    if (assignedDriverName && assignedDriverName.trim()) {
      try {
        const vTitle = [createdVehicle.make, createdVehicle.model].filter(Boolean).join(' ') || createdVehicle.vehicleType || 'Truck / Vehicle';
        await pool.query(
          `INSERT INTO tenant_vehicle_assignments (
             tenant_id, asset_type, asset_id, asset_number, asset_title,
             assigned_to_type, assigned_to_name, assigned_to_phone,
             project_id, project_name, status, start_date
           ) VALUES ($1, 'vehicle', $2, $3, $4, 'driver', $5, $6, $7, $8, 'Active', $9)`,
          [
            tenantId,
            String(createdVehicle.id),
            createdVehicle.vehicleNumber,
            vTitle,
            assignedDriverName.trim(),
            assignedDriverPhone?.trim() || null,
            createdVehicle.assignedProjectId || null,
            createdVehicle.assignedProjectName || null,
            new Date().toISOString().split('T')[0]
          ]
        );
      } catch (assignErr: any) {
        console.warn('Notice syncing vehicle assignment:', assignErr.message);
      }
    }

    res.status(201).json(createdVehicle);
  } catch (err: any) {
    console.error(`[POST /api/tenant/vehicles] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// PUT Vehicle
router.put('/api/tenant/vehicles/:id', async (req, res) => {
  const { id } = req.params;
  const {
    vehicleNumber,
    fleetCode,
    vehicleType,
    make,
    model,
    year,
    registrationNumber,
    chassisNumber,
    engineNumber,
    tonCapacity,
    volumeCapacity,
    volumeUnit,
    purchaseDate,
    purchaseCost,
    vendor,
    insuranceValue,
    insuranceStartDate,
    insuranceExpiryDate,
    insuranceCost,
    insuranceDuration,
    insurancePolicyNumber,
    fitnessExpiryDate,
    assignedDriverName,
    assignedDriverPhone,
    assignedProjectId,
    assignedProjectName,
    currentLocation,
    fuelPowerType,
    fuelConsumption,
    status,
    notes
  } = req.body;

  try {
    const updateRes = await pool.query(
      `UPDATE tenant_vehicles
       SET vehicle_number = COALESCE($1, vehicle_number),
           fleet_code = $2,
           vehicle_type = COALESCE($3, vehicle_type),
           make = $4,
           model = $5,
           year = $6,
           registration_number = $7,
           chassis_number = $8,
           engine_number = $9,
           ton_capacity = $10,
           volume_capacity = $11,
           volume_unit = COALESCE($12, volume_unit),
           purchase_date = $13,
           purchase_cost = $14,
           vendor = $15,
           insurance_value = $16,
           insurance_start_date = $17,
           insurance_expiry_date = $18,
           insurance_cost = $19,
           insurance_duration = $20,
           insurance_policy_number = $21,
           fitness_expiry_date = $22,
           assigned_driver_name = $23,
           assigned_driver_phone = $24,
           assigned_project_id = $25,
           assigned_project_name = $26,
           current_location = $27,
           fuel_power_type = COALESCE($28, fuel_power_type),
           fuel_consumption = COALESCE($29, fuel_consumption),
           status = COALESCE($30, status),
           notes = $31,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $32
       RETURNING 
         id,
         tenant_id as "tenantId",
         vehicle_number as "vehicleNumber",
         fleet_code as "fleetCode",
         vehicle_type as "vehicleType",
         make,
         model,
         year,
         registration_number as "registrationNumber",
         chassis_number as "chassisNumber",
         engine_number as "engineNumber",
         ton_capacity as "tonCapacity",
         volume_capacity as "volumeCapacity",
         volume_unit as "volumeUnit",
         purchase_date as "purchaseDate",
         purchase_cost as "purchaseCost",
         vendor,
         insurance_value as "insuranceValue",
         insurance_start_date as "insuranceStartDate",
         insurance_expiry_date as "insuranceExpiryDate",
         insurance_cost as "insuranceCost",
         insurance_duration as "insuranceDuration",
         insurance_policy_number as "insurancePolicyNumber",
         fitness_expiry_date as "fitnessExpiryDate",
         assigned_driver_name as "assignedDriverName",
         assigned_driver_phone as "assignedDriverPhone",
         assigned_project_id as "assignedProjectId",
         assigned_project_name as "assignedProjectName",
         current_location as "currentLocation",
         fuel_power_type as "fuelPowerType",
         fuel_consumption as "fuelConsumption",
         status,
         notes,
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      [
        vehicleNumber?.trim() || null,
        fleetCode?.trim() || null,
        vehicleType?.trim() || null,
        make?.trim() || null,
        model?.trim() || null,
        year ? parseInt(year, 10) : null,
        registrationNumber?.trim() || null,
        chassisNumber?.trim() || null,
        engineNumber?.trim() || null,
        tonCapacity !== undefined ? parseFloat(tonCapacity) : 0,
        volumeCapacity !== undefined ? parseFloat(volumeCapacity) : 0,
        volumeUnit || 'CUM',
        purchaseDate || null,
        purchaseCost !== undefined ? parseFloat(purchaseCost) : 0,
        vendor?.trim() || null,
        insuranceValue !== undefined ? parseFloat(insuranceValue) : 0,
        insuranceStartDate || null,
        insuranceExpiryDate || null,
        insuranceCost !== undefined ? parseFloat(insuranceCost) : 0,
        insuranceDuration?.trim() || null,
        insurancePolicyNumber?.trim() || null,
        fitnessExpiryDate || null,
        assignedDriverName?.trim() || null,
        assignedDriverPhone?.trim() || null,
        assignedProjectId || null,
        assignedProjectName?.trim() || null,
        currentLocation?.trim() || null,
        fuelPowerType?.trim() || null,
        fuelConsumption?.trim() || null,
        status || null,
        notes?.trim() || null,
        id
      ]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    const updatedVehicle = updateRes.rows[0];
    const tenantId = updatedVehicle.tenantId || '1';

    try {
      if (assignedDriverName && assignedDriverName.trim()) {
        const vTitle = [updatedVehicle.make, updatedVehicle.model].filter(Boolean).join(' ') || updatedVehicle.vehicleType || 'Truck / Vehicle';
        const existingAssign = await pool.query(
          `SELECT id FROM tenant_vehicle_assignments 
           WHERE tenant_id = $1 AND asset_id = $2 AND asset_type = 'vehicle' AND status = 'Active'`,
          [tenantId, String(id)]
        );

        if (existingAssign.rows.length > 0) {
          await pool.query(
            `UPDATE tenant_vehicle_assignments
             SET assigned_to_name = $1, assigned_to_phone = $2, asset_number = $3, asset_title = $4,
                 project_id = $5, project_name = $6, updated_at = NOW()
             WHERE id = $7`,
            [
              assignedDriverName.trim(),
              assignedDriverPhone?.trim() || null,
              updatedVehicle.vehicleNumber,
              vTitle,
              updatedVehicle.assignedProjectId || null,
              updatedVehicle.assignedProjectName || null,
              existingAssign.rows[0].id
            ]
          );
        } else {
          await pool.query(
            `INSERT INTO tenant_vehicle_assignments (
               tenant_id, asset_type, asset_id, asset_number, asset_title,
               assigned_to_type, assigned_to_name, assigned_to_phone,
               project_id, project_name, status, start_date
             ) VALUES ($1, 'vehicle', $2, $3, $4, 'driver', $5, $6, $7, $8, 'Active', $9)`,
            [
              tenantId,
              String(id),
              updatedVehicle.vehicleNumber,
              vTitle,
              assignedDriverName.trim(),
              assignedDriverPhone?.trim() || null,
              updatedVehicle.assignedProjectId || null,
              updatedVehicle.assignedProjectName || null,
              new Date().toISOString().split('T')[0]
            ]
          );
        }
      } else if (assignedDriverName === '' || assignedDriverName === null) {
        await pool.query(
          `UPDATE tenant_vehicle_assignments
           SET status = 'Released', actual_end_date = $1, updated_at = NOW()
           WHERE tenant_id = $2 AND asset_id = $3 AND asset_type = 'vehicle' AND status = 'Active'`,
          [new Date().toISOString().split('T')[0], tenantId, String(id)]
        );
      }
    } catch (assignErr: any) {
      console.warn('Notice syncing updated vehicle assignment:', assignErr.message);
    }

    res.json(updatedVehicle);
  } catch (err: any) {
    console.error(`[PUT /api/tenant/vehicles/:id] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Vehicle
router.delete('/api/tenant/vehicles/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleteRes = await pool.query('DELETE FROM tenant_vehicles WHERE id = $1 RETURNING *', [id]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json({ message: 'Vehicle deleted successfully', vehicle: deleteRes.rows[0] });
  } catch (err: any) {
    console.error(`[DELETE /api/tenant/vehicles/:id] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ─── HEAVY EQUIPMENT MASTER ENDPOINTS ────────────────────────────────────────

// GET Heavy Equipment
router.get(['/api/tenant/heavy-equipment/:firebaseUid', '/api/tenant/heavy-equipment'], async (req, res) => {
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

    const eqRes = await pool.query(
      `SELECT 
         id,
         tenant_id as "tenantId",
         equipment_id as "equipmentId",
         equipment_number as "equipmentNumber",
         equipment_type as "equipmentType",
         make,
         model,
         serial_number as "serialNumber",
         manufacturing_year as "manufacturingYear",
         excavator_bucket_capacity as "excavatorBucketCapacity",
         boom_length as "boomLength",
         loader_bucket_capacity as "loaderBucketCapacity",
         crane_lifting_capacity as "craneLiftingCapacity",
         forklift_fork_capacity as "forkliftForkCapacity",
         dumper_payload_capacity as "dumperPayloadCapacity",
         operating_weight as "operatingWeight",
         fuel_type as "fuelType",
         fuel_power_type as "fuelPowerType",
         fuel_consumption as "fuelConsumption",
         hour_meter_reading as "hourMeterReading",
         purchase_date as "purchaseDate",
         purchase_cost as "purchaseCost",
         vendor,
         insurance_value as "insuranceValue",
         insurance_start_date as "insuranceStartDate",
         insurance_expiry_date as "insuranceExpiryDate",
         insurance_cost as "insuranceCost",
         insurance_duration as "insuranceDuration",
         insurance_policy_number as "insurancePolicyNumber",
         insurance_history as "insuranceHistory",
         assigned_operator_name as "assignedOperatorName",
         assigned_operator_phone as "assignedOperatorPhone",
         assigned_project_id as "assignedProjectId",
         assigned_project_name as "assignedProjectName",
         assigned_worksite_name as "assignedWorksiteName",
         status,
         notes,
         created_at as "createdAt",
         updated_at as "updatedAt"
       FROM tenant_heavy_equipment
       WHERE tenant_id::text = $1::text
       ORDER BY created_at DESC`,
      [tenantId]
    );
    res.json(eqRes.rows);
  } catch (err: any) {
    console.error(`[GET /api/tenant/heavy-equipment] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// POST Heavy Equipment
router.post('/api/tenant/heavy-equipment', async (req, res) => {
  const {
    firebaseUid,
    equipmentId,
    equipmentNumber,
    equipmentType,
    make,
    model,
    serialNumber,
    manufacturingYear,
    excavatorBucketCapacity,
    boomLength,
    loaderBucketCapacity,
    craneLiftingCapacity,
    forkliftForkCapacity,
    dumperPayloadCapacity,
    operatingWeight,
    fuelType,
    fuelPowerType,
    fuelConsumption,
    hourMeterReading,
    purchaseDate,
    purchaseCost,
    vendor,
    insuranceValue,
    insuranceStartDate,
    insuranceExpiryDate,
    insuranceCost,
    insuranceDuration,
    insurancePolicyNumber,
    assignedOperatorName,
    assignedOperatorPhone,
    assignedProjectId,
    assignedProjectName,
    assignedWorksiteName,
    status,
    notes
  } = req.body;

  if (!equipmentId || !equipmentNumber || !equipmentType) {
    return res.status(400).json({ error: 'Equipment ID, equipment number, and equipment type are required' });
  }

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

    const insertRes = await pool.query(
      `INSERT INTO tenant_heavy_equipment (
         tenant_id, equipment_id, equipment_number, equipment_type, make, model, serial_number,
         manufacturing_year, excavator_bucket_capacity, boom_length, loader_bucket_capacity,
         crane_lifting_capacity, forklift_fork_capacity, dumper_payload_capacity, operating_weight,
         fuel_type, fuel_power_type, fuel_consumption, hour_meter_reading, purchase_date, purchase_cost, vendor, 
         insurance_value, insurance_start_date, insurance_expiry_date, insurance_cost, insurance_duration, insurance_policy_number,
         assigned_operator_name, assigned_operator_phone, assigned_project_id, assigned_project_name,
         assigned_worksite_name, status, notes
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11,
         $12, $13, $14, $15,
         $16, $17, $18, $19, $20, $21, $22,
         $23, $24, $25, $26, $27, $28,
         $29, $30, $31, $32,
         $33, $34, $35
       ) RETURNING 
         id,
         tenant_id as "tenantId",
         equipment_id as "equipmentId",
         equipment_number as "equipmentNumber",
         equipment_type as "equipmentType",
         make,
         model,
         serial_number as "serialNumber",
         manufacturing_year as "manufacturingYear",
         excavator_bucket_capacity as "excavatorBucketCapacity",
         boom_length as "boomLength",
         loader_bucket_capacity as "loaderBucketCapacity",
         crane_lifting_capacity as "craneLiftingCapacity",
         forklift_fork_capacity as "forkliftForkCapacity",
         dumper_payload_capacity as "dumperPayloadCapacity",
         operating_weight as "operatingWeight",
         fuel_type as "fuelType",
         hour_meter_reading as "hourMeterReading",
         purchase_date as "purchaseDate",
         purchase_cost as "purchaseCost",
         vendor,
         insurance_value as "insuranceValue",
         insurance_start_date as "insuranceStartDate",
         insurance_expiry_date as "insuranceExpiryDate",
         insurance_cost as "insuranceCost",
         insurance_duration as "insuranceDuration",
         insurance_policy_number as "insurancePolicyNumber",
         assigned_operator_name as "assignedOperatorName",
         assigned_operator_phone as "assignedOperatorPhone",
         assigned_project_id as "assignedProjectId",
         assigned_project_name as "assignedProjectName",
         assigned_worksite_name as "assignedWorksiteName",
         status,
         notes,
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      [
        tenantId,
        equipmentId.trim(),
        equipmentNumber.trim(),
        equipmentType.trim(),
        make?.trim() || null,
        model?.trim() || null,
        serialNumber?.trim() || null,
        manufacturingYear ? parseInt(manufacturingYear, 10) : null,
        excavatorBucketCapacity ? parseFloat(excavatorBucketCapacity) : 0,
        boomLength ? parseFloat(boomLength) : 0,
        loaderBucketCapacity ? parseFloat(loaderBucketCapacity) : 0,
        craneLiftingCapacity ? parseFloat(craneLiftingCapacity) : 0,
        forkliftForkCapacity ? parseFloat(forkliftForkCapacity) : 0,
        dumperPayloadCapacity ? parseFloat(dumperPayloadCapacity) : 0,
        operatingWeight ? parseFloat(operatingWeight) : 0,
        fuelPowerType || fuelType || 'Diesel',
        fuelPowerType || 'Diesel',
        fuelConsumption?.trim() || null,
        hourMeterReading ? parseFloat(hourMeterReading) : 0,
        purchaseDate || null,
        purchaseCost ? parseFloat(purchaseCost) : 0,
        vendor?.trim() || null,
        insuranceValue ? parseFloat(insuranceValue) : 0,
        insuranceStartDate || null,
        insuranceExpiryDate || null,
        insuranceCost ? parseFloat(insuranceCost) : 0,
        insuranceDuration?.trim() || null,
        insurancePolicyNumber?.trim() || null,
        assignedOperatorName?.trim() || null,
        assignedOperatorPhone?.trim() || null,
        assignedProjectId || null,
        assignedProjectName?.trim() || null,
        assignedWorksiteName?.trim() || null,
        status || 'Active',
        notes?.trim() || null
      ]
    );

    const createdEq = insertRes.rows[0];
    if (assignedOperatorName && assignedOperatorName.trim()) {
      try {
        const eqTitle = [createdEq.equipmentType, createdEq.equipmentId].filter(Boolean).join(' ') || 'Heavy Equipment';
        await pool.query(
          `INSERT INTO tenant_vehicle_assignments (
             tenant_id, asset_type, asset_id, asset_number, asset_title,
             assigned_to_type, assigned_to_name, assigned_to_phone,
             project_id, project_name, worksite_name, status, start_date
           ) VALUES ($1, 'equipment', $2, $3, $4, 'operator', $5, $6, $7, $8, $9, 'Active', $10)`,
          [
            tenantId,
            String(createdEq.id),
            createdEq.equipmentNumber,
            eqTitle,
            assignedOperatorName.trim(),
            assignedOperatorPhone?.trim() || null,
            createdEq.assignedProjectId || null,
            createdEq.assignedProjectName || null,
            createdEq.assignedWorksiteName || null,
            new Date().toISOString().split('T')[0]
          ]
        );
      } catch (assignErr: any) {
        console.warn('Notice syncing equipment assignment:', assignErr.message);
      }
    }

    res.status(201).json(createdEq);
  } catch (err: any) {
    console.error(`[POST /api/tenant/heavy-equipment] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// PUT Heavy Equipment
router.put('/api/tenant/heavy-equipment/:id', async (req, res) => {
  const { id } = req.params;
  const {
    equipmentId,
    equipmentNumber,
    equipmentType,
    make,
    model,
    serialNumber,
    manufacturingYear,
    excavatorBucketCapacity,
    boomLength,
    loaderBucketCapacity,
    craneLiftingCapacity,
    forkliftForkCapacity,
    dumperPayloadCapacity,
    operatingWeight,
    fuelType,
    fuelPowerType,
    fuelConsumption,
    hourMeterReading,
    purchaseDate,
    purchaseCost,
    vendor,
    insuranceValue,
    insuranceStartDate,
    insuranceExpiryDate,
    insuranceCost,
    insuranceDuration,
    insurancePolicyNumber,
    assignedOperatorName,
    assignedOperatorPhone,
    assignedProjectId,
    assignedProjectName,
    assignedWorksiteName,
    status,
    notes
  } = req.body;

  try {
    const updateRes = await pool.query(
      `UPDATE tenant_heavy_equipment
       SET equipment_id = COALESCE($1, equipment_id),
           equipment_number = COALESCE($2, equipment_number),
           equipment_type = COALESCE($3, equipment_type),
           make = $4,
           model = $5,
           serial_number = $6,
           manufacturing_year = $7,
           excavator_bucket_capacity = $8,
           boom_length = $9,
           loader_bucket_capacity = $10,
           crane_lifting_capacity = $11,
           forklift_fork_capacity = $12,
           dumper_payload_capacity = $13,
           operating_weight = $14,
           fuel_type = COALESCE($15, fuel_type),
           fuel_power_type = COALESCE($16, fuel_power_type),
           fuel_consumption = COALESCE($17, fuel_consumption),
           hour_meter_reading = $18,
           purchase_date = $19,
           purchase_cost = $20,
           vendor = $21,
           insurance_value = $22,
           insurance_start_date = $23,
           insurance_expiry_date = $24,
           insurance_cost = $25,
           insurance_duration = $26,
           insurance_policy_number = $27,
           assigned_operator_name = $28,
           assigned_operator_phone = $29,
           assigned_project_id = $30,
           assigned_project_name = $31,
           assigned_worksite_name = $32,
           status = COALESCE($33, status),
           notes = $34,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $35
       RETURNING 
         id,
         tenant_id as "tenantId",
         equipment_id as "equipmentId",
         equipment_number as "equipmentNumber",
         equipment_type as "equipmentType",
         make,
         model,
         serial_number as "serialNumber",
         manufacturing_year as "manufacturingYear",
         excavator_bucket_capacity as "excavatorBucketCapacity",
         boom_length as "boomLength",
         loader_bucket_capacity as "loaderBucketCapacity",
         crane_lifting_capacity as "craneLiftingCapacity",
         forklift_fork_capacity as "forkliftForkCapacity",
         dumper_payload_capacity as "dumperPayloadCapacity",
         operating_weight as "operatingWeight",
         fuel_type as "fuelType",
         fuel_power_type as "fuelPowerType",
         fuel_consumption as "fuelConsumption",
         hour_meter_reading as "hourMeterReading",
         purchase_date as "purchaseDate",
         purchase_cost as "purchaseCost",
         vendor,
         insurance_value as "insuranceValue",
         insurance_start_date as "insuranceStartDate",
         insurance_expiry_date as "insuranceExpiryDate",
         insurance_cost as "insuranceCost",
         insurance_duration as "insuranceDuration",
         insurance_policy_number as "insurancePolicyNumber",
         assigned_operator_name as "assignedOperatorName",
         assigned_operator_phone as "assignedOperatorPhone",
         assigned_project_id as "assignedProjectId",
         assigned_project_name as "assignedProjectName",
         assigned_worksite_name as "assignedWorksiteName",
         status,
         notes,
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      [
        equipmentId?.trim() || null,
        equipmentNumber?.trim() || null,
        equipmentType?.trim() || null,
        make?.trim() || null,
        model?.trim() || null,
        serialNumber?.trim() || null,
        manufacturingYear ? parseInt(manufacturingYear, 10) : null,
        excavatorBucketCapacity !== undefined ? parseFloat(excavatorBucketCapacity) : 0,
        boomLength !== undefined ? parseFloat(boomLength) : 0,
        loaderBucketCapacity !== undefined ? parseFloat(loaderBucketCapacity) : 0,
        craneLiftingCapacity !== undefined ? parseFloat(craneLiftingCapacity) : 0,
        forkliftForkCapacity !== undefined ? parseFloat(forkliftForkCapacity) : 0,
        dumperPayloadCapacity !== undefined ? parseFloat(dumperPayloadCapacity) : 0,
        operatingWeight !== undefined ? parseFloat(operatingWeight) : 0,
        fuelType || 'Diesel',
        fuelPowerType || 'Diesel',
        fuelConsumption?.trim() || null,
        hourMeterReading !== undefined ? parseFloat(hourMeterReading) : 0,
        purchaseDate || null,
        purchaseCost !== undefined ? parseFloat(purchaseCost) : 0,
        vendor?.trim() || null,
        insuranceValue !== undefined ? parseFloat(insuranceValue) : 0,
        insuranceStartDate || null,
        insuranceExpiryDate || null,
        insuranceCost !== undefined ? parseFloat(insuranceCost) : 0,
        insuranceDuration?.trim() || null,
        insurancePolicyNumber?.trim() || null,
        assignedOperatorName?.trim() || null,
        assignedOperatorPhone?.trim() || null,
        assignedProjectId || null,
        assignedProjectName?.trim() || null,
        assignedWorksiteName?.trim() || null,
        status || null,
        notes?.trim() || null,
        id
      ]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Heavy equipment not found' });
    }
    const updatedEq = updateRes.rows[0];
    const tenantId = updatedEq.tenantId || '1';

    try {
      if (assignedOperatorName && assignedOperatorName.trim()) {
        const eqTitle = [updatedEq.equipmentType, updatedEq.equipmentId].filter(Boolean).join(' ') || 'Heavy Equipment';
        const existingAssign = await pool.query(
          `SELECT id FROM tenant_vehicle_assignments 
           WHERE tenant_id = $1 AND asset_id = $2 AND asset_type = 'equipment' AND status = 'Active'`,
          [tenantId, String(id)]
        );

        if (existingAssign.rows.length > 0) {
          await pool.query(
            `UPDATE tenant_vehicle_assignments
             SET assigned_to_name = $1, assigned_to_phone = $2, asset_number = $3, asset_title = $4,
                 project_id = $5, project_name = $6, worksite_name = $7, updated_at = NOW()
             WHERE id = $8`,
            [
              assignedOperatorName.trim(),
              assignedOperatorPhone?.trim() || null,
              updatedEq.equipmentNumber,
              eqTitle,
              updatedEq.assignedProjectId || null,
              updatedEq.assignedProjectName || null,
              updatedEq.assignedWorksiteName || null,
              existingAssign.rows[0].id
            ]
          );
        } else {
          await pool.query(
            `INSERT INTO tenant_vehicle_assignments (
               tenant_id, asset_type, asset_id, asset_number, asset_title,
               assigned_to_type, assigned_to_name, assigned_to_phone,
               project_id, project_name, worksite_name, status, start_date
             ) VALUES ($1, 'equipment', $2, $3, $4, 'operator', $5, $6, $7, $8, $9, 'Active', $10)`,
            [
              tenantId,
              String(id),
              updatedEq.equipmentNumber,
              eqTitle,
              assignedOperatorName.trim(),
              assignedOperatorPhone?.trim() || null,
              updatedEq.assignedProjectId || null,
              updatedEq.assignedProjectName || null,
              updatedEq.assignedWorksiteName || null,
              new Date().toISOString().split('T')[0]
            ]
          );
        }
      } else if (assignedOperatorName === '' || assignedOperatorName === null) {
        await pool.query(
          `UPDATE tenant_vehicle_assignments
           SET status = 'Released', actual_end_date = $1, updated_at = NOW()
           WHERE tenant_id = $2 AND asset_id = $3 AND asset_type = 'equipment' AND status = 'Active'`,
          [new Date().toISOString().split('T')[0], tenantId, String(id)]
        );
      }
    } catch (assignErr: any) {
      console.warn('Notice syncing updated equipment assignment:', assignErr.message);
    }

    res.json(updatedEq);
  } catch (err: any) {
    console.error(`[PUT /api/tenant/heavy-equipment/:id] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Heavy Equipment

// PATCH Renew Vehicle Insurance
router.patch('/api/tenant/vehicles/:id/renew-insurance', async (req, res) => {
  const { id } = req.params;
  const {
    insuranceStartDate,
    insuranceExpiryDate,
    insuranceCost,
    insuranceValue,
    insuranceDuration,
    insurancePolicyNumber
  } = req.body;

  try {
    // 1. Fetch current insurance to archive into insurance_history
    const existingRes = await pool.query(
      `SELECT insurance_start_date, insurance_expiry_date, insurance_cost, insurance_value, insurance_duration, insurance_policy_number, insurance_history
       FROM tenant_vehicles WHERE id = $1`,
      [id]
    );

    let history: any[] = [];
    if (existingRes.rows.length > 0) {
      const ex = existingRes.rows[0];
      if (Array.isArray(ex.insurance_history)) {
        history = [...ex.insurance_history];
      } else if (typeof ex.insurance_history === 'string' && ex.insurance_history) {
        try { history = JSON.parse(ex.insurance_history); } catch (e) { history = []; }
      }
      // Archive old policy if it had data
      if (ex.insurance_policy_number || ex.insurance_expiry_date || ex.insurance_start_date || (ex.insurance_cost && Number(ex.insurance_cost) > 0)) {
        history.unshift({
          policyNumber: ex.insurance_policy_number || 'N/A',
          startDate: ex.insurance_start_date || '',
          duration: ex.insurance_duration || '',
          expiryDate: ex.insurance_expiry_date || '',
          cost: ex.insurance_cost ? parseFloat(ex.insurance_cost) : 0,
          insuranceValue: ex.insurance_value ? parseFloat(ex.insurance_value) : 0,
          renewedAt: new Date().toISOString()
        });
      }
    }

    const updateRes = await pool.query(
      `UPDATE tenant_vehicles
       SET insurance_start_date = $1,
           insurance_expiry_date = $2,
           insurance_cost = $3,
           insurance_value = $4,
           insurance_duration = $5,
           insurance_policy_number = $6,
           insurance_history = $7::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING 
         id,
         vehicle_number as "vehicleNumber",
         insurance_value as "insuranceValue",
         insurance_start_date as "insuranceStartDate",
         insurance_expiry_date as "insuranceExpiryDate",
         insurance_cost as "insuranceCost",
         insurance_duration as "insuranceDuration",
         insurance_policy_number as "insurancePolicyNumber",
         insurance_history as "insuranceHistory"`,
      [
        insuranceStartDate || null,
        insuranceExpiryDate || null,
        insuranceCost !== undefined ? parseFloat(insuranceCost) : 0,
        insuranceValue !== undefined ? parseFloat(insuranceValue) : 0,
        insuranceDuration?.trim() || null,
        insurancePolicyNumber?.trim() || null,
        JSON.stringify(history),
        id
      ]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json({ message: 'Vehicle insurance renewed successfully', vehicle: updateRes.rows[0] });
  } catch (err: any) {
    console.error('[PATCH /api/tenant/vehicles/:id/renew-insurance] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH Renew Heavy Equipment Insurance
router.patch('/api/tenant/heavy-equipment/:id/renew-insurance', async (req, res) => {
  const { id } = req.params;
  const {
    insuranceStartDate,
    insuranceExpiryDate,
    insuranceCost,
    insuranceValue,
    insuranceDuration,
    insurancePolicyNumber
  } = req.body;

  try {
    // 1. Fetch current insurance to archive into insurance_history
    const existingRes = await pool.query(
      `SELECT insurance_start_date, insurance_expiry_date, insurance_cost, insurance_value, insurance_duration, insurance_policy_number, insurance_history
       FROM tenant_heavy_equipment WHERE id = $1`,
      [id]
    );

    let history: any[] = [];
    if (existingRes.rows.length > 0) {
      const ex = existingRes.rows[0];
      if (Array.isArray(ex.insurance_history)) {
        history = [...ex.insurance_history];
      } else if (typeof ex.insurance_history === 'string' && ex.insurance_history) {
        try { history = JSON.parse(ex.insurance_history); } catch (e) { history = []; }
      }
      // Archive old policy if it had data
      if (ex.insurance_policy_number || ex.insurance_expiry_date || ex.insurance_start_date || (ex.insurance_cost && Number(ex.insurance_cost) > 0)) {
        history.unshift({
          policyNumber: ex.insurance_policy_number || 'N/A',
          startDate: ex.insurance_start_date || '',
          duration: ex.insurance_duration || '',
          expiryDate: ex.insurance_expiry_date || '',
          cost: ex.insurance_cost ? parseFloat(ex.insurance_cost) : 0,
          insuranceValue: ex.insurance_value ? parseFloat(ex.insurance_value) : 0,
          renewedAt: new Date().toISOString()
        });
      }
    }

    const updateRes = await pool.query(
      `UPDATE tenant_heavy_equipment
       SET insurance_start_date = $1,
           insurance_expiry_date = $2,
           insurance_cost = $3,
           insurance_value = $4,
           insurance_duration = $5,
           insurance_policy_number = $6,
           insurance_history = $7::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING 
         id,
         equipment_id as "equipmentId",
         insurance_value as "insuranceValue",
         insurance_start_date as "insuranceStartDate",
         insurance_expiry_date as "insuranceExpiryDate",
         insurance_cost as "insuranceCost",
         insurance_duration as "insuranceDuration",
         insurance_policy_number as "insurancePolicyNumber",
         insurance_history as "insuranceHistory"`,
      [
        insuranceStartDate || null,
        insuranceExpiryDate || null,
        insuranceCost !== undefined ? parseFloat(insuranceCost) : 0,
        insuranceValue !== undefined ? parseFloat(insuranceValue) : 0,
        insuranceDuration?.trim() || null,
        insurancePolicyNumber?.trim() || null,
        JSON.stringify(history),
        id
      ]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Heavy Equipment not found' });
    }
    res.json({ message: 'Heavy equipment insurance renewed successfully', equipment: updateRes.rows[0] });
  } catch (err: any) {
    console.error('[PATCH /api/tenant/heavy-equipment/:id/renew-insurance] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/tenant/heavy-equipment/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleteRes = await pool.query('DELETE FROM tenant_heavy_equipment WHERE id = $1 RETURNING *', [id]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Heavy equipment not found' });
    }
    res.json({ message: 'Heavy equipment deleted successfully', equipment: deleteRes.rows[0] });
  } catch (err: any) {
    console.error(`[DELETE /api/tenant/heavy-equipment/:id] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
