import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { IssueMap } from "@/components/IssueMap";
import { CATEGORIES, SEVERITY_META, slugify, trustBadge } from "@/lib/civic";
import { reverseGeocode, getPositionWithFallback, forwardGeocode, isLocationInDakshinaKannada } from "@/lib/geo";
import { computeImagePHash, hammingHex } from "@/lib/phash";
import { getDeviceId, getDeviceName, setDeviceName } from "@/lib/device";
import { supabase } from "@/integrations/supabase/client";
import { createIssueFn, findDuplicatesFn, supportIssueFn, uploadPhotoFn, previewAssignmentFn } from "@/lib/issues.functions";
import { listAuthoritiesFn, listRepresentativesFn } from "@/lib/queries.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Camera, MapPin, Loader2, CheckCircle2, AlertTriangle, X, ImagePlus, Building2, Sparkles } from "lucide-react";
import { classifyImage, warmupClassifier } from "@/lib/imageClassifier";

export const Route = createFileRoute("/report")({
  component: ReportPage,
  ssr: false,
  pendingComponent: () => <div className="min-h-screen" />,
});

type Step = "photo" | "details" | "review" | "dupes";

const MAX_EXTRA_PHOTOS = 3;

function promptPosterShare() {
  // Give the route transition a moment to finish before nudging the user
  // towards the poster/share section of the newly-created issue page.
  setTimeout(() => {
    toast.message("Download your poster & share it \ud83d\udce3", {
      description:
        "Get more support for your report — download a shareable poster and post it on WhatsApp, Instagram, or Twitter.",
      duration: 8000,
      action: {
        label: "View poster",
        onClick: () => {
          document
            .getElementById("poster-share")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      },
    });
  }, 700);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function ReportPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [phash, setPhash] = useState<string>("");
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [addr, setAddr] = useState<{
    address: string;
    area: string | null;
    locality: string | null;
    pincode: string | null;
  } | null>(null);
  const [cat, setCat] = useState<string>("");
  const [sev, setSev] = useState<keyof typeof SEVERITY_META>("medium");
  const [desc, setDesc] = useState<string>("");
  const [name, setName] = useState<string>(
    typeof window !== "undefined" ? (getDeviceName() ?? "") : "",
  );
  const [working, setWorking] = useState(false);
  const [dupes, setDupes] = useState<any[]>([]);
  const [reportCount, setReportCount] = useState<number>(0);
  const [customAuthId, setCustomAuthId] = useState<number | null>(null);
  const [customRepId, setCustomRepId] = useState<number | null>(null);
  // AI classification state
  const [aiSuggestion, setAiSuggestion] = useState<{ slug: string; confidence: number } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const authoritiesQuery = useQuery({
    queryKey: ["authorities-list"],
    queryFn: () => listAuthoritiesFn(),
    enabled: step === "review",
  });
  const representativesQuery = useQuery({
    queryKey: ["representatives-list"],
    queryFn: () => listRepresentativesFn(),
    enabled: step === "review",
  });
  const assignmentPreviewQuery = useQuery({
    queryKey: ["assignment-preview", cat, loc?.lat, loc?.lng, addr?.address, addr?.area, addr?.locality],
    queryFn: () =>
      previewAssignmentFn({
        data: {
          category_slug: cat,
          lat: loc?.lat ?? 0,
          lng: loc?.lng ?? 0,
          address: addr?.address,
          area: addr?.area,
          locality: addr?.locality,
        },
      }),
    enabled: step === "review" && !!cat && !!loc,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const id = getDeviceId();
      if (!id) return;
      try {
        const { rows } = await fetch("/api/device-count?device_id=" + encodeURIComponent(id))
          .then((r) => r.json())
          .catch(() => ({ rows: [] }));
        setReportCount((rows?.[0] as any)?.report_count ?? 0);
      } catch {
        // ignore — count is just cosmetic
      }
    })();
    // Warm up GPS immediately
    getGPS();
    // Warm up the TF model in the background so it's ready when needed
    warmupClassifier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeRevokeObjectURL = (url: string | null | undefined) => {
    if (!url) return;
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn("Failed to revoke object URL:", url, e);
    }
  };

  const previewRef = useRef(preview);
  const extraPreviewsRef = useRef(extraPreviews);
  useEffect(() => {
    previewRef.current = preview;
    extraPreviewsRef.current = extraPreviews;
  }, [preview, extraPreviews]);

  useEffect(() => {
    return () => {
      safeRevokeObjectURL(previewRef.current);
      extraPreviewsRef.current.forEach((url) => {
        safeRevokeObjectURL(url);
      });
    };
  }, []);

  const onPickFile = async (f: File) => {
    setWorking(true);
    setAiSuggestion(null);
    try {
      const compressed = await imageCompression(f, {
        maxSizeMB: 1.2,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.85,
      });

      // Run AI classification
      setAiLoading(true);
      const aiResult = await classifyImage(compressed).catch((err) => {
        console.error("TensorFlow error:", err);
        return null;
      });
      setAiLoading(false);

      if (aiResult?.isRejected) {
        toast.error(aiResult.rejectReason || "Photo rejected. Please upload a clear photo of the civic issue.");
        return;
      }

      setFile(compressed);
      setPreview((prevUrl) => {
        safeRevokeObjectURL(prevUrl);
        return URL.createObjectURL(compressed);
      });
      const ph = await computeImagePHash(compressed);
      setPhash(ph);
      // try GPS in parallel
      getGPS();
      setStep("details");

      if (aiResult?.slug && aiResult.confidence > 0.12) {
        setAiSuggestion({ slug: aiResult.slug, confidence: aiResult.confidence });
        setCat(aiResult.slug); // Automatically select it
      } else {
        // Fallback if TensorFlow ran but didn't strongly match, or if it errored out
        const fallbackSlug = "others";
        setAiSuggestion({ slug: fallbackSlug, confidence: aiResult ? Math.max(0.01, aiResult.confidence) : 0.01 });
        setCat(fallbackSlug); // Automatically select it
      }
    } catch (e: any) {
      toast.error("Could not process image: " + (e?.message ?? "unknown"));
    } finally {
      setWorking(false);
    }
  };

  const onPickExtraFile = async (f: File) => {
    if (extraFiles.length >= MAX_EXTRA_PHOTOS) {
      toast.error(`You can add up to ${MAX_EXTRA_PHOTOS} extra photos`);
      return;
    }
    setWorking(true);
    try {
      const compressed = await imageCompression(f, {
        maxSizeMB: 1.2,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.85,
      });

      const aiResult = await classifyImage(compressed).catch(() => null);
      if (aiResult?.isRejected) {
        toast.error(aiResult.rejectReason || "Photo rejected. Please upload a clear photo of the civic issue.");
        return;
      }

      setExtraFiles((prev) => [...prev, compressed]);
      setExtraPreviews((prev) => [...prev, URL.createObjectURL(compressed)]);
    } catch (e: any) {
      toast.error("Could not process image: " + (e?.message ?? "unknown"));
    } finally {
      setWorking(false);
    }
  };

  const removeExtraFile = (idx: number) => {
    safeRevokeObjectURL(extraPreviews[idx]);
    setExtraFiles((prev) => prev.filter((_, i) => i !== idx));
    setExtraPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const [gpsLoading, setGpsLoading] = useState(false);
  const [manualAddr, setManualAddr] = useState("");
  const [searchResults, setSearchResults] = useState<Awaited<ReturnType<typeof forwardGeocode>>>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = async () => {
    if (!manualAddr.trim()) return;
    setSearching(true);
    try {
      const res = await forwardGeocode(manualAddr + ", Dakshina Kannada");
      setSearchResults(res);
      if (res.length === 0) toast.error("No results found");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to search location");
    } finally {
      setSearching(false);
    }
  };

  const pickSearchResult = async (r: { lat: number; lng: number; address: string }) => {
    if (!isLocationInDakshinaKannada(r.lat, r.lng, r.address)) {
      toast.error("Location must be within Dakshina Kannada district. Bangalore and other districts are not supported.");
      return;
    }
    setLoc({ lat: r.lat, lng: r.lng });
    setSearchResults([]);
    setManualAddr(r.address);
    // reverse geocode to get proper area/locality breakdown
    const a = await reverseGeocode(r.lat, r.lng);
    setAddr(a);
    toast.success("Location set");
  };

  const getGPS = async () => {
    if (gpsLoading) return;
    setGpsLoading(true);
    try {
      const pos = await getPositionWithFallback();
      const a = await reverseGeocode(pos.lat, pos.lng);
      if (!isLocationInDakshinaKannada(pos.lat, pos.lng, a.address)) {
        toast.error("Your current location is outside Dakshina Kannada district. Please search or pin location manually within Dakshina Kannada.");
        return;
      }
      setLoc({ lat: pos.lat, lng: pos.lng });
      setAddr(a);
      toast.success("Location acquired");
    } catch (e: any) {
      toast.error(e.message ?? "Could not get location");
    } finally {
      setGpsLoading(false);
    }
  };

  const goReview = async () => {
    if (!cat) return toast.error("Choose a category");
    if (!loc) return toast.error("Capture your location first");
    if (desc.trim().length < 5) return toast.error("Describe the issue briefly");
    setWorking(true);
    try {
      const { candidates } = await findDuplicatesFn({
        data: {
          category_slug: cat,
          lat: loc.lat,
          lng: loc.lng,
          description: desc,
          image_phash: phash || null,
        },
      });
      
      if (candidates && candidates.length > 0) {
        setDupes(candidates);
        setStep("dupes");
      } else {
        setStep("review");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Error checking for duplicate reports");
    } finally {
      setWorking(false);
    }
  };

  const submit = async () => {
    if (!file || !loc || !cat) return;
    setWorking(true);
    try {
      if (name) setDeviceName(name);
      const device_id = getDeviceId();
      const filename = `${device_id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

      // Convert primary photo File → base64 → server upload to Vercel Blob
      const base64 = await fileToBase64(file);
      const { url: image_url } = await uploadPhotoFn({ data: { base64, filename } });

      // Upload any optional extra photos alongside the required primary one.
      const extra_image_urls = await Promise.all(
        extraFiles.map(async (ef, idx) => {
          const xFilename = `${device_id}-${Date.now()}-x${idx}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          const xBase64 = await fileToBase64(ef);
          const { url } = await uploadPhotoFn({ data: { base64: xBase64, filename: xFilename } });
          return url;
        }),
      );

      const res = await createIssueFn({
        data: {
          device_id,
          category_slug: cat,
          description: desc.trim(),
          severity: sev,
          lat: loc.lat,
          lng: loc.lng,
          address: addr?.address ?? null,
          area: addr?.area ?? null,
          locality: addr?.locality ?? null,
          pincode: addr?.pincode ?? null,
          ward_id: null,
          image_url,
          image_phash: phash || null,
          extra_image_urls: extra_image_urls.length > 0 ? extra_image_urls : null,
          assigned_authority_id: customAuthId,
          assigned_representative_id: customRepId,
        },
      });
      toast.success("Reported! Tracking " + res.public_id);
      navigate({
        to: "/issue/$publicId/$slug",
        params: { publicId: res.public_id, slug: res.slug || slugify(desc) },
      });
      promptPosterShare();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit");
    } finally {
      setWorking(false);
    }
  };

  const supportExisting = async (issue_id: string) => {
    setWorking(true);
    try {
      const device_id = getDeviceId();
      await supportIssueFn({ data: { issue_id, device_id } });
      const found = dupes.find((d) => d.id === issue_id);
      toast.success("Added your support");
      if (found)
        navigate({
          to: "/issue/$publicId/$slug",
          params: { publicId: found.public_id, slug: found.slug ?? "issue" },
        });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add support to the existing report");
    } finally {
      setWorking(false);
    }
  };

  const badge = trustBadge(reportCount);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">Report an issue</h1>
            <p className="text-xs text-muted-foreground">No login. Takes under a minute.</p>
          </div>
          {reportCount > 0 && (
            <div className="rounded-full border bg-card px-3 py-1.5 text-xs">
              <span className="mr-1">{badge.icon}</span>
              <span className="font-semibold">{badge.label}</span>
              <span className="ml-1 text-muted-foreground">· {reportCount}</span>
            </div>
          )}
        </header>

        <Stepper step={step} />

        {step === "photo" && (
          <div className="mt-6 space-y-4">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed bg-card p-10 text-center transition hover:bg-accent/40"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Camera className="h-8 w-8" />
              </div>
              <div>
                <div className="font-display text-lg font-semibold">Take a photo</div>
                <div className="text-xs text-muted-foreground">
                  JPEG · compressed to ~1MB · location read from your device
                </div>
              </div>
              {working && <Loader2 className="h-4 w-4 animate-spin" />}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickFile(f);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {(step === "details" || step === "review" || step === "dupes") && (
          <div className="mt-6 space-y-5">
            {/* Photo + location preview */}
            <div className="overflow-hidden rounded-2xl border bg-card">
              {preview && <img src={preview} alt="" className="aspect-[4/3] w-full object-cover" />}
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {loc
                      ? addr?.address
                        ? addr.address.split(",").slice(0, 3).join(",")
                        : `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`
                      : gpsLoading ? "Getting location…" : "Tap Refresh GPS"}
                  </div>
                  <button onClick={getGPS} disabled={gpsLoading} className="font-medium text-primary disabled:opacity-50">
                    {gpsLoading ? "Getting GPS…" : "Refresh GPS"}
                  </button>
                </div>
                {loc && (
                  <IssueMap
                    height={180}
                    center={loc}
                    zoom={16}
                    marker={loc}
                    onClick={async (lat, lng) => {
                      const a = await reverseGeocode(lat, lng);
                      if (!isLocationInDakshinaKannada(lat, lng, a.address)) {
                        toast.error("Pinned location is outside Dakshina Kannada district. Please pin within Mangaluru / surrounding local areas.");
                        return;
                      }
                      setLoc({ lat, lng });
                      setAddr(a);
                    }}
                  />
                )}
              </div>
            </div>

            {step === "details" && (
              <>
                {/* Manual location search */}
                <div className="rounded-2xl border bg-card p-3">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Or type your location
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={manualAddr}
                      onChange={(e) => setManualAddr(e.target.value)}
                      placeholder="E.g. Hampankatta, Mangaluru"
                      onKeyDown={(e) => e.key === "Enter" && doSearch()}
                    />
                    <Button size="sm" onClick={doSearch} disabled={searching}>
                      {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                    </Button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                      {searchResults.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => pickSearchResult(r)}
                          className="w-full rounded-lg p-2 text-left text-xs transition hover:bg-accent"
                        >
                          {r.address.split(",").slice(0, 4).join(",")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Field label={`Add more photos (optional, up to ${MAX_EXTRA_PHOTOS})`}>
                  <div className="flex flex-wrap gap-2">
                    {extraPreviews.map((src, idx) => (
                      <div key={idx} className="relative h-16 w-16 overflow-hidden rounded-lg border">
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeExtraFile(idx)}
                          className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                    {extraFiles.length < MAX_EXTRA_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => extraInputRef.current?.click()}
                        className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground transition hover:bg-accent/40"
                      >
                        <ImagePlus className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  <input
                    ref={extraInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onPickExtraFile(f);
                      e.target.value = "";
                    }}
                  />
                </Field>

                <Field label="Category">
                  {/* AI suggestion banner */}
                  {(aiLoading || aiSuggestion) && (
                    <div className={`mb-3 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                      aiLoading
                        ? "border border-dashed border-primary/30 bg-primary/5 text-primary/70"
                        : "border border-primary/20 bg-primary/10 text-primary"
                    }`}>
                      {aiLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                          <span>Analysing photo with AI…</span>
                        </>
                      ) : aiSuggestion ? (
                        <>
                          <Sparkles className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            AI suggests: <strong>{CATEGORIES.find(c => c.slug === aiSuggestion.slug)?.name_en}</strong>
                            <span className="ml-1 opacity-70">({Math.round(aiSuggestion.confidence * 100)}% confidence)</span>
                          </span>
                          {cat !== aiSuggestion.slug && (
                            <button
                              type="button"
                              onClick={() => setCat(aiSuggestion.slug)}
                              className="ml-auto shrink-0 rounded-md bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary hover:bg-primary/30 transition"
                            >
                              Apply
                            </button>
                          )}
                          {cat === aiSuggestion.slug && (
                            <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />
                          )}
                        </>
                      ) : null}
                    </div>
                  )}
                  <div className="-mx-1 flex w-full flex-wrap gap-1.5">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={(e) => { e.preventDefault(); setCat(c.slug); }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          cat === c.slug
                            ? "border-transparent text-white"
                            : "bg-card text-muted-foreground"
                        }`}
                        style={cat === c.slug ? { background: c.color } : undefined}
                      >
                        {c.name_en}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Severity">
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.keys(SEVERITY_META) as (keyof typeof SEVERITY_META)[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={(e) => { e.preventDefault(); setSev(s); }}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                          sev === s
                            ? "border-primary bg-primary/10 text-primary"
                            : "bg-card text-muted-foreground"
                        }`}
                      >
                        {SEVERITY_META[s].label}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="What's the problem?">
                  <Textarea
                    rows={3}
                    placeholder="E.g. Large pothole near Forum Mall entrance, causing traffic jams"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value.slice(0, 250))}
                  />
                  <div className="mt-1 text-right text-[10px] text-muted-foreground">
                    {desc.length}/250
                  </div>
                </Field>

                <Field label="Your name (optional)">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Stays on your device"
                  />
                </Field>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep("photo")}>
                    Back
                  </Button>
                  <Button className="flex-1" onClick={goReview} disabled={working}>
                    {working ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
                  </Button>
                </div>
              </>
            )}

            {step === "dupes" && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
                  <div>
                    <div className="font-semibold">Looks similar to existing reports</div>
                    <div className="text-xs text-muted-foreground">
                      Add your voice to make it louder — or report anyway if it's different.
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {dupes.map((d) => (
                    <div key={d.id} className="flex gap-3 rounded-2xl border bg-card p-3">
                      {d.image_url && (
                        <img
                          src={d.image_url}
                          alt=""
                          className="h-20 w-20 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1 space-y-1">
                        <div className="text-sm font-semibold">{d.public_id}</div>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {d.description}
                        </p>
                        <div className="text-[11px] text-muted-foreground">
                          {Math.round(d._meters)} m away · {d.supporters_count ?? 0} supporters
                        </div>
                      </div>
                      <Button size="sm" onClick={() => supportExisting(d.id)} disabled={working}>
                        I saw it too
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep("details")}>
                    Back
                  </Button>
                  <Button className="flex-1" onClick={() => setStep("review")}>
                    Report anyway
                  </Button>
                </div>
              </div>
            )}

            {step === "review" && (
              <div className="space-y-4">
                <div className="rounded-2xl border bg-card p-4 text-sm space-y-3 shadow-sm">
                  <div className="flex items-center gap-2 text-success font-bold">
                    <CheckCircle2 className="h-4 w-4" /> Ready to submit
                  </div>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li>
                      Category: <span className="font-bold text-slate-800 dark:text-slate-100">{cat.toUpperCase()}</span>
                    </li>
                    <li>
                      Severity:{" "}
                      <span className="font-bold text-slate-800 dark:text-slate-100 uppercase">
                        {SEVERITY_META[sev].label}
                      </span>
                    </li>
                    <li>
                      Location:{" "}
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {addr?.address ?? `${loc?.lat.toFixed(5)}, ${loc?.lng.toFixed(5)}`}
                      </span>
                    </li>
                    {extraPreviews.length > 0 && (
                      <li>
                        Extra photos:{" "}
                        <span className="font-bold text-slate-800 dark:text-slate-100">{extraPreviews.length}</span>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Assignment & Routing Preview */}
                <div className="rounded-2xl border bg-card p-4 space-y-3.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-primary" /> Routing & Assignment
                    </h3>
                    <span className="text-[10px] bg-primary/10 text-primary font-extrabold uppercase px-2 py-0.5 rounded-full">
                      System Resolved
                    </span>
                  </div>

                  {assignmentPreviewQuery.isLoading ? (
                    <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Resolving nearest civic authority...
                    </div>
                  ) : assignmentPreviewQuery.data ? (
                    <div className="space-y-4">
                      {/* Authority Card */}
                      <div className="flex items-center gap-3.5 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        {assignmentPreviewQuery.data.authority?.logo_url ? (
                          <img
                            src={assignmentPreviewQuery.data.authority.logo_url}
                            alt=""
                            className="h-10 w-10 rounded-lg object-contain bg-white p-1 border shadow-sm"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-extrabold">
                            {(assignmentPreviewQuery.data.authority?.name ?? "M").slice(0, 1)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">Assigned Authority</div>
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                            {assignmentPreviewQuery.data.authority?.name ?? "Mangaluru City Corporation"}
                          </div>
                          {assignmentPreviewQuery.data.authority?.department && (
                            <div className="text-xs text-muted-foreground font-semibold mt-0.5">
                              {assignmentPreviewQuery.data.authority.department}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Representative Card */}
                      {assignmentPreviewQuery.data.representative && (
                        <div className="flex items-center gap-3.5 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                          {assignmentPreviewQuery.data.representative.photo_url ? (
                            <img
                              src={assignmentPreviewQuery.data.representative.photo_url}
                              alt=""
                              className="h-10 w-10 rounded-full object-cover border shadow-sm"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-extrabold">
                              {(assignmentPreviewQuery.data.representative.name).slice(0, 1)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">Local Representative</div>
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                              {assignmentPreviewQuery.data.representative.name}
                            </div>
                            <div className="text-xs text-muted-foreground font-semibold mt-0.5">
                              {assignmentPreviewQuery.data.representative.role}
                            </div>
                          </div>
                        </div>
                      )}



                      {/* Suggestion banner to escalate/route to MP or Minister */}
                      <div className="border-t pt-3 space-y-2">
                        <div className="rounded-xl border border-primary/10 bg-primary/5 p-3.5 space-y-2">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-primary" /> District-Level Escalation Suggestion
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Since this issue impacts the wider Dakshina Kannada district, you can route it directly to the MP or the District In-charge Minister:
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8 bg-card font-semibold"
                              onClick={(e) => {
                                e.preventDefault();
                                setCustomRepId(1); // Capt. Brijesh Chowta
                                toast.success("Routed to Capt. Brijesh Chowta (MP)");
                              }}
                            >
                              Route to MP (Capt. Brijesh Chowta)
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8 bg-card font-semibold"
                              onClick={(e) => {
                                e.preventDefault();
                                setCustomRepId(8); // U.T. Khader
                                toast.success("Routed to U.T. Khader (District Minister)");
                              }}
                            >
                              Route to District Minister (U.T. Khader)
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Override selection dropdowns */}
                      <div className="border-t pt-3 space-y-3">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Is the assignment incorrect? Adjust below:
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-extrabold uppercase text-muted-foreground block">
                              Authority Override
                            </label>
                            <select
                              value={customAuthId ?? ""}
                              onChange={(e) => setCustomAuthId(e.target.value ? Number(e.target.value) : null)}
                              className="w-full rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="">System Default</option>
                              {(authoritiesQuery.data ?? []).map((a: any) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-extrabold uppercase text-muted-foreground block">
                              Representative Override
                            </label>
                            <select
                              value={customRepId ?? ""}
                              onChange={(e) => setCustomRepId(e.target.value ? Number(e.target.value) : null)}
                              className="w-full rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="">System Default</option>
                              {(representativesQuery.data ?? []).map((r: any) => (
                                <option key={r.id} value={r.id}>
                                  {r.name} ({r.role})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-red-500 font-semibold">
                      Could not resolve authority routing. Try verifying your category/location.
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep("details")}>
                    Edit Details
                  </Button>
                  <Button className="flex-1 font-semibold" onClick={submit} disabled={working}>
                    {working ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit report"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "photo", label: "Photo" },
    { key: "details", label: "Details" },
    { key: "review", label: "Submit" },
  ];
  const idx = Math.max(
    0,
    steps.findIndex((s) => s.key === (step === "dupes" ? "details" : step)),
  );
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
              i <= idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </span>
          <span className={i <= idx ? "font-semibold" : "text-muted-foreground"}>{s.label}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
