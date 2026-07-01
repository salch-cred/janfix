import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const SYSTEM_PROMPT = `You are the JanFix Mangaluru Assistant, a friendly helper built into the JanFix Mangaluru civic issue reporting platform.
JanFix lets citizens report civic issues (potholes, garbage, sewage leaks, broken streetlights, water leaks, etc.) by uploading a photo and a short description, plus optional extra photos of the same issue. The platform automatically detects the location, routes the issue to the responsible government authority and local representative nearby, and publishes it on a public page where anyone can view status, comment, vote whether it's fixed, and share it.
Citizens can also file a complaint directly inside this chat: tapping the camera/attach icon opens an inline form to attach a photo (plus optional extra photos), pick a category and severity, add a short description, and capture their location — all without leaving the conversation. Once submitted, the chat shows a tracking ID and a link to the live issue page.
Each authority and representative has a public profile with resolution stats and a Community Accountability Score based on public reports and community verification. Every report also generates a shareable, bilingual (English/Kannada) poster with a QR code linking back to the live issue page.
Help users understand how to report an issue (either via the Report page or directly in this chat), how automatic routing to the nearest authority works, how the accountability score is calculated, how to track a complaint, and how to download/share their complaint poster and QR code. Keep answers short, clear and encouraging, using plain language. When useful, mention relevant pages like Report, Explore, Authorities or Leaderboard, or suggest using the chat's attach-photo button to file a complaint right away. If asked something unrelated to civic issues or JanFix, answer briefly and helpfully anyway, but steer back to how JanFix can help.`;

// Mistral's hosted chat-completion models. "mistral-small-latest" is fast and
// inexpensive; if it's ever retired/renamed, fall back to these other
// currently-hosted Mistral model slugs instead of failing outright.
const DEFAULT_MODEL = "mistral-small-latest";
const FALLBACK_MODELS = ["open-mistral-nemo", "mistral-large-latest"];

export const chatWithAssistantFn = createServerFn({ method: "POST" })
  .inputValidator((d: { messages: Array<{ role: "user" | "assistant"; content: string }> }) =>
    z
      .object({
        messages: z.array(chatMessageSchema).min(1).max(30),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return {
        reply:
          "The AI assistant isn't fully switched on yet — add a MISTRAL_API_KEY (from console.mistral.ai) to the project's environment variables to enable live answers.",
        error: "missing_api_key" as const,
      };
    }

    const configuredModel = process.env.MISTRAL_MODEL || DEFAULT_MODEL;
    const modelsToTry = [configuredModel, ...FALLBACK_MODELS.filter((m) => m !== configuredModel)];

    let lastErrorText = "";
    let lastStatus = 0;

    for (const model of modelsToTry) {
      try {
        const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages],
            temperature: 0.6,
            top_p: 0.9,
            max_tokens: 700,
            stream: false,
          }),
        });

        if (!res.ok) {
          lastStatus = res.status;
          lastErrorText = await res.text().catch(() => "");
          console.error("Mistral chat completion failed", model, res.status, lastErrorText);
          // A 404 usually means this model slug isn't hosted on Mistral for
          // this account — try the next candidate model instead of failing outright.
          if (res.status === 404 && model !== modelsToTry[modelsToTry.length - 1]) {
            continue;
          }
          return {
            reply:
              res.status === 401 || res.status === 403
                ? "The Mistral API key was rejected. Please double-check the MISTRAL_API_KEY value in the project's environment variables."
                : "Sorry, the assistant is temporarily unavailable. Please try again in a moment.",
            error: `api_error_${res.status}` as const,
          };
        }

        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const reply = json.choices?.[0]?.message?.content?.trim();
        return { reply: reply || "Sorry, I couldn't come up with a response. Please try rephrasing." };
      } catch (e) {
        console.error("Mistral chat completion error", model, e);
        lastErrorText = e instanceof Error ? e.message : String(e);
      }
    }

    console.error("Mistral chat completion: all models failed", lastStatus, lastErrorText);
    return {
      reply: "Sorry, I couldn't reach the assistant service right now. Please try again shortly.",
      error: "network_error" as const,
    };
  });
