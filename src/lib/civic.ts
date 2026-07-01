export const CATEGORIES = [
  { slug: "pothole", name_en: "Pothole", name_kn: "ಗುಂಡಿ", icon: "Construction", color: "#ef4444" },
  { slug: "garbage", name_en: "Garbage", name_kn: "ಕಸ", icon: "Trash2", color: "#16a34a" },
  {
    slug: "sewage",
    name_en: "Sewage Overflow",
    name_kn: "ಚರಂಡಿ ಉಕ್ಕಿ",
    icon: "Droplet",
    color: "#7c3aed",
  },
  {
    slug: "water-leakage",
    name_en: "Water Leakage",
    name_kn: "ನೀರಿನ ಸೋರಿಕೆ",
    icon: "Droplets",
    color: "#0ea5e9",
  },
  {
    slug: "streetlight",
    name_en: "Broken Streetlight",
    name_kn: "ದೀಪ ಕೆಟ್ಟಿದೆ",
    icon: "Lightbulb",
    color: "#f59e0b",
  },
  {
    slug: "road-damage",
    name_en: "Road Damage",
    name_kn: "ರಸ್ತೆ ಹಾನಿ",
    icon: "TriangleAlert",
    color: "#dc2626",
  },
  {
    slug: "footpath",
    name_en: "Footpath Damage",
    name_kn: "ಪಾದಚಾರಿ ಮಾರ್ಗ",
    icon: "Footprints",
    color: "#a16207",
  },
  {
    slug: "drain",
    name_en: "Drain Blockage",
    name_kn: "ಚರಂಡಿ ಕಟ್ಟು",
    icon: "Filter",
    color: "#0891b2",
  },
  {
    slug: "tree-hazard",
    name_en: "Tree Hazard",
    name_kn: "ಮರದ ಅಪಾಯ",
    icon: "Trees",
    color: "#15803d",
  },
  {
    slug: "public-toilet",
    name_en: "Public Toilet",
    name_kn: "ಶೌಚಾಲಯ",
    icon: "DoorOpen",
    color: "#9333ea",
  },
  {
    slug: "illegal-dumping",
    name_en: "Illegal Dumping",
    name_kn: "ಅಕ್ರಮ ಕಸ",
    icon: "Ban",
    color: "#b91c1c",
  },
  {
    slug: "traffic-signal",
    name_en: "Traffic Signal",
    name_kn: "ಸಂಚಾರ ಸಂಕೇತ",
    icon: "TrafficCone",
    color: "#ea580c",
  },
  { slug: "others", name_en: "Others", name_kn: "ಇತರೆ", icon: "HelpCircle", color: "#64748b" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const categoryBySlug = (slug: string) =>
  CATEGORIES.find((c) => c.slug === slug) ?? CATEGORIES[CATEGORIES.length - 1];

export const SEVERITY_META = {
  low: { label: "Low", color: "bg-muted text-muted-foreground", weight: 0.2 },
  medium: {
    label: "Medium",
    color: "bg-warning/15 text-warning border border-warning/30",
    weight: 0.5,
  },
  high: {
    label: "High",
    color: "bg-destructive/15 text-destructive border border-destructive/30",
    weight: 0.8,
  },
  dangerous: { label: "Dangerous", color: "bg-destructive text-destructive-foreground", weight: 1 },
} as const;

export const STATUS_META = {
  reported: { label: "Reported", color: "bg-muted text-muted-foreground", step: 1 },
  community_verified: {
    label: "Community Verified",
    color: "bg-primary/10 text-primary border border-primary/20",
    step: 2,
  },
  assigned: { label: "Assigned", color: "bg-primary/15 text-primary", step: 3 },
  work_started: { label: "Work Started", color: "bg-warning/15 text-warning", step: 4 },
  resolved: {
    label: "Resolved",
    color: "bg-success/15 text-success border border-success/30",
    step: 5,
  },
  community_confirmed: {
    label: "Community Confirmed",
    color: "bg-success text-success-foreground",
    step: 6,
  },
  closed: { label: "Closed", color: "bg-muted text-muted-foreground", step: 7 },
} as const;

export const STATUS_ORDER = [
  "reported",
  "community_verified",
  "assigned",
  "work_started",
  "resolved",
  "community_confirmed",
  "closed",
] as const;

export function trustBadge(reportCount: number) {
  if (reportCount >= 40) return { label: "Civic Champion", icon: "🏅" };
  if (reportCount >= 15) return { label: "Trusted Citizen", icon: "⭐" };
  if (reportCount >= 5) return { label: "Active Citizen", icon: "✨" };
  return { label: "Citizen", icon: "" };
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}
