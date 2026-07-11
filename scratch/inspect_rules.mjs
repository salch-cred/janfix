import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_uNp6ikrfW8eM@ep-soft-poetry-ad6ivbvy-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

async function main() {
  try {
    const rules = await pool.query('SELECT * FROM public.jurisdiction_rules WHERE active = true');
    const auths = await pool.query('SELECT id, name FROM public.authorities');
    const cats = await pool.query('SELECT id, name_en, slug FROM public.categories');
    
    console.log('--- Authorities ---');
    console.log(auths.rows);
    console.log('--- Categories ---');
    console.log(cats.rows);
    console.log('--- Jurisdiction Rules ---');
    console.log(JSON.stringify(rules.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
