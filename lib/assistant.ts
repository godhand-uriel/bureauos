import { getNavigator } from "@/lib/navigators";
import type { NavigatorDef } from "@/lib/types";

/**
 * BureauOS assistant — rule-based provider.
 *
 * This module implements `AssistantProvider` with deterministic keyword
 * routing so the assistant works with zero API keys. To upgrade to a real
 * model (Anthropic, OpenAI, OpenRouter, local), implement the same interface
 * behind an API route and swap the provider where the assistant page calls
 * `ruleBasedProvider` (see README → AI assistant).
 */

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Optional action chips rendered under an assistant message. */
  actions?: AssistantAction[];
}

export interface AssistantAction {
  label: string;
  kind: "navigate" | "say";
  /** href for navigate, canned user utterance for say. */
  value: string;
}

export interface AssistantProvider {
  reply(history: { role: "user" | "assistant"; text: string }[]): Promise<{
    text: string;
    actions?: AssistantAction[];
  }>;
}

const KEYWORDS: Record<string, string[]> = {
  dmv: ["dmv", "license", "registration", "suspend", "suspension", "reinstate", "drive", "driving", "vehicle", "plates", "smog", "title", "real id"],
  "job-separation": ["fired", "laid off", "layoff", "quit", "job", "unemployment", "paycheck", "severance", "cobra", "terminated", "employer", "work", "boss"],
  "small-business": ["business", "llc", "corporation", "permit", "annual report", "franchise tax", "ein", "compliance", "license my", "sales tax", "sole prop"],
  "insurance-denial": ["insurance", "claim", "denied", "denial", "appeal", "coverage", "eob", "medically necessary", "adjuster", "premium"],
  "veteran-benefits": ["va ", "veteran", "military", "service-connected", "disability rating", "gi bill", "dd-214", "dd214", "c&p", "vso"],
  "tenant-rights": ["landlord", "rent", "lease", "evict", "eviction", "repair", "deposit", "apartment", "tenant", "mold", "leak", "heater", "housing"],
};

export function matchNavigator(text: string): { nav: NavigatorDef; score: number } | null {
  const lower = ` ${text.toLowerCase()} `;
  let best: { slug: string; score: number } | null = null;
  for (const [slug, words] of Object.entries(KEYWORDS)) {
    const score = words.reduce((n, w) => (lower.includes(w) ? n + 1 : n), 0);
    if (score > 0 && (!best || score > best.score)) best = { slug, score };
  }
  if (!best) return null;
  const nav = getNavigator(best.slug);
  return nav ? { nav, score: best.score } : null;
}

export const GREETING: { text: string; actions: AssistantAction[] } = {
  text: "Hi — I'm the BureauOS assistant. Tell me what's going on in your own words, and I'll point you to the right navigator, explain what information you'll need, and set you up to start a case.\n\nA sentence or two is plenty. What are you dealing with?",
  actions: [
    { label: "My license got suspended", kind: "say", value: "My license got suspended" },
    { label: "I just lost my job", kind: "say", value: "I just lost my job" },
    { label: "My insurance claim was denied", kind: "say", value: "My insurance claim was denied" },
    { label: "My landlord won't fix things", kind: "say", value: "My landlord won't do repairs" },
    { label: "I'm preparing a VA claim", kind: "say", value: "I'm a veteran preparing a VA disability claim" },
    { label: "Business compliance help", kind: "say", value: "I need help keeping my small business compliant" },
  ],
};

function summarize(userText: string): string {
  const t = userText.trim().replace(/\s+/g, " ");
  return t.length > 180 ? `${t.slice(0, 177)}…` : t;
}

export const ruleBasedProvider: AssistantProvider = {
  async reply(history) {
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    if (!lastUser) return GREETING;

    const text = lastUser.text;

    // Follow-up intents on an already-matched navigator.
    const prevAssistant = [...history].reverse().find((m) => m.role === "assistant");
    const matched = matchNavigator(
      history.filter((m) => m.role === "user").map((m) => m.text).join(" \n"),
    );

    if (/what (documents|do i need)|documents/i.test(text) && matched && prevAssistant) {
      const docs = matched.nav.baseDocuments.map((d) => `• ${d.name}${d.required ? " (required)" : ""}`).join("\n");
      return {
        text: `For a ${matched.nav.shortName} case, here's what typically ends up on the document checklist:\n\n${docs}\n\nDon't worry if you're missing some — the case tracks each one, and the action plan includes how to obtain them.`,
        actions: [
          { label: `Start a ${matched.nav.shortName} case`, kind: "navigate", value: `/cases/new?navigator=${matched.nav.slug}` },
          { label: "How does intake work?", kind: "say", value: "How does intake work?" },
        ],
      };
    }

    if (/how does intake|intake work|what happens next/i.test(text) && matched) {
      return {
        text: `Intake is ${matched.nav.questions.length} plain-language questions — things like what happened, which state you're in, and what documents you already have. Your progress saves after every question.\n\nWhen you finish, BureauOS generates a personalized action plan: a summary of your situation, your next three moves, a document checklist, deadlines to verify, and any risk flags. From there the case command center tracks everything.`,
        actions: [
          { label: `Start a ${matched.nav.shortName} case`, kind: "navigate", value: `/cases/new?navigator=${matched.nav.slug}` },
        ],
      };
    }

    const match = matchNavigator(text) ?? matched;
    if (match) {
      const { nav } = match;
      return {
        text: `Here's what I'm hearing: "${summarize(text)}"\n\nThat fits the **${nav.name}** — ${nav.tagline.toLowerCase()}\n\nIt handles things like:\n${nav.problems.slice(0, 3).map((p) => `• ${p}`).join("\n")}\n\nNext steps: start a case, answer the guided intake (~5 minutes, saves as you go), and you'll get a personalized action plan with your next three moves, documents to gather, and deadlines to watch.\n\nOne honest note: I help you organize and prepare — I don't give legal advice.`,
        actions: [
          { label: `Start a ${nav.shortName} case`, kind: "navigate", value: `/cases/new?navigator=${nav.slug}` },
          { label: "What documents will I need?", kind: "say", value: "What documents do I need?" },
          { label: "How does intake work?", kind: "say", value: "How does intake work?" },
          { label: "It's something else", kind: "say", value: "It's actually about something else" },
        ],
      };
    }

    return {
      text: "I want to route you to the right place, and I'm not sure yet which of the six navigators fits. Could you tell me a bit more? For example, who's involved — a DMV, an employer, an insurance company, a landlord, the VA, or your own business?",
      actions: GREETING.actions,
    };
  },
};
