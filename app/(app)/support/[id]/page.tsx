"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileQuestion, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { TICKET_CATEGORY_LABELS, TicketStatusBadge } from "@/components/platform-badges";
import { useBureauStore, useCurrentUser, useHydrated } from "@/lib/store";
import { cn, formatDateTime } from "@/lib/utils";

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const ticket = useBureauStore((s) => s.tickets.find((t) => t.id === id));
  const kase = useBureauStore((s) => s.cases.find((c) => c.id === ticket?.caseId));
  const addTicketMessage = useBureauStore((s) => s.addTicketMessage);
  const [reply, setReply] = useState("");

  if (!hydrated || !user) return null;

  const canView = ticket && (ticket.userId === user.id || user.role === "admin");
  if (!canView) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Ticket not found"
        description="This ticket doesn't exist, or it belongs to a different account."
        action={
          <Link href="/support">
            <Button>Back to support</Button>
          </Link>
        }
      />
    );
  }

  const closed = ticket.status === "resolved" || ticket.status === "closed";

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    addTicketMessage(ticket.id, "customer", user.name, reply.trim());
    setReply("");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/support" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          All tickets
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold leading-snug tracking-tight">{ticket.subject}</h1>
          <TicketStatusBadge status={ticket.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {TICKET_CATEGORY_LABELS[ticket.category]}
          {kase && (
            <>
              {" · "}
              <Link href={`/cases/${kase.id}`} className="text-primary hover:underline">{kase.title}</Link>
            </>
          )}
          {" · "}Opened {formatDateTime(ticket.createdAt)}
        </p>
      </div>

      {/* Thread */}
      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.authorRole === "customer" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-xl border p-4",
                m.authorRole === "customer"
                  ? "rounded-br-sm border-primary/30 bg-primary/10"
                  : "rounded-bl-sm border-border bg-card",
              )}
            >
              <p className="text-xs font-semibold">
                {m.authorRole === "staff" ? `${m.authorName} · BureauOS` : m.authorName}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
              <p className="mt-2 text-[10px] text-muted-foreground">{formatDateTime(m.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Reply */}
      {closed ? (
        <Card>
          <CardContent className="p-5 text-center text-sm text-muted-foreground">
            This ticket is {ticket.status}. Open a{" "}
            <Link href="/support/new" className="text-primary hover:underline">new ticket</Link>{" "}
            if you need anything else.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={send} className="space-y-3">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                placeholder="Write a reply…"
                aria-label="Reply to ticket"
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={!reply.trim()}>
                  <Send className="h-4 w-4" />
                  Send reply
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
