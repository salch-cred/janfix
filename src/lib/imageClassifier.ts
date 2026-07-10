/**
 * Civic issue category classifier using TensorFlow.js MobileNetV2.
 * Runs entirely in the browser — zero server cost.
 *
 * Maps MobileNet class labels → JanFix category slugs.
 * The model is lazy-loaded on first use and cached for the session.
 */

import type * as mobilenetTypes from "@tensorflow-models/mobilenet";

type MobileNet = mobilenetTypes.MobileNet;

// ── Category keyword maps ────────────────────────────────────────────────────
// Each entry maps a JanFix category slug to an array of MobileNet label
// keywords that strongly indicate that category.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  pothole: [
    "pothole", "hole", "crater", "road", "asphalt", "pavement",
    "tarmac", "street", "highway", "pit",
  ],
  garbage: [
    "garbage", "trash", "waste", "litter", "rubbish", "refuse",
    "dump", "bin", "landfill", "debris", "junk",
  ],
  sewage: [
    "sewage", "sewer", "manhole", "drain", "overflow",
    "pipe", "plumbing", "sludge",
  ],
  "water-leakage": [
    "water", "leak", "puddle", "flood", "wet", "tap",
    "pipe", "drip", "hose", "valve",
  ],
  streetlight: [
    "streetlight", "lamp", "light", "lamppost", "lantern",
    "bulb", "pole", "electric", "lighting", "street light",
  ],
  "road-damage": [
    "crack", "broken road", "damaged road", "road damage",
    "road surface", "tarmac", "asphalt", "excavation",
  ],
  footpath: [
    "footpath", "sidewalk", "pavement", "walkway", "curb",
    "pedestrian", "path", "cobblestone", "tile",
  ],
  drain: [
    "drain", "drainage", "gutter", "culvert", "blocked",
    "channel", "ditch", "waterway",
  ],
  "tree-hazard": [
    "tree", "branch", "fallen", "log", "trunk",
    "uprooted", "wood", "plant", "foliage",
  ],
  "traffic-signal": [
    "traffic", "signal", "light", "traffic light", "intersection",
    "crossroads", "junction", "semaphore",
  ],
  "illegal-dumping": [
    "dump", "waste", "abandoned", "illegal", "pile",
    "garbage", "litter", "refuse",
  ],
};

const REJECT_KEYWORDS = [
  "person", "man", "woman", "face", "hair", "groom", "bride", "suit", "tie", 
  "boy", "girl", "child", "human", "shirt", "pants", "clothing",
  "monitor", "television", "laptop", "screen", "display", "computer",
  "dog", "cat", "pet", "animal", "bird"
];

// ── Model singleton ──────────────────────────────────────────────────────────
let modelPromise: Promise<MobileNet> | null = null;

async function getModel(): Promise<MobileNet> {
  if (!modelPromise) {
    // Dynamic import keeps TF out of the initial bundle
    const [tf, mobilenet] = await Promise.all([
      import("@tensorflow/tfjs"),
      import("@tensorflow-models/mobilenet"),
    ]);
    
    // Initialize backend safely
    try {
      await tf.setBackend("webgl");
      await tf.ready();
    } catch {
      await tf.setBackend("cpu");
      await tf.ready();
    }

    modelPromise = mobilenet.load({ version: 2, alpha: 1.0 });
  }
  return modelPromise;
}

// ── Classifier result ────────────────────────────────────────────────────────
export interface ClassifyResult {
  /** Best matching JanFix category slug, or null if no strong match */
  slug: string | null;
  /** Confidence 0–1 */
  confidence: number;
  /** True if the image strongly matches a non-civic category (e.g., selfie, animal) */
  isRejected: boolean;
  /** Reason for rejection if isRejected is true */
  rejectReason?: string;
  /** Raw MobileNet top-3 predictions for debugging */
  raw: { className: string; probability: number }[];
}

/**
 * Classify a File or HTMLImageElement using MobileNetV2.
 * Returns the best matching JanFix category slug + confidence.
 */
export async function classifyImage(
  source: File | HTMLImageElement,
): Promise<ClassifyResult> {
  const model = await getModel();

  let imgEl: HTMLImageElement;
  if (source instanceof HTMLImageElement) {
    imgEl = source;
  } else {
    // Decode the File into an <img> element the model can process
    imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(source);
    });
  }

  const predictions = await model.classify(imgEl, 5);

  // Score each category by summing probabilities of matching keywords
  const scores: Record<string, number> = {};
  let rejectScore = 0;

  for (const pred of predictions) {
    const label = pred.className.toLowerCase();
    
    // Check if it hits our reject list
    if (REJECT_KEYWORDS.some((kw) => label.includes(kw))) {
      rejectScore += pred.probability;
    }

    // Check civic keywords
    for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some((kw) => label.includes(kw))) {
        scores[slug] = (scores[slug] ?? 0) + pred.probability;
      }
    }
  }

  // Determine if it should be rejected
  const isRejected = rejectScore > 0.3; // If 30%+ confidence it's a person/screen/animal
  const rejectReason = isRejected 
    ? "This looks like a picture of a person, animal, or unclassified item. Please upload a clear photo of the civic issue."
    : undefined;

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  return {
    slug: best ? best[0] : null,
    confidence: best ? Math.min(best[1], 1) : 0,
    isRejected,
    rejectReason,
    raw: predictions.map((p) => ({
      className: p.className,
      probability: p.probability,
    })),
  };
}

/** Preloads the model in the background. Call early to reduce UX delay. */
export function warmupClassifier() {
  getModel().catch(() => {});
}
