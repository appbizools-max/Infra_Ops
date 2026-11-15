import { pool } from './db';

export async function initDb() {
  console.log('🔄 Initializing database schema and migrations...');
  
  // ── PHASE 1: CORE TENANTS & BASE SCHEMA ──────────────────────────────
// Ensure core tables and complete columns exist before ALTER TABLE migrations run
pool.query(`
  CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    price_monthly DECIMAL DEFAULT 0,
    included_tonnage INTEGER DEFAULT 0,
    included_equipment INTEGER DEFAULT 0,
    additional_tonnage_price DECIMAL DEFAULT 0,
    additional_equipment_price DECIMAL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    company_name VARCHAR(255),
    email VARCHAR(255),
    subdomain VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    industry_type VARCHAR(255),
    country VARCHAR(255),
    state VARCHAR(255),
    pincode VARCHAR(50),
    city VARCHAR(255),
    company_website VARCHAR(255),
    company_size VARCHAR(50),
    company_code VARCHAR(50),
    company_address TEXT,
    gst_number VARCHAR(100),
    pan_number VARCHAR(100),
    msme_number VARCHAR(100),
    subscription_plan_id INTEGER,
    trial_ends_at TIMESTAMP,
    payment_status VARCHAR(50) DEFAULT 'active',
    razorpay_payment_id VARCHAR(255),
    razorpay_order_id VARCHAR(255),
    custom_fields JSONB,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tenant_admins (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    firebase_uid VARCHAR(255) UNIQUE,
    admin_name VARCHAR(255) NOT NULL,
    designation VARCHAR(255),
    mobile VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tenant_drafts (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    draft_data TEXT NOT NULL,
    step INTEGER DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).then(async () => {
  const migrations = [
    'ALTER TABLE tenant_drafts ADD CONSTRAINT unique_firebase_uid UNIQUE (firebase_uid);',
    'ALTER TABLE tenants ALTER COLUMN name DROP NOT NULL;',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS industry_type VARCHAR(255);',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS country VARCHAR(255);',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state VARCHAR(255);',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pincode VARCHAR(50);',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city VARCHAR(255);',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_website VARCHAR(255);',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_size VARCHAR(50);',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_code VARCHAR(50);',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_address TEXT;',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS gst_number VARCHAR(100);',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pan_number VARCHAR(100);',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS msme_number VARCHAR(100);',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_plan_id INTEGER REFERENCES subscription_plans(id);',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subdomain VARCHAR(255) UNIQUE;',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT \'active\';',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255);',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255);',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_fields JSONB;',
    'UPDATE tenants SET company_name = name WHERE company_name IS NULL AND name IS NOT NULL;'
  ];

  for (const sql of migrations) {
    try { await pool.query(sql); } catch (_) { }
  }
  console.log('✅ Core tenants, subscription plans, and admin schema verified.');
}).catch(err => console.error('Database startup notice:', err.message));

// Check/Create tenant_users table
pool.query(`
  CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    role VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    email VARCHAR(200) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'Active',
    member_id VARCHAR(50),
    firebase_uid VARCHAR(128) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_email UNIQUE (tenant_id, email),
    CONSTRAINT unique_tenant_mobile UNIQUE (tenant_id, mobile)
  );
`).then(() => {
  console.log('Checked/Created tenant_users table');
  pool.query(`
    ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS permissions JSONB;
    ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS allowed_modules TEXT[];
    ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS landing_module VARCHAR;
  `).catch(() => { });
  // Create tenant_clients table
  pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      code VARCHAR(50) NOT NULL,
      legal_name VARCHAR(200),
      contact_person VARCHAR(200),
      mobile VARCHAR(20),
      email VARCHAR(200),
      website VARCHAR(200),
      billing_address TEXT,
      site_address TEXT,
      state VARCHAR(100),
      country VARCHAR(100),
      pincode VARCHAR(20),
      gst_number VARCHAR(20),
      pan_number VARCHAR(20),
      msme_status VARCHAR(50) DEFAULT 'Non-MSME',
      credit_limit NUMERIC(15, 2) DEFAULT 0.00,
      credit_days INTEGER DEFAULT 30,
      security_deposit NUMERIC(15, 2) DEFAULT 0.00,
      bank_guarantee TEXT,
      accounts_contact VARCHAR(200),
      finance_contact VARCHAR(200),
      status VARCHAR(20) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_tenant_client_code UNIQUE (tenant_id, code)
    );
  `).then(() => console.log('Checked/Created tenant_clients table'))
    .catch((e: any) => console.error('Error creating tenant_clients table:', e.message));

  // Create tenant_vendors table
  pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_vendors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      code VARCHAR(50) NOT NULL,
      vendor_type VARCHAR(100) NOT NULL,
      contact_person VARCHAR(200),
      mobile VARCHAR(20),
      email VARCHAR(200),
      bank_name VARCHAR(200),
      account_number VARCHAR(100),
      ifsc VARCHAR(50),
      gst_registered BOOLEAN DEFAULT false,
      gst_number VARCHAR(20),
      pan_number VARCHAR(20),
      tds_applicable BOOLEAN DEFAULT false,
      tds_section VARCHAR(50),
      hsn_sac VARCHAR(50),
      gst_percentage NUMERIC(5, 2) DEFAULT 0.00,
      tds_percentage NUMERIC(5, 2) DEFAULT 0.00,
      status VARCHAR(20) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_tenant_vendor_code UNIQUE (tenant_id, code)
    );
  `).then(() => console.log('Checked/Created tenant_vendors table'))
    .catch((e: any) => console.error('Error creating tenant_vendors table:', e.message));

  // Create tenant_expense_categories table
  pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_expense_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      category_type VARCHAR(100) NOT NULL,
      hsn_sac VARCHAR(50),
      gst_percentage NUMERIC(5, 2) DEFAULT 0.00,
      tds_percentage NUMERIC(5, 2) DEFAULT 0.00,
      gl_account VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_tenant_expense_cat UNIQUE (tenant_id, name)
    );
  `).then(() => console.log('Checked/Created tenant_expense_categories table'))
    .catch((e: any) => console.error('Error creating tenant_expense_categories table:', e.message));

}).catch((e: any) => console.error('Error creating tenant_users table:', e.message));


  // ── PHASE 2: EXTENDED TABLES, COLUMNS & LEDGERS ─────────────────────
  // ── CREATE FULL ACCOUNTANT LEDGER TABLES ────────────────────────────────────
  try {
    // Bank & Cash accounts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_bank_cash_accounts (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'Bank',
        opening_balance NUMERIC(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_bank_cash_entries (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        account_id INTEGER REFERENCES tenant_bank_cash_accounts(id) ON DELETE CASCADE,
        date VARCHAR(50) NOT NULL,
        type VARCHAR(100) NOT NULL,
        amount NUMERIC(15,2) DEFAULT 0,
        linked_party VARCHAR(255) DEFAULT '',
        reference_no VARCHAR(255) DEFAULT '',
        note TEXT DEFAULT '',
        voucher_no VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Posted',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Petty cash floats (new system)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_petty_cash_floats (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        custodian_id VARCHAR(255) NOT NULL,
        site_id VARCHAR(255) NOT NULL,
        opening_amount NUMERIC(15,2) DEFAULT 0,
        current_balance NUMERIC(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_tenant_custodian_float UNIQUE (tenant_id, custodian_id)
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_petty_cash_entries (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        custodian_id VARCHAR(255) NOT NULL,
        date VARCHAR(50) NOT NULL,
        type VARCHAR(100) NOT NULL,
        category VARCHAR(255) DEFAULT 'General',
        project_tag VARCHAR(255) DEFAULT 'Overhead',
        amount NUMERIC(15,2) DEFAULT 0,
        voucher_no VARCHAR(100),
        note TEXT DEFAULT '',
        bill_reference VARCHAR(255) DEFAULT '',
        status VARCHAR(50) DEFAULT 'Posted',
        reversal_reason TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Client ledger entries (new columns)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_client_ledger_entries (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        client_id VARCHAR(255) NOT NULL,
        date VARCHAR(50) NOT NULL,
        type VARCHAR(100) NOT NULL,
        amount NUMERIC(15,2) DEFAULT 0,
        project_tag VARCHAR(255) DEFAULT 'Overhead',
        note TEXT DEFAULT '',
        voucher_no VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Posted',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Employee advances
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_employee_advances (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        employee_id VARCHAR(255) NOT NULL,
        date VARCHAR(50) NOT NULL,
        type VARCHAR(100) NOT NULL,
        amount NUMERIC(15,2) DEFAULT 0,
        note TEXT DEFAULT '',
        voucher_no VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Posted',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // General ledger accounts master list
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_ledger_accounts (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        ledger_code VARCHAR(100) NOT NULL,
        type VARCHAR(100) DEFAULT 'Expense',
        opening_balance NUMERIC(15,2) DEFAULT 0,
        current_balance NUMERIC(15,2) DEFAULT 0,
        balance_type VARCHAR(20) DEFAULT 'Debit',
        status VARCHAR(50) DEFAULT 'Active',
        description TEXT DEFAULT '',
        project_id VARCHAR(255) DEFAULT 'Overhead',
        department VARCHAR(255) DEFAULT '',
        responsible_person VARCHAR(255) DEFAULT '',
        ledger_category VARCHAR(100) DEFAULT 'Project',
        overall_cost NUMERIC(15,2) DEFAULT 0,
        advance_paid NUMERIC(15,2) DEFAULT 0,
        company_category VARCHAR(255) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_tenant_ledger_code UNIQUE (tenant_id, ledger_code)
      );
    `);
    // General ledger entries (double-entry)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_ledger_entries (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        ledger_code VARCHAR(100) NOT NULL,
        date VARCHAR(50) NOT NULL,
        debit_amount NUMERIC(15,2) DEFAULT 0,
        credit_amount NUMERIC(15,2) DEFAULT 0,
        description TEXT DEFAULT '',
        project_id VARCHAR(255) DEFAULT 'Overhead',
        voucher_no VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Posted',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Journal vouchers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_journal_vouchers (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        date VARCHAR(50) NOT NULL,
        description TEXT DEFAULT '',
        project_id VARCHAR(255) DEFAULT 'Overhead',
        voucher_no VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_journal_entries (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        journal_id INTEGER REFERENCES tenant_journal_vouchers(id) ON DELETE CASCADE,
        account_id VARCHAR(255) NOT NULL,
        account_type VARCHAR(100) DEFAULT 'expense',
        debit_amount NUMERIC(15,2) DEFAULT 0,
        credit_amount NUMERIC(15,2) DEFAULT 0,
        note TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Period closings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_period_closings (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        closing_date VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'Closed',
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Purge ALL mock ledger accounts and entries to provide a 100% clean slate
    await pool.query("TRUNCATE TABLE tenant_ledger_accounts, tenant_ledger_entries RESTART IDENTITY CASCADE;");
    console.log('🧹 Purged all mock ledger accounts & entries! Clean slate ready.');
  } catch (ledgerDbErr) {
    console.error('❌ Failed to create accountant ledger tables:', ledgerDbErr);
  }

  // Create new simplified ledger tables
  await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_project_ledger_profiles (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        project_id VARCHAR(50) NOT NULL,
        total_cost NUMERIC(15,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_tenant_project_ledger UNIQUE (tenant_id, project_id)
      );
    `);

  await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_project_petty_cash (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        project_id VARCHAR(50) NOT NULL,
        person_name VARCHAR(255) NOT NULL,
        given NUMERIC(15,2) DEFAULT 0,
        used NUMERIC(15,2) DEFAULT 0,
        left_amount NUMERIC(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_tenant_project_person_pc UNIQUE (tenant_id, project_id, person_name)
      );
    `);

  await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_project_petty_cash_expenses (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        project_id VARCHAR(50) NOT NULL,
        person_name VARCHAR(255) NOT NULL,
        date VARCHAR(50) NOT NULL,
        category VARCHAR(255) NOT NULL,
        amount NUMERIC(15,2) DEFAULT 0,
        bill VARCHAR(255) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

  await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_payroll_ledgers (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        date VARCHAR(50) NOT NULL,
        employee VARCHAR(255) NOT NULL,
        amount NUMERIC(15,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Paid',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

  await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_company_petty_cash (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        date VARCHAR(50) NOT NULL,
        category VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        amount NUMERIC(15,2) DEFAULT 0,
        balance NUMERIC(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

  await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_loans_ledger (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        lender VARCHAR(255) NOT NULL,
        principal NUMERIC(15,2) DEFAULT 0,
        outstanding NUMERIC(15,2) DEFAULT 0,
        emi_amount NUMERIC(15,2) DEFAULT 0,
        start_date VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

  await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_loan_payments (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        loan_id INTEGER REFERENCES tenant_loans_ledger(id) ON DELETE CASCADE,
        amount NUMERIC(15,2) DEFAULT 0,
        date VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

  // Alter table schemas and ensure resilient table definitions
  try {
    await pool.query('ALTER TABLE tenant_vendor_ledger_entries ADD COLUMN IF NOT EXISTS project_id VARCHAR(50);');
    await pool.query('ALTER TABLE tenant_client_ledger_entries ADD COLUMN IF NOT EXISTS project_id VARCHAR(50);');
    await pool.query('ALTER TABLE tenant_petty_cash_entries ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;');
    await pool.query('ALTER TABLE tenant_petty_cash_entries ADD COLUMN IF NOT EXISTS custodian_id VARCHAR(255);');
    await pool.query('ALTER TABLE tenant_petty_cash_entries ADD COLUMN IF NOT EXISTS float_id INTEGER;');
    await pool.query('ALTER TABLE tenant_petty_cash_entries ALTER COLUMN float_id DROP NOT NULL;');
    await pool.query('ALTER TABLE tenant_petty_cash_entries ADD COLUMN IF NOT EXISTS date VARCHAR(50);');
    await pool.query('ALTER TABLE tenant_petty_cash_entries ADD COLUMN IF NOT EXISTS type VARCHAR(100);');
    await pool.query('ALTER TABLE tenant_petty_cash_entries ADD COLUMN IF NOT EXISTS category VARCHAR(255) DEFAULT \'General\';');
    await pool.query('ALTER TABLE tenant_petty_cash_entries ADD COLUMN IF NOT EXISTS project_tag VARCHAR(255) DEFAULT \'Overhead\';');
    await pool.query('ALTER TABLE tenant_petty_cash_entries ADD COLUMN IF NOT EXISTS amount NUMERIC(15,2) DEFAULT 0;');
    await pool.query('ALTER TABLE tenant_petty_cash_entries ADD COLUMN IF NOT EXISTS voucher_no VARCHAR(100);');
    await pool.query('ALTER TABLE tenant_petty_cash_entries ADD COLUMN IF NOT EXISTS note TEXT DEFAULT \'\';');
    await pool.query('ALTER TABLE tenant_petty_cash_entries ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'Posted\';');
    await pool.query('ALTER TABLE tenant_petty_cash_entries ADD COLUMN IF NOT EXISTS mode VARCHAR(50) DEFAULT \'Cash\';');
    await pool.query('ALTER TABLE tenant_petty_cash_entries ADD COLUMN IF NOT EXISTS reversal_reason TEXT DEFAULT \'\';');
    await pool.query('ALTER TABLE tenant_petty_cash_floats ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;');
    await pool.query('ALTER TABLE tenant_stock_items ADD COLUMN IF NOT EXISTS current_stock NUMERIC(15,2) DEFAULT 0;');

    // Create tenant_assets table if not exists
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

    // Create tenant_stock_items table if not exists
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
  } catch (alterErr: any) {
    console.warn('⚠️ Table column alter warning:', alterErr.message);
  }

  // Seeding default project ledger profiles, petty cash and company expenses safely
  try {
    const profilesCount = await pool.query('SELECT COUNT(*) as count FROM tenant_project_ledger_profiles');
    if (parseInt(profilesCount.rows[0]?.count || '0', 10) === 0) {
      const proj = await pool.query('SELECT project_id FROM tenant_projects LIMIT 1');
      if (proj.rows.length > 0) {
        const pId = proj.rows[0].project_id;

        await pool.query(
          `INSERT INTO tenant_project_ledger_profiles (tenant_id, project_id, total_cost, notes)
             VALUES (1, $1, 5000000, 'Main project budget and costing overview') ON CONFLICT DO NOTHING`,
          [pId]
        );

        await pool.query(
          `INSERT INTO tenant_project_petty_cash (tenant_id, project_id, person_name, given, used, left_amount)
             VALUES (1, $1, 'Ramesh (Supervisor)', 20000, 14500, 5500) ON CONFLICT DO NOTHING`,
          [pId]
        );
        await pool.query(
          `INSERT INTO tenant_project_petty_cash_expenses (tenant_id, project_id, person_name, date, category, amount, bill)
             VALUES (1, $1, 'Ramesh (Supervisor)', '2026-08-05', 'Material Expense', 10000, 'cement_delivery.pdf'),
                    (1, $1, 'Ramesh (Supervisor)', '2026-08-06', 'General Utilities', 4500, 'tea_snacks.pdf')`,
          [pId]
        );

        await pool.query(
          `INSERT INTO tenant_project_petty_cash (tenant_id, project_id, person_name, given, used, left_amount)
             VALUES (1, $1, 'Suresh (Site Incharge)', 15000, 15000, 0) ON CONFLICT DO NOTHING`,
          [pId]
        );
        await pool.query(
          `INSERT INTO tenant_project_petty_cash_expenses (tenant_id, project_id, person_name, date, category, amount, bill)
             VALUES (1, $1, 'Suresh (Site Incharge)', '2026-08-04', 'Transport & Fuel', 15000, 'fuel_mixer.pdf')`,
          [pId]
        );
      }
    }
  } catch (pErr: any) {
    console.log('Project ledger seeding notice:', pErr.message);
  }

  // Safely seed default ledgers if a tenant already exists
  try {
    const tenantCheck = await pool.query('SELECT id FROM tenants LIMIT 1');
    if (tenantCheck.rows.length > 0) {
      const tId = tenantCheck.rows[0].id;
      const payrollCount = await pool.query('SELECT COUNT(*) as count FROM tenant_payroll_ledgers');
      if (parseInt(payrollCount.rows[0]?.count || '0', 10) === 0) {
        await pool.query(`
            INSERT INTO tenant_payroll_ledgers (tenant_id, date, employee, amount, status)
            VALUES ($1, '2026-08-01', 'Ramesh', 35000, 'Paid'),
                   ($1, '2026-08-01', 'Suresh', 28000, 'Paid')
          `, [tId]);
      }

      const compPcCount = await pool.query('SELECT COUNT(*) as count FROM tenant_company_petty_cash');
      if (parseInt(compPcCount.rows[0]?.count || '0', 10) === 0) {
        await pool.query(`
            INSERT INTO tenant_company_petty_cash (tenant_id, date, category, type, amount, balance)
            VALUES ($1, '2026-08-01', 'Float Top-up', 'topup', 10000, 10000),
                   ($1, '2026-08-05', 'Office Supplies', 'expense', 1200, 8800)
          `, [tId]);
      }

      const loansCount = await pool.query('SELECT COUNT(*) as count FROM tenant_loans_ledger');
      if (parseInt(loansCount.rows[0]?.count || '0', 10) === 0) {
        await pool.query(`
            INSERT INTO tenant_loans_ledger (tenant_id, lender, principal, outstanding, emi_amount, start_date)
            VALUES ($1, 'ABC Finance Co.', 500000, 320000, 25000, '2026-04-01')
          `, [tId]);
      }
    }
  } catch (seedErr: any) {
    console.log('Ledger seeding notice:', seedErr.message);
  }

  // Create tenant_projects table if not exists
  try {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tenant_projects (
          id SERIAL PRIMARY KEY,
          project_id VARCHAR(50) NOT NULL UNIQUE,
          tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          location VARCHAR(255) NOT NULL,
          location_block VARCHAR(255),
          customer VARCHAR(255),
          commodity VARCHAR(255),
          contract_quantity VARCHAR(100),
          contract_quantity_unit VARCHAR(100),
          contract_start_date VARCHAR(50),
          contract_end_date VARCHAR(50),
          other_data TEXT,
          status VARCHAR(50) DEFAULT 'Active',
          is_pinned BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
  } catch (tpErr: any) {
    console.warn('tenant_projects init notice:', tpErr.message);
  }

  // Add is_pinned to existing tables if missing
  await pool.query('ALTER TABLE tenant_projects ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;');

  console.log('✅ Auto-created/verified tenant_projects table on server startup');

  // Initialize tenant_worksites table automatically
  await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_worksites (
        id SERIAL PRIMARY KEY,
        worksite_id VARCHAR(50) NOT NULL UNIQUE,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        supervisor VARCHAR(255) NOT NULL,
        contact VARCHAR(50) NOT NULL,
        workers_count INTEGER DEFAULT 0,
        geofence_status VARCHAR(50) DEFAULT 'Disabled',
        operational_status VARCHAR(50) DEFAULT 'Active',
        safety_rating VARCHAR(50) DEFAULT 'A',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  console.log('✅ Auto-created/verified tenant_worksites table on server startup');

  // Initialize tenant_divisions table automatically
  await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_divisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        state VARCHAR(255) NOT NULL,
        city VARCHAR(255) NOT NULL,
        pincodes TEXT,
        description TEXT,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_tenant_division UNIQUE (tenant_id, name)
      );
    `);
  console.log('✅ Auto-created/verified tenant_divisions table on server startup');

  // Add division_id and division_ids columns to tenant_users table if missing
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES tenant_divisions(id) ON DELETE SET NULL;');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS division_ids TEXT[] DEFAULT \'{}\';');
  console.log('✅ Auto-created/verified division_id & division_ids columns in tenant_users table on server startup');

  // Auto-create tenant_work_orders table and columns
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_work_orders (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      order_number VARCHAR(100) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      project_id VARCHAR(100),
      project_name VARCHAR(255),
      client_id TEXT,
      client_name TEXT,
      client_code TEXT,
      worksite_id VARCHAR(100),
      worksite_name VARCHAR(255),
      assigned_staff_id VARCHAR(100),
      assigned_staff_name VARCHAR(255),
      division_name VARCHAR(255),
      department_name VARCHAR(255),
      priority VARCHAR(50) DEFAULT 'Medium',
      status VARCHAR(50) DEFAULT 'Pending',
      start_date VARCHAR(50),
      due_date VARCHAR(50),
      end_date VARCHAR(50),
      project_location_address TEXT,
      commodity VARCHAR(100),
      contract_quantity VARCHAR(100),
      contract_quantity_unit VARCHAR(50),
      estimated_cost NUMERIC(15,2) DEFAULT 0,
      actual_cost NUMERIC(15,2) DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE tenant_work_orders ADD COLUMN IF NOT EXISTS end_date VARCHAR(50);
    ALTER TABLE tenant_work_orders ADD COLUMN IF NOT EXISTS project_location_address TEXT;
    ALTER TABLE tenant_work_orders ADD COLUMN IF NOT EXISTS commodity VARCHAR(100);
    ALTER TABLE tenant_work_orders ADD COLUMN IF NOT EXISTS contract_quantity VARCHAR(100);
    ALTER TABLE tenant_work_orders ADD COLUMN IF NOT EXISTS contract_quantity_unit VARCHAR(50);
    ALTER TABLE tenant_work_orders ADD COLUMN IF NOT EXISTS client_id TEXT;
    ALTER TABLE tenant_work_orders ADD COLUMN IF NOT EXISTS client_name TEXT;
    ALTER TABLE tenant_work_orders ADD COLUMN IF NOT EXISTS client_code TEXT;
    ALTER TABLE tenant_work_orders ADD COLUMN IF NOT EXISTS loading_location TEXT;
    ALTER TABLE tenant_work_orders ADD COLUMN IF NOT EXISTS unloading_location TEXT;
    ALTER TABLE tenant_work_orders ADD COLUMN IF NOT EXISTS transport_modes TEXT;
    ALTER TABLE tenant_work_orders ADD COLUMN IF NOT EXISTS is_loss_applicable BOOLEAN DEFAULT false;
    ALTER TABLE tenant_work_orders ADD COLUMN IF NOT EXISTS allowed_loss_percent NUMERIC(5,2) DEFAULT 0.00;
    ALTER TABLE tenant_work_orders ADD COLUMN IF NOT EXISTS rate_type VARCHAR(100) DEFAULT 'Per Ton';
    ALTER TABLE tenant_work_orders ADD COLUMN IF NOT EXISTS rate_per_unit NUMERIC(15,2) DEFAULT 0.00;
    ALTER TABLE tenant_work_orders ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(255) DEFAULT 'Net 30 Days';
  `);
  console.log('✅ Auto-created/verified tenant_work_orders table and extended commercial/location columns on server startup');

  // Auto-create tenant_project_transactions table
  await pool.query(`
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
    CREATE INDEX IF NOT EXISTS idx_project_tx_proj_id ON tenant_project_transactions (project_id);
  `);
  console.log('✅ Auto-created/verified tenant_project_transactions table on server startup');

  // Initialize tenant_departments table automatically
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_departments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50),
      description TEXT,
      head_of_department VARCHAR(255),
      status VARCHAR(50) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_tenant_department UNIQUE (tenant_id, name)
    );
  `);
  console.log('✅ Auto-created/verified tenant_departments table on server startup');

  // Initialize tenant_roles table automatically
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      department VARCHAR(255),
      description TEXT,
      access_level VARCHAR(50) DEFAULT 'Standard',
      status VARCHAR(50) DEFAULT 'Active',
      permissions JSONB DEFAULT '{}'::jsonb,
      allowed_modules TEXT[] DEFAULT '{}'::text[],
      landing_module VARCHAR(100) DEFAULT 'dashboard',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_tenant_role UNIQUE (tenant_id, name)
    );
    ALTER TABLE tenant_roles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE tenant_roles ADD COLUMN IF NOT EXISTS allowed_modules TEXT[] DEFAULT '{}'::text[];
    ALTER TABLE tenant_roles ADD COLUMN IF NOT EXISTS landing_module VARCHAR(100) DEFAULT 'dashboard';
  `);
  console.log('✅ Auto-created/verified tenant_roles table on server startup');

  // Add extended employee profile columns
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS alternate_mobile VARCHAR(20);');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(12);');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS residing_address TEXT;');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS permanent_address TEXT;');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(200);');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS emergency_contact_mobile VARCHAR(20);');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10);');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS aadhar_copy TEXT;');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS profile_photo TEXT;');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS salary NUMERIC(12,2);');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS mobile_verified BOOLEAN DEFAULT false;');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS bank_name VARCHAR(200);');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100);');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(50);');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(200);');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS sub_role VARCHAR(100);');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS employee_type VARCHAR(100) DEFAULT \'Permanent\';');
  await pool.query('ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS joining_date VARCHAR(50);');
  console.log('✅ Auto-created/verified extended employee profile columns in tenant_users');

  // Add custom_fields columns for dynamic fields configuration
  await pool.query('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_fields JSONB;');
  await pool.query('ALTER TABLE tenant_projects ADD COLUMN IF NOT EXISTS custom_fields JSONB;');
  await pool.query('ALTER TABLE tenant_worksites ADD COLUMN IF NOT EXISTS custom_fields JSONB;');
  console.log('✅ Auto-created/verified custom_fields columns in tenants, tenant_projects, and tenant_worksites');

  // Create Tenant Attendance Logs Table
  await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_attendance_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID REFERENCES tenant_users(id) ON DELETE CASCADE,
        check_in_time TIMESTAMP NOT NULL,
        check_out_time TIMESTAMP,
        status VARCHAR(50) DEFAULT 'On Duty',
        work_hours NUMERIC(5, 2)
      );
    `);
  console.log('✅ Auto-created/verified tenant_attendance_logs table on server startup');

  // Create Form Fields Config Table
  await pool.query(`
      CREATE TABLE IF NOT EXISTS form_fields_config (
        id SERIAL PRIMARY KEY,
        form_type VARCHAR(50) NOT NULL,
        field_key VARCHAR(100) NOT NULL,
        field_label VARCHAR(255) NOT NULL,
        field_type VARCHAR(50) DEFAULT 'text',
        is_default BOOLEAN DEFAULT false,
        is_hidden BOOLEAN DEFAULT false,
        is_required BOOLEAN DEFAULT false,
        dropdown_options TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_form_field UNIQUE (form_type, field_key)
      );
    `);
  console.log('✅ Form Fields Config table created/verified');

  // Auto-create tenant_vehicles & tenant_heavy_equipment tables on server startup
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_vehicles (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(100) NOT NULL,
      vehicle_number VARCHAR(100) NOT NULL,
      fleet_code VARCHAR(100),
      vehicle_type VARCHAR(100) NOT NULL,
      make VARCHAR(100),
      model VARCHAR(100),
      year INTEGER,
      registration_number VARCHAR(100),
      chassis_number VARCHAR(150),
      engine_number VARCHAR(150),
      ton_capacity NUMERIC(10,2),
      volume_capacity NUMERIC(10,2),
      volume_unit VARCHAR(50) DEFAULT 'CUM',
      purchase_date DATE,
      purchase_cost NUMERIC(15,2),
      vendor VARCHAR(200),
      insurance_value NUMERIC(15,2),
      insurance_expiry_date DATE,
      fitness_expiry_date DATE,
      assigned_driver_name VARCHAR(150),
      assigned_driver_phone VARCHAR(50),
      assigned_project_id VARCHAR(100),
      assigned_project_name VARCHAR(200),
      current_location VARCHAR(200),
      status VARCHAR(50) DEFAULT 'Active',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_heavy_equipment (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(100) NOT NULL,
      equipment_id VARCHAR(100) NOT NULL,
      equipment_number VARCHAR(100) NOT NULL,
      equipment_type VARCHAR(100) NOT NULL,
      make VARCHAR(100),
      model VARCHAR(100),
      serial_number VARCHAR(150),
      manufacturing_year INTEGER,
      excavator_bucket_capacity NUMERIC(10,2),
      boom_length NUMERIC(10,2),
      loader_bucket_capacity NUMERIC(10,2),
      crane_lifting_capacity NUMERIC(10,2),
      forklift_fork_capacity NUMERIC(10,2),
      dumper_payload_capacity NUMERIC(10,2),
      operating_weight NUMERIC(10,2),
      fuel_type VARCHAR(50) DEFAULT 'Diesel',
      hour_meter_reading NUMERIC(12,2) DEFAULT 0,
      purchase_date DATE,
      purchase_cost NUMERIC(15,2),
      vendor VARCHAR(200),
      insurance_value NUMERIC(15,2),
      assigned_operator_name VARCHAR(150),
      assigned_operator_phone VARCHAR(50),
      assigned_project_id VARCHAR(100),
      assigned_project_name VARCHAR(200),
      assigned_worksite_name VARCHAR(200),
      status VARCHAR(50) DEFAULT 'Active',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_vehicle_assignments (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(100) NOT NULL,
      asset_type VARCHAR(50) NOT NULL DEFAULT 'vehicle',
      asset_id VARCHAR(100) NOT NULL,
      asset_number VARCHAR(100) NOT NULL,
      asset_title VARCHAR(255),
      project_id VARCHAR(100),
      project_name VARCHAR(255),
      worksite_id VARCHAR(100),
      worksite_name VARCHAR(255),
      assigned_to_type VARCHAR(50) DEFAULT 'driver',
      assigned_to_name VARCHAR(255),
      assigned_to_phone VARCHAR(50),
      start_date VARCHAR(50),
      expected_end_date VARCHAR(50),
      actual_end_date VARCHAR(50),
      meter_reading_at_assign NUMERIC(15,2) DEFAULT 0,
      meter_reading_at_release NUMERIC(15,2),
      status VARCHAR(50) DEFAULT 'Active',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    ALTER TABLE tenant_vehicles ADD COLUMN IF NOT EXISTS fuel_power_type VARCHAR(100); 
    ALTER TABLE tenant_vehicles ADD COLUMN IF NOT EXISTS fuel_consumption VARCHAR(100); 
    ALTER TABLE tenant_vehicles ADD COLUMN IF NOT EXISTS insurance_start_date VARCHAR(50);
    ALTER TABLE tenant_vehicles ADD COLUMN IF NOT EXISTS insurance_expiry_date VARCHAR(50);
    ALTER TABLE tenant_vehicles ADD COLUMN IF NOT EXISTS insurance_cost NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE tenant_vehicles ADD COLUMN IF NOT EXISTS insurance_duration VARCHAR(50);
    ALTER TABLE tenant_vehicles ADD COLUMN IF NOT EXISTS insurance_policy_number VARCHAR(100);
    ALTER TABLE tenant_heavy_equipment ADD COLUMN IF NOT EXISTS fuel_power_type VARCHAR(100); 
    ALTER TABLE tenant_heavy_equipment ADD COLUMN IF NOT EXISTS fuel_consumption VARCHAR(100);
    ALTER TABLE tenant_heavy_equipment ADD COLUMN IF NOT EXISTS insurance_start_date VARCHAR(50);
    ALTER TABLE tenant_heavy_equipment ADD COLUMN IF NOT EXISTS insurance_expiry_date VARCHAR(50);
    ALTER TABLE tenant_heavy_equipment ADD COLUMN IF NOT EXISTS insurance_cost NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE tenant_heavy_equipment ADD COLUMN IF NOT EXISTS insurance_duration VARCHAR(50);
    ALTER TABLE tenant_heavy_equipment ADD COLUMN IF NOT EXISTS insurance_policy_number VARCHAR(100);
    ALTER TABLE tenant_vehicles ADD COLUMN IF NOT EXISTS insurance_history JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE tenant_heavy_equipment ADD COLUMN IF NOT EXISTS insurance_history JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE tenant_vehicle_assignments ADD COLUMN IF NOT EXISTS odometer_closing_km NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE tenant_vehicle_assignments ADD COLUMN IF NOT EXISTS distance_travelled NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE tenant_vehicle_assignments ADD COLUMN IF NOT EXISTS helper_name VARCHAR(255);
    ALTER TABLE tenant_vehicle_assignments ADD COLUMN IF NOT EXISTS helper_phone VARCHAR(50);
    ALTER TABLE tenant_vehicle_assignments ADD COLUMN IF NOT EXISTS helper_role VARCHAR(100);
    ALTER TABLE tenant_vehicle_assignments ADD COLUMN IF NOT EXISTS helper_id VARCHAR(100);
  `);
  console.log('✅ Auto-created/verified tenant_vehicles & tenant_heavy_equipment tables on server startup');

  // Auto-create Multi-Modal Operations Corridor & Stockyard Tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_stockyards (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      yard_code VARCHAR(50) NOT NULL,
      yard_name VARCHAR(255) NOT NULL,
      worksite_id VARCHAR(100),
      worksite_name VARCHAR(255),
      total_capacity_tons NUMERIC(15,2) DEFAULT 50000,
      current_occupancy_tons NUMERIC(15,2) DEFAULT 0,
      location VARCHAR(255),
      latitude NUMERIC(10,6),
      longitude NUMERIC(10,6),
      supervisor_name VARCHAR(150),
      supervisor_phone VARCHAR(50),
      weighbridge_installed BOOLEAN DEFAULT true,
      weighbridge_capacity_tons NUMERIC(10,2) DEFAULT 100,
      status VARCHAR(50) DEFAULT 'Active',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenant_stockyard_piles (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      stockyard_id INTEGER REFERENCES tenant_stockyards(id) ON DELETE CASCADE,
      bay_number VARCHAR(50) NOT NULL,
      material_name VARCHAR(255) NOT NULL,
      grade VARCHAR(100),
      unit_of_measure VARCHAR(50) DEFAULT 'MT',
      current_quantity NUMERIC(15,2) DEFAULT 0,
      min_threshold_quantity NUMERIC(15,2) DEFAULT 500,
      max_capacity NUMERIC(15,2) DEFAULT 20000,
      density_factor NUMERIC(8,3) DEFAULT 1.6,
      color_code VARCHAR(50) DEFAULT '#00705a',
      status VARCHAR(50) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenant_stockyard_transactions (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      stockyard_id INTEGER REFERENCES tenant_stockyards(id) ON DELETE CASCADE,
      pile_id INTEGER REFERENCES tenant_stockyard_piles(id) ON DELETE CASCADE,
      transaction_type VARCHAR(20) NOT NULL,
      quantity NUMERIC(15,2) NOT NULL,
      project_id VARCHAR(100),
      project_name VARCHAR(255),
      vehicle_number VARCHAR(100),
      driver_name VARCHAR(150),
      driver_phone VARCHAR(50),
      waybill_number VARCHAR(100),
      weighbridge_slip_number VARCHAR(100),
      gross_weight NUMERIC(12,2),
      tare_weight NUMERIC(12,2),
      net_weight NUMERIC(12,2),
      remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenant_operations_corridors (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      corridor_code VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      project_id VARCHAR(100) NOT NULL,
      project_name VARCHAR(255) NOT NULL,
      topology_type VARCHAR(50) DEFAULT 'RELAY_MULTIMODAL',
      description TEXT,
      origin_summary VARCHAR(255),
      destination_summary VARCHAR(255),
      transshipment_hub VARCHAR(255),
      total_distance_km NUMERIC(10,2) DEFAULT 0,
      estimated_cycle_time_hours NUMERIC(8,2) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenant_corridor_legs (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      corridor_id INTEGER REFERENCES tenant_operations_corridors(id) ON DELETE CASCADE,
      leg_sequence INTEGER NOT NULL,
      leg_name VARCHAR(255) NOT NULL,
      origin_name VARCHAR(255) NOT NULL,
      origin_type VARCHAR(50) DEFAULT 'Loading Pit',
      destination_name VARCHAR(255) NOT NULL,
      destination_type VARCHAR(50) DEFAULT 'Transshipment Hub',
      transport_mode VARCHAR(50) NOT NULL DEFAULT 'Road',
      distance_km NUMERIC(10,2) DEFAULT 0,
      estimated_tat_hours NUMERIC(6,2) DEFAULT 0,
      transshipment_required BOOLEAN DEFAULT false,
      lead_transporter VARCHAR(255),
      allowed_shrinkage_percent NUMERIC(5,2) DEFAULT 1.5,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenant_corridor_assets (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      corridor_id INTEGER REFERENCES tenant_operations_corridors(id) ON DELETE CASCADE,
      leg_id INTEGER REFERENCES tenant_corridor_legs(id) ON DELETE CASCADE,
      asset_type VARCHAR(50) NOT NULL,
      asset_id VARCHAR(100) NOT NULL,
      asset_number VARCHAR(100) NOT NULL,
      asset_title VARCHAR(255),
      assigned_person_name VARCHAR(150),
      assigned_person_phone VARCHAR(50),
      assigned_person_role VARCHAR(100) DEFAULT 'Driver',
      shift VARCHAR(50) DEFAULT 'Day Shift',
      operating_status VARCHAR(50) DEFAULT 'Running',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenant_dispatch_waybills (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      waybill_number VARCHAR(100) UNIQUE NOT NULL,
      project_id VARCHAR(100) NOT NULL,
      project_name VARCHAR(255),
      corridor_id INTEGER REFERENCES tenant_operations_corridors(id) ON DELETE SET NULL,
      corridor_name VARCHAR(255),
      leg_id INTEGER REFERENCES tenant_corridor_legs(id) ON DELETE SET NULL,
      origin_yard_id INTEGER REFERENCES tenant_stockyards(id) ON DELETE SET NULL,
      origin_yard_name VARCHAR(255),
      destination_yard_id INTEGER REFERENCES tenant_stockyards(id) ON DELETE SET NULL,
      destination_yard_name VARCHAR(255),
      material_name VARCHAR(255) NOT NULL,
      grade VARCHAR(100),
      unit_of_measure VARCHAR(50) DEFAULT 'MT',
      tare_weight NUMERIC(12,2) NOT NULL,
      gross_weight NUMERIC(12,2) NOT NULL,
      net_weight NUMERIC(12,2) NOT NULL,
      vehicle_number VARCHAR(100) NOT NULL,
      driver_name VARCHAR(150) NOT NULL,
      driver_phone VARCHAR(50),
      transporter_name VARCHAR(200),
      eway_bill_number VARCHAR(100),
      status VARCHAR(50) DEFAULT 'In-Transit',
      dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      delivered_at TIMESTAMP,
      remarks TEXT
    );

    ALTER TABLE tenant_operations_corridors ADD COLUMN IF NOT EXISTS project_head VARCHAR(150);
    ALTER TABLE tenant_operations_corridors ADD COLUMN IF NOT EXISTS site_manager VARCHAR(150);
    ALTER TABLE tenant_stockyards ADD COLUMN IF NOT EXISTS division_id UUID;
    ALTER TABLE tenant_stockyards ADD COLUMN IF NOT EXISTS division_name VARCHAR(255);
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'MT';
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS material_name VARCHAR(255);
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS source_location VARCHAR(255);
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS destination_location VARCHAR(255);
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS recorded_by VARCHAR(150);
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS discrepancy_quantity NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(50) DEFAULT 'TRUCK';
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255);
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS challan_number VARCHAR(100);
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS moisture_pct NUMERIC(5,2) DEFAULT 0;
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS quality_grade VARCHAR(100);
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS grn_number VARCHAR(100);
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS gate_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS gate_out_time TIMESTAMP;
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS dwell_minutes INTEGER DEFAULT 25;
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS rack_id INTEGER;
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS rack_name VARCHAR(255);
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS destination_rack_id INTEGER;
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS destination_rack_name VARCHAR(255);
    ALTER TABLE tenant_stockyard_transactions ADD COLUMN IF NOT EXISTS shift_id VARCHAR(100);

    CREATE TABLE IF NOT EXISTS tenant_stockyard_racks (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      stockyard_id INTEGER REFERENCES tenant_stockyards(id) ON DELETE CASCADE,
      rack_code VARCHAR(50) NOT NULL,
      rack_name VARCHAR(255) NOT NULL,
      location_type VARCHAR(50) DEFAULT 'Rack',
      capacity_tons NUMERIC(15,2) DEFAULT 10000,
      description TEXT,
      status VARCHAR(50) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(stockyard_id, rack_code)
    );

    CREATE TABLE IF NOT EXISTS tenant_stockyard_equipment_utilization (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(100) NOT NULL,
      stockyard_id INTEGER REFERENCES tenant_stockyards(id) ON DELETE CASCADE,
      stockyard_name VARCHAR(255),
      project_id VARCHAR(100),
      project_name VARCHAR(255),
      transaction_id INTEGER REFERENCES tenant_stockyard_transactions(id) ON DELETE SET NULL,
      shift_id VARCHAR(100),
      equipment_id VARCHAR(100) NOT NULL,
      equipment_number VARCHAR(100) NOT NULL,
      equipment_name VARCHAR(255),
      equipment_type VARCHAR(100) NOT NULL,
      operation_type VARCHAR(50) NOT NULL, -- 'UNLOADING', 'LOADING', 'INTERNAL_SHIFT', 'OTHER'
      material_name VARCHAR(255),
      quantity NUMERIC(15,2) DEFAULT 0,
      unit VARCHAR(50) DEFAULT 'MT',
      source_rack_id INTEGER,
      source_rack_name VARCHAR(255),
      destination_rack_id INTEGER,
      destination_rack_name VARCHAR(255),
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP NOT NULL,
      duration_hours NUMERIC(8,2) DEFAULT 0,
      operator_name VARCHAR(150),
      operator_phone VARCHAR(50),
      status VARCHAR(50) DEFAULT 'Completed', -- 'Completed', 'In-Progress', 'Cancelled'
      remarks TEXT,
      recorded_by VARCHAR(150),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenant_project_stockyards (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      project_id VARCHAR(100) NOT NULL,
      project_name VARCHAR(255) NOT NULL,
      stockyard_id INTEGER REFERENCES tenant_stockyards(id) ON DELETE CASCADE,
      stockyard_code VARCHAR(50),
      stockyard_name VARCHAR(255),
      corridor_id INTEGER REFERENCES tenant_operations_corridors(id) ON DELETE SET NULL,
      stop_sequence INTEGER DEFAULT 1,
      planned_material VARCHAR(255) DEFAULT 'Aggregates',
      planned_quantity NUMERIC(15,2) DEFAULT 0,
      planned_unit VARCHAR(50) DEFAULT 'MT',
      status VARCHAR(50) DEFAULT 'Active',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, project_id, stockyard_id)
    );

    ALTER TABLE tenant_operations_corridors ADD COLUMN IF NOT EXISTS stops_data JSONB;
    ALTER TABLE tenant_corridor_legs ADD COLUMN IF NOT EXISTS is_stockyard BOOLEAN DEFAULT false;
    ALTER TABLE tenant_corridor_legs ADD COLUMN IF NOT EXISTS stockyard_id INTEGER;
    ALTER TABLE tenant_corridor_legs ADD COLUMN IF NOT EXISTS stockyard_code VARCHAR(50);
    ALTER TABLE tenant_corridor_legs ADD COLUMN IF NOT EXISTS stockyard_location VARCHAR(255);
    ALTER TABLE tenant_corridor_legs ADD COLUMN IF NOT EXISTS division_name VARCHAR(255);
    ALTER TABLE tenant_corridor_legs ADD COLUMN IF NOT EXISTS planned_material VARCHAR(255);
    ALTER TABLE tenant_corridor_legs ADD COLUMN IF NOT EXISTS planned_quantity NUMERIC(15,2);
    ALTER TABLE tenant_corridor_legs ADD COLUMN IF NOT EXISTS planned_unit VARCHAR(50) DEFAULT 'MT';
  `);
  console.log('✅ Auto-created/verified Multi-Modal Operations Corridor & Stockyard tables');

  // Seed default heavy equipment in tenant_heavy_equipment if empty
  try {
    const eqCountRes = await pool.query('SELECT COUNT(*) as count FROM tenant_heavy_equipment');
    if (parseInt(eqCountRes.rows[0]?.count || '0', 10) === 0) {
      await pool.query(`
        INSERT INTO tenant_heavy_equipment (
          tenant_id, equipment_id, equipment_number, equipment_type, make, model,
          excavator_bucket_capacity, loader_bucket_capacity, hour_meter_reading,
          assigned_operator_name, assigned_operator_phone, assigned_project_id, assigned_project_name, status, notes
        ) VALUES 
        ('1', 'EQP-JCB-01', 'JCB-01', 'Backhoe Loader', 'JCB', '3DX Super EcoXpert', 0.28, 1.1, 1420.5, 'Mahesh Pal', '+91 98123 45671', 'PRJ-001', 'Delhi Metro Rail Project (Phase IV)', 'Active', 'Heavy backhoe loader for pit digging, truck unloading and loading'),
        ('1', 'EQP-LDR-02', 'Loader-02', 'Front-end Loader', 'Caterpillar', '950M High Lift', null, 3.5, 2180.0, 'Sunil Verma', '+91 98234 56782', 'PRJ-001', 'Delhi Metro Rail Project (Phase IV)', 'Active', 'Heavy bucket loader for rail siding aggregate shifting and loading'),
        ('1', 'EQP-JCB-03', 'JCB-03', 'Hydraulic Excavator', 'Komatsu', 'PC210-10M0', 1.2, null, 3105.2, 'Dinesh Kumar', '+91 98345 67893', 'PRJ-001', 'Delhi Metro Rail Project (Phase IV)', 'Active', '20-ton tracked crawler excavator for high-speed rake unloading and loading'),
        ('1', 'EQP-FLT-04', 'Forklift-04', 'Forklift', 'Toyota', '8FG50N 5-Ton', null, null, 890.0, 'Anil Sharma', '+91 98456 78904', null, null, 'Active', 'Warehouse & siding heavy pallet & gear handler'),
        ('1', 'EQP-EXC-05', 'EXC-05', 'Excavator', 'Tata Hitachi', 'EX200LC', 1.1, null, 4210.0, 'Raju Singh', '+91 98567 89015', null, null, 'Under Maintenance', 'Scheduled 500-hr hydraulic seal overhaul');
      `);
      console.log('✅ Seeded default heavy equipment fleet in tenant_heavy_equipment');
    }
  } catch (eqSeedErr: any) {
    console.warn('Notice during heavy equipment seeding:', eqSeedErr.message);
  }

  // Seed default stockyards & corridors if empty
  try {
    const yardCountRes = await pool.query('SELECT COUNT(*) as count FROM tenant_stockyards');
    if (parseInt(yardCountRes.rows[0]?.count || '0', 10) === 0) {
      const y1 = await pool.query(`
        INSERT INTO tenant_stockyards (tenant_id, yard_code, yard_name, worksite_id, worksite_name, total_capacity_tons, current_occupancy_tons, location, supervisor_name, supervisor_phone, weighbridge_installed, weighbridge_capacity_tons)
        VALUES (1, 'SY-001', 'Singrauli Rail Siding & Central Stockyard', 'WKS-001', 'Noida Metro Line-8 Depot', 120000, 89900, 'Singrauli Rail Siding Hub', 'Devendra Rathore', '+91 98765 11223', true, 120)
        RETURNING id;
      `);
      const yardId1 = y1.rows[0].id;

      const y2 = await pool.query(`
        INSERT INTO tenant_stockyards (tenant_id, yard_code, yard_name, worksite_id, worksite_name, total_capacity_tons, current_occupancy_tons, location, supervisor_name, supervisor_phone, weighbridge_installed, weighbridge_capacity_tons)
        VALUES (1, 'SY-002', 'Noida Sector-62 Processing Stockyard', 'WKS-002', 'Sector 62 Metro Depot Yard', 65000, 46000, 'Sector 62 Industrial Block B', 'Vikram Chauhan', '+91 98234 44556', true, 100)
        RETURNING id;
      `);
      const yardId2 = y2.rows[0].id;

      const y3 = await pool.query(`
        INSERT INTO tenant_stockyards (tenant_id, yard_code, yard_name, worksite_id, worksite_name, total_capacity_tons, current_occupancy_tons, location, supervisor_name, supervisor_phone, weighbridge_installed, weighbridge_capacity_tons)
        VALUES (1, 'SY-003', 'Dankuni Multi-Modal Logistics Yard', 'WKS-003', 'Indirapuram Elevated Corridor', 150000, 113000, 'DFCC Freight Corridor Siding', 'Amitabha Roy', '+91 99112 88776', true, 150)
        RETURNING id;
      `);
      const yardId3 = y3.rows[0].id;

      // Piles for Yard 1
      const p1 = await pool.query(`
        INSERT INTO tenant_stockyard_piles (tenant_id, stockyard_id, bay_number, material_name, grade, unit_of_measure, current_quantity, min_threshold_quantity, max_capacity, color_code)
        VALUES (1, $1, 'Bay-A1', 'Track Ballast 40mm', 'RDSO Class-A', 'MT', 42500, 8000, 50000, '#00705a')
        RETURNING id;
      `, [yardId1]);
      await pool.query(`
        INSERT INTO tenant_stockyard_piles (tenant_id, stockyard_id, bay_number, material_name, grade, unit_of_measure, current_quantity, min_threshold_quantity, max_capacity, color_code)
        VALUES 
          (1, $1, 'Bay-A2', 'Crushed Granite 20mm', 'Agg Grade-1', 'MT', 28000, 5000, 35000, '#0284c7'),
          (1, $1, 'Bay-B1', 'M-Sand (Zone II)', 'IS:383 Concrete Grade', 'MT', 19400, 4000, 25000, '#d97706');
      `, [yardId1]);

      // Piles for Yard 2
      await pool.query(`
        INSERT INTO tenant_stockyard_piles (tenant_id, stockyard_id, bay_number, material_name, grade, unit_of_measure, current_quantity, min_threshold_quantity, max_capacity, color_code)
        VALUES 
          (1, $1, 'Bay-C1', 'Granular Sub-Base (GSB)', 'MORTH Spec 401', 'MT', 31200, 6000, 40000, '#4f46e5'),
          (1, $1, 'Bay-C2', 'Ready-Mix Aggregates 10mm', 'IS Grade-2', 'MT', 14800, 3000, 20000, '#059669');
      `, [yardId2]);

      // Piles for Yard 3
      await pool.query(`
        INSERT INTO tenant_stockyard_piles (tenant_id, stockyard_id, bay_number, material_name, grade, unit_of_measure, current_quantity, min_threshold_quantity, max_capacity, color_code)
        VALUES 
          (1, $1, 'Siding Bay-1', 'Thermal Coal (G11 Grade)', '5200 Kcal/kg', 'MT', 68000, 15000, 80000, '#334155'),
          (1, $1, 'Siding Bay-2', 'Iron Ore Fines Fe 62%', 'Pellet Feed', 'MT', 45000, 10000, 60000, '#dc2626');
      `, [yardId3]);

      // Seed Operations Corridor 1
      const c1 = await pool.query(`
        INSERT INTO tenant_operations_corridors (tenant_id, corridor_code, name, project_id, project_name, topology_type, description, origin_summary, destination_summary, transshipment_hub, total_distance_km, estimated_cycle_time_hours)
        VALUES (1, 'CORR-DMRC-01', 'Western DFCC Rail-to-Road Metro Siding Corridor', 'PRJ-001', 'Delhi Metro Rail Project (Phase IV)', 'RELAY_MULTIMODAL', 'Quarry Pit 1 ➔ Road Tipper ➔ Satna Siding Buffer ➔ DFCC Rail Rake ➔ Tughlakabad Depot ➔ Road Truck ➔ Noida Sector-62 Depot', 'Rewa Quarry Face (Loading Pit)', 'Noida Sector-62 Depot (Site)', 'Satna Siding & Tughlakabad Inland Depot', 752.7, 22.0)
        RETURNING id;
      `);
      const corrId1 = c1.rows[0].id;

      // Legs for Corridor 1
      const l1 = await pool.query(`
        INSERT INTO tenant_corridor_legs (tenant_id, corridor_id, leg_sequence, leg_name, origin_name, origin_type, destination_name, destination_type, transport_mode, distance_km, estimated_tat_hours, transshipment_required, lead_transporter)
        VALUES (1, $1, 1, 'Leg 1: Pit Haulage to Rail Siding', 'Rewa Quarry Face (Loading Pit)', 'Loading Pit', 'Satna Rail Siding Yard', 'Transshipment Hub', 'Road', 48.5, 2.5, true, 'Rewa Earthmovers & Haulage Ltd.')
        RETURNING id;
      `, [corrId1]);
      const legId1 = l1.rows[0].id;

      const l2 = await pool.query(`
        INSERT INTO tenant_corridor_legs (tenant_id, corridor_id, leg_sequence, leg_name, origin_name, origin_type, destination_name, destination_type, transport_mode, distance_km, estimated_tat_hours, transshipment_required, lead_transporter)
        VALUES (1, $1, 2, 'Leg 2: Dedicated DFCC Rail Freight', 'Satna Rail Siding Yard', 'Rail Siding', 'Tughlakabad Inland Depot', 'Transshipment Hub', 'Rail', 680.0, 18.0, true, 'Indian Railways / Dedicated Freight Corridor')
        RETURNING id;
      `, [corrId1]);
      const legId2 = l2.rows[0].id;

      const l3 = await pool.query(`
        INSERT INTO tenant_corridor_legs (tenant_id, corridor_id, leg_sequence, leg_name, origin_name, origin_type, destination_name, destination_type, transport_mode, distance_km, estimated_tat_hours, transshipment_required, lead_transporter)
        VALUES (1, $1, 3, 'Leg 3: Last-Mile Metro Site Delivery', 'Tughlakabad Inland Depot', 'Transshipment Hub', 'Noida Sector-62 Metro Depot Site', 'Delivery Site', 'Road', 24.2, 1.5, false, 'InfraOps Logistics Fleet')
        RETURNING id;
      `, [corrId1]);
      const legId3 = l3.rows[0].id;

      // Bind assets to legs
      await pool.query(`
        INSERT INTO tenant_corridor_assets (tenant_id, corridor_id, leg_id, asset_type, asset_id, asset_number, asset_title, assigned_person_name, assigned_person_phone, assigned_person_role, shift, operating_status)
        VALUES 
          (1, $1, $2, 'vehicle', 'VEH-001', 'UP-14-BT-9021', 'Tata Prima 2830.K 16 CUM Tipper', 'Rajesh Kumar', '+91 98765 43210', 'Primary Driver', 'Day Shift', 'Running'),
          (1, $1, $2, 'heavy_equipment', 'EQP-001', 'EXC-210-CAT', 'CAT 320D2 Hydraulic Excavator', 'Ramesh Yadav', '+91 98112 33445', 'Equipment Operator', 'Day Shift', 'Loading'),
          (1, $1, $3, 'heavy_equipment', 'EQP-002', 'CRN-801-GNT', 'Gantry Rail Container Stacker 45T', 'Manoj Verma', '+91 98334 55667', 'Master Crane Operator', 'Rotational Shift', 'Running'),
          (1, $1, $4, 'vehicle', 'VEH-002', 'DL-1M-4412', 'Ashok Leyland 4220 14-Wheeler Hauler', 'Gurpreet Singh', '+91 98100 77889', 'Commercial Pilot', 'Day Shift', 'En Route');
      `, [corrId1, legId1, legId2, legId3]);

      // Seed Waybills
      await pool.query(`
        INSERT INTO tenant_dispatch_waybills (tenant_id, waybill_number, project_id, project_name, corridor_id, corridor_name, leg_id, origin_yard_id, origin_yard_name, destination_yard_id, destination_yard_name, material_name, grade, tare_weight, gross_weight, net_weight, vehicle_number, driver_name, driver_phone, transporter_name, status, remarks)
        VALUES 
          (1, 'WB-2026-1001', 'PRJ-001', 'Delhi Metro Rail Project (Phase IV)', $1, 'Western DFCC Rail-to-Road Metro Siding Corridor', $2, $4, 'Singrauli Rail Siding & Central Stockyard', $5, 'Noida Sector-62 Processing Stockyard', 'Track Ballast 40mm', 'RDSO Class-A', 17.2, 52.4, 35.2, 'UP-14-BT-9021', 'Rajesh Kumar', '+91 98765 43210', 'Rewa Earthmovers', 'In-Transit', 'High priority metro ballast batch. Scheduled delivery today 16:00 hrs.'),
          (1, 'WB-2026-1002', 'PRJ-001', 'Delhi Metro Rail Project (Phase IV)', $1, 'Western DFCC Rail-to-Road Metro Siding Corridor', $3, $5, 'Noida Sector-62 Processing Stockyard', $4, 'Singrauli Rail Siding & Central Stockyard', 'Crushed Granite 20mm', 'Agg Grade-1', 16.8, 48.6, 31.8, 'DL-1M-4412', 'Gurpreet Singh', '+91 98100 77889', 'InfraOps Fleet', 'Delivered', 'Delivered to Metro Casting Yard. Weighbridge verified.');
      `, [corrId1, legId1, legId3, yardId1, yardId2]);

      // Seed Transactions
      await pool.query(`
        INSERT INTO tenant_stockyard_transactions (tenant_id, stockyard_id, pile_id, transaction_type, quantity, project_id, project_name, vehicle_number, driver_name, driver_phone, waybill_number, weighbridge_slip_number, gross_weight, tare_weight, net_weight, remarks)
        VALUES 
          (1, $1, $2, 'OUTWARD', 35.2, 'PRJ-001', 'Delhi Metro Rail Project (Phase IV)', 'UP-14-BT-9021', 'Rajesh Kumar', '+91 98765 43210', 'WB-2026-1001', 'WB-SLIP-8901', 52.4, 17.2, 35.2, 'Dispatched via Siding Road Leg 1'),
          (1, $3, $4, 'INWARD', 31.8, 'PRJ-001', 'Delhi Metro Rail Project (Phase IV)', 'DL-1M-4412', 'Gurpreet Singh', '+91 98100 77889', 'WB-2026-1002', 'WB-SLIP-8902', 48.6, 16.8, 31.8, 'Received & stacked in Bay-C1');
      `, [yardId1, p1.rows[0].id, yardId2, p1.rows[0].id]);

      console.log('✅ Seeded default Stockyards, Multi-Modal Corridors, Legs, Asset Bindings, and Waybills');
    }
  } catch (seedErr: any) {
    console.warn('Notice during stockyard seeding:', seedErr.message);
  }

  // Seed default stockyard equipment utilization history if empty
  try {
    const eqUtilCountRes = await pool.query('SELECT COUNT(*) as count FROM tenant_stockyard_equipment_utilization');
    if (parseInt(eqUtilCountRes.rows[0]?.count || '0', 10) === 0) {
      const firstYard = await pool.query('SELECT id, yard_name FROM tenant_stockyards ORDER BY id ASC LIMIT 1');
      const yardId = firstYard.rows[0]?.id || 1;
      const yardName = firstYard.rows[0]?.yard_name || 'Singrauli Rail Siding & Central Stockyard';

      await pool.query(`
        INSERT INTO tenant_stockyard_equipment_utilization (
          tenant_id, stockyard_id, stockyard_name, project_id, project_name,
          equipment_id, equipment_number, equipment_name, equipment_type,
          operation_type, material_name, quantity, unit,
          source_rack_name, destination_rack_name,
          start_time, end_time, duration_hours,
          operator_name, operator_phone, status, remarks, recorded_by
        ) VALUES 
        ('1', $1, $2, 'PRJ-001', 'Delhi Metro Rail Project (Phase IV)', 'EQP-JCB-01', 'JCB-01', 'JCB 3DX Super EcoXpert', 'Backhoe Loader', 'UNLOADING', 'Track Ballast 40mm', 35.2, 'MT', 'Incoming Rake 04', 'Bay-A1', CURRENT_TIMESTAMP - INTERVAL '2 days' - INTERVAL '2 hours', CURRENT_TIMESTAMP - INTERVAL '2 days', 2.0, 'Mahesh Pal', '+91 98123 45671', 'Completed', 'Unloaded bulk rake into Bay A1 track ballast stack', 'Yard Supervisor'),
        ('1', $1, $2, 'PRJ-001', 'Delhi Metro Rail Project (Phase IV)', 'EQP-LDR-02', 'Loader-02', 'CAT 950M High Lift', 'Front-end Loader', 'INTERNAL_SHIFT', 'Track Ballast 40mm', 20.0, 'MT', 'Stack A (Buffer)', 'Stack B (Loading Bay)', CURRENT_TIMESTAMP - INTERVAL '1 day' - INTERVAL '1 hours', CURRENT_TIMESTAMP - INTERVAL '1 day', 1.0, 'Sunil Verma', '+91 98234 56782', 'Completed', 'Shifted ballast from buffer to active rail loading apron', 'Yard Supervisor'),
        ('1', $1, $2, 'PRJ-001', 'Delhi Metro Rail Project (Phase IV)', 'EQP-JCB-03', 'JCB-03', 'Komatsu PC210-10M0', 'Hydraulic Excavator', 'LOADING', 'Track Ballast 40mm', 35.2, 'MT', 'Bay-A1', 'Outward Road Hauler UP-14-BT-9021', CURRENT_TIMESTAMP - INTERVAL '4 hours', CURRENT_TIMESTAMP - INTERVAL '1 hour', 3.0, 'Dinesh Kumar', '+91 98345 67893', 'Completed', 'Loaded outward metro convoy with calibrated bucket tare', 'Yard Supervisor');
      `, [yardId, yardName]);
      console.log('✅ Seeded default stockyard equipment utilization history matching test spec');
    }
  } catch (uSeedErr: any) {
    console.warn('Notice during equipment utilization seeding:', uSeedErr.message);
  }

  // ── Auto-create & Seed Temporary Hired Vehicles & Running Time Tables ──
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_temporary_vehicles (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(100) NOT NULL DEFAULT '1',
        vehicle_number VARCHAR(100) NOT NULL,
        vehicle_type VARCHAR(100) NOT NULL,
        vendor_name VARCHAR(255) NOT NULL,
        vendor_phone VARCHAR(50),
        project_id VARCHAR(100) NOT NULL,
        project_name VARCHAR(255) NOT NULL,
        worksite_id VARCHAR(100),
        worksite_name VARCHAR(255),
        driver_name VARCHAR(100),
        driver_phone VARCHAR(50),
        rate_type VARCHAR(50) DEFAULT 'hourly',
        agreed_rate NUMERIC(12,2) DEFAULT 0,
        standby_rate NUMERIC(12,2) DEFAULT 0,
        start_date DATE NOT NULL DEFAULT CURRENT_DATE,
        end_date DATE,
        status VARCHAR(50) DEFAULT 'Active',
        remarks TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tenant_temporary_vehicle_logs (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(100) NOT NULL DEFAULT '1',
        temporary_vehicle_id INTEGER NOT NULL REFERENCES tenant_temporary_vehicles(id) ON DELETE CASCADE,
        project_id VARCHAR(100) NOT NULL,
        project_name VARCHAR(255) NOT NULL,
        log_date DATE NOT NULL DEFAULT CURRENT_DATE,
        shift VARCHAR(50) DEFAULT 'Day',
        start_time VARCHAR(20) NOT NULL,
        end_time VARCHAR(20) NOT NULL,
        idle_break_minutes INTEGER DEFAULT 60,
        running_minutes INTEGER NOT NULL,
        idle_minutes INTEGER DEFAULT 60,
        start_meter NUMERIC(10,2) DEFAULT 0,
        end_meter NUMERIC(10,2) DEFAULT 0,
        calculated_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
        operator_name VARCHAR(100),
        work_description TEXT,
        status VARCHAR(50) DEFAULT 'Approved',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Clean out all mock temporary data completely as requested
    await pool.query(`
      DELETE FROM tenant_temporary_vehicle_logs;
      DELETE FROM tenant_temporary_vehicles;
    `);
    console.log('✅ Temporary vehicles & running logs tables initialized clean with zero mock data');
  } catch (tvSeedErr: any) {
    console.warn('Notice during temporary vehicles table init:', tvSeedErr.message);
  }
  try {
    const vendorCheck = await pool.query('SELECT COUNT(*) as count FROM tenant_vendors');
    if (parseInt(vendorCheck.rows[0]?.count || '0', 10) === 0) {
      // 5. Seed default vendor and client to link notes/receipts
      const newVendor = await pool.query(`
          INSERT INTO tenant_vendors (tenant_id, name, code, vendor_type, status)
          VALUES (1, 'Ultratech Cement Ltd.', 'VND-001', 'Material Supplier', 'Active')
          RETURNING id
        `);
      const vendorId = newVendor.rows[0].id;

      const newClient = await pool.query(`
          INSERT INTO tenant_clients (tenant_id, name, code, status)
          VALUES (1, 'Delhi Metro Rail Corporation', 'CLI-001', 'Active')
          RETURNING id
        `);
      const clientId = newClient.rows[0].id;

      // 6. Debit & Credit Notes Seeding
      await pool.query(`
          INSERT INTO tenant_vendor_ledger_entries (tenant_id, vendor_id, date, type, amount, project_id, voucher_no, note, status)
          VALUES 
            (1, $1, '2026-08-05', 'Debit Note', 15000, 'PRJ-001', 'DN-2026-001', 'Damaged cement bags return adjustment', 'Posted'),
            (1, $1, '2026-08-06', 'Credit Note', 25000, 'PRJ-001', 'CN-2026-001', 'Discount allowance for Tata Steel bulk reinforcement purchase', 'Posted'),
            (1, $1, '2026-08-11', 'Debit Note', 8000, 'PRJ-002', 'DN-2026-002', 'Sub-standard sand quality reduction deduction', 'Posted'),
            (1, $1, '2026-08-14', 'Credit Note', 12000, 'PRJ-003', 'CN-2026-002', 'Excavation machine hire breakdown discount allowance', 'Posted')
        `, [vendorId]);
      console.log('✅ Mock debit and credit notes successfully seeded');

      // 7. Client Receipts Seeding (Project Inflow / Revenue)
      await pool.query(`
          INSERT INTO tenant_client_ledger_entries (tenant_id, client_id, date, type, amount, project_id, voucher_no, note, status)
          VALUES 
            (1, $1, '2026-08-01', 'Receipt', 1200000, 'PRJ-001', 'REC-2026-001', 'DMRC Milestone #1 completion payment receipt', 'Posted'),
            (1, $1, '2026-08-02', 'Receipt', 2500000, 'PRJ-002', 'REC-2026-002', 'NHAI Stage-1 mobilization advance receipt', 'Posted'),
            (1, $1, '2026-08-10', 'Receipt', 950000, 'PRJ-003', 'REC-2026-003', 'Eldeco piling foundation stage client bill check clearing', 'Posted')
        `, [clientId]);
      console.log('✅ Mock client invoices/receipts successfully seeded');

      const usersRes = await pool.query('SELECT id, name FROM tenant_users WHERE tenant_id = 1 LIMIT 3');
      if (usersRes.rows.length > 0) {
        // Noida Metro site (Supervisor 1 - Ramesh)
        const sup1 = usersRes.rows[0].id;
        const newFloat1 = await pool.query(`
            INSERT INTO tenant_petty_cash_floats (tenant_id, custodian_id, site_id, opening_amount, current_balance)
            VALUES (1, $1, 'WKS-001', 30000, 18500)
            RETURNING id
          `, [sup1]);
        const floatId1 = newFloat1.rows[0].id;

        await pool.query(`
            INSERT INTO tenant_petty_cash_entries (float_id, date, type, category, project_tag, amount, voucher_no, note, status)
            VALUES 
              ($1, '2026-08-10', 'Expense', 'Material Purchase', 'PRJ-001', 6500, 'PC-VCH-101', 'Minor plumbing items purchase', 'Posted'),
              ($1, '2026-08-12', 'Expense', 'Site Utilities', 'PRJ-001', 5000, 'PC-VCH-102', 'Weekly site water tanker charges', 'Posted')
          `, [floatId1]);

        if (usersRes.rows.length > 1) {
          // Indirapuram Flyover site (Supervisor 2 - Suresh)
          const sup2 = usersRes.rows[1].id;
          const newFloat2 = await pool.query(`
              INSERT INTO tenant_petty_cash_floats (tenant_id, custodian_id, site_id, opening_amount, current_balance)
              VALUES (1, $1, 'WKS-002', 50000, 32000)
              RETURNING id
            `, [sup2]);
          const floatId2 = newFloat2.rows[0].id;

          await pool.query(`
              INSERT INTO tenant_petty_cash_entries (float_id, date, type, category, project_tag, amount, voucher_no, note, status)
              VALUES 
                ($1, '2026-08-08', 'Expense', 'Fuel & Transport', 'PRJ-002', 12000, 'PC-VCH-201', 'Site supervisor diesel topup for transport mixer', 'Posted'),
                ($1, '2026-08-10', 'Expense', 'Safety Gear', 'PRJ-002', 6000, 'PC-VCH-202', 'Emergency purchase of 20 high-vis vests and safety helmets', 'Posted')
            `, [floatId2]);
        }
        console.log('✅ Supervisor petty cash floats and expenses successfully seeded');
      }
    }
  } catch (seedErr: any) {
    console.log('Notice during initial seeding:', seedErr.message);
  }

  console.log(`
====================================================================
 🟢 ALL DATABASE TABLES & MIGRATIONS SYNCED!
 🟢 SERVER READY TO PROCESS API REQUESTS
====================================================================
`);
}
