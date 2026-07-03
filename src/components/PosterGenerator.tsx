import { useEffect, useRef, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JanFixLogo } from "@/components/JanFixLogo";
import { AUTHORITY_LOGO_FALLBACK_URL } from "@/components/AuthorityLogo";
import {
  Download,
  Share2,
  MapPin,
  Building2,
  CalendarDays,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Settings,
  Phone,
} from "lucide-react";
import { STATUS_META, categoryBySlug } from "@/lib/civic";

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

const SIZES = {
  instagram: { w: 1080, h: 1350, label: "Instagram Post" },
  story: { w: 1080, h: 1920, label: "Story / Reel" },
  twitter: { w: 1200, h: 675, label: "Twitter / X" },
  linkedin: { w: 1200, h: 627, label: "LinkedIn" },
  facebook: { w: 1200, h: 630, label: "Facebook" },
  whatsapp: { w: 1080, h: 1080, label: "WhatsApp" },
} as const;

const STATUS_BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
  reported: { bg: "#e2e8f0", fg: "#1e293b" },
  verified: { bg: "#bfdbfe", fg: "#1e3a8a" },
  assigned: { bg: "#fde68a", fg: "#78350f" },
  in_progress: { bg: "#fde047", fg: "#0f172a" },
  resolved: { bg: "#86efac", fg: "#14532d" },
  community_confirmed: { bg: "#6ee7b7", fg: "#064e3b" },
  closed: { bg: "#cbd5e1", fg: "#334155" },
};

const REPRESENTATIVE_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%2394a3b8"><rect width="100" height="100" fill="%23f1f5f9"/><circle cx="50" cy="35" r="20"/><path d="M15 85c0-20 15-30 35-30s35 10 35 30z"/></svg>`;
const AUTHORITY_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%231d4ed8"><rect width="100" height="100" fill="%23eff6ff"/><path d="M20 80 V40 H80 V80 Z" fill="none" stroke="%231d4ed8" stroke-width="8"/><circle cx="50" cy="60" r="12" fill="%231d4ed8"/></svg>`;
const ISSUE_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" fill="%23e2e8f0"><rect width="800" height="600"/><rect x="50" y="50" width="700" height="500" rx="20" fill="none" stroke="%2394a3b8" stroke-width="6" stroke-dasharray="16 16"/><path d="M350 250l100 100m0-100L350 350" stroke="%2394a3b8" stroke-width="12" stroke-linecap="round"/></svg>`;

function useImageDataUrls(urls: (string | null | undefined)[]): Map<string, string> {
  const cache = useRef<Map<string, string>>(new Map());
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const url of urls) {
        if (!url || cache.current.has(url)) continue;
        try {
          if (url.startsWith("data:")) {
            cache.current.set(url, url);
            continue;
          }

          // Use cache-busting to bypass cached headers and ensure proper CORS behavior
          const fetchUrl = url.includes("?") 
            ? `${url}&cors=true` 
            : `${url}?cors=true`;

          const res = await fetch(fetchUrl, { mode: "cors" });
          if (!res.ok) continue;
          const blob = await res.blob();
          
          // Read blob as base64 data URL to prevent SVG foreignObject loading issues in browser download engines
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          if (!cancelled) {
            cache.current.set(url, dataUrl);
            setTick((t) => t + 1);
          }
        } catch (e) {
          console.error("Failed to load image as data URL:", url, e);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [urls.join(",")]);

  return cache.current;
}

export function PosterGenerator({ issue, publicUrl }: { issue: IssueLike; publicUrl: string }) {
  const [size, setSize] = useState<keyof typeof SIZES>("instagram");
  const [qr, setQr] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);
  
  // Set up customizable message
  const [message, setMessage] = useState<string>(
    issue.representative
      ? `Dear representative ${issue.representative.name}, please look into this issue on priority. Let's work together to fix this!`
      : `Let's work together to make our neighborhood better! Support this report to help the authorities take action.`
  );

  const cat = issue.category ?? categoryBySlug("others");
  const status = STATUS_META[issue.status] ?? STATUS_META.reported;
  const statusColors = STATUS_BADGE_COLORS[issue.status] ?? STATUS_BADGE_COLORS.in_progress;
  const dims = SIZES[size];
  const isHorizontal = dims.w > dims.h;

  const imageUrls = [issue.image_url, issue.authority?.logo_url, issue.representative?.photo_url, AUTHORITY_LOGO_FALLBACK_URL];
  const dataUrls = useImageDataUrls(imageUrls);

  const imgSrc = issue.image_url ? (dataUrls.get(issue.image_url) ?? ISSUE_PLACEHOLDER) : ISSUE_PLACEHOLDER;
  const logoSrc = issue.authority?.logo_url
    ? (dataUrls.get(issue.authority.logo_url) ?? AUTHORITY_PLACEHOLDER)
    : AUTHORITY_PLACEHOLDER;
  const repSrc = issue.representative?.photo_url 
    ? (dataUrls.get(issue.representative.photo_url) ?? REPRESENTATIVE_PLACEHOLDER) 
    : REPRESENTATIVE_PLACEHOLDER;

  useEffect(() => {
    QRCode.toDataURL(publicUrl, { margin: 1, width: 320 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [publicUrl]);

  const download = async () => {
    if (!downloadRef.current || downloading) return;
    setDownloading(true);
    try {
      const node = downloadRef.current;
      // Small timeout ensures everything is fully painted offscreen
      await new Promise((resolve) => setTimeout(resolve, 150));
      
      const data = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        width: dims.w,
        height: dims.h,
        backgroundColor: "#ffffff",
      });

      const a = document.createElement("a");
      a.href = data;
      a.download = `JanFix-${issue.public_id}-${size}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Poster downloaded");
    } catch (err) {
      console.error("Poster download failed", err);
      toast.error("Couldn't download the poster. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const scale = 360 / dims.w; 

  const locationLabel = [issue.area, issue.locality].filter(Boolean).join(", ") || issue.address || "Mangaluru";
  const wardLabel = issue.ward ? issue.ward.number.toString() : "—";
  const reportedDate = issue.created_at ? new Date(issue.created_at) : null;
  const reportedDateLabel = reportedDate
    ? reportedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  const reportedTimeLabel = reportedDate
    ? reportedDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : "";
  const supportsCount = issue.supporters_count ?? 0;
  const viewsCount = issue.views ?? 0;
  const idTail = issue.public_id.includes("-") ? issue.public_id.split("-").pop() : issue.public_id;
  const shortLink = `janfix.in/${idTail}`;

  const previewFrameStyle: CSSProperties = { width: dims.w * scale, height: dims.h * scale, overflow: "hidden" };
  const previewScaleWrapperStyle: CSSProperties = { width: dims.w, height: dims.h, transform: `scale(${scale})`, transformOrigin: "top left" };
  
  const posterOuterStyle: CSSProperties = {
    width: dims.w,
    height: dims.h,
    background: "#ffffff",
    color: "#0f172a",
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    position: "relative",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    border: "4px solid #1d4ed8",
    overflow: "hidden",
  };

  // Truncate description for visually clean poster structure
  const truncatedDesc = issue.description.length > 140 
    ? `${issue.description.slice(0, 137)}...` 
    : issue.description;

  // Determine dynamic heights based on poster sizes for vertical layouts to prevent overflow
  let imgHeight = 440;
  if (size === "story") imgHeight = 720;
  else if (size === "whatsapp") imgHeight = 290;

  const renderPosterContent = () => {
    return (
      <>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isHorizontal ? "24px 32px" : "32px 40px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="60" height="72" viewBox="0 0 24 28" fill="none" style={{ flexShrink: 0 }}>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 16 12 16s12-7.75 12-16C24 5.373 18.627 0 12 0z" fill="#1d4ed8"/>
              <circle cx="12" cy="11" r="9" fill="white"/>
              <path d="M12 5.5 c-1.5-2 -4.5-0.5 -4.5 2.5 0 2.5 4.5 5 4.5 5 s4.5-2.5 4.5-5 c0-3 -3-4.5 -4.5-2.5 z" fill="#dc2626"/>
              <g fill="#1d4ed8">
                <circle cx="12" cy="11.5" r="1.5" />
                <path d="M9 16 c0-2 2-2.5 3-2.5 s3 0.5 3 2.5 v1 h-6 z" />
                <circle cx="8" cy="12" r="1" />
                <path d="M6 15 c0-1.5 1-2 2-2 s2 0.5 2 2 v0.5 h-4 z" />
                <circle cx="16" cy="12" r="1" />
                <path d="M14 15 c0-1.5 1-2 2-2 s2 0.5 2 2 v0.5 h-4 z" />
              </g>
            </svg>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 38, fontWeight: 900, color: "#1d4ed8", lineHeight: 1, letterSpacing: "-0.5px" }}>Jan<span style={{ color: "#16a34a" }}>Fix</span></div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1d4ed8", letterSpacing: 1.5, marginTop: 4 }}>MANGALURU</div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 2, fontWeight: 600 }}>Report • Track • Fix</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>CIVIC REPORT & APPEAL</div>
              <div style={{ fontSize: 15, color: "#16a34a", fontWeight: 700, marginTop: 3 }}>ನಮ್ಮ ಮಂಗಳೂರು, ನಮ್ಮ ಜವಾಬ್ದಾರಿ</div>
            </div>
          </div>
        </div>

        {/* Layout Switcher */}
        {isHorizontal ? (
          /* Horizontal Grid Layout (Twitter, LinkedIn, Facebook) */
          <div style={{ display: "flex", flex: 1, padding: "24px 32px", gap: 24, overflow: "hidden", minHeight: 0 }}>
            {/* Left Column: Issue details */}
            <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
              <div style={{ position: "relative", flex: 1, minHeight: 180, borderRadius: 16, overflow: "hidden", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <img src={imgSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                
                {/* ID & Status overlay */}
                <div style={{ position: "absolute", top: 16, left: 16, background: "#dc2626", color: "white", padding: "8px 16px", borderRadius: 8, fontWeight: 900, fontSize: 14 }}>
                  ID: {issue.public_id.toUpperCase()}
                </div>
                <div style={{ position: "absolute", top: 16, right: 16, background: statusColors.bg, color: statusColors.fg, padding: "8px 16px", borderRadius: 8, fontWeight: 900, fontSize: 14 }}>
                  {status.label.toUpperCase()}
                </div>
                
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50%", background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)" }} />
                <div style={{ position: "absolute", bottom: 16, left: 20, right: 20, color: "white" }}>
                  <div style={{ fontSize: 24, fontWeight: 900, textTransform: "uppercase" }}>{cat.name_en}</div>
                  <div style={{ fontSize: 15, marginTop: 4, opacity: 0.95, fontWeight: 500 }}>{truncatedDesc}</div>
                </div>
              </div>

              {/* Issue Details Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: 16, background: "#f8fafc", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <MapPin size={20} color="#1d4ed8" />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }} className="truncate">{locationLabel}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Building2 size={20} color="#1d4ed8" />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Ward {wardLabel}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CalendarDays size={20} color="#1d4ed8" />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{reportedDateLabel}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Eye size={20} color="#1d4ed8" />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{supportsCount} Supports • {viewsCount} Views</div>
                </div>
              </div>
            </div>

            {/* Right Column: Representative & Message */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
              <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <img src={repSrc} alt="" style={{ width: 90, height: 90, borderRadius: "50%", objectFit: "cover", border: "3px solid #3b82f6" }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#2563eb", letterSpacing: 0.5, textTransform: "uppercase" }}>Local Representative</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>{issue.representative?.name ?? "Representative Not Mapped"}</div>
                    <div style={{ fontSize: 14, color: "#475569", marginTop: 2 }}>{issue.representative?.role ?? "Ward Ward Corporator / MLA"}</div>
                  </div>
                </div>

                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: 16, borderRadius: 12, position: "relative" }}>
                  <div style={{ fontSize: 14, fontStyle: "italic", color: "#1e40af", fontWeight: 600, lineHeight: 1.4 }}>
                    "{message}"
                  </div>
                </div>
              </div>

              {/* Authority */}
              <div style={{ background: "#f8fafc", borderRadius: 16, border: "1px solid #e2e8f0", padding: "12px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                <img src={logoSrc} alt="" style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 8, background: "white", padding: 2 }} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Responsible Authority</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{issue.authority?.name ?? "Mangaluru City Corporation"}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Vertical Layout (Instagram, Story, WhatsApp) */
          <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "24px 40px", gap: 24, overflow: "hidden", minHeight: 0 }}>
            {/* Issue Image Box */}
            <div style={{ position: "relative", height: imgHeight, borderRadius: 20, overflow: "hidden", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", flexShrink: 0 }}>
              <img src={imgSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              
              {/* ID & Status overlay */}
              <div style={{ position: "absolute", top: 20, left: 20, background: "#dc2626", color: "white", padding: "10px 20px", borderRadius: 10, fontWeight: 900, fontSize: 16 }}>
                ID: {issue.public_id.toUpperCase()}
              </div>
              <div style={{ position: "absolute", top: 20, right: 20, background: statusColors.bg, color: statusColors.fg, padding: "10px 20px", borderRadius: 10, fontWeight: 900, fontSize: 16 }}>
                {status.label.toUpperCase()}
              </div>
              
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "55%", background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)" }} />
              <div style={{ position: "absolute", bottom: 24, left: 30, right: 30, color: "white" }}>
                <div style={{ fontSize: 32, fontWeight: 900, textTransform: "uppercase" }}>{cat.name_en}</div>
                <div style={{ fontSize: 18, marginTop: 6, opacity: 0.95, fontWeight: 500, lineHeight: 1.3 }}>{truncatedDesc}</div>
              </div>
            </div>

            {/* Details & Representative grid in a vertical stack */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1, minHeight: 0 }}>
              {/* Info Details Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: 20, background: "#f8fafc", borderRadius: 20, border: "1px solid #e2e8f0", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <MapPin size={24} color="#1d4ed8" />
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#334155" }} className="truncate">{locationLabel}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Building2 size={24} color="#1d4ed8" />
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#334155" }}>Ward {wardLabel}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <CalendarDays size={24} color="#1d4ed8" />
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#334155" }}>{reportedDateLabel}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Eye size={24} color="#1d4ed8" />
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#334155" }}>{supportsCount} Supports • {viewsCount} Views</div>
                </div>
              </div>

              {/* Representative Card */}
              <div style={{ background: "#ffffff", borderRadius: 20, border: "1px solid #e2e8f0", padding: 24, display: "flex", gap: 24, alignItems: "center", flex: 1, minHeight: 0 }}>
                <img src={repSrc} alt="" style={{ width: 140, height: 140, borderRadius: "50%", objectFit: "cover", border: "4px solid #3b82f6", flexShrink: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", letterSpacing: 1, textTransform: "uppercase" }}>Local Representative</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>{issue.representative?.name ?? "Representative Not Mapped"}</div>
                  <div style={{ fontSize: 16, color: "#475569", fontWeight: 600 }}>{issue.representative?.role ?? "Corporator / MLA"}</div>
                  {issue.representative?.phone && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15, color: "#64748b", marginTop: 2 }}>
                      <Phone size={14} /> {issue.representative.phone}
                    </div>
                  )}
                  
                  <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: 14, borderRadius: 12, marginTop: 10 }}>
                    <div style={{ fontSize: 15, fontStyle: "italic", color: "#1e40af", fontWeight: 600, lineHeight: 1.4 }}>
                      "{message}"
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ background: "#1e3a8a", borderTop: "4px solid #16a34a", padding: isHorizontal ? "20px 32px" : "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "white", flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px" }}>Help Us Support and Resolve This Issue!</div>
            <div style={{ fontSize: 14, opacity: 0.9, fontWeight: 500 }}>Submit your support on JanFix and make our city better.</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, background: "white", padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", flexShrink: 0 }}>
            {qr && <img src={qr} alt="QR" style={{ width: 76, height: 76, borderRadius: 6, display: "block" }} />}
            <div style={{ color: "#0f172a" }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#1d4ed8", letterSpacing: 0.5 }}>SCAN TO VOTE & SHARE</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>{shortLink}</div>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-4">
      {/* Size selectors */}
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

      {/* Customizable message box */}
      <div className="rounded-xl border bg-card p-4 space-y-2">
        <label htmlFor="custom-poster-message" className="text-sm font-semibold text-foreground">
          Customize Poster Message
        </label>
        <textarea
          id="custom-poster-message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 150))}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Type a message to print on the poster..."
        />
        <div className="text-[10px] text-muted-foreground text-right">{message.length}/150</div>
      </div>

      {/* Poster Preview Frame */}
      <div className="overflow-hidden rounded-xl border bg-muted/20 p-3 shadow-inner">
        <div style={previewFrameStyle} className="mx-auto border bg-white shadow-md rounded-lg overflow-hidden">
          <div style={previewScaleWrapperStyle}>
            <div style={posterOuterStyle}>
              {renderPosterContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Offscreen element rendered at exact natural size for pixel-perfect downloading */}
      <div style={{ position: "absolute", top: -99999, left: -99999, width: dims.w, height: dims.h, overflow: "hidden", pointerEvents: "none" }}>
        <div ref={downloadRef} style={posterOuterStyle}>
          {renderPosterContent()}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2.5">
        <Button onClick={download} disabled={downloading} className="gap-2 px-5 font-semibold">
          <Download className="h-4.5 w-4.5" /> {downloading ? "Generating..." : "Download PNG"}
        </Button>
        <ShareButtons
          url={publicUrl}
          text={`${issue.description} — ${issue.public_id} on JanFix Mangaluru`}
        />
      </div>
    </div>
  );
}

function ShareButtons({ url, text }: { url: string; text: string }) {
  const enc = encodeURIComponent;
  const combinedText = `${text} ${url}`;
  const links = [
    { label: "WhatsApp", href: "https://wa.me/?text=" + enc(combinedText) },
    { label: "Twitter", href: "https://twitter.com/intent/tweet?text=" + enc(text) + "&url=" + enc(url) },
    { label: "Facebook", href: "https://www.facebook.com/sharer/sharer.php?u=" + enc(url) },
    { label: "LinkedIn", href: "https://www.linkedin.com/sharing/share-offsite/?url=" + enc(url) },
  ];
  return (
    <>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-accent"
        >
          <Share2 className="h-3.5 w-3.5" /> {l.label}
        </a>
      ))}
    </>
  );
}
