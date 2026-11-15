import { Router } from 'express';
import { pool } from '../../config/db';

const router = Router();

// ====================================================================
// 📋 DIGITAL DISPATCH WAYBILLS & MATERIAL PASSPORTS
// ====================================================================

// GET Dispatch Waybills
router.get('/api/tenant/dispatch-waybills', async (req, res) => {
  try {
    const { projectId, status } = req.query;
    let query = `
      SELECT 
        w.id,
        w.tenant_id as "tenantId",
        w.waybill_number as "waybillNumber",
        w.project_id as "projectId",
        w.project_name as "projectName",
        w.corridor_id as "corridorId",
        w.corridor_name as "corridorName",
        w.origin_yard_id as "originYardId",
        w.origin_yard_name as "originYardName",
        w.destination_yard_id as "destinationYardId",
        w.destination_yard_name as "destinationYardName",
        w.material_name as "materialName",
        w.grade,
        w.unit_of_measure as "unitOfMeasure",
        w.tare_weight as "tareWeight",
        w.gross_weight as "grossWeight",
        w.net_weight as "netWeight",
        w.vehicle_number as "vehicleNumber",
        w.driver_name as "driverName",
        w.driver_phone as "driverPhone",
        w.transporter_name as "transporterName",
        w.eway_bill_number as "ewayBillNumber",
        w.status,
        w.dispatched_at as "dispatchedAt",
        w.delivered_at as "deliveredAt",
        w.remarks
      FROM tenant_dispatch_waybills w
      WHERE 1=1
    `;
    const params: any[] = [];
    if (projectId) {
      params.push(projectId);
      query += ` AND (w.project_id = $${params.length} OR w.project_name ILIKE $${params.length})`;
    }
    if (status && status !== 'All') {
      params.push(status);
      query += ` AND w.status = $${params.length}`;
    }
    query += ' ORDER BY w.dispatched_at DESC LIMIT 150';

    const wRes = await pool.query(query, params);
    res.json(wRes.rows);
  } catch (err: any) {
    console.error('[GET /api/tenant/dispatch-waybills] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST Create & Dispatch Waybill (Deducts stock from origin pile & logs outward tx)
router.post('/api/tenant/dispatch-waybills', async (req, res) => {
  try {
    const {
      firebaseUid, waybillNumber, projectId, projectName,
      corridorId, corridorName, legId, originYardId, originYardName,
      destinationYardId, destinationYardName, materialName, grade,
      unitOfMeasure, tareWeight, grossWeight, netWeight,
      vehicleNumber, driverName, driverPhone, transporterName,
      ewayBillNumber, remarks, originPileId
    } = req.body;

    let tenantId = 1;
    if (firebaseUid) {
      const aRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [firebaseUid]);
      if (aRes.rows.length > 0) tenantId = aRes.rows[0].tenant_id;
    }

    const calculatedNet = netWeight || (parseFloat(grossWeight || 0) - parseFloat(tareWeight || 0)) || 0;
    const wbNum = waybillNumber || `WB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const wInsert = await pool.query(`
      INSERT INTO tenant_dispatch_waybills (
        tenant_id, waybill_number, project_id, project_name,
        corridor_id, corridor_name, leg_id, origin_yard_id, origin_yard_name,
        destination_yard_id, destination_yard_name, material_name, grade,
        unit_of_measure, tare_weight, gross_weight, net_weight,
        vehicle_number, driver_name, driver_phone, transporter_name,
        eway_bill_number, status, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, 'In-Transit', $23)
      RETURNING *
    `, [
      tenantId, wbNum, projectId, projectName || 'Infrastructure Project',
      corridorId || null, corridorName || '', legId || null,
      originYardId || null, originYardName || '', destinationYardId || null,
      destinationYardName || '', materialName, grade || '',
      unitOfMeasure || 'MT', tareWeight || 0, grossWeight || 0, calculatedNet,
      vehicleNumber, driverName, driverPhone || '', transporterName || '',
      ewayBillNumber || '', remarks || ''
    ]);

    // If origin yard pile was identified, deduct stock and log outward movement
    if (originYardId && originPileId) {
      await pool.query(`
        UPDATE tenant_stockyard_piles 
        SET current_quantity = GREATEST(0, current_quantity - $1), updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [calculatedNet, originPileId]);

      await pool.query(`
        INSERT INTO tenant_stockyard_transactions (
          tenant_id, stockyard_id, pile_id, transaction_type, quantity,
          project_id, project_name, vehicle_number, driver_name, driver_phone,
          waybill_number, gross_weight, tare_weight, net_weight, remarks
        ) VALUES ($1, $2, $3, 'OUTWARD', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        tenantId, originYardId, originPileId, calculatedNet,
        projectId, projectName, vehicleNumber, driverName, driverPhone,
        wbNum, grossWeight, tareWeight, calculatedNet, `Gate dispatch on ${vehicleNumber}`
      ]);
    }

    res.status(201).json(wInsert.rows[0]);
  } catch (err: any) {
    console.error('[POST /api/tenant/dispatch-waybills] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH Confirm Waybill Delivery (Adds stock to destination pile & logs inward tx)
router.patch('/api/tenant/dispatch-waybills/:id/deliver', async (req, res) => {
  try {
    const { id } = req.params;
    const { destinationPileId, receivedWeight, remarks } = req.body;

    const wRes = await pool.query('SELECT * FROM tenant_dispatch_waybills WHERE id = $1', [id]);
    if (wRes.rows.length === 0) return res.status(404).json({ error: 'Waybill not found' });
    const wb = wRes.rows[0];

    const finalNet = receivedWeight || wb.net_weight;

    const updateRes = await pool.query(`
      UPDATE tenant_dispatch_waybills
      SET status = 'Delivered', delivered_at = CURRENT_TIMESTAMP, remarks = COALESCE($1, remarks)
      WHERE id = $2
      RETURNING *
    `, [remarks || 'Delivered & weighbridge verified', id]);

    // If destination yard pile is given, add stock and log inward transaction
    if (wb.destination_yard_id && destinationPileId) {
      await pool.query(`
        UPDATE tenant_stockyard_piles 
        SET current_quantity = current_quantity + $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [finalNet, destinationPileId]);

      await pool.query(`
        INSERT INTO tenant_stockyard_transactions (
          tenant_id, stockyard_id, pile_id, transaction_type, quantity,
          project_id, project_name, vehicle_number, driver_name, driver_phone,
          waybill_number, net_weight, remarks
        ) VALUES ($1, $2, $3, 'INWARD', $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        wb.tenant_id, wb.destination_yard_id, destinationPileId, finalNet,
        wb.project_id, wb.project_name, wb.vehicle_number, wb.driver_name, wb.driver_phone,
        wb.waybill_number, finalNet, `Delivered & stacked from ${wb.origin_yard_name || 'Dispatch Site'}`
      ]);
    }

    res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error('[PATCH /api/tenant/dispatch-waybills/:id/deliver] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
