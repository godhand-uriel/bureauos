import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { NAVIGATORS } from "@/lib/navigators";
import { getLetterRenderer, listLetterRenderers } from "@/lib/server/letters";
import { isPaidNavigator, PAID_NAVIGATORS } from "@/lib/launch";

/**
 * Letter text is server-only so the paid letter generator cannot be read out
 * of the browser bundle. These tests keep that true as the code changes.
 */

const ROOT = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("letter templates and their server-side renderers stay in step", () => {
  it("every template has a renderer, and every renderer has a template", () => {
    const templates = NAVIGATORS.flatMap((n) => n.letterTemplates.map((t) => `${n.slug}/${t.id}`)).sort();
    const renderers = listLetterRenderers().map((r) => `${r.slug}/${r.templateId}`).sort();
    expect(renderers).toEqual(templates);
    expect(templates.length).toBeGreaterThanOrEqual(8);
  });

  it("template metadata carries no render function", () => {
    for (const nav of NAVIGATORS) {
      for (const template of nav.letterTemplates) {
        expect(Object.values(template).some((v) => typeof v === "function")).toBe(false);
      }
    }
  });

  it("renders bracketed prompts for blanks and never leaks 'undefined'", () => {
    for (const nav of NAVIGATORS) {
      for (const template of nav.letterTemplates) {
        const render = getLetterRenderer(nav.slug, template.id)!;
        const blank = render({}, { senderName: "Test Sender", todayLong: "January 2, 2027", caseTitle: "A case" });
        expect(blank).toContain("Test Sender");
        expect(blank).toContain("January 2, 2027");
        expect(blank).toMatch(/\[[A-Z][^\]]+\]/);
        expect(blank).not.toMatch(/undefined|\[object Object\]|NaN/);

        const filled = render(
          Object.fromEntries(template.fields.map((f) => [f.id, `VALUE_${f.id}`])),
          { senderName: "Test Sender", todayLong: "January 2, 2027", caseTitle: "A case" },
        );
        for (const field of template.fields) expect(filled).toContain(`VALUE_${field.id}`);
      }
    }
  });

  it("unknown navigator or template has no renderer", () => {
    expect(getLetterRenderer("job-separation", "nope")).toBeNull();
    expect(getLetterRenderer("nope", "final-paycheck-followup")).toBeNull();
    // A template id never resolves through a different navigator.
    expect(getLetterRenderer("dmv", "final-paycheck-followup")).toBeNull();
  });

  it("letters make no promise of an outcome and do not claim to be legal advice", () => {
    for (const { slug, templateId } of listLetterRenderers()) {
      const text = getLetterRenderer(slug, templateId)!({}, { senderName: "S", todayLong: "D", caseTitle: "C" });
      expect(text).not.toMatch(/guarantee|my attorney|legal counsel for|we will win/i);
    }
  });
});

describe("launch scope", () => {
  it("only the Job Separation navigator is live and has a paid product", () => {
    expect([...PAID_NAVIGATORS]).toEqual(["job-separation"]);
    expect(NAVIGATORS.map((n) => n.slug).sort()).toEqual(
      ["dmv", "insurance-denial", "job-separation", "small-business", "tenant-rights", "veteran-benefits"],
    );
    for (const nav of NAVIGATORS) {
      expect(nav.launchStatus).toBe(nav.slug === "job-separation" ? "live" : "preview");
      // A paid product is only ever attached to a live navigator.
      if (isPaidNavigator(nav.slug)) expect(nav.launchStatus).toBe("live");
    }
    expect(NAVIGATORS[0].slug).toBe("job-separation");
  });
});

describe("server-only code stays out of the browser bundle", () => {
  const clientFiles = [...sourceFiles(path.join(ROOT, "app")), ...sourceFiles(path.join(ROOT, "components"))]
    .filter((file) => /^\s*["']use client["']/.test(readFileSync(file, "utf8")));

  it("no client component imports from lib/server", () => {
    expect(clientFiles.length).toBeGreaterThan(20);
    const offenders = clientFiles.filter((file) => /from\s+["']@\/lib\/server\//.test(readFileSync(file, "utf8")));
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it("modules shared with the client never import letter bodies or server code", () => {
    const shared = [
      ...sourceFiles(path.join(ROOT, "lib", "navigators")),
      ...["store.ts", "launch.ts", "types.ts", "plan-engine.ts", "deadline-rules.ts", "assistant.ts", "packages.ts"].map(
        (f) => path.join(ROOT, "lib", f),
      ),
    ];
    const offenders = shared.filter((file) => /from\s+["'](@\/lib\/server\/|\.\.?\/server\/)/.test(readFileSync(file, "utf8")));
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});
