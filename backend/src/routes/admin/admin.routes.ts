import { Router } from 'express';
import { pool } from '../../config/db';

const router = Router();

// ==========================================
// SUPER ADMIN ENDPOINTS
// ==========================================

// Get Platform Stats
router.get('/api/admin/stats', async (req, res) => {
  try {
    const totalTenantsResult = await pool.query('SELECT COUNT(*) as count FROM tenants');
    const revenueResult = await pool.query(`
      SELECT SUM(p.price_monthly) as total 
      FROM tenants t 
      JOIN subscription_plans p ON t.subscription_plan_id = p.id
    `);
    const activeTrialsResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM tenants t 
      JOIN subscription_plans p ON t.subscription_plan_id = p.id 
      WHERE p.name = 'Trial'
    `);

    res.json({
      totalTenants: parseInt(totalTenantsResult.rows[0].count, 10),
      monthlyRevenue: parseFloat(revenueResult.rows[0].total) || 0,
      activeTrials: parseInt(activeTrialsResult.rows[0].count, 10),
      expiringSoon: 0 // Placeholder logic for now
    });
  } catch (err: any) {
    console.error('Error fetching admin stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get Recent Tenants
router.get('/api/admin/tenants', async (req, res) => {
  try {
    const tenantsResult = await pool.query(`
      SELECT 
        t.id, 
        t.company_name, 
        t.created_at,
        p.name as plan_name,
        p.price_monthly,
        a.admin_name,
        a.email,
        a.mobile
      FROM tenants t
      LEFT JOIN subscription_plans p ON t.subscription_plan_id = p.id
      LEFT JOIN tenant_admins a ON t.id = a.tenant_id
      ORDER BY t.created_at DESC
    `);
    res.json(tenantsResult.rows);
  } catch (err: any) {
    console.error('Error fetching admin tenants:', err);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// GET Form Fields Configuration
router.get('/api/admin/form-config/:formType', async (req, res) => {
  const { formType } = req.params;
  try {
    const fieldsRes = await pool.query(
      'SELECT id, form_type as "formType", field_key as "fieldKey", field_label as "fieldLabel", field_type as "fieldType", is_default as "isDefault", is_hidden as "isHidden", is_required as "isRequired", dropdown_options as "dropdownOptions" FROM form_fields_config WHERE form_type = $1 ORDER BY is_default DESC, id ASC',
      [formType]
    );
    res.json(fieldsRes.rows);
  } catch (err: any) {
    console.error('Error fetching form config:', err);
    res.status(500).json({ error: 'Failed to fetch form configuration: ' + err.message });
  }
});

// PUT/Update Form Fields Configuration
router.put('/api/admin/form-config/:formType', async (req, res) => {
  const { formType } = req.params;
  const { fields } = req.body;
  if (!Array.isArray(fields)) {
    return res.status(400).json({ error: 'fields must be an array' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch existing keys to find which ones were deleted
    const existingRes = await client.query('SELECT field_key FROM form_fields_config WHERE form_type = $1', [formType]);
    const existingKeys = existingRes.rows.map(r => r.field_key);
    const receivedKeys = fields.map(f => f.fieldKey);

    // Delete custom fields that are no longer present
    const keysToDelete = existingKeys.filter(k => !receivedKeys.includes(k));
    for (const key of keysToDelete) {
      await client.query(
        'DELETE FROM form_fields_config WHERE form_type = $1 AND field_key = $2 AND is_default = false',
        [formType, key]
      );
    }

    // Upsert fields
    for (const field of fields) {
      const { fieldKey, fieldLabel, fieldType, isDefault, isHidden, isRequired, dropdownOptions } = field;
      await client.query(
        `INSERT INTO form_fields_config 
         (form_type, field_key, field_label, field_type, is_default, is_hidden, is_required, dropdown_options)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (form_type, field_key)
         DO UPDATE SET 
           field_label = EXCLUDED.field_label,
           field_type = EXCLUDED.field_type,
           is_hidden = EXCLUDED.is_hidden,
           is_required = EXCLUDED.is_required,
           dropdown_options = EXCLUDED.dropdown_options`,
        [
          formType,
          fieldKey,
          fieldLabel,
          fieldType || 'text',
          isDefault || false,
          isHidden || false,
          isRequired || false,
          dropdownOptions || null
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Form configuration updated successfully' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error updating form config:', err);
    res.status(500).json({ error: 'Failed to update form configuration: ' + err.message });
  } finally {
    client.release();
  }
});

// Update Subscription Plan
router.put('/api/admin/plans/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, price_monthly, included_tonnage, included_equipment, additional_tonnage_price, additional_equipment_price } = req.body;

  try {
    await pool.query(
      `UPDATE subscription_plans 
       SET name = $1, description = $2, price_monthly = $3, included_tonnage = $4, included_equipment = $5, additional_tonnage_price = $6, additional_equipment_price = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [name, description, price_monthly, included_tonnage, included_equipment, additional_tonnage_price, additional_equipment_price, id]
    );
    res.json({ message: 'Plan updated successfully' });
  } catch (err: any) {
    console.error('Error updating plan:', err);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});
// Razorpay Create Order Endpoint
router.post('/api/payment/create-order', async (req, res) => {
  const { amount } = req.body;
  if (!amount) {
    return res.status(400).json({ error: 'Amount is required' });
  }

  try {
    const auth = Buffer.from('rzp_test_TDMPnPm4wjZUET:yZIt2uhhpI35UQCdEXUe1VAi').toString('base64');
    // Using standard global fetch (Node 18+) to request order creation from Razorpay API
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Math.round(Number(amount) * 100), // amount in paise
        currency: 'INR',
        receipt: `receipt_order_${Date.now()}`
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.description || 'Razorpay order creation failed');
    }
    res.json(data);
  } catch (err: any) {
    console.error('Razorpay Order Error:', err);
    res.status(500).json({ error: err.message || 'Payment server error' });
  }
});

// Debug Database Endpoint
router.get('/api/debug-db', async (req, res) => {
  try {
    const tenants = await pool.query('SELECT * FROM tenants LIMIT 10');
    const admins = await pool.query('SELECT * FROM tenant_admins LIMIT 10');
    const users = await pool.query('SELECT * FROM tenant_users LIMIT 10').catch((e: any) => ({ error: e.message, rows: [] }));
    const cols = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('tenants', 'tenant_users')
      ORDER BY table_name, column_name;
    `);
    res.json({
      tenants: tenants.rows,
      admins: admins.rows,
      users: users,
      columns: cols.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN REPORTS OVERVIEW (MOCKED)
router.get('/api/admin/reports/overview', (req, res) => {
  res.json({
    metrics: {
      totalTenants: 45,
      activeProjects: 120,
      activeWorksites: 340,
      monthlyRevenue: 15400
    },
    growth: [
      { month: 'Jan', new_tenants: 5 },
      { month: 'Feb', new_tenants: 8 },
      { month: 'Mar', new_tenants: 12 },
      { month: 'Apr', new_tenants: 7 },
      { month: 'May', new_tenants: 15 },
      { month: 'Jun', new_tenants: 11 }
    ],
    planDistribution: [
      { plan: 'Basic', count: 15 },
      { plan: 'Professional', count: 20 },
      { plan: 'Enterprise', count: 10 }
    ],
    statusDistribution: [
      { payment_status: 'Paid', count: 40 },
      { payment_status: 'Pending', count: 3 },
      { payment_status: 'Failed', count: 2 }
    ]
  });
});

// ADMIN AUDIT LOGS (MOCKED)
router.get('/api/admin/audit-logs', (req, res) => {
  res.json([
    { id: 1, action: 'Tenant Created', user: 'System', timestamp: new Date().toISOString(), details: 'New tenant registered' },
    { id: 2, action: 'Config Updated', user: 'Admin User', timestamp: new Date(Date.now() - 3600000).toISOString(), details: 'Updated project custom fields' },
    { id: 3, action: 'Subscription Upgraded', user: 'Billing System', timestamp: new Date(Date.now() - 86400000).toISOString(), details: 'Tenant #4 upgraded to Enterprise' }
  ]);
});

export default router;
