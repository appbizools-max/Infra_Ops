import { Router } from 'express';
import { pool } from '../../config/db';

const router = Router();

// Fetch Tenant Profile details
router.get('/api/tenant/profile/:uid', async (req, res) => {
  const { uid } = req.params;
  const { mobile, email } = req.query;
  try {
    // 1. Check if they are a Tenant Admin
    const queryAdmin = `
      SELECT 
        a.admin_name as "adminName",
        a.designation,
        a.mobile,
        a.email,
        t.id as "tenantId",
        t.subdomain,
        t.company_name as "companyName",
        t.industry_type as "industryType",
        t.country,
        t.state,
        t.pincode,
        t.city,
        t.company_website as "companyWebsite",
        t.company_size as "companySize",
        t.gst_number as "gstNumber",
        t.pan_number as "panNumber",
        t.msme_number as "msmeNumber",
        t.company_code as "companyCode",
        'admin' as "userType",
        '#' || COALESCE(t.company_code, 'TNT') || '0001' as "memberId",
        ARRAY['*'] as "allowedModules",
        '{"*": {"*": true}}'::jsonb as "permissions",
        'dashboard' as "landingModule"
      FROM tenant_admins a
      JOIN tenants t ON a.tenant_id = t.id
      WHERE a.firebase_uid = $1
    `;
    const resultAdmin = await pool.query(queryAdmin, [uid]);
    if (resultAdmin.rows.length > 0) {
      return res.json(resultAdmin.rows[0]);
    }

    // 2. Check if they are a Team Member
    const queryMember = `
      SELECT 
        u.name as "adminName",
        u.role as "designation",
        u.mobile,
        u.email,
        t.id as "tenantId",
        t.subdomain,
        t.company_name as "companyName",
        t.industry_type as "industryType",
        t.country,
        t.state,
        t.pincode,
        t.city,
        u.department,
        'team_member' as "userType",
        u.member_id as "memberId",
        u.status,
        COALESCE(u.allowed_modules, r.allowed_modules, ARRAY['dashboard']::text[]) as "allowedModules",
        COALESCE(u.permissions, r.permissions, '{}'::jsonb) as "permissions",
        COALESCE(u.landing_module, r.landing_module, 'dashboard') as "landingModule"
      FROM tenant_users u
      JOIN tenants t ON u.tenant_id = t.id
      LEFT JOIN tenant_roles r ON LOWER(TRIM(u.role)) = LOWER(TRIM(r.name)) AND u.tenant_id = r.tenant_id
      WHERE u.firebase_uid = $1
    `;
    const resultMember = await pool.query(queryMember, [uid]);
    if (resultMember.rows.length > 0) {
      return res.json(resultMember.rows[0]);
    }

    // 3. Match and link if mobile or email parameters are passed
    if (mobile || email) {
      const cleanMobile = (mobile as string || '').replace(/\D/g, '');
      const last10 = cleanMobile.substring(cleanMobile.length - 10);

      // Check tenant_admins first
      let unlinkedAdmin = null;
      if (last10.length === 10) {
        const matchingAdmins = await pool.query(
          `SELECT * FROM tenant_admins 
           WHERE REGEXP_REPLACE(mobile, '[^0-9]', '', 'g') LIKE $1`,
          [`%${last10}`]
        );
        unlinkedAdmin = matchingAdmins.rows[0];
      }
      if (!unlinkedAdmin && email) {
        const matchingAdmins = await pool.query(
          `SELECT * FROM tenant_admins 
           WHERE LOWER(email) = LOWER($1)`,
          [email]
        );
        unlinkedAdmin = matchingAdmins.rows[0];
      }

      if (unlinkedAdmin) {
        await pool.query('UPDATE tenant_admins SET firebase_uid = $1 WHERE id = $2', [uid, unlinkedAdmin.id]);
        const refetchAdmin = await pool.query(queryAdmin, [uid]);
        if (refetchAdmin.rows.length > 0) {
          return res.json(refetchAdmin.rows[0]);
        }
      }

      let unlinkedMember = null;
      if (last10.length === 10) {
        const matchingMembers = await pool.query(
          `SELECT * FROM tenant_users 
           WHERE REGEXP_REPLACE(mobile, '[^0-9]', '', 'g') LIKE $1`,
          [`%${last10}`]
        );
        unlinkedMember = matchingMembers.rows[0];
      }

      if (!unlinkedMember && email) {
        const matchingMembers = await pool.query(
          `SELECT * FROM tenant_users 
           WHERE LOWER(email) = LOWER($1)`,
          [email]
        );
        unlinkedMember = matchingMembers.rows[0];
      }

      if (unlinkedMember) {
        // Link their firebase_uid
        await pool.query('UPDATE tenant_users SET firebase_uid = $1 WHERE id = $2', [uid, unlinkedMember.id]);
        // Refetch profile
        const refetchResult = await pool.query(queryMember, [uid]);
        if (refetchResult.rows.length > 0) {
          return res.json(refetchResult.rows[0]);
        }
      }
    }

    res.status(404).json({ error: 'Profile not found' });
  } catch (err: any) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// Update Tenant Profile details
router.put('/api/tenant/profile/:uid', async (req, res) => {
  const { uid } = req.params;
  const {
    adminName,
    designation,
    mobile,
    email,
    companyName,
    industryType,
    companySize,
    companyWebsite,
    gstNumber,
    panNumber,
    msmeNumber,
    city,
    state,
    country,
    pincode
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update tenant_admins and get tenant_id
    const adminUpdateRes = await client.query(
      `UPDATE tenant_admins 
       SET admin_name = $1, designation = $2, mobile = $3, email = $4 
       WHERE firebase_uid = $5 
       RETURNING tenant_id`,
      [adminName, designation, mobile, email, uid]
    );

    if (adminUpdateRes.rows.length === 0) {
      throw new Error('Tenant administrator not found');
    }

    const tenantId = adminUpdateRes.rows[0].tenant_id;

    // 2. Update tenants
    await client.query(
      `UPDATE tenants 
       SET company_name = $1, industry_type = $2, company_size = $3, 
           company_website = $4, gst_number = $5, city = $6, 
           state = $7, country = $8, pincode = $9,
           pan_number = $10, msme_number = $11
       WHERE id = $12`,
      [
        companyName,
        industryType,
        companySize,
        companyWebsite,
        gstNumber,
        city,
        state,
        country,
        pincode,
        panNumber || null,
        msmeNumber || null,
        tenantId
      ]
    );

    await client.query('COMMIT');
    res.json({ message: 'Profile updated successfully' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error updating profile:', err);
    res.status(400).json({ error: err.message || 'Failed to update profile' });
  } finally {
    client.release();
  }
});

export default router;
