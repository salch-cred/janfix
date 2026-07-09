// Robust Difference Hash (dHash) comparing adjacent pixels. Returns 16-char hex.
export async function computeImagePHash(file: File | Blob): Promise<string> {
  if (typeof window === "undefined") return "";
  const bitmap = await createImageBitmap(file);
  const width = 9;
  const height = 8;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(bitmap, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  
  const grays: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    grays.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  // Compare adjacent pixels horizontally to calculate difference hash (64 bits)
  let bits = "";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const left = grays[y * width + x];
      const right = grays[y * width + (x + 1)];
      bits += left > right ? "1" : "0";
    }
  }

  // Convert 64 bits binary string to 16 hex chars
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

// Optimized Hamming distance popcount using a constant-time lookup map
const POPCOUNT_NIBBLE = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

export function hammingHex(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    d += POPCOUNT_NIBBLE[x];
  }
  return d;
}
