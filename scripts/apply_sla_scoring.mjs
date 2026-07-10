import pg from 'pg';
import fs from 'fs';
import path from 'path';

// Load env variables from .env if present
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        let val = parts.slice(1).join('=').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    });
  }
} catch (e) {}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: dbUrl });

async function run() {
  const sql = `
CREATE OR REPLACE VIEW public.authority_stats_view AS
WITH issue_sla AS (
  SELECT
    i.id,
    i.assigned_authority_id AS authority_id,
    i.status,
    i.created_at,
    i.updated_at,
    CASE i.severity
      WHEN 'low' THEN 5.0
      WHEN 'medium' THEN 3.0
      WHEN 'high' THEN 2.0
      WHEN 'dangerous' THEN 1.0
      ELSE 3.0
    END AS sla_days,
    EXTRACT(EPOCH FROM (i.updated_at - i.created_at)) / 86400.0 AS duration_days,
    EXTRACT(EPOCH FROM (now() - i.created_at)) / 86400.0 AS age_days
  FROM public.issues i
  WHERE i.visibility = 'visible'
),
stats AS (
  SELECT
    authority_id,
    COUNT(*) AS total,
    COUNT(CASE WHEN status IN ('resolved', 'community_confirmed', 'closed') THEN 1 END) AS resolved,
    COUNT(CASE WHEN status NOT IN ('resolved', 'community_confirmed', 'closed') THEN 1 END) AS pending,
    COUNT(CASE WHEN status IN ('resolved', 'community_confirmed', 'closed') AND duration_days <= sla_days THEN 1 END) AS resolved_within_sla,
    COALESCE(SUM(
      CASE WHEN status NOT IN ('resolved', 'community_confirmed', 'closed') AND age_days > sla_days
           THEN EXP((age_days - sla_days) / 7.0)
           ELSE 0.0
      END
    ), 0.0) AS sla_breach_penalty,
    COALESCE(AVG(CASE WHEN status IN ('resolved', 'community_confirmed', 'closed') THEN duration_days END), 0.0) AS avg_days
  FROM issue_sla
  GROUP BY authority_id
)
SELECT
  a.id,
  a.name,
  a.type,
  a.logo_url,
  a.photo_url,
  a.department,
  a.phone,
  a.email,
  a.address,
  a.website,
  a.jurisdiction,
  COALESCE(s.total, 0) AS total,
  COALESCE(s.resolved, 0) AS resolved,
  COALESCE(s.pending, 0) AS pending,
  COALESCE(s.avg_days, 0) AS avg_days,
  COALESCE(
    GREATEST(
      LEAST(
        ROUND(
          (
            (COALESCE(s.resolved, 0)::numeric / GREATEST(s.total, 1)) * 60.0 +
            (COALESCE(s.resolved_within_sla, 0)::numeric / GREATEST(s.resolved, 1)) * 40.0 -
            s.sla_breach_penalty
          )
        ), 100
      ), 0
    ), 0
  )::integer AS score
FROM public.authorities a
LEFT JOIN stats s ON s.authority_id = a.id;

CREATE OR REPLACE VIEW public.representative_stats_view AS
WITH issue_sla AS (
  SELECT
    i.id,
    i.assigned_representative_id AS representative_id,
    i.status,
    i.created_at,
    i.updated_at,
    CASE i.severity
      WHEN 'low' THEN 5.0
      WHEN 'medium' THEN 3.0
      WHEN 'high' THEN 2.0
      WHEN 'dangerous' THEN 1.0
      ELSE 3.0
    END AS sla_days,
    EXTRACT(EPOCH FROM (i.updated_at - i.created_at)) / 86400.0 AS duration_days,
    EXTRACT(EPOCH FROM (now() - i.created_at)) / 86400.0 AS age_days
  FROM public.issues i
  WHERE i.visibility = 'visible'
),
stats AS (
  SELECT
    representative_id,
    COUNT(*) AS total,
    COUNT(CASE WHEN status IN ('resolved', 'community_confirmed', 'closed') THEN 1 END) AS resolved,
    COUNT(CASE WHEN status NOT IN ('resolved', 'community_confirmed', 'closed') THEN 1 END) AS pending,
    COUNT(CASE WHEN status IN ('resolved', 'community_confirmed', 'closed') AND duration_days <= sla_days THEN 1 END) AS resolved_within_sla,
    COALESCE(SUM(
      CASE WHEN status NOT IN ('resolved', 'community_confirmed', 'closed') AND age_days > sla_days
           THEN EXP((age_days - sla_days) / 7.0)
           ELSE 0.0
      END
    ), 0.0) AS sla_breach_penalty,
    COALESCE(AVG(CASE WHEN status IN ('resolved', 'community_confirmed', 'closed') THEN duration_days END), 0.0) AS avg_days
  FROM issue_sla
  GROUP BY representative_id
)
SELECT
  r.id,
  r.name,
  r.role,
  r.constituency,
  r.photo_url,
  r.phone,
  r.email,
  r.authority_id,
  r.ward_id,
  r.active,
  COALESCE(s.total, 0) AS total,
  COALESCE(s.resolved, 0) AS resolved,
  COALESCE(s.pending, 0) AS pending,
  COALESCE(s.avg_days, 0) AS avg_days,
  COALESCE(
    GREATEST(
      LEAST(
        ROUND(
          (
            (COALESCE(s.resolved, 0)::numeric / GREATEST(s.total, 1)) * 60.0 +
            (COALESCE(s.resolved_within_sla, 0)::numeric / GREATEST(s.resolved, 1)) * 40.0 -
            s.sla_breach_penalty
          )
        ), 100
      ), 0
    ), 0
  )::integer AS score
FROM public.representatives r
LEFT JOIN stats s ON s.representative_id = r.id;
`;

  try {
    console.log("Applying SLA views to database...");
    await pool.query(sql);
    console.log("SLA views successfully updated!");
  } catch (err) {
    console.error("Failed to apply SLA views:", err);
  } finally {
    await pool.end();
  }
}

run();
