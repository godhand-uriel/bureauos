"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout } from "@/components/callout";
import { DocumentChecklist } from "@/components/document-checklist";
import { EmptyState } from "@/components/empty-state";
import { FileUploadPanel } from "@/components/file-upload-panel";
import { useBureauStore, useCase, useHydrated } from "@/lib/store";

export default function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const kase = useCase(id);
  const setDocumentStatus = useBureauStore((s) => s.setDocumentStatus);
  const files = useBureauStore((s) => s.files).filter((f) => f.caseId === id);

  if (!hydrated || !kase) return null;

  if (kase.documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No document checklist yet"
        description="Your document checklist is generated with your action plan after intake."
        action={
          <Link href={`/cases/${kase.id}/intake`}>
            <Button>
              {kase.intake.completed ? "Go to plan" : "Start intake"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        }
      />
    );
  }

  const obtained = kase.documents.filter((d) => d.status === "obtained").length;
  const relevant = kase.documents.filter((d) => d.status !== "not_applicable").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Document checklist
            <span className="text-xs font-normal text-muted-foreground">
              {obtained}/{relevant} obtained
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentChecklist
            documents={kase.documents}
            onStatusChange={(docId, status) => setDocumentStatus(kase.id, docId, status)}
          />
        </CardContent>
      </Card>

      <FileUploadPanel caseId={kase.id} files={files} />

      <Callout variant="info" title="Working with originals">
        Keep original documents safe and work from copies. When you obtain a document, note where
        it&apos;s stored — physical folder, phone photos, or cloud drive — so you can produce it fast
        when an agency asks.
      </Callout>
    </div>
  );
}
