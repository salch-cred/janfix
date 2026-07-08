import { getIssueByPublicIdFn } from './src/lib/queries.functions.ts';
import { Pool } from 'pg';

async function main() {
  try {
    const res = await getIssueByPublicIdFn({ data: { public_id: "MGR-2026-00002" } });
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("Failed:", err);
  }
}
main();
