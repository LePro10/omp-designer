#!/usr/bin/env node
/**
 * Designer-quality: rubric schema, issue taxonomy, behavior signals, and report.
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  emptyReview, validateReview, REVIEW_CATEGORY_KEYS, REVIEW_SCALE,
} from "../../shared/design-review.mjs";
import {
  classifyIssues, extractBehaviorSignals, buildDesignQualityReport,
} from "../../shared/design-quality.mjs";

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "designer-quality-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

// Synthetic validator report shapes matching fix-ai-slop / analyze-layout --json.
const qualityReport = (issues) => ({
  blockers: issues.filter((i) => i.severity === "blocker").length,
  warnings: issues.filter((i) => i.severity === "warning").length,
  issues,
});

// ---- Rubric schema ----

test("empty rubric has every category unscored", () => {
  const review = emptyReview();
  assert.equal(Object.keys(review).length, REVIEW_CATEGORY_KEYS.length);
  for (const key of REVIEW_CATEGORY_KEYS) {
    assert.equal(review[key].score, null);
    assert.equal(review[key].reason, "");
  }
  assert.equal(validateReview(review).ok, true);
});

test("a scored category is valid only with an in-range score and a reason", () => {
  const review = emptyReview();
  review.visualHierarchy = { score: 2, reason: "clear single focus per section" };
  assert.equal(validateReview(review).ok, true);

  review.visualHierarchy = { score: 5, reason: "x" };
  assert.equal(validateReview(review).ok, false);

  review.visualHierarchy = { score: 2, reason: "" };
  const missingReason = validateReview(review);
  assert.equal(missingReason.ok, false);
  assert.match(missingReason.errors.join(" "), /requires a reason/);
});

test("rubric rejects unknown categories and preserves the 0..2 scale", () => {
  const review = { ...emptyReview(), madeUp: { score: 1, reason: "x" } };
  const result = validateReview(review);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /unknown category/);
  assert.deepEqual({ min: REVIEW_SCALE.min, max: REVIEW_SCALE.max }, { min: 0, max: 2 });
});

// ---- Issue taxonomy: blocker vs warning vs info ----

test("factual fabrication stays a blocker; stylistic warning becomes info", () => {
  const quality = qualityReport([
    { severity: "blocker", rule: "unsupported-percentage", value: "47%" },
    { severity: "warning", rule: "vague-marketing-language", value: "seamless" },
    { severity: "warning", rule: "copy-cadence", value: "a — b" },
  ]);
  const { blockers, warnings, info } = classifyIssues(quality, null);
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].rule, "unsupported-percentage");
  // Taste issues must not block: they land in info, not warnings/blockers.
  assert.equal(warnings.length, 0);
  assert.equal(info.length, 2);
});

test("functional warnings stay warnings, not info", () => {
  const layout = qualityReport([
    { severity: "warning", rule: "responsive-hints-missing", message: "x" },
    { severity: "warning", rule: "reduced-motion-missing", message: "x" },
  ]);
  const { warnings, info } = classifyIssues(null, layout);
  assert.equal(warnings.length, 2);
  assert.equal(info.length, 0);
});

test("explicit user choice against a taste rule never becomes a blocker", () => {
  // User asked for the buzzword on purpose; the validator flags it as a warning.
  // The taxonomy must keep it as info, so taste cannot block the user's decision.
  const quality = qualityReport([{ severity: "warning", rule: "vague-marketing-language", value: "unlock" }]);
  const { blockers, warnings, info } = classifyIssues(quality, null);
  assert.equal(blockers.length, 0);
  assert.equal(warnings.length, 0);
  assert.equal(info.length, 1);
});

// ---- Behavior signals ----

test("missing EVIDENCE.md is signalled when claim-like copy is present", () => {
  const dir = fixture({ "src/App.tsx": "export default () => <p>47% faster</p>;\n" });
  try {
    const quality = qualityReport([{ severity: "blocker", rule: "unsupported-percentage", value: "47%" }]);
    const signals = extractBehaviorSignals({ projectDir: dir, userPrompt: "build a landing page", quality });
    assert.equal(signals.evidenceMdWhenClaims.value, false);
    assert.equal(signals.avoidedUnsupportedNumbers.value, false);
    assert.equal(signals.avoidedUnsupportedNumbers.basis, "automatic");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("clean build reports positive claim-integrity signals", () => {
  const dir = fixture({
    "PRODUCT.md": "- product notes\n",
    "DESIGN.md": "- tokens\n",
    "src/App.tsx": "export default () => <main className=\"md:grid\"><h1>Studio</h1></main>;\n",
  });
  try {
    const quality = qualityReport([]);
    const layout = qualityReport([]);
    const signals = extractBehaviorSignals({ projectDir: dir, userPrompt: "build a website", quality, layout });
    assert.equal(signals.avoidedUnsupportedNumbers.value, true);
    assert.equal(signals.avoidedFakeSocialProof.value, true);
    assert.equal(signals.productMdWhenAppropriate.value, true);
    assert.equal(signals.designMdWhenAppropriate.value, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("navigation signal is n/a without a multi-route need, and checked when routes exist", () => {
  const single = extractBehaviorSignals({ projectDir: null, userPrompt: "build one landing page", quality: qualityReport([]) });
  assert.equal(single.navigationChecked.value, "n/a");

  const dir = fixture({ "src/App.tsx": "import { Link } from 'react-router-dom';\nexport default () => <nav><Link to='/a'>A</Link></nav>;\n" });
  try {
    const multi = extractBehaviorSignals({ projectDir: dir, userPrompt: "build multiple pages with several routes", quality: qualityReport([]) });
    assert.equal(multi.navigationChecked.value, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mobile signal reflects responsive-hints-missing", () => {
  const layoutMissing = qualityReport([{ severity: "warning", rule: "responsive-hints-missing", message: "x" }]);
  const s1 = extractBehaviorSignals({ projectDir: null, userPrompt: "build", layout: layoutMissing });
  assert.equal(s1.mobileLayoutChecked.value, false);

  const layoutOk = qualityReport([]);
  const s2 = extractBehaviorSignals({ projectDir: null, userPrompt: "build", layout: layoutOk });
  assert.equal(s2.mobileLayoutChecked.value, true);
});

test("surprise-me delegation is detected and its Q&A honoring is marked unobservable", () => {
  const s = extractBehaviorSignals({ projectDir: null, userPrompt: "Build a page. Surprise me with the art direction.", quality: qualityReport([]) });
  assert.equal(s.surpriseMeDelegated.value, true);
  assert.equal(s.honoredSurpriseMeWithoutExtraQuestions.basis, "unavailable");
});

// ---- Report assembly ----

test("report has the P4 schema and marks skill reads unavailable", () => {
  const report = buildDesignQualityReport({
    projectDir: null,
    userPrompt: "build a website",
    quality: qualityReport([{ severity: "blocker", rule: "unsupported-social-proof", value: "Trusted by teams" }]),
    layout: qualityReport([{ severity: "warning", rule: "copy-cadence", value: "a — b" }]),
  });
  for (const key of ["designReview", "behaviorSignals", "blockers", "warnings", "info", "skillReadObservability"]) {
    assert.ok(key in report, `report missing ${key}`);
  }
  assert.equal(report.skillReadObservability.status, "unavailable");
  assert.match(report.skillReadObservability.reason, /does not expose skill read events/);
  assert.equal(report.blockers.length, 1);
  assert.equal(report.info.length, 1); // copy-cadence reclassified to info
  assert.equal(validateReview(report.designReview.categories).ok, true);
});

// ---- Integration: real validator JSON flows through the taxonomy ----

test("real fix-ai-slop JSON: fabricated number blocks, buzzword is info", () => {
  const script = new URL("../fix-ai-slop.mjs", import.meta.url).pathname;
  const blockDir = fixture({ "src/App.tsx": "export default () => <p>Teams finish 47% faster.</p>;\n" });
  const tasteDir = fixture({ "src/App.tsx": "export default () => <p>A seamless workflow for your crew.</p>;\n" });
  try {
    const blocked = JSON.parse(spawnSync(process.execPath, [script, "--json", blockDir], { encoding: "utf8" }).stdout);
    assert.equal(classifyIssues(blocked, null).blockers.length >= 1, true);

    const taste = JSON.parse(spawnSync(process.execPath, [script, "--json", tasteDir], { encoding: "utf8" }).stdout);
    const classified = classifyIssues(taste, null);
    assert.equal(classified.blockers.length, 0);
    assert.ok(classified.info.some((i) => i.rule === "vague-marketing-language"));
  } finally {
    rmSync(blockDir, { recursive: true, force: true });
    rmSync(tasteDir, { recursive: true, force: true });
  }
});

test("taste rules drive the default-aesthetic signals", () => {
  const sloppy = extractBehaviorSignals({
    projectDir: null,
    userPrompt: "build a website",
    layout: qualityReport([
      { severity: "warning", rule: "reveal-hidden-content", value: "" },
      { severity: "warning", rule: "ai-default-palette", value: "#7c5cfc" },
      { severity: "warning", rule: "gradient-imagery", value: "" },
    ]),
  });
  assert.equal(sloppy.contentVisibleAtInitialPaint.value, false);
  assert.equal(sloppy.contentVisibleAtInitialPaint.basis, "automatic");
  assert.equal(sloppy.avoidedDefaultAiPalette.value, false);
  assert.equal(sloppy.avoidedGradientImagery.value, false);

  const clean = extractBehaviorSignals({ projectDir: null, userPrompt: "build a website", layout: qualityReport([]) });
  assert.equal(clean.contentVisibleAtInitialPaint.value, true);
  assert.equal(clean.avoidedDefaultAiPalette.value, true);
  assert.equal(clean.avoidedGradientImagery.value, true);

  const unknown = extractBehaviorSignals({ projectDir: null, userPrompt: "build a website" });
  assert.equal(unknown.avoidedDefaultAiPalette.value, "n/a");
});

let failed = 0;
for (const { name, fn } of cases) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error.stack || error.message);
  }
}

if (failed > 0) process.exit(1);
console.log(`\n${cases.length} designer-quality tests passed`);
