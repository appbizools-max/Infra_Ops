const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'src/index.ts'), 'utf8');
const lines = src.split('\n');

// Phase 1: lines 105 to 304 (0-indexed 104 to 304)
const phase1 = lines.slice(104, 304).join('\n');

// Phase 2: from line 3664 (index 3664) to line 4980 (index 4980)
const phase2 = lines.slice(3664, 4980).join('\n');

const initDbCode = `import { pool } from './db';

export async function initDb() {
  console.log('🔄 Initializing database schema and migrations...');
  
  // ── PHASE 1: CORE TENANTS & BASE SCHEMA ──────────────────────────────
${phase1}

  // ── PHASE 2: EXTENDED TABLES, COLUMNS & LEDGERS ─────────────────────
${phase2}

  console.log(\`
====================================================================
 🟢 ALL DATABASE TABLES & MIGRATIONS SYNCED!
 🟢 SERVER READY TO PROCESS API REQUESTS
====================================================================
\`);
}
`;

fs.writeFileSync(path.join(__dirname, 'src/config/initDb.ts'), initDbCode, 'utf8');
console.log('initDb.ts rewritten cleanly.');
