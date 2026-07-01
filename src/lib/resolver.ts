import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Sb = SupabaseClient<Database>;

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
};

type AreaMapping = { keyword: string; ward_id: number | null; constituency: string | null; city: string | null; priority: number };
type AssignmentRule = { authority_id: number; representative_id: number | null; version: number; ward_id: number | null };
type Rep = { id: number; name: string; role: string; constituency: string | null; city: string | null; ward_id: number | null };

// ── Embedded area→ward/constituency/city mapping (no DB table needed) ──
// Ward numbers map to:
//   wards 1-30 (Kudroli–Bunts Hostel)  → Mangaluru City South
//   wards 31-60 (Lalbagh–Thenka Patla) → Mangaluru City North
const WARD_CONSTITUENCY: Record<number, string> = {};
for (let i = 1; i <= 30; i++) WARD_CONSTITUENCY[i] = "Mangaluru City South";
for (let i = 31; i <= 60; i++) WARD_CONSTITUENCY[i] = "Mangaluru City North";

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
  kutipuram:     { number: 44, area: "Kutipuram" },
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
  // Valachil area → Deralakatte ward (19) + Mangaluru City South
  { keyword: "valachil",     ward_id: 19, constituency: "Mangaluru City South", city: "Mangaluru", priority: 15 },
  { keyword: "bangalagudde", ward_id: 19, constituency: "Mangaluru City South", city: "Mangaluru", priority: 15 },
  // Rural DK taluk names → constituency only (no ward)
  { keyword: "bantwal",      ward_id: null, constituency: "Bantwal",     city: null, priority: 5 },
  { keyword: "puttur",       ward_id: null, constituency: "Puttur",      city: null, priority: 5 },
  { keyword: "sullia",       ward_id: null, constituency: "Sullia (SC)", city: null, priority: 5 },
  { keyword: "belthangady",  ward_id: null, constituency: "Belthangady", city: null, priority: 5 },
  { keyword: "moodabidri",   ward_id: null, constituency: "Moodabidri",  city: null, priority: 5 },
  { keyword: "mulki",        ward_id: null, constituency: "Mangaluru",   city: null, priority: 5 },
];

export async function resolveIssue(sb: Sb, input: ResolveInput): Promise<ResolveResult> {
  const locationText = [input.area, input.locality, input.address].filter(Boolean).join(" ").toLowerCase();
  const parts: string[] = [];

  // ── Load rules + reps in parallel ─────────────────────────────────
  const [rulesRes, repsRes] = await Promise.all([
    sb.from("assignment_rules")
      .select("authority_id, representative_id, version, ward_id")
      .eq("category_id", input.category_id)
      .eq("active", true),
    sb.from("representatives")
      .select("id, name, role, constituency, city, ward_id")
      .eq("active", true),
  ]);
  const rules: AssignmentRule[] = rulesRes.data ?? [];
  const reps: Rep[] = repsRes.data ?? [];

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

  // ── LAYER 4: Generic category rule ─────────────────────────────────
  const genericRule = rules.find((r) => r.ward_id === null);
  const authorityId = genericRule?.authority_id ?? null;
  if (!parts.some((p) => p.startsWith("Area="))) parts.push(`Category rule`);

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
    valachil: "Mangaluru City South",
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
