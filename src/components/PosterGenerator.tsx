import { useEffect, useRef, useState, useMemo } from "react";
import QRCode from "qrcode";
import { toJpeg } from "html-to-image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download, Share2 } from "lucide-react";
import { STATUS_META, categoryBySlug } from "@/lib/civic";
import { getBase64ImageFn } from "@/lib/proxy.functions";

import { AUTHORITY_LOGO_FALLBACK_URL } from "./AuthorityLogo";

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
  votes?: {
    exists: number;
    fixed: number;
  } | null;
};

const POSTER_W = 750;
const POSTER_H = 1250;

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

function useImageDataUrls(urls: (string | null | undefined)[]): { map: Map<string, string>; ready: boolean } {
  const cache = useRef<Map<string, string>>(new Map());
  const [loaded, setLoaded] = useState(0);
  const nonNullUrls = urls.filter(Boolean) as string[];

  useEffect(() => {
    let cancelled = false;
    cache.current.clear();
    setLoaded(0);
    (async () => {
      for (const url of nonNullUrls) {
        try {
          if (url.startsWith("data:")) {
            if (!cancelled) { cache.current.set(url, url); setLoaded((n) => n + 1); }
            continue;
          }
          const res = await getBase64ImageFn({ data: { url } });
          if (res.base64 && !cancelled) { cache.current.set(url, res.base64); setLoaded((n) => n + 1); }
          else if (!cancelled) { setLoaded((n) => n + 1); } // count failed too so ready resolves
        } catch {
          if (!cancelled) setLoaded((n) => n + 1);
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(nonNullUrls)]);

  const ready = nonNullUrls.length === 0 || loaded >= nonNullUrls.length;
  return { map: cache.current, ready };
}

export function PosterGenerator({ issue, publicUrl }: { issue: IssueLike; publicUrl: string }) {
  const [size, setSize] = useState<keyof typeof SIZES>("instagram");
  const [qr, setQr] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);

  const cat = issue.category ?? categoryBySlug("others");
  const statusLabel = STATUS_LABEL[issue.status] ?? "REPORTED";
  const dims = SIZES[size];

  const authorityLogoUrl = issue.authority?.logo_url || AUTHORITY_LOGO_FALLBACK_URL;

  const imageUrls = useMemo(() => [
    issue.image_url,
    authorityLogoUrl,
    issue.representative?.photo_url,
  ], [issue.image_url, authorityLogoUrl, issue.representative?.photo_url]);
  const { map: dataUrls, ready: imagesReady } = useImageDataUrls(imageUrls);

  const imgSrc  = issue.image_url             ? (dataUrls.get(issue.image_url)             ?? ISSUE_PLACEHOLDER)         : ISSUE_PLACEHOLDER;
  const logoSrc = dataUrls.get(authorityLogoUrl) ?? AUTHORITY_PLACEHOLDER;
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
  const votesFixed    = issue.votes?.fixed ?? 0;
  const votesExists   = issue.votes?.exists ?? 0;
  const idTail        = issue.public_id.includes("-") ? issue.public_id.split("-").pop() : issue.public_id;
  const shortLink     = `janfix.in/${idTail}`;

  const download = async () => {
    if (!downloadRef.current || downloading) return;
    setDownloading(true);
    try {
      // Wait for all images to be available as base64
      if (!imagesReady) {
        await new Promise<void>((resolve) => {
          const check = setInterval(() => {
            if (imagesReady) { clearInterval(check); resolve(); }
          }, 200);
          setTimeout(() => { clearInterval(check); resolve(); }, 8000);
        });
      }
      await new Promise((r) => setTimeout(r, 300));
      // Run toJpeg twice — first call "warms" the canvas, second is the real capture
      await toJpeg(downloadRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: dims.w,
        height: dims.h,
        quality: 0.9,
        backgroundColor: "#e9e7df",
        skipAutoScale: true,
      });
      await new Promise((r) => setTimeout(r, 200));
      const data = await toJpeg(downloadRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: dims.w,
        height: dims.h,
        quality: 0.9,
        backgroundColor: "#e9e7df",
        skipAutoScale: true,
      });
      const a = document.createElement("a");
      a.href = data;
      a.download = `JanFix-${issue.public_id}-${size}.jpg`;
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
  const scale     = PREVIEW_W / dims.w;

  const renderPoster = (w: number, h: number) => {
    const s = w / POSTER_W;
    const px = (v: number) => v * s;

    const aspectRatio = h / w;
    const isLandscape = aspectRatio < 0.85; // e.g. Twitter/LinkedIn
    const isCompact = aspectRatio < 1.15;   // e.g. WhatsApp square

    // Dynamic sizes to fit smaller heights without overlapping
    const imageHeight = isLandscape ? px(130) : isCompact ? px(190) : px(270);
    const metaMarginBottom = isLandscape ? px(8) : isCompact ? px(14) : px(24);
    const rightColGap = isLandscape ? px(8) : isCompact ? px(12) : px(16);
    const titleFontSize = isLandscape ? px(36) : px(52);
    const descFontSize = isLandscape ? px(13) : px(18);
    const headerPaddingY = isLandscape ? px(12) : px(32);
    const headerHeight = isLandscape ? px(90) : px(110);
    const statsPaddingY = isLandscape ? px(8) : px(16);
    const statsIconSize = isLandscape ? px(20) : px(28);
    const statsNumberSize = isLandscape ? px(16) : px(22);

    return (
      <div style={{
        width: w,
        height: h,
        background: "#e9e7df",
        fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}>

        {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          padding: `${headerPaddingY}px ${px(36)}px ${px(12)}px`,
          position: "relative",
          zIndex: 1,
          gap: px(28),
        }}>
          {/* Logo Block (Left) */}
          <div style={{ display: "flex", gap: px(16), alignItems: "center", flexShrink: 0 }}>
            {/* Map Pin logo */}
            <svg width={px(54)} height={px(68)} viewBox="0 0 64 80" fill="none" style={{ flexShrink: 0, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15))" }}>
              <path d="M32 0C14.327 0 0 14.327 0 32c0 22 32 48 32 48s32-26 32-48C64 14.327 49.673 0 32 0z" fill="#1d3b22"/>
              <circle cx="32" cy="27" r="21" fill="white"/>
              <path d="M32 17.5c-2-2.5-6-2.5-8 0-1.8 2.2-1.8 5.2 0 7.5L32 31l8-6c1.8-2.2 1.8-5.2 0-7.5-2-2.5-6-2.5-8 0z" fill="#d73024"/>
              <path d="M22 36c0-4 3-6 7-6h6c4 0 7 2 7 6v2H22v-2z" stroke="#1d3b22" strokeWidth="1.5" fill="none"/>
              <circle cx="26" cy="26" r="3" stroke="#1d3b22" strokeWidth="1.5" fill="none"/>
              <circle cx="38" cy="26" r="3" stroke="#1d3b22" strokeWidth="1.5" fill="none"/>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: px(30), fontWeight: 800, color: "#1d3b22", lineHeight: 1, letterSpacing: "-1px" }}>
                Jan<span style={{ color: "#28a245" }}>Fix</span>
              </div>
              <div style={{ fontSize: px(11), fontWeight: 700, color: "#1d3b22", letterSpacing: px(1.5), marginTop: px(2) }}>MANGALURU</div>
            </div>
          </div>

          {/* Vertical Divider */}
          <div style={{ width: px(2), height: headerHeight, background: "#1d3b22", opacity: 0.8, flexShrink: 0 }}></div>

          {/* Title Block (Right) */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: px(12) }}>
              <div style={{ fontSize: px(26), fontWeight: 900, color: "#1a1a1a", lineHeight: 1.15, fontFamily: '"Noto Sans Kannada", sans-serif' }}>
                ಯಾವಾಗ
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: px(4) }}>
                <div style={{ width: px(20), height: px(2), background: "#1a1a1a", transform: "rotate(-20deg)", transformOrigin: "right center" }}></div>
                <div style={{ width: px(26), height: px(2), background: "#1a1a1a" }}></div>
                <div style={{ width: px(20), height: px(2), background: "#1a1a1a", transform: "rotate(20deg)", transformOrigin: "right center" }}></div>
              </div>
            </div>
            <div style={{ fontSize: px(32), fontWeight: 900, color: "#254328", lineHeight: 1.05, fontFamily: '"Noto Sans Kannada", sans-serif', marginTop: px(1) }}>
              ಸರಿ ಮಾಡುವುದು ?
            </div>
          </div>
        </div>

        {/* ── BACKGROUND ILLUSTRATION (Mangaluru Cathedral skyline, Top Right) ── */}
        <div style={{
           position: "absolute",
           top: px(0),
           right: px(0),
           width: px(240),
           height: px(180),
           opacity: 0.08,
           zIndex: 0,
           pointerEvents: "none",
           overflow: "hidden",
        }}>
           <svg width="100%" height="100%" viewBox="0 0 400 280" fill="none" stroke="#1b3c20" strokeWidth="1.2">
             <rect x="160" y="120" width="80" height="160" />
             <path d="M160,120 L200,60 L240,120" />
             <ellipse cx="200" cy="60" rx="18" ry="22" />
             <line x1="200" y1="38" x2="200" y2="10" />
             <line x1="190" y1="22" x2="210" y2="22" />
             <rect x="130" y="150" width="30" height="130" />
             <path d="M130,150 L145,110 L160,150" />
             <rect x="240" y="150" width="30" height="130" />
             <path d="M240,150 L255,110 L270,150" />
             <line x1="145" y1="110" x2="145" y2="90" />
             <line x1="138" y1="98" x2="152" y2="98" />
             <line x1="255" y1="110" x2="255" y2="90" />
             <line x1="248" y1="98" x2="262" y2="98" />
             <rect x="50" y="180" width="50" height="100" />
             <path d="M50,180 L75,150 L100,180" />
             <rect x="300" y="190" width="60" height="90" />
             <path d="M300,190 L330,155 L360,190" />
             <line x1="0" y1="280" x2="400" y2="280" />
           </svg>
        </div>

        {/* ── MAIN CONTENT AREA ─────────────────────────────────────────── */}
        <div style={{ display: "flex", padding: `0 ${px(36)}px`, gap: px(24), marginTop: px(4), zIndex: 1, flex: 1, minHeight: 0 }}>
          
          {/* LEFT COLUMN */}
          <div style={{ flex: 1.6, display: "flex", flexDirection: "column", minWidth: 0 }}>
            
            {/* Metadata Bar container (Cream box) */}
            <div style={{ display: "flex", background: "#f0efe9", borderRadius: px(12), marginBottom: metaMarginBottom, overflow: "hidden", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", flexShrink: 0 }}>
               {/* ISSUE ID block (Dark Green) */}
               <div style={{ background: "#1c3822", color: "white", padding: `${px(10)}px ${px(16)}px`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minWidth: px(120) }}>
                  <div style={{ fontSize: px(9), fontWeight: 700, letterSpacing: px(0.5), color: "rgba(255,255,255,0.8)" }}>ISSUE ID</div>
                  <div style={{ fontSize: px(16), fontWeight: 800, marginTop: px(2) }}>{issue.public_id}</div>
               </div>
               {/* Reported On block */}
               <div style={{ display: "flex", alignItems: "center", gap: px(10), padding: `0 ${px(14)}px` }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                     <div style={{ fontSize: px(8), fontWeight: 700, color: "#666", letterSpacing: px(0.5) }}>REPORTED ON</div>
                     <div style={{ fontSize: px(11), fontWeight: 800, color: "#111" }}>{dateLine.toUpperCase()}</div>
                  </div>
               </div>
               {/* Divider */}
               <div style={{ width: px(1), background: "#dcdacc", margin: `${px(8)}px 0` }}></div>
               {/* Status block */}
               <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: `0 ${px(14)}px` }}>
                  <div style={{ background: "#fbd158", color: "#1c3822", padding: `${px(3)}px ${px(10)}px`, borderRadius: px(16), fontSize: px(10), fontWeight: 800 }}>
                     {statusLabel}
                  </div>
               </div>
            </div>

            {/* Title Section */}
            <div style={{ background: "#da3d2b", color: "white", padding: `${px(3)}px ${px(8)}px`, borderRadius: px(4), fontSize: px(9), fontWeight: 800, alignSelf: "flex-start", marginBottom: px(4), letterSpacing: px(0.5) }}>
               ISSUE
            </div>
            <div style={{ fontSize: titleFontSize, fontWeight: 800, color: "#111827", lineHeight: 1, textTransform: "uppercase", letterSpacing: "-1px" }}>
               {cat.name_en}
            </div>
            <div style={{ fontSize: descFontSize, color: "#374151", fontWeight: 500, lineHeight: 1.3, marginTop: px(6), maxWidth: "95%" }}>
               {issue.description.length > 80 ? issue.description.slice(0, 77) + "…" : issue.description}
            </div>

            {/* Location */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: px(8), marginTop: px(8), marginBottom: metaMarginBottom }}>
               <svg width={px(18)} height={px(18)} viewBox="0 0 24 24" fill="#1b3c20" style={{ flexShrink: 0, marginTop: px(2) }}>
                 <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
               </svg>
               <div style={{ fontSize: px(13), fontWeight: 600, color: "#111827", lineHeight: 1.3 }}>
                  <span style={{ fontWeight: 700 }}>Near {issue.area || issue.locality || "Location"}</span>
               </div>
            </div>

            {/* Photo Section */}
            <div style={{ 
               width: "100%", 
               height: imageHeight, 
               borderRadius: `${px(12)}px ${px(12)}px 0 0`, 
               overflow: "hidden", 
               position: "relative",
               flexShrink: 0,
            }}>
               <img src={imgSrc} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>

            {/* Stats Bar */}
            <div style={{
               background: "#1c3822",
               borderRadius: `0 0 ${px(12)}px ${px(12)}px`,
               padding: `${statsPaddingY}px 0`,
               display: "flex",
               color: "white",
               marginBottom: metaMarginBottom,
               flexShrink: 0,
            }}>
               {/* Views */}
               <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", borderRight: `${px(1)}px solid rgba(255,255,255,0.2)` }}>
                  <svg width={statsIconSize} height={statsIconSize} viewBox="0 0 24 24" fill="white"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                  <div style={{ fontSize: statsNumberSize, fontWeight: 800, marginTop: px(4) }}>{viewsCount}</div>
                  <div style={{ fontSize: px(8), fontWeight: 600, letterSpacing: px(0.5) }}>VIEWS</div>
               </div>
               {/* Supports */}
               <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", borderRight: `${px(1)}px solid rgba(255,255,255,0.2)` }}>
                  <svg width={statsIconSize} height={statsIconSize} viewBox="0 0 24 24" fill="white"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                  <div style={{ fontSize: statsNumberSize, fontWeight: 800, marginTop: px(4) }}>{supportsCount}</div>
                  <div style={{ fontSize: px(8), fontWeight: 600, letterSpacing: px(0.5) }}>SUPPORTS</div>
               </div>
               {/* Votes Fixed */}
               <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <svg width={statsIconSize} height={statsIconSize} viewBox="0 0 24 24" fill="white"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z"/></svg>
                  <div style={{ fontSize: statsNumberSize, fontWeight: 800, marginTop: px(4) }}>{votesFixed}</div>
                  <div style={{ fontSize: px(8), fontWeight: 600, letterSpacing: px(0.5) }}>FIXED</div>
               </div>
            </div>

            {/* Bottom CTA container (Cream Box) — hidden in landscape format to save space */}
            {!isLandscape && (
              <div style={{ display: "flex", alignItems: "center", gap: px(16), background: "#f0efe9", padding: px(12), borderRadius: px(12), boxShadow: "0 2px 4px rgba(0,0,0,0.05)", flexShrink: 0 }}>
                 <div style={{ width: px(50), height: px(40), position: "relative" }}>
                    <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" stroke="#292929" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                       <path d="M50 20 C60 5, 85 10, 85 30 C85 50, 50 75, 50 75 C50 75, 15 50, 15 30 C15 10, 40 5, 50 20 Z" fill="#da3d2b" stroke="none" />
                    </svg>
                 </div>
                 <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: px(14), fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>Your Small Report</div>
                    <div style={{ fontSize: px(18), fontFamily: '"Caveat", cursive', color: "#254328", marginTop: px(2) }}>Can Create a Big Change!</div>
                 </div>
              </div>
            )}

          </div>

          {/* RIGHT COLUMN */}
          <div style={{ flex: 1.05, display: "flex", flexDirection: "column", gap: rightColGap, minWidth: 0 }}>
            
            {/* Responsible Authority Card */}
            <div style={{ background: "#f0efe9", borderRadius: px(12), overflow: "hidden", border: `${px(1)}px solid #dfdad0`, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", flexShrink: 0 }}>
               <div style={{ background: "#254328", color: "white", padding: `${px(10)}px`, fontSize: px(10), fontWeight: 800, letterSpacing: px(0.8), textAlign: "center" }}>
                  RESPONSIBLE AUTHORITY
               </div>
               <div style={{ padding: px(16), display: "flex", alignItems: "center", gap: px(12) }}>
                  <div style={{ width: px(56), height: px(56), background: "white", borderRadius: "50%", padding: px(4), flexShrink: 0, border: `${px(2)}px solid #254328`, boxShadow: "0 2px 4px rgba(0,0,0,0.08)" }}>
                     <img src={logoSrc} alt="logo" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%" }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                     <div style={{ fontSize: px(14), fontWeight: 800, color: "#111827", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis" }}>{issue.authority?.name ?? "MCC"}</div>
                     <div style={{ fontSize: px(11), fontWeight: 700, color: "#4b5563", marginTop: px(3) }}>{issue.authority?.department ?? "Engineering"}</div>
                  </div>
               </div>
            </div>

            {/* Local Representative Card */}
            <div style={{ background: "#f0efe9", borderRadius: px(12), overflow: "hidden", border: `${px(1)}px solid #dfdad0`, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", flexShrink: 0 }}>
               <div style={{ background: "#254328", color: "white", padding: `${px(10)}px`, fontSize: px(10), fontWeight: 800, letterSpacing: px(0.8), textAlign: "center" }}>
                  OFFICIAL RESPONSIBLE
               </div>
               <div style={{ padding: px(16), display: "flex", alignItems: "center", gap: px(12) }}>
                  <div style={{ position: "relative", flexShrink: 0, width: px(64), height: px(64) }}>
                     <img src={repSrc} alt="rep" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", border: `${px(2.5)}px solid #da3d2b`, boxShadow: "0 4px 6px rgba(0,0,0,0.12)" }} />
                     <span style={{ position: "absolute", bottom: px(-2), right: px(-2), background: "#da3d2b", color: "white", fontSize: px(8), fontWeight: 900, borderRadius: px(4), padding: `${px(1)}px ${px(5)}px`, border: `${px(1)}px solid white`, whiteSpace: "nowrap" }}>
                        {issue.representative?.role ?? "MLA"}
                     </span>
                  </div>
                  <div style={{ minWidth: 0, paddingLeft: px(4) }}>
                     <div style={{ fontSize: px(14), fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>
                        {issue.representative?.name ? `Sri. ${issue.representative.name}` : "Sri. D. Vedavyas Kamath"}
                     </div>
                     <div style={{ fontSize: px(11), fontWeight: 700, color: "#4b5563", marginTop: px(3) }}>
                        {issue.representative?.constituency ?? "Mangaluru City South"}
                     </div>
                  </div>
               </div>
            </div>

            {/* Scan / QR Code Section */}
            <div style={{ background: "#e1ddd1", borderRadius: px(12), padding: px(14), display: "flex", flexDirection: "column", flex: isLandscape ? "none" : 1, justifyContent: "center", minHeight: 0, flexShrink: 0 }}>
               <div style={{ fontSize: px(9), fontWeight: 800, color: "#111827", letterSpacing: px(0.5), textAlign: "center" }}>SCAN TO VIEW & SUPPORT</div>
               
               <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: px(14), marginTop: px(10) }}>
                  {/* QR Image */}
                  <div style={{ background: "white", padding: px(4), borderRadius: px(6), flexShrink: 0 }}>
                     {qr && <img src={qr} alt="QR" style={{ width: px(56), height: px(56), display: "block" }} />}
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                     <div style={{ fontSize: px(12), fontWeight: 800, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortLink}</div>
                     <div style={{ fontSize: px(9), color: "#6b7280" }}>scan the QR code</div>
                  </div>
               </div>
            </div>

          </div>
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <div style={{
          background: "#254328",
          color: "rgba(255,255,255,0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${px(10)}px ${px(36)}px`,
          zIndex: 1,
          marginTop: "auto",
          flexShrink: 0,
        }}>
           <div style={{ display: "flex", alignItems: "center", gap: px(12) }}>
              <div style={{ display: "flex", alignItems: "center", gap: px(6) }}>
                 <svg width={px(14)} height={px(14)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                 <div style={{ fontSize: px(8), fontWeight: 500, letterSpacing: px(0.5), lineHeight: 1.1 }}>INDEPENDENT INITIATIVE</div>
              </div>
           </div>

           <div style={{ display: "flex", alignItems: "center", gap: px(6) }}>
              <div style={{ fontSize: px(13), fontStyle: "italic", fontWeight: 500, fontFamily: '"Caveat", cursive', color: "#e9e7df" }}>
                 Together for a Better Mangaluru
              </div>
           </div>
        </div>

      </div>
    );
  };

  const previewW = PREVIEW_W;
  const previewH = Math.round(dims.h * scale);

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
          <div style={{ width: dims.w, height: dims.h, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {renderPoster(dims.w, dims.h)}
          </div>
        </div>
      </div>

      {/* Offscreen element at full download resolution */}
      <div
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: "absolute", top: -99999, left: -99999, width: dims.w, height: dims.h, overflow: "hidden", pointerEvents: "none" }}
      >
        <div ref={downloadRef}>
          {renderPoster(dims.w, dims.h)}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2.5">
        <Button onClick={download} disabled={downloading || !imagesReady} className="gap-2 px-5 font-semibold">
          <Download className="h-4 w-4" />
          {downloading ? "Generating…" : !imagesReady ? "Loading images…" : `Download PNG (${SIZES[size].label})`}
        </Button>
        <ShareButtons url={publicUrl} text={`I have reported this civic issue. It's your job to support and help get it fixed too! Check it out:`} />
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
