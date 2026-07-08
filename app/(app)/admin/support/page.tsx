"use client";

import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { TICKET_CATEGORY_LABELS, TicketStatusBadge } from "@/components/platform-badges";
import { useBureauStore, useHydrated } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";

export default function AdminSupportPage() {
  const hydrated = useHydrated();
  const tickets = useBureauStore((s) => s.tickets);
  const users = useBureauStore((s) => s.users);
  const cases = useBureauStore((s) => s.cases);

  if (!hydrated) return null;

  const sorted = [...tickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={LifeBuoy}
        title="No support tickets"
        description="Customer tickets appear here as they come in."
      />
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((ticket) => {
        const customer = users.find((u) => u.id === ticket.userId);
        const kase = cases.find((c) => c.id === ticket.caseId);
        const last = ticket.messages[ticket.messages.length - 1];
        return (
          <Link key={ticket.id} href={`/admin/support/${ticket.id}`} className="block">
            <Card className="transition-colors hover:border-primary/40">
              <CardContent className="flex flex-col gap-2 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold leading-snug">{ticket.subject}</h2>
                  <TicketStatusBadge status={ticket.status} />
                </div>
                {last && (
                  <p className="line-clamp-1 text-sm text-muted-foreground">
                    {last.authorRole === "staff" ? "Staff: " : `${last.authorName}: `}
                    {last.body}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {customer?.name ?? "Unknown"} · {TICKET_CATEGORY_LABELS[ticket.category]}
                  {kase && ` · ${kase.title}`} · Updated {formatDateTime(ticket.updatedAt)}
                </p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
