import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigration() {
  try {
    const sql = fs.readFileSync('supabase/migrations/20260709_heat_score_and_views.sql', 'utf8');
    console.log("Running migration...");
    await pool.query(sql);
    console.log("Migration applied successfully!");
    
    // Also run complete_migration.sql just in case it has missing base tables?
    // Let's check views after running this.
    const res = await pool.query(`SELECT table_name FROM information_schema.views WHERE table_schema = 'public'`);
    console.log("Views:", res.rows.map(r => r.table_name));
    
  } catch(e) {
    console.error("Migration Error:", e);
  } finally {
    await pool.end();
  }
}
runMigration();
