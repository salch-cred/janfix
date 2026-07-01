import { Link } from "@tanstack/react-router";
import { MapPin, Plus, Map, Building2, Home } from "lucide-react";
import { Disclaimer } from "./Disclaimer";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="pb-28 md:pb-12">{children}</main>
      <MobileTabBar />
      <Footer />
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-bold tracking-tight">JanFix</div>
            <div className="-mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Mangaluru
            </div>
          </div>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <NavItem to="/explore" label="Explore" />
          <NavItem to="/authorities" label="Authorities" />
          <NavItem to="/leaderboard" label="Leaderboard" />
        </nav>
        <Link
          to="/report"
          className="hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 md:inline-flex"
        >
          <Plus className="h-4 w-4" /> Report
        </Link>
      </div>
    </header>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
      activeProps={{ className: "text-foreground bg-accent" }}
    >
      {label}
    </Link>
  );
}

function MobileTabBar() {
  const tabs = [
    { to: "/", label: "Home", icon: Home },
    { to: "/explore", label: "Explore", icon: Map },
    { to: "/report", label: "Report", icon: Plus, accent: true },
    { to: "/authorities", label: "Authorities", icon: Building2 },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5 px-1 py-2">
        {tabs.map((t) => {
          const Icon = t.icon;
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
                <Icon className={t.accent ? "h-5 w-5" : "h-5 w-5"} />
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
            <a href="/auth">Admin</a>
          </div>
        </div>
        <Disclaimer variant="footer" />
      </div>
    </footer>
  );
}
