import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("Missing DATABASE_URL environment variable during initialization.");
}

export const pool = new pg.Pool({
  connectionString,
  ssl: connectionString ? {
    rejectUnauthorized: false,
  } : undefined,
  max: 10,
});

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }> {
  const res = await pool.query(text, params);
  return res;
}
