"use client";

import { use, useState } from "react";
import { BadgeCheck, Check, Copy, FilePen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/callout";
import { CasePassOffer } from "@/components/case-pass-offer";
import { DisclaimerGate } from "@/components/disclaimer-gate";
import { LetterGenerator } from "@/components/letter-generator";
import { getNavigator } from "@/lib/navigators";
import { isPaidNavigator } from "@/lib/launch";
import { useBureauStore, useCase, useCasePass, useHydrated, useIsAdmin } from "@/lib/store";
import { cn, formatDateTime } from "@/lib/utils";

export default function LettersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const kase = useCase(id);
  const isAdmin = useIsAdmin();
  const hasPass = useCasePass(id);
  const updateLetter = useBureauStore((s) => s.updateLetter);
  const deleteLetter = useBureauStore((s) => s.deleteLetter);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (!hydrated || !kase) return null;
  const nav = getNavigator(kase.navigatorSlug);
  if (!nav) return null;

  const suggested = kase.plan?.suggestedLetterTemplateId;
  const paid = isPaidNavigator(kase.navigatorSlug);
  // Display only: the server makes the same decision on every render and save.
  const locked = paid && !hasPass && !isAdmin;

  const copySaved = async (letterId: string, body: string) => {
    try {
      await navigator.clipboard.writeText(body);
      setCopiedId(letterId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard unavailable — user can select the text manually.
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {paid && hasPass && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-400" />
          Case Pass active — the letter generator is unlocked for this case.
        </div>
      )}

      {suggested && (
        <Callout variant="info" title="Suggested for this case">
          Your action plan points to the{" "}
          <span className="font-semibold">
            {nav.letterTemplates.find((t) => t.id === suggested)?.name ?? "letter"}
          </span>
          {locked ? "." : " below. Fields are prefilled from your intake answers where possible."}
        </Callout>
      )}

      {locked ? (
        <>
          <CasePassOffer caseId={kase.id} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Letters in this navigator</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {nav.letterTemplates.map((t) => (
                  <li key={t.id}>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-sm text-muted-foreground">{t.description}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : (
        /* Generators (gated behind the per-case disclaimer acceptance) */
        <DisclaimerGate caseId={kase.id} action="generate letters">
          {nav.letterTemplates.map((template) => (
            <LetterGenerator
              key={template.id}
              caseId={kase.id}
              template={template}
              answers={kase.intake.answers}
            />
          ))}
        </DisclaimerGate>
      )}

      {/* Saved letters — always yours to read, edit, copy, and delete. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FilePen className="h-4 w-4 text-primary" />
            Saved letters
            <span className="text-xs font-normal text-muted-foreground">{kase.letters.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {kase.letters.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Letters you save appear here, linked to this case.
            </p>
          ) : (
            kase.letters.map((letter) => (
              <div key={letter.id} className="rounded-lg border border-border bg-card/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{letter.title}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      Saved {formatDateTime(letter.createdAt)}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copySaved(letter.id, letter.body)}
                    >
                      {copiedId === letter.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedId === letter.id ? "Copied" : "Copy"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (editingId === letter.id) {
                          // One write when editing ends, not one per keystroke.
                          if (draft.trim() && draft !== letter.body) updateLetter(kase.id, letter.id, draft);
                          setEditingId(null);
                        } else {
                          setDraft(letter.body);
                          setEditingId(letter.id);
                        }
                      }}
                    >
                      {editingId === letter.id ? "Save changes" : "Edit"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Delete letter"
                      onClick={() => {
                        if (window.confirm("Delete this saved letter?")) deleteLetter(kase.id, letter.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                {editingId === letter.id ? (
                  <Textarea
                    className="mt-3 font-mono text-xs leading-relaxed"
                    rows={14}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label={`Edit ${letter.title}`}
                  />
                ) : (
                  <pre
                    className={cn(
                      "mt-3 max-h-40 overflow-hidden whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground",
                      "[mask-image:linear-gradient(to_bottom,black_60%,transparent)]",
                    )}
                  >
                    {letter.body}
                  </pre>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Callout variant="warning" title="Before you send">
        These letters are starting points, not legal documents, and Building202 does not send or file
        anything for you. Fill every [BRACKETED] gap, verify names, numbers, and dates, and keep a
        copy of everything you send — ideally with delivery tracking.
      </Callout>
    </div>
  );
}
