import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_uNp6ikrfW8eM@ep-soft-poetry-ad6ivbvy-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Umanath A. Kotian: fix constituency from Bantwal -> Moodabidri
    const r1 = await client.query(`
      UPDATE public.representatives
      SET name = 'Umanatha A. Kotian',
          constituency = 'Moodabidri',
          photo_url = COALESCE(photo_url, 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Umanatha%20Kotian.jpg')
      WHERE role = 'MLA' AND name ILIKE '%Umanath%'
    `);
    console.log(`1. Umanath -> Moodabidri: ${r1.rowCount} row(s) updated`);

    // 2. Kagodu Thimmappa -> Bhagirathi Murulya (Sullia MLA)
    const r2 = await client.query(`
      UPDATE public.representatives
      SET name = 'Bhagirathi Murulya',
          constituency = 'Sullia (SC)',
          photo_url = 'https://images.news9live.com/wp-content/uploads/2023/05/New-Project-2023-05-15T184542.472.jpg'
      WHERE role = 'MLA' AND name ILIKE '%Kagodu%'
    `);
    console.log(`2. Kagodu -> Bhagirathi Murulya: ${r2.rowCount} row(s) updated`);

    // 3. K. Raghavendra Nair -> U.T. Khader (Mangaluru MLA)
    const r3 = await client.query(`
      UPDATE public.representatives
      SET name = 'U.T. Khader',
          constituency = 'Mangaluru',
          photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/U._T._Khader.jpg/330px-U._T._Khader.jpg'
      WHERE role = 'MLA' AND name ILIKE '%Raghavendra Nair%'
    `);
    console.log(`3. Raghavendra Nair -> U.T. Khader: ${r3.rowCount} row(s) updated`);

    // 4. Insert Rajesh Naik U. (Bantwal MLA) if missing
    const r4 = await client.query(`
      INSERT INTO public.representatives (name, role, constituency, authority_id, city, photo_url)
      SELECT 'Rajesh Naik U.', 'MLA', 'Bantwal', a.id, 'Mangaluru',
             'https://upload.wikimedia.org/wikipedia/commons/1/19/U_Rajesh_Naik.jpg'
      FROM public.authorities a
      WHERE a.name = 'DK District Administration'
      AND NOT EXISTS (
        SELECT 1 FROM public.representatives WHERE role = 'MLA' AND name ILIKE '%Rajesh Naik%'
      )
    `);
    console.log(`4. Insert Rajesh Naik U. (Bantwal): ${r4.rowCount} row(s) inserted`);

    // 5. Fix photo URLs for all MLAs
    await client.query(`UPDATE public.representatives SET photo_url = 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Umanatha%20Kotian.jpg' WHERE role = 'MLA' AND name ILIKE '%Umanath%'`);
    await client.query(`UPDATE public.representatives SET photo_url = 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Ashok%20Kumar%20Rai.jpg' WHERE name ILIKE '%Ashok Kumar Rai%'`);
    await client.query(`UPDATE public.representatives SET photo_url = 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Bharath%20Shetty%20Y..jpg' WHERE name ILIKE '%Bharath Shetty%'`);
    await client.query(`UPDATE public.representatives SET photo_url = 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Harish%20Poonja.jpg' WHERE name ILIKE '%Harish Poonja%'`);
    await client.query(`UPDATE public.representatives SET photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/U._T._Khader.jpg/330px-U._T._Khader.jpg' WHERE name ILIKE '%U.T. Khader%' OR name ILIKE '%UT Khader%'`);
    await client.query(`UPDATE public.representatives SET photo_url = 'https://upload.wikimedia.org/wikipedia/commons/1/19/U_Rajesh_Naik.jpg' WHERE name ILIKE '%Rajesh Naik%'`);
    await client.query(`UPDATE public.representatives SET photo_url = 'https://images.news9live.com/wp-content/uploads/2023/05/New-Project-2023-05-15T184542.472.jpg' WHERE name ILIKE '%Bhagirathi%' OR name ILIKE '%Murulya%'`);
    await client.query(`UPDATE public.representatives SET photo_url = 'https://cf-images.assettype.com/newindianexpress/2025-03-04/zcz6wfi0/New-Project-2025-03-04T075250.394.jpg' WHERE name ILIKE '%Vedavyas%'`);
    await client.query(`UPDATE public.representatives SET photo_url = 'https://prsindia.org/files/mptrack/18-lok-sabha/profile_image/180167.jpg' WHERE name ILIKE '%Brijesh%' AND role = 'MP'`);
    await client.query(`UPDATE public.representatives SET photo_url = 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Manja.jpg' WHERE name ILIKE '%Manja%' AND role ILIKE 'mayor'`);
    console.log('5. Photo URLs updated for all representatives');

    await client.query('COMMIT');
    console.log('\n✅ All MLA data corrected successfully!');

    // Show final state
    const final = await client.query(`
      SELECT name, role, constituency, photo_url IS NOT NULL as has_photo
      FROM public.representatives
      WHERE role IN ('MLA', 'MP', 'Mayor')
      ORDER BY role, name
    `);
    console.log('\nFinal MLA/MP/Mayor list:');
    for (const row of final.rows) {
      console.log(`  [${row.role}] ${row.name} | ${row.constituency} | photo: ${row.has_photo}`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed, rolled back:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
