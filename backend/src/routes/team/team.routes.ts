import { Router } from 'express';
import { pool } from '../../config/db';
import { getTenantIdForUser } from '../../utils/tenantAuth';

const router = Router();



// Get Team Members for a Tenant
router.get('/api/tenant/team/:uid', async (req, res) => {
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
router.get('/api/tenant/next-member-id/:uid', async (req, res) => {
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
router.post('/api/tenant/team', async (req, res) => {
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
router.patch('/api/tenant/employee/status', async (req, res) => {
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


// Delete Team Member
router.delete('/api/tenant/team/:id', async (req, res) => {
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
router.patch('/api/tenant/team/:id/role', async (req, res) => {
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
router.patch('/api/tenant/team/:id/permissions', async (req, res) => {
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


// ─── TEAM (HR MODULE) ───────────────────────────────────────────────────────

// GET Team Members by Query Parameter (e.g., ?tenantId=uuid or raw list)
router.get('/api/tenant/team', async (req, res) => {
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
router.get('/api/tenant/team/:firebaseUid', async (req, res) => {
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
router.get('/api/tenant/team/tenant/:tenantId', async (req, res) => {
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
router.post('/api/tenant/team', async (req, res) => {
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
router.put('/api/tenant/team/:id', async (req, res) => {
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
router.get('/api/tenant/team/detail/:memberId', async (req, res) => {
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
router.delete('/api/tenant/team/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM tenant_users WHERE id = $1', [id]);
    res.json({ message: 'Member deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


export default router;
