import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { getTenantIdForUser } from './utils/tenantAuth';
dotenv.config();
// Initialize Firebase Admin (Requires GOOGLE_APPLICATION_CREDENTIALS or serviceAccountKey.json)
try {
  const localKeyPath = path.join(process.cwd(), 'serviceAccountKey.json');
  const fallbackKeyPath = path.join(__dirname, '../serviceAccountKey.json');
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    (fs.existsSync(localKeyPath) ? localKeyPath : fallbackKeyPath);

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized with service account key.');
  } else {
    admin.initializeApp();
    console.log('⚠️ GOOGLE_APPLICATION_CREDENTIALS or serviceAccountKey.json not found. Custom token generation (Email Login) will fail unless running on GCP.');
  }
} catch (e: any) {
  console.log('Firebase Admin init skipped or failed:', e.message);
}
const app = express();
const port = process.env.PORT || 5000;
app.set('etag', false); // Disable ETag generation to ensure 200 OK responses
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});
app.use(cors());
app.use(express.json({ limit: '5mb' }));
// Request logger middleware with timing & status formatting
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const start = Date.now();
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  const method = req.method.padEnd(6);
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusEmoji = status < 300 ? '🟢' : status < 400 ? '🟡' : '🔴';
    console.log(`${statusEmoji} [${timestamp}] ${method} ${status} ${req.originalUrl || req.url} (${duration}ms)`);
  });
  next();
});
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/infraops360'
});
// ====================================================================
// 🔐 AUTHENTICATION MODULE (MODULARIZED)
// ====================================================================
import authRouter from './routes/auth/auth.routes';
app.use(authRouter);


// ====================================================================
// 📝 REGISTRATION, PROFILE & ADMIN MODULES (MODULARIZED)
// ====================================================================
import registrationRouter from './routes/registration/registration.routes';
import profileRouter from './routes/profile/profile.routes';
import adminRouter from './routes/admin/admin.routes';

app.use(registrationRouter);
app.use(profileRouter);
app.use(adminRouter);


// Get Team Members for a Tenant
app.get('/api/tenant/team/:uid', async (req, res) => {
  const { uid } = req.params;
  console.log(`[GET /api/tenant/team/:uid] Request for uid: "${uid}"`);
  try {
    let tenantId = null;
    const adminRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [uid]);
    if (adminRes.rows.length > 0) {
      tenantId = adminRes.rows[0].tenant_id;
      console.log(`[GET /api/tenant/team/:uid] Found tenant_id ${tenantId} in tenant_admins`);
    } else {
      const memberRes = await pool.query('SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1', [uid]);
      if (memberRes.rows.length > 0) {
        tenantId = memberRes.rows[0].tenant_id;
        console.log(`[GET /api/tenant/team/:uid] Found tenant_id ${tenantId} in tenant_users`);
      } else {
        console.warn(`[GET /api/tenant/team/:uid] No admin or user found matching firebase_uid: "${uid}"`);
      }
    }

    if (!tenantId) {
      return res.json([]);
    }

    const teamRes = await pool.query(`
      SELECT u.*, d.name AS division_name
      FROM tenant_users u
      LEFT JOIN tenant_divisions d ON d.id = u.division_id
      WHERE u.tenant_id = $1
      ORDER BY u.created_at DESC
    `, [tenantId]);
    console.log(`[GET /api/tenant/team/:uid] Returning ${teamRes.rows.length} team members for tenant_id ${tenantId}`);
    res.json(teamRes.rows);
  } catch (err: any) {
    console.error('Error fetching team:', err);
    res.status(500).json({ error: 'Failed to fetch team members: ' + err.message });
  }
});

// Get Next Available Member ID (Gap-Filler recommendation)
app.get('/api/tenant/next-member-id/:uid', async (req, res) => {
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

    if (!tenantId) {
      return res.status(404).json({ error: 'Tenant profile not found' });
    }

    // Fetch company code and name to generate prefix
    const tenantRes = await pool.query('SELECT company_code, company_name FROM tenants WHERE id = $1', [tenantId]);
    const tenant = tenantRes.rows[0];
    const prefix = tenant.company_code || tenant.company_name.replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 3) || 'TNT';

    let assigned = false;
    let seqNum = 2;
    let nextMemberId = '';
    while (!assigned) {
      const padded = String(seqNum).padStart(4, '0');
      nextMemberId = `${prefix}-${padded}`;
      const checkId = await pool.query(
        'SELECT id FROM tenant_users WHERE tenant_id = $1 AND member_id = $2',
        [tenantId, nextMemberId]
      );
      if (checkId.rows.length === 0) {
        assigned = true;
      } else {
        seqNum++;
      }
    }
    res.json({ nextMemberId });
  } catch (err: any) {
    console.error('Error getting next member ID:', err);
    res.status(500).json({ error: 'Failed to get next member ID: ' + err.message });
  }
});

// Add Team Member
app.post('/api/tenant/team', async (req, res) => {
  const { adminUid, name, role, department, email, mobile, memberId, divisionId } = req.body;
  if (!adminUid || !name || !role || !department || !email || !mobile) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const tenantId = await getTenantIdForUser(adminUid);
    if (!tenantId) {
      return res.status(404).json({ error: 'Tenant profile not found' });
    }

    // Check duplicate email or mobile for this tenant specifically
    const dupCheck = await pool.query(
      'SELECT id FROM tenant_users WHERE tenant_id = $1 AND (email = $2 OR mobile = $3)',
      [tenantId, email, mobile]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A team member with this email or mobile number is already registered for your tenant.' });
    }

    let finalMemberId = '';
    if (memberId && String(memberId).trim() !== '') {
      finalMemberId = String(memberId).trim();
      // Check duplicate memberId for this tenant specifically
      const dupIdCheck = await pool.query(
        'SELECT id FROM tenant_users WHERE tenant_id = $1 AND LOWER(member_id) = LOWER($2)',
        [tenantId, finalMemberId]
      );
      if (dupIdCheck.rows.length > 0) {
        return res.status(400).json({ error: `Member ID "${finalMemberId}" is already assigned to another team member.` });
      }
    } else {
      // Sequence Generator Gap-Filler (Starts from #INFOPS0001, fills any deleted gaps)
      let assigned = false;
      let seqNum = 1;
      while (!assigned) {
        const padded = String(seqNum).padStart(4, '0');
        finalMemberId = `#INFOPS${padded}`;
        const checkId = await pool.query(
          'SELECT id FROM tenant_users WHERE tenant_id = $1 AND member_id = $2',
          [tenantId, finalMemberId]
        );
        if (checkId.rows.length === 0) {
          assigned = true;
        } else {
          seqNum++;
        }
      }
    }

    // Ensure department exists in tenant_departments
    if (department && department.trim()) {
      await pool.query(
        `INSERT INTO tenant_departments (tenant_id, name, code, description) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (tenant_id, name) DO NOTHING`,
        [tenantId, department.trim(), department.trim().substring(0, 6).toUpperCase(), 'Operational Department']
      );
    }

    // Inherit permissions, allowed_modules, and landing_module from role if defined
    let rolePerms = {};
    let roleModules: string[] = [];
    let roleLanding = 'dashboard';
    if (role && role.trim()) {
      const roleCheck = await pool.query(
        'SELECT id, permissions, allowed_modules, landing_module, department FROM tenant_roles WHERE tenant_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))',
        [tenantId, role.trim()]
      );
      if (roleCheck.rows.length > 0) {
        rolePerms = roleCheck.rows[0].permissions || {};
        roleModules = roleCheck.rows[0].allowed_modules || [];
        roleLanding = roleCheck.rows[0].landing_module || 'dashboard';

        // If role had no department, update it to the specified department
        if (department && department.trim() && (!roleCheck.rows[0].department || !roleCheck.rows[0].department.trim())) {
          await pool.query(
            'UPDATE tenant_roles SET department = $1 WHERE id = $2',
            [department.trim(), roleCheck.rows[0].id]
          ).catch(() => { });
        }
      } else {
        // Auto-register this custom role under this department into tenant_roles for seamless interconnection
        await pool.query(
          `INSERT INTO tenant_roles (tenant_id, name, department, description, access_level, status, permissions, allowed_modules, landing_module)
           VALUES ($1, $2, $3, $4, $5, 'Active', '{}', ARRAY['dashboard']::text[], 'dashboard')
           ON CONFLICT DO NOTHING`,
          [tenantId, role.trim(), department ? department.trim() : null, 'Role created via Staff on-boarding', 'Operational']
        ).catch(e => console.warn('Auto-register role fallback:', e));
      }
    }

    const insertRes = await pool.query(
      `INSERT INTO tenant_users (tenant_id, name, role, department, email, mobile, status, member_id, division_id, permissions, allowed_modules, landing_module)
       VALUES ($1, $2, $3, $4, $5, $6, 'Active', $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        tenantId,
        name.trim(),
        role.trim(),
        department ? department.trim() : null,
        email.trim(),
        mobile.trim(),
        finalMemberId,
        divisionId || null,
        JSON.stringify(rolePerms),
        roleModules,
        roleLanding
      ]
    );
    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    console.error('Error adding team member:', err);
    res.status(500).json({ error: 'Failed to add team member: ' + err.message });
  }
});

// Update Employee Shift Status
app.patch('/api/tenant/employee/status', async (req, res) => {
  const { firebaseUid, status } = req.body;
  if (!firebaseUid || !status) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const updateRes = await pool.query(
      'UPDATE tenant_users SET status = $1 WHERE firebase_uid = $2 RETURNING *',
      [status, firebaseUid]
    );
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }
    const employee = updateRes.rows[0];

    // Log shifts in attendance history table
    if (status === 'On Duty') {
      const activeCheck = await pool.query(
        'SELECT id FROM tenant_attendance_logs WHERE user_id = $1 AND check_out_time IS NULL',
        [employee.id]
      );
      if (activeCheck.rows.length === 0) {
        await pool.query(
          `INSERT INTO tenant_attendance_logs (tenant_id, user_id, check_in_time, status)
           VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
          [employee.tenant_id, employee.id, status]
        );
      }
    } else if (status === 'Offline' || status === 'Away') {
      const activeCheck = await pool.query(
        'SELECT id, check_in_time FROM tenant_attendance_logs WHERE user_id = $1 AND check_out_time IS NULL ORDER BY check_in_time DESC LIMIT 1',
        [employee.id]
      );
      if (activeCheck.rows.length > 0) {
        const logId = activeCheck.rows[0].id;
        const checkIn = new Date(activeCheck.rows[0].check_in_time);
        const checkOut = new Date();
        const hours = parseFloat(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)).toFixed(2));

        await pool.query(
          `UPDATE tenant_attendance_logs 
           SET check_out_time = CURRENT_TIMESTAMP, status = $1, work_hours = $2
           WHERE id = $3`,
          [status, hours, logId]
        );
      }
    }

    res.json(employee);
  } catch (err: any) {
    console.error('Error updating employee status:', err);
    res.status(500).json({ error: 'Failed to update status: ' + err.message });
  }
});

// GET Attendance/Login Logs Report for HR
app.get('/api/tenant/attendance/report', async (req, res) => {
  const { tenantId, month, role, search } = req.query;
  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId is required' });
  }

  try {
    // 1. Check if the table is empty for this tenant, and auto-seed mock history if needed
    const countCheck = await pool.query('SELECT COUNT(*) FROM tenant_attendance_logs WHERE tenant_id = $1', [tenantId]);
    const recordCount = parseInt(countCheck.rows[0].count, 10);

    if (recordCount === 0) {
      // Fetch some active team members from the DB to seed their history logs
      const membersRes = await pool.query('SELECT id, name, role FROM tenant_users WHERE tenant_id = $1 LIMIT 8', [tenantId]);
      if (membersRes.rows.length > 0) {
        console.log(`Auto-seeding mock attendance logs for tenant ${tenantId}`);
        const today = new Date();
        const year = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-indexed

        // Let's generate 20 mock entries spanning the last 15 days for different roles
        for (let i = 0; i < 20; i++) {
          const day = Math.max(1, today.getDate() - (i % 15));
          const member = membersRes.rows[i % membersRes.rows.length];

          // Seed a login/logout time
          const checkIn = new Date(year, currentMonth, day, 8 + (i % 3), 0, 0); // ~8am - 10am
          const checkOut = new Date(year, currentMonth, day, 16 + (i % 3), 30 + (i * 5) % 30, 0); // ~4pm - 6pm
          const hours = parseFloat(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)).toFixed(2));

          await pool.query(
            `INSERT INTO tenant_attendance_logs (tenant_id, user_id, check_in_time, check_out_time, status, work_hours)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [tenantId, member.id, checkIn, checkOut, 'Offline', hours]
          );
        }
      }
    }

    // 2. Query and return filtered attendance logs
    let queryStr = `
      SELECT 
        l.id,
        l.check_in_time AS "checkInTime",
        l.check_out_time AS "checkOutTime",
        l.status,
        l.work_hours AS "workHours",
        u.name AS "employeeName",
        u.role AS "role",
        u.department AS "department",
        u.member_id AS "memberId"
      FROM tenant_attendance_logs l
      JOIN tenant_users u ON l.user_id = u.id
      WHERE l.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (month && month !== 'All') {
      queryStr += ` AND TO_CHAR(l.check_in_time, 'YYYY-MM') = $${paramIndex}`;
      params.push(month);
      paramIndex++;
    }

    if (role && role !== 'All') {
      queryStr += ` AND (LOWER(u.role) = LOWER($${paramIndex}) OR LOWER(u.sub_role) = LOWER($${paramIndex}))`;
      params.push(role);
      paramIndex++;
    }

    if (search && String(search).trim() !== '') {
      queryStr += ` AND (LOWER(u.name) LIKE LOWER($${paramIndex}) OR LOWER(u.member_id) LIKE LOWER($${paramIndex}))`;
      params.push(`%${String(search).trim()}%`);
      paramIndex++;
    }

    queryStr += ` ORDER BY l.check_in_time DESC`;

    const reportRes = await pool.query(queryStr, params);
    res.json(reportRes.rows);
  } catch (err: any) {
    console.error('Error fetching attendance logs report:', err);
    res.status(500).json({ error: 'Failed to fetch attendance logs: ' + err.message });
  }
});

// Delete Team Member
app.delete('/api/tenant/team/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleteRes = await pool.query('DELETE FROM tenant_users WHERE id = $1 RETURNING *', [id]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    res.json({ message: 'Team member deleted successfully', member: deleteRes.rows[0] });
  } catch (err: any) {
    console.error('Error deleting team member:', err);
    res.status(500).json({ error: 'Failed to delete team member: ' + err.message });
  }
});

// Update Team Member Role & Department (Employee-Wise Access Control)
app.patch('/api/tenant/team/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role, department } = req.body;
  try {
    // If a role was provided, look up the role's default permissions and modules
    let rolePerms = null;
    let roleModules = null;
    let roleLanding = null;
    if (role && role.trim()) {
      const roleLookup = await pool.query(
        `SELECT r.permissions, r.allowed_modules, r.landing_module 
         FROM tenant_users u
         JOIN tenant_roles r ON r.tenant_id = u.tenant_id AND LOWER(TRIM(r.name)) = LOWER(TRIM($1))
         WHERE u.id = $2 LIMIT 1`,
        [role.trim(), id]
      );
      if (roleLookup.rows.length > 0) {
        rolePerms = roleLookup.rows[0].permissions;
        roleModules = roleLookup.rows[0].allowed_modules;
        roleLanding = roleLookup.rows[0].landing_module;
      }
    }

    const updateRes = await pool.query(
      `UPDATE tenant_users 
       SET role = $1, 
           department = COALESCE($2, department),
           permissions = CASE WHEN $3::jsonb IS NOT NULL THEN $3::jsonb ELSE permissions END,
           allowed_modules = CASE WHEN $4::text[] IS NOT NULL THEN $4::text[] ELSE allowed_modules END,
           landing_module = CASE WHEN $5::varchar IS NOT NULL THEN $5::varchar ELSE landing_module END
       WHERE id = $6
       RETURNING *`,
      [
        role,
        department,
        rolePerms ? JSON.stringify(rolePerms) : null,
        Array.isArray(roleModules) ? roleModules : null,
        roleLanding || null,
        id
      ]
    );
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    res.json({ message: 'Role updated successfully', member: updateRes.rows[0] });
  } catch (err: any) {
    console.error('Error updating member role:', err);
    res.status(500).json({ error: 'Failed to update member role: ' + err.message });
  }
});

// Update Individual Team Member Custom Permissions (Person-to-Person Override)
app.patch('/api/tenant/team/:id/permissions', async (req, res) => {
  const { id } = req.params;
  const { permissions, allowed_modules, landing_module } = req.body;
  try {
    const updateRes = await pool.query(
      `UPDATE tenant_users 
       SET permissions = $1, allowed_modules = $2, landing_module = $3
       WHERE id = $4
       RETURNING *`,
      [
        permissions ? JSON.stringify(permissions) : '{}',
        Array.isArray(allowed_modules) ? allowed_modules : [],
        landing_module || 'dashboard',
        id
      ]
    );
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    res.json({ message: 'Individual permissions updated successfully', member: updateRes.rows[0] });
  } catch (err: any) {
    console.error('Error updating individual permissions:', err);
    res.status(500).json({ error: 'Failed to update individual permissions: ' + err.message });
  }
});

// Accounts Module - Clients API
app.get('/api/tenant/accounts/clients/:uid', async (req, res) => {
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

app.post('/api/tenant/accounts/clients', async (req, res) => {
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
app.get('/api/tenant/accounts/vendors/:uid', async (req, res) => {
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
app.get('/api/tenant/projects/:uid', async (req, res) => {
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
app.get('/api/tenant/worksites/:uid', async (req, res) => {
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

app.post('/api/tenant/accounts/vendors', async (req, res) => {
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
app.get('/api/tenant/accounts/expense-categories/:uid', async (req, res) => {
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

app.post('/api/tenant/accounts/expense-categories', async (req, res) => {
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
app.get('/api/tenant/invoices/:uid', async (req, res) => {
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
app.post('/api/tenant/invoices', async (req, res) => {
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
app.patch('/api/tenant/invoices/:id/status', async (req, res) => {
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
app.delete('/api/tenant/invoices/:id', async (req, res) => {
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

// ─── TEAM (HR MODULE) ───────────────────────────────────────────────────────

// GET Team Members by Query Parameter (e.g., ?tenantId=uuid or raw list)
app.get('/api/tenant/team', async (req, res) => {
  const { tenantId } = req.query;
  console.log(`[GET /api/tenant/team] Fetching team members. tenantId filter: ${tenantId || 'None'}`);
  try {
    let queryStr = `
      SELECT u.id, u.tenant_id, u.name, u.role, u.department, u.email, u.mobile, u.status,
             u.member_id, u.firebase_uid, u.created_at, u.division_id, u.division_ids,
             (
               SELECT COALESCE(json_agg(json_build_object('id', d2.id, 'name', d2.name)), '[]'::json)
               FROM tenant_divisions d2
               WHERE d2.id = u.division_id OR d2.id::text = ANY(u.division_ids)
             ) AS divisions_list,
             u.alternate_mobile, u.aadhar_number, u.residing_address, u.permanent_address,
             u.emergency_contact_name, u.emergency_contact_mobile, u.blood_group,
             u.profile_photo, u.salary, u.mobile_verified,
             u.bank_name, u.bank_account_number, u.ifsc_code, u.account_holder_name,
             u.sub_role, u.employee_type, u.joining_date,
             u.permissions, u.allowed_modules, u.landing_module,
              d.name AS division_name 
      FROM tenant_users u
      LEFT JOIN tenant_divisions d ON d.id = u.division_id
    `;
    const params = [];
    if (tenantId) {
      // Check if it's a UUID or a company code
      let resolvedTenantId = tenantId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId as string);
      if (!isUuid) {
        const tenantRes = await pool.query('SELECT id FROM tenants WHERE company_code = $1', [tenantId]);
        if (tenantRes.rows.length > 0) {
          resolvedTenantId = tenantRes.rows[0].id;
        }
      }
      queryStr += ` WHERE u.tenant_id = $1`;
      params.push(resolvedTenantId);
    }
    queryStr += ` ORDER BY u.created_at DESC`;

    const teamRes = await pool.query(queryStr, params);
    const rows = teamRes.rows.map(r => ({ ...r, aadhar_copy: r.aadhar_copy ? true : false }));
    res.json(rows);
  } catch (err: any) {
    console.error(`[GET /api/tenant/team] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// GET Team Members by firebaseUid
app.get('/api/tenant/team/:firebaseUid', async (req, res) => {
  const { firebaseUid } = req.params;
  console.log(`[GET /api/tenant/team] Fetching team members for firebaseUid: ${firebaseUid}`);
  try {
    const tenantRes = await pool.query(
      `SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1
       UNION
       SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1`,
      [firebaseUid]
    );

    if (tenantRes.rows.length === 0) {
      return res.json([]);
    }
    const tenantId = tenantRes.rows[0].tenant_id;

    const teamRes = await pool.query(
      `SELECT u.id, u.tenant_id, u.name, u.role, u.department, u.email, u.mobile, u.status,
              u.member_id, u.firebase_uid, u.created_at, u.division_id, u.division_ids,
              (
                SELECT COALESCE(json_agg(json_build_object('id', d2.id, 'name', d2.name)), '[]'::json)
                FROM tenant_divisions d2
                WHERE d2.id = u.division_id OR d2.id::text = ANY(u.division_ids)
              ) AS divisions_list,
              u.alternate_mobile, u.aadhar_number, u.residing_address, u.permanent_address,
              u.emergency_contact_name, u.emergency_contact_mobile, u.blood_group,
              u.profile_photo, u.salary, u.mobile_verified,
              u.bank_name, u.bank_account_number, u.ifsc_code, u.account_holder_name,
              u.sub_role, u.employee_type, u.joining_date,
              u.permissions, u.allowed_modules, u.landing_module,
              d.name AS division_name 
       FROM tenant_users u
       LEFT JOIN tenant_divisions d ON d.id = u.division_id
       WHERE u.tenant_id = $1 
       ORDER BY u.created_at DESC`,
      [tenantId]
    );
    // Don't send aadhar_copy in list view (too large); fetch on detail view
    const rows = teamRes.rows.map(r => ({ ...r, aadhar_copy: r.aadhar_copy ? true : false }));
    res.json(rows);
  } catch (err: any) {
    console.error(`[GET /api/tenant/team] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// GET Team Members by tenantId directly
app.get('/api/tenant/team/tenant/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  console.log(`[GET /api/tenant/team/tenant] Fetching team members for tenantId: ${tenantId}`);
  try {
    const teamRes = await pool.query(
      `SELECT u.id, u.tenant_id, u.name, u.role, u.department, u.email, u.mobile, u.status,
              u.member_id, u.firebase_uid, u.created_at, u.division_id, u.division_ids,
              (
                SELECT COALESCE(json_agg(json_build_object('id', d2.id, 'name', d2.name)), '[]'::json)
                FROM tenant_divisions d2
                WHERE d2.id = u.division_id OR d2.id::text = ANY(u.division_ids)
              ) AS divisions_list,
              u.alternate_mobile, u.aadhar_number, u.residing_address, u.permanent_address,
              u.emergency_contact_name, u.emergency_contact_mobile, u.blood_group,
              u.profile_photo, u.salary, u.mobile_verified,
              u.bank_name, u.bank_account_number, u.ifsc_code, u.account_holder_name,
              u.sub_role, u.employee_type, u.joining_date,
              u.permissions, u.allowed_modules, u.landing_module,
              d.name AS division_name 
       FROM tenant_users u
       LEFT JOIN tenant_divisions d ON d.id = u.division_id
       WHERE u.tenant_id = $1 
       ORDER BY u.created_at DESC`,
      [tenantId]
    );
    const rows = teamRes.rows.map(r => ({ ...r, aadhar_copy: r.aadhar_copy ? true : false }));
    res.json(rows);
  } catch (err: any) {
    console.error(`[GET /api/tenant/team/tenant] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// POST Team Member
app.post('/api/tenant/team', async (req, res) => {
  const {
    adminUid, name, role, department, email, mobile, divisionId, divisionIds,
    alternateMobile, aadharNumber, residingAddress, permanentAddress,
    emergencyContactName, emergencyContactMobile, bloodGroup,
    aadharCopy, profilePhoto, salary, mobileVerified,
    bankName, bankAccountNumber, ifscCode, accountHolderName,
    tenantId, subRole, employeeType, joiningDate
  } = req.body;
  try {
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId && adminUid) {
      resolvedTenantId = await getTenantIdForUser(adminUid);
      if (!resolvedTenantId) return res.status(404).json({ error: 'Tenant profile not found' });
    }
    if (!resolvedTenantId) {
      return res.status(400).json({ error: 'tenantId or adminUid is required' });
    }

    const finalDivisionIds = Array.isArray(divisionIds)
      ? divisionIds.filter(Boolean)
      : (divisionId ? [divisionId] : []);
    const primaryDivisionId = finalDivisionIds[0] || divisionId || null;

    const tenantRes = await pool.query('SELECT company_code FROM tenants WHERE id = $1', [resolvedTenantId]);
    const tenant = tenantRes.rows[0];
    const prefix = tenant.company_code || 'TNT';

    let assigned = false;
    let seqNum = 2;
    let nextMemberId = '';
    while (!assigned) {
      const padded = String(seqNum).padStart(4, '0');
      nextMemberId = `#${prefix}${padded}`;
      const checkId = await pool.query(
        'SELECT id FROM tenant_users WHERE tenant_id = $1 AND member_id = $2',
        [resolvedTenantId, nextMemberId]
      );
      if (checkId.rows.length === 0) {
        assigned = true;
      } else {
        seqNum++;
      }
    }

    const insertRes = await pool.query(
      `INSERT INTO tenant_users (
        tenant_id, name, role, department, email, mobile, member_id, division_id, division_ids,
        alternate_mobile, aadhar_number, residing_address, permanent_address,
        emergency_contact_name, emergency_contact_mobile, blood_group,
        aadhar_copy, profile_photo, salary, mobile_verified,
        bank_name, bank_account_number, ifsc_code, account_holder_name, sub_role, employee_type, joining_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) RETURNING *`,
      [
        resolvedTenantId, name, role, department || 'Operations', email, mobile, nextMemberId, primaryDivisionId, finalDivisionIds,
        alternateMobile || null, aadharNumber || null, residingAddress || null, permanentAddress || null,
        emergencyContactName || null, emergencyContactMobile || null, bloodGroup || null,
        aadharCopy || null, profilePhoto || null, salary || null, mobileVerified || false,
        bankName || null, bankAccountNumber || null, ifscCode || null, accountHolderName || null,
        subRole || null, employeeType || 'Permanent', joiningDate || null
      ]
    );
    res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Team Member
app.put('/api/tenant/team/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name, role, department, email, mobile, divisionId, divisionIds,
    alternateMobile, aadharNumber, residingAddress, permanentAddress,
    emergencyContactName, emergencyContactMobile, bloodGroup,
    aadharCopy, profilePhoto, salary, mobileVerified,
    bankName, bankAccountNumber, ifscCode, accountHolderName,
    subRole, employeeType, joiningDate
  } = req.body;
  try {
    const hasDivisionUpdate = (divisionId !== undefined || divisionIds !== undefined);
    const finalDivisionIds = Array.isArray(divisionIds)
      ? divisionIds.filter(Boolean)
      : (divisionId !== undefined ? (divisionId ? [divisionId] : []) : []);
    const primaryDivisionId = finalDivisionIds[0] || divisionId || null;

    const updateRes = await pool.query(
      `UPDATE tenant_users 
       SET name = COALESCE($1, name), role = COALESCE($2, role), department = COALESCE($3, department),
           email = COALESCE($4, email), mobile = COALESCE($5, mobile),
           division_id = CASE WHEN $26::boolean THEN $6 ELSE division_id END,
           division_ids = CASE WHEN $26::boolean THEN $27 ELSE division_ids END,
           alternate_mobile = $7, aadhar_number = $8, residing_address = $9, permanent_address = $10,
           emergency_contact_name = $11, emergency_contact_mobile = $12, blood_group = $13,
           aadhar_copy = COALESCE($14, aadhar_copy), profile_photo = COALESCE($15, profile_photo),
           salary = $16, mobile_verified = COALESCE($17, mobile_verified),
           bank_name = COALESCE($18, bank_name), bank_account_number = COALESCE($19, bank_account_number),
           ifsc_code = COALESCE($20, ifsc_code), account_holder_name = COALESCE($21, account_holder_name),
           sub_role = COALESCE($22, sub_role), employee_type = COALESCE($23, employee_type),
           joining_date = COALESCE($24, joining_date)
       WHERE id::text = $25 
          OR member_id = $25 
          OR REPLACE(member_id, '#', '') = $25 
          OR member_id = '#' || $25
       RETURNING *`,
      [
        name, role, department, email, mobile, primaryDivisionId,
        alternateMobile || null, aadharNumber || null, residingAddress || null, permanentAddress || null,
        emergencyContactName || null, emergencyContactMobile || null, bloodGroup || null,
        aadharCopy || null, profilePhoto || null, salary || null, mobileVerified || false,
        bankName || null, bankAccountNumber || null, ifscCode || null, accountHolderName || null,
        subRole || null, employeeType || null, joiningDate || null,
        id,
        hasDivisionUpdate,
        finalDivisionIds
      ]
    );
    if (updateRes.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
    res.json(updateRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET single Team Member detail (with aadhar_copy)
app.get('/api/tenant/team/detail/:memberId', async (req, res) => {
  const { memberId } = req.params;
  try {
    const result = await pool.query(
      `SELECT u.*,
              (
                SELECT COALESCE(json_agg(json_build_object('id', d2.id, 'name', d2.name)), '[]'::json)
                FROM tenant_divisions d2
                WHERE d2.id = u.division_id OR d2.id::text = ANY(u.division_ids)
              ) AS divisions_list,
              d.name AS division_name
       FROM tenant_users u
       LEFT JOIN tenant_divisions d ON d.id = u.division_id
       WHERE u.id::text = $1 
          OR u.member_id = $1 
          OR REPLACE(u.member_id, '#', '') = $1 
          OR u.member_id = '#' || $1`,
      [memberId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Team Member
app.delete('/api/tenant/team/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM tenant_users WHERE id = $1', [id]);
    res.json({ message: 'Member deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 🏗️ PROJECTS, WORKSITES & WORK ORDERS MODULES (MODULARIZED)
// ====================================================================
import projectRouter from './routes/project/project.routes';
import worksiteRouter from './routes/worksite/worksite.routes';
import workorderRouter from './routes/workorder/workorder.routes';

app.use(projectRouter);
app.use(worksiteRouter);
app.use(workorderRouter);

// ====================================================================
// 🚜 FLEET & MACHINERY MODULES (MODULARIZED)
// ====================================================================
import vehicleMasterRouter from './routes/fleet/vehicleMaster.routes';
import vehicleAssignmentRouter from './routes/fleet/vehicleAssignment.routes';
import fleetOperationsRouter from './routes/fleet/fleetOperations.routes';

app.use(vehicleMasterRouter);
app.use(vehicleAssignmentRouter);
app.use(fleetOperationsRouter);

// ====================================================================
// 🚜 TEMPORARY / HIRED VEHICLES & RUNNING TIME ROUTER (MODULARIZED)
// ====================================================================
import temporaryVehiclesRouter from './routes/fleet/temporaryVehicles.routes';
app.use(temporaryVehiclesRouter);

// ====================================================================
// 🏗️ STOCKYARDS & MATERIAL INVENTORY ENDPOINTS (MODULARIZED)
// ====================================================================
import stockyardRouter from './routes/stockyard/stockyard.routes';
app.use(stockyardRouter);

// ====================================================================
// 🗺️ OPERATIONS CORRIDORS & SKETCH BLUEPRINTS (MODULARIZED)
// ====================================================================
import operationsCorridorsRouter from './routes/operations-corridors/operationsCorridors.routes';
app.use(operationsCorridorsRouter);

// ====================================================================
// 📋 DIGITAL DISPATCH WAYBILLS & MATERIAL PASSPORTS (MODULARIZED)
// ====================================================================
import dispatchWaybillsRouter from './routes/dispatch-waybills/dispatchWaybills.routes';
app.use(dispatchWaybillsRouter);

// ====================================================================
// 🏢 DIVISIONS, DEPARTMENTS & ROLES MODULES (MODULARIZED)
// ====================================================================
import divisionsRouter from './routes/divisions/divisions.routes';
import departmentsRouter from './routes/departments/departments.routes';
import rolesRouter from './routes/roles/roles.routes';

app.use(divisionsRouter);
app.use(departmentsRouter);
app.use(rolesRouter);


// ─── AUTHENTICATION MIDDLEWARE FOR SECURE API ACCESS ─────────────────────────
const authenticateToken = async (req: express.Request & { user?: any }, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      req.user = { tenantId: 1, firebaseUid: 'dev-fallback', email: 'admin@infraops360.local', userType: 'admin' };
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty token provided' });
  }

  if (token === 'MOCK_TOKEN_DEV' || token.startsWith('MOCK_')) {
    try {
      const adminCheck = await pool.query('SELECT tenant_id FROM tenant_admins LIMIT 1');
      const tenantId = adminCheck.rows.length > 0 ? adminCheck.rows[0].tenant_id : 1;
      req.user = { tenantId, firebaseUid: 'MOCK_DEV_UID', email: 'admin@infraops360.local', userType: 'admin' };
      return next();
    } catch (e) {
      req.user = { tenantId: 1, firebaseUid: 'MOCK_DEV_UID', email: 'admin@infraops360.local', userType: 'admin' };
      return next();
    }
  }

  let uid: string | null = null;
  let email: string | null = null;

  // 1. Attempt to verify ID Token with Firebase Admin if initialized
  try {
    if (admin.apps.length > 0) {
      const decoded = await admin.auth().verifyIdToken(token);
      uid = decoded.uid;
      email = decoded.email || null;
    }
  } catch (err: any) {
    // Firebase Admin verifyIdToken skipped or failed
  }

  // 2. Fallback: If verifyIdToken skipped/failed or no Firebase Admin key, check if token is raw UID or decode JWT payload
  if (!uid) {
    if (token.length < 128) {
      uid = token;
    } else {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          uid = payload.user_id || payload.sub || payload.uid || null;
          email = payload.email || null;
        }
      } catch (e) { }
    }
  }

  if (!uid) {
    return res.status(401).json({ error: 'Unauthorized: Could not verify token identity' });
  }

  try {
    // 3. Resolve user in tenant_admins or tenant_users
    let tenantId: any = null;
    let role: string = 'user';

    const adminRes = await pool.query(
      'SELECT tenant_id, designation, email FROM tenant_admins WHERE firebase_uid = $1 OR (LOWER(email) = $2 AND $2 IS NOT NULL)',
      [uid, email ? email.toLowerCase() : null]
    );

    if (adminRes.rows.length > 0) {
      tenantId = adminRes.rows[0].tenant_id;
      role = adminRes.rows[0].designation || 'admin';
    } else {
      const userRes = await pool.query(
        'SELECT tenant_id, role, email FROM tenant_users WHERE firebase_uid = $1 OR (LOWER(email) = $2 AND $2 IS NOT NULL)',
        [uid, email ? email.toLowerCase() : null]
      );
      if (userRes.rows.length > 0) {
        tenantId = userRes.rows[0].tenant_id;
        role = userRes.rows[0].role || 'staff';
      }
    }

    req.user = { tenantId: tenantId || 1, firebaseUid: uid, email, role };
    return next();
  } catch (err: any) {
    console.error('[authMiddleware] Database lookup error:', err);
    return res.status(500).json({ error: 'Internal auth database error' });
  }
};

// ─── SIMPLE PROJECT LEDGER & COMPANY EXPENSES API ───────────────────────────

app.post('/api/tenant/ledger/project-ledger', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/project-ledger/:projectId', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/petty-cash/give', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/petty-cash/expense', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/payroll', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/payroll/entry', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/company-petty-cash', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/company-petty-cash/entry', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/loans', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/loans', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/loans/:id/payment', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/bank-cash/accounts', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/bank-cash/accounts', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/bank-cash/:accountId', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/bank-cash/entry', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/petty-cash/floats/all', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    const floatRes = await pool.query(
      'SELECT * FROM tenant_petty_cash_floats WHERE tenant_id = $1',
      [tenantId]
    );
    res.json(floatRes.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/tenant/ledger/petty-cash/:custodianId', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/petty-cash/float', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/assets', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/assets', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/stock/items', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/stock/items', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/petty-cash/entry', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/petty-cash/entry/:entryId/reverse', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/client/:clientId', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/client/entry', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/client/entry/:entryId/reverse', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { entryId } = req.params;
  const { reason } = req.body;
  try {
    await pool.query("UPDATE tenant_client_ledger_entries SET status = 'Reversed', note = CONCAT(note, ' | REVERSED: ', $1) WHERE id = $2 AND tenant_id = $3", [reason || '', entryId, tenantId]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── VENDOR STATEMENT ────────────────────────────────────────────────────────────

app.get('/api/tenant/ledger/vendor/:vendorId', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/vendor/entry', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/vendor/entry/:entryId/reverse', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { entryId } = req.params;
  const { reason } = req.body;
  try {
    await pool.query("UPDATE tenant_vendor_ledger_entries SET description = CONCAT(description, ' | REVERSED: ', $1) WHERE id = $2 AND tenant_id = $3", [reason || '', entryId, tenantId]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── EMPLOYEE ADVANCES ───────────────────────────────────────────────────────────

app.get('/api/tenant/ledger/employee/:employeeId', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/employee/entry', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/employee/entry/:entryId/reverse', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  const { entryId } = req.params;
  const { reason } = req.body;
  try {
    await pool.query("UPDATE tenant_employee_advances SET status = 'Reversed', note = CONCAT(note, ' | REVERSED: ', $1) WHERE id = $2 AND tenant_id = $3", [reason || '', entryId, tenantId]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GENERAL LEDGER ACCOUNTS ─────────────────────────────────────────────────────

app.get('/api/tenant/ledger/company-ledgers', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/project-ledgers/:projectId', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/project-ledgers', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/groups', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/groups', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/entries/:ledgerCode', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/quick-transaction', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/purge-all', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/entries/mark-paid', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/journal-vouchers', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.post('/api/tenant/ledger/journal-vouchers', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/debit-notes', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/credit-notes', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/trial-balance', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/period-closings', authenticateToken, async (req: express.Request & { user?: any }, res) => {
  const tenantId = req.user.tenantId;
  try {
    const dbRes = await pool.query('SELECT * FROM tenant_period_closings WHERE tenant_id = $1 ORDER BY closing_date DESC', [tenantId]);
    res.json(dbRes.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── FINANCIAL REPORTS ──────────────────────────────────────────────────────────

app.get('/api/tenant/ledger/reports/income-statement', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/reports/balance-sheet', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/dashboard-summary', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/project/:projectId', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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

app.get('/api/tenant/ledger/project/:projectId/history', authenticateToken, async (req: express.Request & { user?: any }, res) => {
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


app.listen(Number(port), '0.0.0.0', async () => {
  console.log(`
====================================================================
 🚀 INFRAOPS360 BACKEND API SERVER IS ONLINE
====================================================================
 📍 Local API:    http://localhost:${port}
 🌐 Network API:  http://0.0.0.0:${port}
 🛢️ Database:     PostgreSQL (Pool Connected)
 🛡️ Environment:  Development / Multi-Tenant Sandbox
====================================================================
`);

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
});