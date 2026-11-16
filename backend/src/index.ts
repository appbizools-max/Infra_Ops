import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import * as admin from 'firebase-admin';

// Database & Schema Configuration
import { pool } from './config/db';
import { initDb } from './config/initDb';

// Modular Route Handlers
import authRouter from './routes/auth/auth.routes';
import registrationRouter from './routes/registration/registration.routes';
import profileRouter from './routes/profile/profile.routes';
import adminRouter from './routes/admin/admin.routes';
import teamRouter from './routes/team/team.routes';
import hrRouter from './routes/hr/hr.routes';
import financeRouter from './routes/finance/finance.routes';
import projectRouter from './routes/project/project.routes';
import worksiteRouter from './routes/worksite/worksite.routes';
import workorderRouter from './routes/workorder/workorder.routes';
import vehicleMasterRouter from './routes/fleet/vehicleMaster.routes';
import vehicleAssignmentRouter from './routes/fleet/vehicleAssignment.routes';
import fleetOperationsRouter from './routes/fleet/fleetOperations.routes';
import temporaryVehiclesRouter from './routes/fleet/temporaryVehicles.routes';
import stockyardRouter from './routes/stockyard/stockyard.routes';
import operationsCorridorsRouter from './routes/operations-corridors/operationsCorridors.routes';
import dispatchWaybillsRouter from './routes/dispatch-waybills/dispatchWaybills.routes';
import operationsRouter from './routes/operations/operations.routes';
import divisionsRouter from './routes/divisions/divisions.routes';
import departmentsRouter from './routes/departments/departments.routes';
import rolesRouter from './routes/roles/roles.routes';

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

// Enable CORS for all incoming requests (Web & Mobile app access)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Body parsing with 50MB payload limits for blueprints and image attachments
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  if (!req.path.includes('/stats') && !req.path.includes('/status')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ====================================================================
// 🚀 MOUNT MODULAR API ROUTERS
// ====================================================================

// Authentication & Identity
app.use(authRouter);

// Registration & Onboarding
app.use(registrationRouter);

// Tenant Profile & Settings
app.use(profileRouter);

// Super Admin & Platform Operations
app.use(adminRouter);

// Organization Structure (Divisions, Departments, Roles)
app.use(divisionsRouter);
app.use(departmentsRouter);
app.use(rolesRouter);

// Workforce Management (Team & HR Attendance)
app.use(teamRouter);
app.use(hrRouter);

// Project Delivery & Work Execution
app.use(projectRouter);
app.use(worksiteRouter);
app.use(workorderRouter);

// Fleet, Machinery & Logistics
app.use(vehicleMasterRouter);
app.use(vehicleAssignmentRouter);
app.use(fleetOperationsRouter);
app.use(temporaryVehiclesRouter);

// Stockyards & Materials Management
app.use(stockyardRouter);

// Corridor Infrastructure & Waybills
app.use(operationsCorridorsRouter);
app.use(dispatchWaybillsRouter);
app.use(operationsRouter);

// Finance, Ledgers, Cash & Invoicing
app.use(financeRouter);

// ====================================================================
// 🏁 SERVER STARTUP & DATABASE INITIALIZATION
// ====================================================================
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

  // Initialize DB tables, migrations & indexes
  await initDb();
});

export default app;
