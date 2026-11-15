import { Router } from 'express';
import { pool } from '../../config/db';

const router = Router();

// ====================================================================
// 🏗️ STOCKYARDS & MATERIAL INVENTORY ENDPOINTS
// ====================================================================

// GET all Stockyards for a Tenant (Searchable, filterable by division & status, with real metrics)
router.get('/api/tenant/stockyards', async (req, res) => {
  try {
    const firebaseUid = (req.query as any).firebaseUid || (req.query as any).uid;
    const { divisionId, status, search, q } = req.query as any;
    let tenantId = 1;
    if (firebaseUid) {
      const aRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [firebaseUid]);
      if (aRes.rows.length > 0) tenantId = aRes.rows[0].tenant_id;
      else {
        const uRes = await pool.query('SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1', [firebaseUid]);
        if (uRes.rows.length > 0) tenantId = uRes.rows[0].tenant_id;
      }
    }

    const params: any[] = [tenantId];
    let filterClauses = '';

    if (divisionId && divisionId !== 'ALL') {
      params.push(divisionId);
      filterClauses += ` AND (y.division_id = $${params.length} OR y.division_id::text = $${params.length})`;
    }
    if (status && status !== 'ALL') {
      params.push(status);
      filterClauses += ` AND LOWER(y.status) = LOWER($${params.length})`;
    }
    const searchTerm = search || q;
    if (searchTerm && searchTerm.trim()) {
      params.push(`%${searchTerm.trim()}%`);
      filterClauses += ` AND (y.yard_name ILIKE $${params.length} OR y.yard_code ILIKE $${params.length} OR y.location ILIKE $${params.length})`;
    }

    const query = `
      SELECT 
        y.id,
        y.tenant_id as "tenantId",
        y.yard_code as "yardCode",
        y.yard_name as "yardName",
        y.division_id as "divisionId",
        COALESCE(y.division_name, d.name, 'Corporate HQ') as "divisionName",
        y.worksite_id as "worksiteId",
        y.worksite_name as "worksiteName",
        y.total_capacity_tons as "totalCapacityTons",
        y.location,
        y.latitude,
        y.longitude,
        y.supervisor_name as "supervisorName",
        y.supervisor_phone as "supervisorPhone",
        y.weighbridge_installed as "weighbridgeInstalled",
        y.weighbridge_capacity_tons as "weighbridgeCapacityTons",
        COALESCE(y.status, 'Active') as "status",
        y.notes,
        y.created_at as "createdAt",
        COALESCE(p_stats.projects_count, (SELECT COUNT(DISTINCT project_id) FROM tenant_stockyard_transactions WHERE stockyard_id = y.id AND project_id IS NOT NULL), 0)::INTEGER as "projectsCount",
        COALESCE(m_stats.materials_count, (SELECT COUNT(DISTINCT material_name) FROM tenant_stockyard_piles WHERE stockyard_id = y.id), 0)::INTEGER as "materialsCount",
        COALESCE(inv_stats.current_available, y.current_occupancy_tons, 0)::NUMERIC as "currentAvailableStock",
        COALESCE(inv_stats.current_available, y.current_occupancy_tons, 0)::NUMERIC as "currentOccupancyTons",
        COALESCE(inv_stats.total_received, 0)::NUMERIC as "totalReceived",
        COALESCE(inv_stats.total_issued, 0)::NUMERIC as "totalIssued",
        COALESCE(inv_stats.total_loss, 0)::NUMERIC as "totalLoss",
        'MT' as "stockUnit"
      FROM tenant_stockyards y
      LEFT JOIN tenant_divisions d ON y.division_id = d.id
      LEFT JOIN (
        SELECT stockyard_id, COUNT(DISTINCT project_id) as projects_count
        FROM tenant_stockyard_transactions
        WHERE project_id IS NOT NULL AND project_id <> ''
        GROUP BY stockyard_id
      ) p_stats ON y.id = p_stats.stockyard_id
      LEFT JOIN (
        SELECT stockyard_id, COUNT(DISTINCT mat_name) as materials_count
        FROM (
          SELECT stockyard_id, material_name as mat_name FROM tenant_stockyard_piles WHERE material_name IS NOT NULL
          UNION
          SELECT stockyard_id, material_name as mat_name FROM tenant_stockyard_transactions WHERE material_name IS NOT NULL
        ) all_m
        GROUP BY stockyard_id
      ) m_stats ON y.id = m_stats.stockyard_id
      LEFT JOIN (
        SELECT 
          stockyard_id,
          SUM(CASE WHEN transaction_type = 'INWARD' THEN quantity ELSE 0 END) as total_received,
          SUM(CASE WHEN transaction_type = 'OUTWARD' THEN quantity ELSE 0 END) as total_issued,
          SUM(CASE WHEN transaction_type = 'LOSS' THEN quantity ELSE 0 END) as total_loss,
          SUM(CASE 
            WHEN transaction_type = 'INWARD' THEN quantity 
            WHEN transaction_type = 'OUTWARD' THEN -quantity 
            WHEN transaction_type = 'LOSS' THEN -quantity 
            WHEN transaction_type = 'ADJUSTMENT' THEN quantity 
            ELSE 0 
          END) as current_available
        FROM tenant_stockyard_transactions
        GROUP BY stockyard_id
      ) inv_stats ON y.id = inv_stats.stockyard_id
      WHERE y.tenant_id = $1 ${filterClauses}
      ORDER BY y.id ASC
    `;

    const yardsRes = await pool.query(query, params);
    res.json(yardsRes.rows);
  } catch (err: any) {
    console.error('[GET /api/tenant/stockyards] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Single Stockyard by ID with full overview metrics
router.get('/api/tenant/stockyards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const yardRes = await pool.query(`
      SELECT 
        y.id,
        y.tenant_id as "tenantId",
        y.yard_code as "yardCode",
        y.yard_name as "yardName",
        y.division_id as "divisionId",
        COALESCE(y.division_name, d.name, 'Corporate HQ') as "divisionName",
        y.worksite_id as "worksiteId",
        y.worksite_name as "worksiteName",
        y.total_capacity_tons as "totalCapacityTons",
        y.location,
        y.latitude,
        y.longitude,
        y.supervisor_name as "supervisorName",
        y.supervisor_phone as "supervisorPhone",
        y.weighbridge_installed as "weighbridgeInstalled",
        y.weighbridge_capacity_tons as "weighbridgeCapacityTons",
        COALESCE(y.status, 'Active') as "status",
        y.notes,
        y.created_at as "createdAt"
      FROM tenant_stockyards y
      LEFT JOIN tenant_divisions d ON y.division_id = d.id
      WHERE y.id = $1
    `, [id]);

    if (yardRes.rows.length === 0) {
      return res.status(404).json({ error: 'Stockyard not found' });
    }

    const yard = yardRes.rows[0];

    // Compute actual inventory metrics from ledger and associated projects
    const statsRes = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'INWARD' THEN quantity ELSE 0 END), 0)::NUMERIC as "totalReceived",
        COALESCE(SUM(CASE WHEN transaction_type = 'OUTWARD' THEN quantity ELSE 0 END), 0)::NUMERIC as "totalIssued",
        COALESCE(SUM(CASE WHEN transaction_type = 'LOSS' THEN quantity ELSE 0 END), 0)::NUMERIC as "totalLoss",
        COALESCE(SUM(CASE WHEN transaction_type = 'ADJUSTMENT' THEN quantity ELSE 0 END), 0)::NUMERIC as "totalAdjustment",
        COALESCE(SUM(CASE 
          WHEN transaction_type = 'INWARD' THEN quantity 
          WHEN transaction_type = 'OUTWARD' THEN -quantity 
          WHEN transaction_type = 'LOSS' THEN -quantity 
          WHEN transaction_type = 'ADJUSTMENT' THEN quantity 
          ELSE 0 
        END), 0)::NUMERIC as "currentAvailable"
      FROM tenant_stockyard_transactions
      WHERE stockyard_id = $1
    `, [id]);

    const countRes = await pool.query(`
      SELECT 
        COUNT(DISTINCT p_id) as "projectsCount",
        COUNT(DISTINCT m_name) as "materialsCount"
      FROM (
        SELECT project_id as p_id, material_name as m_name 
        FROM tenant_stockyard_transactions 
        WHERE stockyard_id = $1 AND project_id IS NOT NULL AND project_id <> ''
        UNION
        SELECT project_id as p_id, planned_material as m_name 
        FROM tenant_project_stockyards 
        WHERE stockyard_id = $1 AND status = 'Active'
      ) comb
    `, [id]);

    const stats = statsRes.rows[0];
    const counts = countRes.rows[0] || {};
    const totalCap = parseFloat(yard.totalCapacityTons) || 50000;
    const currentAvail = parseFloat(stats.currentAvailable) > 0 ? parseFloat(stats.currentAvailable) : (parseFloat(yard.currentOccupancyTons) || 0);

    res.json({
      ...yard,
      projectsCount: parseInt(counts.projectsCount || '0', 10),
      materialsCount: parseInt(counts.materialsCount || '0', 10),
      totalReceived: parseFloat(stats.totalReceived || '0'),
      totalIssued: parseFloat(stats.totalIssued || '0'),
      totalLoss: parseFloat(stats.totalLoss || '0'),
      totalAdjustment: parseFloat(stats.totalAdjustment || '0'),
      currentAvailable: currentAvail,
      currentOccupancyTons: currentAvail,
      capacityUtilizationPct: totalCap > 0 ? Math.min(100, Math.round((currentAvail / totalCap) * 100)) : 0,
      stockUnit: 'MT'
    });
  } catch (err: any) {
    console.error('[GET /api/tenant/stockyards/:id] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Project-Wise Material Inventory for a Stockyard (Strict Project Isolation & Planned vs Actual)
router.get('/api/tenant/stockyards/:id/inventory', async (req, res) => {
  try {
    const { id } = req.params;

    const inventoryRes = await pool.query(`
      SELECT 
        t.project_id as "projectId",
        t.project_name as "projectName",
        COALESCE(t.material_name, p.material_name, 'General Material') as "materialName",
        COALESCE(t.unit, p.unit_of_measure, 'MT') as "unit",
        SUM(CASE WHEN t.transaction_type = 'INWARD' THEN t.quantity ELSE 0 END)::NUMERIC as "totalReceived",
        SUM(CASE WHEN t.transaction_type = 'OUTWARD' THEN t.quantity ELSE 0 END)::NUMERIC as "totalIssued",
        SUM(CASE WHEN t.transaction_type = 'LOSS' THEN t.quantity ELSE 0 END)::NUMERIC as "totalLoss",
        SUM(CASE WHEN t.transaction_type = 'ADJUSTMENT' THEN t.quantity ELSE 0 END)::NUMERIC as "totalAdjustment",
        SUM(CASE 
          WHEN t.transaction_type = 'INWARD' THEN t.quantity 
          WHEN t.transaction_type = 'OUTWARD' THEN -t.quantity 
          WHEN t.transaction_type = 'LOSS' THEN -t.quantity 
          WHEN t.transaction_type = 'ADJUSTMENT' THEN t.quantity 
          ELSE 0 
        END)::NUMERIC as "currentAvailable",
        MAX(t.created_at) as "lastTransactionDate",
        COUNT(t.id)::INTEGER as "transactionCount"
      FROM tenant_stockyard_transactions t
      LEFT JOIN tenant_stockyard_piles p ON t.pile_id = p.id
      WHERE t.stockyard_id = $1 AND t.project_id IS NOT NULL AND t.project_id <> ''
      GROUP BY t.stockyard_id, t.project_id, t.project_name, COALESCE(t.material_name, p.material_name, 'General Material'), COALESCE(t.unit, p.unit_of_measure, 'MT')
      ORDER BY t.project_name ASC, "materialName" ASC
    `, [id]);

    // For each project-material pair, fetch last vehicle and weighbridge ticket reference
    const items = await Promise.all(inventoryRes.rows.map(async (row) => {
      const lastRefRes = await pool.query(`
        SELECT vehicle_number as "vehicleNumber", weighbridge_slip_number as "weighbridgeSlipNumber", waybill_number as "waybillNumber", created_at as "createdAt"
        FROM tenant_stockyard_transactions
        WHERE stockyard_id = $1 AND project_id = $2 AND (material_name = $3 OR material_name IS NULL)
        ORDER BY created_at DESC
        LIMIT 1
      `, [id, row.projectId, row.materialName]);

      const lastRef = lastRefRes.rows[0] || null;
      return {
        ...row,
        totalReceived: parseFloat(row.totalReceived || '0'),
        totalIssued: parseFloat(row.totalIssued || '0'),
        totalLoss: parseFloat(row.totalLoss || '0'),
        totalAdjustment: parseFloat(row.totalAdjustment || '0'),
        currentAvailable: parseFloat(row.currentAvailable || '0'),
        lastVehicleNumber: lastRef?.vehicleNumber || '—',
        lastWeighbridgeSlip: lastRef?.weighbridgeSlipNumber || lastRef?.waybillNumber || '—'
      };
    }));

    // Query associated projects from tenant_project_stockyards
    const assocProjectsRes = await pool.query(`
      SELECT 
        ps.project_id as "projectId",
        ps.project_name as "projectName",
        ps.planned_material as "materialName",
        ps.planned_unit as "unit",
        ps.planned_quantity as "plannedQuantity",
        ps.corridor_id as "corridorId",
        ps.status as "associationStatus",
        ps.created_at as "associatedAt"
      FROM tenant_project_stockyards ps
      WHERE ps.stockyard_id = $1 AND ps.status = 'Active'
    `, [id]);

    const assocMap = new Map<string, any>();
    assocProjectsRes.rows.forEach(ap => {
      assocMap.set(ap.projectId, ap);
    });

    // Attach planned quantities to items that match
    const matchedProjectIds = new Set<string>();
    items.forEach(item => {
      const ap = assocMap.get(item.projectId);
      if (ap) {
        item.plannedQuantity = parseFloat(ap.plannedQuantity || '0');
        item.isAssociated = true;
        item.corridorId = ap.corridorId;
        matchedProjectIds.add(item.projectId);
      } else {
        item.plannedQuantity = 0;
      }
    });

    // For associated projects that have NOT yet recorded any transactions,
    // add them with 0 actuals and the planned quantity!
    assocProjectsRes.rows.forEach(ap => {
      if (!matchedProjectIds.has(ap.projectId)) {
        items.push({
          projectId: ap.projectId,
          projectName: ap.projectName,
          materialName: ap.materialName || 'Aggregates',
          unit: ap.unit || 'MT',
          plannedQuantity: parseFloat(ap.plannedQuantity || '0'),
          totalReceived: 0,
          totalIssued: 0,
          totalLoss: 0,
          totalAdjustment: 0,
          currentAvailable: 0,
          lastTransactionDate: ap.associatedAt || new Date().toISOString(),
          transactionCount: 0,
          lastVehicleNumber: '—',
          lastWeighbridgeSlip: 'Awaiting Inward',
          isPlannedAssociation: true,
          isAssociated: true,
          corridorId: ap.corridorId
        });
      }
    });

    res.json(items);
  } catch (err: any) {
    console.error('[GET /api/tenant/stockyards/:id/inventory] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Create Stockyard with validation & division linking
router.post('/api/tenant/stockyards', async (req, res) => {
  try {
    const {
      firebaseUid, yardCode, yardName, location, divisionId, divisionName,
      status = 'Active', totalCapacityTons = 50000, worksiteId, worksiteName,
      supervisorName, supervisorPhone, weighbridgeInstalled = true,
      weighbridgeCapacityTons = 100, notes
    } = req.body;

    // 1. Validation
    if (!yardName || !yardName.trim()) {
      return res.status(400).json({ error: 'Stockyard Name is required.' });
    }
    if (!location || !location.trim()) {
      return res.status(400).json({ error: 'Stockyard Location is required.' });
    }
    if (!divisionId && !divisionName) {
      return res.status(400).json({ error: 'Division is required. Please select a valid division.' });
    }

    let tenantId = 1;
    if (firebaseUid) {
      const aRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [firebaseUid]);
      if (aRes.rows.length > 0) tenantId = aRes.rows[0].tenant_id;
    }

    // 2. Generate or sanitize stockyard code
    let finalCode = (yardCode || '').trim().toUpperCase();
    if (!finalCode) {
      finalCode = `SYD-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // 3. Uniqueness checks
    const codeCheck = await pool.query(
      'SELECT id FROM tenant_stockyards WHERE tenant_id = $1 AND LOWER(yard_code) = LOWER($2)',
      [tenantId, finalCode]
    );
    if (codeCheck.rows.length > 0) {
      return res.status(400).json({ error: `Stockyard Code "${finalCode}" is already in use. Please specify a unique code.` });
    }

    const nameCheck = await pool.query(
      'SELECT id FROM tenant_stockyards WHERE tenant_id = $1 AND LOWER(yard_name) = LOWER($2)',
      [tenantId, yardName.trim()]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(400).json({ error: `A stockyard with the name "${yardName.trim()}" already exists in your organization.` });
    }

    // 4. Resolve division name if divisionId is provided
    let finalDivName = divisionName || '';
    if (divisionId && !finalDivName) {
      const divRes = await pool.query('SELECT name FROM tenant_divisions WHERE id = $1', [divisionId]);
      if (divRes.rows.length > 0) finalDivName = divRes.rows[0].name;
    }

    // 5. Insert
    const insertRes = await pool.query(`
      INSERT INTO tenant_stockyards (
        tenant_id, yard_code, yard_name, location, division_id, division_name,
        status, total_capacity_tons, worksite_id, worksite_name,
        supervisor_name, supervisor_phone, weighbridge_installed,
        weighbridge_capacity_tons, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING 
        id,
        yard_code as "yardCode",
        yard_name as "yardName",
        location,
        division_id as "divisionId",
        division_name as "divisionName",
        status,
        total_capacity_tons as "totalCapacityTons",
        created_at as "createdAt"
    `, [
      tenantId, finalCode, yardName.trim(), location.trim(),
      divisionId || null, finalDivName || 'Corporate HQ',
      status || 'Active', parseFloat(totalCapacityTons) || 50000,
      worksiteId || null, worksiteName || null,
      supervisorName || '', supervisorPhone || '',
      weighbridgeInstalled !== undefined ? weighbridgeInstalled : true,
      parseFloat(weighbridgeCapacityTons) || 100, notes || ''
    ]);

    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    console.error('[POST /api/tenant/stockyards] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Stockyard
router.delete('/api/tenant/stockyards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const delRes = await pool.query('DELETE FROM tenant_stockyards WHERE id = $1 RETURNING *', [id]);
    if (delRes.rows.length === 0) return res.status(404).json({ error: 'Stockyard not found' });
    res.json({ message: 'Stockyard deleted successfully', yard: delRes.rows[0] });
  } catch (err: any) {
    console.error('[DELETE /api/tenant/stockyards/:id] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Piles for a Stockyard
router.get('/api/tenant/stockyards/:id/piles', async (req, res) => {
  try {
    const { id } = req.params;
    const pilesRes = await pool.query(`
      SELECT 
        id,
        tenant_id as "tenantId",
        stockyard_id as "stockyardId",
        bay_number as "bayNumber",
        material_name as "materialName",
        grade,
        unit_of_measure as "unitOfMeasure",
        current_quantity as "currentQuantity",
        min_threshold_quantity as "minThresholdQuantity",
        max_capacity as "maxCapacity",
        density_factor as "densityFactor",
        color_code as "colorCode",
        status,
        created_at as "createdAt"
      FROM tenant_stockyard_piles
      WHERE stockyard_id = $1
      ORDER BY bay_number ASC, id ASC
    `, [id]);

    res.json(pilesRes.rows);
  } catch (err: any) {
    console.error('[GET /api/tenant/stockyards/:id/piles] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Add Material Pile to Stockyard
router.post('/api/tenant/stockyards/:id/piles', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      bayNumber, materialName, grade, unitOfMeasure,
      currentQuantity, minThresholdQuantity, maxCapacity,
      densityFactor, colorCode
    } = req.body;

    const yardRes = await pool.query('SELECT tenant_id FROM tenant_stockyards WHERE id = $1', [id]);
    if (yardRes.rows.length === 0) return res.status(404).json({ error: 'Stockyard not found' });
    const tenantId = yardRes.rows[0].tenant_id;

    const insertRes = await pool.query(`
      INSERT INTO tenant_stockyard_piles (
        tenant_id, stockyard_id, bay_number, material_name, grade,
        unit_of_measure, current_quantity, min_threshold_quantity,
        max_capacity, density_factor, color_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, bay_number as "bayNumber", material_name as "materialName", current_quantity as "currentQuantity"
    `, [
      tenantId, id, bayNumber || 'Bay-1', materialName, grade || '',
      unitOfMeasure || 'MT', currentQuantity || 0, minThresholdQuantity || 500,
      maxCapacity || 20000, densityFactor || 1.6, colorCode || '#00705a'
    ]);

    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    console.error('[POST /api/tenant/stockyards/:id/piles] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Pile
router.delete('/api/tenant/stockyards/piles/:pileId', async (req, res) => {
  try {
    const { pileId } = req.params;
    const delRes = await pool.query('DELETE FROM tenant_stockyard_piles WHERE id = $1 RETURNING *', [pileId]);
    if (delRes.rows.length === 0) return res.status(404).json({ error: 'Pile not found' });
    res.json({ message: 'Pile deleted successfully' });
  } catch (err: any) {
    console.error('[DELETE /api/tenant/stockyards/piles/:pileId] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Record Material Receipt Into Stockyard (INWARD - Deep Gate & Weighbridge Accounting)
router.post('/api/tenant/stockyards/:id/receipt', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      projectId, projectName, materialName, unit = 'MT',
      vehicleNumber, driverName, driverPhone,
      waybillNumber, weighbridgeSlipNumber,
      grossWeight, tareWeight, netWeight,
      dispatchQuantity, sourceLocation, remarks, recordedBy,
      transportMode = 'TRUCK', supplierName, challanNumber,
      moisturePct, qualityGrade, pileId, grnNumber: customGrn,
      rackId, rackName
    } = req.body;

    if (!projectId) return res.status(400).json({ error: 'Project is required for receiving material.' });
    if (!materialName || !materialName.trim()) return res.status(400).json({ error: 'Material name is required.' });
    if (!vehicleNumber || !vehicleNumber.trim()) return res.status(400).json({ error: 'Vehicle / Rake number is required.' });

    // Validate stockyard existence
    const yardRes = await pool.query('SELECT tenant_id, yard_name FROM tenant_stockyards WHERE id = $1', [id]);
    if (yardRes.rows.length === 0) return res.status(404).json({ error: 'Stockyard not found' });
    const tenantId = yardRes.rows[0].tenant_id;

    // Calculate net weight
    let grossNum = parseFloat(grossWeight) || 0;
    let tareNum = parseFloat(tareWeight) || 0;
    let finalNet = parseFloat(netWeight) || 0;
    if (grossNum > 0 && tareNum > 0 && grossNum > tareNum) {
      finalNet = parseFloat((grossNum - tareNum).toFixed(2));
    }
    if (finalNet <= 0) {
      return res.status(400).json({ error: 'Valid received quantity or net weighbridge weight is required.' });
    }

    // Discrepancy vs dispatch quantity
    let discrepancy = 0;
    if (dispatchQuantity && parseFloat(dispatchQuantity) > 0) {
      discrepancy = parseFloat((parseFloat(dispatchQuantity) - finalNet).toFixed(2));
    }

    const finalGrn = customGrn || `GRN-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // Insert atomic transaction
    const txInsert = await pool.query(`
      INSERT INTO tenant_stockyard_transactions (
        tenant_id, stockyard_id, pile_id, transaction_type, quantity, unit,
        material_name, project_id, project_name, vehicle_number,
        driver_name, driver_phone, waybill_number, weighbridge_slip_number,
        gross_weight, tare_weight, net_weight, source_location,
        discrepancy_quantity, remarks, recorded_by,
        transport_mode, supplier_name, challan_number, moisture_pct, quality_grade, grn_number,
        rack_id, rack_name
      ) VALUES ($1, $2, $3, 'INWARD', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
      RETURNING *
    `, [
      tenantId, id, pileId ? parseInt(pileId, 10) : null, finalNet, unit,
      materialName.trim(), projectId, projectName || projectId, vehicleNumber.trim().toUpperCase(),
      driverName || '', driverPhone || '', waybillNumber || '', weighbridgeSlipNumber || '',
      grossNum || null, tareNum || null, finalNet, sourceLocation || '',
      discrepancy, remarks || '', recordedBy || 'Gate Operator',
      transportMode || 'TRUCK', supplierName || '', challanNumber || '',
      parseFloat(moisturePct) || 0, qualityGrade || '', finalGrn,
      rackId ? parseInt(rackId, 10) : null, rackName || null
    ]);

    // Update current occupancy in stockyard
    await pool.query(`
      UPDATE tenant_stockyards 
      SET current_occupancy_tons = COALESCE(current_occupancy_tons, 0) + $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [finalNet, id]);

    // If specific stockpile pile bay was selected, increment that bay's stock
    if (pileId) {
      await pool.query(`
        UPDATE tenant_stockyard_piles
        SET current_quantity = COALESCE(current_quantity, 0) + $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND stockyard_id = $3
      `, [finalNet, pileId, id]);
    }

    // Insert linked equipment utilization records if equipmentUsed is provided (Unloading)
    const equipmentList = Array.isArray(req.body.equipmentUsed)
      ? req.body.equipmentUsed
      : (req.body.equipmentUsed ? [req.body.equipmentUsed] : []);

    const createdEquipments = [];
    for (const eq of equipmentList) {
      if (!eq.equipmentId && !eq.equipmentNumber) continue;
      const sTime = eq.startTime ? new Date(eq.startTime) : new Date();
      const eTime = eq.endTime ? new Date(eq.endTime) : new Date(Date.now() + 3600000);
      let durationHours = parseFloat(eq.durationHours);
      if (isNaN(durationHours) || durationHours <= 0) {
        durationHours = Math.max(0.1, parseFloat(((eTime.getTime() - sTime.getTime()) / (1000 * 60 * 60)).toFixed(2)));
      }

      const eqUtilRes = await pool.query(`
        INSERT INTO tenant_stockyard_equipment_utilization (
          tenant_id, stockyard_id, stockyard_name, project_id, project_name,
          transaction_id, shift_id, equipment_id, equipment_number, equipment_name,
          equipment_type, operation_type, material_name, quantity, unit,
          source_rack_id, source_rack_name, destination_rack_id, destination_rack_name,
          start_time, end_time, duration_hours,
          operator_name, operator_phone, status, remarks, recorded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
        RETURNING *
      `, [
        String(tenantId), id, yardRes.rows[0]?.yard_name || 'Stockyard', projectId, projectName || projectId,
        txInsert.rows[0].id, finalGrn, eq.equipmentId || eq.equipmentNumber, eq.equipmentNumber || eq.equipmentId,
        eq.equipmentName || eq.make || eq.equipmentType || 'Heavy Equipment',
        eq.equipmentType || 'Backhoe Loader', 'UNLOADING', materialName.trim(), finalNet, unit,
        null, sourceLocation || 'Incoming Vehicle', rackId ? parseInt(rackId, 10) : null, rackName || 'Stockyard Pile',
        sTime, eTime, durationHours,
        eq.operatorName || '', eq.operatorPhone || '', 'Completed',
        eq.remarks || remarks || `Material unloading for GRN ${finalGrn}`,
        recordedBy || 'Gate Operator'
      ]);
      createdEquipments.push(eqUtilRes.rows[0]);

      if (durationHours > 0 && (eq.equipmentId || eq.equipmentNumber)) {
        await pool.query(`
          UPDATE tenant_heavy_equipment
          SET hour_meter_reading = COALESCE(hour_meter_reading, 0) + $1, updated_at = CURRENT_TIMESTAMP
          WHERE (equipment_id = $2 OR equipment_number = $2) AND tenant_id::text = $3::text
        `, [durationHours, eq.equipmentId || eq.equipmentNumber, String(tenantId)]);
      }
    }

    res.status(201).json({
      message: 'Material received and confirmed into stockyard inventory',
      grnNumber: finalGrn,
      transaction: txInsert.rows[0],
      equipmentUtilization: createdEquipments
    });
  } catch (err: any) {
    console.error('[POST /api/tenant/stockyards/:id/receipt] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Racks / Internal Storage Locations for a Stockyard (Optional Rack Management)
router.get('/api/tenant/stockyards/:id/racks', async (req, res) => {
  try {
    const { id } = req.params;
    const racksRes = await pool.query(`
      SELECT 
        r.id,
        r.stockyard_id as "stockyardId",
        r.rack_code as "rackCode",
        r.rack_name as "rackName",
        r.location_type as "locationType",
        r.capacity_tons as "capacityTons",
        r.description,
        r.status,
        r.created_at as "createdAt",
        COALESCE(inv.current_available, 0)::NUMERIC as "currentOccupancyTons"
      FROM tenant_stockyard_racks r
      LEFT JOIN (
        SELECT 
          stockyard_id,
          COALESCE(rack_id, 0) as r_id,
          SUM(CASE 
            WHEN transaction_type = 'INWARD' THEN quantity 
            WHEN transaction_type = 'OUTWARD' THEN -quantity 
            WHEN transaction_type = 'LOSS' THEN -quantity 
            WHEN transaction_type = 'ADJUSTMENT' THEN quantity 
            ELSE 0 
          END) as current_available
        FROM tenant_stockyard_transactions
        GROUP BY stockyard_id, rack_id
      ) inv ON r.id = inv.r_id AND r.stockyard_id = inv.stockyard_id
      WHERE r.stockyard_id = $1
      ORDER BY r.rack_code ASC, r.id ASC
    `, [id]);
    res.json(racksRes.rows);
  } catch (err: any) {
    console.error('[GET /api/tenant/stockyards/:id/racks] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Add Internal Storage Rack / Stack / Bay (Optional)
router.post('/api/tenant/stockyards/:id/racks', async (req, res) => {
  try {
    const { id } = req.params;
    const { rackName, rackCode, locationType = 'Rack', capacityTons = 10000, description, status = 'Active' } = req.body;
    if (!rackName || !rackName.trim()) return res.status(400).json({ error: 'Rack / Location Name is required.' });

    const yardRes = await pool.query('SELECT tenant_id FROM tenant_stockyards WHERE id = $1', [id]);
    if (yardRes.rows.length === 0) return res.status(404).json({ error: 'Stockyard not found' });
    const tenantId = yardRes.rows[0].tenant_id;

    let finalCode = (rackCode || '').trim().toUpperCase();
    if (!finalCode) {
      finalCode = `RCK-${Math.floor(100 + Math.random() * 900)}`;
    }

    const dupCheck = await pool.query(
      'SELECT id FROM tenant_stockyard_racks WHERE stockyard_id = $1 AND LOWER(rack_code) = LOWER($2)',
      [id, finalCode]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({ error: `Rack code "${finalCode}" already exists in this stockyard. Please use a unique code.` });
    }

    const insertRes = await pool.query(`
      INSERT INTO tenant_stockyard_racks (
        tenant_id, stockyard_id, rack_code, rack_name, location_type, capacity_tons, description, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, stockyard_id as "stockyardId", rack_code as "rackCode", rack_name as "rackName", location_type as "locationType", capacity_tons as "capacityTons", description, status, created_at as "createdAt"
    `, [tenantId, id, finalCode, rackName.trim(), locationType || 'Rack', parseFloat(capacityTons) || 10000, description || '', status || 'Active']);

    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    console.error('[POST /api/tenant/stockyards/:id/racks] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT Edit Rack / Storage Location
router.put('/api/tenant/stockyards/:id/racks/:rackId', async (req, res) => {
  try {
    const { id, rackId } = req.params;
    const { rackName, rackCode, locationType, capacityTons, description, status } = req.body;

    const updateRes = await pool.query(`
      UPDATE tenant_stockyard_racks
      SET rack_name = COALESCE($1, rack_name),
          rack_code = COALESCE($2, rack_code),
          location_type = COALESCE($3, location_type),
          capacity_tons = COALESCE($4, capacity_tons),
          description = COALESCE($5, description),
          status = COALESCE($6, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND stockyard_id = $8
      RETURNING *
    `, [rackName, rackCode, locationType, capacityTons ? parseFloat(capacityTons) : null, description, status, rackId, id]);

    if (updateRes.rows.length === 0) return res.status(404).json({ error: 'Rack not found' });
    res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error('[PUT /api/tenant/stockyards/:id/racks/:rackId] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Rack / Storage Location
router.delete('/api/tenant/stockyards/:id/racks/:rackId', async (req, res) => {
  try {
    const { id, rackId } = req.params;
    const delRes = await pool.query('DELETE FROM tenant_stockyard_racks WHERE id = $1 AND stockyard_id = $2 RETURNING *', [rackId, id]);
    if (delRes.rows.length === 0) return res.status(404).json({ error: 'Rack not found' });
    res.json({ message: 'Storage location deleted successfully' });
  } catch (err: any) {
    console.error('[DELETE /api/tenant/stockyards/:id/racks/:rackId] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Rack-Wise Material Inventory Breakdown
router.get('/api/tenant/stockyards/:id/rack-inventory', async (req, res) => {
  try {
    const { id } = req.params;
    const rackInv = await pool.query(`
      SELECT 
        COALESCE(r.rack_name, t.rack_name, 'Open Storage Area') as "rackName",
        COALESCE(r.rack_code, 'GENERAL') as "rackCode",
        COALESCE(r.location_type, 'General') as "locationType",
        t.project_id as "projectId",
        t.project_name as "projectName",
        COALESCE(t.material_name, 'General Material') as "materialName",
        COALESCE(t.unit, 'MT') as "unit",
        SUM(CASE 
          WHEN t.transaction_type = 'INWARD' AND (t.rack_id = r.id OR (t.rack_id IS NULL AND r.id IS NULL)) THEN t.quantity
          WHEN t.transaction_type = 'OUTWARD' AND (t.rack_id = r.id OR (t.rack_id IS NULL AND r.id IS NULL)) THEN -t.quantity
          WHEN t.transaction_type = 'LOSS' AND (t.rack_id = r.id OR (t.rack_id IS NULL AND r.id IS NULL)) THEN -t.quantity
          WHEN t.transaction_type = 'ADJUSTMENT' AND (t.rack_id = r.id OR (t.rack_id IS NULL AND r.id IS NULL)) THEN t.quantity
          WHEN t.transaction_type = 'INTERNAL_SHIFT' AND t.destination_rack_id = r.id THEN t.quantity
          WHEN t.transaction_type = 'INTERNAL_SHIFT' AND t.rack_id = r.id THEN -t.quantity
          ELSE 0
        END)::NUMERIC as "currentAvailable",
        MAX(t.created_at) as "lastUpdated"
      FROM tenant_stockyard_transactions t
      FULL OUTER JOIN tenant_stockyard_racks r ON (t.rack_id = r.id OR t.destination_rack_id = r.id) AND r.stockyard_id = $1
      WHERE t.stockyard_id = $1 AND t.project_id IS NOT NULL
      GROUP BY COALESCE(r.rack_name, t.rack_name, 'Open Storage Area'), COALESCE(r.rack_code, 'GENERAL'), COALESCE(r.location_type, 'General'), t.project_id, t.project_name, COALESCE(t.material_name, 'General Material'), COALESCE(t.unit, 'MT')
      HAVING SUM(CASE 
          WHEN t.transaction_type = 'INWARD' AND (t.rack_id = r.id OR (t.rack_id IS NULL AND r.id IS NULL)) THEN t.quantity
          WHEN t.transaction_type = 'OUTWARD' AND (t.rack_id = r.id OR (t.rack_id IS NULL AND r.id IS NULL)) THEN -t.quantity
          WHEN t.transaction_type = 'LOSS' AND (t.rack_id = r.id OR (t.rack_id IS NULL AND r.id IS NULL)) THEN -t.quantity
          WHEN t.transaction_type = 'ADJUSTMENT' AND (t.rack_id = r.id OR (t.rack_id IS NULL AND r.id IS NULL)) THEN t.quantity
          WHEN t.transaction_type = 'INTERNAL_SHIFT' AND t.destination_rack_id = r.id THEN t.quantity
          WHEN t.transaction_type = 'INTERNAL_SHIFT' AND t.rack_id = r.id THEN -t.quantity
          ELSE 0
        END) > 0
      ORDER BY "rackName" ASC, "projectName" ASC
    `, [id]);
    res.json(rackInv.rows);
  } catch (err: any) {
    console.error('[GET /api/tenant/stockyards/:id/rack-inventory] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Shift Stock Within Stockyard (Internal Relocation - Net Zero Total Effect)
router.post('/api/tenant/stockyards/:id/shift', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      projectId, projectName, materialName, unit = 'MT',
      sourceRackId, sourceRackName,
      destinationRackId, destinationRackName,
      quantity, shiftDate, remarks, recordedBy
    } = req.body;

    if (!projectId) return res.status(400).json({ error: 'Project is required for internal stock shifting.' });
    if (!materialName || !materialName.trim()) return res.status(400).json({ error: 'Material type is required.' });
    const shiftQty = parseFloat(quantity);
    if (!shiftQty || shiftQty <= 0) return res.status(400).json({ error: 'Shift quantity must be greater than zero.' });

    if (!sourceRackName && !sourceRackId) return res.status(400).json({ error: 'Source rack or location is required.' });
    if (!destinationRackName && !destinationRackId) return res.status(400).json({ error: 'Destination rack or location is required.' });

    // Validate Source != Destination
    if (
      (sourceRackId && destinationRackId && String(sourceRackId) === String(destinationRackId)) ||
      (sourceRackName && destinationRackName && sourceRackName.trim().toLowerCase() === destinationRackName.trim().toLowerCase())
    ) {
      return res.status(400).json({ error: 'Source and Destination must be different storage locations within this stockyard.' });
    }

    // Verify stockyard exists
    const yardRes = await pool.query('SELECT tenant_id FROM tenant_stockyards WHERE id = $1', [id]);
    if (yardRes.rows.length === 0) return res.status(404).json({ error: 'Stockyard not found' });
    const tenantId = yardRes.rows[0].tenant_id;

    // Check project balance
    const overallRes = await pool.query(`
      SELECT COALESCE(SUM(CASE 
        WHEN transaction_type = 'INWARD' THEN quantity 
        WHEN transaction_type = 'OUTWARD' THEN -quantity 
        WHEN transaction_type = 'LOSS' THEN -quantity 
        WHEN transaction_type = 'ADJUSTMENT' THEN quantity 
        ELSE 0 
      END), 0) as available
      FROM tenant_stockyard_transactions
      WHERE stockyard_id = $1 AND project_id = $2 AND LOWER(material_name) = LOWER($3)
    `, [id, projectId, materialName.trim()]);
    const overallAvailable = parseFloat(overallRes.rows[0]?.available || '0');

    if (shiftQty > overallAvailable) {
      return res.status(400).json({
        error: `Insufficient project stock: Project "${projectName || projectId}" only has ${overallAvailable.toFixed(2)} ${unit} of "${materialName}" available in this stockyard. Cannot shift ${shiftQty.toFixed(2)} ${unit}.`
      });
    }

    const shiftId = `SFT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    // Insert atomic INTERNAL_SHIFT transaction
    const txInsert = await pool.query(`
      INSERT INTO tenant_stockyard_transactions (
        tenant_id, stockyard_id, transaction_type, quantity, unit,
        material_name, project_id, project_name,
        source_location, destination_location,
        rack_id, rack_name, destination_rack_id, destination_rack_name,
        shift_id, remarks, recorded_by
      ) VALUES ($1, $2, 'INTERNAL_SHIFT', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      tenantId, id, shiftQty, unit,
      materialName.trim(), projectId, projectName || projectId,
      sourceRackName || 'Rack A', destinationRackName || 'Rack B',
      sourceRackId ? parseInt(sourceRackId, 10) : null, sourceRackName || '',
      destinationRackId ? parseInt(destinationRackId, 10) : null, destinationRackName || '',
      shiftId, remarks ? `[INTERNAL SHIFT] ${remarks.trim()}` : `Internal relocation from ${sourceRackName} to ${destinationRackName}`,
      recordedBy || 'Yard Operations Supervisor'
    ]);

    // Insert linked equipment utilization records if equipmentUsed is provided
    const equipmentList = Array.isArray(req.body.equipmentUsed)
      ? req.body.equipmentUsed
      : (req.body.equipmentUsed ? [req.body.equipmentUsed] : []);

    const createdEquipments = [];
    for (const eq of equipmentList) {
      if (!eq.equipmentId && !eq.equipmentNumber) continue;
      const sTime = eq.startTime ? new Date(eq.startTime) : new Date();
      const eTime = eq.endTime ? new Date(eq.endTime) : new Date(Date.now() + 3600000);
      let durationHours = parseFloat(eq.durationHours);
      if (isNaN(durationHours) || durationHours <= 0) {
        durationHours = Math.max(0.1, parseFloat(((eTime.getTime() - sTime.getTime()) / (1000 * 60 * 60)).toFixed(2)));
      }

      const eqUtilRes = await pool.query(`
        INSERT INTO tenant_stockyard_equipment_utilization (
          tenant_id, stockyard_id, stockyard_name, project_id, project_name,
          transaction_id, shift_id, equipment_id, equipment_number, equipment_name,
          equipment_type, operation_type, material_name, quantity, unit,
          source_rack_id, source_rack_name, destination_rack_id, destination_rack_name,
          start_time, end_time, duration_hours,
          operator_name, operator_phone, status, remarks, recorded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
        RETURNING *
      `, [
        String(tenantId), id, yardRes.rows[0]?.yard_name || 'Stockyard', projectId, projectName || projectId,
        txInsert.rows[0].id, shiftId, eq.equipmentId || eq.equipmentNumber, eq.equipmentNumber || eq.equipmentId,
        eq.equipmentName || eq.make || eq.equipmentType || 'Heavy Equipment',
        eq.equipmentType || 'Front-end Loader', 'INTERNAL_SHIFT', materialName.trim(), shiftQty, unit,
        sourceRackId ? parseInt(sourceRackId, 10) : null, sourceRackName || '',
        destinationRackId ? parseInt(destinationRackId, 10) : null, destinationRackName || '',
        sTime, eTime, durationHours,
        eq.operatorName || '', eq.operatorPhone || '', 'Completed',
        eq.remarks || remarks || `Internal rack shift from ${sourceRackName} to ${destinationRackName}`,
        recordedBy || 'Yard Operations Supervisor'
      ]);
      createdEquipments.push(eqUtilRes.rows[0]);

      if (durationHours > 0 && (eq.equipmentId || eq.equipmentNumber)) {
        await pool.query(`
          UPDATE tenant_heavy_equipment
          SET hour_meter_reading = COALESCE(hour_meter_reading, 0) + $1, updated_at = CURRENT_TIMESTAMP
          WHERE (equipment_id = $2 OR equipment_number = $2) AND tenant_id::text = $3::text
        `, [durationHours, eq.equipmentId || eq.equipmentNumber, String(tenantId)]);
      }
    }

    res.status(201).json({
      message: `Successfully shifted ${shiftQty} ${unit} from ${sourceRackName} to ${destinationRackName}`,
      shiftId,
      transaction: txInsert.rows[0],
      equipmentUtilization: createdEquipments
    });
  } catch (err: any) {
    console.error('[POST /api/tenant/stockyards/:id/shift] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Internal Shifts History for Stockyard
router.get('/api/tenant/stockyards/:id/shifts', async (req, res) => {
  try {
    const { id } = req.params;
    const shiftsRes = await pool.query(`
      SELECT 
        id, shift_id as "shiftId", stockyard_id as "stockyardId",
        project_id as "projectId", project_name as "projectName",
        material_name as "materialName", quantity, unit,
        rack_name as "sourceLocation", destination_rack_name as "destinationLocation",
        remarks, recorded_by as "recordedBy", created_at as "createdAt"
      FROM tenant_stockyard_transactions
      WHERE stockyard_id = $1 AND transaction_type = 'INTERNAL_SHIFT'
      ORDER BY created_at DESC
      LIMIT 100
    `, [id]);
    res.json(shiftsRes.rows);
  } catch (err: any) {
    console.error('[GET /api/tenant/stockyards/:id/shifts] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Eligible Heavy Machinery for Stockyard Operations (Reuses tenant_heavy_equipment)
router.get('/api/tenant/stockyards/:id/eligible-equipment', async (req, res) => {
  try {
    const { id } = req.params;
    const yardRes = await pool.query('SELECT tenant_id FROM tenant_stockyards WHERE id = $1', [id]);
    if (yardRes.rows.length === 0) return res.status(404).json({ error: 'Stockyard not found' });
    const tenantId = yardRes.rows[0].tenant_id;

    // Fetch heavy machinery records (JCB, Loader, Excavator, Forklift, Crane, etc.)
    const eqRes = await pool.query(`
      SELECT 
        id,
        equipment_id as "equipmentId",
        equipment_number as "equipmentNumber",
        equipment_type as "equipmentType",
        make,
        model,
        hour_meter_reading as "hourMeterReading",
        assigned_operator_name as "assignedOperatorName",
        assigned_operator_phone as "assignedOperatorPhone",
        assigned_project_id as "assignedProjectId",
        assigned_project_name as "assignedProjectName",
        status
      FROM tenant_heavy_equipment
      WHERE tenant_id::text = $1::text
      ORDER BY 
        CASE WHEN status = 'Active' THEN 0 ELSE 1 END,
        equipment_number ASC
    `, [String(tenantId)]);

    // Check ongoing in-progress assignments in this yard
    const activeRes = await pool.query(`
      SELECT equipment_id, equipment_number
      FROM tenant_stockyard_equipment_utilization
      WHERE stockyard_id = $1 AND status = 'In-Progress'
    `, [id]);
    const busySet = new Set(activeRes.rows.map(r => r.equipment_id || r.equipment_number));

    const eligible = eqRes.rows.map(eq => ({
      ...eq,
      isBusy: busySet.has(eq.equipmentId) || busySet.has(eq.equipmentNumber),
      isAvailable: eq.status === 'Active' && !busySet.has(eq.equipmentId) && !busySet.has(eq.equipmentNumber)
    }));

    res.json(eligible);
  } catch (err: any) {
    console.error('[GET /api/tenant/stockyards/:id/eligible-equipment] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Stockyard Equipment Utilization Ledger & Report
router.get('/api/tenant/stockyards/:id/equipment-utilization', async (req, res) => {
  try {
    const { id } = req.params;
    const { operationType, equipmentId, projectId, startDate, endDate } = req.query;

    let query = `
      SELECT 
        id,
        stockyard_id as "stockyardId",
        stockyard_name as "stockyardName",
        project_id as "projectId",
        project_name as "projectName",
        transaction_id as "transactionId",
        shift_id as "shiftId",
        equipment_id as "equipmentId",
        equipment_number as "equipmentNumber",
        equipment_name as "equipmentName",
        equipment_type as "equipmentType",
        operation_type as "operationType",
        material_name as "materialName",
        quantity,
        unit,
        source_rack_name as "sourceRackName",
        destination_rack_name as "destinationRackName",
        start_time as "startTime",
        end_time as "endTime",
        duration_hours as "durationHours",
        operator_name as "operatorName",
        operator_phone as "operatorPhone",
        status,
        remarks,
        recorded_by as "recordedBy",
        created_at as "createdAt"
      FROM tenant_stockyard_equipment_utilization
      WHERE stockyard_id = $1
    `;
    const params: any[] = [id];

    if (operationType && operationType !== 'ALL') {
      params.push(operationType);
      query += ` AND operation_type = $${params.length}`;
    }
    if (equipmentId && equipmentId !== 'ALL') {
      params.push(equipmentId);
      query += ` AND (equipment_id = $${params.length} OR equipment_number = $${params.length})`;
    }
    if (projectId && projectId !== 'ALL') {
      params.push(projectId);
      query += ` AND project_id = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      query += ` AND start_time >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND end_time <= $${params.length}`;
    }

    query += ` ORDER BY start_time DESC LIMIT 200`;

    const result = await pool.query(query, params);
    const records = result.rows;

    let totalHours = 0;
    let totalQty = 0;
    const machineMap: { [key: string]: { equipmentNumber: string; equipmentType: string; equipmentName: string; hours: number; count: number } } = {};
    const opBreakdown: { [key: string]: number } = { UNLOADING: 0, LOADING: 0, INTERNAL_SHIFT: 0, OTHER: 0 };

    for (const r of records) {
      const hrs = parseFloat(r.durationHours || 0);
      const q = parseFloat(r.quantity || 0);
      totalHours += hrs;
      totalQty += q;

      const op = r.operationType || 'OTHER';
      opBreakdown[op] = (opBreakdown[op] || 0) + hrs;

      const mKey = r.equipmentNumber || r.equipmentId;
      if (!machineMap[mKey]) {
        machineMap[mKey] = {
          equipmentNumber: r.equipmentNumber,
          equipmentType: r.equipmentType,
          equipmentName: r.equipmentName || r.equipmentNumber,
          hours: 0,
          count: 0
        };
      }
      machineMap[mKey].hours += hrs;
      machineMap[mKey].count += 1;
    }

    const machineHours = Object.values(machineMap).map(m => ({
      ...m,
      hours: parseFloat(m.hours.toFixed(2))
    }));

    res.json({
      records,
      summary: {
        totalHours: parseFloat(totalHours.toFixed(2)),
        totalOperations: records.length,
        totalQuantity: parseFloat(totalQty.toFixed(2)),
        activeMachinesCount: Object.keys(machineMap).length,
        machineHours,
        operationBreakdown: {
          UNLOADING: parseFloat((opBreakdown.UNLOADING || 0).toFixed(2)),
          LOADING: parseFloat((opBreakdown.LOADING || 0).toFixed(2)),
          INTERNAL_SHIFT: parseFloat((opBreakdown.INTERNAL_SHIFT || 0).toFixed(2)),
          OTHER: parseFloat((opBreakdown.OTHER || 0).toFixed(2))
        }
      }
    });
  } catch (err: any) {
    console.error('[GET /api/tenant/stockyards/:id/equipment-utilization] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Manual / Standalone Stockyard Equipment Activity Logging
router.post('/api/tenant/stockyards/:id/equipment-utilization', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      projectId, projectName, equipmentId, equipmentNumber, equipmentName, equipmentType,
      operationType = 'OTHER', materialName, quantity = 0, unit = 'MT',
      sourceRackId, sourceRackName, destinationRackId, destinationRackName,
      startTime, endTime, durationHours,
      operatorName, operatorPhone, remarks, recordedBy
    } = req.body;

    if (!equipmentId && !equipmentNumber) {
      return res.status(400).json({ error: 'Equipment selection is required.' });
    }

    const yardRes = await pool.query('SELECT tenant_id, yard_name FROM tenant_stockyards WHERE id = $1', [id]);
    if (yardRes.rows.length === 0) return res.status(404).json({ error: 'Stockyard not found' });
    const tenantId = yardRes.rows[0].tenant_id;

    // Check equipment status in master (prevent maintenance assignment)
    const eqCheck = await pool.query(`
      SELECT status, equipment_number, equipment_type, make, model, assigned_operator_name, assigned_operator_phone
      FROM tenant_heavy_equipment
      WHERE (equipment_id = $1 OR equipment_number = $1) AND tenant_id::text = $2::text
    `, [equipmentId || equipmentNumber, String(tenantId)]);

    if (eqCheck.rows.length > 0 && eqCheck.rows[0].status === 'Under Maintenance') {
      return res.status(400).json({
        error: `Cannot assign equipment: Machine ${eqCheck.rows[0].equipment_number} is currently Under Maintenance.`
      });
    }

    const sTime = startTime ? new Date(startTime) : new Date();
    const eTime = endTime ? new Date(endTime) : new Date(Date.now() + 3600000);
    let dur = parseFloat(durationHours);
    if (isNaN(dur) || dur <= 0) {
      dur = Math.max(0.1, parseFloat(((eTime.getTime() - sTime.getTime()) / (1000 * 60 * 60)).toFixed(2)));
    }

    const insertRes = await pool.query(`
      INSERT INTO tenant_stockyard_equipment_utilization (
        tenant_id, stockyard_id, stockyard_name, project_id, project_name,
        equipment_id, equipment_number, equipment_name, equipment_type,
        operation_type, material_name, quantity, unit,
        source_rack_id, source_rack_name, destination_rack_id, destination_rack_name,
        start_time, end_time, duration_hours,
        operator_name, operator_phone, status, remarks, recorded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, 'Completed', $23, $24)
      RETURNING *
    `, [
      String(tenantId), id, yardRes.rows[0].yard_name, projectId || '', projectName || '',
      equipmentId || equipmentNumber, equipmentNumber || equipmentId,
      equipmentName || eqCheck.rows[0]?.make || 'Heavy Machinery',
      equipmentType || eqCheck.rows[0]?.equipment_type || 'Loader',
      operationType, materialName || 'Aggregates', parseFloat(quantity) || 0, unit || 'MT',
      sourceRackId ? parseInt(sourceRackId, 10) : null, sourceRackName || '',
      destinationRackId ? parseInt(destinationRackId, 10) : null, destinationRackName || '',
      sTime, eTime, dur,
      operatorName || eqCheck.rows[0]?.assigned_operator_name || '',
      operatorPhone || eqCheck.rows[0]?.assigned_operator_phone || '',
      remarks || 'Stockyard equipment activity logged',
      recordedBy || 'Stockyard Manager'
    ]);

    // Update hour meter in master heavy equipment
    await pool.query(`
      UPDATE tenant_heavy_equipment
      SET hour_meter_reading = COALESCE(hour_meter_reading, 0) + $1, updated_at = CURRENT_TIMESTAMP
      WHERE (equipment_id = $2 OR equipment_number = $2) AND tenant_id::text = $3::text
    `, [dur, equipmentId || equipmentNumber, String(tenantId)]);

    res.status(201).json({
      message: 'Equipment utilization logged successfully',
      record: insertRes.rows[0]
    });
  } catch (err: any) {
    console.error('[POST /api/tenant/stockyards/:id/equipment-utilization] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT Update / Correct Equipment Utilization Record (Preserves audit integrity)
router.put('/api/tenant/stockyards/equipment-utilization/:utilId', async (req, res) => {
  try {
    const { utilId } = req.params;
    const {
      startTime, endTime, durationHours, operatorName, operatorPhone, status, remarks
    } = req.body;

    const existing = await pool.query('SELECT * FROM tenant_stockyard_equipment_utilization WHERE id = $1', [utilId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Utilization record not found' });

    let dur = parseFloat(durationHours);
    if (isNaN(dur) || dur <= 0) {
      if (startTime && endTime) {
        dur = Math.max(0.1, parseFloat(((new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60)).toFixed(2)));
      } else {
        dur = existing.rows[0].duration_hours;
      }
    }

    const updateRes = await pool.query(`
      UPDATE tenant_stockyard_equipment_utilization
      SET 
        start_time = COALESCE($1, start_time),
        end_time = COALESCE($2, end_time),
        duration_hours = $3,
        operator_name = COALESCE($4, operator_name),
        operator_phone = COALESCE($5, operator_phone),
        status = COALESCE($6, status),
        remarks = COALESCE($7, remarks),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [
      startTime ? new Date(startTime) : null,
      endTime ? new Date(endTime) : null,
      dur,
      operatorName,
      operatorPhone,
      status,
      remarks,
      utilId
    ]);

    res.json({ message: 'Equipment utilization updated', record: updateRes.rows[0] });
  } catch (err: any) {
    console.error('[PUT /api/tenant/stockyards/equipment-utilization/:utilId] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Cancel / Remove Utilization Record
router.delete('/api/tenant/stockyards/equipment-utilization/:utilId', async (req, res) => {
  try {
    const { utilId } = req.params;
    const delRes = await pool.query('DELETE FROM tenant_stockyard_equipment_utilization WHERE id = $1 RETURNING *', [utilId]);
    if (delRes.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    res.json({ message: 'Equipment utilization record deleted successfully' });
  } catch (err: any) {
    console.error('[DELETE /api/tenant/stockyards/equipment-utilization/:utilId] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Equipment Utilization for a Specific Project Across All Stockyards
router.get('/api/tenant/projects/:id/equipment-utilization', async (req, res) => {
  try {
    const { id } = req.params;
    const { stockyardId, equipmentType, equipmentId, operationType, startDate, endDate } = req.query;

    let query = `
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
      WHERE (u.project_id = $1 OR u.project_name ILIKE $2)
    `;
    const params: any[] = [id, `%${id}%`];

    if (stockyardId && stockyardId !== 'ALL') {
      params.push(stockyardId);
      query += ` AND u.stockyard_id = $${params.length}`;
    }
    if (equipmentType && equipmentType !== 'ALL') {
      params.push(equipmentType);
      query += ` AND u.equipment_type = $${params.length}`;
    }
    if (equipmentId && equipmentId !== 'ALL') {
      params.push(equipmentId);
      query += ` AND (u.equipment_id = $${params.length} OR u.equipment_number = $${params.length})`;
    }
    if (operationType && operationType !== 'ALL') {
      params.push(operationType);
      query += ` AND u.operation_type = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      query += ` AND u.start_time >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND u.end_time <= $${params.length}`;
    }

    query += ` ORDER BY u.start_time DESC LIMIT 200`;

    const result = await pool.query(query, params);
    const records = result.rows;

    let totalHours = 0;
    let totalQty = 0;
    const distinctMachines = new Set();
    const opBreakdown: { [key: string]: number } = { UNLOADING: 0, LOADING: 0, INTERNAL_SHIFT: 0, OTHER: 0 };

    for (const r of records) {
      const hrs = parseFloat(r.durationHours || 0);
      totalHours += hrs;
      totalQty += parseFloat(r.quantity || 0);
      distinctMachines.add(r.equipmentNumber || r.equipmentId);
      const op = r.operationType || 'OTHER';
      opBreakdown[op] = (opBreakdown[op] || 0) + hrs;
    }

    res.json({
      records,
      summary: {
        totalHours: parseFloat(totalHours.toFixed(2)),
        totalOperations: records.length,
        totalQuantity: parseFloat(totalQty.toFixed(2)),
        distinctEquipmentCount: distinctMachines.size,
        operationBreakdown: {
          UNLOADING: parseFloat((opBreakdown.UNLOADING || 0).toFixed(2)),
          LOADING: parseFloat((opBreakdown.LOADING || 0).toFixed(2)),
          INTERNAL_SHIFT: parseFloat((opBreakdown.INTERNAL_SHIFT || 0).toFixed(2)),
          OTHER: parseFloat((opBreakdown.OTHER || 0).toFixed(2))
        }
      }
    });
  } catch (err: any) {
    console.error('[GET /api/tenant/projects/:id/equipment-utilization] Error:', err);
    res.status(500).json({ error: err.message });
  }
});
router.get('/api/tenant/stockyards/:id/projects/:projectId', async (req, res) => {
  try {
    const { id, projectId } = req.params;

    // 1. Fetch Project Info
    const projRes = await pool.query(
      'SELECT id, project_id as "projectId", name, customer, commodity, location, contract_quantity as "contractQuantity", contract_quantity_unit as "contractQuantityUnit", contract_start_date as "startDate", contract_end_date as "endDate" FROM tenant_projects WHERE project_id = $1 OR id::text = $1 LIMIT 1',
      [projectId]
    );
    const projectInfo = projRes.rows[0] || { projectId, name: projectId };

    // 2. Fetch Aggregated Materials for this Project in this Yard
    const matRes = await pool.query(`
      SELECT 
        COALESCE(material_name, 'General Material') as "materialName",
        COALESCE(unit, 'MT') as "unit",
        SUM(CASE WHEN transaction_type = 'INWARD' THEN quantity ELSE 0 END)::NUMERIC as "totalReceived",
        SUM(CASE WHEN transaction_type = 'OUTWARD' THEN quantity ELSE 0 END)::NUMERIC as "totalIssued",
        SUM(CASE WHEN transaction_type = 'LOSS' THEN quantity ELSE 0 END)::NUMERIC as "totalLoss",
        SUM(CASE WHEN transaction_type = 'ADJUSTMENT' THEN quantity ELSE 0 END)::NUMERIC as "totalAdjustment",
        SUM(CASE 
          WHEN transaction_type = 'INWARD' THEN quantity 
          WHEN transaction_type = 'OUTWARD' THEN -quantity 
          WHEN transaction_type = 'LOSS' THEN -quantity 
          WHEN transaction_type = 'ADJUSTMENT' THEN quantity 
          ELSE 0 
        END)::NUMERIC as "currentAvailable",
        COUNT(id)::INTEGER as "movementCount",
        MAX(created_at) as "lastActivityDate"
      FROM tenant_stockyard_transactions
      WHERE stockyard_id = $1 AND (project_id = $2 OR project_name ILIKE $2)
      GROUP BY COALESCE(material_name, 'General Material'), COALESCE(unit, 'MT')
      ORDER BY "currentAvailable" DESC
    `, [id, projectId]);

    // 3. Fetch Inward Deliveries for this Project
    const inwardRes = await pool.query(`
      SELECT 
        id, vehicle_number as "vehicleNumber", driver_name as "driverName", driver_phone as "driverPhone",
        material_name as "materialName", quantity, unit, gross_weight as "grossWeight",
        tare_weight as "tareWeight", net_weight as "netWeight", discrepancy_quantity as "discrepancyQuantity",
        waybill_number as "waybillNumber", weighbridge_slip_number as "weighbridgeSlipNumber",
        source_location as "sourceLocation", supplier_name as "supplierName",
        challan_number as "challanNumber", moisture_pct as "moisturePct",
        quality_grade as "qualityGrade", transport_mode as "transportMode",
        grn_number as "grnNumber",
        COALESCE(gate_in_time, created_at) as "gateInTime",
        COALESCE(gate_out_time, created_at + interval '25 minutes') as "gateOutTime",
        COALESCE(dwell_minutes, 25) as "dwellMinutes",
        COALESCE(rack_name, 'Open Storage Area') as "rackName",
        remarks, recorded_by as "recordedBy",
        created_at as "createdAt"
      FROM tenant_stockyard_transactions
      WHERE stockyard_id = $1 AND (project_id = $2 OR project_name ILIKE $2) AND transaction_type = 'INWARD'
      ORDER BY created_at DESC
      LIMIT 100
    `, [id, projectId]);

    // 4. Fetch Outward Issues for this Project
    const outwardRes = await pool.query(`
      SELECT 
        id, vehicle_number as "vehicleNumber", driver_name as "driverName", driver_phone as "driverPhone",
        material_name as "materialName", quantity, unit,
        destination_location as "destinationLocation", waybill_number as "waybillNumber",
        weighbridge_slip_number as "weighbridgeSlipNumber",
        COALESCE(rack_name, 'Open Storage Area') as "rackName",
        remarks, recorded_by as "recordedBy",
        created_at as "createdAt"
      FROM tenant_stockyard_transactions
      WHERE stockyard_id = $1 AND (project_id = $2 OR project_name ILIKE $2) AND transaction_type = 'OUTWARD'
      ORDER BY created_at DESC
      LIMIT 100
    `, [id, projectId]);

    // 5. Fetch Reconciliations & Losses for this Project
    const adjustRes = await pool.query(`
      SELECT 
        id, transaction_type as "transactionType", material_name as "materialName",
        quantity, unit, remarks, recorded_by as "recordedBy", created_at as "createdAt"
      FROM tenant_stockyard_transactions
      WHERE stockyard_id = $1 AND (project_id = $2 OR project_name ILIKE $2) AND transaction_type IN ('LOSS', 'ADJUSTMENT')
      ORDER BY created_at DESC
      LIMIT 100
    `, [id, projectId]);

    // 6. Fetch Internal Shifts for this Project
    const shiftsRes = await pool.query(`
      SELECT 
        id, shift_id as "shiftId", material_name as "materialName",
        quantity, unit, rack_name as "sourceLocation", destination_rack_name as "destinationLocation",
        remarks, recorded_by as "recordedBy", created_at as "createdAt"
      FROM tenant_stockyard_transactions
      WHERE stockyard_id = $1 AND (project_id = $2 OR project_name ILIKE $2) AND transaction_type = 'INTERNAL_SHIFT'
      ORDER BY created_at DESC
      LIMIT 100
    `, [id, projectId]);

    // Overall metrics for this project
    const totalReceived = matRes.rows.reduce((a, b) => a + parseFloat(b.totalReceived || 0), 0);
    const totalIssued = matRes.rows.reduce((a, b) => a + parseFloat(b.totalIssued || 0), 0);
    const totalLoss = matRes.rows.reduce((a, b) => a + parseFloat(b.totalLoss || 0), 0);
    const currentAvailable = matRes.rows.reduce((a, b) => a + parseFloat(b.currentAvailable || 0), 0);

    res.json({
      project: projectInfo,
      metrics: {
        totalReceived,
        totalIssued,
        totalLoss,
        currentAvailable,
        inwardCount: inwardRes.rows.length,
        outwardCount: outwardRes.rows.length,
        shiftCount: shiftsRes.rows.length
      },
      materials: matRes.rows,
      inwardReceipts: inwardRes.rows,
      outwardDispatches: outwardRes.rows,
      adjustments: adjustRes.rows,
      shifts: shiftsRes.rows
    });
  } catch (err: any) {
    console.error('[GET /api/tenant/stockyards/:id/projects/:projectId] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Record Material Issue From Stockyard (OUTWARD - with Negative Balance Check)
router.post('/api/tenant/stockyards/:id/issue', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      projectId, projectName, materialName, unit = 'MT',
      quantity, vehicleNumber, driverName, driverPhone,
      destinationLocation, waybillNumber, weighbridgeSlipNumber,
      grossWeight, tareWeight, remarks, recordedBy,
      rackId, rackName
    } = req.body;

    if (!projectId) return res.status(400).json({ error: 'Project is required for issuing material.' });
    if (!materialName || !materialName.trim()) return res.status(400).json({ error: 'Material name is required.' });
    const issueQty = parseFloat(quantity);
    if (!issueQty || issueQty <= 0) return res.status(400).json({ error: 'Valid issue quantity is required.' });
    if (!vehicleNumber || !vehicleNumber.trim()) return res.status(400).json({ error: 'Vehicle number is required.' });

    // Validate stockyard existence
    const yardRes = await pool.query('SELECT tenant_id, yard_name FROM tenant_stockyards WHERE id = $1', [id]);
    if (yardRes.rows.length === 0) return res.status(404).json({ error: 'Stockyard not found' });
    const tenantId = yardRes.rows[0].tenant_id;

    // Check Project-Specific Stock in this stockyard (NEVER mix projects)
    const availRes = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE 
          WHEN transaction_type = 'INWARD' THEN quantity 
          WHEN transaction_type = 'OUTWARD' THEN -quantity 
          WHEN transaction_type = 'LOSS' THEN -quantity 
          WHEN transaction_type = 'ADJUSTMENT' THEN quantity 
          ELSE 0 
        END), 0) as available
      FROM tenant_stockyard_transactions
      WHERE stockyard_id = $1 AND project_id = $2 AND LOWER(material_name) = LOWER($3)
    `, [id, projectId, materialName.trim()]);

    let availableStock = parseFloat(availRes.rows[0]?.available || '0');

    // If no direct transaction found but stockyard has piles with stock, check if pile matches
    if (availableStock <= 0) {
      const pileRes = await pool.query(`
        SELECT COALESCE(SUM(current_quantity), 0) as pile_qty
        FROM tenant_stockyard_piles
        WHERE stockyard_id = $1 AND LOWER(material_name) = LOWER($2)
      `, [id, materialName.trim()]);
      const pileQty = parseFloat(pileRes.rows[0]?.pile_qty || '0');
      if (pileQty > 0) availableStock = pileQty;
    }

    if (issueQty > availableStock) {
      return res.status(400).json({
        error: `Insufficient project stock: Project "${projectName || projectId}" only has ${availableStock.toFixed(2)} ${unit} of "${materialName}" available in this stockyard. Cannot issue ${issueQty.toFixed(2)} ${unit}.`
      });
    }

    // Insert atomic OUTWARD transaction
    const txInsert = await pool.query(`
      INSERT INTO tenant_stockyard_transactions (
        tenant_id, stockyard_id, transaction_type, quantity, unit,
        material_name, project_id, project_name, vehicle_number,
        driver_name, driver_phone, waybill_number, weighbridge_slip_number,
        gross_weight, tare_weight, net_weight, destination_location,
        remarks, recorded_by, rack_id, rack_name
      ) VALUES ($1, $2, 'OUTWARD', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [
      tenantId, id, issueQty, unit,
      materialName.trim(), projectId, projectName || projectId, vehicleNumber.trim().toUpperCase(),
      driverName || '', driverPhone || '', waybillNumber || '', weighbridgeSlipNumber || '',
      parseFloat(grossWeight) || null, parseFloat(tareWeight) || null, issueQty, destinationLocation || '',
      remarks || '', recordedBy || 'Gate Operator',
      rackId ? parseInt(rackId, 10) : null, rackName || null
    ]);

    // Deduct occupancy
    await pool.query(`
      UPDATE tenant_stockyards 
      SET current_occupancy_tons = GREATEST(0, COALESCE(current_occupancy_tons, 0) - $1), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [issueQty, id]);

    // Insert linked equipment utilization records if equipmentUsed is provided (Loading)
    const equipmentList = Array.isArray(req.body.equipmentUsed)
      ? req.body.equipmentUsed
      : (req.body.equipmentUsed ? [req.body.equipmentUsed] : []);

    const createdEquipments = [];
    for (const eq of equipmentList) {
      if (!eq.equipmentId && !eq.equipmentNumber) continue;
      const sTime = eq.startTime ? new Date(eq.startTime) : new Date();
      const eTime = eq.endTime ? new Date(eq.endTime) : new Date(Date.now() + 3600000);
      let durationHours = parseFloat(eq.durationHours);
      if (isNaN(durationHours) || durationHours <= 0) {
        durationHours = Math.max(0.1, parseFloat(((eTime.getTime() - sTime.getTime()) / (1000 * 60 * 60)).toFixed(2)));
      }

      const eqUtilRes = await pool.query(`
        INSERT INTO tenant_stockyard_equipment_utilization (
          tenant_id, stockyard_id, stockyard_name, project_id, project_name,
          transaction_id, shift_id, equipment_id, equipment_number, equipment_name,
          equipment_type, operation_type, material_name, quantity, unit,
          source_rack_id, source_rack_name, destination_rack_id, destination_rack_name,
          start_time, end_time, duration_hours,
          operator_name, operator_phone, status, remarks, recorded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
        RETURNING *
      `, [
        String(tenantId), id, yardRes.rows[0]?.yard_name || 'Stockyard', projectId, projectName || projectId,
        txInsert.rows[0].id, waybillNumber || `DISP-${txInsert.rows[0].id}`, eq.equipmentId || eq.equipmentNumber, eq.equipmentNumber || eq.equipmentId,
        eq.equipmentName || eq.make || eq.equipmentType || 'Heavy Equipment',
        eq.equipmentType || 'Hydraulic Excavator', 'LOADING', materialName.trim(), issueQty, unit,
        rackId ? parseInt(rackId, 10) : null, rackName || 'Stockyard Bay', null, destinationLocation || 'Outward Hauler',
        sTime, eTime, durationHours,
        eq.operatorName || '', eq.operatorPhone || '', 'Completed',
        eq.remarks || remarks || `Loading operation for dispatch ${vehicleNumber}`,
        recordedBy || 'Gate Operator'
      ]);
      createdEquipments.push(eqUtilRes.rows[0]);

      if (durationHours > 0 && (eq.equipmentId || eq.equipmentNumber)) {
        await pool.query(`
          UPDATE tenant_heavy_equipment
          SET hour_meter_reading = COALESCE(hour_meter_reading, 0) + $1, updated_at = CURRENT_TIMESTAMP
          WHERE (equipment_id = $2 OR equipment_number = $2) AND tenant_id::text = $3::text
        `, [durationHours, eq.equipmentId || eq.equipmentNumber, String(tenantId)]);
      }
    }

    res.status(201).json({
      message: 'Material issued and dispatched successfully',
      transaction: txInsert.rows[0],
      equipmentUtilization: createdEquipments
    });
  } catch (err: any) {
    console.error('[POST /api/tenant/stockyards/:id/issue] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Record Wastage, Loss or Stock Reconciliation Adjustment
router.post('/api/tenant/stockyards/:id/adjust', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      projectId, projectName, materialName, unit = 'MT',
      adjustmentType = 'LOSS', // 'LOSS' | 'ADJUSTMENT'
      quantity, reason, physicalStock, bookStock, variance, recordedBy
    } = req.body;

    if (!projectId) return res.status(400).json({ error: 'Project is required.' });
    if (!materialName || !materialName.trim()) return res.status(400).json({ error: 'Material name is required.' });
    const adjQty = parseFloat(quantity);
    if (!adjQty || adjQty <= 0) return res.status(400).json({ error: 'Valid quantity is required.' });
    if (!reason || !reason.trim()) return res.status(400).json({ error: 'A mandatory audit reason is required for wastage or reconciliation adjustments.' });

    const yardRes = await pool.query('SELECT tenant_id FROM tenant_stockyards WHERE id = $1', [id]);
    if (yardRes.rows.length === 0) return res.status(404).json({ error: 'Stockyard not found' });
    const tenantId = yardRes.rows[0].tenant_id;

    const txType = adjustmentType.toUpperCase() === 'ADJUSTMENT' ? 'ADJUSTMENT' : 'LOSS';
    const auditRemark = `[${txType}] ${reason.trim()}${variance ? ` (Physical: ${physicalStock}, Book: ${bookStock}, Var: ${variance})` : ''}`;

    const txInsert = await pool.query(`
      INSERT INTO tenant_stockyard_transactions (
        tenant_id, stockyard_id, transaction_type, quantity, unit,
        material_name, project_id, project_name, remarks, recorded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      tenantId, id, adjQty, unit,
      materialName.trim(), projectId, projectName || projectId, auditRemark, recordedBy || 'Stock Auditor'
    ]);

    // Adjust occupancy if loss
    if (txType === 'LOSS') {
      await pool.query(`
        UPDATE tenant_stockyards 
        SET current_occupancy_tons = GREATEST(0, COALESCE(current_occupancy_tons, 0) - $1), updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [adjQty, id]);
    }

    res.status(201).json({
      message: `Stock ${txType === 'LOSS' ? 'wastage/loss' : 'adjustment'} recorded successfully`,
      transaction: txInsert.rows[0]
    });
  } catch (err: any) {
    console.error('[POST /api/tenant/stockyards/:id/adjust] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Stockyard Transactions (Inward / Outward ledger with complete filters)
router.get('/api/tenant/stockyard-transactions', async (req, res) => {
  try {
    const { projectId, stockyardId, transactionType, type, search, q } = req.query as any;
    let query = `
      SELECT 
        t.id,
        t.tenant_id as "tenantId",
        t.stockyard_id as "stockyardId",
        y.yard_name as "yardName",
        y.yard_code as "yardCode",
        t.pile_id as "pileId",
        COALESCE(t.material_name, p.material_name, 'General Material') as "materialName",
        COALESCE(p.grade, '') as "grade",
        COALESCE(t.unit, p.unit_of_measure, 'MT') as "unit",
        t.transaction_type as "transactionType",
        t.quantity,
        t.project_id as "projectId",
        t.project_name as "projectName",
        t.vehicle_number as "vehicleNumber",
        t.driver_name as "driverName",
        t.driver_phone as "driverPhone",
        t.waybill_number as "waybillNumber",
        t.weighbridge_slip_number as "weighbridgeSlipNumber",
        t.gross_weight as "grossWeight",
        t.tare_weight as "tareWeight",
        t.net_weight as "netWeight",
        t.source_location as "sourceLocation",
        t.destination_location as "destinationLocation",
        t.discrepancy_quantity as "discrepancyQuantity",
        t.transport_mode as "transportMode",
        t.supplier_name as "supplierName",
        t.challan_number as "challanNumber",
        t.moisture_pct as "moisturePct",
        t.quality_grade as "qualityGrade",
        t.grn_number as "grnNumber",
        t.rack_id as "rackId",
        t.rack_name as "rackName",
        t.destination_rack_name as "destinationRackName",
        t.shift_id as "shiftId",
        t.gate_in_time as "gateInTime",
        t.gate_out_time as "gateOutTime",
        t.dwell_minutes as "dwellMinutes",
        t.recorded_by as "recordedBy",
        t.remarks,
        t.created_at as "createdAt"
      FROM tenant_stockyard_transactions t
      LEFT JOIN tenant_stockyards y ON t.stockyard_id = y.id
      LEFT JOIN tenant_stockyard_piles p ON t.pile_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (projectId && projectId !== 'ALL') {
      params.push(projectId);
      query += ` AND (t.project_id = $${params.length} OR t.project_name ILIKE $${params.length})`;
    }
    if (stockyardId && stockyardId !== 'ALL') {
      params.push(stockyardId);
      query += ` AND t.stockyard_id = $${params.length}`;
    }
    const targetType = transactionType || type;
    if (targetType && targetType !== 'ALL') {
      params.push(targetType.toUpperCase());
      query += ` AND UPPER(t.transaction_type) = $${params.length}`;
    }
    const searchTerm = search || q;
    if (searchTerm && searchTerm.trim()) {
      params.push(`%${searchTerm.trim()}%`);
      query += ` AND (
        t.material_name ILIKE $${params.length} OR
        t.vehicle_number ILIKE $${params.length} OR
        t.driver_name ILIKE $${params.length} OR
        t.waybill_number ILIKE $${params.length} OR
        t.weighbridge_slip_number ILIKE $${params.length} OR
        t.project_name ILIKE $${params.length} OR
        y.yard_name ILIKE $${params.length}
      )`;
    }
    query += ' ORDER BY t.created_at DESC LIMIT 200';

    const txRes = await pool.query(query, params);
    res.json(txRes.rows);
  } catch (err: any) {
    console.error('[GET /api/tenant/stockyard-transactions] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Fast Tare Scale & Gate-Out Clearance for Vehicle on Stockyard Weighbridge
router.post('/api/tenant/stockyards/:id/checkout-truck/:txId', async (req, res) => {
  try {
    const { id, txId } = req.params;
    const { tareWeight, remarks, recordedBy } = req.body;

    const txRes = await pool.query('SELECT * FROM tenant_stockyard_transactions WHERE id = $1 AND stockyard_id = $2', [txId, id]);
    if (txRes.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle transaction record not found' });
    }
    const tx = txRes.rows[0];

    const gross = parseFloat(tx.gross_weight) || 0;
    const tare = parseFloat(tareWeight) || 0;
    let net = parseFloat(tx.net_weight) || 0;
    if (gross > 0 && tare > 0 && gross > tare) {
      net = parseFloat((gross - tare).toFixed(2));
    }

    const updateRes = await pool.query(`
      UPDATE tenant_stockyard_transactions
      SET tare_weight = CASE WHEN $1::NUMERIC > 0 THEN $1::NUMERIC ELSE tare_weight END,
          net_weight = CASE WHEN $2::NUMERIC > 0 THEN $2::NUMERIC ELSE net_weight END,
          quantity = CASE WHEN $2::NUMERIC > 0 THEN $2::NUMERIC ELSE quantity END,
          gate_out_time = CURRENT_TIMESTAMP,
          dwell_minutes = GREATEST(12, ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(gate_in_time, created_at))) / 60)::INTEGER),
          remarks = CASE 
            WHEN $3 IS NOT NULL AND $3 <> '' THEN COALESCE(remarks, '') || ' | ' || $3
            ELSE remarks 
          END,
          recorded_by = COALESCE($4, recorded_by)
      WHERE id = $5 AND stockyard_id = $6
      RETURNING *
    `, [tare > 0 ? tare : null, net > 0 ? net : null, remarks || null, recordedBy || 'Weighbridge Operator', txId, id]);

    res.json({
      message: 'Vehicle tare weighed and gate-out cleared successfully',
      transaction: updateRes.rows[0]
    });
  } catch (err: any) {
    console.error('[POST checkout-truck] Error:', err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
