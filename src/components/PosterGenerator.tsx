import { useEffect, useRef, useState, useMemo, type CSSProperties } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MapPin, Building2, CalendarDays, Eye, ThumbsUp, Phone, Download, Share2, Settings } from "lucide-react";
import { STATUS_META, categoryBySlug } from "@/lib/civic";
import { getBase64ImageFn } from "@/lib/proxy.functions";

type IssueLike = {
  public_id: string;
  description: string;
  status: keyof typeof STATUS_META;
  severity: string;
  area: string | null;
  locality: string | null;
  address?: string | null;
  image_url: string | null;
  supporters_count?: number | null;
  views?: number | null;
  created_at?: string | null;
  ward?: { number: number; name?: string | null } | null;
  category?: { slug: string; name_en: string; color: string | null } | null;
  authority?: {
    name: string;
    logo_url: string | null;
    department?: string | null;
    type?: string | null;
  } | null;
  representative?: {
    name: string;
    role: string;
    photo_url: string | null;
    phone?: string | null;
  } | null;
};

// Fixed poster size: 750×1100 (portrait, like the reference)
const POSTER_W = 750;
const POSTER_H = 1100;

const SIZES = {
  instagram: { w: 1080, h: 1350, label: "Instagram Post" },
  story:     { w: 1080, h: 1920, label: "Story / Reel" },
  twitter:   { w: 1200, h: 675,  label: "Twitter / X" },
  linkedin:  { w: 1200, h: 627,  label: "LinkedIn" },
  whatsapp:  { w: 1080, h: 1080, label: "WhatsApp" },
} as const;

const STATUS_LABEL: Record<string, string> = {
  reported:             "REPORTED",
  community_verified:   "VERIFIED",
  assigned:             "ASSIGNED",
  work_started:         "IN PROGRESS",
  resolved:             "RESOLVED",
  community_confirmed:  "CONFIRMED",
  closed:               "CLOSED",
};

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  reported:            { bg: "#fde047", fg: "#0f172a" },
  community_verified:  { bg: "#bfdbfe", fg: "#1e3a8a" },
  assigned:            { bg: "#fed7aa", fg: "#7c2d12" },
  work_started:        { bg: "#fde047", fg: "#0f172a" },
  resolved:            { bg: "#86efac", fg: "#14532d" },
  community_confirmed: { bg: "#6ee7b7", fg: "#064e3b" },
  closed:              { bg: "#cbd5e1", fg: "#334155" },
};

const REPRESENTATIVE_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f1f5f9"/><circle cx="50" cy="38" r="22" fill="%2394a3b8"/><path d="M10 90c0-24 18-36 40-36s40 12 40 36z" fill="%2394a3b8"/></svg>`;
const AUTHORITY_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eff6ff"/><rect x="20" y="35" width="60" height="45" fill="none" stroke="%231d4ed8" stroke-width="6"/><rect x="38" y="55" width="24" height="25" fill="%231d4ed8"/><polygon points="50,10 85,35 15,35" fill="%231d4ed8"/></svg>`;
const ISSUE_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" fill="%23e2e8f0"><rect width="800" height="500"/><text x="400" y="260" text-anchor="middle" font-size="32" fill="%2394a3b8">No photo</text></svg>`;

function useImageDataUrls(urls: (string | null | undefined)[]): Map<string, string> {
  const cache = useRef<Map<string, string>>(new Map());
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const url of urls) {
        if (!url || cache.current.has(url)) continue;
        try {
          if (url.startsWith("data:")) { cache.current.set(url, url); continue; }
          const res = await getBase64ImageFn({ data: { url } });
          if (res.base64 && !cancelled) { cache.current.set(url, res.base64); setTick((t) => t + 1); }
        } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; cache.current.clear(); };
  }, [JSON.stringify(urls)]);

  return cache.current;
}

export function PosterGenerator({ issue, publicUrl }: { issue: IssueLike; publicUrl: string }) {
  const [size, setSize] = useState<keyof typeof SIZES>("instagram");
  const [qr, setQr] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);

  const cat = issue.category ?? categoryBySlug("others");
  const statusLabel = STATUS_LABEL[issue.status] ?? "REPORTED";
  const statusColor = STATUS_COLOR[issue.status] ?? STATUS_COLOR.reported;
  const dims = SIZES[size];

  const imageUrls = useMemo(() => [
    issue.image_url,
    issue.authority?.logo_url,
    issue.representative?.photo_url,
  ], [issue.image_url, issue.authority?.logo_url, issue.representative?.photo_url]);
  const dataUrls = useImageDataUrls(imageUrls);

  const imgSrc  = issue.image_url             ? (dataUrls.get(issue.image_url)             ?? ISSUE_PLACEHOLDER)         : ISSUE_PLACEHOLDER;
  const logoSrc = issue.authority?.logo_url   ? (dataUrls.get(issue.authority.logo_url)    ?? AUTHORITY_PLACEHOLDER)     : AUTHORITY_PLACEHOLDER;
  const repSrc  = issue.representative?.photo_url ? (dataUrls.get(issue.representative.photo_url) ?? REPRESENTATIVE_PLACEHOLDER) : REPRESENTATIVE_PLACEHOLDER;

  useEffect(() => {
    QRCode.toDataURL(publicUrl, { margin: 1, width: 280 }).then(setQr).catch(() => setQr(""));
  }, [publicUrl]);

  const locationLabel = [issue.area, issue.locality].filter(Boolean).join(", ") || issue.address || "Mangaluru";
  const wardLabel     = issue.ward ? `${issue.ward.number}` : "—";
  const reportedDate  = issue.created_at ? new Date(issue.created_at) : null;
  const dateLine      = reportedDate ? reportedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—";
  const timeLine      = reportedDate ? reportedDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";
  const supportsCount = issue.supporters_count ?? 0;
  const viewsCount    = issue.views ?? 0;
  const idTail        = issue.public_id.includes("-") ? issue.public_id.split("-").pop() : issue.public_id;
  const shortLink     = `janfix.in/${idTail}`;

  // ── Download ────────────────────────────────────────────────────────────────
  const download = async () => {
    if (!downloadRef.current || downloading) return;
    setDownloading(true);
    try {
      await new Promise((r) => setTimeout(r, 150));
      const data = await toPng(downloadRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: POSTER_W,
        height: POSTER_H,
        backgroundColor: "#ffffff",
      });
      const a = document.createElement("a");
      a.href = data;
      a.download = `JanFix-${issue.public_id}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Poster downloaded!");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't download poster. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  // Preview scale so poster fits nicely in 360px wide UI
  const PREVIEW_W = 360;
  const scale     = PREVIEW_W / POSTER_W;

  // ── Poster content (same JSX used for preview + offscreen download) ─────────
  const renderPoster = (w: number, h: number) => {
    // Scale all sizes relative to the reference 750×1100 poster
    const s = w / POSTER_W;
    const px = (v: number) => v * s;

    return (
      <div style={{
        width: w, height: h,
        background: "#ffffff",
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: "flex", flexDirection: "column",
        border: `${px(3)}px solid #1d4ed8`,
        overflow: "hidden", boxSizing: "border-box",
      }}>

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: `${px(18)}px ${px(24)}px`,
          borderBottom: `${px(1)}px solid #e2e8f0`,
          background: "#ffffff",
        }}>
          {/* Logo left */}
          <div style={{ display: "flex", alignItems: "center", gap: px(10) }}>
            {/* Pin icon */}
            <svg width={px(44)} height={px(52)} viewBox="0 0 44 52" fill="none">
              <path d="M22 0C10.954 0 2 8.954 2 20c0 14 20 32 20 32s20-18 20-32C42 8.954 33.046 0 22 0z" fill="#1d4ed8"/>
              <circle cx="22" cy="20" r="13" fill="white"/>
              {/* family in pin */}
              <circle cx="22" cy="16" r="2.5" fill="#1d4ed8"/>
              <path d="M17 24c0-3.5 2.2-4.5 5-4.5s5 1 5 4.5v1h-10z" fill="#1d4ed8"/>
              <circle cx="16" cy="18" r="1.8" fill="#1d4ed8"/>
              <path d="M12 24c0-2.5 1.5-3.5 4-3.5v0c0 0-0.5 0.3-0.5 3.5z" fill="#1d4ed8"/>
              <circle cx="28" cy="18" r="1.8" fill="#1d4ed8"/>
              <path d="M32 24c0-2.5-1.5-3.5-4-3.5v0c0 0 0.5 0.3 0.5 3.5z" fill="#1d4ed8"/>
            </svg>
            <div>
              <div style={{ fontSize: px(26), fontWeight: 900, color: "#1d4ed8", lineHeight: 1, letterSpacing: "-0.5px" }}>
                Jan<span style={{ color: "#16a34a" }}>Fix</span>
              </div>
              <div style={{ fontSize: px(10), fontWeight: 800, color: "#1d4ed8", letterSpacing: px(2), marginTop: px(2) }}>MANGALURU</div>
              <div style={{ fontSize: px(9), color: "#64748b", fontWeight: 500, marginTop: px(1) }}>Report. Track. Fix.</div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: px(1), height: px(52), background: "#e2e8f0" }} />

          {/* Right tagline */}
          <div style={{ display: "flex", flexDirection: "column", gap: px(3), paddingLeft: px(16) }}>
            <div style={{ fontSize: px(16), fontWeight: 900, color: "#0f172a" }}>Let's Fix Mangaluru</div>
            <div style={{ fontSize: px(11), fontWeight: 600, color: "#16a34a" }}>ನಮ್ಮ ಮಂಗಳೂರು, ನಮ್ಮ ಜವಾಬ್ದಾರಿ</div>
            <div style={{ fontSize: px(10), color: "#64748b" }}>Together for a Better City</div>
          </div>

          {/* City skyline illustration placeholder */}
          <svg width={px(80)} height={px(60)} viewBox="0 0 80 60" style={{ opacity: 0.18, marginLeft: px(8) }}>
            <rect x="5"  y="30" width="12" height="30" fill="#1d4ed8"/>
            <rect x="8"  y="20" width="6"  height="10" fill="#1d4ed8"/>
            <rect x="20" y="22" width="14" height="38" fill="#1d4ed8"/>
            <rect x="25" y="14" width="4"  height="8"  fill="#1d4ed8"/>
            <rect x="37" y="35" width="10" height="25" fill="#1d4ed8"/>
            <rect x="50" y="26" width="16" height="34" fill="#1d4ed8"/>
            <rect x="56" y="16" width="4"  height="10" fill="#1d4ed8"/>
            <rect x="68" y="38" width="8"  height="22" fill="#1d4ed8"/>
            <line x1="0" y1="58" x2="80" y2="58" stroke="#1d4ed8" strokeWidth="2"/>
          </svg>
        </div>

        {/* ── PHOTO SECTION with overlaid badges ──────────────────────────── */}
        <div style={{ position: "relative", height: px(360), flexShrink: 0, overflow: "hidden" }}>
          <img src={imgSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />

          {/* Dark gradient at bottom */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.08) 55%, transparent 100%)" }} />

          {/* Issue ID badge — top left */}
          <div style={{
            position: "absolute", top: px(16), left: px(16),
            background: "#dc2626", color: "white",
            padding: `${px(6)}px ${px(14)}px`,
            borderRadius: px(6), display: "flex", flexDirection: "column", gap: px(1),
          }}>
            <div style={{ fontSize: px(8), fontWeight: 700, letterSpacing: px(1), opacity: 0.9 }}>ISSUE ID</div>
            <div style={{ fontSize: px(14), fontWeight: 900 }}>{issue.public_id}</div>
          </div>

          {/* Status badge — top right */}
          <div style={{
            position: "absolute", top: px(16), right: px(16),
            background: statusColor.bg, color: statusColor.fg,
            padding: `${px(6)}px ${px(14)}px`,
            borderRadius: px(6), display: "flex", flexDirection: "column", gap: px(1), alignItems: "flex-end",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: px(4) }}>
              <Settings width={px(10)} height={px(10)} />
              <div style={{ fontSize: px(8), fontWeight: 700, letterSpacing: px(1) }}>STATUS</div>
            </div>
            <div style={{ fontSize: px(13), fontWeight: 900 }}>{statusLabel}</div>
          </div>

          {/* Category + description at bottom */}
          <div style={{ position: "absolute", bottom: px(20), left: px(20), right: px(20), color: "white" }}>
            <div style={{ fontSize: px(38), fontWeight: 900, textTransform: "uppercase", lineHeight: 1, textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
              {cat.name_en.toUpperCase()}
            </div>
            <div style={{ fontSize: px(15), marginTop: px(6), opacity: 0.95, fontWeight: 500, lineHeight: 1.35, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
              {issue.description.length > 100 ? issue.description.slice(0, 97) + "…" : issue.description}
            </div>
          </div>
        </div>

        {/* ── LOCATION / WARD / DATE / VIEWS ROW ──────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "stretch",
          margin: `${px(12)}px ${px(16)}px`,
          background: "#ffffff",
          border: `${px(1)}px solid #e2e8f0`,
          borderRadius: px(12),
          overflow: "hidden",
        }}>
          {/* Location */}
          <div style={{ flex: 2, display: "flex", alignItems: "center", gap: px(8), padding: `${px(10)}px ${px(12)}px`, borderRight: `${px(1)}px solid #e2e8f0` }}>
            <MapPin width={px(18)} height={px(18)} color="#1d4ed8" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: px(8), fontWeight: 700, color: "#64748b", letterSpacing: px(0.5), textTransform: "uppercase" }}>LOCATION</div>
              <div style={{ fontSize: px(12), fontWeight: 700, color: "#0f172a", marginTop: px(1), lineHeight: 1.2 }}>{locationLabel}</div>
            </div>
          </div>

          {/* Ward */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: px(8), padding: `${px(10)}px ${px(12)}px`, borderRight: `${px(1)}px solid #e2e8f0` }}>
            <Building2 width={px(16)} height={px(16)} color="#1d4ed8" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: px(8), fontWeight: 700, color: "#64748b", letterSpacing: px(0.5), textTransform: "uppercase" }}>WARD</div>
              <div style={{ fontSize: px(18), fontWeight: 900, color: "#0f172a" }}>{wardLabel}</div>
            </div>
          </div>

          {/* Reported on */}
          <div style={{ flex: 2, display: "flex", alignItems: "center", gap: px(8), padding: `${px(10)}px ${px(12)}px`, borderRight: `${px(1)}px solid #e2e8f0` }}>
            <CalendarDays width={px(16)} height={px(16)} color="#1d4ed8" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: px(8), fontWeight: 700, color: "#64748b", letterSpacing: px(0.5), textTransform: "uppercase" }}>REPORTED ON</div>
              <div style={{ fontSize: px(11), fontWeight: 700, color: "#0f172a", marginTop: px(1) }}>{dateLine}</div>
              <div style={{ fontSize: px(10), color: "#64748b" }}>{timeLine}</div>
            </div>
          </div>

          {/* Supports / Views */}
          <div style={{ flex: 1.2, display: "flex", alignItems: "center", gap: px(8), padding: `${px(10)}px ${px(12)}px` }}>
            <Eye width={px(16)} height={px(16)} color="#1d4ed8" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: px(8), fontWeight: 700, color: "#64748b", letterSpacing: px(0.5), textTransform: "uppercase" }}>SUPPORTS</div>
              <div style={{ fontSize: px(20), fontWeight: 900, color: "#0f172a" }}>{supportsCount}</div>
              <div style={{ fontSize: px(9), color: "#64748b" }}>VIEWS {viewsCount}</div>
            </div>
          </div>
        </div>

        {/* ── AUTHORITY + REPRESENTATIVE ROW ──────────────────────────────── */}
        <div style={{
          display: "flex", gap: px(12),
          margin: `0 ${px(16)}px ${px(12)}px`,
          flex: 1, minHeight: 0,
        }}>
          {/* Authority */}
          <div style={{
            flex: 1,
            border: `${px(1)}px solid #e2e8f0`,
            borderRadius: px(12),
            padding: `${px(12)}px ${px(14)}px`,
            display: "flex", alignItems: "center", gap: px(12),
            background: "#ffffff",
          }}>
            <img src={logoSrc} alt="" style={{ width: px(52), height: px(52), objectFit: "contain", borderRadius: px(6), border: `${px(1)}px solid #e2e8f0`, background: "#f8fafc", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: px(8), fontWeight: 700, color: "#64748b", letterSpacing: px(0.5), textTransform: "uppercase", marginBottom: px(3) }}>RESPONSIBLE AUTHORITY</div>
              <div style={{ fontSize: px(14), fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>
                {issue.authority?.name ?? "MCC"}
              </div>
              {issue.authority?.department && (
                <div style={{ fontSize: px(11), color: "#475569", fontWeight: 600, marginTop: px(2) }}>{issue.authority.department}</div>
              )}
            </div>
          </div>

          {/* Representative */}
          <div style={{
            flex: 1,
            border: `${px(1)}px solid #e2e8f0`,
            borderRadius: px(12),
            padding: `${px(12)}px ${px(14)}px`,
            display: "flex", alignItems: "center", gap: px(12),
            background: "#ffffff",
          }}>
            <img src={repSrc} alt="" style={{ width: px(52), height: px(52), objectFit: "cover", borderRadius: "50%", border: `${px(2)}px solid #1d4ed8`, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: px(8), fontWeight: 700, color: "#64748b", letterSpacing: px(0.5), textTransform: "uppercase", marginBottom: px(3) }}>LOCAL REPRESENTATIVE</div>
              <div style={{ fontSize: px(13), fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>
                {issue.representative?.name ? `Sri. ${issue.representative.name}` : "Not Mapped"}
              </div>
              <div style={{ fontSize: px(10), color: "#475569", fontWeight: 600, marginTop: px(2) }}>
                {issue.representative?.role ?? "—"}
              </div>
              {issue.representative?.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: px(4), fontSize: px(10), color: "#64748b", marginTop: px(3) }}>
                  <Phone width={px(10)} height={px(10)} /> {issue.representative.phone}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <div style={{
          background: "#1e3a8a",
          padding: `${px(14)}px ${px(16)}px`,
          display: "flex", alignItems: "center", gap: px(16),
          flexShrink: 0,
        }}>
          {/* CTA text left */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: px(17), fontWeight: 900, color: "#ffffff", lineHeight: 1.1 }}>
              Your Small Report<br />
              <span style={{ color: "#fbbf24" }}>Can Create a Big Change!</span>
            </div>
            <div style={{ fontSize: px(10), color: "rgba(255,255,255,0.8)", marginTop: px(5), fontWeight: 500, lineHeight: 1.4 }}>
              Vote, share and help make<br />Mangaluru a better place to live.
            </div>
          </div>

          {/* Vote buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: px(6), flexShrink: 0 }}>
            <div style={{ background: "#16a34a", color: "white", padding: `${px(7)}px ${px(12)}px`, borderRadius: px(8), display: "flex", alignItems: "center", gap: px(6) }}>
              <ThumbsUp width={px(14)} height={px(14)} />
              <div>
                <div style={{ fontSize: px(11), fontWeight: 900 }}>ISSUE FIXED</div>
                <div style={{ fontSize: px(8), opacity: 0.85 }}>Vote if the issue is resolved</div>
              </div>
            </div>
            <div style={{ background: "#dc2626", color: "white", padding: `${px(7)}px ${px(12)}px`, borderRadius: px(8), display: "flex", alignItems: "center", gap: px(6) }}>
              <svg width={px(14)} height={px(14)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
              <div>
                <div style={{ fontSize: px(11), fontWeight: 900 }}>STILL EXISTS</div>
                <div style={{ fontSize: px(8), opacity: 0.85 }}>Vote if the issue still exists</div>
              </div>
            </div>
          </div>

          {/* QR code */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: px(4), background: "white", padding: px(8), borderRadius: px(8), flexShrink: 0 }}>
            {qr && <img src={qr} alt="QR" style={{ width: px(64), height: px(64), display: "block" }} />}
            <div style={{ fontSize: px(7), fontWeight: 700, color: "#1d4ed8", letterSpacing: px(0.3), textAlign: "center" }}>SCAN TO VIEW & SUPPORT</div>
            <div style={{ fontSize: px(9), fontWeight: 800, color: "#0f172a" }}>{shortLink}</div>
          </div>
        </div>

      </div>
    );
  };

  // Preview frame
  const previewW = PREVIEW_W;
  const previewH = Math.round(POSTER_H * scale);

  return (
    <div className="space-y-4">
      {/* Download size selector */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground mb-2">Download size:</div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SIZES) as (keyof typeof SIZES)[]).map((k) => (
            <button
              key={k}
              onClick={() => setSize(k)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                size === k ? "bg-primary text-primary-foreground shadow-sm" : "border bg-card text-muted-foreground hover:bg-accent"
              }`}
            >
              {SIZES[k].label}
            </button>
          ))}
        </div>
      </div>

      {/* Poster Preview */}
      <div className="overflow-hidden rounded-xl border bg-muted/20 p-3 shadow-inner">
        <div style={{ width: previewW, height: previewH, overflow: "hidden", margin: "0 auto" }}>
          <div style={{ width: POSTER_W, height: POSTER_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {renderPoster(POSTER_W, POSTER_H)}
          </div>
        </div>
      </div>

      {/* Offscreen element at full download resolution */}
      <div
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: "absolute", top: -99999, left: -99999, width: POSTER_W, height: POSTER_H, overflow: "hidden", pointerEvents: "none" }}
      >
        <div ref={downloadRef}>
          {renderPoster(POSTER_W, POSTER_H)}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2.5">
        <Button onClick={download} disabled={downloading} className="gap-2 px-5 font-semibold">
          <Download className="h-4 w-4" />
          {downloading ? "Generating…" : `Download PNG (${SIZES[size].label})`}
        </Button>
        <ShareButtons url={publicUrl} text={`${issue.description} — ${issue.public_id} on JanFix Mangaluru`} />
      </div>
    </div>
  );
}

function ShareButtons({ url, text }: { url: string; text: string }) {
  const enc = encodeURIComponent;
  const links = [
    { label: "WhatsApp", href: "https://wa.me/?text=" + enc(`${text} ${url}`) },
    { label: "Twitter",  href: "https://twitter.com/intent/tweet?text=" + enc(text) + "&url=" + enc(url) },
    { label: "Facebook", href: "https://www.facebook.com/sharer/sharer.php?u=" + enc(url) },
    { label: "LinkedIn", href: "https://www.linkedin.com/sharing/share-offsite/?url=" + enc(url) },
  ];
  return (
    <>
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-accent">
          <Share2 className="h-3.5 w-3.5" /> {l.label}
        </a>
      ))}
    </>
  );
}
