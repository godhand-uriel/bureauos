"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RequireAdmin } from "@/components/require-auth";
import { useBureauStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const ADMIN_TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/reviews", label: "Review requests" },
  { href: "/admin/support", label: "Support tickets" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The review queue is only part of the console when that staffed service
  // is on — or while requests from an earlier period still exist.
  const showReviews = useBureauStore((s) => (s.capabilities?.humanReview ?? false) || s.reviews.length > 0);
  const tabs = ADMIN_TABS.filter((tab) => tab.href !== "/admin/reviews" || showReviews);
  return (
    <RequireAdmin>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin console</h1>
          <p className="mt-1 text-muted-foreground">
            Operator view: customer cases, support tickets, deadlines, and Case Passes.
          </p>
        </div>
        <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-border" aria-label="Admin sections">
          {tabs.map((tab) => {
            const active =
              tab.href === "/admin"
                ? pathname === "/admin" || pathname.startsWith("/admin/cases")
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <div className="animate-fade-in-up">{children}</div>
      </div>
    </RequireAdmin>
  );
}
