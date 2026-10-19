import { Badge } from "@/components/ui/badge";
import type { ReviewStatus, ServiceTierId, TicketCategory, TicketStatus } from "@/lib/types";
import { getTier } from "@/lib/packages";

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  case_help: "Case help",
  documents: "Documents",
  billing: "Billing",
  technical: "Technical",
  other: "Other",
};

const TICKET: Record<TicketStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" | "info" | "purple" }> = {
  open: { label: "Open", variant: "info" },
  waiting_on_customer: { label: "Waiting on you", variant: "warning" },
  in_review: { label: "In review", variant: "purple" },
  resolved: { label: "Resolved", variant: "success" },
  closed: { label: "Closed", variant: "secondary" },
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const cfg = TICKET[status];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

const REVIEW: Record<ReviewStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" | "info" | "purple" | "destructive" }> = {
  not_requested: { label: "Not requested", variant: "secondary" },
  requested: { label: "Requested", variant: "info" },
  awaiting_documents: { label: "Awaiting documents", variant: "warning" },
  in_review: { label: "In review", variant: "purple" },
  changes_requested: { label: "Changes requested", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  declined: { label: "Declined", variant: "destructive" },
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const cfg = REVIEW[status];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function TierBadge({ tier }: { tier: ServiceTierId }) {
  const def = getTier(tier);
  return <Badge variant={def.humanAssisted ? "purple" : "secondary"}>{def.name}</Badge>;
}
