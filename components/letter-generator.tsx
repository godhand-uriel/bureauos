"use client";

import { useMemo, useState } from "react";
import { Check, Copy, FilePen, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Callout } from "@/components/callout";
import { useBureauStore } from "@/lib/store";
import type { AnswerValue, LetterTemplate } from "@/lib/types";

interface LetterGeneratorProps {
  caseId: string;
  template: LetterTemplate;
  answers: Record<string, AnswerValue>;
}

/**
 * Three-step letter workflow: fill fields (prefilled from intake answers
 * where mapped) → generate → edit/copy/save.
 *
 * The letter is rendered by the server, which holds the letter text and
 * checks the case's entitlement — this component only collects the fields.
 */
export function LetterGenerator({ caseId, template, answers }: LetterGeneratorProps) {
  const renderLetter = useBureauStore((s) => s.renderLetter);
  const saveLetter = useBureauStore((s) => s.saveLetter);

  const initialValues = useMemo(() => {
    const v: Record<string, string> = {};
    for (const f of template.fields) {
      if (f.fromAnswer) {
        const a = answers[f.fromAnswer];
        if (typeof a === "string") v[f.id] = a;
        else if (typeof a === "object" && a !== null && !Array.isArray(a)) v[f.id] = a.name;
      }
    }
    return v;
  }, [template, answers]);

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [body, setBody] = useState<string | null>(null);
  const [busy, setBusy] = useState<"generate" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const generate = async () => {
    setBusy("generate");
    setError(null);
    const result = await renderLetter(caseId, template.id, values);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody(result.body);
    setSaved(false);
  };

  const save = async () => {
    if (!body) return;
    setBusy("save");
    setError(null);
    const result = await saveLetter(caseId, { templateId: template.id, title: template.name, body });
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
  };

  const copy = async () => {
    if (!body) return;
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — user can select manually.
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FilePen className="h-4 w-4 text-primary" />
          {template.name}
        </CardTitle>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {template.fields.map((f) => (
            <div key={f.id} className={f.multiline ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
              <Label htmlFor={`${template.id}-${f.id}`} className="text-xs text-muted-foreground">
                {f.label}
              </Label>
              {f.multiline ? (
                <Textarea
                  id={`${template.id}-${f.id}`}
                  rows={3}
                  value={values[f.id] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                  placeholder={f.placeholder}
                />
              ) : (
                <Input
                  id={`${template.id}-${f.id}`}
                  value={values[f.id] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                  placeholder={f.placeholder}
                />
              )}
            </div>
          ))}
        </div>

        <Button onClick={generate} variant={body ? "secondary" : "default"} disabled={busy !== null}>
          {busy === "generate" && <Loader2 className="h-4 w-4 animate-spin" />}
          {body ? "Regenerate letter" : "Generate letter"}
        </Button>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        {body !== null && (
          <div className="space-y-3">
            <Callout variant="info">
              Review and edit the letter below. Anything in [BRACKETS] still needs your input.
            </Callout>
            <Textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setSaved(false);
              }}
              rows={18}
              className="font-mono text-xs leading-relaxed"
              aria-label="Generated letter — editable"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy letter"}
              </Button>
              <Button onClick={save} disabled={saved || busy !== null}>
                {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saved ? "Saved to case" : "Save to case"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
