import { useEffect, useRef, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Download, Share2 } from "lucide-react";
import { STATUS_META, categoryBySlug } from "@/lib/civic";

type IssueLike = {
  public_id: string;
  description: string;
  status: keyof typeof STATUS_META;
  severity: string;
  area: string | null;
  locality: string | null;
  image_url: string | null;
  category?: { slug: string; name_en: string; color: string | null } | null;
  authority?: { name: string; logo_url: string | null } | null;
  representative?: { name: string; role: string; photo_url: string | null } | null;
};

const SIZES = {
  instagram: { w: 1080, h: 1350, label: "Instagram Post" },
  story: { w: 1080, h: 1920, label: "Story / Reel" },
  twitter: { w: 1200, h: 675, label: "Twitter / X" },
  linkedin: { w: 1200, h: 627, label: "LinkedIn" },
  facebook: { w: 1200, h: 630, label: "Facebook" },
  whatsapp: { w: 1080, h: 1080, label: "WhatsApp" },
} as const;

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
  const dims = SIZES[size];

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
      backgroundColor: "#0b1220",
    });
    const a = document.createElement("a");
    a.href = data;
    a.download = `JanFix-${issue.public_id}-${size}.png`;
    a.click();
  };

  const isHorizontal = dims.w > dims.h;
  const scale = 360 / dims.w; // preview width 360px

  const previewFrameStyle: CSSProperties = { width: dims.w * scale, height: dims.h * scale };
  const posterOuterStyle: CSSProperties = {
    width: dims.w,
    height: dims.h,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    background: "linear-gradient(160deg,#0b1220 0%,#0f1d3a 55%,#102a4d 100%)",
    color: "white",
    fontFamily: "Inter, sans-serif",
    position: "relative",
    padding: isHorizontal ? 56 : 64,
    display: "flex",
    flexDirection: isHorizontal ? "row" : "column",
    gap: 36,
  };
  const photoWrapStyle: CSSProperties = {
    position: "relative",
    flex: isHorizontal ? "0 0 45%" : "0 0 55%",
    borderRadius: 28,
    overflow: "hidden",
    background: "#0a0f1e",
  };
  const photoImgStyle: CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
  const photoCategoryBadgeStyle: CSSProperties = {
    position: "absolute",
    top: 24,
    left: 24,
    background: cat.color ?? "#64748b",
    color: "white",
    padding: "8px 18px",
    borderRadius: 999,
    fontSize: 22,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  };
  const photoStatusBadgeStyle: CSSProperties = {
    position: "absolute",
    bottom: 24,
    left: 24,
    background: "rgba(0,0,0,0.55)",
    color: "white",
    padding: "8px 18px",
    borderRadius: 999,
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 1,
  };
  const contentColumnStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 28,
    minWidth: 0,
  };
  const brandRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 16 };
  const brandMarkStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    height: 56,
    borderRadius: 16,
    background: "#2563eb",
    fontSize: 28,
    fontWeight: 800,
  };
  const brandNameStyle: CSSProperties = { fontSize: 28, fontWeight: 800, lineHeight: 1 };
  const brandSubStyle: CSSProperties = { fontSize: 16, opacity: 0.6, marginTop: 2 };
  const descriptionStyle: CSSProperties = {
    fontSize: isHorizontal ? 34 : 40,
    fontWeight: 800,
    lineHeight: 1.25,
  };
  const metaRowStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 20,
    opacity: 0.8,
  };
  const authorityRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "16px 18px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.08)",
  };
  const authorityLogoStyle: CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 12,
    objectFit: "cover",
    background: "white",
  };
  const authorityLogoPlaceholderStyle: CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "rgba(255,255,255,0.15)",
  };
  const authorityTextStyle: CSSProperties = { flex: 1, minWidth: 0 };
  const authorityLabelStyle: CSSProperties = {
    fontSize: 14,
    opacity: 0.6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  };
  const authorityNameStyle: CSSProperties = { fontSize: 20, fontWeight: 700 };
  const repPhotoStyle: CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 999,
    objectFit: "cover",
    border: "2px solid rgba(255,255,255,0.4)",
  };
  const qrRowStyle: CSSProperties = {
    marginTop: "auto",
    display: "flex",
    alignItems: "center",
    gap: 18,
    paddingTop: 24,
    borderTop: "1px solid rgba(255,255,255,0.15)",
  };
  const qrImageStyle: CSSProperties = {
    width: 96,
    height: 96,
    borderRadius: 12,
    background: "white",
    padding: 6,
  };
  const qrCaptionStyle: CSSProperties = { fontSize: 16, opacity: 0.7, lineHeight: 1.4 };
  const qrDomainStyle: CSSProperties = { fontWeight: 700, opacity: 1, color: "white" };

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
        <div
          style={previewFrameStyle}
          className="mx-auto"
        >
          <div
            ref={posterRef}
            style={posterOuterStyle}
          >
            {/* Issue photo dominant */}
            <div
              style={photoWrapStyle}
            >
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt=""
                  style={photoImgStyle}
                />
              ) : null}
              <div
                style={photoCategoryBadgeStyle}
              >
                {cat.name_en}
              </div>
              <div
                style={photoStatusBadgeStyle}
              >
                {status.label.toUpperCase()}
              </div>
            </div>

            <div style={contentColumnStyle}>
              <div style={brandRowStyle}>
                <div
                  style={brandMarkStyle}
                >
                  J
                </div>
                <div>
                  <div
                    style={brandNameStyle}
                  >
                    JanFix
                  </div>
                  <div style={brandSubStyle}>Mangaluru</div>
                </div>
              </div>

              <div
                style={descriptionStyle}
              >
                {issue.description}
              </div>

              <div
                style={metaRowStyle}
              >
                <div>
                  📍 {[issue.area, issue.locality].filter(Boolean).join(", ") || "Mangaluru"}
                </div>
                <div>🆔 {issue.public_id}</div>
              </div>

              {issue.authority && (
                <div
                  style={authorityRowStyle}
                >
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt=""
                      style={authorityLogoStyle}
                    />
                  ) : (
                    <div
                      style={authorityLogoPlaceholderStyle}
                    />
                  )}
                  <div style={authorityTextStyle}>
                    <div
                      style={authorityLabelStyle}
                    >
                      Assigned to
                    </div>
                    <div style={authorityNameStyle}>
                      {issue.authority.name}
                    </div>
                  </div>
                  {repSrc && (
                    <img
                      src={repSrc}
                      alt=""
                      style={repPhotoStyle}
                    />
                  )}
                </div>
              )}

              <div style={qrRowStyle}>
                {qr && (
                  <img
                    src={qr}
                    alt="QR"
                    style={qrImageStyle}
                  />
                )}
                <div style={qrCaptionStyle}>
                  Scan to view live status
                  <br />
                  <span style={qrDomainStyle}>janfix.mangaluru</span>
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
          text={`${issue.description} — ${issue.public_id} on JanFix Mangaluru`}
        />
      </div>
    </div>
  );
}

function ShareButtons({ url, text }: { url: string; text: string }) {
  const enc = encodeURIComponent;
  const links = [
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(text + " " + url)}` },
    { label: "Twitter", href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
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
