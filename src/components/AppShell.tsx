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
import { Sparkles } from "lucide-react";
import { Disclaimer } from "./Disclaimer";

const navItemActiveProps = { className: "bg-background text-foreground shadow-sm" };

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
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
      <span>Now live in Mangaluru \u2014 report a civic issue in under 60 seconds.</span>
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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <HugeiconsIcon icon={Location01Icon} size={16} strokeWidth={1.5} />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-extrabold tracking-tight">JanFix</div>
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
          <a
            href="/auth"
            className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Admin
          </a>
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
                activeProps={t.accent ? {} : { className: "text-primary" }}
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
  return (
    <footer className="hidden border-t bg-muted/30 md:block">
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
            <a href="/auth">Admin</a>
          </div>
        </div>
        <Disclaimer variant="footer" />
      </div>
    </footer>
  );
}
