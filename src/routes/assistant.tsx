import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { QuickReportCard } from "@/components/QuickReportCard";
import { chatWithAssistantFn } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, ArrowUp, AlertCircle, Camera } from "lucide-react";

export const Route = createFileRoute("/assistant")({
  component: AssistantPage,
  ssr: false,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  report?: { public_id: string; slug: string };
};

const SUGGESTIONS = [
  "How does JanFix route my photo to the right authority?",
  "How is the Community Accountability Score calculated?",
  "How do I download my complaint poster and QR code?",
  "How can I check if my issue is fixed?",
];

function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [showReport, setShowReport] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: (history: ChatMessage[]) =>
      chatWithAssistantFn({
        data: { messages: history.map(({ role, content }) => ({ role, content })) },
      }),
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, mutation.isPending, showReport]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || mutation.isPending) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    const result = await mutation.mutateAsync(next);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: result.reply, error: Boolean(result.error) },
    ]);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const handleReported = (result: { public_id: string; slug: string }) => {
    setShowReport(false);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `Your complaint has been filed and routed to the right authority. Tracking ID: ${result.public_id}.`,
        report: { public_id: result.public_id, slug: result.slug },
      },
    ]);
  };

  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col px-4">
        <header className="flex items-center gap-2 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold tracking-tight">JanFix Assistant</h1>
            <p className="text-xs text-muted-foreground">
              Ask about reporting, routing, scoring, or your complaint status
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pb-4">
          {messages.length === 0 && !showReport ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Hi, I'm the JanFix Assistant</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  I can help you report issues, understand how routing and scoring work, and share
                  your complaint.
                </p>
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowReport(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/20"
              >
                <Camera className="h-4 w-4" /> File a complaint with a photo
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((m, i) => (
                <ChatBubble key={i} message={m} />
              ))}
              {mutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  Thinking…
                </div>
              )}
              {showReport && (
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Camera className="h-3.5 w-3.5" />
                  </div>
                  <div className="max-w-[85%] flex-1">
                    <QuickReportCard onReported={handleReported} onCancel={() => setShowReport(false)} />
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="sticky bottom-0 border-t bg-background/95 py-4 backdrop-blur">
          <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setShowReport((v) => !v)}
              className="shrink-0 rounded-xl"
              title="File a complaint with a photo"
            >
              <Camera className="h-4 w-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask the JanFix Assistant…"
              rows={1}
              className="max-h-40 min-h-10 flex-1 resize-none border-0 shadow-none focus-visible:ring-0"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || mutation.isPending}
              className="shrink-0 rounded-xl"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            The assistant can make mistakes. For urgent issues, please report them directly.
          </p>
        </form>
      </div>
    </AppShell>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="max-w-[85%] space-y-1.5">
        {message.error && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
            <AlertCircle className="h-3 w-3" /> Assistant notice
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{message.content}</p>
        {message.report && <ReportLinkChip report={message.report} />}
      </div>
    </div>
  );
}

function ReportLinkChip({ report }: { report: { public_id: string; slug: string } }) {
  const linkParams = { publicId: report.public_id, slug: report.slug || "issue" };
  return (
    <Link
      to="/issue/$publicId/$slug"
      params={linkParams}
      className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
    >
      View {report.public_id} →
    </Link>
  );
}
