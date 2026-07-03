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
              <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 16 12 16s12-7.75 12-16C24 5.373 18.627 0 12 0z" fill="#1d4ed8"/>
              <circle cx="12" cy="11" r="9" fill="white"/>
              <path d="M12 5.5 c-1.5-2 -4.5-0.5 -4.5 2.5 0 2.5 4.5 5 4.5 5 s4.5-2.5 4.5-5 c0-3 -3-4.5 -4.5-2.5 z" fill="#dc2626"/>
              <g fill="#1d4ed8">
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

        <div className="mt-6 border-t pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs">
            <div className="font-display font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> About the Builders
            </div>
            <p className="mt-1 max-w-md italic text-muted-foreground">
              "We are just boring builders. Love you all. And deep test find bugs like a pro and fix."
            </p>
          </div>
          <a
            href="mailto:aflalarman@gmail.com"
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition duration-150"
          >
            Send Email
          </a>
        </div>

        <Disclaimer variant="footer" />
      </div>
    </footer>
  );
}
