import express, { Router } from 'express';
import { pool } from '../../config/db';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

// Accounts Module - Clients API
router.get('/api/tenant/accounts/clients/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    let tenantId = null;
    const adminRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [uid]);
    if (adminRes.rows.length > 0) {
      tenantId = adminRes.rows[0].tenant_id;
    } else {
      const memberRes = await pool.query('SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1', [uid]);
      if (memberRes.rows.length > 0) {
        tenantId = memberRes.rows[0].tenant_id;
      }
    }
    if (!tenantId) return res.json([]);

    const clientsRes = await pool.query(
      'SELECT * FROM tenant_clients WHERE tenant_id = $1 ORDER BY name ASC',
      [tenantId]
    );
    res.json(clientsRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/tenant/accounts/clients', async (req, res) => {
  const {
    adminUid, name, code, legalName, contactPerson, mobile, email, website,
    billingAddress, siteAddress, state, country, pincode, gstNumber, panNumber,
    msmeStatus, creditLimit, creditDays, securityDeposit, bankGuarantee,
    accountsContact, financeContact, status
  } = req.body;

  try {
    let tenantId = null;
    const adminRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [adminUid]);
    if (adminRes.rows.length > 0) {
      tenantId = adminRes.rows[0].tenant_id;
    } else {
      const memberRes = await pool.query('SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1', [adminUid]);
      if (memberRes.rows.length > 0) {
        tenantId = memberRes.rows[0].tenant_id;
      }
    }
    if (!tenantId) return res.status(400).json({ error: 'Tenant profile not found' });

    const dupCheck = await pool.query(
      'SELECT id FROM tenant_clients WHERE tenant_id = $1 AND LOWER(code) = LOWER($2)',
      [tenantId, code]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({ error: `Client Code "${code}" is already in use.` });
    }

    const insertRes = await pool.query(
      `INSERT INTO tenant_clients (
        tenant_id, name, code, legal_name, contact_person, mobile, email, website,
        billing_address, site_address, state, country, pincode, gst_number, pan_number,
        msme_status, credit_limit, credit_days, security_deposit, bank_guarantee,
        accounts_contact, finance_contact, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *`,
      [
        tenantId, name, code, legalName || null, contactPerson || null, mobile || null, email || null, website || null,
        billingAddress || null, siteAddress || null, state || null, country || null, pincode || null, gstNumber || null, panNumber || null,
        msmeStatus || 'Non-MSME', creditLimit || 0, creditDays || 30, securityDeposit || 0, bankGuarantee || null,
        accountsContact || null, financeContact || null, status || 'Active'
      ]
    );
    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Accounts Module - Vendors API
router.get('/api/tenant/accounts/vendors/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    let tenantId = null;
    const adminRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [uid]);
    if (adminRes.rows.length > 0) {
      tenantId = adminRes.rows[0].tenant_id;
    } else {
      const memberRes = await pool.query('SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1', [uid]);
      if (memberRes.rows.length > 0) {
        tenantId = memberRes.rows[0].tenant_id;
      }
    }
    if (!tenantId) return res.json([]);

    const vendorsRes = await pool.query(
      'SELECT * FROM tenant_vendors WHERE tenant_id = $1 ORDER BY name ASC',
      [tenantId]
    );
    res.json(vendorsRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
router.get('/api/tenant/projects/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    let tenantId = null;
    if (uid && uid !== 'undefined') {
      const adminRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [uid]);
      if (adminRes.rows.length > 0) tenantId = adminRes.rows[0].tenant_id;
      else {
        const userRes = await pool.query('SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1', [uid]);
        if (userRes.rows.length > 0) tenantId = userRes.rows[0].tenant_id;
      }
    }
    const targetTenantId = tenantId || 1;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_projects (
        id SERIAL PRIMARY KEY,
        project_id VARCHAR(50) NOT NULL UNIQUE,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL,
        location_block VARCHAR(255),
        customer VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const dbRes = await pool.query('SELECT * FROM tenant_projects WHERE tenant_id = $1 ORDER BY id DESC', [targetTenantId]);
    res.json(dbRes.rows);
  } catch (err: any) {
    res.json([]);
  }
});

// GET Worksites for a Tenant
router.get('/api/tenant/worksites/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    let tenantId = null;
    if (uid && uid !== 'undefined') {
      const adminRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [uid]);
      if (adminRes.rows.length > 0) tenantId = adminRes.rows[0].tenant_id;
      else {
        const userRes = await pool.query('SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1', [uid]);
        if (userRes.rows.length > 0) tenantId = userRes.rows[0].tenant_id;
      }
    }
    const targetTenantId = tenantId || 1;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_worksites (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        type VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const dbRes = await pool.query('SELECT * FROM tenant_worksites WHERE tenant_id = $1 ORDER BY id DESC', [targetTenantId]);
    res.json(dbRes.rows);
  } catch (err: any) {
    res.json([]);
  }
});

router.post('/api/tenant/accounts/vendors', async (req, res) => {
  const {
    adminUid, name, code, vendorType, contactPerson, mobile, email,
    bankName, accountNumber, ifsc, gstRegistered, gstNumber, panNumber,
    tdsApplicable, tdsSection, hsn_sac, gstPercentage, tdsPercentage, status
  } = req.body;

  try {
    let tenantId = null;
    const adminRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [adminUid]);
    if (adminRes.rows.length > 0) {
      tenantId = adminRes.rows[0].tenant_id;
    } else {
      const memberRes = await pool.query('SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1', [adminUid]);
      if (memberRes.rows.length > 0) {
        tenantId = memberRes.rows[0].tenant_id;
      }
    }
    if (!tenantId) return res.status(404).json({ error: 'Tenant profile not found' });

    const dupCheck = await pool.query(
      'SELECT id FROM tenant_vendors WHERE tenant_id = $1 AND LOWER(code) = LOWER($2)',
      [tenantId, code]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({ error: `Vendor Code "${code}" is already in use.` });
    }

    const insertRes = await pool.query(
      `INSERT INTO tenant_vendors (
        tenant_id, name, code, vendor_type, contact_person, mobile, email,
        bank_name, account_number, ifsc, gst_registered, gst_number, pan_number,
        tds_applicable, tds_section, hsn_sac, gst_percentage, tds_percentage, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        tenantId, name, code, vendorType, contactPerson || null, mobile || null, email || null,
        bankName || null, accountNumber || null, ifsc || null, gstRegistered || false, gstNumber || null, panNumber || null,
        tdsApplicable || false, tdsSection || null, hsn_sac || null, gstPercentage || 0, tdsPercentage || 0, status || 'Active'
      ]
    );
    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Accounts Module - Expense Categories API
router.get('/api/tenant/accounts/expense-categories/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    let tenantId = null;
    const adminRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [uid]);
    if (adminRes.rows.length > 0) {
      tenantId = adminRes.rows[0].tenant_id;
    } else {
      const memberRes = await pool.query('SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1', [uid]);
      if (memberRes.rows.length > 0) {
        tenantId = memberRes.rows[0].tenant_id;
      }
    }
    if (!tenantId) return res.status(404).json({ error: 'Tenant profile not found' });

    const catsRes = await pool.query(
      'SELECT * FROM tenant_expense_categories WHERE tenant_id = $1 ORDER BY name ASC',
      [tenantId]
    );
    res.json(catsRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/tenant/accounts/expense-categories', async (req, res) => {
  const { adminUid, name, categoryType, hsn_sac, gstPercentage, tdsPercentage, glAccount } = req.body;

  try {
    let tenantId = null;
    const adminRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [adminUid]);
    if (adminRes.rows.length > 0) {
      tenantId = adminRes.rows[0].tenant_id;
    } else {
      const memberRes = await pool.query('SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1', [adminUid]);
      if (memberRes.rows.length > 0) {
        tenantId = memberRes.rows[0].tenant_id;
      }
    }
    if (!tenantId) return res.status(404).json({ error: 'Tenant profile not found' });

    const dupCheck = await pool.query(
      'SELECT id FROM tenant_expense_categories WHERE tenant_id = $1 AND LOWER(name) = LOWER($2)',
      [tenantId, name]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({ error: `Category Name "${name}" is already in use.` });
    }

    const insertRes = await pool.query(
      `INSERT INTO tenant_expense_categories (
        tenant_id, name, category_type, hsn_sac, gst_percentage, tds_percentage, gl_account
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [tenantId, name, categoryType, hsn_sac || null, gstPercentage || 0, tdsPercentage || 0, glAccount || null]
    );
    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Invoice / Billing Tables ─────────────────────────────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS tenant_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID REFERENCES tenant_clients(id) ON DELETE SET NULL,
    invoice_number VARCHAR(50) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    place_of_supply VARCHAR(100),
    reference_number VARCHAR(100),
    taxable_amount NUMERIC(15, 2) DEFAULT 0.00,
    cgst NUMERIC(15, 2) DEFAULT 0.00,
    sgst NUMERIC(15, 2) DEFAULT 0.00,
    igst NUMERIC(15, 2) DEFAULT 0.00,
    tds_amount NUMERIC(15, 2) DEFAULT 0.00,
    total_amount NUMERIC(15, 2) DEFAULT 0.00,
    net_payable NUMERIC(15, 2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'Draft',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_invoice_number UNIQUE (tenant_id, invoice_number)
  );
`).then(() => console.log('Checked/Created tenant_invoices table'))
  .catch((e: any) => console.error('Error creating tenant_invoices:', e.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS tenant_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES tenant_invoices(id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    hsn_sac VARCHAR(50),
    quantity NUMERIC(15, 3) DEFAULT 1,
    unit VARCHAR(50) DEFAULT 'Nos',
    rate NUMERIC(15, 2) DEFAULT 0.00,
    taxable_value NUMERIC(15, 2) DEFAULT 0.00,
    gst_percentage NUMERIC(5, 2) DEFAULT 18.00,
    tds_percentage NUMERIC(5, 2) DEFAULT 0.00,
    gst_amount NUMERIC(15, 2) DEFAULT 0.00,
    tds_amount NUMERIC(15, 2) DEFAULT 0.00,
    line_total NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).then(() => console.log('Checked/Created tenant_invoice_items table'))
  .catch((e: any) => console.error('Error creating tenant_invoice_items:', e.message));

// ─── Invoice Sequence Helper ───────────────────────────────────────────────────
async function generateInvoiceNumber(tenantId: number): Promise<string> {
  const year = new Date().getFullYear();
  const result = await pool.query(
    `SELECT COUNT(*) FROM tenant_invoices WHERE tenant_id = $1 AND EXTRACT(YEAR FROM created_at) = $2`,
    [tenantId, year]
  );
  const seq = parseInt(result.rows[0].count, 10) + 1;
  return `INV-${year}-${String(seq).padStart(5, '0')}`;
}

// ─── GET /api/tenant/invoices/:uid ─────────────────────────────────────────────
router.get('/api/tenant/invoices/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    let tenantId = null;
    const adminRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [uid]);
    if (adminRes.rows.length > 0) tenantId = adminRes.rows[0].tenant_id;
    else {
      const memberRes = await pool.query('SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1', [uid]);
      if (memberRes.rows.length > 0) tenantId = memberRes.rows[0].tenant_id;
    }
    if (!tenantId) return res.status(404).json({ error: 'Tenant not found' });

    const invRes = await pool.query(`
      SELECT i.*, c.name AS client_name, c.gst_number AS client_gst,
             c.state AS client_state
      FROM tenant_invoices i
      LEFT JOIN tenant_clients c ON c.id = i.client_id
      WHERE i.tenant_id = $1
      ORDER BY i.created_at DESC
    `, [tenantId]);

    // Attach line items for each invoice
    const invoices = await Promise.all(invRes.rows.map(async (inv: any) => {
      const itemsRes = await pool.query(
        'SELECT * FROM tenant_invoice_items WHERE invoice_id = $1 ORDER BY created_at ASC',
        [inv.id]
      );
      return { ...inv, items: itemsRes.rows };
    }));

    res.json(invoices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/tenant/invoices ─────────────────────────────────────────────────
router.post('/api/tenant/invoices', async (req, res) => {
  const { adminUid, clientId, invoiceDate, dueDate, placeOfSupply, referenceNumber,
    items, notes, tenantState } = req.body;

  try {
    let tenantId = null;
    const adminRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [adminUid]);
    if (adminRes.rows.length > 0) tenantId = adminRes.rows[0].tenant_id;
    else {
      const memberRes = await pool.query('SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1', [adminUid]);
      if (memberRes.rows.length > 0) tenantId = memberRes.rows[0].tenant_id;
    }
    if (!tenantId) return res.status(404).json({ error: 'Tenant not found' });

    // Determine GST split: IGST if inter-state, CGST+SGST if intra-state
    const isInterState = placeOfSupply && tenantState &&
      placeOfSupply.trim().toLowerCase() !== tenantState.trim().toLowerCase();

    // Calculate totals from line items
    let taxableAmount = 0, cgst = 0, sgst = 0, igst = 0, tdsTotal = 0;
    const processedItems = (items || []).map((item: any) => {
      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      const gstPct = parseFloat(item.gstPercentage) || 0;
      const tdsPct = parseFloat(item.tdsPercentage) || 0;
      const taxableValue = qty * rate;
      const gstAmount = (taxableValue * gstPct) / 100;
      const tdsAmount = (taxableValue * tdsPct) / 100;
      const lineTotal = taxableValue + gstAmount;

      taxableAmount += taxableValue;
      if (isInterState) igst += gstAmount;
      else { cgst += gstAmount / 2; sgst += gstAmount / 2; }
      tdsTotal += tdsAmount;

      return { ...item, taxableValue, gstAmount, tdsAmount, lineTotal };
    });

    const totalAmount = taxableAmount + cgst + sgst + igst;
    const netPayable = totalAmount - tdsTotal;
    const invoiceNumber = await generateInvoiceNumber(tenantId);

    // Insert invoice + items in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const invInsert = await client.query(`
        INSERT INTO tenant_invoices (
          tenant_id, client_id, invoice_number, invoice_date, due_date,
          place_of_supply, reference_number, taxable_amount, cgst, sgst, igst,
          tds_amount, total_amount, net_payable, notes, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'Draft')
        RETURNING *
      `, [tenantId, clientId || null, invoiceNumber, invoiceDate, dueDate,
        placeOfSupply || null, referenceNumber || null,
        taxableAmount, cgst, sgst, igst, tdsTotal, totalAmount, netPayable, notes || null]);

      const invoice = invInsert.rows[0];
      for (const item of processedItems) {
        await client.query(`
          INSERT INTO tenant_invoice_items (
            invoice_id, description, hsn_sac, quantity, unit, rate,
            taxable_value, gst_percentage, tds_percentage, gst_amount, tds_amount, line_total
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `, [invoice.id, item.description, item.hsn_sac || null, item.quantity, item.unit || 'Nos',
        item.rate, item.taxableValue, item.gstPercentage || 0, item.tdsPercentage || 0,
        item.gstAmount, item.tdsAmount, item.lineTotal]);
      }
      await client.query('COMMIT');
      res.status(201).json({ ...invoice, items: processedItems });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/tenant/invoices/:id/status ─────────────────────────────────────
router.patch('/api/tenant/invoices/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['Draft', 'Sent', 'Partial', 'Paid', 'Overdue'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }
  try {
    const result = await pool.query(
      'UPDATE tenant_invoices SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/tenant/invoices/:id ──────────────────────────────────────────
router.delete('/api/tenant/invoices/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const check = await pool.query('SELECT status FROM tenant_invoices WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    if (check.rows[0].status !== 'Draft') {
      return res.status(400).json({ error: 'Only Draft invoices can be deleted' });
    }
    await pool.query('DELETE FROM tenant_invoices WHERE id = $1', [id]);
    res.json({ message: 'Invoice deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ─── SIMPLE PROJECT LEDGER & COMPANY EXPENSES API ───────────────────────────

router.post('/api/tenant/ledger/project-ledger', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { projectId, totalCost, notes } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  try {
    const query = `
      INSERT INTO tenant_project_ledger_profiles (tenant_id, project_id, total_cost, notes)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tenant_id, project_id)
      DO UPDATE SET total_cost = EXCLUDED.total_cost, notes = EXCLUDED.notes
      RETURNING *
    `;
    const result = await pool.query(query, [tenantId, projectId, Number(totalCost || 0), notes || '']);
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/tenant/ledger/project-ledger/:projectId', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const { projectId } = req.params;
  const tenantId = req.user.tenantId;

  try {
    const profileRes = await pool.query(
      'SELECT * FROM tenant_project_ledger_profiles WHERE tenant_id = $1 AND project_id = $2',
      [tenantId, projectId]
    );
    let totalCost = 0;
    let notes = '';
    if (profileRes.rows.length > 0) {
      totalCost = Number(profileRes.rows[0].total_cost || 0);
      notes = profileRes.rows[0].notes || '';
    }

    const pcRes = await pool.query(
      'SELECT * FROM tenant_project_petty_cash WHERE tenant_id = $1 AND project_id = $2 ORDER BY person_name ASC',
      [tenantId, projectId]
    );

    const pettyCashByPerson = [];
    let totalPettyCashSpent = 0;
    for (const row of pcRes.rows) {
      const expRes = await pool.query(
        'SELECT * FROM tenant_project_petty_cash_expenses WHERE tenant_id = $1 AND project_id = $2 AND person_name = $3 ORDER BY date DESC',
        [tenantId, projectId, row.person_name]
      );

      const expenses = expRes.rows.map(e => ({
        id: e.id,
        date: e.date,
        category: e.category,
        amount: Number(e.amount || 0),
        bill: e.bill || ''
      }));

      const usedSum = expenses.filter(e => e.amount > 0).reduce((acc, exp) => acc + exp.amount, 0);
      const given = Number(row.given || 0);
      const left = given - usedSum;

      await pool.query(
        'UPDATE tenant_project_petty_cash SET used = $1, left_amount = $2 WHERE id = $3',
        [usedSum, left, row.id]
      );

      totalPettyCashSpent += usedSum;

      pettyCashByPerson.push({
        id: row.id,
        personName: row.person_name,
        given,
        used: usedSum,
        left,
        expenses
      });
    }

    const billsRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM tenant_vendor_ledger_entries 
       WHERE tenant_id = $1 AND project_id = $2 AND type = 'Bill'`,
      [tenantId, projectId]
    );
    const vendorBillsTotal = Number(billsRes.rows[0].total || 0);

    const materialsRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM tenant_project_petty_cash_expenses 
       WHERE tenant_id = $1 AND project_id = $2 AND category = 'Material Expense'`,
      [tenantId, projectId]
    );
    const materialsTotal = Number(materialsRes.rows[0].total || 0);

    const spentSoFar = totalPettyCashSpent + vendorBillsTotal + materialsTotal;
    const remaining = totalCost - spentSoFar;

    const history = [];

    for (const p of pettyCashByPerson) {
      for (const e of p.expenses) {
        if (e.amount > 0) {
          history.push({
            date: e.date,
            what: e.category,
            who: p.personName,
            amount: e.amount,
            type: 'Petty Cash'
          });
        }
      }
    }

    const rawBills = await pool.query(
      `SELECT e.entry_date, e.amount, v.name as vendor_name 
       FROM tenant_vendor_ledger_entries e
       JOIN tenant_vendors v ON e.vendor_id = v.id
       WHERE e.tenant_id = $1 AND e.project_id = $2 AND e.type = 'Bill'`,
      [tenantId, projectId]
    );
    for (const b of rawBills.rows) {
      history.push({
        date: b.entry_date,
        what: 'Vendor Bill',
        who: b.vendor_name,
        amount: Number(b.amount || 0),
        type: 'Vendor Bill'
      });
    }

    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({
      totalCost,
      spentSoFar,
      remaining,
      notes,
      pettyCashByPerson,
      vendorBillsTotal,
      materialsTotal,
      history
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/tenant/ledger/petty-cash/give', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { projectId, personName, amount } = req.body;

  if (!projectId || !personName || !amount) {
    return res.status(400).json({ error: 'Project, Person Name and Amount are required' });
  }

  try {
    const amt = Number(amount);

    const checkRes = await pool.query(
      'SELECT id, given, left_amount FROM tenant_project_petty_cash WHERE tenant_id = $1 AND project_id = $2 AND person_name = $3',
      [tenantId, projectId, personName]
    );

    if (checkRes.rows.length > 0) {
      const row = checkRes.rows[0];
      const newGiven = Number(row.given || 0) + amt;
      const newLeft = Number(row.left_amount || 0) + amt;
      await pool.query(
        'UPDATE tenant_project_petty_cash SET given = $1, left_amount = $2 WHERE id = $3',
        [newGiven, newLeft, row.id]
      );
    } else {
      await pool.query(
        `INSERT INTO tenant_project_petty_cash (tenant_id, project_id, person_name, given, used, left_amount)
         VALUES ($1, $2, $3, $4, 0, $4)`,
        [tenantId, projectId, personName, amt]
      );
    }

    await pool.query(
      `INSERT INTO tenant_project_petty_cash_expenses (tenant_id, project_id, person_name, date, category, amount, bill)
       VALUES ($1, $2, $3, CURRENT_DATE::text, 'Float Received', $4, '')`,
      [tenantId, projectId, personName, -amt]
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/tenant/ledger/petty-cash/expense', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { projectId, personName, date, category, amount, bill } = req.body;

  if (!projectId || !personName || !date || !category || !amount) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const amt = Number(amount);

    await pool.query(
      `INSERT INTO tenant_project_petty_cash_expenses (tenant_id, project_id, person_name, date, category, amount, bill)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, projectId, personName, date, category, amt, bill || '']
    );

    await pool.query(
      `UPDATE tenant_project_petty_cash 
       SET used = used + $1, left_amount = left_amount - $1
       WHERE tenant_id = $2 AND project_id = $3 AND person_name = $4`,
      [amt, tenantId, projectId, personName]
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/tenant/ledger/payroll', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    const dbRes = await pool.query(
      'SELECT * FROM tenant_payroll_ledgers WHERE tenant_id = $1 ORDER BY date DESC, id DESC',
      [tenantId]
    );
    res.json(dbRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/tenant/ledger/payroll/entry', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { employee, amount, date } = req.body;

  if (!employee || !amount || !date) {
    return res.status(400).json({ error: 'Employee, amount and date are required' });
  }

  try {
    const insertRes = await pool.query(
      `INSERT INTO tenant_payroll_ledgers (tenant_id, date, employee, amount, status)
       VALUES ($1, $2, $3, $4, 'Paid') RETURNING *`,
      [tenantId, date, employee, Number(amount)]
    );
    res.json(insertRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/tenant/ledger/company-petty-cash', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    const dbRes = await pool.query(
      'SELECT * FROM tenant_company_petty_cash WHERE tenant_id = $1 ORDER BY date DESC, id DESC',
      [tenantId]
    );
    res.json(dbRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/tenant/ledger/company-petty-cash/entry', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { type, amount, category, date } = req.body;

  if (!type || !amount || !category || !date) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const amt = Number(amount);
    const lastRes = await pool.query(
      'SELECT balance FROM tenant_company_petty_cash WHERE tenant_id = $1 ORDER BY date DESC, id DESC LIMIT 1',
      [tenantId]
    );

    const lastBalance = lastRes.rows.length > 0 ? Number(lastRes.rows[0].balance || 0) : 0;
    const newBalance = type === 'topup' ? lastBalance + amt : lastBalance - amt;

    const insertRes = await pool.query(
      `INSERT INTO tenant_company_petty_cash (tenant_id, date, category, type, amount, balance)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenantId, date, category, type, amt, newBalance]
    );
    res.json(insertRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/tenant/ledger/loans', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    const dbRes = await pool.query(
      'SELECT * FROM tenant_loans_ledger WHERE tenant_id = $1 ORDER BY id DESC',
      [tenantId]
    );
    res.json(dbRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/tenant/ledger/loans', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { lender, principal, emiAmount, startDate } = req.body;

  if (!lender || !principal || !emiAmount || !startDate) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const insertRes = await pool.query(
      `INSERT INTO tenant_loans_ledger (tenant_id, lender, principal, outstanding, emi_amount, start_date)
       VALUES ($1, $2, $3, $3, $4, $5) RETURNING *`,
      [tenantId, lender, Number(principal), Number(emiAmount), startDate]
    );
    res.json(insertRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/tenant/ledger/loans/:id/payment', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;
  const { amount, date } = req.body;

  if (!amount || !date) {
    return res.status(400).json({ error: 'Amount and date are required' });
  }

  try {
    const amt = Number(amount);
    const insertRes = await pool.query(
      `INSERT INTO tenant_loan_payments (tenant_id, loan_id, amount, date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tenantId, Number(id), amt, date]
    );

    await pool.query(
      'UPDATE tenant_loans_ledger SET outstanding = outstanding - $1 WHERE id = $2 AND tenant_id = $3',
      [amt, Number(id), tenantId]
    );

    res.json(insertRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



// ═══════════════════════════════════════════════════════════════════════════════
// ─── FULL ACCOUNTANT LEDGER API SUITE ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ── BANK & CASH ACCOUNTS ──────────────────────────────────────────────────────

router.get('/api/tenant/ledger/bank-cash/accounts', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    const dbRes = await pool.query(
      `SELECT *, (SELECT COALESCE(SUM(CASE WHEN type='Deposit' OR type='Transfer In' THEN amount ELSE -amount END), 0) FROM tenant_bank_cash_entries WHERE account_id = a.id) + opening_balance AS current_balance
       FROM tenant_bank_cash_accounts a WHERE tenant_id = $1 ORDER BY id ASC`,
      [tenantId]
    );
    res.json(dbRes.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenant/ledger/bank-cash/accounts', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { name, type, openingBalance } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Name and type are required' });
  try {
    const result = await pool.query(
      `INSERT INTO tenant_bank_cash_accounts (tenant_id, name, type, opening_balance) VALUES ($1, $2, $3, $4) RETURNING *`,
      [tenantId, name, type, Number(openingBalance || 0)]
    );
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/api/tenant/ledger/bank-cash/:accountId', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { accountId } = req.params;
  try {
    const isNum = !isNaN(Number(accountId));
    let accRes;
    if (isNum) {
      accRes = await pool.query('SELECT * FROM tenant_bank_cash_accounts WHERE id = $1 AND tenant_id = $2', [Number(accountId), tenantId]);
    } else {
      accRes = await pool.query('SELECT * FROM tenant_bank_cash_accounts WHERE tenant_id = $1 LIMIT 1', [tenantId]);
    }

    if (accRes.rows.length === 0) return res.json({ account: null, entries: [] });
    const account = accRes.rows[0];

    const entriesRes = await pool.query(
      `SELECT * FROM tenant_bank_cash_entries WHERE account_id = $1 ORDER BY date DESC, id DESC`,
      [account.id]
    );
    res.json({ account, entries: entriesRes.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenant/ledger/bank-cash/entry', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { accountId, amount, date, type, linkedParty, referenceNo, note, destinationAccountId } = req.body;
  if (!accountId || !amount || !type) return res.status(400).json({ error: 'accountId, amount, and type are required' });
  try {
    const voucherNo = `BNK-${Date.now().toString().slice(-8)}`;
    const result = await pool.query(
      `INSERT INTO tenant_bank_cash_entries (tenant_id, account_id, date, type, amount, linked_party, reference_no, note, voucher_no)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [tenantId, accountId, date || new Date().toISOString().split('T')[0], type, Number(amount), linkedParty || '', referenceNo || '', note || '', voucherNo]
    );
    // Mirror transfer to destination if Transfer Out
    if (type === 'Transfer Out' && destinationAccountId) {
      await pool.query(
        `INSERT INTO tenant_bank_cash_entries (tenant_id, account_id, date, type, amount, linked_party, reference_no, note, voucher_no)
         VALUES ($1, $2, $3, 'Transfer In', $4, $5, $6, $7, $8)`,
        [tenantId, destinationAccountId, date || new Date().toISOString().split('T')[0], Number(amount), linkedParty || '', referenceNo || '', note || '', voucherNo]
      );
    }
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── PETTY CASH FLOAT & ENTRIES ─────────────────────────────────────────────────

router.get('/api/tenant/ledger/petty-cash/floats/all', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    const floatRes = await pool.query(
      'SELECT * FROM tenant_petty_cash_floats WHERE tenant_id = $1',
      [tenantId]
    );
    res.json(floatRes.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/api/tenant/ledger/petty-cash/:custodianId', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { custodianId } = req.params;
  try {
    let floatRes = await pool.query(
      'SELECT * FROM tenant_petty_cash_floats WHERE tenant_id = $1 AND custodian_id = $2 ORDER BY id DESC LIMIT 1',
      [tenantId, custodianId]
    );
    let floatObj = floatRes.rows[0] || null;
    const entriesRes = await pool.query(
      'SELECT * FROM tenant_petty_cash_entries WHERE tenant_id = $1 AND custodian_id = $2 ORDER BY date DESC, id DESC',
      [tenantId, custodianId]
    );
    res.json({ float: floatObj, entries: entriesRes.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenant/ledger/petty-cash/float', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { custodianId, siteId, openingAmount } = req.body;
  if (!custodianId || !siteId) return res.status(400).json({ error: 'custodianId and siteId are required' });
  try {
    const result = await pool.query(
      `INSERT INTO tenant_petty_cash_floats (tenant_id, custodian_id, site_id, opening_amount, current_balance)
       VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT (tenant_id, custodian_id) DO UPDATE SET opening_amount = EXCLUDED.opening_amount, current_balance = EXCLUDED.opening_amount
       RETURNING *`,
      [tenantId, custodianId, siteId, Number(openingAmount || 0)]
    );
    const floatId = result.rows[0].id;
    // Record the issuance as first entry
    await pool.query(
      `INSERT INTO tenant_petty_cash_entries (tenant_id, float_id, custodian_id, date, type, category, project_tag, amount, voucher_no, note)
       VALUES ($1, $2, $3, $4, 'Issue', 'Float Setup', 'Overhead', $5, $6, 'Initial float allocation')`,
      [tenantId, floatId, custodianId, new Date().toISOString().split('T')[0], Number(openingAmount || 0), `PC-FLOAT-${Date.now().toString().slice(-6)}`]
    );
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── ASSETS REGISTRY ────────────────────────────────────────────────────────────

router.get('/api/tenant/assets', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_assets (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL DEFAULT 1,
        description VARCHAR(255) NOT NULL,
        purchase_cost NUMERIC(15,2) DEFAULT 0,
        purchase_date VARCHAR(50),
        useful_life_years INTEGER DEFAULT 5,
        assigned_project_id VARCHAR(50) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const dbRes = await pool.query(
      'SELECT id, description, purchase_cost AS "purchaseCost", purchase_date AS "purchaseDate", useful_life_years AS "usefulLifeYears", assigned_project_id AS "assignedProjectId", created_at FROM tenant_assets WHERE tenant_id = $1 ORDER BY id DESC',
      [tenantId]
    );
    res.json(dbRes.rows);
  } catch (err: any) {
    console.error("Error fetching assets:", err.message);
    res.json([]);
  }
});

router.post('/api/tenant/assets', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { description, purchaseCost, purchaseDate, usefulLifeYears, assignedProjectId } = req.body;
  if (!description || !purchaseCost) return res.status(400).json({ error: 'description and purchaseCost are required' });
  try {
    const result = await pool.query(
      `INSERT INTO tenant_assets (tenant_id, description, purchase_cost, purchase_date, useful_life_years, assigned_project_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenantId, description, Number(purchaseCost || 0), purchaseDate || new Date().toISOString().split('T')[0], Number(usefulLifeYears || 5), assignedProjectId || '']
    );
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── STOCK ITEMS MASTER ──────────────────────────────────────────────────────────

router.get('/api/tenant/stock/items', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_stock_items (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        unit_of_measure VARCHAR(50) DEFAULT 'Piece',
        category VARCHAR(100) DEFAULT 'General',
        current_stock NUMERIC(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const dbRes = await pool.query(
      'SELECT id, name, unit_of_measure AS "unitOfMeasure", category, current_stock AS "currentStock", created_at FROM tenant_stock_items WHERE tenant_id = $1 ORDER BY id ASC',
      [tenantId]
    );
    res.json(dbRes.rows);
  } catch (err: any) {
    console.error("Error fetching stock items:", err.message);
    res.json([]);
  }
});

router.post('/api/tenant/stock/items', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { name, unitOfMeasure, category } = req.body;
  if (!name) return res.status(400).json({ error: 'Item name is required' });
  try {
    const result = await pool.query(
      `INSERT INTO tenant_stock_items (tenant_id, name, unit_of_measure, category, current_stock)
       VALUES ($1, $2, $3, $4, 0) RETURNING *`,
      [tenantId, name, unitOfMeasure || 'Piece', category || 'General']
    );
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenant/ledger/petty-cash/entry', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { floatId: passedFloatId, custodianId: passedCustodianId, amount, date, type, category, mode, projectTag, note, billReference } = req.body;
  if (!amount || !type) return res.status(400).json({ error: 'amount and type are required' });
  try {
    let floatId = passedFloatId;
    let custodianId = passedCustodianId;

    // Verify if passedFloatId exists in database
    if (floatId) {
      const checkFloat = await pool.query('SELECT id, custodian_id FROM tenant_petty_cash_floats WHERE id = $1 AND tenant_id = $2', [floatId, tenantId]);
      if (checkFloat.rows.length === 0) {
        floatId = null; // Stale floatId passed
      } else {
        if (!custodianId) custodianId = checkFloat.rows[0].custodian_id;
      }
    }

    // If floatId is missing but custodianId is provided, find or create float for custodian
    if (!floatId && custodianId) {
      const existingFloat = await pool.query('SELECT id FROM tenant_petty_cash_floats WHERE custodian_id = $1 AND tenant_id = $2', [custodianId, tenantId]);
      if (existingFloat.rows.length > 0) {
        floatId = existingFloat.rows[0].id;
      } else {
        const newFloat = await pool.query(
          `INSERT INTO tenant_petty_cash_floats (tenant_id, custodian_id, site_id, opening_amount, current_balance)
           VALUES ($1, $2, 'WKS-001', 50000, 50000) RETURNING id`,
          [tenantId, custodianId]
        );
        floatId = newFloat.rows[0].id;
      }
    }

    if (!custodianId) return res.status(400).json({ error: 'Custodian ID is required' });

    const voucherNo = `PC-${Date.now().toString().slice(-8)}`;
    const result = await pool.query(
      `INSERT INTO tenant_petty_cash_entries (tenant_id, float_id, custodian_id, date, type, category, mode, project_tag, amount, voucher_no, note, bill_reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [tenantId, floatId || null, custodianId, date || new Date().toISOString().split('T')[0], type, category || 'General', mode || 'Cash', projectTag || 'Overhead', Number(amount), voucherNo, note || '', billReference || '']
    );

    // Update float balance if float exists
    if (floatId) {
      const delta = (type === 'Replenishment') ? Number(amount) : -Number(amount);
      await pool.query('UPDATE tenant_petty_cash_floats SET current_balance = current_balance + $1 WHERE id = $2', [delta, floatId]);
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error inserting petty cash entry:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/tenant/ledger/petty-cash/entry/:entryId/reverse', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { entryId } = req.params;
  const { reason } = req.body;
  try {
    await pool.query('ALTER TABLE tenant_petty_cash_entries ADD COLUMN IF NOT EXISTS reversal_reason TEXT DEFAULT \'\';');
    await pool.query("UPDATE tenant_petty_cash_entries SET status = 'Reversed', reversal_reason = $1 WHERE id = $2 AND tenant_id = $3", [reason || '', entryId, tenantId]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── CLIENT STATEMENT ────────────────────────────────────────────────────────────

router.get('/api/tenant/ledger/client/:clientId', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { clientId } = req.params;
  try {
    const stmtRes = await pool.query(
      `SELECT *, (SELECT COALESCE(SUM(CASE WHEN type='Invoice' OR type='Debit Note' THEN amount ELSE -amount END), 0) FROM tenant_client_ledger_entries WHERE client_id = $1 AND tenant_id = $2 AND id <= e.id) AS running_balance
       FROM tenant_client_ledger_entries e WHERE e.client_id = $1 AND e.tenant_id = $2 ORDER BY date DESC, id DESC`,
      [clientId, tenantId]
    );
    const outstanding = stmtRes.rows.reduce((acc: number, e: any) => {
      if (e.type === 'Invoice' || e.type === 'Debit Note') return acc + Number(e.amount || 0);
      return acc - Number(e.amount || 0);
    }, 0);
    res.json({ statement: stmtRes.rows, outstanding });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenant/ledger/client/entry', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { clientId, amount, date, type, projectTag, note } = req.body;
  if (!clientId || !amount || !type) return res.status(400).json({ error: 'clientId, amount, and type are required' });
  try {
    const voucherNo = `CLT-${Date.now().toString().slice(-8)}`;
    const result = await pool.query(
      `INSERT INTO tenant_client_ledger_entries (tenant_id, client_id, date, type, amount, project_tag, note, voucher_no)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [tenantId, clientId, date || new Date().toISOString().split('T')[0], type, Number(amount), projectTag || 'Overhead', note || '', voucherNo]
    );
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenant/ledger/client/entry/:entryId/reverse', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { entryId } = req.params;
  const { reason } = req.body;
  try {
    await pool.query("UPDATE tenant_client_ledger_entries SET status = 'Reversed', note = CONCAT(note, ' | REVERSED: ', $1) WHERE id = $2 AND tenant_id = $3", [reason || '', entryId, tenantId]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── VENDOR STATEMENT ────────────────────────────────────────────────────────────

router.get('/api/tenant/ledger/vendor/:vendorId', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { vendorId } = req.params;
  try {
    const stmtRes = await pool.query(
      `SELECT * FROM tenant_vendor_ledger_entries WHERE vendor_id = $1 AND tenant_id = $2 ORDER BY entry_date DESC, id DESC`,
      [vendorId, tenantId]
    );
    const outstanding = stmtRes.rows.reduce((acc: number, e: any) => {
      if (e.type === 'Bill' || e.type === 'Debit Note') return acc + Number(e.amount || 0);
      return acc - Number(e.amount || 0);
    }, 0);
    // Normalise field names for frontend
    const statement = stmtRes.rows.map((e: any) => ({
      ...e,
      date: e.entry_date || e.date,
      note: e.description || e.note,
      voucher_no: e.reference_no || e.voucher_no || `VND-${e.id}`
    }));
    res.json({ statement, outstanding });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenant/ledger/vendor/entry', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { vendorId, amount, date, type, projectTag, note } = req.body;
  if (!vendorId || !amount || !type) return res.status(400).json({ error: 'vendorId, amount, and type are required' });
  try {
    const voucherNo = `VND-${Date.now().toString().slice(-8)}`;
    const result = await pool.query(
      `INSERT INTO tenant_vendor_ledger_entries (tenant_id, vendor_id, entry_date, type, amount, project_id, description, reference_no)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [tenantId, vendorId, date || new Date().toISOString().split('T')[0], type, Number(amount), projectTag || 'Overhead', note || '', voucherNo]
    );
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenant/ledger/vendor/entry/:entryId/reverse', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { entryId } = req.params;
  const { reason } = req.body;
  try {
    await pool.query("UPDATE tenant_vendor_ledger_entries SET description = CONCAT(description, ' | REVERSED: ', $1) WHERE id = $2 AND tenant_id = $3", [reason || '', entryId, tenantId]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── EMPLOYEE ADVANCES ───────────────────────────────────────────────────────────

router.get('/api/tenant/ledger/employee/:employeeId', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { employeeId } = req.params;
  try {
    const stmtRes = await pool.query(
      'SELECT * FROM tenant_employee_advances WHERE tenant_id = $1 AND employee_id = $2 ORDER BY date DESC, id DESC',
      [tenantId, employeeId]
    );
    const balance = stmtRes.rows.reduce((acc: number, e: any) => {
      if (e.type === 'Salary Advance' || e.type === 'Petty Cash Advance') return acc + Number(e.amount || 0);
      return acc - Number(e.amount || 0);
    }, 0);
    res.json({ statement: stmtRes.rows, balance });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenant/ledger/employee/entry', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { employeeId, amount, date, type, note } = req.body;
  if (!employeeId || !amount || !type) return res.status(400).json({ error: 'employeeId, amount, and type are required' });
  try {
    const voucherNo = `EMP-${Date.now().toString().slice(-8)}`;
    const result = await pool.query(
      `INSERT INTO tenant_employee_advances (tenant_id, employee_id, date, type, amount, note, voucher_no)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenantId, employeeId, date || new Date().toISOString().split('T')[0], type, Number(amount), note || '', voucherNo]
    );
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenant/ledger/employee/entry/:entryId/reverse', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { entryId } = req.params;
  const { reason } = req.body;
  try {
    await pool.query("UPDATE tenant_employee_advances SET status = 'Reversed', note = CONCAT(note, ' | REVERSED: ', $1) WHERE id = $2 AND tenant_id = $3", [reason || '', entryId, tenantId]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GENERAL LEDGER ACCOUNTS ─────────────────────────────────────────────────────

router.get('/api/tenant/ledger/company-ledgers', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    const dbRes = await pool.query(
      `SELECT id, tenant_id, name, ledger_code AS "ledgerCode", type, opening_balance AS "openingBalance", current_balance AS "currentBalance", balance_type AS "balanceType", status, description, project_id AS "projectId", department, responsible_person AS "responsiblePerson", ledger_category AS "ledgerCategory", overall_cost AS "overallCost", advance_paid AS "advancePaid", company_category AS "companyCategory", company_category AS "groupName", company_category AS "group_name", bank_name AS "bankName", account_number AS "accountNumber", ifsc_code AS "ifscCode", branch_name AS "branchName", custodian_name AS "custodianName", gstin, address, contact_info AS "contactInfo", payment_terms AS "paymentTerms", created_at,
        (SELECT COALESCE(SUM(debit_amount - credit_amount), 0) FROM tenant_ledger_entries WHERE ledger_code = a.ledger_code AND tenant_id = $1) + opening_balance AS "currentBalance"
       FROM tenant_ledger_accounts a WHERE tenant_id = $1 ORDER BY id DESC`,
      [tenantId]
    );
    res.json(dbRes.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/api/tenant/ledger/project-ledgers/:projectId', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { projectId } = req.params;
  try {
    const dbRes = await pool.query(
      `SELECT id, tenant_id, name, ledger_code AS "ledgerCode", type, opening_balance AS "openingBalance", current_balance AS "currentBalance", balance_type AS "balanceType", status, description, project_id AS "projectId", department, responsible_person AS "responsiblePerson", ledger_category AS "ledgerCategory", overall_cost AS "overallCost", advance_paid AS "advancePaid", company_category AS "companyCategory", company_category AS "groupName", company_category AS "group_name", bank_name AS "bankName", account_number AS "accountNumber", ifsc_code AS "ifscCode", branch_name AS "branchName", custodian_name AS "custodianName", gstin, address, contact_info AS "contactInfo", payment_terms AS "paymentTerms", created_at,
        (SELECT COALESCE(SUM(debit_amount - credit_amount), 0) FROM tenant_ledger_entries WHERE ledger_code = a.ledger_code AND tenant_id = $1) + opening_balance AS "currentBalance"
       FROM tenant_ledger_accounts a WHERE tenant_id = $1 AND project_id = $2 ORDER BY id DESC`,
      [tenantId, projectId]
    );
    res.json(dbRes.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenant/ledger/project-ledgers', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { name, ledgerCode, type, openingBalance, balanceType, status, description, projectId, department, responsiblePerson, ledgerCategory, overallCost, advancePaid, companyCategory, groupName, group_name, bankName, accountNumber, ifscCode, branchName, custodianName, gstin, address, contactInfo, paymentTerms } = req.body;
  if (!name || !ledgerCode) return res.status(400).json({ error: 'Ledger name and code are required' });
  const finalGroup = companyCategory || groupName || group_name || '';
  try {
    await pool.query('ALTER TABLE tenant_ledger_accounts ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);');
    await pool.query('ALTER TABLE tenant_ledger_accounts ADD COLUMN IF NOT EXISTS account_number VARCHAR(255);');
    await pool.query('ALTER TABLE tenant_ledger_accounts ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(255);');
    await pool.query('ALTER TABLE tenant_ledger_accounts ADD COLUMN IF NOT EXISTS branch_name VARCHAR(255);');
    await pool.query('ALTER TABLE tenant_ledger_accounts ADD COLUMN IF NOT EXISTS custodian_name VARCHAR(255);');
    await pool.query('ALTER TABLE tenant_ledger_accounts ADD COLUMN IF NOT EXISTS gstin VARCHAR(255);');
    await pool.query('ALTER TABLE tenant_ledger_accounts ADD COLUMN IF NOT EXISTS address TEXT;');
    await pool.query('ALTER TABLE tenant_ledger_accounts ADD COLUMN IF NOT EXISTS contact_info VARCHAR(255);');
    await pool.query('ALTER TABLE tenant_ledger_accounts ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(255);');

    const result = await pool.query(
      `INSERT INTO tenant_ledger_accounts (tenant_id, name, ledger_code, type, opening_balance, balance_type, status, description, project_id, department, responsible_person, ledger_category, overall_cost, advance_paid, company_category, bank_name, account_number, ifsc_code, branch_name, custodian_name, gstin, address, contact_info, payment_terms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24) RETURNING *`,
      [tenantId, name, ledgerCode, type || 'Expense', Number(openingBalance || 0), balanceType || 'Debit', status || 'Active', description || '', projectId || 'Overhead', department || '', responsiblePerson || '', ledgerCategory || 'Project', Number(overallCost || 0), Number(advancePaid || 0), finalGroup, bankName || '', accountNumber || '', ifscCode || '', branchName || '', custodianName || '', gstin || '', address || '', contactInfo || '', paymentTerms || '']
    );
    const row = result.rows[0];
    res.json({
      ...row,
      groupName: finalGroup,
      group_name: finalGroup,
      companyCategory: finalGroup,
      company_category: finalGroup
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── LEDGER GROUPS MASTER API ───────────────────────────────────────────────────

router.get('/api/tenant/ledger/groups', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_ledger_groups (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        group_code VARCHAR(100),
        parent_group VARCHAR(255) DEFAULT 'Primary',
        nature VARCHAR(100) DEFAULT 'Expenses',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const dbRes = await pool.query(
      'SELECT id, name, group_code AS "groupCode", parent_group AS "parentGroup", nature, description, created_at FROM tenant_ledger_groups WHERE tenant_id = $1 ORDER BY id DESC',
      [tenantId]
    );
    res.json(dbRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/tenant/ledger/groups', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { groupName, groupCode, parentGroup, nature, description } = req.body;
  if (!groupName) return res.status(400).json({ error: 'Group Name is required' });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_ledger_groups (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        group_code VARCHAR(100),
        parent_group VARCHAR(255) DEFAULT 'Primary',
        nature VARCHAR(100) DEFAULT 'Expenses',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const result = await pool.query(
      `INSERT INTO tenant_ledger_groups (tenant_id, name, group_code, parent_group, nature, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenantId, groupName, groupCode || `GRP-${Date.now().toString().slice(-6)}`, parentGroup || 'Primary', nature || 'Expenses', description || '']
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/tenant/ledger/entries/:ledgerCode', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { ledgerCode } = req.params;
  try {
    const dbRes = await pool.query(
      'SELECT * FROM tenant_ledger_entries WHERE tenant_id = $1 AND ledger_code = $2 ORDER BY date DESC, id DESC',
      [tenantId, ledgerCode]
    );
    res.json(dbRes.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenant/ledger/quick-transaction', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { ledgerCode, direction, amount, date, description, projectId, siteId, offsetLedgerCode } = req.body;
  if (!ledgerCode || !amount || !direction) return res.status(400).json({ error: 'ledgerCode, amount, and direction are required' });
  try {
    await pool.query('ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS site_id VARCHAR(50);');
    await pool.query("ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'INVOICE_RAISED';");
    await pool.query('ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS paid_date VARCHAR(50);');
    const voucherNo = `QT-${Date.now().toString().slice(-8)}`;
    const debitAmt = direction === 'Debit' ? Number(amount) : 0;
    const creditAmt = direction === 'Credit' ? Number(amount) : 0;
    await pool.query(
      `INSERT INTO tenant_ledger_entries (tenant_id, ledger_code, date, debit_amount, credit_amount, description, project_id, site_id, voucher_no, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [tenantId, ledgerCode, date || new Date().toISOString().split('T')[0], debitAmt, creditAmt, description || '', projectId || 'Overhead', siteId || '', voucherNo, 'INVOICE_RAISED']
    );
    // Mirror offset entry (double-entry)
    if (offsetLedgerCode) {
      await pool.query(
        `INSERT INTO tenant_ledger_entries (tenant_id, ledger_code, date, debit_amount, credit_amount, description, project_id, site_id, voucher_no, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [tenantId, offsetLedgerCode, date || new Date().toISOString().split('T')[0], creditAmt, debitAmt, description || '', projectId || 'Overhead', siteId || '', voucherNo, 'INVOICE_RAISED']
      );
    }
    // Update account current balance for target ledger
    await pool.query(
      `UPDATE tenant_ledger_accounts SET current_balance = opening_balance + (SELECT COALESCE(SUM(debit_amount - credit_amount), 0) FROM tenant_ledger_entries WHERE ledger_code = $1 AND tenant_id = $2) WHERE ledger_code = $1 AND tenant_id = $2`,
      [ledgerCode, tenantId]
    );
    // Update account current balance for offset ledger (Bank/Cash)
    if (offsetLedgerCode) {
      await pool.query(
        `UPDATE tenant_ledger_accounts SET current_balance = opening_balance + (SELECT COALESCE(SUM(debit_amount - credit_amount), 0) FROM tenant_ledger_entries WHERE ledger_code = $1 AND tenant_id = $2) WHERE ledger_code = $1 AND tenant_id = $2`,
        [offsetLedgerCode, tenantId]
      );
    }
    res.json({ success: true, voucherNo });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/tenant/ledger/purge-all', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  try {
    await pool.query("TRUNCATE TABLE tenant_ledger_accounts, tenant_ledger_entries RESTART IDENTITY CASCADE;");
    await pool.query("TRUNCATE TABLE tenant_journal_vouchers, tenant_journal_entries RESTART IDENTITY CASCADE;");
    await pool.query("TRUNCATE TABLE tenant_bank_cash_accounts, tenant_bank_cash_entries RESTART IDENTITY CASCADE;");
    await pool.query("TRUNCATE TABLE tenant_petty_cash_floats, tenant_petty_cash_entries RESTART IDENTITY CASCADE;");
    await pool.query("TRUNCATE TABLE tenant_stock_items RESTART IDENTITY CASCADE;");
    await pool.query("TRUNCATE TABLE tenant_assets RESTART IDENTITY CASCADE;");
    res.json({ success: true, message: 'All ledger data purged successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/tenant/ledger/entries/mark-paid', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { entryId, voucherNo, status, paidDate, offsetLedgerCode } = req.body;
  try {
    await pool.query("ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'INVOICE_RAISED';");
    await pool.query('ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS paid_date VARCHAR(50);');
    const pDate = paidDate || new Date().toISOString().split('T')[0];
    const newStatus = status || 'PAID';

    await pool.query(
      `UPDATE tenant_ledger_entries 
       SET status = $1, paid_date = $2 
       WHERE tenant_id = $3 AND (id = $4 OR (voucher_no IS NOT NULL AND voucher_no = $5))`,
      [newStatus, pDate, tenantId, Number(entryId) || 0, voucherNo || '']
    );

    if (offsetLedgerCode) {
      const origRes = await pool.query('SELECT * FROM tenant_ledger_entries WHERE id = $1 AND tenant_id = $2', [Number(entryId) || 0, tenantId]);
      if (origRes.rows.length > 0) {
        const orig = origRes.rows[0];
        const contraVoucher = `SETTLE-${voucherNo || orig.voucher_no || Date.now()}`;
        await pool.query(
          `INSERT INTO tenant_ledger_entries (tenant_id, ledger_code, date, debit_amount, credit_amount, description, project_id, voucher_no, status, paid_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [tenantId, offsetLedgerCode, pDate, orig.credit_amount || 0, orig.debit_amount || 0, `Settlement for voucher ${voucherNo || orig.voucher_no || ''}`, orig.project_id || 'Overhead', contraVoucher, 'PAID', pDate]
        );
        await pool.query(
          `UPDATE tenant_ledger_accounts SET current_balance = opening_balance + (SELECT COALESCE(SUM(debit_amount - credit_amount), 0) FROM tenant_ledger_entries WHERE ledger_code = $1 AND tenant_id = $2) WHERE ledger_code = $1 AND tenant_id = $2`,
          [offsetLedgerCode, tenantId]
        );
      }
    }

    res.json({ success: true, status: newStatus, paidDate: pDate });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── JOURNAL VOUCHERS ────────────────────────────────────────────────────────────

router.get('/api/tenant/ledger/journal-vouchers', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    const dbRes = await pool.query('SELECT * FROM tenant_journal_vouchers WHERE tenant_id = $1 ORDER BY date DESC, id DESC', [tenantId]);
    const vouchers = await Promise.all(dbRes.rows.map(async (jv: any) => {
      const entriesRes = await pool.query('SELECT * FROM tenant_journal_entries WHERE journal_id = $1 ORDER BY id ASC', [jv.id]);
      return { ...jv, entries: entriesRes.rows };
    }));
    res.json(vouchers);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenant/ledger/journal-vouchers', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { date, description, projectId, entries } = req.body;
  if (!entries || entries.length < 2) return res.status(400).json({ error: 'At least 2 ledger entries are required for a journal voucher' });
  try {
    const jvNo = `JV-${Date.now().toString().slice(-8)}`;
    const jvRes = await pool.query(
      `INSERT INTO tenant_journal_vouchers (tenant_id, date, description, project_id, voucher_no) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, date || new Date().toISOString().split('T')[0], description || '', projectId || 'Overhead', jvNo]
    );
    const jvId = jvRes.rows[0].id;
    for (const entry of entries) {
      await pool.query(
        `INSERT INTO tenant_journal_entries (tenant_id, journal_id, account_id, account_type, debit_amount, credit_amount, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tenantId, jvId, entry.accountId || '', entry.accountType || 'expense', Number(entry.debitAmount || 0), Number(entry.creditAmount || 0), entry.note || '']
      );
    }
    res.json({ ...jvRes.rows[0], entries });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── DEBIT & CREDIT NOTES REGISTER ──────────────────────────────────────────────

router.get('/api/tenant/ledger/debit-notes', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    const vendorNotes = await pool.query(
      `SELECT e.id, e.entry_date AS date, e.reference_no AS voucher_no, e.amount, e.description AS note, e.project_id AS "projectId", v.name AS party_name, 'Vendor' AS party_type
       FROM tenant_vendor_ledger_entries e
       JOIN tenant_vendors v ON e.vendor_id = v.id
       WHERE e.tenant_id = $1 AND e.type = 'Debit Note'`,
      [tenantId]
    );
    const clientNotes = await pool.query(
      `SELECT e.id, e.date, e.voucher_no, e.amount, e.note, e.project_tag AS "projectId", c.name AS party_name, 'Client' AS party_type
       FROM tenant_client_ledger_entries e
       JOIN tenant_clients c ON c.id = (CASE WHEN e.client_id ~ '^[0-9a-fA-F-]{36}$' THEN e.client_id::uuid ELSE NULL END)
       WHERE e.tenant_id = $1 AND e.type = 'Debit Note'`,
      [tenantId]
    );
    const notes = [...vendorNotes.rows, ...clientNotes.rows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(notes);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/api/tenant/ledger/credit-notes', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    const vendorNotes = await pool.query(
      `SELECT e.id, e.entry_date AS date, e.reference_no AS voucher_no, e.amount, e.description AS note, e.project_id AS "projectId", v.name AS party_name, 'Vendor' AS party_type
       FROM tenant_vendor_ledger_entries e
       JOIN tenant_vendors v ON e.vendor_id = v.id
       WHERE e.tenant_id = $1 AND e.type = 'Credit Note'`,
      [tenantId]
    );
    const clientNotes = await pool.query(
      `SELECT e.id, e.date, e.voucher_no, e.amount, e.note, e.project_tag AS "projectId", c.name AS party_name, 'Client' AS party_type
       FROM tenant_client_ledger_entries e
       JOIN tenant_clients c ON c.id = (CASE WHEN e.client_id ~ '^[0-9a-fA-F-]{36}$' THEN e.client_id::uuid ELSE NULL END)
       WHERE e.tenant_id = $1 AND e.type = 'Credit Note'`,
      [tenantId]
    );
    const notes = [...vendorNotes.rows, ...clientNotes.rows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(notes);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── TRIAL BALANCE ────────────────────────────────────────────────────────────────

router.get('/api/tenant/ledger/trial-balance', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    const accountsRes = await pool.query(
      `SELECT a.name, a.ledger_code, a.type, a.balance_type,
        a.opening_balance + COALESCE(SUM(e.debit_amount - e.credit_amount), 0) AS closing_balance,
        COALESCE(SUM(e.debit_amount), 0) AS total_debit,
        COALESCE(SUM(e.credit_amount), 0) AS total_credit
       FROM tenant_ledger_accounts a
       LEFT JOIN tenant_ledger_entries e ON e.ledger_code = a.ledger_code AND e.tenant_id = $1
       WHERE a.tenant_id = $1
       GROUP BY a.id, a.name, a.ledger_code, a.type, a.balance_type, a.opening_balance
       ORDER BY a.type, a.name`,
      [tenantId]
    );
    res.json(accountsRes.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── PERIOD CLOSINGS ─────────────────────────────────────────────────────────────

router.get('/api/tenant/ledger/period-closings', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    const dbRes = await pool.query('SELECT * FROM tenant_period_closings WHERE tenant_id = $1 ORDER BY closing_date DESC', [tenantId]);
    res.json(dbRes.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── FINANCIAL REPORTS ──────────────────────────────────────────────────────────

router.get('/api/tenant/ledger/reports/income-statement', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    const revRes = await pool.query(
      `SELECT COALESCE(SUM(e.credit_amount - e.debit_amount), 0) as revenue
       FROM tenant_ledger_accounts a JOIN tenant_ledger_entries e ON e.ledger_code = a.ledger_code AND e.tenant_id = $1
       WHERE a.tenant_id = $1 AND a.type IN ('Income', 'Revenue')`,
      [tenantId]
    );
    const expRes = await pool.query(
      `SELECT COALESCE(SUM(e.debit_amount - e.credit_amount), 0) as expenses
       FROM tenant_ledger_accounts a JOIN tenant_ledger_entries e ON e.ledger_code = a.ledger_code AND e.tenant_id = $1
       WHERE a.tenant_id = $1 AND a.type = 'Expense'`,
      [tenantId]
    );
    const revenue = Number(revRes.rows[0]?.revenue || 0);
    const expenses = Number(expRes.rows[0]?.expenses || 0);
    res.json({ revenue, expenses, netProfit: revenue - expenses });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/api/tenant/ledger/reports/balance-sheet', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    const dbRes = await pool.query(
      `SELECT a.name, a.type, a.ledger_code,
        a.opening_balance + COALESCE(SUM(e.debit_amount - e.credit_amount), 0) AS balance
       FROM tenant_ledger_accounts a
       LEFT JOIN tenant_ledger_entries e ON e.ledger_code = a.ledger_code AND e.tenant_id = $1
       WHERE a.tenant_id = $1 AND a.type IN ('Bank','Cash','Receivable','Payable','Asset','Liability')
       GROUP BY a.id, a.name, a.type, a.ledger_code, a.opening_balance
       ORDER BY a.type, a.name`,
      [tenantId]
    );
    res.json(dbRes.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── DASHBOARD SUMMARY ──────────────────────────────────────────────────────────

router.get('/api/tenant/ledger/dashboard-summary', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    const bankRes = await pool.query(
      `SELECT COALESCE(SUM(opening_balance + (SELECT COALESCE(SUM(CASE WHEN type='Deposit' OR type='Transfer In' THEN amount ELSE -amount END), 0) FROM tenant_bank_cash_entries WHERE account_id = a.id)), 0) AS total
       FROM tenant_bank_cash_accounts a WHERE tenant_id = $1`,
      [tenantId]
    );
    const pettyRes = await pool.query(
      `SELECT COALESCE(SUM(current_balance), 0) AS total FROM tenant_petty_cash_floats WHERE tenant_id = $1`,
      [tenantId]
    );
    const clientRes = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN type IN ('Invoice','Debit Note') THEN amount ELSE -amount END), 0) AS total FROM tenant_client_ledger_entries WHERE tenant_id = $1`,
      [tenantId]
    );
    const vendorRes = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN type IN ('Bill','Debit Note') THEN amount ELSE -amount END), 0) AS total FROM tenant_vendor_ledger_entries WHERE tenant_id = $1`,
      [tenantId]
    );
    const employeeRes = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN type IN ('Salary Advance','Petty Cash Advance') THEN amount ELSE -amount END), 0) AS total FROM tenant_employee_advances WHERE tenant_id = $1`,
      [tenantId]
    );
    const bankTotal = Number(bankRes.rows[0]?.total || 0);
    const pettyTotal = Number(pettyRes.rows[0]?.total || 0);
    const clientTotal = Number(clientRes.rows[0]?.total || 0);
    const vendorTotal = Number(vendorRes.rows[0]?.total || 0);
    const employeeTotal = Number(employeeRes.rows[0]?.total || 0);
    res.json({
      bankTotal, pettyTotal, clientTotal, vendorTotal, employeeTotal,
      netPosition: bankTotal + pettyTotal - vendorTotal,
      activity: []
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── PROJECT P&L ─────────────────────────────────────────────────────────────────

router.get('/api/tenant/ledger/project/:projectId', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { projectId } = req.params;
  try {
    const costRes = await pool.query(
      `SELECT COALESCE(SUM(e.debit_amount - e.credit_amount), 0) AS total_cost
       FROM tenant_ledger_accounts a JOIN tenant_ledger_entries e ON e.ledger_code = a.ledger_code AND e.tenant_id = $1
       WHERE a.tenant_id = $1 AND a.project_id = $2 AND a.type = 'Expense'`,
      [tenantId, projectId]
    );
    const revRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS invoices_raised FROM tenant_client_ledger_entries WHERE tenant_id = $1 AND project_tag = $2 AND type = 'Invoice'`,
      [tenantId, projectId]
    );
    const totalCost = Number(costRes.rows[0]?.total_cost || 0);
    const invoicesRaised = Number(revRes.rows[0]?.invoices_raised || 0);
    res.json({ totalCost, revenue: { invoicesRaised }, profitLoss: invoicesRaised - totalCost });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/api/tenant/ledger/project/:projectId/history', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { projectId } = req.params;
  try {
    // Gather transactions from multiple sources
    const ledgerRows = await pool.query(
      `SELECT e.date::text, e.voucher_no, e.description AS note, e.debit_amount AS amount, 'Ledger Entry' AS source, a.type
       FROM tenant_ledger_entries e 
       JOIN tenant_ledger_accounts a ON a.ledger_code = e.ledger_code AND a.tenant_id = $1
       WHERE e.tenant_id = $1 AND a.project_id = $2`,
      [tenantId, projectId]
    );
    const pettyRows = await pool.query(
      `SELECT e.date::text, e.voucher_no, e.note, e.amount, 'Petty Cash' AS source, e.type 
       FROM tenant_petty_cash_entries e 
       JOIN tenant_petty_cash_floats f ON e.float_id = f.id
       WHERE f.tenant_id = $1 AND e.project_tag = $2`,
      [tenantId, projectId]
    );
    const vendorRows = await pool.query(
      `SELECT date::text, voucher_no, note, amount, 'Vendor Bill' AS source, type 
       FROM tenant_vendor_ledger_entries 
       WHERE tenant_id = $1 AND project_id = $2`,
      [tenantId, projectId]
    );
    const clientRows = await pool.query(
      `SELECT date::text, voucher_no, note, amount, 'Client Receipt' AS source, type 
       FROM tenant_client_ledger_entries 
       WHERE tenant_id = $1 AND project_id = $2`,
      [tenantId, projectId]
    );
    const history = [
      ...ledgerRows.rows.map((r: any) => ({ ...r, status: 'Posted' })),
      ...pettyRows.rows.map((r: any) => ({ ...r, status: 'Posted' })),
      ...vendorRows.rows.map((r: any) => ({ ...r, status: 'Posted' })),
      ...clientRows.rows.map((r: any) => ({ ...r, status: 'Posted' }))
    ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    res.json(history);
  } catch (err: any) {
    console.error("Error in project history:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
