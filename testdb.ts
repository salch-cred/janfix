import { pool } from './src/lib/db.ts'; pool.query('SELECT public_id, lat, lng FROM issues LIMIT 5').then(r = 
