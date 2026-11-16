import { Router } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../../config/db';
import { seedDefaultTenantRolesAndDepartments } from '../../utils/defaultTenantData';

const router = Router();

// Get Subscription Plans Endpoint
router.get('/api/plans', async (req, res) => {
  try {
    const plansResult = await pool.query('SELECT * FROM subscription_plans WHERE is_active = true');
    res.json(plansResult.rows);
  } catch (err: any) {
    console.error('Error fetching plans:', err);
    res.status(500).json({ error: 'Failed to fetch subscription plans: ' + String(err) + ' - ' + err.message });
  }
});

// Upsert Tenant Draft
router.post('/api/tenant/draft', async (req, res) => {
  const { firebaseUid, draftData, step } = req.body;
  if (!firebaseUid || !draftData || step === undefined || step === null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await pool.query(
      `INSERT INTO tenant_drafts (firebase_uid, draft_data, step, updated_at) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (firebase_uid) 
       DO UPDATE SET draft_data = EXCLUDED.draft_data, step = EXCLUDED.step, updated_at = CURRENT_TIMESTAMP`,
      [firebaseUid, JSON.stringify(draftData), step]
    );
    res.json({ message: 'Draft saved successfully' });
  } catch (err: any) {
    console.error('Error saving draft:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});


router.get('/api/tenant/status/:uid', async (req, res) => {
  const { uid } = req.params;
  const { mobile, email } = req.query;

  try {
    // 1. Check if fully registered as Tenant Admin
    const adminResult = await pool.query('SELECT * FROM tenant_admins WHERE firebase_uid = $1', [uid]);
    const admin = adminResult.rows[0];
    if (admin) {
      return res.json({ status: 'complete', percentage: 100, userType: 'admin' });
    }

    // 2. Check if fully registered as Team Member by UID
    const memberResult = await pool.query('SELECT * FROM tenant_users WHERE firebase_uid = $1', [uid]);
    const member = memberResult.rows[0];
    if (member) {
      return res.json({ status: 'complete', percentage: 100, userType: 'team_member', role: member.role });
    }

    // 2.5 Self-linking helper: Check if tenant admin exists by Mobile or Email but not yet linked by UID
    if (mobile || email) {
      const searchMobile = mobile ? String(mobile).trim() : '';
      const searchEmail = email ? String(email).trim() : '';

      const unlinkedAdminRes = await pool.query(`
        SELECT * FROM tenant_admins 
        WHERE RIGHT(REGEXP_REPLACE(mobile, '[^0-9]', '', 'g'), 10) = RIGHT(REGEXP_REPLACE($1, '[^0-9]', '', 'g'), 10) AND $1 <> ''
           OR LOWER(email) = LOWER($2) AND $2 <> ''
      `, [searchMobile, searchEmail]);

      const unlinkedAdmin = unlinkedAdminRes.rows[0];
      if (unlinkedAdmin) {
        await pool.query('UPDATE tenant_admins SET firebase_uid = $1 WHERE id = $2', [uid, unlinkedAdmin.id]);
        console.log(`Linked Firebase UID ${uid} to tenant admin ${unlinkedAdmin.admin_name} (${unlinkedAdmin.email})`);
        return res.json({ status: 'complete', percentage: 100, userType: 'admin' });
      }
    }

    // 3. Self-linking helper: Check if team member exists by Mobile or Email but not yet linked by UID
    if (mobile || email) {
      const searchMobile = mobile ? String(mobile).trim() : '';
      const searchEmail = email ? String(email).trim() : '';

      const unlinkedMemberRes = await pool.query(`
        SELECT * FROM tenant_users 
        WHERE RIGHT(REGEXP_REPLACE(mobile, '[^0-9]', '', 'g'), 10) = RIGHT(REGEXP_REPLACE($1, '[^0-9]', '', 'g'), 10) AND $1 <> ''
           OR LOWER(email) = LOWER($2) AND $2 <> ''
      `, [searchMobile, searchEmail]);

      const unlinkedMember = unlinkedMemberRes.rows[0];
      if (unlinkedMember) {
        await pool.query('UPDATE tenant_users SET firebase_uid = $1 WHERE id = $2', [uid, unlinkedMember.id]);
        console.log(`Linked Firebase UID ${uid} to team member ${unlinkedMember.name} (${unlinkedMember.email})`);
        return res.json({ status: 'complete', percentage: 100, userType: 'team_member', role: unlinkedMember.role });
      }
    }

    // 4. Check if there's a registration draft for Tenant Admin
    const draftResult = await pool.query('SELECT * FROM tenant_drafts WHERE firebase_uid = $1', [uid]);
    const draft = draftResult.rows[0];

    if (draft) {
      let parsedData = {};
      try {
        parsedData = JSON.parse(draft.draft_data);
      } catch (e) {
        console.error("Invalid JSON in draft:", e);
      }
      let percentage = 0;
      if (parsedData) {
        const requiredFields = [
          'companyName', 'industryType', 'country', 'state', 'city',
          'adminName', 'designation', 'mobile', 'email', 'subdomain'
        ];
        let filledCount = 0;
        requiredFields.forEach((field: string) => {
          if ((parsedData as any)[field] && typeof (parsedData as any)[field] === 'string' && (parsedData as any)[field].trim() !== '') {
            filledCount++;
          }
        });
        percentage = Math.round((filledCount / requiredFields.length) * 90);
      }

      res.json({
        status: 'draft',
        step: draft.step,
        data: parsedData,
        percentage: percentage
      });
    } else {
      res.json({ status: 'new', percentage: 0 });
    }
  } catch (err: any) {
    console.error('Error fetching status:', err);
    res.status(500).json({ error: 'Failed to fetch status: ' + err.message });
  }
});


// Check Subdomain Availability Endpoint
router.get('/api/tenant/check-subdomain', async (req, res) => {
  const { subdomain } = req.query;
  if (!subdomain) {
    return res.status(400).json({ error: 'Subdomain parameter is required' });
  }
  try {
    const result = await pool.query('SELECT id FROM tenants WHERE subdomain = $1', [subdomain]);
    if (result.rows.length > 0) {
      return res.json({ available: false });
    }
    return res.json({ available: true });
  } catch (err: any) {
    console.error('Error checking subdomain:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Tenant Registration Endpoint
router.post('/api/tenant/register', async (req, res) => {
  const {
    companyName,
    industryType,
    country,
    state,
    pincode,
    city,
    companyWebsite,
    companySize,
    companyAddress,
    gstNumber,
    panNumber,
    msmeNumber,
    adminName,
    designation,
    mobile,
    email,
    password,
    subscriptionPlanId,
    firebaseUid,
    subdomain,
    startFreeTrial,
    razorpayPaymentId,
    razorpayOrderId,
    customFields
  } = req.body;

  const client = await pool.connect();

  try {
    // 1. Begin Transaction
    await client.query('BEGIN');

    const finalEmail = email || `admin-${Date.now()}@easyapps.com`;
    const finalMobile = mobile || `0000-${Date.now()}`;
    const finalCompanyName = companyName || 'My Enterprise';
    const finalAdminName = adminName || 'Administrator';

    // 2. Check if email already exists
    const emailCheckResult = await client.query('SELECT id FROM tenant_admins WHERE email = $1', [finalEmail]);
    if (emailCheckResult.rows.length > 0) {
      throw new Error('Email already exists');
    }

    // Check if subdomain already exists
    if (subdomain) {
      const subdomainCheck = await client.query('SELECT id FROM tenants WHERE subdomain = $1', [subdomain]);
      if (subdomainCheck.rows.length > 0) {
        throw new Error('Subdomain is already taken');
      }
    }

    const trialEndsAt = startFreeTrial ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null;
    const paymentStatus = startFreeTrial ? 'trial' : 'paid';

    // Generate unique company code (up to 6 uppercase letters from tenant company name)
    const baseCode = finalCompanyName.replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 6) || 'TNT';
    let companyCode = baseCode;
    let attempts = 0;
    let codeUnique = false;
    while (!codeUnique && attempts < 100) {
      const checkCode = attempts === 0 ? companyCode : `${companyCode.substring(0, 5)}${attempts}`;
      const codeCheck = await client.query('SELECT id FROM tenants WHERE company_code = $1', [checkCode]);
      if (codeCheck.rows.length === 0) {
        companyCode = checkCode;
        codeUnique = true;
      } else {
        attempts++;
      }
    }

    // 3. Insert into Tenants table
    const tenantResult = await client.query(
      `INSERT INTO tenants (
        company_name, industry_type, country, state, pincode, city, 
        company_website, company_size, company_address, gst_number, pan_number, msme_number, subscription_plan_id, subdomain,
        trial_ends_at, payment_status, razorpay_payment_id, razorpay_order_id, company_code, custom_fields
      ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING id`,
      [
        finalCompanyName,
        industryType,
        country,
        state,
        pincode || null,
        city,
        companyWebsite || null,
        companySize || null,
        companyAddress || null,
        gstNumber || null,
        panNumber || null,
        msmeNumber || null,
        subscriptionPlanId,
        subdomain || null,
        trialEndsAt,
        paymentStatus,
        razorpayPaymentId || null,
        razorpayOrderId || null,
        companyCode,
        customFields ? JSON.stringify(customFields) : null
      ]
    );

    const tenantId = tenantResult.rows[0].id;

    // 4. Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password || Math.random().toString(36).substring(2, 15), saltRounds);

    // 5. Insert into Tenant Admins table
    await client.query(
      `INSERT INTO tenant_admins (tenant_id, firebase_uid, admin_name, designation, mobile, email, password_hash) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, firebaseUid, finalAdminName, designation, finalMobile, finalEmail, hashedPassword]
    );

    // 6. Delete the draft if they had one
    if (firebaseUid) {
      await client.query('DELETE FROM tenant_drafts WHERE firebase_uid = $1', [firebaseUid]);
    }

    // 7. Auto-seed standard enterprise roles & departments for this company
    await seedDefaultTenantRolesAndDepartments(client, tenantId);

    // 8. Commit transaction
    await client.query('COMMIT');

    res.status(201).json({ message: 'Tenant registered successfully', tenantId });

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Registration error:', err);
    res.status(400).json({ error: err.message || 'Failed to register tenant' });
  } finally {
    client.release();
  }
});

export default router;
