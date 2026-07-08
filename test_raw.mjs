import { Pool } from 'pg';
import fs from 'fs';

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_uNp6ikrfW8eM@ep-soft-poetry-ad6ivbvy-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT
        i.id, i.public_id,
        json_build_object('id', c.id, 'slug', c.slug, 'name_en', c.name_en, 'icon', c.icon, 'color', c.color) AS category,
        CASE WHEN a.id IS NOT NULL THEN row_to_json(a.*) ELSE NULL END AS authority,
        CASE WHEN r.id IS NOT NULL THEN row_to_json(r.*) ELSE NULL END AS representative,
        CASE WHEN w.id IS NOT NULL THEN row_to_json(w.*) ELSE NULL END AS ward
       FROM public.issues i
       LEFT JOIN public.categories c ON c.id = i.category_id
       LEFT JOIN public.authorities a ON a.id = i.assigned_authority_id
       LEFT JOIN public.representatives r ON r.id = i.assigned_representative_id
       LEFT JOIN public.wards w ON w.id = i.ward_id
       WHERE i.public_id = $1 AND i.visibility = 'visible'`, ["MGR-2026-00002"]);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Query failed:", err);
  } finally {
    await pool.end();
  }
}

main();
