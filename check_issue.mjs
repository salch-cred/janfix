import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_uNp6ikrfW8eM@ep-soft-poetry-ad6ivbvy-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

async function main() {
  try {
    const res = await pool.query("SELECT id, public_id, slug, visibility, needs_review, jurisdiction_confidence FROM public.issues WHERE public_id = $1", ["MGR-2026-00002"]);
    console.log(res.rows);
  } catch (err) {
    console.error("Query failed:", err);
  } finally {
    await pool.end();
  }
}

main();
