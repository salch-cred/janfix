import { useEffect, useRef, useState } from "react";
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
          style={{
            width: dims.w * scale,
            height: dims.h * scale,
            overflow: "hidden",
          }}
          className="mx-auto"
        >
          <div
            ref={posterRef}
            style={{
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
            }}
          >
            {/* Issue photo dominant */}
            <div
              style={{
                flex: isHorizontal ? "0 0 55%" : "0 0 auto",
                width: isHorizontal ? undefined : "100%",
                height: isHorizontal ? "100%" : "55%",
                borderRadius: 28,
                overflow: "hidden",
                background: "#1f2937",
                boxShadow: "0 24px 60px rgba(0,0,0,.45)",
                position: "relative",
              }}
            >
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : null}
              <div
                style={{
                  position: "absolute",
                  left: 24,
                  top: 24,
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: cat.color ?? "#1d4ed8",
                  fontWeight: 800,
                  fontSize: 22,
                  letterSpacing: ".04em",
                  textTransform: "uppercase",
                }}
              >
                {cat.name_en}
              </div>
              <div
                style={{
                  position: "absolute",
                  right: 24,
                  bottom: 24,
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: "rgba(0,0,0,.55)",
                  backdropFilter: "blur(6px)",
                  fontWeight: 700,
                  fontSize: 22,
                  letterSpacing: ".05em",
                }}
              >
                {status.label.toUpperCase()}
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    background: "#1d4ed8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 28,
                  }}
                >
                  J
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                      fontWeight: 800,
                      fontSize: 36,
                      lineHeight: 1,
                    }}
                  >
                    JanFix
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 18, marginTop: 4 }}>Mangaluru</div>
                </div>
              </div>

              <div
                style={{
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                  fontWeight: 800,
                  fontSize: isHorizontal ? 44 : 56,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                }}
              >
                {issue.description}
              </div>

              <div
                style={{ display: "flex", flexWrap: "wrap", gap: 16, opacity: 0.9, fontSize: 22 }}
              >
                <div>
                  📍 {[issue.area, issue.locality].filter(Boolean).join(", ") || "Mangaluru"}
                </div>
                <div>🆔 {issue.public_id}</div>
              </div>

              {issue.authority && (
                <div
                  style={{
                    marginTop: "auto",
                    padding: 20,
                    borderRadius: 20,
                    background: "rgba(255,255,255,.08)",
                    border: "1px solid rgba(255,255,255,.12)",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt=""
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 14,
                        objectFit: "cover",
                        background: "white",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 14,
                        background: "rgba(255,255,255,.15)",
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 16,
                        opacity: 0.65,
                        textTransform: "uppercase",
                        letterSpacing: ".1em",
                      }}
                    >
                      Assigned to
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 26, marginTop: 2 }}>
                      {issue.authority.name}
                    </div>
                  </div>
                  {repSrc && (
                    <img
                      src={repSrc}
                      alt=""
                      style={{ width: 56, height: 56, borderRadius: 999, objectFit: "cover" }}
                    />
                  )}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                {qr && (
                  <img
                    src={qr}
                    alt="QR"
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 14,
                      background: "white",
                      padding: 8,
                    }}
                  />
                )}
                <div style={{ fontSize: 18, opacity: 0.85 }}>
                  Scan to view live status
                  <br />
                  <span style={{ opacity: 0.7 }}>janfix.mangaluru</span>
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
    {
      label: "Twitter",
      href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`,
    },
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
