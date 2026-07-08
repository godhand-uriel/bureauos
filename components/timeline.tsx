import {
  CalendarClock,
  CheckCircle2,
  FileCheck,
  FilePen,
  FileSearch,
  Flag,
  MessageSquare,
  Sparkles,
  StickyNote,
  Workflow,
} from "lucide-react";
import type { TimelineEvent, TimelineEventType } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const EVENT_ICONS: Record<TimelineEventType, { icon: typeof Flag; color: string }> = {
  case_created: { icon: Flag, color: "text-primary" },
  intake_completed: { icon: FileSearch, color: "text-violet-400" },
  plan_generated: { icon: Sparkles, color: "text-violet-400" },
  task_completed: { icon: CheckCircle2, color: "text-emerald-400" },
  document_update: { icon: FileCheck, color: "text-emerald-400" },
  letter_generated: { icon: FilePen, color: "text-sky-400" },
  communication: { icon: MessageSquare, color: "text-amber-400" },
  deadline: { icon: CalendarClock, color: "text-red-400" },
  status_change: { icon: Workflow, color: "text-muted-foreground" },
  note: { icon: StickyNote, color: "text-muted-foreground" },
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <ol className="relative space-y-0">
      {sorted.map((event, i) => {
        const cfg = EVENT_ICONS[event.type] ?? EVENT_ICONS.note;
        const Icon = cfg.icon;
        return (
          <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            {i < sorted.length - 1 && (
              <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-border" aria-hidden />
            )}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card">
              <Icon className={`h-4 w-4 ${cfg.color}`} />
            </div>
            <div className="min-w-0 pt-1">
              <p className="text-sm font-medium leading-snug">{event.title}</p>
              {event.detail && (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{event.detail}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground/70">{formatDateTime(event.date)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
