"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bot,
  Compass,
  CreditCard,
  FolderOpen,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBureauStore, useCurrentUser, useHydrated } from "@/lib/store";
import { StoreSeeder } from "@/components/store-seeder";
import { BrandWordmark } from "@/components/brand-wordmark";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assistant", label: "Assistant", icon: Bot },
  { href: "/navigators", label: "Navigators", icon: Compass },
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const cases = useBureauStore((s) => s.cases);
  const activeCases =
    hydrated && user
      ? cases
          .filter((c) => c.userId === user.id && c.status !== "closed" && c.status !== "resolved")
          .slice(0, 6)
      : [];

  return (
    <div className="flex h-full flex-col">
      <BrandWordmark className="px-5 py-5" onClick={onNavigate} />

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {user?.role === "admin" && (
          <div className="pt-4">
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Staff
            </p>
            {[
              { href: "/admin", label: "Admin console", icon: ShieldCheck },
            ].map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}

        {user?.role !== "admin" && (
          <div className="pt-5">
            <div className="flex items-center justify-between px-3 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Active cases
              </span>
              <Link
                href="/navigators"
                onClick={onNavigate}
                aria-label="Start a new case"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
              </Link>
            </div>
            {activeCases.length === 0 && (
              <p className="px-3 py-1 text-xs text-muted-foreground">
                {hydrated ? "No active cases yet." : "Loading…"}
              </p>
            )}
            {activeCases.map((c) => {
              const active = pathname.startsWith(`/cases/${c.id}`);
              return (
                <Link
                  key={c.id}
                  href={`/cases/${c.id}`}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate">{c.title}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground">
          Building202 organizes information and next steps. It does not provide legal advice.
        </p>
      </div>
    </div>
  );
}

function UserMenu() {
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const logOut = useBureauStore((s) => s.logOut);
  const [open, setOpen] = useState(false);

  if (!hydrated || !user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border bg-card px-1.5 py-1.5 pr-3 text-sm transition-colors hover:border-primary/40"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-[10rem] truncate font-medium sm:block">{user.name}</span>
        {user.role === "admin" && <Badge variant="purple" className="hidden text-[10px] sm:inline-flex">Staff</Badge>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-40 mt-2 w-56 rounded-lg border border-border bg-popover p-2 shadow-xl" role="menu">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <div className="my-1 h-px bg-border" />
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              role="menuitem"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <button
              onClick={async () => {
                setOpen(false);
                await logOut();
                router.push("/");
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen">
      <StoreSeeder />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-border bg-card shadow-xl">
            <button
              className="absolute right-3 top-5 rounded-md p-1 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Link href="/navigators">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New case
            </Button>
          </Link>
          <UserMenu />
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
