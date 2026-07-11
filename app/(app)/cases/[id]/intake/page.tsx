"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Callout } from "@/components/callout";
import { DisclaimerGate } from "@/components/disclaimer-gate";
import { IntakeQuestionField, isAnswered, isQuestionVisible } from "@/components/intake-renderer";
import { getNavigator } from "@/lib/navigators";
import { useBureauStore, useCase, useHasAccepted, useHydrated } from "@/lib/store";
import type { AnswerValue } from "@/lib/types";

export default function IntakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const hydrated = useHydrated();
  const kase = useCase(id);
  const saveIntakeProgress = useBureauStore((s) => s.saveIntakeProgress);
  const completeIntake = useBureauStore((s) => s.completeIntake);
  const hasAccepted = useHasAccepted(id);

  // Local draft of answers; persisted on every navigation step.
  const [draft, setDraft] = useState<Record<string, AnswerValue> | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGate, setShowGate] = useState(false);

  const nav = kase ? getNavigator(kase.navigatorSlug) : undefined;

  const answers = useMemo(
    () => draft ?? kase?.intake.answers ?? {},
    [draft, kase?.intake.answers],
  );
  const visibleQuestions = useMemo(
    () => (nav ? nav.questions.filter((q) => isQuestionVisible(q, answers)) : []),
    [nav, answers],
  );

  if (!hydrated || !kase || !nav) return null; // layout handles loading & not-found

  if (kase.intake.completed) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Intake complete</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your answers generated a personalized action plan for this case.
            </p>
          </div>
          <Link href={`/cases/${kase.id}/plan`}>
            <Button>
              View your action plan
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const currentStep = Math.min(step ?? kase.intake.currentStep, Math.max(0, visibleQuestions.length - 1));
  const question = visibleQuestions[currentStep];
  const isLast = currentStep >= visibleQuestions.length - 1;
  const progressPct = visibleQuestions.length === 0 ? 0 : (currentStep / visibleQuestions.length) * 100;

  const setAnswer = (value: AnswerValue) => {
    setDraft({ ...answers, [question.id]: value });
    setError(null);
  };

  const finish = async () => {
    // Await the answer save, then server-side plan generation, then navigate —
    // the plan page reads the engine output that the server produced.
    await saveIntakeProgress(kase.id, answers, currentStep);
    await completeIntake(kase.id);
    router.push(`/cases/${kase.id}/plan`);
  };

  const goNext = () => {
    if (question.required && !isAnswered(question, answers[question.id])) {
      setError("This question is required.");
      return;
    }
    if (isLast) {
      if (!hasAccepted) {
        saveIntakeProgress(kase.id, answers, currentStep);
        setShowGate(true);
        return;
      }
      finish();
      return;
    }
    const next = currentStep + 1;
    saveIntakeProgress(kase.id, answers, next);
    setStep(next);
    setError(null);
  };

  const goBack = () => {
    if (currentStep === 0) return;
    const prev = currentStep - 1;
    saveIntakeProgress(kase.id, answers, prev);
    setStep(prev);
    setError(null);
  };

  if (showGate) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <DisclaimerGate caseId={kase.id} action="generate your action plan">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">You&apos;re all set</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Intake answers saved. Generate your personalized action plan.
                </p>
              </div>
              <Button size="lg" onClick={finish}>
                <Sparkles className="h-4 w-4" />
                Generate my action plan
              </Button>
            </CardContent>
          </Card>
        </DisclaimerGate>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Question {currentStep + 1} of {visibleQuestions.length}
          </span>
          <span>Progress saves automatically</span>
        </div>
        <Progress value={progressPct} />
      </div>

      <Card>
        <CardContent className="p-6 sm:p-8">
          <IntakeQuestionField
            key={question.id}
            question={question}
            value={answers[question.id]}
            onChange={setAnswer}
          />
          {error && (
            <p className="mt-3 text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={goBack} disabled={currentStep === 0}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          {!question.required && !isAnswered(question, answers[question.id]) && !isLast && (
            <Button variant="ghost" onClick={goNext} className="text-muted-foreground">
              Skip
            </Button>
          )}
          <Button onClick={goNext}>
            {isLast ? (
              <>
                <Sparkles className="h-4 w-4" />
                Generate my action plan
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      {currentStep === 0 && (
        <Callout variant="info">
          Answer in plain language — there are no wrong answers. You can change any answer later by
          restarting intake, and everything stays on this device.
        </Callout>
      )}
    </div>
  );
}
