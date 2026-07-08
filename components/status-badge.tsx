import { Badge } from "@/components/ui/badge";
import type { CaseStatus, Priority } from "@/lib/types";

const STATUS_CONFIG: Record<CaseStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" | "info" | "purple" }> = {
  intake: { label: "Intake", variant: "info" },
  planning: { label: "Planning", variant: "purple" },
  in_progress: { label: "In progress", variant: "default" },
  waiting: { label: "Waiting", variant: "warning" },
  resolved: { label: "Resolved", variant: "success" },
  closed: { label: "Closed", variant: "secondary" },
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  const cfg = STATUS_CONFIG[status];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; variant: "secondary" | "info" | "warning" | "destructive" }> = {
  low: { label: "Low priority", variant: "secondary" },
  medium: { label: "Medium priority", variant: "info" },
  high: { label: "High priority", variant: "warning" },
  urgent: { label: "Urgent", variant: "destructive" },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
