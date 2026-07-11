import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_uNp6ikrfW8eM@ep-soft-poetry-ad6ivbvy-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

async function main() {
  try {
    // Check if they already exist to avoid duplicates
    const check = await pool.query("SELECT id FROM public.jurisdiction_rules WHERE category_id = 13 AND scope_type IN ('rural', 'state_highway', 'national_highway')");
    if (check.rows.length > 0) {
      console.log('Rules already exist, skipping insert.');
      return;
    }
    
    await pool.query(`
      INSERT INTO public.jurisdiction_rules (category_id, scope_type, authority_id, confidence, notes, priority, active)
      VALUES 
        (13, 'rural', 11, 'medium', 'Rural general issues go to Zilla/Gram Panchayat', 15, true),
        (13, 'state_highway', 6, 'high', 'State highway general issues go to PWD', 15, true),
        (13, 'national_highway', 7, 'high', 'National highway general issues go to NHAI', 15, true)
    `);
    console.log('Successfully inserted rural/highway rules for Category Others (13).');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
