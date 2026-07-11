import { query } from "@/lib/db";

export type ResolveInput = {
  category_id: number;
  ward_id?: number | null;
  area?: string | null;
  locality?: string | null;
  address?: string | null;
  city?: string | null;
};

export type ResolveResult = {
  authority_id: number | null;
  representative_id: number | null;
  reason: string;
  version: number;
  resolved_ward_id: number | null;
  // Set when the resolution relied on a low-confidence, admin-flagged
  // jurisdiction_rules row (ambiguous jurisdiction) rather than a confirmed
  // ward/category assignment. Surfaced to admins on the Issues page.
  needs_review?: boolean;
  jurisdiction_confidence?: string | null;
};

type AreaMapping = { keyword: string; ward_id: number | null; constituency: string | null; city: string | null; priority: number };
type AssignmentRule = { authority_id: number; representative_id: number | null; version: number; ward_id: number | null };
type Rep = { id: number; name: string; role: string; constituency: string | null; city: string | null; ward_id: number | null };
type JurisdictionRule = {
  id: number;
  category_id: number;
  scope_type: string;
  taluk_id: number | null;
  authority_id: number | null;
  confidence: string;
  notes: string | null;
  priority: number;
  active: boolean;
};

// ── Embedded area→ward/constituency/city mapping (no DB table needed) ──
// Ward numbers map to:
//   wards 1-30 (Kudroli–Bunts Hostel)  → Mangaluru City South
//   wards 31-60 (Lalbagh–Thenka Patla) → Mangaluru City North
const SOUTH_WARDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 47, 52, 55];
const NORTH_WARDS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 23, 24, 25, 26, 41, 43, 44, 48, 50, 51, 53, 54, 57];
const MANGALURU_WARDS = [19, 20, 21, 22, 49];
const BANTWAL_WARDS = [42, 45, 58];
const MOODABIDRI_WARDS = [46, 56, 59, 60];

const WARD_CONSTITUENCY: Record<number, string> = {};
for (const w of SOUTH_WARDS) WARD_CONSTITUENCY[w] = "Mangaluru City South";
for (const w of NORTH_WARDS) WARD_CONSTITUENCY[w] = "Mangaluru City North";
for (const w of MANGALURU_WARDS) WARD_CONSTITUENCY[w] = "Mangaluru";
for (const w of BANTWAL_WARDS) WARD_CONSTITUENCY[w] = "Bantwal";
for (const w of MOODABIDRI_WARDS) WARD_CONSTITUENCY[w] = "Moodabidri";

// Ward number → ward name mapping (for area→ward resolution)
const WARD_NAMES: Record<string, { number: number; area: string }> = {
  kudroli:       { number: 1,  area: "Kudroli" },
  mangaladevi:   { number: 2,  area: "Mangaladevi" },
  bolar:         { number: 3,  area: "Bolar" },
  jeppu:         { number: 4,  area: "Jeppu" },
  bendoor:       { number: 5,  area: "Bendoor" },
  kankanady:     { number: 6,  area: "Kankanady" },
  urwa:          { number: 7,  area: "Urwa" },
  pumpwell:      { number: 8,  area: "Pumpwell" },
  padil:         { number: 9,  area: "Padil" },
  kulur:         { number: 10, area: "Kulur" },
  surathkal:     { number: 11, area: "Surathkal" },
  panambur:      { number: 12, area: "Panambur" },
  baikampady:    { number: 13, area: "Baikampady" },
  tannirbavi:    { number: 14, area: "Tannirbavi" },
  hosabettu:     { number: 15, area: "Hosabettu" },
  mudushedde:    { number: 16, area: "Mudushedde" },
  krishnapur:    { number: 17, area: "Krishnapur" },
  shirthady:     { number: 18, area: "Shirthady" },
  deralakatte:   { number: 19, area: "Deralakatte" },
  thokkottu:     { number: 20, area: "Thokkottu" },
  kotekar:       { number: 21, area: "Kotekar" },
  ullal:         { number: 22, area: "Ullal" },
  katipalla:     { number: 23, area: "Katipalla" },
  kavoor:        { number: 24, area: "Kavoor" },
  kunjathbail:   { number: 25, area: "Kunjathbail" },
  marakada:      { number: 26, area: "Marakada" },
  attavar:       { number: 27, area: "Attavar" },
  bejai:         { number: 28, area: "Bejai" },
  kodialbail:    { number: 29, area: "Kodialbail" },
  "car street":  { number: 30, area: "Car Street" },
  hampankatta:   { number: 31, area: "Hampankatta" },
  balmatta:      { number: 32, area: "Balmatta" },
  "state bank":  { number: 33, area: "State Bank" },
  pandeshwar:    { number: 33, area: "State Bank" },
  "pvs circle":  { number: 34, area: "PVS Circle" },
  falnir:        { number: 35, area: "Falnir" },
  "bunts hostel":{ number: 36, area: "Bunts Hostel" },
  lalbagh:       { number: 37, area: "Lalbagh" },
  mannagudda:    { number: 38, area: "Mannagudda" },
  kadri:         { number: 39, area: "Kadri" },
  "kadri hills": { number: 40, area: "Kadri Hills" },
  kapikad:       { number: 41, area: "Kapikad" },
  thumbay:       { number: 42, area: "Thumbay" },
  vamanjoor:     { number: 43, area: "Vamanjoor" },
  typepuram:     { number: 44, area: "Kutipuram" },
  adyar:         { number: 45, area: "Adyar" },
  gantalkatte:   { number: 46, area: "Gantalkatte" },
  nandigudda:    { number: 47, area: "Nandigudda" },
  konchady:      { number: 48, area: "Konchady" },
  paneer:        { number: 49, area: "Paneer" },
  derebail:      { number: 50, area: "Derebail" },
  kottara:       { number: 51, area: "Kottara" },
  kodialguttu:   { number: 52, area: "Kodialguttu" },
  "bangra kulur":{ number: 53, area: "Bangra Kulur" },
  moodushedde:   { number: 54, area: "Moodushedde" },
  yekkur:        { number: 55, area: "Yekkur" },
  kinnigoli:     { number: 56, area: "Kinnigoli" },
  paldane:       { number: 57, area: "Paldane" },
  shamboor:      { number: 58, area: "Shamboor" },
  paduperar:     { number: 59, area: "Paduperar" },
  "thenka patla":{ number: 60, area: "Thenka Patla" },
};

// Extra locality/area keywords → ward number + constituency override
const EXTRA_MAPPINGS: AreaMapping[] = [
  // User-requested override: route Valachil / Bangalagudde issues to the
  // Mangaluru City North MLA (Dr. Bharath Shetty Y.) instead of Bantwal.
  // Note: official DK district records associate the Valachil/Farangipet
  // (PIN 574143) locality with Bantwal taluk, but this reflects an explicit
  // correction requested by the workspace owner.
  { keyword: "valachil",     ward_id: null, constituency: "Mangaluru City North", city: "Mangaluru", priority: 20 },
  { keyword: "bangalagudde", ward_id: null, constituency: "Mangaluru City North", city: "Mangaluru", priority: 20 },
  { keyword: "pandeshwar",   ward_id: null, constituency: "Mangaluru City South", city: "Mangaluru", priority: 20 },
  // Rural DK taluk names → constituency only (no ward)
  { keyword: "bantwal",      ward_id: null, constituency: "Bantwal",     city: null, priority: 5 },
  { keyword: "puttur",       ward_id: null, constituency: "Puttur",      city: null, priority: 5 },
  { keyword: "sullia",       ward_id: null, constituency: "Sullia (SC)", city: null, priority: 5 },
  { keyword: "belthangady",  ward_id: null, constituency: "Belthangady", city: null, priority: 5 },
  { keyword: "moodabidri",   ward_id: null, constituency: "Moodabidri",  city: null, priority: 5 },
  { keyword: "mulki",        ward_id: null, constituency: "Mangaluru",   city: null, priority: 5 },
  // Additional rural villages/towns that must NOT route to MCC
  { keyword: "vittal",       ward_id: null, constituency: "Bantwal",     city: null, priority: 5 },
  { keyword: "uppinangady",  ward_id: null, constituency: "Bantwal",     city: null, priority: 5 },
  { keyword: "farangipet",   ward_id: null, constituency: "Bantwal",     city: null, priority: 5 },
  { keyword: "kadaba",       ward_id: null, constituency: "Puttur",      city: null, priority: 5 },
  { keyword: "dharmasthala", ward_id: null, constituency: "Belthangady", city: null, priority: 5 },
  { keyword: "venur",        ward_id: null, constituency: "Belthangady", city: null, priority: 5 },
  { keyword: "subramanya",   ward_id: null, constituency: "Sullia (SC)", city: null, priority: 5 },
  { keyword: "guruvayanakere",ward_id: null, constituency: "Belthangady", city: null, priority: 5 },
];

// ── Rural taluk keyword detection (for scope-aware jurisdiction rules) ──
// See the governance knowledge base: DK's 9 taluks. Used only to pick a
// jurisdiction_rules scope (mcc / rural / state_highway / national_highway)
// when no ward has been resolved -- this does NOT override area_mappings.
const TALUK_KEYWORDS: Record<string, string> = {
  bantwal: "Bantwal",
  puttur: "Puttur",
  sullia: "Sullia",
  belthangady: "Belthangady",
  moodabidri: "Moodabidri",
  ullala: "Ullala",
  ullal: "Ullala",
  mulki: "Mulki",
  kadaba: "Kadaba",
  vittal: "Bantwal",
  uppinangady: "Bantwal",
  farangipet: "Bantwal",
  dharmasthala: "Belthangady",
  venur: "Belthangady",
  subramanya: "Sullia",
  guruvayanakere: "Belthangady",
};

// Known MCC ward area names — if the location text mentions any of these,
// the report is inside the municipal corporation boundary, not rural.
const MCC_AREA_NAMES = new Set(Object.keys(WARD_NAMES));

function detectScope(
  locationText: string,
  hasWard: boolean,
): { scope: "mcc" | "rural" | "state_highway" | "national_highway" | "any"; taluk: string | null } {
  if (/\bnh[\s-]?\d+\b|national highway/i.test(locationText)) return { scope: "national_highway", taluk: null };
  if (/\bsh[\s-]?\d+\b|state highway/i.test(locationText)) return { scope: "state_highway", taluk: null };
  if (hasWard) return { scope: "mcc", taluk: null };
  // Check for explicit taluk/village keywords → rural
  for (const [kw, taluk] of Object.entries(TALUK_KEYWORDS)) {
    if (locationText.includes(kw)) return { scope: "rural", taluk };
  }
  // Check if location mentions a known MCC ward area → mcc even without ward_id
  for (const areaName of MCC_AREA_NAMES) {
    if (locationText.includes(areaName)) return { scope: "mcc", taluk: null };
  }
  // Default: if no ward AND no known MCC area → treat as rural (not 'any')
  // This prevents villages from being assigned to MCC by default
  return { scope: "rural", taluk: null };
}

// resolveIssue now fetches rules from Neon directly (no Supabase parameter).
export async function resolveIssue(input: ResolveInput): Promise<ResolveResult> {
  const locationText = [input.area, input.locality, input.address].filter(Boolean).join(" ").toLowerCase();
  const parts: string[] = [];

  // ── Load rules + reps + scope-aware jurisdiction rules in parallel ──
  const [rulesRes, repsRes, jrulesRes] = await Promise.all([
    query<AssignmentRule>(
      `SELECT authority_id, representative_id, version, ward_id
       FROM public.assignment_rules
       WHERE category_id = $1 AND active = true`,
      [input.category_id],
    ),
    query<Rep>(
      `SELECT id, name, role, constituency, city, ward_id
       FROM public.representatives
       WHERE active = true`,
    ),
    query<JurisdictionRule>(
      `SELECT id, category_id, scope_type, taluk_id, authority_id, confidence, notes, priority, active
       FROM public.jurisdiction_rules
       WHERE category_id = $1 AND active = true`,
      [input.category_id],
    ),
  ]);

  const rules: AssignmentRule[] = rulesRes.rows;
  const reps: Rep[] = repsRes.rows;
  const jrules: JurisdictionRule[] = jrulesRes.rows;

  // ── Build area mapping from embedded data ──────────────────────────
  const mappings: AreaMapping[] = [...EXTRA_MAPPINGS];
  // Ward name mappings → their ward + constituency
  for (const [keyword, info] of Object.entries(WARD_NAMES)) {
    const constName = WARD_CONSTITUENCY[info.number] ?? null;
    mappings.push({ keyword, ward_id: info.number, constituency: constName, city: "Mangaluru", priority: 10 });
  }

  // ── LAYER 1: Exact ward match ─────────────────────────────────────
  if (input.ward_id) {
    const wardRule = rules.find((r) => r.ward_id === input.ward_id);
    if (wardRule) {
      parts.push(`Ward=${input.ward_id}`);
      const corporator = reps.find((r) => r.role === "Corporator" && r.ward_id === input.ward_id);
      return {
        authority_id: wardRule.authority_id,
        representative_id: corporator?.id ?? wardRule.representative_id ?? null,
        reason: parts.join(", "),
        version: wardRule.version,
        resolved_ward_id: input.ward_id,
      };
    }
  }

  // ── LAYER 2: Area/locality keyword match ───────────────────────────
  let matchedMapping: AreaMapping | null = null;
  let matchedKeyword = "";
  if (locationText) {
    for (const m of mappings) {
      if (locationText.includes(m.keyword)) {
        if (
          !matchedMapping ||
          m.priority > matchedMapping.priority ||
          (m.priority === matchedMapping.priority && m.keyword.length > matchedKeyword.length)
        ) {
          matchedMapping = m;
          matchedKeyword = m.keyword;
        }
      }
    }
  }

  let resolvedWardId = input.ward_id ?? matchedMapping?.ward_id ?? null;
  let resolvedCity = matchedMapping?.city ?? input.city ?? null;
  let resolvedConstituency = matchedMapping?.constituency ?? null;

  if (matchedMapping) {
    parts.push(`Area="${matchedKeyword}"→${matchedMapping.constituency ?? matchedMapping.ward_id ?? "?"}`);
  }

  // ── LAYER 3: Ward-based rule from mapped area ──────────────────────
  if (resolvedWardId) {
    const wardRule = rules.find((r) => r.ward_id === resolvedWardId);
    if (wardRule) {
      const corporator = reps.find((r) => r.role === "Corporator" && r.ward_id === resolvedWardId);
      parts.push(`Ward=${resolvedWardId}`);
      let repId = corporator?.id ?? null;
      if (!repId && resolvedConstituency) {
        repId = findMlaByConstituency(reps, resolvedConstituency)?.id ?? null;
      }
      return {
        authority_id: wardRule.authority_id,
        representative_id: repId ?? wardRule.representative_id ?? null,
        reason: parts.join(", "),
        version: wardRule.version,
        resolved_ward_id: resolvedWardId,
      };
    }
  }

  // ── LAYER 4: Scope-aware jurisdiction rule, then generic category rule ──
  // jurisdiction_rules is an admin-editable overlay (see governance
  // knowledge base) that only kicks in when no ward-specific assignment_rule
  // exists. It never overrides an explicit ward rule from Layers 1-3.
  const { scope } = detectScope(locationText, !!resolvedWardId);
  const scopeMatches = jrules.filter((r) => r.scope_type === scope);
  const anyMatches = jrules.filter((r) => r.scope_type === "any");
  const jurisdictionRule =
    (scopeMatches.length ? scopeMatches : anyMatches).sort((a, b) => b.priority - a.priority)[0] ?? null;

  const genericRule = rules.find((r) => r.ward_id === null);
  // For rural/highway scopes, jurisdiction rules MUST take priority over
  // generic category rules (which default to MCC). Only fall back to generic
  // rules for 'mcc' or 'any' scope where MCC is the correct authority.
  const authorityId = (scope === "rural" || scope === "state_highway" || scope === "national_highway")
    ? (jurisdictionRule?.authority_id ?? genericRule?.authority_id ?? null)
    : (genericRule?.authority_id ?? jurisdictionRule?.authority_id ?? null);

  let needsReview = false;
  let jurisdictionConfidence: string | null = null;
  if (jurisdictionRule) {
    jurisdictionConfidence = jurisdictionRule.confidence;
    if (jurisdictionRule.confidence === "low") {
      needsReview = true;
      parts.push(`Needs review (${scope}): ${jurisdictionRule.notes ?? "ambiguous jurisdiction"}`);
    } else if (!parts.some((p) => p.startsWith("Area="))) {
      parts.push(`Jurisdiction=${scope}`);
    }
  } else if (!parts.some((p) => p.startsWith("Area="))) {
    parts.push(`Category rule`);
  }

  // ── LAYER 5: Constituency scoring ──────────────────────────────────
  let repId: number | null = genericRule?.representative_id ?? null;
  if (!repId && locationText) {
    repId = resolveRepByConstituency(reps, locationText, resolvedConstituency);
    if (repId) parts.push(`Rep=constituency`);
  }

  // ── LAYER 6: City-based fallback ───────────────────────────────────
  if (!repId && resolvedCity) {
    const cityLower = resolvedCity.toLowerCase();
    if (cityLower === "mangaluru") {
      repId = reps.find((r) => r.role === "Commissioner")?.id
        ?? reps.find((r) => r.role === "Mayor")?.id
        ?? reps.find((r) => r.role === "MLA" && r.city?.toLowerCase() === cityLower)?.id
        ?? reps.find((r) => r.role === "MP")?.id
        ?? null;
    } else {
      repId = reps.find((r) => r.role === "MLA" && r.city?.toLowerCase() === cityLower)?.id
        ?? reps.find((r) => r.role === "MP")?.id
        ?? null;
    }
    if (repId) parts.push(`Rep=city`);
  }

  // ── LAYER 7: Default fallback ──────────────────────────────────────
  if (!repId) {
    repId = reps.find((r) => r.role === "MLA")?.id
      ?? reps.find((r) => r.role === "Mayor")?.id
      ?? reps.find((r) => r.role === "MP")?.id
      ?? null;
    if (repId) parts.push(`Rep=default`);
  }

  return {
    authority_id: authorityId,
    representative_id: repId,
    reason: parts.join(", "),
    version: genericRule?.version ?? 1,
    resolved_ward_id: resolvedWardId,
    needs_review: needsReview,
    jurisdiction_confidence: jurisdictionConfidence,
  };
}

function findMlaByConstituency(reps: Rep[], constituency: string): Rep | null {
  if (!constituency) return null;
  return reps.find(
    (r) => r.role === "MLA" && r.constituency?.toLowerCase() === constituency.toLowerCase(),
  ) ?? null;
}

function resolveRepByConstituency(reps: Rep[], locationText: string, prematchedConstituency: string | null): number | null {
  if (prematchedConstituency) {
    const mla = findMlaByConstituency(reps, prematchedConstituency);
    if (mla) return mla.id;
  }

  // Known area→constituency overrides for places not in any constituency name
  const AREA_CONSTITUENCY_OVERRIDE: Record<string, string> = {
    valachil: "Mangaluru City North",
    bangalagudde: "Mangaluru City North",
  };
  let enriched = locationText;
  for (const [area, constituency] of Object.entries(AREA_CONSTITUENCY_OVERRIDE)) {
    if (locationText.includes(area)) {
      enriched += " " + constituency.toLowerCase();
    }
  }

  let bestRep: Rep | null = null;
  let bestScore = 0;
  for (const rep of reps) {
    if (!["MP", "MLA"].includes(rep.role)) continue;
    if (!rep.constituency) continue;
    const keywords = rep.constituency
      .toLowerCase()
      .replace(/[()]/g, "")
      .split(/[\s,]+/)
      .filter((k) => k.length > 2);
    let score = 0;
    for (const kw of keywords) {
      if (enriched.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestRep = rep;
    }
  }
  if (bestRep) return bestRep.id;

  const cityMla = reps.find(
    (r) => r.role === "MLA" && r.city && locationText.includes(r.city.toLowerCase()),
  );
  if (cityMla) return cityMla.id;

  return reps.find((r) => r.role === "MLA")?.id ?? reps.find((r) => r.role === "MP")?.id ?? null;
}
