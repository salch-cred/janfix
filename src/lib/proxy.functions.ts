import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getBase64ImageFn = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => z.object({ url: z.string().url() }).parse(d))
  .handler(async ({ data }): Promise<{ base64: string | null }> => {
    try {
      const res = await fetch(data.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      if (!res.ok) return { base64: null };
      
      const buffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "image/jpeg";
      
      // Node.js Buffer handles base64 encoding on the server side
      const base64String = Buffer.from(buffer).toString("base64");
      return { base64: `data:${contentType};base64,${base64String}` };
    } catch (e) {
      console.error("Failed to proxy image:", data.url, e);
      return { base64: null };
    }
  });
