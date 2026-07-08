"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LifeBuoy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TICKET_CATEGORY_LABELS } from "@/components/platform-badges";
import { useBureauStore, useMyCases } from "@/lib/store";
import type { TicketCategory } from "@/lib/types";

function NewTicketForm() {
  const router = useRouter();
  const params = useSearchParams();
  const createTicket = useBureauStore((s) => s.createTicket);
  const myCases = useMyCases();

  const [caseId, setCaseId] = useState<string>(params.get("case") ?? "");
  const [category, setCategory] = useState<TicketCategory>("case_help");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    const ticket = createTicket({
      caseId: caseId || null,
      category,
      subject: subject.trim(),
      body: body.trim(),
    });
    router.push(`/support/${ticket.id}`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LifeBuoy className="h-6 w-6 text-primary" />
          New support ticket
        </h1>
        <p className="mt-1 text-muted-foreground">
          Tell us what you need — response times depend on your service package.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ticket-case">Related case <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Select id="ticket-case" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                  <option value="">Not case-related</option>
                  {myCases.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ticket-category">Category</Label>
                <Select id="ticket-category" value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
                  {Object.entries(TICKET_CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-subject">Subject</Label>
              <Input
                id="ticket-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="One sentence describing the issue"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-body">Message</Label>
              <Textarea
                id="ticket-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                placeholder="What's going on, what you've tried, and what you need from us."
                required
              />
            </div>
            <Button type="submit" disabled={!subject.trim() || !body.trim()}>
              <Send className="h-4 w-4" />
              Submit ticket
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewTicketPage() {
  return (
    <Suspense>
      <NewTicketForm />
    </Suspense>
  );
}
