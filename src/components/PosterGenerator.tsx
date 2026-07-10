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

  const imageUrls = useMemo(() => [
    issue.image_url,
    issue.authority?.logo_url,
    issue.representative?.photo_url,
  ], [issue.image_url, issue.authority?.logo_url, issue.representative?.photo_url]);
  const { map: dataUrls, ready: imagesReady } = useImageDataUrls(imageUrls);

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
      // Run toPng twice — first call "warms" the canvas, second is the real capture
      await toPng(downloadRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: POSTER_W,
        height: POSTER_H,
        backgroundColor: "#e9e7df",
        skipAutoScale: true,
      });
      await new Promise((r) => setTimeout(r, 200));
      const data = await toPng(downloadRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: POSTER_W,
        height: POSTER_H,
        backgroundColor: "#e9e7df",
        skipAutoScale: true,
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
          padding: `${px(32)}px ${px(36)}px ${px(20)}px`,
          position: "relative",
          zIndex: 1,
          gap: px(28),
        }}>
          {/* Logo Block (Left) */}
          <div style={{ display: "flex", gap: px(16), alignItems: "center", flexShrink: 0 }}>
            {/* Map Pin logo */}
            <svg width={px(72)} height={px(90)} viewBox="0 0 64 80" fill="none" style={{ flexShrink: 0, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15))" }}>
              <path d="M32 0C14.327 0 0 14.327 0 32c0 22 32 48 32 48s32-26 32-48C64 14.327 49.673 0 32 0z" fill="#1d3b22"/>
              <circle cx="32" cy="27" r="21" fill="white"/>
              <path d="M32 17.5c-2-2.5-6-2.5-8 0-1.8 2.2-1.8 5.2 0 7.5L32 31l8-6c1.8-2.2 1.8-5.2 0-7.5-2-2.5-6-2.5-8 0z" fill="#d73024"/>
              <path d="M22 36c0-4 3-6 7-6h6c4 0 7 2 7 6v2H22v-2z" stroke="#1d3b22" strokeWidth="1.5" fill="none"/>
              <circle cx="26" cy="26" r="3" stroke="#1d3b22" strokeWidth="1.5" fill="none"/>
              <circle cx="38" cy="26" r="3" stroke="#1d3b22" strokeWidth="1.5" fill="none"/>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: px(40), fontWeight: 800, color: "#1d3b22", lineHeight: 1, letterSpacing: "-1px" }}>
                Jan<span style={{ color: "#28a245" }}>Fix</span>
              </div>
              <div style={{ fontSize: px(14), fontWeight: 700, color: "#1d3b22", letterSpacing: px(2), marginTop: px(4) }}>MANGALURU</div>
              <div style={{ fontSize: px(13), color: "#475569", fontWeight: 600, marginTop: px(6) }}>Report. Track. Fix.</div>
            </div>
          </div>

          {/* Vertical Divider */}
          <div style={{ width: px(3), height: px(110), background: "#1d3b22", borderRadius: px(2), flexShrink: 0 }}></div>

          {/* Title Block (Right) */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: px(12) }}>
              <div style={{ fontSize: px(44), fontWeight: 900, color: "#1a1a1a", lineHeight: 1.15, fontFamily: '"Noto Sans Kannada", sans-serif' }}>
                ಯಾವಾಗ
              </div>
              {/* Decorative arrow lines — like the reference ≤ symbol */}
              <div style={{ display: "flex", flexDirection: "column", gap: px(5) }}>
                <div style={{ width: px(30), height: px(3), background: "#1a1a1a", transform: "rotate(-20deg)", transformOrigin: "right center" }}></div>
                <div style={{ width: px(38), height: px(3), background: "#1a1a1a" }}></div>
                <div style={{ width: px(30), height: px(3), background: "#1a1a1a", transform: "rotate(20deg)", transformOrigin: "right center" }}></div>
              </div>
            </div>
            <div style={{ fontSize: px(54), fontWeight: 900, color: "#254328", lineHeight: 1.05, fontFamily: '"Noto Sans Kannada", sans-serif', marginTop: px(2) }}>
              ಸರಿ ಮಾಡುದು ?
            </div>
            <div style={{ fontSize: px(17), color: "#1a1a1a", fontWeight: 700, marginTop: px(10), borderBottom: `${px(2)}px solid #254328`, paddingBottom: px(5), fontFamily: '"Noto Sans Kannada", sans-serif' }}>
              ನಮ್ಮ ಮಂಗಳೂರು ನಮ್ಮ ಜವಾಬ್ದಾರಿ
            </div>
          </div>
        </div>

        {/* ── BACKGROUND ILLUSTRATION (Mangaluru Cathedral skyline, Top Right) ── */}
        <div style={{
           position: "absolute",
           top: px(0),
           right: px(0),
           width: px(320),
           height: px(240),
           opacity: 0.12,
           zIndex: 0,
           pointerEvents: "none",
           overflow: "hidden",
        }}>
           <svg width="100%" height="100%" viewBox="0 0 400 280" fill="none" stroke="#1b3c20" strokeWidth="1.2">
             {/* Cathedral / Basilica */}
             <rect x="160" y="120" width="80" height="160" />
             <path d="M160,120 L200,60 L240,120" />
             {/* Central dome */}
             <ellipse cx="200" cy="60" rx="18" ry="22" />
             {/* Cross on top */}
             <line x1="200" y1="38" x2="200" y2="10" />
             <line x1="190" y1="22" x2="210" y2="22" />
             {/* Side towers */}
             <rect x="130" y="150" width="30" height="130" />
             <path d="M130,150 L145,110 L160,150" />
             <rect x="240" y="150" width="30" height="130" />
             <path d="M240,150 L255,110 L270,150" />
             {/* Tower tops */}
             <line x1="145" y1="110" x2="145" y2="90" />
             <line x1="138" y1="98" x2="152" y2="98" />
             <line x1="255" y1="110" x2="255" y2="90" />
             <line x1="248" y1="98" x2="262" y2="98" />
             {/* Windows */}
             <rect x="185" y="150" width="14" height="20" rx="7" />
             <rect x="201" y="150" width="14" height="20" rx="7" />
             <rect x="185" y="185" width="14" height="18" />
             <rect x="201" y="185" width="14" height="18" />
             {/* Side buildings */}
             <rect x="50" y="180" width="50" height="100" />
             <path d="M50,180 L75,150 L100,180" />
             <rect x="300" y="190" width="60" height="90" />
             <path d="M300,190 L330,155 L360,190" />
             {/* Palm trees */}
             <line x1="30" y1="280" x2="30" y2="200" />
             <path d="M30,200 C20,185 10,178 5,170" />
             <path d="M30,200 C40,185 50,178 55,170" />
             <path d="M30,205 C15,195 5,192 0,188" />
             <line x1="380" y1="280" x2="380" y2="210" />
             <path d="M380,210 C370,195 360,188 355,180" />
             <path d="M380,210 C390,195 395,185 398,178" />
             {/* Birds */}
             <path d="M310,40 C315,35 320,35 325,40" />
             <path d="M330,30 C336,25 341,25 346,30" />
             <path d="M350,50 C354,46 358,46 362,50" />
             {/* Ground line */}
             <line x1="0" y1="280" x2="400" y2="280" />
           </svg>
        </div>

        {/* ── MAIN CONTENT AREA ─────────────────────────────────────────── */}
        <div style={{ display: "flex", padding: `0 ${px(36)}px`, gap: px(24), marginTop: px(8), zIndex: 1, flex: 1 }}>
          
          {/* LEFT COLUMN */}
          <div style={{ flex: 1.6, display: "flex", flexDirection: "column" }}>
            
            {/* Metadata Bar container (Cream box) */}
            <div style={{ display: "flex", background: "#f0efe9", borderRadius: px(12), marginBottom: px(24), overflow: "hidden", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
               {/* ISSUE ID block (Dark Green) */}
               <div style={{ background: "#1c3822", color: "white", padding: `${px(14)}px ${px(24)}px`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minWidth: px(180) }}>
                  <div style={{ fontSize: px(10), fontWeight: 700, letterSpacing: px(0.5), color: "rgba(255,255,255,0.8)" }}>ISSUE ID</div>
                  <div style={{ fontSize: px(22), fontWeight: 800, marginTop: px(2) }}>{issue.public_id}</div>
               </div>
               {/* Reported On block */}
               <div style={{ display: "flex", alignItems: "center", gap: px(12), padding: `0 ${px(20)}px` }}>
                  <svg width={px(26)} height={px(26)} viewBox="0 0 24 24" fill="none" stroke="#292929" strokeWidth="1.5">
                     <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                     <line x1="16" y1="2" x2="16" y2="6"/>
                     <line x1="8" y1="2" x2="8" y2="6"/>
                     <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                     <div style={{ fontSize: px(9), fontWeight: 700, color: "#666", letterSpacing: px(0.5) }}>REPORTED ON</div>
                     <div style={{ fontSize: px(13), fontWeight: 800, color: "#111" }}>{dateLine.toUpperCase()}</div>
                     <div style={{ fontSize: px(11), fontWeight: 600, color: "#666" }}>{timeLine}</div>
                  </div>
               </div>
               {/* Divider */}
               <div style={{ width: px(1), background: "#dcdacc", margin: `${px(12)}px 0` }}></div>
               {/* Status block */}
               <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: `0 ${px(20)}px` }}>
                  <div style={{ fontSize: px(9), fontWeight: 700, color: "#666", letterSpacing: px(0.5), marginBottom: px(4), textAlign: "center" }}>STATUS</div>
                  <div style={{ background: "#fbd158", color: "#1c3822", padding: `${px(4)}px ${px(12)}px`, borderRadius: px(16), fontSize: px(11), fontWeight: 800, display: "flex", alignItems: "center", gap: px(6) }}>
                     <div style={{ width: px(12), height: px(12), border: `${px(2)}px dotted #1c3822`, borderRadius: "50%" }}></div>
                     {statusLabel}
                  </div>
               </div>
            </div>

            {/* Title Section */}
            <div style={{ background: "#da3d2b", color: "white", padding: `${px(4)}px ${px(10)}px`, borderRadius: px(4), fontSize: px(10), fontWeight: 800, alignSelf: "flex-start", marginBottom: px(6), letterSpacing: px(0.5) }}>
               ISSUE
            </div>
            <div style={{ fontSize: px(52), fontWeight: 800, color: "#111827", lineHeight: 1, textTransform: "uppercase", letterSpacing: "-1px" }}>
               {cat.name_en}
            </div>
            <div style={{ fontSize: px(18), color: "#374151", fontWeight: 500, lineHeight: 1.3, marginTop: px(8), maxWidth: "90%" }}>
               {issue.description.length > 90 ? issue.description.slice(0, 87) + "…" : issue.description}
            </div>

            {/* Location */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: px(8), marginTop: px(16), marginBottom: px(20) }}>
               <svg width={px(24)} height={px(24)} viewBox="0 0 24 24" fill="#1b3c20" style={{ flexShrink: 0, marginTop: px(2) }}>
                 <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
               </svg>
               <div style={{ fontSize: px(15), fontWeight: 600, color: "#111827", lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 700 }}>Near {issue.area || issue.locality || "Location"}</span><br/>
                  <span style={{ fontWeight: 500 }}>Mangaluru - {issue.address?.match(/\b575\d{3}\b/)?.[0] ?? "575001"}</span>
               </div>
            </div>

            {/* Photo Section */}
            <div style={{ 
               width: "100%", 
               height: px(270), 
               borderRadius: `${px(12)}px ${px(12)}px 0 0`, 
               overflow: "hidden", 
               position: "relative",
            }}>
               <img src={imgSrc} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>

            {/* Stats Bar */}
            <div style={{
               background: "#1c3822",
               borderRadius: `0 0 ${px(12)}px ${px(12)}px`,
               padding: `${px(16)}px 0`,
               display: "flex",
               color: "white",
               marginBottom: px(24)
            }}>
               {/* Views */}
               <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", borderRight: `${px(1)}px solid rgba(255,255,255,0.2)` }}>
                  <svg width={px(28)} height={px(28)} viewBox="0 0 24 24" fill="white"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                  <div style={{ fontSize: px(22), fontWeight: 800, marginTop: px(8) }}>{viewsCount}</div>
                  <div style={{ fontSize: px(9), fontWeight: 600, letterSpacing: px(1), marginTop: px(2) }}>VIEWS</div>
               </div>
               {/* Supports */}
               <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", borderRight: `${px(1)}px solid rgba(255,255,255,0.2)` }}>
                  <svg width={px(28)} height={px(28)} viewBox="0 0 24 24" fill="white"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                  <div style={{ fontSize: px(22), fontWeight: 800, marginTop: px(8) }}>{supportsCount}</div>
                  <div style={{ fontSize: px(9), fontWeight: 600, letterSpacing: px(1), marginTop: px(2) }}>SUPPORTS</div>
               </div>
               {/* Votes Fixed */}
               <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", borderRight: `${px(1)}px solid rgba(255,255,255,0.2)` }}>
                  <svg width={px(28)} height={px(28)} viewBox="0 0 24 24" fill="white"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z"/></svg>
                  <div style={{ fontSize: px(22), fontWeight: 800, marginTop: px(8) }}>{votesFixed}</div>
                  <div style={{ fontSize: px(9), fontWeight: 600, letterSpacing: px(1), marginTop: px(2) }}>VOTES FIXED</div>
               </div>
               {/* Still Exists */}
               <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <svg width={px(28)} height={px(28)} viewBox="0 0 24 24" fill="white"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v1.91l.01.01L1 14c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>
                  <div style={{ fontSize: px(22), fontWeight: 800, marginTop: px(8) }}>{votesExists}</div>
                  <div style={{ fontSize: px(9), fontWeight: 600, letterSpacing: px(1), marginTop: px(2) }}>STILL EXISTS</div>
               </div>
            </div>

            {/* Bottom CTA container (Cream Box) */}
            <div style={{ display: "flex", alignItems: "center", gap: px(20), background: "#f0efe9", padding: px(16), borderRadius: px(12), boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
               {/* Line art family with heart */}
               <div style={{ width: px(70), height: px(60), position: "relative" }}>
                  <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" stroke="#292929" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M50 20 C60 5, 85 10, 85 30 C85 50, 50 75, 50 75 C50 75, 15 50, 15 30 C15 10, 40 5, 50 20 Z" fill="#da3d2b" stroke="none" />
                     <circle cx="25" cy="80" r="8" />
                     <path d="M10 100 Q25 90 40 100" />
                     <circle cx="50" cy="85" r="9" />
                     <path d="M35 100 Q50 90 65 100" />
                     <circle cx="75" cy="80" r="8" />
                     <path d="M60 100 Q75 90 90 100" />
                  </svg>
               </div>
               <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: px(18), fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>Your Small Report</div>
                  <div style={{ fontSize: px(22), fontFamily: '"Caveat", cursive', color: "#254328", marginTop: px(4) }}>Can Create a Big Change!</div>
               </div>
               {/* Kannada text */}
               <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: px(4), paddingRight: px(4), borderLeft: `${px(1)}px solid #dcdacc`, paddingLeft: px(16) }}>
                  <div style={{ fontSize: px(11), fontWeight: 700, color: "#111" }}>ಸಮಸ್ಯೆ ನೀವು ತೋರಿಸಿ,</div>
                  <div style={{ fontSize: px(11), fontWeight: 700, color: "#111" }}>ಪರಿಹಾರ ನಾವು ಕಂಡುಕೊಳ್ಳೋಣ.</div>
                  <div style={{ fontSize: px(11), fontWeight: 700, color: "#111" }}>ಒಟ್ಟಿಗೆ ಬದಲಾವಣೆ ತರುವ!</div>
               </div>
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div style={{ flex: 1.05, display: "flex", flexDirection: "column", gap: px(16) }}>
            
            {/* Responsible Authority Card */}
            <div style={{ background: "#f0efe9", borderRadius: px(12), overflow: "hidden", border: `${px(1)}px solid #dfdad0`, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
               <div style={{ background: "#254328", color: "white", padding: `${px(10)}px`, fontSize: px(10), fontWeight: 700, letterSpacing: px(0.5), textAlign: "center" }}>
                  RESPONSIBLE AUTHORITY
               </div>
               <div style={{ padding: px(16), display: "flex", alignItems: "flex-start", gap: px(12) }}>
                  <div style={{ width: px(64), height: px(64), background: "white", borderRadius: "50%", padding: px(4), flexShrink: 0, border: `${px(1)}px solid #cbd5e1` }}>
                     <img src={logoSrc} alt="logo" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%" }} />
                  </div>
                  <div>
                     <div style={{ fontSize: px(16), fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>{issue.authority?.name ?? "MCC"}</div>
                     <div style={{ fontSize: px(12), fontWeight: 700, color: "#111", marginTop: px(4) }}>{issue.authority?.department ?? "ROADS DIVISION"}</div>
                     <div style={{ fontSize: px(11), color: "#4b5563", marginTop: px(2), lineHeight: 1.3 }}>Mangaluru City<br/>Corporation</div>
                  </div>
               </div>
               <div style={{ padding: `0 ${px(16)}px ${px(16)}px`, display: "flex", flexDirection: "column", gap: px(10) }}>
                  <div style={{ display: "flex", alignItems: "center", gap: px(10), fontSize: px(11), color: "#111", fontWeight: 600 }}>
                     <svg width={px(12)} height={px(12)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                     0824-2445000
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: px(10), fontSize: px(11), color: "#111", fontWeight: 600 }}>
                     <svg width={px(12)} height={px(12)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                     ro@mcc.gov.in
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: px(10), fontSize: px(11), color: "#111", fontWeight: 600, lineHeight: 1.4 }}>
                     <svg width={px(12)} height={px(12)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginTop: px(2), flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                     MCC Office, Light House Hill,<br/>Mangaluru - 575001
                  </div>
               </div>
            </div>

            {/* Local Representative Card */}
            <div style={{ background: "#f0efe9", borderRadius: px(12), overflow: "hidden", border: `${px(1)}px solid #dfdad0`, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
               <div style={{ background: "#254328", color: "white", padding: `${px(10)}px`, fontSize: px(10), fontWeight: 700, letterSpacing: px(0.5), textAlign: "center" }}>
                  LOCAL REPRESENTATIVE
               </div>
               <div style={{ padding: px(16), display: "flex", alignItems: "flex-start", gap: px(12) }}>
                  <img src={repSrc} alt="rep" crossOrigin="anonymous" style={{ width: px(64), height: px(64), objectFit: "cover", borderRadius: "50%", flexShrink: 0 }} />
                  <div>
                     <div style={{ fontSize: px(14), fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>
                        {issue.representative?.name ? `Sri. ${issue.representative.name}` : "Sri. D. Vedavyas Kamath"}
                     </div>
                     <div style={{ fontSize: px(11), color: "#111", marginTop: px(4), lineHeight: 1.3, fontWeight: 500 }}>
                        {issue.representative?.role ?? "MLA - Mangaluru North"}
                     </div>
                  </div>
               </div>
               <div style={{ padding: `0 ${px(16)}px ${px(16)}px`, display: "flex", flexDirection: "column", gap: px(10) }}>
                  <div style={{ display: "flex", alignItems: "center", gap: px(10), fontSize: px(11), color: "#111", fontWeight: 600 }}>
                     <svg width={px(12)} height={px(12)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                     {issue.representative?.phone ?? "0824-2446800"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: px(10), fontSize: px(10), color: "#111", fontWeight: 600 }}>
                     <svg width={px(12)} height={px(12)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                     vedavyaskamath@gmail.com
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: px(10), fontSize: px(11), color: "#111", fontWeight: 600, lineHeight: 1.4 }}>
                     <svg width={px(12)} height={px(12)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginTop: px(2), flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                     Constituency Office,<br/>Mangaluru
                  </div>
               </div>
            </div>

            {/* Scan / QR Code Section */}
            <div style={{ background: "#e1ddd1", borderRadius: px(12), padding: px(16), display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
               <div style={{ fontSize: px(10), fontWeight: 800, color: "#111827", letterSpacing: px(0.5) }}>SCAN TO VIEW & SUPPORT</div>
               
               <div style={{ display: "flex", alignItems: "center", gap: px(12), marginTop: px(12) }}>
                  {/* QR Image */}
                  <div style={{ background: "white", padding: px(6), borderRadius: px(8) }}>
                     {qr && <img src={qr} alt="QR" style={{ width: px(70), height: px(70), display: "block" }} />}
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column" }}>
                     {/* Hand drawn arrow pointing at URL */}
                     <svg width={px(24)} height={px(32)} viewBox="0 0 24 32" fill="none" stroke="#254328" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", marginLeft: px(-14), marginTop: px(16) }}>
                        <path d="M4 2 Q8 16 20 16 M16 10 L22 16 L16 22" />
                     </svg>
                     <div style={{ fontSize: px(14), fontWeight: 800, color: "#111827", marginLeft: px(14) }}>{shortLink}</div>
                     <div style={{ fontSize: px(10), color: "#6b7280", marginTop: px(4), marginLeft: px(14) }}>or scan the QR code</div>
                  </div>
               </div>
               
               {/* Share / Support / Make a change icons */}
               <div style={{ display: "flex", justifyContent: "space-around", marginTop: px(16), paddingTop: px(12), borderTop: `${px(1)}px solid rgba(0,0,0,0.1)` }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: px(4) }}>
                     <svg width={px(16)} height={px(16)} viewBox="0 0 24 24" fill="none" stroke="#254328" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                     <div style={{ fontSize: px(9), fontWeight: 700, color: "#111827" }}>SHARE</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: px(4) }}>
                     <svg width={px(16)} height={px(16)} viewBox="0 0 24 24" fill="#254328"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                     <div style={{ fontSize: px(9), fontWeight: 700, color: "#111827" }}>SUPPORT</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: px(4) }}>
                     <svg width={px(16)} height={px(16)} viewBox="0 0 24 24" fill="#254328"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
                     <div style={{ fontSize: px(9), fontWeight: 700, color: "#111827", textAlign: "center", lineHeight: 1 }}>MAKE A<br/>CHANGE</div>
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
          padding: `${px(14)}px ${px(36)}px`,
          zIndex: 1,
          marginTop: "auto"
        }}>
           <div style={{ display: "flex", alignItems: "center", gap: px(20) }}>
              <div style={{ display: "flex", alignItems: "center", gap: px(8) }}>
                 <svg width={px(18)} height={px(18)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                 <div style={{ fontSize: px(9), fontWeight: 500, letterSpacing: px(0.5), lineHeight: 1.2 }}>INDEPENDENT<br/>CITIZEN INITIATIVE</div>
              </div>
              <div style={{ width: px(1), height: px(24), background: "rgba(255,255,255,0.3)" }}></div>
              <div style={{ display: "flex", alignItems: "center", gap: px(8) }}>
                 <svg width={px(18)} height={px(18)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                 <div style={{ fontSize: px(9), fontWeight: 500, letterSpacing: px(0.5), lineHeight: 1.2 }}>ANONYMOUS<br/>REPORTING</div>
              </div>
              <div style={{ width: px(1), height: px(24), background: "rgba(255,255,255,0.3)" }}></div>
              <div style={{ display: "flex", alignItems: "center", gap: px(8) }}>
                 <svg width={px(18)} height={px(18)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                 <div style={{ fontSize: px(9), fontWeight: 500, letterSpacing: px(0.5), lineHeight: 1.2 }}>TRANSPARENT<br/>TRACKING</div>
              </div>
              <div style={{ width: px(1), height: px(24), background: "rgba(255,255,255,0.3)" }}></div>
              <div style={{ display: "flex", alignItems: "center", gap: px(8) }}>
                 <svg width={px(18)} height={px(18)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                 <div style={{ fontSize: px(9), fontWeight: 500, letterSpacing: px(0.5), lineHeight: 1.2 }}>ACCOUNTABLE<br/>GOVERNANCE</div>
              </div>
           </div>

           <div style={{ display: "flex", alignItems: "center", gap: px(6) }}>
              <div style={{ fontSize: px(18), fontStyle: "italic", fontWeight: 500, fontFamily: '"Caveat", cursive', color: "#e9e7df" }}>
                 Together for<br/>a Better Mangaluru
              </div>
              <svg width={px(16)} height={px(16)} viewBox="0 0 24 24" fill="none" stroke="#d73024" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
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
        <Button onClick={download} disabled={downloading || !imagesReady} className="gap-2 px-5 font-semibold">
          <Download className="h-4 w-4" />
          {downloading ? "Generating…" : !imagesReady ? "Loading images…" : `Download PNG (${SIZES[size].label})`}
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
