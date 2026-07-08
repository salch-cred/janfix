import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_uNp6ikrfW8eM@ep-soft-poetry-ad6ivbvy-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

async function main() {
  try {
    console.log("Reading jurisdiction SQL...");
    const sql1 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260702110000_jurisdiction_rule_engine.sql"), 'utf-8');
    const sql2 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260702203000_fix_jurisdiction_authority_routing.sql"), 'utf-8');

    console.log("Executing 20260702110000_jurisdiction_rule_engine.sql...");
    await pool.query(sql1);
    
    console.log("Executing 20260702203000_fix_jurisdiction_authority_routing.sql...");
    await pool.query(sql2);

    console.log("Migration applied successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

main();
