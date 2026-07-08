"use client";

import { useRef, useState } from "react";
import { FileUp, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Callout } from "@/components/callout";
import { FileStatusBadge } from "@/components/platform-badges";
import { useBureauStore } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import type { FileCategory, UploadedFile } from "@/lib/types";

export const FILE_CATEGORIES: { value: FileCategory; label: string }[] = [
  { value: "id_documents", label: "ID documents" },
  { value: "dmv_notices", label: "DMV notices" },
  { value: "insurance_denial_letters", label: "Insurance denial letters" },
  { value: "lease_documents", label: "Lease documents" },
  { value: "repair_photos", label: "Repair photos" },
  { value: "employment_documents", label: "Employment documents" },
  { value: "final_paycheck_records", label: "Final paycheck records" },
  { value: "va_claim_documents", label: "VA claim documents" },
  { value: "medical_evidence", label: "Medical / evidence documents" },
  { value: "business_filings", label: "Business filings" },
  { value: "tax_compliance", label: "Tax / compliance documents" },
  { value: "correspondence", label: "Correspondence" },
];

export function fileCategoryLabel(value: FileCategory): string {
  return FILE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function sizeLabel(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * Case file uploads. MVP stores metadata locally (name/type/size/category/
 * status/notes) — file bytes stay on the user's device. The adapter surface
 * is shaped for S3 / Supabase Storage / R2 / GCS presigned uploads later.
 */
export function FileUploadPanel({ caseId, files }: { caseId: string; files: UploadedFile[] }) {
  const addFile = useBureauStore((s) => s.addFile);
  const deleteFile = useBureauStore((s) => s.deleteFile);
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<FileCategory>("correspondence");
  const [notes, setNotes] = useState("");

  const onPick = (fileList: FileList | null) => {
    if (!fileList) return;
    for (const f of Array.from(fileList)) {
      addFile(caseId, {
        name: f.name,
        fileType: f.type || "unknown",
        sizeLabel: sizeLabel(f.size),
        category,
        notes: notes.trim(),
      });
    }
    setNotes("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="h-4 w-4 text-primary" />
          Uploaded files
          <span className="text-xs font-normal text-muted-foreground">{files.length}</span>
        </CardTitle>
        <CardDescription>
          Attach the documents your checklist calls for. The BureauOS team reviews files on
          human-assisted plans.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="file-category" className="text-xs text-muted-foreground">Category</Label>
            <Select id="file-category" value={category} onChange={(e) => setCategory(e.target.value as FileCategory)}>
              {FILE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="file-notes" className="text-xs text-muted-foreground">Note (optional)</Label>
            <Input id="file-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Page 2 shows the deadline" />
          </div>
          <div className="flex items-end">
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onPick(e.target.files)}
              aria-label="Choose files to attach"
            />
            <Button onClick={() => inputRef.current?.click()}>
              <FileUp className="h-4 w-4" />
              Attach files
            </Button>
          </div>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/50 p-3">
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {fileCategoryLabel(f.category)} · {f.sizeLabel} · {formatDate(f.uploadedAt)}
                    {f.notes && ` · ${f.notes}`}
                  </p>
                </div>
                <FileStatusBadge status={f.status} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => {
                    if (window.confirm(`Remove "${f.name}" from this case?`)) deleteFile(f.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Callout variant="info">
          In this local MVP, file details are tracked but the file itself stays on your device —
          nothing is uploaded to a server. Production BureauOS stores files in encrypted cloud
          storage (S3 / Supabase Storage).
        </Callout>
      </CardContent>
    </Card>
  );
}
