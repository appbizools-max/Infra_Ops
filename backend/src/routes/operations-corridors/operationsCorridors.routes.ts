import { Router } from 'express';
import { pool } from '../../config/db';

const router = Router();

// ====================================================================
// 🗺️ OPERATIONS CORRIDORS & SKETCH BLUEPRINTS
// ====================================================================

// GET all Operations Corridors
router.get('/api/tenant/operations-corridors', async (req, res) => {
  try {
    const { projectId } = req.query;
    let query = `
      SELECT 
        c.id,
        c.tenant_id as "tenantId",
        c.corridor_code as "corridorCode",
        c.name,
        c.project_id as "projectId",
        c.project_name as "projectName",
        c.project_head as "projectHead",
        c.site_manager as "siteManager",
        c.topology_type as "topologyType",
        c.description,
        c.origin_summary as "originSummary",
        c.destination_summary as "destinationSummary",
        c.transshipment_hub as "transshipmentHub",
        c.total_distance_km as "totalDistanceKm",
        c.estimated_cycle_time_hours as "estimatedCycleTimeHours",
        c.status,
        c.created_at as "createdAt",
        COUNT(DISTINCT l.id) as "legsCount",
        COUNT(DISTINCT a.id) as "assetsCount"
      FROM tenant_operations_corridors c
      LEFT JOIN tenant_corridor_legs l ON c.id = l.corridor_id
      LEFT JOIN tenant_corridor_assets a ON c.id = a.corridor_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (projectId) {
      params.push(projectId);
      query += ` AND (c.project_id = $${params.length} OR c.project_name ILIKE $${params.length})`;
    }
    query += ` GROUP BY c.id ORDER BY c.id DESC`;

    const cRes = await pool.query(query, params);
    res.json(cRes.rows);
  } catch (err: any) {
    console.error('[GET /api/tenant/operations-corridors] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Single Corridor with all Legs and Assets
router.get('/api/tenant/operations-corridors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cRes = await pool.query(`
      SELECT 
        id,
        tenant_id as "tenantId",
        corridor_code as "corridorCode",
        name,
        project_id as "projectId",
        project_name as "projectName",
        project_head as "projectHead",
        site_manager as "siteManager",
        topology_type as "topologyType",
        description,
        origin_summary as "originSummary",
        destination_summary as "destinationSummary",
        transshipment_hub as "transshipmentHub",
        total_distance_km as "totalDistanceKm",
        estimated_cycle_time_hours as "estimatedCycleTimeHours",
        status,
        created_at as "createdAt"
      FROM tenant_operations_corridors
      WHERE id = $1
    `, [id]);

    if (cRes.rows.length === 0) return res.status(404).json({ error: 'Corridor not found' });
    const corridor = cRes.rows[0];

    // Fetch Legs
    const legsRes = await pool.query(`
      SELECT 
        id,
        corridor_id as "corridorId",
        leg_sequence as "legSequence",
        leg_name as "legName",
        origin_name as "originName",
        origin_type as "originType",
        destination_name as "destinationName",
        destination_type as "destinationType",
        transport_mode as "transportMode",
        distance_km as "distanceKm",
        estimated_tat_hours as "estimatedTatHours",
        transshipment_required as "transshipmentRequired",
        lead_transporter as "leadTransporter",
        allowed_shrinkage_percent as "allowedShrinkagePercent",
        notes
      FROM tenant_corridor_legs
      WHERE corridor_id = $1
      ORDER BY leg_sequence ASC, id ASC
    `, [id]);

    // Fetch Assets bound to this corridor
    const assetsRes = await pool.query(`
      SELECT 
        id,
        corridor_id as "corridorId",
        leg_id as "legId",
        asset_type as "assetType",
        asset_id as "assetId",
        asset_number as "assetNumber",
        asset_title as "assetTitle",
        assigned_person_name as "assignedPersonName",
        assigned_person_phone as "assignedPersonPhone",
        assigned_person_role as "assignedPersonRole",
        shift,
        operating_status as "operatingStatus",
        notes
      FROM tenant_corridor_assets
      WHERE corridor_id = $1
      ORDER BY id ASC
    `, [id]);

    res.json({
      ...corridor,
      legs: legsRes.rows,
      assets: assetsRes.rows
    });
  } catch (err: any) {
    console.error('[GET /api/tenant/operations-corridors/:id] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Create Operations Corridor Blueprint with Legs, Leadership & Fleet
router.post('/api/tenant/operations-corridors', async (req, res) => {
  try {
    const {
      firebaseUid, corridorCode, name, projectId, projectName,
      projectHead, siteManager,
      topologyType, description, originSummary, destinationSummary,
      transshipmentHub, totalDistanceKm, estimatedCycleTimeHours,
      legs, assets, stops, stockyardStops
    } = req.body;

    let tenantId = 1;
    if (firebaseUid) {
      const aRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [firebaseUid]);
      if (aRes.rows.length > 0) tenantId = aRes.rows[0].tenant_id;
    }

    const stopsDataJson = JSON.stringify(stops || []);

    const cInsert = await pool.query(`
      INSERT INTO tenant_operations_corridors (
        tenant_id, corridor_code, name, project_id, project_name,
        project_head, site_manager,
        topology_type, description, origin_summary, destination_summary,
        transshipment_hub, total_distance_km, estimated_cycle_time_hours, stops_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, corridor_code as "corridorCode", name, project_id as "projectId", project_name as "projectName", project_head as "projectHead", site_manager as "siteManager"
    `, [
      tenantId, corridorCode || `CORR-${Date.now().toString().slice(-4)}`,
      name, projectId, projectName || 'Infrastructure Project',
      projectHead || '', siteManager || '',
      topologyType || 'RELAY_MULTIMODAL', description || '',
      originSummary || '', destinationSummary || '',
      transshipmentHub || '', totalDistanceKm || 0, estimatedCycleTimeHours || 0,
      stopsDataJson
    ]);

    const newCorridorId = cInsert.rows[0].id;
    const insertedLegIds: number[] = [];

    // Insert Legs if provided
    if (Array.isArray(legs) && legs.length > 0) {
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        const legRes = await pool.query(`
          INSERT INTO tenant_corridor_legs (
            tenant_id, corridor_id, leg_sequence, leg_name, origin_name,
            origin_type, destination_name, destination_type, transport_mode,
            distance_km, estimated_tat_hours, transshipment_required, lead_transporter,
            is_stockyard, stockyard_id, stockyard_code, stockyard_location, division_name,
            planned_material, planned_quantity, planned_unit
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          RETURNING id
        `, [
          tenantId, newCorridorId, leg.legSequence || (i + 1),
          leg.legName || `Leg ${i + 1}`, leg.originName,
          leg.originType || 'Loading Pit', leg.destinationName,
          leg.destinationType || 'Delivery Site', leg.transportMode || 'Road',
          leg.distanceKm || 0, leg.estimatedTatHours || 0,
          leg.transshipmentRequired !== undefined ? leg.transshipmentRequired : false,
          leg.leadTransporter || '',
          leg.isStockyard || false,
          leg.stockyardId || null,
          leg.stockyardCode || null,
          leg.stockyardLocation || null,
          leg.divisionName || null,
          leg.plannedMaterial || null,
          parseFloat(leg.plannedQuantity || 0) || null,
          leg.plannedUnit || 'MT'
        ]);
        insertedLegIds.push(legRes.rows[0].id);
      }
    }

    // Auto-associate Stockyards with Project in tenant_project_stockyards
    const candidateStops: any[] = Array.isArray(stockyardStops) && stockyardStops.length > 0
      ? stockyardStops
      : (Array.isArray(stops) ? stops.filter((s: any) => s.isStockyard || s.stockyardId) : []);

    for (let sIdx = 0; sIdx < candidateStops.length; sIdx++) {
      const s = candidateStops[sIdx];
      const sYardId = parseInt(s.stockyardId, 10);
      if (sYardId && !isNaN(sYardId)) {
        const yCheck = await pool.query('SELECT yard_code, yard_name, location, division_name FROM tenant_stockyards WHERE id = $1', [sYardId]);
        if (yCheck.rows.length > 0) {
          const yInfo = yCheck.rows[0];
          const yardCode = yInfo.yard_code || s.stockyardCode || `YRD-${sYardId}`;
          const yardName = yInfo.yard_name || s.name || `Stockyard ${sYardId}`;

          await pool.query(`
            INSERT INTO tenant_project_stockyards (
              tenant_id, project_id, project_name, stockyard_id, stockyard_code, stockyard_name,
              corridor_id, stop_sequence, planned_material, planned_quantity, planned_unit, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Active')
            ON CONFLICT (tenant_id, project_id, stockyard_id) DO UPDATE SET
              project_name = EXCLUDED.project_name,
              stockyard_code = EXCLUDED.stockyard_code,
              stockyard_name = EXCLUDED.stockyard_name,
              corridor_id = EXCLUDED.corridor_id,
              stop_sequence = EXCLUDED.stop_sequence,
              planned_material = EXCLUDED.planned_material,
              planned_quantity = EXCLUDED.planned_quantity,
              planned_unit = EXCLUDED.planned_unit,
              status = 'Active',
              updated_at = CURRENT_TIMESTAMP
          `, [
            tenantId, projectId, projectName || 'Project',
            sYardId, yardCode, yardName,
            newCorridorId, sIdx + 1,
            s.plannedMaterial || 'Aggregates',
            parseFloat(s.plannedQuantity || 0) || 0,
            s.plannedUnit || 'MT'
          ]);
        }
      }
    }

    // Insert direct assigned fleet / heavy equipment if provided and link to project
    if (Array.isArray(assets) && assets.length > 0) {
      for (const asset of assets) {
        const targetLegId = asset.legIndex !== undefined && insertedLegIds[asset.legIndex]
          ? insertedLegIds[asset.legIndex]
          : (insertedLegIds[0] || null);
        await pool.query(`
          INSERT INTO tenant_corridor_assets (
            tenant_id, corridor_id, leg_id, asset_type, asset_id, asset_number, asset_title,
            assigned_person_name, assigned_person_phone, assigned_person_role,
            shift, operating_status, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          tenantId, newCorridorId, targetLegId,
          asset.assetType || 'vehicle', asset.assetId || asset.assetNumber,
          asset.assetNumber, asset.assetTitle || '',
          asset.assignedPersonName || '', asset.assignedPersonPhone || '',
          asset.assignedPersonRole || 'Driver',
          asset.shift || 'Day Shift', asset.operatingStatus || 'Running',
          asset.notes || ''
        ]);

        // Link vehicle or heavy equipment to this project in master tables
        try {
          if (asset.assetType === 'vehicle') {
            await pool.query(`
              UPDATE tenant_vehicles 
              SET assigned_project_id = $1, assigned_project_name = $2, 
                  assigned_driver_name = COALESCE(NULLIF($3, ''), assigned_driver_name),
                  assigned_driver_phone = COALESCE(NULLIF($4, ''), assigned_driver_phone),
                  status = 'Active'
              WHERE vehicle_number = $5 OR id::text = $6
            `, [projectId, projectName, asset.assignedPersonName, asset.assignedPersonPhone, asset.assetNumber, asset.assetId]);
          } else {
            await pool.query(`
              UPDATE tenant_heavy_equipment 
              SET assigned_project_id = $1, assigned_project_name = $2,
                  assigned_operator_name = COALESCE(NULLIF($3, ''), assigned_operator_name),
                  assigned_operator_phone = COALESCE(NULLIF($4, ''), assigned_operator_phone),
                  status = 'Active'
              WHERE equipment_number = $5 OR id::text = $6
            `, [projectId, projectName, asset.assignedPersonName, asset.assignedPersonPhone, asset.assetNumber, asset.assetId]);
          }
        } catch (fErr: any) {
          console.warn('Could not update vehicle/equipment project assignment:', fErr.message);
        }
      }
    }

    // Optional: Synchronize new transport methods back to the Project & Linked Work Order
    const { syncProjectTransportModes, transportModes } = req.body;
    if (syncProjectTransportModes && transportModes && projectId) {
      try {
        const modesStr = Array.isArray(transportModes) ? transportModes.join(', ') : String(transportModes);
        const prjCheck = await pool.query('SELECT other_data FROM tenant_projects WHERE project_id = $1 OR id::text = $1', [projectId]);
        if (prjCheck.rows.length > 0) {
          let od: any = {};
          try {
            if (typeof prjCheck.rows[0].other_data === 'string') od = JSON.parse(prjCheck.rows[0].other_data);
            else if (prjCheck.rows[0].other_data && typeof prjCheck.rows[0].other_data === 'object') od = prjCheck.rows[0].other_data;
          } catch (_) { od = {}; }
          od.transportModes = modesStr;
          await pool.query(
            'UPDATE tenant_projects SET other_data = $1 WHERE project_id = $2 OR id::text = $2',
            [JSON.stringify(od), projectId]
          );
        }
        await pool.query(
          'UPDATE tenant_work_orders SET transport_modes = $1, updated_at = CURRENT_TIMESTAMP WHERE project_id = $2',
          [modesStr, projectId]
        );
      } catch (syncErr: any) {
        console.warn('Could not sync transport modes to project:', syncErr.message);
      }
    }

    res.status(201).json(cInsert.rows[0]);
  } catch (err: any) {
    console.error('[POST /api/tenant/operations-corridors] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Bind Asset (Vehicle / Heavy Equipment) to a Corridor Leg
router.post('/api/tenant/operations-corridors/:id/assets', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      legId, assetType, assetId, assetNumber, assetTitle,
      assignedPersonName, assignedPersonPhone, assignedPersonRole,
      shift, operatingStatus, notes
    } = req.body;

    const cRes = await pool.query('SELECT tenant_id, project_id, project_name FROM tenant_operations_corridors WHERE id = $1', [id]);
    if (cRes.rows.length === 0) return res.status(404).json({ error: 'Corridor not found' });
    const { tenant_id: tenantId, project_id: pId, project_name: pName } = cRes.rows[0];

    const insertRes = await pool.query(`
      INSERT INTO tenant_corridor_assets (
        tenant_id, corridor_id, leg_id, asset_type, asset_id,
        asset_number, asset_title, assigned_person_name, assigned_person_phone,
        assigned_person_role, shift, operating_status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      tenantId, id, legId || null, assetType || 'vehicle', assetId,
      assetNumber, assetTitle || '', assignedPersonName || '',
      assignedPersonPhone || '', assignedPersonRole || 'Driver',
      shift || 'Day Shift', operatingStatus || 'Running', notes || ''
    ]);

    if (assetType === 'vehicle') {
      await pool.query(`
        UPDATE tenant_vehicles 
        SET assigned_project_id = $1, assigned_project_name = $2, assigned_driver_name = $3, assigned_driver_phone = $4, status = 'Active'
        WHERE vehicle_number = $5 OR id::text = $6
      `, [pId, pName, assignedPersonName, assignedPersonPhone, assetNumber, assetId]);
    } else {
      await pool.query(`
        UPDATE tenant_heavy_equipment 
        SET assigned_project_id = $1, assigned_project_name = $2, assigned_operator_name = $3, assigned_operator_phone = $4, status = 'Active'
        WHERE equipment_number = $5 OR id::text = $6
      `, [pId, pName, assignedPersonName, assignedPersonPhone, assetNumber, assetId]);
    }

    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    console.error('[POST /api/tenant/operations-corridors/:id/assets] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Asset Binding
router.delete('/api/tenant/operations-corridors/:id/assets/:assetBindId', async (req, res) => {
  try {
    const { assetBindId } = req.params;
    const delRes = await pool.query('DELETE FROM tenant_corridor_assets WHERE id = $1 RETURNING *', [assetBindId]);
    if (delRes.rows.length === 0) return res.status(404).json({ error: 'Asset assignment not found' });
    res.json({ message: 'Asset unlinked from corridor successfully' });
  } catch (err: any) {
    console.error('[DELETE corridor asset] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Corridor
router.delete('/api/tenant/operations-corridors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const delRes = await pool.query('DELETE FROM tenant_operations_corridors WHERE id = $1 RETURNING *', [id]);
    if (delRes.rows.length === 0) return res.status(404).json({ error: 'Corridor not found' });
    res.json({ message: 'Corridor blueprint deleted successfully' });
  } catch (err: any) {
    console.error('[DELETE /api/tenant/operations-corridors/:id] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 🏢 PROJECT - STOCKYARD ASSOCIATIONS & LIVE INVENTORY ISOLATION
// ====================================================================

// GET All Stockyards Associated with a Project
router.get('/api/tenant/projects/:id/stockyards', async (req, res) => {
  try {
    const { id } = req.params;
    const prjRes = await pool.query('SELECT project_id, name FROM tenant_projects WHERE project_id = $1 OR id::text = $1', [id]);
    const prjId = prjRes.rows[0]?.project_id || id;
    const prjName = prjRes.rows[0]?.name || id;

    const assocRes = await pool.query(`
      SELECT 
        ps.id,
        ps.tenant_id as "tenantId",
        ps.project_id as "projectId",
        ps.project_name as "projectName",
        ps.stockyard_id as "stockyardId",
        ps.stockyard_code as "stockyardCode",
        ps.stockyard_name as "stockyardName",
        ps.corridor_id as "corridorId",
        ps.stop_sequence as "stopSequence",
        ps.planned_material as "plannedMaterial",
        ps.planned_quantity::NUMERIC as "plannedQuantity",
        ps.planned_unit as "plannedUnit",
        ps.status,
        y.location,
        COALESCE(y.division_name, 'Infrastructure Division') as "divisionName",
        y.supervisor_name as "supervisorName",
        y.supervisor_phone as "supervisorPhone",
        ps.created_at as "createdAt"
      FROM tenant_project_stockyards ps
      JOIN tenant_stockyards y ON ps.stockyard_id = y.id
      WHERE (ps.project_id = $1 OR ps.project_id = $2) AND ps.status = 'Active'
      ORDER BY ps.stop_sequence ASC, ps.id ASC
    `, [prjId, id]);

    const items = await Promise.all(assocRes.rows.map(async (row) => {
      const txRes = await pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN transaction_type = 'INWARD' THEN quantity ELSE 0 END), 0)::NUMERIC as "totalReceived",
          COALESCE(SUM(CASE WHEN transaction_type = 'OUTWARD' THEN quantity ELSE 0 END), 0)::NUMERIC as "totalIssued",
          COALESCE(SUM(CASE 
            WHEN transaction_type = 'INWARD' THEN quantity 
            WHEN transaction_type = 'OUTWARD' THEN -quantity 
            WHEN transaction_type = 'LOSS' THEN -quantity 
            WHEN transaction_type = 'ADJUSTMENT' THEN quantity 
            ELSE 0 
          END), 0)::NUMERIC as "currentAvailable",
          COUNT(id)::INTEGER as "transactionCount"
        FROM tenant_stockyard_transactions
        WHERE stockyard_id = $1 AND (project_id = $2 OR project_id = $3)
      `, [row.stockyardId, prjId, id]);

      const tx = txRes.rows[0] || {};
      return {
        ...row,
        projectName: prjName,
        plannedQuantity: parseFloat(row.plannedQuantity || '0'),
        actualReceived: parseFloat(tx.totalReceived || '0'),
        actualIssued: parseFloat(tx.totalIssued || '0'),
        currentAvailable: parseFloat(tx.currentAvailable || '0'),
        transactionCount: parseInt(tx.transactionCount || '0', 10)
      };
    }));

    res.json(items);
  } catch (err: any) {
    console.error('[GET /api/tenant/projects/:id/stockyards] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Link Stockyard directly to Project
router.post('/api/tenant/projects/:id/stockyards', async (req, res) => {
  try {
    const { id } = req.params;
    const { stockyardId, plannedMaterial = 'Aggregates', plannedQuantity = 0, plannedUnit = 'MT', notes } = req.body;

    const prjRes = await pool.query('SELECT tenant_id, project_id, name FROM tenant_projects WHERE project_id = $1 OR id::text = $1', [id]);
    const prjId = prjRes.rows[0]?.project_id || id;
    const prjName = prjRes.rows[0]?.name || id;
    const tenantId = prjRes.rows[0]?.tenant_id || 1;

    const yRes = await pool.query('SELECT yard_code, yard_name FROM tenant_stockyards WHERE id = $1', [stockyardId]);
    if (yRes.rows.length === 0) return res.status(404).json({ error: 'Stockyard not found' });
    const { yard_code: yCode, yard_name: yName } = yRes.rows[0];

    const insRes = await pool.query(`
      INSERT INTO tenant_project_stockyards (
        tenant_id, project_id, project_name, stockyard_id, stockyard_code, stockyard_name,
        planned_material, planned_quantity, planned_unit, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active', $10)
      ON CONFLICT (tenant_id, project_id, stockyard_id) DO UPDATE SET
        project_name = EXCLUDED.project_name,
        stockyard_code = EXCLUDED.stockyard_code,
        stockyard_name = EXCLUDED.stockyard_name,
        planned_material = EXCLUDED.planned_material,
        planned_quantity = EXCLUDED.planned_quantity,
        planned_unit = EXCLUDED.planned_unit,
        status = 'Active',
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [tenantId, prjId, prjName, stockyardId, yCode, yName, plannedMaterial, parseFloat(plannedQuantity || 0), plannedUnit, notes || '']);

    res.status(201).json(insRes.rows[0]);
  } catch (err: any) {
    console.error('[POST /api/tenant/projects/:id/stockyards] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE Project-Stockyard Association
router.delete('/api/tenant/projects/:id/stockyards/:yardId', async (req, res) => {
  try {
    const { id, yardId } = req.params;
    const prjRes = await pool.query('SELECT project_id FROM tenant_projects WHERE project_id = $1 OR id::text = $1', [id]);
    const prjId = prjRes.rows[0]?.project_id || id;

    await pool.query(`
      UPDATE tenant_project_stockyards 
      SET status = 'Inactive', updated_at = CURRENT_TIMESTAMP 
      WHERE (project_id = $1 OR project_id = $2) AND stockyard_id = $3
    `, [prjId, id, yardId]);

    res.json({ message: 'Stockyard unlinked from project route. All historical stock transactions and balance ledgers remain strictly preserved.' });
  } catch (err: any) {
    console.error('[DELETE /api/tenant/projects/:id/stockyards/:yardId] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
