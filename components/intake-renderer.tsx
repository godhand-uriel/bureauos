"use client";

import { Check, Paperclip } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AnswerValue, ContactValue, IntakeQuestion } from "@/lib/types";

interface IntakeQuestionFieldProps {
  question: IntakeQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}

/**
 * Renders a single intake question by type. Used by the intake wizard;
 * reusable anywhere a question needs rendering (e.g. review screens).
 */
export function IntakeQuestionField({ question, value, onChange }: IntakeQuestionFieldProps) {
  const q = question;

  return (
    <div className="space-y-2">
      <Label htmlFor={q.id} className="text-base font-semibold leading-snug">
        {q.label}
        {q.required && <span className="ml-1 text-red-400">*</span>}
      </Label>
      {q.help && <p className="text-sm text-muted-foreground">{q.help}</p>}

      <div className="pt-1">
        {q.type === "text" && (
          <Input
            id={q.id}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={q.placeholder}
          />
        )}

        {q.type === "textarea" && (
          <Textarea
            id={q.id}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={q.placeholder}
            rows={4}
          />
        )}

        {q.type === "number" && (
          <Input
            id={q.id}
            type="number"
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            placeholder={q.placeholder}
          />
        )}

        {q.type === "date" && (
          <Input
            id={q.id}
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        )}

        {q.type === "select" && (
          <Select
            id={q.id}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="" disabled>
              Select an option…
            </option>
            {q.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}

        {q.type === "multiselect" && (
          <div className="space-y-2">
            {q.options?.map((o) => {
              const selected = Array.isArray(value) && value.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    const current = Array.isArray(value) ? value : [];
                    onChange(
                      selected
                        ? current.filter((v) => v !== o.value)
                        : [...current, o.value],
                    );
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                    selected
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-card/50 hover:border-primary/30",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border shadow-sm",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
                    )}
                  >
                    {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                  {o.label}
                </button>
              );
            })}
          </div>
        )}

        {q.type === "boolean" && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: true, label: "Yes" },
              { v: false, label: "No" },
            ].map((opt) => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => onChange(opt.v)}
                className={cn(
                  "rounded-lg border p-3 text-sm font-medium transition-colors",
                  value === opt.v
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border bg-card/50 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {q.type === "file" && (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-border p-4">
            <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm text-muted-foreground">
                File uploads are coming soon. For now, note where this document is stored so you can find it fast.
              </p>
              <Input
                id={q.id}
                value={(value as string) ?? ""}
                onChange={(e) => onChange(e.target.value)}
                placeholder="e.g. Photo on my phone / folder on my desktop / physical file"
              />
            </div>
          </div>
        )}

        {q.type === "contact" && (
          <ContactField id={q.id} value={value as ContactValue | undefined} onChange={onChange} />
        )}
      </div>
    </div>
  );
}

function ContactField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: ContactValue | undefined;
  onChange: (v: AnswerValue) => void;
}) {
  const v: ContactValue = value ?? { name: "" };
  const update = (patch: Partial<ContactValue>) => onChange({ ...v, ...patch });

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Input
        id={id}
        value={v.name}
        onChange={(e) => update({ name: e.target.value })}
        placeholder="Name"
        aria-label="Contact name"
      />
      <Input
        value={v.organization ?? ""}
        onChange={(e) => update({ organization: e.target.value })}
        placeholder="Organization"
        aria-label="Contact organization"
      />
      <Input
        value={v.phone ?? ""}
        onChange={(e) => update({ phone: e.target.value })}
        placeholder="Phone"
        aria-label="Contact phone"
      />
      <Input
        value={v.email ?? ""}
        onChange={(e) => update({ email: e.target.value })}
        placeholder="Email"
        aria-label="Contact email"
      />
    </div>
  );
}

/** Evaluates conditional visibility for a question against current answers. */
export function isQuestionVisible(
  q: IntakeQuestion,
  answers: Record<string, AnswerValue>,
): boolean {
  if (!q.showIf) return true;
  return answers[q.showIf.questionId] === q.showIf.equals;
}

/** True if the question has a usable answer. */
export function isAnswered(q: IntakeQuestion, value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return (value as ContactValue).name.trim() !== "";
  return true; // booleans and numbers
}
