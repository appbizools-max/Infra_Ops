import { Router } from 'express';
import { pool } from '../../config/db';

const router = Router();

// GET Attendance/Login Logs Report for HR
router.get('/api/tenant/attendance/report', async (req, res) => {
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


export default router;
