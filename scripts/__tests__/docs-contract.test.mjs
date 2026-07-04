#!/usr/bin/env node
/**
 * Documentation consistency contract.
 *
 * String-based guards (no generator) that keep the docs aligned with the current
 * v5 architecture: five skills, no skill-read hard gate, honest OMP/Pi
 * difference, simulated-vs-real E2E clarity, and secret hygiene.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const readme = read("README.md");
const agents = read("AGENTS.md");
const architecture = read("architecture.md");
const problems = read("docs/problems.md");
const extensionApi = read("docs/extension-api.md");
const pkg = JSON.parse(read("package.json"));
const piAdapter = read("extensions/designer.ts");

const checks = [
  ["package ships the shared core (incl. security.mjs)", pkg.files.some((f) => f === "shared/security.mjs" || f === "shared/" || f === "shared")],
  ["package description states the 4-skill architecture", String(pkg.description).includes("4 conditional skills")],
  ["test script runs the simulated host-bridge suite", /test:e2e/.test(pkg.scripts.test)],

  // No current-tense v4 hard gate claim.
  ["README states no skill-read requirement", /no requirement\s+to read every skill|not technically enforced/i.test(readme)],
  ["AGENTS states no skill-read hard gate", /no skill-read hard gate/i.test(agents)],
  ["extension-api states no skill-read hard gate", /no skill-read hard gate/i.test(extensionApi)],
  ["AGENTS forbids resurrecting the v4 gate", /Resurrect the v4 skill-read hard gate/i.test(agents)],

  // OMP vs Pi honesty (no parity claim).
  ["README documents the OMP/Pi capability difference", /Hosts: OMP and Pi/.test(readme)],
  ["README states Pi has no delivery backstop", /no delivery-check backstop/i.test(readme)],
  ["architecture describes a separate Pi flow", /Runtime flow \(Pi\)/.test(architecture)],
  ["Pi adapter header does not claim parity", !/same focused workflow as OMP/i.test(piAdapter) && /NOT at parity/i.test(piAdapter)],

  // Post-execution framing.
  ["architecture frames session_stop as post-execution detection", /post-execution detection, not pre-execution enforcement/i.test(architecture)],

  // Simulated vs real E2E.
  ["README distinguishes simulated e2e from real OMP", /simulated evidence, not proof/i.test(readme)],
  ["README notes real-omp smoke can skip", /--real-omp[\s\S]*SKIPPED/i.test(readme)],
  ["architecture notes real-omp SKIPPED not PASS", /SKIPPED[\s\S]{0,15}never[\s\S]{0,15}PASS/i.test(architecture)],

  // Four skills present in the primary docs.
  ["README mentions five skills", /five conditional skills/i.test(readme)],
  ["architecture skills table lists four skills", /designer-master[\s\S]*design-md[\s\S]*animate[\s\S]*review-skill/i.test(architecture)],

  // Secret hygiene.
  ["README says .env stays outside the repo", /keep real\s+credentials outside the repo|\.env is gitignored/i.test(readme)],
  ["AGENTS requires key rotation if exposed", /if a live\s+key was ever exposed[\s\S]*rotate it/i.test(agents)],
  ["problems.md records P0/P1/P2 status", /P0 — Security[\s\S]*P1 — Core logic[\s\S]*P2 — Host-bridge/i.test(problems)],
  ["problems.md keeps publish NO-GO", /Publish: NO-GO/i.test(problems)],
];

let failed = 0;
for (const [name, pass] of checks) {
  if (pass) console.log(`ok - ${name}`);
  else {
    failed += 1;
    console.error(`not ok - ${name}`);
  }
}

assert.equal(failed, 0);
console.log(`\n${checks.length} docs contract tests passed`);
