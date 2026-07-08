import { useEffect, useRef, useState, useMemo } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download, Share2 } from "lucide-react";
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

  const PREVIEW_W = 360;
  const scale     = PREVIEW_W / POSTER_W;

  const renderPoster = (w: number, h: number) => {
    const s = w / POSTER_W;
    const px = (v: number) => v * s;

    return (
      <div style={{
        width: w,
        height: h,
        background: "#ffffff",
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: "flex",
        flexDirection: "column",
        border: `${px(14)}px solid #1d4ed8`,
        overflow: "hidden",
        boxSizing: "border-box",
        position: "relative",
      }}>
        {/* Inner white container with padding */}
        <div style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: `${px(16)}px`,
          boxSizing: "border-box",
        }}>

          {/* ── HEADER ──────────────────────────────────────────────────────── */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: px(14),
            borderBottom: `${px(1)}px solid #cbd5e1`,
            background: "#ffffff",
            flexShrink: 0,
          }}>
            {/* Logo left */}
            <div style={{ display: "flex", alignItems: "center", gap: px(10) }}>
              {/* Pin logo */}
              <svg width={px(44)} height={px(52)} viewBox="0 0 44 52" fill="none" style={{ flexShrink: 0 }}>
                <path d="M22 0C10.954 0 2 8.954 2 20c0 14 20 32 20 32s20-18 20-32C42 8.954 33.046 0 22 0z" fill="#1d4ed8"/>
                <circle cx="22" cy="20" r="13" fill="white"/>
                <circle cx="22" cy="16" r="2.5" fill="#1d4ed8"/>
                <path d="M17 24c0-3.5 2.2-4.5 5-4.5s5 1 5 4.5v1h-10z" fill="#1d4ed8"/>
                <circle cx="16" cy="18" r="1.8" fill="#1d4ed8"/>
                <path d="M12 24c0-2.5 1.5-3.5 4-3.5v0c0 0-0.5 0.3-0.5 3.5z" fill="#1d4ed8"/>
                <circle cx="28" cy="18" r="1.8" fill="#1d4ed8"/>
                <path d="M32 24c0-2.5-1.5-3.5-4-3.5v0c0 0 0.5 0.3 0.5 3.5z" fill="#1d4ed8"/>
              </svg>
              <div>
                <div style={{ fontSize: px(28), fontWeight: 900, color: "#1d4ed8", lineHeight: 1, letterSpacing: "-0.5px" }}>
                  Jan<span style={{ color: "#16a34a" }}>Fix</span>
                </div>
                <div style={{ fontSize: px(11), fontWeight: 800, color: "#1d4ed8", letterSpacing: px(1.5), marginTop: px(2) }}>MANGALURU</div>
                <div style={{ fontSize: px(10), color: "#0f172a", fontWeight: 700, marginTop: px(2) }}>Report. Track. Fix.</div>
              </div>
            </div>

            {/* Vertical Divider */}
            <div style={{ width: px(1.5), height: px(52), background: "#cbd5e1", margin: `0 ${px(16)}px` }} />

            {/* Taglines */}
            <div style={{ display: "flex", flexDirection: "column", gap: px(2), flex: 1 }}>
              <div style={{ fontSize: px(18), fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>Let's Fix Mangaluru</div>
              <div style={{ fontSize: px(12), fontWeight: 700, color: "#16a34a", lineHeight: 1.1 }}>ನಮ್ಮ ಮಂಗಳೂರು, ನಮ್ಮ ಜವಾಬ್ದಾರಿ</div>
              <div style={{ fontSize: px(11), color: "#475569", fontWeight: 600 }}>Together for a Better City</div>
            </div>

            {/* Skyline Illustration */}
            <svg width={px(120)} height={px(52)} viewBox="0 0 120 52" style={{ opacity: 0.25, flexShrink: 0 }}>
              <path d="M5,42 h110 M10,42 V28 h8 V42 M22,42 V18 h12 V42 M38,42 V32 h6 V42 M48,42 V20 h10 V42 M62,42 V12 h14 V42 M80,42 V26 h12 V42 M96,42 V30 h8 V42" stroke="#1d4ed8" strokeWidth="1.5" fill="none" />
              {/* church dome & cross */}
              <path d="M28,18 C28,12 30,10 32,10 C34,10 36,12 36,18 Z" fill="none" stroke="#1d4ed8" strokeWidth="1.5" />
              <path d="M32,10 V4 M30,6 H34" stroke="#1d4ed8" strokeWidth="1.5" />
              {/* temple dome shape */}
              <path d="M69,12 C69,4 75,4 75,12" stroke="#1d4ed8" strokeWidth="1.5" fill="none" />
              <circle cx="75" cy="3" r="1" fill="#1d4ed8" />
            </svg>
          </div>

          {/* ── PHOTO CONTAINER (with overlapping floating details card) ────── */}
          <div style={{
            position: "relative",
            height: px(450),
            marginTop: px(16),
            marginBottom: px(46), // Space for floating card overflow
            flexShrink: 0,
            overflow: "visible", // ALLOW info card to overlap outside bottom boundary
          }}>
            {/* Visual Photo Card */}
            <div style={{
              width: "100%",
              height: "100%",
              borderRadius: px(20),
              overflow: "hidden",
              border: `${px(1)}px solid #cbd5e1`,
              position: "relative",
            }}>
              <img src={imgSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              
              {/* Dark overlay gradient */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 40%, transparent 100%)" }} />

              {/* ISSUE ID badge (top-left) */}
              <div style={{
                position: "absolute",
                top: px(16),
                left: px(16),
                background: "#e60000",
                color: "#ffffff",
                padding: `${px(8)}px ${px(16)}px`,
                borderRadius: px(8),
                display: "flex",
                flexDirection: "column",
                gap: px(1),
              }}>
                <div style={{ fontSize: px(9), fontWeight: 700, letterSpacing: px(1) }}>ISSUE ID</div>
                <div style={{ fontSize: px(15), fontWeight: 900 }}>{issue.public_id}</div>
              </div>

              {/* STATUS badge (top-right) */}
              <div style={{
                position: "absolute",
                top: px(16),
                right: px(16),
                background: "#fcc419",
                color: "#0f172a",
                padding: `${px(8)}px ${px(16)}px`,
                borderRadius: px(8),
                display: "flex",
                alignItems: "center",
                gap: px(8),
              }}>
                {/* Gear Icon */}
                <svg width={px(24)} height={px(24)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: px(9), fontWeight: 700, letterSpacing: px(0.5) }}>STATUS</div>
                  <div style={{ fontSize: px(13), fontWeight: 900 }}>{statusLabel}</div>
                </div>
              </div>

              {/* Title & Desc text inside photo (above the overlapping card) */}
              <div style={{
                position: "absolute",
                bottom: px(68), // Pushed up slightly so it clears the overlapping card
                left: px(20),
                right: px(20),
                color: "#ffffff",
              }}>
                <div style={{ fontSize: px(38), fontWeight: 900, textTransform: "uppercase", lineHeight: 1, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
                  {cat.name_en.toUpperCase()}
                </div>
                <div style={{ fontSize: px(15), marginTop: px(6), opacity: 0.95, fontWeight: 500, lineHeight: 1.35, textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
                  {issue.description.length > 110 ? issue.description.slice(0, 107) + "…" : issue.description}
                </div>
              </div>
            </div>

            {/* FLOATING DETAILS CARD (overlaps photo bottom boundary) */}
            <div style={{
              position: "absolute",
              bottom: px(-32),
              left: px(16),
              right: px(16),
              height: px(82),
              background: "#ffffff",
              borderRadius: px(16),
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              border: `${px(1.5)}px solid #cbd5e1`,
              display: "flex",
              alignItems: "stretch",
              zIndex: 10,
              overflow: "hidden",
            }}>
              {/* Location Column */}
              <div style={{ flex: 1.8, display: "flex", alignItems: "center", gap: px(10), padding: `${px(8)}px ${px(12)}px`, borderRight: `${px(1)}px solid #cbd5e1` }}>
                {/* Location Icon */}
                <svg width={px(24)} height={px(24)} viewBox="0 0 24 24" fill="#1d4ed8">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: px(9), fontWeight: 800, color: "#1d4ed8", letterSpacing: px(0.5) }}>LOCATION</div>
                  <div style={{ fontSize: px(12), fontWeight: 700, color: "#0f172a", marginTop: px(1), lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {locationLabel}
                  </div>
                  <div style={{ fontSize: px(10), color: "#64748b" }}>Mangaluru</div>
                </div>
              </div>

              {/* Ward Column */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: px(8), padding: `${px(8)}px ${px(12)}px`, borderRight: `${px(1)}px solid #cbd5e1` }}>
                {/* Building Icon */}
                <svg width={px(22)} height={px(22)} viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2">
                  <path d="M3 21h18M9 21V10a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v11M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
                </svg>
                <div>
                  <div style={{ fontSize: px(9), fontWeight: 800, color: "#1d4ed8", letterSpacing: px(0.5) }}>WARD</div>
                  <div style={{ fontSize: px(18), fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>{wardLabel}</div>
                </div>
              </div>

              {/* Calendar Column */}
              <div style={{ flex: 1.6, display: "flex", alignItems: "center", gap: px(8), padding: `${px(8)}px ${px(12)}px`, borderRight: `${px(1)}px solid #cbd5e1` }}>
                {/* Calendar Icon */}
                <svg width={px(22)} height={px(22)} viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <div>
                  <div style={{ fontSize: px(9), fontWeight: 800, color: "#1d4ed8", letterSpacing: px(0.5) }}>REPORTED ON</div>
                  <div style={{ fontSize: px(12), fontWeight: 700, color: "#0f172a", lineHeight: 1.1 }}>{dateLine}</div>
                  <div style={{ fontSize: px(10), color: "#64748b", marginTop: px(1) }}>{timeLine}</div>
                </div>
              </div>

              {/* Supports Column */}
              <div style={{ flex: 1.2, display: "flex", alignItems: "center", gap: px(8), padding: `${px(8)}px ${px(12)}px` }}>
                {/* Eye Icon */}
                <svg width={px(22)} height={px(22)} viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <div>
                  <div style={{ fontSize: px(9), fontWeight: 800, color: "#1d4ed8", letterSpacing: px(0.5) }}>SUPPORTS</div>
                  <div style={{ fontSize: px(18), fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>{supportsCount}</div>
                  <div style={{ fontSize: px(9), color: "#64748b" }}>VIEWS {viewsCount}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── CREAM CONTAINER (Authority + Local Rep Side-by-side) ───────── */}
          <div style={{
            background: "#fdfbf7",
            border: `${px(1)}px solid #e9e3d5`,
            borderRadius: px(16),
            display: "flex",
            alignItems: "stretch",
            margin: `0 0 ${px(16)}px 0`,
            flex: 1,
            minHeight: 0,
            boxSizing: "border-box",
          }}>
            {/* Responsible Authority (Left) */}
            <div style={{
              flex: 1.1,
              padding: `${px(12)}px ${px(16)}px`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              minWidth: 0,
            }}>
              <div style={{ fontSize: px(9), fontWeight: 800, color: "#1d4ed8", letterSpacing: px(0.5), marginBottom: px(6) }}>RESPONSIBLE AUTHORITY</div>
              <div style={{ display: "flex", alignItems: "center", gap: px(12) }}>
                <img src={logoSrc} alt="" style={{ width: px(52), height: px(52), objectFit: "contain", borderRadius: px(8), border: `${px(1)}px solid #cbd5e1`, background: "#ffffff", padding: px(2), flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: px(14), fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>
                    {issue.authority?.name ?? "MCC ROADS DIVISION"}
                  </div>
                  <div style={{ fontSize: px(11), color: "#475569", fontWeight: 600, marginTop: px(3) }}>
                    {issue.authority?.department ?? "Mangaluru City Corporation"}
                  </div>
                </div>
              </div>
            </div>

            {/* Vertical Divider */}
            <div style={{ width: px(1), background: "#e9e3d5", margin: `${px(12)}px 0` }} />

            {/* Local Representative (Right) */}
            <div style={{
              flex: 1,
              padding: `${px(12)}px ${px(16)}px`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              minWidth: 0,
            }}>
              <div style={{ fontSize: px(9), fontWeight: 800, color: "#1d4ed8", letterSpacing: px(0.5), marginBottom: px(6) }}>LOCAL REPRESENTATIVE</div>
              <div style={{ display: "flex", alignItems: "center", gap: px(12) }}>
                <img src={repSrc} alt="" style={{ width: px(52), height: px(52), objectFit: "cover", borderRadius: "50%", border: `${px(2)}px solid #1d4ed8`, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: px(13), fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>
                    {issue.representative?.name ? `Sri. ${issue.representative.name}` : "Not Mapped"}
                  </div>
                  <div style={{ fontSize: px(11), color: "#475569", fontWeight: 600, marginTop: px(2) }}>
                    {issue.representative?.role ?? "MLA - Mangaluru North"}
                  </div>
                  {issue.representative?.phone && (
                    <div style={{ display: "flex", alignItems: "center", gap: px(4), fontSize: px(10), color: "#64748b", marginTop: px(3) }}>
                      {/* Phone Icon */}
                      <svg width={px(10)} height={px(10)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                      {issue.representative.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── FOOTER (Dark Blue Layout) ──────────────────────────────────── */}
          <div style={{
            background: "#003366",
            borderRadius: px(16),
            padding: `${px(16)}px ${px(20)}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#ffffff",
            flexShrink: 0,
            boxSizing: "border-box",
          }}>
            {/* Left CTA Column */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: px(20), fontWeight: 900, lineHeight: 1.1 }}>
                Your Small Report
              </div>
              <div style={{ fontSize: px(20), fontWeight: 900, color: "#fbbf24", lineHeight: 1.1, marginTop: px(2) }}>
                Can Create a Big Change!
              </div>
              {/* Thin white divider */}
              <div style={{ height: px(1.5), background: "rgba(255,255,255,0.25)", margin: `${px(10)}px 0`, width: "90%" }} />
              <div style={{ fontSize: px(11), color: "rgba(255,255,255,0.85)", fontWeight: 500, lineHeight: 1.35 }}>
                Vote, share and help make<br />Mangaluru a better place to live.
              </div>
            </div>

            {/* Right Interactive Container (Buttons + QR Card stacked vertically) */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: px(10),
              width: px(350),
              flexShrink: 0,
            }}>
              {/* Top Buttons Row */}
              <div style={{ display: "flex", gap: px(10), width: "100%" }}>
                {/* ISSUE FIXED button */}
                <div style={{
                  flex: 1,
                  background: "#16a34a",
                  color: "#ffffff",
                  padding: `${px(8)}px ${px(12)}px`,
                  borderRadius: px(10),
                  display: "flex",
                  alignItems: "center",
                  gap: px(8),
                }}>
                  {/* Thumbs Up Icon */}
                  <svg width={px(16)} height={px(16)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                  </svg>
                  <div>
                    <div style={{ fontSize: px(11), fontWeight: 900 }}>ISSUE FIXED</div>
                    <div style={{ fontSize: px(8), opacity: 0.9 }}>Vote if the issue is resolved</div>
                  </div>
                </div>

                {/* STILL EXISTS button */}
                <div style={{
                  flex: 1,
                  background: "#dc2626",
                  color: "#ffffff",
                  padding: `${px(8)}px ${px(12)}px`,
                  borderRadius: px(10),
                  display: "flex",
                  alignItems: "center",
                  gap: px(8),
                }}>
                  {/* Thumbs Down Icon */}
                  <svg width={px(16)} height={px(16)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm12-4h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/>
                  </svg>
                  <div>
                    <div style={{ fontSize: px(11), fontWeight: 900 }}>STILL EXISTS</div>
                    <div style={{ fontSize: px(8), opacity: 0.9 }}>Vote if the issue still exists</div>
                  </div>
                </div>
              </div>

              {/* Bottom White QR Banner */}
              <div style={{
                background: "#ffffff",
                borderRadius: px(10),
                padding: `${px(8)}px ${px(12)}px`,
                display: "flex",
                alignItems: "center",
                gap: px(12),
                width: "100%",
                boxSizing: "border-box",
              }}>
                {qr && <img src={qr} alt="QR" style={{ width: px(58), height: px(58), display: "block", flexShrink: 0 }} />}
                <div style={{ color: "#0f172a" }}>
                  <div style={{ fontSize: px(9), fontWeight: 900, color: "#1d4ed8", letterSpacing: px(0.3) }}>SCAN TO VIEW & SUPPORT</div>
                  <div style={{ fontSize: px(9), color: "#475569", marginTop: px(1) }}>this issue or visit</div>
                  <div style={{ fontSize: px(13), fontWeight: 800, color: "#0f172a", marginTop: px(2) }}>{shortLink}</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  };

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
