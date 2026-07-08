"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileQuestion, NotebookPen, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { TICKET_CATEGORY_LABELS, TicketStatusBadge } from "@/components/platform-badges";
import { useBureauStore, useCurrentUser, useHydrated } from "@/lib/store";
import { cn, formatDateTime } from "@/lib/utils";
import type { TicketStatus } from "@/lib/types";

const TICKET_STATUSES: TicketStatus[] = ["open", "waiting_on_customer", "in_review", "resolved", "closed"];

export default function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const admin = useCurrentUser();
  const ticket = useBureauStore((s) => s.tickets.find((t) => t.id === id));
  const users = useBureauStore((s) => s.users);
  const kase = useBureauStore((s) => s.cases.find((c) => c.id === ticket?.caseId));
  const addTicketMessage = useBureauStore((s) => s.addTicketMessage);
  const setTicketStatus = useBureauStore((s) => s.setTicketStatus);
  const addTicketInternalNote = useBureauStore((s) => s.addTicketInternalNote);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");

  if (!hydrated || !admin) return null;

  if (!ticket) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Ticket not found"
        description="This ticket doesn't exist in local data."
        action={<Link href="/admin/support"><Button>Back to tickets</Button></Link>}
      />
    );
  }

  const customer = users.find((u) => u.id === ticket.userId);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/support" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          All tickets
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold leading-snug tracking-tight">{ticket.subject}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {customer?.name ?? "Unknown"} · {TICKET_CATEGORY_LABELS[ticket.category]}
              {kase && (
                <>
                  {" · "}
                  <Link href={`/admin/cases/${kase.id}`} className="text-primary hover:underline">{kase.title}</Link>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TicketStatusBadge status={ticket.status} />
            <div className="w-44">
              <Select
                value={ticket.status}
                onChange={(e) => setTicketStatus(ticket.id, e.target.value as TicketStatus)}
                aria-label="Update ticket status"
              >
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Thread + reply */}
        <div className="space-y-4 lg:col-span-2">
          <div className="space-y-3">
            {ticket.messages.map((m) => (
              <div key={m.id} className={cn("flex", m.authorRole === "staff" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl border p-4",
                    m.authorRole === "staff"
                      ? "rounded-br-sm border-primary/30 bg-primary/10"
                      : "rounded-bl-sm border-border bg-card",
                  )}
                >
                  <p className="text-xs font-semibold">
                    {m.authorRole === "staff" ? `${m.authorName} (staff)` : m.authorName}
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
                  <p className="mt-2 text-[10px] text-muted-foreground">{formatDateTime(m.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>

          <Card>
            <CardContent className="p-4">
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reply.trim()) return;
                  addTicketMessage(ticket.id, "staff", admin.name, reply.trim());
                  setReply("");
                }}
              >
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder="Reply to the customer…"
                  aria-label="Staff reply"
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={!reply.trim()}>
                    <Send className="h-4 w-4" />
                    Send as staff
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Internal notes */}
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <NotebookPen className="h-4 w-4 text-primary" />
              Internal notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ticket.internalNotes.length === 0 && (
              <p className="text-sm text-muted-foreground">No internal notes.</p>
            )}
            {ticket.internalNotes.map((n) => (
              <div key={n.id} className="rounded-lg border border-border bg-card/50 p-3">
                <p className="text-xs font-semibold">{n.authorName}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{n.body}</p>
                <p className="mt-1.5 text-[10px] text-muted-foreground/70">{formatDateTime(n.createdAt)}</p>
              </div>
            ))}
            <form
              className="space-y-2 pt-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                addTicketInternalNote(ticket.id, admin.name, note.trim());
                setNote("");
              }}
            >
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Staff-only note…"
                aria-label="Internal note"
              />
              <Button type="submit" size="sm" variant="secondary" disabled={!note.trim()}>
                Add note
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
