#!/usr/bin/env node
/**
 * Dependency gate for CI: `npm audit` over the PRODUCTION dependency tree,
 * failing on any high or critical advisory that is not in audit-allowlist.json
 * with an unexpired review. Expired entries fail too, so a tolerated advisory
 * is re-examined rather than forgotten.
 *
 *   npm run audit:gate
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BLOCKING = new Set(["high", "critical"]);
const today = new Date().toISOString().slice(0, 10);

const allowlist = JSON.parse(readFileSync("audit-allowlist.json", "utf8")).advisories;
const allowed = new Map(allowlist.map((a) => [a.id, a]));

let report;
try {
  report = execSync("npm audit --omit=dev --json", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (err) {
  // npm audit exits non-zero whenever it finds anything; the JSON is still on stdout.
  report = err.stdout;
}
const data = JSON.parse(report || "{}");
if (data.error) {
  console.error("npm audit failed:", data.error.summary ?? data.error);
  process.exit(1);
}

const failures = [];
const tolerated = [];
const seen = new Set();
for (const vuln of Object.values(data.vulnerabilities ?? {})) {
  for (const via of vuln.via ?? []) {
    if (typeof via === "string") continue; // a transitive pointer; the advisory itself is listed elsewhere
    const id = String(via.url ?? "").split("/").pop() || String(via.source);
    if (seen.has(id)) continue;
    seen.add(id);
    const entry = allowed.get(id);
    if (entry && entry.expires >= today) {
      tolerated.push(`${id} (${via.severity}, ${via.name}) — reviewed ${entry.reviewed}, expires ${entry.expires}`);
    } else if (BLOCKING.has(via.severity)) {
      failures.push(`${id} (${via.severity}) ${via.name}: ${via.title}${entry ? ` — allowlist entry EXPIRED ${entry.expires}` : ""}`);
    }
  }
}

for (const entry of allowlist) {
  if (entry.expires < today) failures.push(`${entry.id}: allowlist entry expired on ${entry.expires} — re-review or upgrade`);
}

if (tolerated.length) console.log(`Tolerated (reviewed) advisories:\n  ${tolerated.join("\n  ")}`);
if (failures.length) {
  console.error(`\nBlocking advisories in production dependencies:\n  ${[...new Set(failures)].join("\n  ")}`);
  process.exit(1);
}
console.log("\nNo unreviewed high or critical advisories in production dependencies.");
