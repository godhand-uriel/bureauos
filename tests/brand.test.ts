import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { BRAND_NAME } from "@/lib/brand";
import { DISCLAIMER_VERSION } from "@/lib/constants";

/**
 * Brand guard: the product is Building202. Customer-facing code must not
 * name BureauOS or bring back the split "Bureau/OS" logo. Internal
 * identifiers that kept the old spelling on purpose are lowercase
 * (`bureauos-…`, `[bureauos]`) or the `BUREAUOS_` environment prefix — see
 * docs/production_readiness.md → "Brand and legacy identifiers".
 */

const ROOT = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const CUSTOMER_FACING = ["app", "components", "lib"].flatMap((d) => sourceFiles(path.join(ROOT, d)));

/** Files allowed to mention the old name, and why. */
const HISTORY_NOTES = new Set([
  path.join(ROOT, "lib", "brand.ts"), // explains the rename
  path.join(ROOT, "lib", "constants.ts"), // acceptance-version history
]);

describe("Building202 brand", () => {
  it("is the public name", () => {
    expect(BRAND_NAME).toBe("Building202");
  });

  it("no customer-facing code names BureauOS", () => {
    const offenders = CUSTOMER_FACING.filter(
      (f) => !HISTORY_NOTES.has(f) && /Bureau ?OS\b/.test(readFileSync(f, "utf8")),
    );
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it("the split Bureau/OS wordmark is gone, and every shell uses the shared wordmark", () => {
    const split = CUSTOMER_FACING.filter((f) => /Bureau<span/.test(readFileSync(f, "utf8")));
    expect(split).toEqual([]);
    for (const rel of [
      "components/public-shell.tsx",
      "components/app-shell.tsx",
      "components/auth-card.tsx",
      "app/login/page.tsx",
      "app/signup/page.tsx",
    ]) {
      expect(readFileSync(path.join(ROOT, rel), "utf8")).toContain("<BrandWordmark");
    }
  });

  it("page titles, Open Graph and the canonical base use the brand and the configured URL", () => {
    const layout = readFileSync(path.join(ROOT, "app", "layout.tsx"), "utf8");
    expect(layout).toContain("template: `%s · ${BRAND_NAME}`");
    expect(layout).toContain("siteName: BRAND_NAME");
    expect(layout).toContain("metadataBase: new URL(appOrigin())");
  });

  it("the domain is configuration, not code: building202.com appears only in docs and examples", () => {
    const hardcoded = CUSTOMER_FACING.filter((f) => /building202\.com/i.test(readFileSync(f, "utf8")));
    expect(hardcoded.map((f) => path.relative(ROOT, f))).toEqual([]);
    expect(readFileSync(path.join(ROOT, ".env.example"), "utf8")).toContain('BUREAUOS_APP_URL="https://building202.com"');
  });

  it("the legal documents carry the brand and a new acceptance version", () => {
    expect(DISCLAIMER_VERSION).toBe("2026-10-18.v3");
    for (const doc of ["terms", "privacy", "disclaimer"]) {
      const text = readFileSync(path.join(ROOT, "app", "legal", doc, "page.tsx"), "utf8");
      expect(text).toContain("Building202");
      expect(text).toContain("LegalDraftNotice"); // still marked pending attorney review
    }
  });
});
