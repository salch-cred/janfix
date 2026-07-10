import { pool } from './src/lib/db.js'; pool.query('SELECT public_id, lat, lng FROM issues LIMIT 5').then(r =
