export interface Issue {
  id: string;
  public_id: string;
  slug: string;
  description: string;
  severity: string;
  status: string;
  lat: number;
  lng: number;
  image_url: string;
  area: string | null;
  locality: string | null;
  address: string | null;
  ward_id: number | null;
  supporters_count: number;
  thanked_count: number;
  views: number;
  heat_score: number;
  created_at: string;
  updated_at: string;
  category: { id: number; slug: string; name_en: string; icon: string; color: string } | null;
  authority: { id: number; name: string; logo_url: string | null } | null;
  ward: { id: number; number: number; name: string } | null;
}

export interface Authority {
  id: number;
  name: string;
  type: string | null;
  logo_url: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  jurisdiction: string | null;
  total: number;
  resolved: number;
  pending: number;
  avg_days: number | null;
  score: number;
}

export interface Ward {
  id: number;
  number: number;
  name: string;
  area: string | null;
  city: string;
}

export interface Representative {
  id: number;
  name: string;
  role: string;
  constituency: string | null;
  photo_url: string | null;
  phone: string | null;
  email: string | null;
  authority: { id: number; name: string } | null;
  ward: { id: number; number: number; name: string } | null;
}
