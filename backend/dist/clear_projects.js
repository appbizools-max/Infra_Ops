"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL
});
async function clearProjects() {
    try {
        const res = await pool.query('DELETE FROM tenant_projects');
        console.log(`Deleted ${res.rowCount} projects from tenant_projects table.`);
    }
    catch (err) {
        console.error('Error deleting projects:', err);
    }
    finally {
        await pool.end();
    }
}
clearProjects();
