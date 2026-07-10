import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query(`SELECT table_name FROM information_schema.views WHERE table_schema = 'public'`);
    console.log("Views:", res.rows.map(r => r.table_name));
    
    const res2 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'issues' AND column_name = 'heat_score'`);
    console.log("Heat Score Column exists:", res2.rows.length > 0);
  } catch(e) {
    console.error("Error:", e.message);
  } finally {
    await pool.end();
  }
}
check();
