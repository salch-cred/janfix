process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_uNp6ikrfW8eM@ep-soft-poetry-ad6ivbvy-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

import { resolveIssue } from '../src/lib/resolver';

const CATS = [
  { id: 1, name: 'Pothole' },
  { id: 2, name: 'Garbage' },
  { id: 5, name: 'Broken Streetlight' },
  { id: 6, name: 'Road Damage' },
  { id: 13, name: 'Others' }
];

async function test() {
  for (const cat of CATS) {
    const result = await resolveIssue({
      category_id: cat.id,
      area: 'Valachil',
      locality: 'Mangaluru',
      address: 'Valachil, Mangaluru',
      city: 'Mangaluru'
    });
    console.log(`Category: ${cat.name} -> Resolved Authority ID: ${result.authority_id}, Resolved Representative ID: ${result.representative_id}, Reason: ${result.reason}`);
  }
}

test().catch(console.error);
