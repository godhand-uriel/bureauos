"use client";

import Link from "next/link";
import { LifeBuoy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { TICKET_CATEGORY_LABELS, TicketStatusBadge } from "@/components/platform-badges";
import { useBureauStore, useCurrentUser, useHydrated } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";

export default function SupportPage() {
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const tickets = useBureauStore((s) => s.tickets);
  const cases = useBureauStore((s) => s.cases);

  if (!hydrated || !user) return null;

  const myTickets = tickets
    .filter((t) => t.userId === user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support</h1>
          <p className="mt-1 text-muted-foreground">
            Questions about a case, documents, or your plan — we track every request.
          </p>
        </div>
        <Link href="/support/new">
          <Button>
            <Plus className="h-4 w-4" />
            New ticket
          </Button>
        </Link>
      </div>

      {myTickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No support tickets yet"
          description="Open a ticket and the Building202 team will follow up based on your service package."
          action={
            <Link href="/support/new">
              <Button>Open your first ticket</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {myTickets.map((ticket) => {
            const kase = cases.find((c) => c.id === ticket.caseId);
            const lastMessage = ticket.messages[ticket.messages.length - 1];
            return (
              <Link key={ticket.id} href={`/support/${ticket.id}`} className="block">
                <Card className="transition-colors hover:border-primary/40">
                  <CardContent className="flex flex-col gap-2 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-semibold leading-snug">{ticket.subject}</h2>
                      <TicketStatusBadge status={ticket.status} />
                    </div>
                    <p className="line-clamp-1 text-sm text-muted-foreground">
                      {lastMessage
                        ? `${lastMessage.authorRole === "staff" ? "Building202: " : "You: "}${lastMessage.body}`
                        : "No messages yet."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {TICKET_CATEGORY_LABELS[ticket.category]}
                      {kase && ` · ${kase.title}`} · Updated {formatDateTime(ticket.updatedAt)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
