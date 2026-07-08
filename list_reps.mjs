import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_uNp6ikrfW8eM@ep-soft-poetry-ad6ivbvy-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT id, name, role, constituency, authority_id, photo_url, ward_id, active
      FROM public.representatives
      ORDER BY role, name
    `);
    for (const row of res.rows) {
      console.log(`[${row.role}] ${row.name} | ${row.constituency ?? 'N/A'} | auth_id:${row.authority_id}`);
    }
  } catch (err) {
    console.error("Query failed:", err.message);
  } finally {
    await pool.end();
  }
}
main();
