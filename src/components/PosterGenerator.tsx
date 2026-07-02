import { useEffect, useRef, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

function useImageDataUrls(urls: (string | null | undefined)[]): Map<string, string> {
  const cache = useRef<Map<string, string>>(new Map());
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const url of urls) {
        if (!url || cache.current.has(url)) continue;
        try {
          const res = await fetch(url, { mode: "cors", cache: "no-store" });
          if (!res.ok) continue;
          const blob = await res.blob();
          if (!cancelled) {
            cache.current.set(url, URL.createObjectURL(blob));
            setTick((t) => t + 1);
          }
        } catch {
          // fallback
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
  const posterRef = useRef<HTMLDivElement>(null);
  
  const cat = issue.category ?? categoryBySlug("others");
  const status = STATUS_META[issue.status] ?? STATUS_META.reported;
  const statusColors = STATUS_BADGE_COLORS[issue.status] ?? STATUS_BADGE_COLORS.in_progress;
  const dims = SIZES[size];
  const isHorizontal = dims.w > dims.h;

  const imageUrls = [issue.image_url, issue.authority?.logo_url, issue.representative?.photo_url];
  const dataUrls = useImageDataUrls(imageUrls);
  const imgSrc = issue.image_url ? (dataUrls.get(issue.image_url) ?? issue.image_url) : "";
  const logoSrc = issue.authority?.logo_url ? (dataUrls.get(issue.authority.logo_url) ?? issue.authority.logo_url) : "";
  const repSrc = issue.representative?.photo_url ? (dataUrls.get(issue.representative.photo_url) ?? issue.representative.photo_url) : "";

  useEffect(() => {
    QRCode.toDataURL(publicUrl, { margin: 1, width: 320 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [publicUrl]);

  const download = async () => {
    if (!posterRef.current || downloading) return;
    setDownloading(true);
    try {
      const node = posterRef.current;
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
      toast.error("Couldn't download the poster. Please try again in a moment.");
    } finally {
      setDownloading(false);
    }
  };

  const scale = 360 / dims.w; 

  const locationLabel = [issue.area, issue.locality].filter(Boolean).join(", ") || issue.address || "Mangaluru";
  const wardLabel = issue.ward ? issue.ward.number.toString() : "\u2014";
  const reportedDate = issue.created_at ? new Date(issue.created_at) : null;
  const reportedDateLabel = reportedDate
    ? reportedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "\u2014";
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
    fontFamily: "Inter, sans-serif",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    border: "2px solid #1d4ed8",
    overflow: "hidden",
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(SIZES) as (keyof typeof SIZES)[]).map((k) => (
          <button
            key={k}
            onClick={() => setSize(k)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              size === k ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground"
            }`}
          >
            {SIZES[k].label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-muted/40 p-3">
        <div style={previewFrameStyle} className="mx-auto">
          <div style={previewScaleWrapperStyle}>
            <div ref={posterRef} style={posterOuterStyle}>
              
              {/* Header */}
              <div style= display: "flex", alignItems: "center", justifyContent: "space-between", padding: isHorizontal ? "20px 30px" : "30px 40px", flexShrink: 0 >
                <div style= display: "flex", alignItems: "center", gap: 20 >
                  <svg width="68" height="82" viewBox="0 0 24 28" fill="none">
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
                  <div style= display: "flex", flexDirection: "column" >
                    <div style= fontSize: 44, fontWeight: 800, color: "#1d4ed8", lineHeight: 1 >Jan<span style= color: "#16a34a" >Fix</span></div>
                    <div style= fontSize: 18, fontWeight: 700, color: "#1d4ed8", letterSpacing: 1.5, marginTop: 4 >MANGALURU</div>
                    <div style= fontSize: 16, color: "#0f172a", marginTop: 4, fontWeight: 500 >Report. Track. Fix.</div>
                  </div>
                </div>

                <div style= width: 2, background: "#e2e8f0", height: 80, margin: "0 20px"  />

                <div style= display: "flex", alignItems: "center", gap: 20, flexShrink: 0 >
                  <div style= display: "flex", flexDirection: "column", textAlign: "left" >
                    <div style= fontSize: 26, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 >Let's Fix Mangaluru</div>
                    <div style= fontSize: 18, color: "#16a34a", fontWeight: 700, marginTop: 4 >ನಮ್ಮ ಮಂಗಳೂರು, ನಮ್ಮ ಜವಾಬ್ದಾರಿ</div>
                    <div style= fontSize: 16, color: "#475569", marginTop: 4, fontWeight: 500 >Together for a Better City</div>
                  </div>
                  {!isHorizontal && (
                    <svg width="120" height="68" viewBox="0 0 96 52" style= flexShrink: 0 >
                      <g fill="none" stroke="#94a3b8" strokeWidth="1.2">
                        <rect x="2" y="26" width="14" height="26" />
                        <rect x="18" y="14" width="14" height="38" />
                        <polygon points="25,4 18,14 32,14" />
                        <rect x="34" y="20" width="12" height="32" />
                        <circle cx="40" cy="14" r="6" />
                        <rect x="48" y="30" width="12" height="22" />
                        <rect x="62" y="10" width="14" height="42" />
                        <path d="M62 10 L69 2 L76 10" />
                        <rect x="78" y="24" width="14" height="28" />
                        <path d="M4 8 q3 -3 6 0" />
                        <path d="M12 4 q3 -3 6 0" />
                      </g>
                    </svg>
                  )}
                </div>
              </div>

              {/* Hero Image */}
              <div style= position: "relative", flex: 1, margin: "0 24px", borderRadius: 24, overflow: "hidden", backgroundColor: "#e2e8f0", display: "flex" >
                {imgSrc ? (
                  <img src={imgSrc} alt="" crossOrigin="anonymous" style= width: "100%", height: "100%", objectFit: "cover"  />
                ) : null}
                
                {/* Gradient Overlay for Text */}
                <div style= position: "absolute", bottom: 0, left: 0, right: 0, height: "60%", background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)"  />

                {/* ID Badge */}
                <div style= position: "absolute", top: 30, left: 0, background: "#dc2626", color: "white", padding: "14px 28px", borderRadius: "0 16px 16px 0" >
                  <div style= fontSize: 13, fontWeight: 700, letterSpacing: 1, opacity: 0.9, textAlign: "center" >ISSUE ID</div>
                  <div style= fontSize: 26, fontWeight: 900, marginTop: 2 >{issue.public_id.toUpperCase()}</div>
                </div>

                {/* Status Badge */}
                <div style= position: "absolute", top: 30, right: 30, background: statusColors.bg, color: statusColors.fg, padding: "14px 24px", borderRadius: 16, display: "flex", alignItems: "center", gap: 12 >
                  <Settings size={28} />
                  <div>
                    <div style= fontSize: 13, fontWeight: 700, letterSpacing: 1, opacity: 0.9 >STATUS</div>
                    <div style= fontSize: 22, fontWeight: 900, marginTop: 2 >{status.label.toUpperCase()}</div>
                  </div>
                </div>

                {/* Title & Desc */}
                <div style= position: "absolute", bottom: 80, left: 40, right: 40, color: "white" >
                  <div style= fontSize: isHorizontal ? 48 : 64, fontWeight: 900, textTransform: "uppercase", lineHeight: 1.1, textShadow: "0 2px 10px rgba(0,0,0,0.5)" >
                    {cat.name_en}
                  </div>
                  <div style= fontSize: isHorizontal ? 20 : 24, marginTop: 8, opacity: 0.95, textShadow: "0 2px 10px rgba(0,0,0,0.5)", maxWidth: "80%" >
                    {issue.description}
                  </div>
                </div>
              </div>

              {/* Floating Info Bar */}
              <div style= margin: "-50px 48px 0", background: "white", borderRadius: 16, boxShadow: "0 10px 40px rgba(0,0,0,0.12)", position: "relative", zIndex: 10, display: "flex", alignItems: "center", padding: "24px 20px", border: "1px solid #f1f5f9" >
                <div style= display: "flex", alignItems: "center", gap: 16, flex: 1, justifyContent: "center" >
                  <MapPin size={36} color="#1d4ed8" strokeWidth={2} />
                  <div>
                    <div style= fontSize: 13, fontWeight: 700, color: "#1d4ed8", letterSpacing: 0.5 >LOCATION</div>
                    <div style= fontSize: 16, fontWeight: 600, color: "#0f172a", marginTop: 4 >{locationLabel}</div>
                  </div>
                </div>
                <div style= width: 1, background: "#e2e8f0", height: 50  />
                <div style= display: "flex", alignItems: "center", gap: 16, flex: 1, justifyContent: "center" >
                  <Building2 size={36} color="#1d4ed8" strokeWidth={2} />
                  <div>
                    <div style= fontSize: 13, fontWeight: 700, color: "#1d4ed8", letterSpacing: 0.5 >WARD</div>
                    <div style= fontSize: 24, fontWeight: 800, color: "#0f172a", marginTop: 2 >{wardLabel}</div>
                  </div>
                </div>
                <div style= width: 1, background: "#e2e8f0", height: 50  />
                <div style= display: "flex", alignItems: "center", gap: 16, flex: 1, justifyContent: "center" >
                  <CalendarDays size={36} color="#1d4ed8" strokeWidth={2} />
                  <div>
                    <div style= fontSize: 13, fontWeight: 700, color: "#1d4ed8", letterSpacing: 0.5 >REPORTED ON</div>
                    <div style= fontSize: 16, fontWeight: 600, color: "#0f172a", marginTop: 4 >{reportedDateLabel}</div>
                    {reportedTimeLabel && <div style= fontSize: 14, color: "#475569" >{reportedTimeLabel}</div>}
                  </div>
                </div>
                <div style= width: 1, background: "#e2e8f0", height: 50  />
                <div style= display: "flex", alignItems: "center", gap: 16, flex: 1, justifyContent: "center" >
                  <Eye size={36} color="#1d4ed8" strokeWidth={2} />
                  <div>
                    <div style= fontSize: 13, fontWeight: 700, color: "#1d4ed8", letterSpacing: 0.5 >SUPPORTS</div>
                    <div style= fontSize: 24, fontWeight: 800, color: "#0f172a", marginTop: 2 >{supportsCount}</div>
                    <div style= fontSize: 13, color: "#475569", fontWeight: 600, textTransform: "uppercase" >Views {viewsCount}</div>
                  </div>
                </div>
              </div>

              {/* People Row */}
              <div style= display: "flex", padding: "30px 48px", flexShrink: 0 >
                <div style= flex: 1 >
                  <div style= fontSize: 14, fontWeight: 700, color: "#1d4ed8", letterSpacing: 0.5 >RESPONSIBLE AUTHORITY</div>
                  <div style= display: "flex", alignItems: "center", gap: 20, marginTop: 16 >
                    {logoSrc ? (
                      <img src={logoSrc} alt="" crossOrigin="anonymous" style= width: 72, height: 72, objectFit: "contain", borderRadius: 12, background: "white", border: "1px solid #e2e8f0", padding: 4  />
                    ) : (
                      <div style= width: 72, height: 72, borderRadius: 12, background: "#e2e8f0"  />
                    )}
                    <div>
                      <div style= fontSize: 22, fontWeight: 800, color: "#0f172a" >{issue.authority?.name ?? "Unassigned"}</div>
                      {(issue.authority?.department || issue.authority?.type) && (
                        <div style= fontSize: 16, color: "#475569", marginTop: 4 >
                          {[issue.authority?.department, issue.authority?.type].filter(Boolean).join(" \u00b7 ")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {issue.representative && (
                  <>
                    <div style= width: 1, background: "#e2e8f0", margin: "0 30px"  />
                    <div style= flex: 1 >
                      <div style= fontSize: 14, fontWeight: 700, color: "#1d4ed8", letterSpacing: 0.5 >LOCAL REPRESENTATIVE</div>
                      <div style= display: "flex", alignItems: "center", gap: 20, marginTop: 16 >
                        {repSrc ? (
                          <img src={repSrc} alt="" crossOrigin="anonymous" style= width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid #e2e8f0"  />
                        ) : (
                          <div style= width: 72, height: 72, borderRadius: "50%", background: "#e2e8f0"  />
                        )}
                        <div>
                          <div style= fontSize: 20, fontWeight: 800, color: "#0f172a" >{issue.representative.name}</div>
                          <div style= fontSize: 16, color: "#475569", marginTop: 4 >{issue.representative.role}</div>
                          {issue.representative.phone && (
                            <div style= display: "flex", alignItems: "center", gap: 6, fontSize: 15, color: "#475569", marginTop: 6, fontWeight: 500 >
                              <Phone size={14} /> {issue.representative.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div style= background: "#1e3a8a", borderRadius: 24, margin: "0 24px 24px", padding: "30px 40px", display: "flex", justifyContent: "space-between", color: "white", flexShrink: 0 >
                <div style= display: "flex", flexDirection: "column", justifyContent: "center" >
                  <div style= fontSize: 26, fontWeight: 800, lineHeight: 1.2 >Your Small Report</div>
                  <div style= fontSize: 26, fontWeight: 800, color: "#fde047", lineHeight: 1.2 >Can Create a Big Change!</div>
                  <div style= width: 60, height: 2, background: "rgba(255,255,255,0.4)", margin: "16px 0"  />
                  <div style= fontSize: 16, opacity: 0.9, maxWidth: 300, lineHeight: 1.4 >
                    Vote, share and help make Mangaluru a better place to live.
                  </div>
                </div>
                
                <div style= display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-end" >
                  <div style= display: "flex", gap: 12 >
                    <div style= display: "flex", alignItems: "center", gap: 12, background: "#16a34a", padding: "12px 20px", borderRadius: 12 >
                      <ThumbsUp size={24} />
                      <div>
                        <div style= fontSize: 14, fontWeight: 800 >ISSUE FIXED</div>
                        <div style= fontSize: 11, opacity: 0.9 >Vote if the issue is resolved</div>
                      </div>
                    </div>
                    <div style= display: "flex", alignItems: "center", gap: 12, background: "#dc2626", padding: "12px 20px", borderRadius: 12 >
                      <ThumbsDown size={24} />
                      <div>
                        <div style= fontSize: 14, fontWeight: 800 >STILL EXISTS</div>
                        <div style= fontSize: 11, opacity: 0.9 >Vote if the issue still exists</div>
                      </div>
                    </div>
                  </div>
                  
                  <div style= display: "flex", alignItems: "center", gap: 16, background: "white", borderRadius: 16, padding: "12px 20px", width: "100%" >
                    {qr && <img src={qr} alt="QR" style= width: 72, height: 72, borderRadius: 8  />}
                    <div style= color: "#0f172a" >
                      <div style= fontSize: 13, fontWeight: 800 >SCAN TO VIEW & SUPPORT</div>
                      <div style= fontSize: 13, color: "#475569", marginTop: 2 >this issue or visit</div>
                      <div style= fontSize: 16, fontWeight: 800, color: "#1d4ed8", marginTop: 2 >{shortLink}</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={download} disabled={downloading} className="gap-2">
          <Download className="h-4 w-4" /> {downloading ? "Preparing\u2026" : "Download PNG"}
        </Button>
        <ShareButtons
          url={publicUrl}
          text={`${issue.description} \u2014 ${issue.public_id} on JanFix Mangaluru`}
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
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-xs font-medium hover:bg-accent"
        >
          <Share2 className="h-3.5 w-3.5" /> {l.label}
        </a>
      ))}
    </>
  );
}
