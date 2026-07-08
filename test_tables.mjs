import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_uNp6ikrfW8eM@ep-soft-poetry-ad6ivbvy-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

async function main() {
  try {
    await pool.query('SELECT * FROM public.issue_photos LIMIT 1');
    console.log("issue_photos EXISTS");
  } catch (err) {
    console.log("ERROR:", err.message);
  } finally {
    await pool.end();
  }
}
main();
