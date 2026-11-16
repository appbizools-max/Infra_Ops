import { Pool, PoolClient } from 'pg';

export const DEFAULT_ROLES = [
  {
    name: 'Project Manager',
    department: 'Engineering & Operations',
    description: 'Full operational control over projects, sites, work orders, corridors, and stockyards.',
    access_level: 'Managerial',
    allowed_modules: ['projects', 'worksites', 'work_orders', 'stockyard', 'corridors', 'waybills', 'reports'],
    landing_module: 'projects'
  },
  {
    name: 'HR Executive',
    department: 'Human Resources',
    description: 'Manages employee directory, attendance muster, departments, roles, and project workforce allocations.',
    access_level: 'Managerial',
    allowed_modules: ['projects', 'worksites', 'workforce', 'team', 'divisions', 'departments', 'roles', 'attendance-tracker', 'work_orders'],
    landing_module: 'workforce'
  },
  {
    name: 'Accountant',
    department: 'Finance & Accounts',
    description: 'Handles company ledgers, project costing, expenses, balance sheets, and invoicing.',
    access_level: 'Managerial',
    allowed_modules: ['accounts', 'reports'],
    landing_module: 'accounts'
  },
  {
    name: 'Site Supervisor',
    department: 'Site Operations',
    description: 'Field management, geofence site check-ins, daily shift logs, and machinery operation.',
    access_level: 'Operational',
    allowed_modules: ['worksites', 'fms_machinery', 'fuel_logs', 'attendance-tracker'],
    landing_module: 'worksites'
  },
  {
    name: 'Fleet Manager',
    department: 'Fleet & Logistics',
    description: 'Supervises vehicle master, equipment dispatch, hired fleet, running logs, and transport corridors.',
    access_level: 'Operational',
    allowed_modules: ['fms', 'fleet', 'temporary_vehicles', 'fuel_logs', 'corridors'],
    landing_module: 'fms'
  },
  {
    name: 'Driver / Operator',
    department: 'Fleet & Logistics',
    description: 'Assigned vehicle console, daily shift sheets, trip start/stop, and fuel vouchers.',
    access_level: 'Operational',
    allowed_modules: ['fms_driver', 'fuel_logs'],
    landing_module: 'fms_driver'
  }
];

export const DEFAULT_DEPARTMENTS = [
  { name: 'Engineering & Operations', code: 'ENG-OPS', description: 'Civil infrastructure project execution & site engineering' },
  { name: 'Human Resources', code: 'HR-ADM', description: 'Talent management, onboarding, KYC & payroll' },
  { name: 'Finance & Accounts', code: 'FIN-ACC', description: 'Company costing, billing, accounts & audit' },
  { name: 'Site Operations', code: 'SITE-OP', description: 'Field ground operations, work sites & daily shifts' },
  { name: 'Fleet & Logistics', code: 'FLT-LOG', description: 'Trucks, heavy equipment, logistics & fuel dispatch' }
];

export async function seedDefaultTenantRolesAndDepartments(db: Pool | PoolClient, tenantId: number): Promise<void> {
  try {
    // 1. Seed Departments
    for (const dept of DEFAULT_DEPARTMENTS) {
      await db.query(
        `INSERT INTO tenant_departments (tenant_id, name, code, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, name) DO NOTHING`,
        [tenantId, dept.name, dept.code, dept.description]
      );
    }

    // 2. Seed Roles
    for (const role of DEFAULT_ROLES) {
      await db.query(
        `INSERT INTO tenant_roles (tenant_id, name, department, description, access_level, status, allowed_modules, landing_module)
         VALUES ($1, $2, $3, $4, $5, 'Active', $6, $7)
         ON CONFLICT (tenant_id, name) DO UPDATE 
         SET allowed_modules = EXCLUDED.allowed_modules,
             landing_module = EXCLUDED.landing_module,
             department = EXCLUDED.department`,
        [tenantId, role.name, role.department, role.description, role.access_level, role.allowed_modules, role.landing_module]
      );
    }
  } catch (err: any) {
    console.error(`[seedDefaultTenantRolesAndDepartments] Error seeding for tenant ${tenantId}:`, err.message);
  }
}
