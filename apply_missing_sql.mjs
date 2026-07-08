import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_uNp6ikrfW8eM@ep-soft-poetry-ad6ivbvy-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

const files = [
  "20260701000000_add_issue_photos.sql",
  "20260703120000_db_improvements.sql",
  "20260704180000_admin_reporters_indexes.sql",
  "20260705073000_fix_issue_status_history_rls.sql",
  "20260705080000_add_feedback_table.sql"
];

async function main() {
  for (const f of files) {
    const fullPath = path.join(process.cwd(), "supabase/migrations", f);
    if (!fs.existsSync(fullPath)) continue;
    const sql = fs.readFileSync(fullPath, 'utf8');
    console.log(`Executing ${f}...`);
    try {
      await pool.query(sql);
      console.log(`Success: ${f}`);
    } catch (err) {
      console.error(`Error in ${f}:`, err.message);
    }
  }
  await pool.end();
}

main();
