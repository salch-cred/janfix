// Tiny perceptual hash (8x8 average hash). Returns 16-char hex.
export async function computeImagePHash(file: File | Blob): Promise<string> {
  if (typeof window === "undefined") return "";
  const bitmap = await createImageBitmap(file);
  const size = 8;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(bitmap, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const grays: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    grays.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  const avg = grays.reduce((a, b) => a + b, 0) / grays.length;
  let bits = "";
  for (const g of grays) bits += g >= avg ? "1" : "0";
  // 64 bits => 16 hex chars
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

export function hammingHex(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    d += (x.toString(2).match(/1/g) || []).length;
  }
  return d;
}
