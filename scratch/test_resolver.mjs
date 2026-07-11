import { resolveIssue } from '../src/lib/resolver.js';
import pg from 'pg';

// Mock DB connection inside the resolver
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_uNp6ikrfW8eM@ep-soft-poetry-ad6ivbvy-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function test() {
  const result = await resolveIssue({
    category_id: 1, // Potholes
    area: 'Pandeshwar',
    locality: 'Mangaluru',
    address: 'Pandeshwar, Mangaluru',
    city: 'Mangaluru'
  });
  console.log('Result:', result);
}

test().catch(console.error);
