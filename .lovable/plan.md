# JanFix Mangaluru — Revised Build Plan (v2)

Incorporates all 19 pieces of feedback. Same stack, sharper data model, richer features. Still ships as one MVP.

## Stack

- TanStack Start + React + TypeScript + Tailwind v4 + shadcn/ui
- Lovable Cloud (Supabase) — DB, Storage, Auth (admins only)
- Leaflet + OpenStreetMap, Nominatim reverse geocoding
- `browser-image-compression` for client-side photo compression (JPEG 85%, max 1600 px) — addresses #18
- `blockhash-core` perceptual hash on the compressed image — addresses #3
- `html-to-image` + `qrcode` for poster + share cards — addresses #12 #13

## Data model (revised)

```text
categories(id, slug, name_en, name_kn, icon, color)
wards(id, number, name, area)

authorities(id, name, type, logo_url, photo_url, department,
            phone, email, address, website, jurisdiction)
representatives(id, name, role, constituency, photo_url, phone, email,
                authority_id, active)

-- versioned mapping rules (addresses #1)
assignment_rules(id, version, category_id, ward_id NULL,
                 authority_id, representative_id NULL,
                 active, created_at)

issues(
  id, public_id 'MGR-YYYY-#####', slug,            -- #19 smart URL
  category_id, description, severity 'low|medium|high|dangerous',  -- #4
  lat, lng, address, ward_id, area, locality, pincode,
  image_url, image_phash,                           -- #3
  status 'reported|community_verified|assigned|work_started|
          resolved|community_confirmed|closed',    -- #6
  visibility 'visible|hidden|duplicate|spam',      -- #5 (never delete)
  duplicate_of_id NULL,
  heat_score numeric,                               -- #8 (recomputed)
  assigned_authority_id, assigned_representative_id NULL,
  assignment_reason text, assignment_rule_version int,  -- #1
  device_id, views, duplicate_count int default 0,
  thanked_count int default 0,                      -- "Resolved Thanks"
  created_at, updated_at
)

issue_votes(issue_id, device_id, vote 'exists|fixed', created_at) PK
issue_thanks(issue_id, device_id, created_at) PK    -- Resolved Thanks
issue_supporters(issue_id, device_id, created_at) PK -- "I also saw this" #14

issue_comments(id, issue_id, device_id, name, body,
               quick_reply 'also_saw|still_exists|already_fixed|other', -- #14
               created_at)

issue_status_history(id, issue_id, status, note, photo_url,
                     photo_kind 'report|repair|citizen_after', -- #7
                     by_admin, created_at)

issue_official_updates(id, issue_id, body, posted_by, created_at) -- #11

issue_watchers(issue_id, device_id, email NULL, phone NULL, created_at) PK -- #15

devices(device_id PK, report_count int, trusted_at, first_seen, last_seen) -- #2

admin_roles(user_id, role 'admin|moderator')   -- separate roles table
app_role enum + has_role() security-definer fn
```

RLS + grants:

- Public SELECT on issues (filtered `visibility='visible'`), categories, authorities, representatives, wards, votes, comments, history, official_updates, supporters, thanks.
- Public INSERT on issues, votes, comments, supporters, thanks, watchers (validated server-side with device_id; rate-limited via `created_at` checks).
- Admin-only UPDATE on issues, status_history (with photo), official_updates, assignment_rules, authority/rep/ward CRUD.
- Storage buckets: `issue-photos` (public read, public insert), `repair-photos` (public read, admin insert), `authority-logos` / `rep-photos` (public read, admin write).

## Authority mapping (#1 versioned)

`resolveAssignment(category, ward)` reads the active `assignment_rules` row, returns `{authority_id, representative_id, reason, version}` which gets snapshotted onto the issue. Changing rules tomorrow leaves old issues with their original assignment + readable reason ("Category=Pothole, Ward=21, rule v1").

## Status workflow (#6)

`Reported → Community Verified → Assigned → Work Started → Resolved → Community Confirmed → Closed`. Community Verified auto-flips at ≥5 supporters or ≥70% "still exists" votes. Community Confirmed auto-flips when ≥70% post-resolved votes say fixed (min 5). Citizens can request reopen — adds history entry and flips back to Assigned.

## Heat Score (#8)

`heat_score = log(1+votes)*0.35 + severity_weight*0.25 + recency_decay(age_days)*0.2 + log(1+duplicate_count)*0.2`. Recomputed via SQL view or on read; drives "Hot Issues" rail on Home and Explore sort.

## Device trust (#2)

Every write increments `devices.report_count`. Badge thresholds: 5 → Active Citizen, 15 → Trusted Citizen ⭐, 40 → Civic Champion 🏅. Shown next to anonymous handle ("Trusted Citizen · 36 reports"). Spam/hidden reports do not count.

## Duplicate detection (#3)

On submit, server runs in order:

1. Haversine ≤ 50 m + same category + last 60 days → candidates
2. Image pHash Hamming distance ≤ 10 against candidates
3. Trigram similarity on description ≥ 0.4
   Any 2-of-3 match → return existing issue + "Support this report" CTA (creates `issue_supporters` row, increments `duplicate_count`). Admin can also mark `visibility='duplicate'` with `duplicate_of_id`.

## Report flow

Form fields:

- Photo (camera/upload, compressed client-side to 1600 px JPEG 85% — #18; pHash computed before upload — #3)
- Category dropdown
- **Severity** chips: Low / Medium / High / Dangerous — #4
- Description (≤250 chars)
- GPS auto + draggable map pin fallback; reverse-geocoded address/ward/area/locality/pincode
- Submit → `createIssue` server fn (duplicate check → upload → assign → insert → history → device increment) → redirect to smart URL.

## Routes

```text
/                              Home (hero, search, stats, hot issues, latest, top authorities)
/report
/issue/$publicId/$slug         Smart URL (#19) — slug optional, redirect if mismatched
/explore                       Filters: category, ward, area, status, authority, severity, sort
/authorities, /authority/$id
/representatives, /representative/$id
/wards, /ward/$id              Ward dashboard broken down by category (#10) + heatmap
/leaderboard                   Multi-tab (#9): Fastest response, Most resolved, Least pending, Highest rating, Most improved
/auth
/_authenticated/admin           Analytics dashboard (#16)
/_authenticated/admin/issues    Approve / hide / mark spam / mark duplicate / update status / upload repair photo / post official update
/_authenticated/admin/authorities | /representatives | /wards | /categories | /rules
```

Public routes set unique `head()` meta. Issue detail derives og:image from issue photo.

## Issue detail page

- Large image, map, severity + category + status chips
- Before/After/Citizen-After photo gallery from history (#7) — citizens can add "current photo" any time
- Timeline (status history + official updates) (#11)
- Quick-reply comment buttons (#14) + free comment
- Votes (Still exists / Fixed) with percentage bar
- "I also saw this" supporter button
- **Resolved Thanks** button (visible once status ≥ Resolved) — thanks counter
- Share row: WhatsApp, X, LinkedIn, Facebook, copy link (#13)
- Generate poster button (#12)
- Official Update card (defaults to "No update yet.") (#11)
- Subscribe to updates (writes `issue_watchers`) (#15)

## Poster (#12, 1080×1350 PNG)

Issue photo dominates (top 65%). Bottom band: authority logo (small), small rep photo, status pill, Issue ID, area · ward · date, bilingual line, QR to issue URL, hashtag #JanFixMangaluru, website. Rendered client-side with `html-to-image`.

## Share cards (#13)

Per-platform optimized PNGs generated on demand:

- WhatsApp / FB / LinkedIn: 1200×630
- X: 1600×900
- Instagram poster: 1080×1350
  Plus deep-link share intents (`wa.me`, `twitter.com/intent`, `linkedin.com/sharing`, `facebook.com/sharer`).

## Admin analytics (#16)

Cards: reports today / 7d / 30d, avg resolution time, fastest authority, most problematic ward, most reported category, total open vs resolved, heatmap (Leaflet.heat).

## Search (#17)

Single input over: public_id, category name, ward number/name, area, authority name, rep name, description trigram. Server-side combined query, ranked.

## Resolved Thanks

Once an issue hits `Resolved` or `Community Confirmed`, citizens can tap "🙏 Thanks" once per device. Shown on issue, authority profile, and leaderboard ("Highest citizen rating" tab) — #9.

## Disclaimer

Footer + every authority profile + every score:
_"This platform is an independent citizen initiative. The Community Accountability Score is based only on publicly visible reports and community verification — not an official evaluation."_

## Seed (placeholders, editable in admin)

- Authorities: MCC (Roads, Health, Horticulture, Streetlights via MESCOM ref), KUWS&DB, MESCOM, Mangaluru Traffic Police, PWD Karnataka, NHAI, DK District Admin
- Reps: MP DK, MLAs (Mangaluru North/South, Ullal, Moodbidri), Mayor, MCC Commissioner — tagged "Placeholder — update in admin"
- 60 wards with placeholder names
- One v1 `assignment_rules` set covering all 13 categories

## Out of scope for v1 (table-ready)

Push/SMS/email notifications (tables exist via `issue_watchers`), payments, multi-city, AI clustering of duplicates beyond pHash + trigram.

## Build order

1. Enable Lovable Cloud; migration with schema + RLS + grants + storage buckets + assignment_rules v1 + seed data.
2. Design tokens (white/blue/green, glass cards, rounded-2xl), Plus Jakarta Sans + Inter via `@fontsource`, shared shell + footer disclaimer.
3. Home + Explore + Issue detail (read paths, smart URL, share row, poster).
4. Report flow (compression, pHash, GPS, duplicate detection, severity, assignment snapshot).
5. Voting, supporters, quick-reply comments, thanks, watcher subscribe.
6. Authority / representative / ward profiles + multi-tab leaderboard + ward category breakdown + heatmap.
7. Admin auth + admin panel (status updates with repair photo, official updates, visibility moderation, CRUD for authorities/reps/wards/categories/rules) + analytics dashboard.
8. Search, SEO meta, accessibility pass, perf pass.
