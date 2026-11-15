import { pool } from '../config/db';

export async function getTenantIdForUser(userUid: string): Promise<number | null> {
  const adminRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [userUid]);
  if (adminRes.rows.length > 0) return adminRes.rows[0].tenant_id;
  const memberRes = await pool.query('SELECT tenant_id FROM tenant_users WHERE firebase_uid = $1', [userUid]);
  if (memberRes.rows.length > 0) return memberRes.rows[0].tenant_id;
  return null;
}

export async function checkIsAdminOrHR(userUid: string): Promise<{ authorized: boolean, tenantId: number | null }> {
  try {
    // 1. Check if they are tenant admin
    const adminRes = await pool.query('SELECT tenant_id FROM tenant_admins WHERE firebase_uid = $1', [userUid]);
    if (adminRes.rows.length > 0) {
      return { authorized: true, tenantId: adminRes.rows[0].tenant_id };
    }
    // 2. Check if they are team member and HR
    const memberRes = await pool.query(
      `SELECT tenant_id, role, department FROM tenant_users WHERE firebase_uid = $1`,
      [userUid]
    );
    if (memberRes.rows.length > 0) {
      const member = memberRes.rows[0];
      const dept = (member.department || '').trim();
      const role = (member.role || '').trim();
      const isHR =
        dept === 'HR' ||
        dept === 'Human Resources' ||
        role.toUpperCase() === 'HR' ||
        role.toUpperCase() === 'HUMAN RESOURCES';

      return { authorized: isHR, tenantId: member.tenant_id };
    }
    return { authorized: false, tenantId: null };
  } catch (err) {
    console.error('Error verifying credentials:', err);
    return { authorized: false, tenantId: null };
  }
}
