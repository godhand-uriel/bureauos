"use client";

import { use, useState } from "react";
import { History, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Timeline } from "@/components/timeline";
import { useBureauStore, useCase, useHydrated } from "@/lib/store";
import type { TimelineEventType } from "@/lib/types";

const EVENT_TYPES: { value: TimelineEventType; label: string }[] = [
  { value: "communication", label: "Communication (call, email, letter)" },
  { value: "note", label: "Note" },
  { value: "deadline", label: "Deadline-related" },
  { value: "document_update", label: "Document update" },
];

export default function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const kase = useCase(id);
  const addTimelineEvent = useBureauStore((s) => s.addTimelineEvent);

  const [type, setType] = useState<TimelineEventType>("communication");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");

  if (!hydrated || !kase) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addTimelineEvent(kase.id, type, title.trim(), detail.trim() || undefined);
    setTitle("");
    setDetail("");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Add event */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary" />
            Log an event
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-type" className="text-xs text-muted-foreground">
                  Event type
                </Label>
                <Select
                  id="event-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as TimelineEventType)}
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-title" className="text-xs text-muted-foreground">
                  What happened
                </Label>
                <Input
                  id="event-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Called the appeals department"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-detail" className="text-xs text-muted-foreground">
                Details <span className="opacity-70">(who, reference numbers, what was said)</span>
              </Label>
              <Textarea
                id="event-detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="e.g. Spoke with Angela, ref #88213. She confirmed the appeal was received…"
                rows={2}
              />
            </div>
            <Button type="submit" disabled={!title.trim()}>
              <Plus className="h-4 w-4" />
              Add to timeline
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Case timeline
            <span className="text-xs font-normal text-muted-foreground">
              {kase.timeline.length} events
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline events={kase.timeline} />
        </CardContent>
      </Card>
    </div>
  );
}
