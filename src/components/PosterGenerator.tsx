import { useEffect, useRef, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
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
  Settings2,
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
  in_progress: { bg: "#fbbf24", fg: "#78350f" },
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
          const res = await fetch(url);
          const blob = await res.blob();
          if (!cancelled) {
            cache.current.set(url, URL.createObjectURL(blob));
            setTick((t) => t + 1);
          }
        } catch {
          // fallback: keep original URL
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
    if (!posterRef.current) return;
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
    a.click();
  };

  const scale = 360 / dims.w; // preview width 360px

  const locationLabel =
    [issue.area, issue.locality].filter(Boolean).join(", ") || issue.address || "Mangaluru";
  const wardLabel = issue.ward ? `Ward ${issue.ward.number}` : "\u2014";
  const reportedDate = issue.created_at ? new Date(issue.created_at) : null;
  const reportedDateLabel = reportedDate
    ? reportedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "\u2014";
  const reportedTimeLabel = reportedDate
    ? reportedDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : "";
  const supportsCount = issue.supporters_count ?? 0;
  const viewsCount = issue.views ?? 0;
  const idTail = issue.public_id.includes("-")
    ? issue.public_id.split("-").pop()
    : issue.public_id;
  const shortLink = `janfix.in/${idTail}`;

  const previewFrameStyle: CSSProperties = { width: dims.w * scale, height: dims.h * scale };
  const posterOuterStyle: CSSProperties = {
    width: dims.w,
    height: dims.h,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    background: "#ffffff",
    color: "#0f172a",
    fontFamily: "Inter, sans-serif",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    border: "10px solid #1d4ed8",
    overflow: "hidden",
  };

  const headerBarStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    padding: isHorizontal ? "18px 28px" : "24px 32px",
    borderBottom: "2px solid #e2e8f0",
    flexShrink: 0,
  };
  const brandRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 14 };
  const brandMarkStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: isHorizontal ? 40 : 52,
    height: isHorizontal ? 40 : 52,
    borderRadius: 16,
    background: "#1d4ed8",
    color: "white",
    fontSize: isHorizontal ? 18 : 22,
    fontWeight: 800,
    flexShrink: 0,
  };
  const brandTitleStyle: CSSProperties = {
    fontSize: isHorizontal ? 20 : 26,
    fontWeight: 800,
    lineHeight: 1.1,
    color: "#0f172a",
  };
  const brandGreenStyle: CSSProperties = { color: "#16a34a" };
  const brandTaglineStyle: CSSProperties = {
    fontSize: isHorizontal ? 11 : 13,
    color: "#64748b",
    fontWeight: 600,
    marginTop: 2,
  };
  const sloganBlockStyle: CSSProperties = {
    textAlign: "right",
    flexShrink: 0,
  };
  const sloganTitleStyle: CSSProperties = {
    fontSize: isHorizontal ? 16 : 20,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.2,
  };
  const sloganKannadaStyle: CSSProperties = {
    fontSize: isHorizontal ? 11 : 13,
    color: "#16a34a",
    fontWeight: 700,
    marginTop: 2,
  };
  const sloganSubStyle: CSSProperties = {
    fontSize: isHorizontal ? 10 : 12,
    color: "#64748b",
    marginTop: 2,
  };

  const bodyRowStyle: CSSProperties = {
    display: "flex",
    flexDirection: isHorizontal ? "row" : "column",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  };
  const photoWrapStyle: CSSProperties = {
    position: "relative",
    flex: isHorizontal ? "0 0 42%" : "0 0 44%",
    overflow: "hidden",
    background: "#0a0f1e",
    minHeight: 0,
  };
  const photoImgStyle: CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
  const idBadgeStyle: CSSProperties = {
    position: "absolute",
    top: 20,
    left: 20,
    background: "#dc2626",
    color: "white",
    padding: "8px 16px",
    borderRadius: 10,
    lineHeight: 1.15,
  };
  const idBadgeLabelStyle: CSSProperties = {
    fontSize: 11,
    letterSpacing: 1,
    opacity: 0.85,
    fontWeight: 700,
  };
  const idBadgeValueStyle: CSSProperties = { fontSize: 18, fontWeight: 800, marginTop: 2 };
  const statusBadgeStyle: CSSProperties = {
    position: "absolute",
    top: 20,
    right: 20,
    background: statusColors.bg,
    color: statusColors.fg,
    padding: "8px 16px",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
  };
  const statusBadgeTextWrapStyle: CSSProperties = { lineHeight: 1.15 };
  const statusBadgeLabelStyle: CSSProperties = {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: 700,
    opacity: 0.85,
  };
  const statusBadgeValueStyle: CSSProperties = { fontSize: 14, fontWeight: 800, marginTop: 1 };

  const contentColumnStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
  };
  const titleDescBlockStyle: CSSProperties = {
    padding: isHorizontal ? "18px 26px 12px" : "24px 32px 16px",
    flexShrink: 0,
  };
  const categoryTitleStyle: CSSProperties = {
    fontSize: isHorizontal ? 26 : 36,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#0f172a",
    lineHeight: 1.05,
  };
  const descriptionStyle: CSSProperties = {
    marginTop: 8,
    fontSize: isHorizontal ? 13 : 17,
    color: "#475569",
    lineHeight: 1.4,
  };

  const infoBarStyle: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    background: "#eff6ff",
    borderTop: "1px solid #e2e8f0",
    borderBottom: "1px solid #e2e8f0",
    padding: isHorizontal ? "12px 26px" : "16px 32px",
    gap: isHorizontal ? 16 : 20,
    flexShrink: 0,
  };
  const infoItemStyle: CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    flex: "1 1 auto",
    minWidth: 90,
  };
  const infoIconWrapStyle: CSSProperties = { color: "#1d4ed8", marginTop: 2, flexShrink: 0 };
  const infoLabelStyle: CSSProperties = {
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#64748b",
    fontWeight: 700,
  };
  const infoValueStyle: CSSProperties = {
    fontSize: isHorizontal ? 12 : 14,
    fontWeight: 700,
    color: "#0f172a",
    marginTop: 1,
  };

  const peopleRowStyle: CSSProperties = {
    display: "flex",
    padding: isHorizontal ? "12px 26px" : "16px 32px",
    gap: 16,
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    flexShrink: 0,
  };
  const personBlockStyle: CSSProperties = { flex: 1, minWidth: 0 };
  const personLabelStyle: CSSProperties = {
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#1d4ed8",
    fontWeight: 800,
    marginBottom: 6,
  };
  const personRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10 };
  const personLogoStyle: CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 10,
    objectFit: "contain",
    background: "white",
    border: "1px solid #e2e8f0",
    flexShrink: 0,
  };
  const personPhotoStyle: CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 999,
    objectFit: "cover",
    border: "2px solid #1d4ed8",
    flexShrink: 0,
  };
  const personPlaceholderStyle: CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: "#e2e8f0",
    flexShrink: 0,
  };
  const personTextWrapStyle: CSSProperties = { minWidth: 0 };
  const personNameStyle: CSSProperties = {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
  const personSubStyle: CSSProperties = { fontSize: 11, color: "#64748b", marginTop: 1 };
  const personPhoneRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  };

  const footerSectionStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: isHorizontal ? "16px 26px" : "22px 32px",
    background: "linear-gradient(135deg,#1d4ed8 0%,#1e3a8a 100%)",
    color: "white",
    minHeight: 0,
  };
  const footerLeftStyle: CSSProperties = { minWidth: 180, flex: "1 1 220px" };
  const footerLineOneStyle: CSSProperties = {
    fontSize: isHorizontal ? 15 : 19,
    fontWeight: 800,
    color: "white",
    lineHeight: 1.2,
  };
  const footerLineTwoStyle: CSSProperties = {
    fontSize: isHorizontal ? 15 : 19,
    fontWeight: 800,
    color: "#fbbf24",
    lineHeight: 1.2,
  };
  const footerSubTextStyle: CSSProperties = {
    marginTop: 8,
    fontSize: 11,
    opacity: 0.85,
    maxWidth: 260,
    lineHeight: 1.4,
  };
  const footerRightStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 10,
  };
  const voteButtonsRowStyle: CSSProperties = { display: "flex", gap: 8 };
  const voteButtonFixedStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#16a34a",
    color: "white",
    borderRadius: 999,
    padding: "8px 14px",
  };
  const voteButtonExistsStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#dc2626",
    color: "white",
    borderRadius: 999,
    padding: "8px 14px",
  };
  const voteButtonTextWrapStyle: CSSProperties = { lineHeight: 1.15 };
  const voteButtonTitleStyle: CSSProperties = { fontSize: 11, fontWeight: 800 };
  const voteButtonSubStyle: CSSProperties = { fontSize: 9, opacity: 0.85 };
  const qrBoxStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "white",
    borderRadius: 14,
    padding: 12,
  };
  const qrImageStyle: CSSProperties = { width: 64, height: 64, borderRadius: 8 };
  const qrTextTitleStyle: CSSProperties = { fontSize: 11, fontWeight: 800, color: "#0f172a" };
  const qrTextSubStyle: CSSProperties = { fontSize: 10, color: "#64748b", marginTop: 1 };
  const qrTextLinkStyle: CSSProperties = { fontSize: 12, fontWeight: 800, color: "#1d4ed8", marginTop: 1 };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(SIZES) as (keyof typeof SIZES)[]).map((k) => (
          <button
            key={k}
            onClick={() => setSize(k)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              size === k
                ? "bg-primary text-primary-foreground"
                : "border bg-card text-muted-foreground"
            }`}
          >
            {SIZES[k].label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-muted/40 p-3">
        <div style={previewFrameStyle} className="mx-auto">
          <div ref={posterRef} style={posterOuterStyle}>
            <div style={headerBarStyle}>
              <div style={brandRowStyle}>
                <div style={brandMarkStyle}>J</div>
                <div>
                  <div style={brandTitleStyle}>
                    Jan<span style={brandGreenStyle}>Fix</span>
                  </div>
                  <div style={brandTaglineStyle}>Report. Track. Fix.</div>
                </div>
              </div>
              <div style={sloganBlockStyle}>
                <div style={sloganTitleStyle}>Let's Fix Mangaluru</div>
                <div style={sloganKannadaStyle}>ನಮ್ಮ ಮಂಗಳೂರು, ನಮ್ಮ ಜವಾಬ್ದಾರಿ</div>
                <div style={sloganSubStyle}>Together for a Better City</div>
              </div>
            </div>

            <div style={bodyRowStyle}>
              <div style={photoWrapStyle}>
                {imgSrc ? <img src={imgSrc} alt="" style={photoImgStyle} /> : null}
                <div style={idBadgeStyle}>
                  <div style={idBadgeLabelStyle}>ISSUE ID</div>
                  <div style={idBadgeValueStyle}>{issue.public_id}</div>
                </div>
                <div style={statusBadgeStyle}>
                  <Settings2 size={16} />
                  <div style={statusBadgeTextWrapStyle}>
                    <div style={statusBadgeLabelStyle}>STATUS</div>
                    <div style={statusBadgeValueStyle}>{status.label.toUpperCase()}</div>
                  </div>
                </div>
              </div>

              <div style={contentColumnStyle}>
                <div style={titleDescBlockStyle}>
                  <div style={categoryTitleStyle}>{cat.name_en}</div>
                  <div style={descriptionStyle}>{issue.description}</div>
                </div>

                <div style={infoBarStyle}>
                  <div style={infoItemStyle}>
                    <div style={infoIconWrapStyle}>
                      <MapPin size={16} />
                    </div>
                    <div>
                      <div style={infoLabelStyle}>Location</div>
                      <div style={infoValueStyle}>{locationLabel}</div>
                    </div>
                  </div>
                  <div style={infoItemStyle}>
                    <div style={infoIconWrapStyle}>
                      <Building2 size={16} />
                    </div>
                    <div>
                      <div style={infoLabelStyle}>Ward</div>
                      <div style={infoValueStyle}>{wardLabel}</div>
                    </div>
                  </div>
                  <div style={infoItemStyle}>
                    <div style={infoIconWrapStyle}>
                      <CalendarDays size={16} />
                    </div>
                    <div>
                      <div style={infoLabelStyle}>Reported On</div>
                      <div style={infoValueStyle}>
                        {reportedDateLabel}
                        {reportedTimeLabel ? ` \u00b7 ${reportedTimeLabel}` : ""}
                      </div>
                    </div>
                  </div>
                  <div style={infoItemStyle}>
                    <div style={infoIconWrapStyle}>
                      <Eye size={16} />
                    </div>
                    <div>
                      <div style={infoLabelStyle}>Supports</div>
                      <div style={infoValueStyle}>
                        {supportsCount} \u00b7 views {viewsCount}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={peopleRowStyle}>
                  <div style={personBlockStyle}>
                    <div style={personLabelStyle}>Responsible Authority</div>
                    <div style={personRowStyle}>
                      {logoSrc ? (
                        <img src={logoSrc} alt="" style={personLogoStyle} />
                      ) : (
                        <div style={personPlaceholderStyle} />
                      )}
                      <div style={personTextWrapStyle}>
                        <div style={personNameStyle}>{issue.authority?.name ?? "Unassigned"}</div>
                        {(issue.authority?.department || issue.authority?.type) && (
                          <div style={personSubStyle}>
                            {[issue.authority?.department, issue.authority?.type]
                              .filter(Boolean)
                              .join(" \u00b7 ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {issue.representative && (
                    <div style={personBlockStyle}>
                      <div style={personLabelStyle}>Local Representative</div>
                      <div style={personRowStyle}>
                        {repSrc ? (
                          <img src={repSrc} alt="" style={personPhotoStyle} />
                        ) : (
                          <div style={personPlaceholderStyle} />
                        )}
                        <div style={personTextWrapStyle}>
                          <div style={personNameStyle}>{issue.representative.name}</div>
                          <div style={personSubStyle}>{issue.representative.role}</div>
                          {issue.representative.phone && (
                            <div style={personPhoneRowStyle}>
                              <Phone size={10} /> {issue.representative.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={footerSectionStyle}>
                  <div style={footerLeftStyle}>
                    <div style={footerLineOneStyle}>Your Small Report</div>
                    <div style={footerLineTwoStyle}>Can Create a Big Change!</div>
                    <div style={footerSubTextStyle}>
                      Vote, share and help make Mangaluru a better place to live.
                    </div>
                  </div>
                  <div style={footerRightStyle}>
                    <div style={voteButtonsRowStyle}>
                      <div style={voteButtonFixedStyle}>
                        <ThumbsUp size={14} />
                        <div style={voteButtonTextWrapStyle}>
                          <div style={voteButtonTitleStyle}>ISSUE FIXED</div>
                          <div style={voteButtonSubStyle}>Vote if resolved</div>
                        </div>
                      </div>
                      <div style={voteButtonExistsStyle}>
                        <ThumbsDown size={14} />
                        <div style={voteButtonTextWrapStyle}>
                          <div style={voteButtonTitleStyle}>STILL EXISTS</div>
                          <div style={voteButtonSubStyle}>Vote if it persists</div>
                        </div>
                      </div>
                    </div>
                    <div style={qrBoxStyle}>
                      {qr && <img src={qr} alt="QR" style={qrImageStyle} />}
                      <div>
                        <div style={qrTextTitleStyle}>SCAN TO VIEW & SUPPORT</div>
                        <div style={qrTextSubStyle}>this issue or visit</div>
                        <div style={qrTextLinkStyle}>{shortLink}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={download} className="gap-2">
          <Download className="h-4 w-4" /> Download PNG
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
