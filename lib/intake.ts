import type { AnswerValue, ContactValue, IntakeQuestion } from "@/lib/types";

/**
 * Pure intake logic shared by the wizard UI and the server.
 *
 * Visibility is evaluated through the whole chain: a follow-up question is
 * visible only if its own condition matches AND the question it depends on is
 * itself visible. Answers to hidden questions are stale by definition and are
 * pruned before rules run, so a deadline can never be calculated from a date
 * the user entered on a branch they later backed out of.
 */

export function isQuestionVisible(
  q: IntakeQuestion,
  answers: Record<string, AnswerValue>,
  questions: IntakeQuestion[] = [],
  depth = 0,
): boolean {
  if (!q.showIf) return true;
  if (answers[q.showIf.questionId] !== q.showIf.equals) return false;
  if (depth > 10) return true; // malformed cyclic content — fail open rather than hang
  const parent = questions.find((p) => p.id === q.showIf!.questionId);
  return parent ? isQuestionVisible(parent, answers, questions, depth + 1) : true;
}

export function visibleQuestions(
  questions: IntakeQuestion[],
  answers: Record<string, AnswerValue>,
): IntakeQuestion[] {
  return questions.filter((q) => isQuestionVisible(q, answers, questions));
}

/** Drop answers belonging to questions that are not currently visible. */
export function pruneHiddenAnswers(
  questions: IntakeQuestion[],
  answers: Record<string, AnswerValue>,
): Record<string, AnswerValue> {
  const known = new Set(questions.map((q) => q.id));
  const visible = new Set(visibleQuestions(questions, answers).map((q) => q.id));
  const pruned: Record<string, AnswerValue> = {};
  for (const [id, value] of Object.entries(answers)) {
    // Keep answers for ids the content no longer defines (harmless history),
    // drop answers for defined-but-hidden questions.
    if (!known.has(id) || visible.has(id)) pruned[id] = value;
  }
  return pruned;
}

/** True if the question has a usable answer. */
export function isAnswered(_q: IntakeQuestion, value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return (value as ContactValue).name.trim() !== "";
  return true; // booleans and numbers
}
