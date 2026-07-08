"use client";

import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DocumentRequirement, DocumentStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: DocumentStatus; label: string }[] = [
  { value: "needed", label: "Needed" },
  { value: "requested", label: "Requested" },
  { value: "obtained", label: "Obtained" },
  { value: "not_applicable", label: "Not applicable" },
];

const STATUS_BADGE: Record<DocumentStatus, "warning" | "info" | "success" | "secondary"> = {
  needed: "warning",
  requested: "info",
  obtained: "success",
  not_applicable: "secondary",
};

interface DocumentChecklistProps {
  documents: DocumentRequirement[];
  onStatusChange: (docId: string, status: DocumentStatus) => void;
}

export function DocumentChecklist({ documents, onStatusChange }: DocumentChecklistProps) {
  const sorted = [...documents].sort((a, b) => {
    const rank = (d: DocumentRequirement) =>
      d.status === "obtained" || d.status === "not_applicable" ? 1 : 0;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return Number(b.required) - Number(a.required);
  });

  return (
    <div className="space-y-2">
      {sorted.map((doc) => (
        <div
          key={doc.id}
          className={cn(
            "flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-3.5 sm:flex-row sm:items-center",
            (doc.status === "obtained" || doc.status === "not_applicable") && "opacity-60",
          )}
        >
          <FileText className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{doc.name}</span>
              {doc.required ? (
                <Badge variant="destructive" className="text-[10px]">Required</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
              )}
              <Badge variant={STATUS_BADGE[doc.status]} className="text-[10px] sm:hidden">
                {STATUS_OPTIONS.find((o) => o.value === doc.status)?.label}
              </Badge>
            </div>
            {doc.description && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{doc.description}</p>
            )}
          </div>
          <div className="w-full sm:w-40">
            <Select
              value={doc.status}
              onChange={(e) => onStatusChange(doc.id, e.target.value as DocumentStatus)}
              aria-label={`Status for ${doc.name}`}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}
