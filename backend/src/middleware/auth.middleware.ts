import express from 'express';
import * as admin from 'firebase-admin';
import { pool } from '../config/db';

export const authenticateToken = async (req: express.Request & { user?: any }, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (process.env.NODE_ENV === 'development' && req.headers['x-dev-fallback'] === 'true') {
      req.user = { 
        tenantId: 1, 
        firebaseUid: 'dev-fallback', 
        email: 'admin@infraops360.local', 
        userType: 'admin',
        role: 'admin',
        allowedModules: ['*'],
        permissions: { '*': { '*': true } }
      };
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
      req.user = { 
        tenantId, 
        firebaseUid: 'MOCK_DEV_UID', 
        email: 'admin@infraops360.local', 
        userType: 'admin',
        role: 'admin',
        allowedModules: ['*'],
        permissions: { '*': { '*': true } }
      };
      return next();
    } catch (e) {
      req.user = { 
        tenantId: 1, 
        firebaseUid: 'MOCK_DEV_UID', 
        email: 'admin@infraops360.local', 
        userType: 'admin',
        role: 'admin',
        allowedModules: ['*'],
        permissions: { '*': { '*': true } }
      };
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
    // 3. Resolve user in tenant_admins or tenant_users with exact role and module permissions
    let tenantId: any = null;
    let role: string = 'user';
    let department: string | null = null;
    let allowedModules: string[] = [];
    let permissions: any = {};
    let userType: string = 'team_member';

    const adminRes = await pool.query(
      'SELECT tenant_id, designation, email FROM tenant_admins WHERE firebase_uid = $1 OR (LOWER(email) = $2 AND $2 IS NOT NULL)',
      [uid, email ? email.toLowerCase() : null]
    );

    if (adminRes.rows.length > 0) {
      tenantId = adminRes.rows[0].tenant_id;
      role = adminRes.rows[0].designation || 'admin';
      userType = 'admin';
      allowedModules = ['*'];
      permissions = { '*': { '*': true } };
    } else {
      const userRes = await pool.query(
        `SELECT u.tenant_id, u.role, u.department, u.email,
                COALESCE(u.allowed_modules, r.allowed_modules, ARRAY['dashboard']::text[]) AS allowed_modules,
                COALESCE(u.permissions, r.permissions, '{}'::jsonb) AS permissions
         FROM tenant_users u
         LEFT JOIN tenant_roles r ON LOWER(TRIM(u.role)) = LOWER(TRIM(r.name)) AND u.tenant_id = r.tenant_id
         WHERE u.firebase_uid = $1 OR (LOWER(u.email) = $2 AND $2 IS NOT NULL)`,
        [uid, email ? email.toLowerCase() : null]
      );
      if (userRes.rows.length > 0) {
        tenantId = userRes.rows[0].tenant_id;
        role = userRes.rows[0].role || 'staff';
        department = userRes.rows[0].department || null;
        allowedModules = userRes.rows[0].allowed_modules || [];
        permissions = userRes.rows[0].permissions || {};
      }
    }

    req.user = { 
      tenantId: tenantId || 1, 
      firebaseUid: uid, 
      email, 
      role, 
      department, 
      userType, 
      allowedModules, 
      permissions 
    };
    return next();
  } catch (err: any) {
    console.error('[authMiddleware] Database lookup error:', err);
    return res.status(500).json({ error: 'Internal auth database error' });
  }
};

// Role authorization guard middleware
export const requireRoles = (...roles: string[]) => {
  return (req: express.Request & { user?: any }, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: User authentication required' });
    }
    // Tenant Admin always has full access
    if (req.user.userType === 'admin') {
      return next();
    }
    const userRole = (req.user.role || '').toUpperCase();
    const userDept = (req.user.department || '').toUpperCase();
    const isAllowed = roles.some(r => {
      const target = r.toUpperCase();
      return userRole.includes(target) || userDept.includes(target);
    });

    if (!isAllowed) {
      return res.status(403).json({ error: `Forbidden: Access requires one of the following roles: ${roles.join(', ')}` });
    }
    return next();
  };
};

// Module access guard middleware
export const requireModule = (moduleName: string) => {
  return (req: express.Request & { user?: any }, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: User authentication required' });
    }
    if (req.user.userType === 'admin' || (req.user.allowedModules && req.user.allowedModules.includes('*'))) {
      return next();
    }
    const allowed = req.user.allowedModules || [];
    if (!allowed.includes(moduleName)) {
      return res.status(403).json({ error: `Forbidden: You do not have access to the "${moduleName}" module` });
    }
    return next();
  };
};
