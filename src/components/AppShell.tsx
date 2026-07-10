import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Location01Icon,
  Add01Icon,
  MapsLocation01Icon,
  Building02Icon,
  Home01Icon,
  Megaphone01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { Sparkles, Mail, MessageCircleHeart, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Disclaimer } from "./Disclaimer";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { submitFeedbackFn } from "@/lib/feedback.functions";
import { getDeviceId } from "@/lib/device";

const navItemActiveProps = { className: "bg-background text-foreground shadow-sm" };

function EnvWarningBar() {
  const isMissing = typeof window !== "undefined" && !import.meta.env.VITE_SUPABASE_URL;
  if (!isMissing) return null;
  return (
    <div className="bg-amber-500 text-white text-center py-2 px-4 text-xs font-semibold flex items-center justify-center gap-2 shadow-inner border-b border-amber-600">
      <Sparkles className="h-4 w-4 animate-pulse text-white" />
      <span>Local Dev Notice: Create a .env file from .env.example with your Supabase credentials to link the database.</span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <EnvWarningBar />
      <AnnouncementBar />
      <TopBar />
      <main className="pb-28 md:pb-12">{children}</main>
      <MobileTabBar />
      <Footer />
    </div>
  );
}

function AnnouncementBar() {
  return (
    <div className="hidden items-center justify-center gap-2 bg-foreground px-4 py-2 text-center text-xs font-medium text-background md:flex">
      <HugeiconsIcon icon={Megaphone01Icon} size={14} strokeWidth={1.5} />
      <span>Now live in Mangaluru — report a civic issue in under 60 seconds.</span>
      <Link
        to="/report"
        className="ml-1 inline-flex items-center gap-1 font-semibold underline underline-offset-2"
      >
        Report now <HugeiconsIcon icon={ArrowRight01Icon} size={12} strokeWidth={1.5} />
      </Link>
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center">
            <svg width="32" height="38" viewBox="0 0 24 28" fill="none">
              <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 16 12 16s12-7.75 12-16C24 5.373 18.627 0 12 0z" fill="#1a5d2b"/>
              <circle cx="12" cy="11" r="9" fill="white"/>
              <path d="M12 5.5 c-1.5-2 -4.5-0.5 -4.5 2.5 0 2.5 4.5 5 4.5 5 s4.5-2.5 4.5-5 c0-3 -3-4.5 -4.5-2.5 z" fill="#dc2626"/>
              <g fill="#1a5d2b">
                <circle cx="12" cy="11.5" r="1.5" />
                <path d="M9 16 c0-2 2-2.5 3-2.5 s3 0.5 3 2.5 v1 h-6 z" />
                <circle cx="8" cy="12" r="1" />
                <path d="M6 15 c0-1.5 1-2 2-2 s2 0.5 2 2 v0.5 h-4 z" />
                <circle cx="16" cy="12" r="1" />
                <path d="M14 15 c0-1.5 1-2 2-2 s2 0.5 2 2 v0.5 h-4 z" />
              </g>
            </svg>
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-extrabold tracking-tight">Jan<span className="text-green-600">Fix</span></div>
            <div className="-mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Mangaluru
            </div>
          </div>
        </Link>
        <nav className="hidden items-center gap-1 rounded-full border bg-muted/40 p-1 md:flex">
          <NavItem to="/explore" label="Explore" />
          <NavItem to="/authorities" label="Authorities" />
          <NavItem to="/leaderboard" label="Leaderboard" />
          <NavItem to="/assistant" label="Assistant" />
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link
            to="/auth"
            className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Admin
          </Link>
          <Link
            to="/report"
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm transition hover:opacity-90"
          >
            <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.5} /> Report an issue
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      activeProps={navItemActiveProps}
    >
      {label}
    </Link>
  );
}

type MobileTab = {
  to: string;
  label: string;
  accent?: boolean;
  hugeIcon?: Parameters<typeof HugeiconsIcon>[0]["icon"];
  lucideIcon?: typeof Sparkles;
};

function MobileTabBar() {
  const tabs: MobileTab[] = [
    { to: "/", label: "Home", hugeIcon: Home01Icon },
    { to: "/explore", label: "Explore", hugeIcon: MapsLocation01Icon },
    { to: "/report", label: "Report", hugeIcon: Add01Icon, accent: true },
    { to: "/authorities", label: "Authorities", hugeIcon: Building02Icon },
    { to: "/assistant", label: "Assistant", lucideIcon: Sparkles },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5 px-1 py-2">
        {tabs.map((t) => {
          const LucideIcon = t.lucideIcon;
          return (
            <li key={t.to} className="flex items-center justify-center">
              <Link
                to={t.to}
                className={
                  t.accent
                    ? "flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
                    : "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-muted-foreground"
                }
                activeProps={t.accent ? {} : { className: "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-primary" }}
              >
                {t.hugeIcon ? (
                  <HugeiconsIcon icon={t.hugeIcon} size={20} strokeWidth={1.5} />
                ) : LucideIcon ? (
                  <LucideIcon className="h-5 w-5" />
                ) : null}
                {!t.accent && <span>{t.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Footer() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitFeedback = async () => {
    if (message.trim().length < 2) {
      toast.error("Please write a bit more before sending.");
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedbackFn({
        data: {
          name: name.trim() || null,
          message: message.trim(),
          device_id: typeof window !== "undefined" ? getDeviceId() : null,
          page_url: typeof window !== "undefined" ? window.location.pathname : null,
        },
      });
      toast.success("Thanks! Your feedback has been sent to our team.");
      setName("");
      setMessage("");
      setShowForm(false);
    } catch (e) {
      console.error("Failed to submit feedback", e);
      toast.error("Couldn't send your feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="border-t bg-muted/30 pb-20 md:pb-8">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display text-base font-semibold text-foreground">
              JanFix Mangaluru
            </div>
            <p className="mt-1 max-w-xl text-xs">
              A civic accountability platform. No login required to report. Built with citizens, for
              citizens of Mangaluru.
            </p>
          </div>
          <div className="flex gap-4 text-xs">
            <Link to="/explore">Explore</Link>
            <Link to="/leaderboard">Leaderboard</Link>
            <Link to="/assistant">Assistant</Link>
            <Link to="/auth">Admin</Link>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-2xl border bg-card p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageCircleHeart className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <div className="font-display font-semibold text-foreground">Made by a small, hands-on team</div>
                <p className="mt-1 max-w-md text-muted-foreground">
                  We build fast, test thoroughly, and fix bugs quickly. Found an issue or have an idea
                  to make JanFix better? We read every message.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant={showForm ? "outline" : "secondary"}
                size="sm"
                className="gap-1.5 rounded-full text-xs"
                onClick={() => setShowForm((v) => !v)}
              >
                <MessageCircleHeart className="h-3.5 w-3.5" /> {showForm ? "Cancel" : "Write feedback"}
              </Button>
              <a
                href="mailto:aflalarman@gmail.com?subject=JanFix%20feedback"
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition duration-150 hover:opacity-90"
              >
                <Mail className="h-3.5 w-3.5" /> Email us
              </a>
              <a
                href="https://instagram.com/synora.builds"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-sm transition duration-150 hover:bg-accent"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                Instagram
              </a>
            </div>
          </div>

          {showForm && (
            <div className="flex flex-col gap-2 border-t pt-4">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                className="bg-background text-xs"
              />
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's working, what's broken, or what you'd like to see..."
                rows={3}
                className="bg-background text-xs"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 rounded-full text-xs"
                  onClick={handleSubmitFeedback}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Submit feedback
                </Button>
              </div>
            </div>
          )}
        </div>

        <Disclaimer variant="footer" />
      </div>
    </footer>
  );
}
