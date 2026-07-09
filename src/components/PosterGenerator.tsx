import { useEffect, useRef, useState, useMemo, type CSSProperties } from "react";
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
  Camera,
  Megaphone,
} from "lucide-react";
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

const SIZES = {
  instagram: { w: 1080, h: 1350, label: "Instagram Post" },
  story: { w: 1080, h: 1920, label: "Story / Reel" },
  twitter: { w: 1200, h: 675, label: "Twitter / X" },
  linkedin: { w: 1200, h: 627, label: "LinkedIn" },
  facebook: { w: 1200, h: 630, label: "Facebook" },
  whatsapp: { w: 1080, h: 1080, label: "WhatsApp" },
} as const;

const REPRESENTATIVE_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%231a5d2b"><rect width="100" height="100" fill="%23f0fdf4"/><circle cx="50" cy="35" r="20"/><path d="M15 85c0-20 15-30 35-30s35 10 35 30z"/></svg>`;
const AUTHORITY_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%231a5d2b"><rect width="100" height="100" fill="%23f0fdf4"/><path d="M20 80 V40 H80 V80 Z" fill="none" stroke="%231a5d2b" stroke-width="8"/><circle cx="50" cy="60" r="12" fill="%231a5d2b"/></svg>`;
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

          const res = await getBase64ImageFn({ data: { url } });
          if (res.base64 && !cancelled) {
            cache.current.set(url, res.base64);
            setTick((t) => t + 1);
          }
        } catch (e) {
          console.error("Failed to proxy image:", url, e);
        }
      }
    })();
    return () => {
      cancelled = true;
      cache.current.clear();
    };
  }, [JSON.stringify(urls)]);

  return cache.current;
}

export function PosterGenerator({ issue, publicUrl }: { issue: IssueLike; publicUrl: string }) {
  const [size, setSize] = useState<keyof typeof SIZES>("instagram");
  const [qr, setQr] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);
  
  const [message, setMessage] = useState<string>(
    issue.representative
      ? `Dear representative ${issue.representative.name}, please look into this issue on priority. Let's work together to fix this!`
      : `Let's work together to make our neighborhood better! Support this report to help the authorities take action.`
  );

  const cat = issue.category ?? categoryBySlug("others");
  const status = STATUS_META[issue.status] ?? STATUS_META.reported;
  const dims = SIZES[size];
  const isHorizontal = dims.w > dims.h;

  const imageUrls = useMemo(() => [
    issue.image_url, 
    issue.authority?.logo_url, 
    issue.representative?.photo_url, 
    AUTHORITY_LOGO_FALLBACK_URL
  ], [issue.image_url, issue.authority?.logo_url, issue.representative?.photo_url]);
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
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      const data = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2.5,
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
      toast.success("Poster downloaded successfully");
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
    ? reportedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
    : "—";
  const reportedTimeLabel = reportedDate
    ? reportedDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : "";
  const idTail = issue.public_id.includes("-") ? issue.public_id.split("-").pop() : issue.public_id;
  const shortLink = `janfix.in/track/${idTail}`;

  const previewFrameStyle: CSSProperties = { width: dims.w * scale, height: dims.h * scale, overflow: "hidden" };
  const previewScaleWrapperStyle: CSSProperties = { width: dims.w, height: dims.h, transform: `scale(${scale})`, transformOrigin: "top left" };
  
  const posterOuterStyle: CSSProperties = {
    width: dims.w,
    height: dims.h,
    background: "#ffffff",
    color: "#0f172a",
    fontFamily: 'Plus Jakarta Sans, Inter, system-ui, -apple-system, sans-serif',
    position: "relative",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    overflow: "hidden",
  };

  const truncatedDesc = issue.description.length > 130 
    ? `${issue.description.slice(0, 127)}...` 
    : issue.description;

  const renderPosterContent = () => {
    return (
      <>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isHorizontal ? "28px 48px" : "40px 50px 24px 50px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="56" height="66" viewBox="0 0 24 28" fill="none" style={{ flexShrink: 0 }}>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 16 12 16s12-7.75 12-16C24 5.373 18.627 0 12 0z" fill="#1a5d2b"/>
              <circle cx="12" cy="11" r="9" fill="white"/>
              <path d="M12 5.5 c-1.5-2 -4.5-0.5 -4.5 2.5 0 2.5 4.5 5 4.5 5 s4.5-2.5 4.5-5 c0-3 -3-4.5 -4.5-2.5 z" fill="#dc2626"/>
              <g fill="#1a5d2b">
                <circle cx="12" cy="11.5" r="1.5" />
                <path d="M9 16 c0-2 2-2.5 3-2.5 s3 0.5 3 2.5 v1 h-6 z" />
                <circle cx="8" cy="12" r="1" />
                <path d="M6 15 c0-1.5 1-2 2-2 s2 0.5 2 2 v0.5 h-4 z" />
                <circle cx="16" cy="12" r="1" />
                <path d="M14 15 c0-1.5 1-2 2-2 s2 0.5 2 2 v0.5 h-4 z" />
              </g>
            </svg>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 34, fontWeight: 900, color: "#1a5d2b", lineHeight: 1, letterSpacing: "-0.5px" }}>Jan<span style={{ color: "#e4ac12" }}>Fix</span></div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#475569", letterSpacing: 1.5, marginTop: 4 }}>MANGALURU</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#1a5d2b", letterSpacing: 2 }}>CIVIC INITIATIVE</div>
            <div style={{ fontSize: 13, color: "#475569", fontWeight: 700, marginTop: 2 }}>Our City, Our Right</div>
          </div>
        </div>

        {isHorizontal ? (
          /* Horizontal Grid Layout (Twitter, LinkedIn, Facebook) */
          <div style={{ display: "flex", flex: 1, padding: "20px 48px", gap: 40, overflow: "hidden", minHeight: 0 }}>
            {/* Left Column: Slogan & Tilted Polaroid */}
            <div style={{ flex: 1.1, display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
              <div style={{ fontSize: 38, fontWeight: 900, color: "#1a5d2b", textTransform: "uppercase", letterSpacing: "-1px", lineHeight: 1.15 }}>
                undu dada avassthe mare,<br />
                <span style={{ color: "#e4ac12" }}>yapa sari malpuni??</span>
                <div style={{ height: 5, background: "#e4ac12", width: "150px", marginTop: 10, borderRadius: 3 }} />
              </div>

              {/* Tilted Polaroid */}
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, padding: "20px 0" }}>
                <div style={{ 
                  background: "white", 
                  padding: "16px 16px 36px 16px", 
                  borderRadius: 8, 
                  boxShadow: "0 20px 40px rgba(0,0,0,0.12)", 
                  transform: "rotate(-2deg)", 
                  width: "90%", 
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative"
                }}>
                  <div style={{ width: "100%", height: 260, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                    <img src={imgSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 5, background: "#e4ac12", color: "white", padding: "6px 12px", borderRadius: 30, fontWeight: 800, fontSize: 11 }}>
                      <Camera size={12} /> REPORTED
                    </div>
                    <div style={{ position: "absolute", top: 12, right: 12, background: "#1a5d2b", color: "white", padding: "6px 12px", borderRadius: 30, fontWeight: 800, fontSize: 11 }}>
                      {status.label.toUpperCase()}
                    </div>
                    <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)", color: "white", padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                      {reportedDateLabel}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, color: "#1e293b" }}>
                    <MapPin size={16} color="#1a5d2b" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {locationLabel}
                    </div>
                  </div>
                  <div style={{ position: "absolute", bottom: 8, right: 16, fontSize: 11, fontWeight: 800, color: "#94a3b8" }}>
                    {issue.public_id.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Cards, Authority, QR */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", minWidth: 0 }}>
              {/* Tagline callout badge */}
              <div style={{ 
                background: "#1a5d2b", 
                color: "white", 
                padding: "16px 20px", 
                borderRadius: "16px 16px 0 16px", 
                boxShadow: "0 8px 20px rgba(26,93,43,0.3)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#e4ac12" }}>You Reported. We Reached.</div>
                <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>They Will Resolve.</div>
              </div>

              {/* Assignment Info */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#1a5d2b", display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0 }}>
                  <Building2 size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Responsible Authority</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {issue.authority?.name.toUpperCase() ?? "MCC GENERAL ADMINISTRATION"}
                  </div>
                </div>
              </div>

              {/* Representative Highlight */}
              {issue.representative && (
                <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                  <img src={repSrc} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: "2px solid #e4ac12", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b" }}>{issue.representative.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{issue.representative.role}</div>
                  </div>
                  <div style={{ flex: 1.2, background: "#eff6ff", border: "1px solid #bfdbfe", padding: "8px 12px", borderRadius: 8, fontSize: 11, fontStyle: "italic", color: "#1e40af", fontWeight: 600, lineHeight: 1.3 }}>
                    "{message.slice(0, 80)}..."
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Vertical Layout (Instagram, Story, WhatsApp) */
          <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "24px 40px 16px 40px", gap: 24, overflow: "hidden", minHeight: 0 }}>
            {/* Slogan Headline */}
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{ fontSize: size === "story" ? 54 : 44, fontWeight: 900, color: "#1a5d2b", textTransform: "uppercase", letterSpacing: "-1px", lineHeight: 1.1, display: "inline-block", position: "relative" }}>
                undu dada avassthe mare,
                <br />
                <span style={{ color: "#e4ac12" }}>yapa sari malpuni??</span>
                <div style={{ height: 6, background: "#e4ac12", width: "80%", margin: "6px auto 0 auto", borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#475569", marginTop: 12, maxWidth: 520, lineHeight: 1.4 }}>
                Thanks! Your report has been submitted. We've assigned it to the right authority. We'll keep tracking until it's fixed.
              </div>
            </div>

            {/* Tilted Polaroid Section */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, padding: "16px 0", minHeight: 0, position: "relative" }}>
              <div style={{ 
                background: "white", 
                padding: "20px 20px 48px 20px", 
                borderRadius: 8, 
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.18)", 
                transform: "rotate(-2.5deg)", 
                width: "82%", 
                maxWidth: 580,
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                position: "relative"
              }}>
                <div style={{ width: "100%", height: size === "story" ? 480 : size === "whatsapp" ? 340 : 400, borderRadius: 4, overflow: "hidden", position: "relative", border: "1px solid #f1f5f9" }}>
                  <img src={imgSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", top: 16, left: 16, display: "flex", alignItems: "center", gap: 6, background: "#e4ac12", color: "white", padding: "8px 14px", borderRadius: 30, fontWeight: 800, fontSize: 13, boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                    <Camera size={14} /> ISSUE REPORTED
                  </div>
                  <div style={{ position: "absolute", top: 16, right: 16, background: "#1a5d2b", color: "white", padding: "8px 14px", borderRadius: 30, fontWeight: 800, fontSize: 13, boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                    {status.label.toUpperCase()}
                  </div>
                  <div style={{ position: "absolute", bottom: 16, right: 16, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)", color: "white", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                    {reportedDateLabel} | {reportedTimeLabel}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, color: "#1e293b" }}>
                  <MapPin size={18} color="#1a5d2b" style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {locationLabel}
                  </div>
                </div>
                <div style={{ position: "absolute", bottom: 12, right: 20, fontSize: 12, fontWeight: 800, color: "#94a3b8" }}>
                  {issue.public_id.toUpperCase()}
                </div>
                
                {/* Green tagline callout badge */}
                <div style={{ 
                  position: "absolute", 
                  bottom: -24, 
                  right: -24, 
                  background: "#1a5d2b", 
                  color: "white", 
                  padding: "16px 24px", 
                  borderRadius: "16px 16px 0 16px", 
                  boxShadow: "0 10px 25px rgba(26,93,43,0.35)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  border: "2px solid white",
                  transform: "rotate(2.5deg)",
                  zIndex: 10
                }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#e4ac12" }}>You Reported.</div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>We Reached.</div>
                  <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>They Will Resolve.</div>
                </div>
              </div>
            </div>

            {/* Dynamic Assignment Card */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#1a5d2b", display: "flex", alignItems: "center", justifyCenter: "center", color: "white", flexShrink: 0, justifyContent: "center" }}>
                  <Building2 size={24} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>Assigned Authority</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {issue.authority?.name.toUpperCase() ?? "MCC GENERAL ADMINISTRATION"}
                  </div>
                  <div style={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>Mangaluru City Corporation</div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1a5d2b", display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>»</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>Action Status</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#1a5d2b" }}>{status.label.toUpperCase()}</div>
                  <div style={{ fontSize: 12, color: "#475569", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {status.description}
                  </div>
                </div>
              </div>
            </div>

            {/* Representative Card */}
            {issue.representative && (
              <div style={{ flexShrink: 0 }}>
                <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                  <img src={repSrc} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "3px solid #e4ac12", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#e4ac12", textTransform: "uppercase" }}>Local Representative</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b" }}>{issue.representative.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{issue.representative.role} · Ward {wardLabel}</div>
                  </div>
                  <div style={{ flex: 1.5, background: "#eff6ff", border: "1px solid #bfdbfe", padding: "10px 14px", borderRadius: 10, fontSize: 12, fontStyle: "italic", color: "#1e40af", fontWeight: 600, lineHeight: 1.3 }}>
                    "{message}"
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0", padding: isHorizontal ? "20px 48px" : "24px 50px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#0f172a", flexShrink: 0, marginTop: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#1a5d2b", display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0 }}>
              <Megaphone size={20} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#1a5d2b" }}>Your Voice. Our Action.</div>
              <div style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>Let's build a better, cleaner Mangaluru.</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "white", border: "1px solid #e2e8f0", padding: "8px 16px", borderRadius: 12 }}>
            {qr && <img src={qr} alt="QR" style={{ width: 68, height: 68, display: "block" }} />}
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, color: "#1a5d2b" }}>SCAN TO FOLLOW REPORT</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#e4ac12", marginTop: 2 }}>{shortLink}</div>
            </div>
          </div>
        </div>

        {/* Bottom Strip */}
        <div style={{ background: "#1a5d2b", padding: "10px 50px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "white", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 16, opacity: 0.9 }}>
            <span>INDEPENDENT CITIZEN INITIATIVE</span>
            <span>•</span>
            <span>TRANSPARENT PROCESS</span>
            <span>•</span>
            <span>ACCOUNTABLE GOVERNANCE</span>
          </div>
          <div style={{ color: "#e4ac12" }}>Let's build a better Mangaluru. ❤</div>
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
      <div 
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: "absolute", top: -99999, left: -99999, width: dims.w, height: dims.h, overflow: "hidden", pointerEvents: "none" }}
      >
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
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-accent"
        >
          <Share2 className="h-3.5 w-3.5" /> {l.label}
        </a>
      ))}
    </>
  );
}
