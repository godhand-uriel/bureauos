"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileQuestion, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { NavigatorIcon } from "@/components/navigator-icon";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { getNavigator } from "@/lib/navigators";
import { caseProgress } from "@/lib/plan-engine";
import { useBureauStore, useCase, useHydrated } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { CaseStatus } from "@/lib/types";

const TABS = [
  { segment: "", label: "Overview" },
  { segment: "intake", label: "Intake" },
  { segment: "plan", label: "Plan" },
  { segment: "documents", label: "Documents" },
  { segment: "letters", label: "Letters" },
  { segment: "review", label: "Review" },
  { segment: "timeline", label: "Timeline" },
];

const STATUS_OPTIONS: { value: CaseStatus; label: string }[] = [
  { value: "intake", label: "Intake" },
  { value: "planning", label: "Planning" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting", label: "Waiting" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export default function CaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();
  const kase = useCase(id);
  const setCaseStatus = useBureauStore((s) => s.setCaseStatus);
  const deleteCase = useBureauStore((s) => s.deleteCase);
  const humanReview = useBureauStore((s) => s.capabilities?.humanReview ?? false);
  const hasReview = useBureauStore((s) => s.reviews.some((r) => r.caseId === id));

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-80 animate-pulse rounded-md bg-secondary" />
        <div className="h-64 animate-pulse rounded-lg bg-secondary" />
      </div>
    );
  }

  if (!kase) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Case not found"
        description="This case doesn't exist or isn't part of your account. It may have been deleted."
        action={
          <Link href="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
        }
      />
    );
  }

  const nav = getNavigator(kase.navigatorSlug);
  const progress = caseProgress(kase);

  return (
    <div className="space-y-6">
      {/* Case header */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
              style={{
                backgroundColor: nav ? `hsl(${nav.accent} / 0.15)` : undefined,
                color: nav ? `hsl(${nav.accent})` : undefined,
              }}
            >
              <NavigatorIcon icon={nav?.icon ?? ""} className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">
                {kase.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{nav?.name}</span>
                <StatusBadge status={kase.status} />
                <PriorityBadge priority={kase.priority} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-40">
              <Select
                value={kase.status}
                onChange={(e) => setCaseStatus(kase.id, e.target.value as CaseStatus)}
                aria-label="Change case status"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete case"
              onClick={() => {
                if (window.confirm(`Delete "${kase.title}"? This cannot be undone.`)) {
                  deleteCase(kase.id);
                  router.push("/dashboard");
                }
              }}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Progress value={progress} className="max-w-md" />
          <span className="text-sm font-medium text-muted-foreground">{progress}%</span>
        </div>

        {/* Tabs */}
        <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-border" aria-label="Case sections">
          {TABS.filter((tab) => tab.segment !== "review" || humanReview || hasReview).map((tab) => {
            const href = tab.segment ? `/cases/${kase.id}/${tab.segment}` : `/cases/${kase.id}`;
            const active = pathname === href;
            return (
              <Link
                key={tab.segment}
                href={href}
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
      </div>

      <div className="animate-fade-in-up">{children}</div>
    </div>
  );
}
