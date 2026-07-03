#!/usr/bin/env node
/**
 * Model-backed designer evaluation.
 *
 * Every generated project is isolated under test-output/. The report compares
 * deterministic checks, build status, artifacts, and screenshot evidence with
 * an existing baseline project.
 */

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { inspectOmpSystem } from "./lifecycle-lib.mjs";

const root = process.cwd();
const args = process.argv.slice(2);

function value(flag, fallback = "") {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const runName = value("--run");
const caseName = value("--case", "saas");
const baselineArg = value("--baseline");
const model = value("--model", "opencode-go/deepseek-v4-flash:xhigh");
const maxTime = Number(value("--max-time", "600"));
const evaluateOnly = args.includes("--evaluate-only");
const packageVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

const prompts = {
  saas: "Build a responsive one-page website for Fieldnote, a tool that helps small field-service teams keep site notes, photos, decisions, and follow-up tasks together. Use React and TypeScript. This is an early product, so do not invent prices, customer logos, metrics, testimonials, certifications, or integrations. Make the result specific to work happening on physical job sites. Build immediately without asking questions.",
  editorial: "Build a responsive long-form article page for an independent architecture journal. Reading hierarchy, image captions, references, and mobile typography matter more than a dramatic hero. Use React and TypeScript. Build immediately without asking questions.",
  edit: "Inspect the existing project and improve only its header and hero. Preserve its routes, copy facts, dependencies, and visual identity. Do not add sections or rewrite the application.",
};

if (!runName && !evaluateOnly) {
  console.error("Usage: node scripts/real-agent-eval.mjs --run <name> [--case saas|editorial] [--baseline <path>]");
  process.exit(2);
}
if (!(caseName in prompts)) {
  console.error(`Unknown case: ${caseName}`);
  process.exit(2);
}
if (!Number.isFinite(maxTime) || maxTime < 30 || maxTime > 1800) {
  console.error("--max-time must be between 30 and 1800 seconds");
  process.exit(2);
}

const outputRoot = resolve(root, "test-output");
const target = runName ? resolve(outputRoot, runName) : resolve(value("--target"));
if (!target.startsWith(`${outputRoot}/`)) {
  console.error("Target must be a child of test-output/");
  process.exit(2);
}
const baseline = baselineArg ? resolve(root, baselineArg) : null;
const reportsDir = join(outputRoot, "reports");
const reportPath = join(reportsDir, `${basename(target)}.json`);

function previousAgentEvidence() {
  if (!evaluateOnly || !existsSync(reportPath)) return null;
  try {
    return JSON.parse(readFileSync(reportPath, "utf8")).agent ?? null;
  } catch {
    return null;
  }
}

function designerTracePath(dir) {
  const base = dir.split(/[\\/]/).filter(Boolean).at(-1) ?? "root";
  const hash = createHash("sha256").update(dir).digest("hex").slice(0, 12);
  return join(homedir(), ".omp", "agent", "designer-traces", `${base}-${hash}.jsonl`);
}

function traceSummary(tracePath, offset = 0) {
  let traceEvents = [];
  if (existsSync(tracePath)) {
    const buffer = readFileSync(tracePath);
    traceEvents = buffer
      .subarray(Math.min(offset, buffer.length))
      .toString("utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { event: "invalid_json" };
        }
      });
  }
  const duplicateEvents = traceEvents.filter((event, index) => {
    const previous = traceEvents[index - 1];
    return previous &&
      event.event === previous.event &&
      event.timestamp === previous.timestamp &&
      event.cwd === previous.cwd;
  }).length;
  const promptInjections = traceEvents.filter((event) => event.event === "prompt_injected").length;
  const deliveryPassed = traceEvents.filter((event) => event.event === "delivery_checks_passed").length;
  const deliveryFailed = traceEvents.filter((event) => event.event === "delivery_checks_failed").length;
  const deliveryOutcomes = deliveryPassed + deliveryFailed;
  return {
    trace: tracePath,
    events: traceEvents.length,
    promptInjections,
    deliveryOutcomes,
    deliveryPassed,
    deliveryFailed,
    duplicateEvents,
    valid: promptInjections > 0 && deliveryPassed > 0 && duplicateEvents === 0,
  };
}

function run(command, commandArgs, cwd, timeout = 120_000, extraEnv = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
    timeout,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, ...extraEnv },
  });
  return {
    ok: result.status === 0,
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

function parseJsonCheck(script, cwd, userFacts = "") {
  const extraEnv = userFacts ? { DESIGNER_USER_FACTS: userFacts } : {};
  const result = run(process.execPath, [script, "--json", cwd], root, 60_000, extraEnv);
  try {
    return { ...result, report: JSON.parse(result.output) };
  } catch {
    return { ...result, report: null };
  }
}

function walkCount(dir, predicate) {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir)) {
    if (["node_modules", "dist", ".git", ".next"].includes(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) count += walkCount(full, predicate);
    else if (predicate(full)) count += 1;
  }
  return count;
}

function matchingFiles(dir, predicate) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (["node_modules", "dist", ".git", ".next"].includes(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...matchingFiles(full, predicate));
    else if (predicate(full)) files.push(full);
  }
  return files;
}

function sourceText(dir) {
  if (!existsSync(dir)) return "";
  const chunks = [];
  const visit = (current) => {
    for (const entry of readdirSync(current)) {
      if (["node_modules", "dist", ".git", ".next"].includes(entry)) continue;
      const full = join(current, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) visit(full);
      else if (/\.(?:tsx|jsx|css|html)$/i.test(full)) chunks.push(readFileSync(full, "utf8"));
    }
  };
  visit(dir);
  return chunks.join("\n");
}

function compositionSignals(dir) {
  const source = sourceText(dir);
  const equalGridSections = (source.match(/\b(?:sm:|md:|lg:|xl:)?grid-cols-[234]\b/g) ?? []).length;
  const roundedSurfaces = (source.match(/\brounded-(?:lg|xl|2xl|3xl)\b/g) ?? []).length;
  const motionComponents = (source.match(/<motion\./g) ?? []).length;
  const signals = [];
  if (equalGridSections >= 3) {
    signals.push("Repeated equal-column grids require visual review; the page may be compositionally repetitive.");
  }
  if (roundedSurfaces >= 12) {
    signals.push("Many rounded surfaces require visual review; verify that containers communicate structure.");
  }
  if (motionComponents >= 8) {
    signals.push("High motion-component count; verify that animation is purposeful rather than default decoration.");
  }
  return { equalGridSections, roundedSurfaces, motionComponents, signals };
}

function buildCheck(dir) {
  if (!existsSync(join(dir, "package.json"))) return { ok: false, status: null, output: "package.json missing" };
  try {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    if (!pkg.scripts?.build) return { ok: false, status: null, output: "build script missing" };
  } catch (error) {
    return { ok: false, status: null, output: String(error) };
  }
  return run("npm", ["run", "build"], dir, 180_000);
}

function evaluate(dir, userFacts = "") {
  const quality = parseJsonCheck(join(root, "scripts", "fix-ai-slop.mjs"), dir, userFacts);
  const layout = parseJsonCheck(join(root, "scripts", "analyze-layout.mjs"), dir);
  const build = buildCheck(dir);
  const artifacts = ["PRODUCT.md", "EVIDENCE.md", "DESIGN.md"].filter((file) => existsSync(join(dir, file)));
  const screenshotPaths = matchingFiles(dir, (path) =>
    /(?:^|[/\\])screenshot-[^/\\]+\.(?:png|webp|jpe?g)$/i.test(path) ||
    /(?:^|[/\\])screenshots[/\\][^/\\]+\.(?:png|webp|jpe?g)$/i.test(path));
  const sourcePaths = matchingFiles(dir, (path) => /\.(?:tsx|jsx|css|html)$/i.test(path));
  const screenshots = screenshotPaths.length;
  const sourceFiles = sourcePaths.length;
  const latestSourceMtime = Math.max(0, ...sourcePaths.map((path) => statSync(path).mtimeMs));
  const screenshotMtimes = screenshotPaths.map((path) => statSync(path).mtimeMs);
  const oldestScreenshotMtime = screenshots > 0 ? Math.min(...screenshotMtimes) : 0;
  const freshScreenshotCount = screenshotMtimes.filter((mtime) => mtime >= latestSourceMtime).length;
  const screenshotsFresh = freshScreenshotCount >= 2;
  const composition = compositionSignals(dir);
  const qualityBlockers = quality.report?.blockers ?? 99;
  const layoutBlockers = layout.report?.blockers ?? 99;
  const warnings = (quality.report?.warnings ?? 0) + (layout.report?.warnings ?? 0);

  let score = 0;
  if (build.ok) score += 35;
  if (qualityBlockers === 0) score += 25;
  if (layoutBlockers === 0) score += 15;
  score += Math.min(15, artifacts.length * 5);
  if (sourceFiles >= 3) score += 5;
  if (screenshotsFresh) score += 5;

  return {
    directory: dir,
    score,
    build: { ok: build.ok, status: build.status, output: build.output.slice(-3000) },
    quality: quality.report ?? { parseError: quality.output.slice(-2000) },
    layout: layout.report ?? { parseError: layout.output.slice(-2000) },
    artifacts,
    screenshots,
    screenshotEvidence: {
      fresh: screenshotsFresh,
      freshCount: freshScreenshotCount,
      latestSourceMtime: latestSourceMtime ? new Date(latestSourceMtime).toISOString() : null,
      oldestScreenshotMtime: oldestScreenshotMtime ? new Date(oldestScreenshotMtime).toISOString() : null,
    },
    sourceFiles,
    warnings,
    composition,
    scoreScope: "Automated delivery score; visual quality requires screenshot review.",
  };
}

async function generate() {
  const installation = inspectOmpSystem();
  const installationProblems = [];
  if (installation.plugin.realpath !== root) {
    installationProblems.push(`plugin source is ${installation.plugin.realpath ?? "not installed"}, expected ${root}`);
  }
  if (installation.plugin.version !== packageVersion || installation.plugin.lockVersion !== packageVersion) {
    installationProblems.push(
      `plugin/lock version is ${installation.plugin.version ?? "none"}/${installation.plugin.lockVersion ?? "none"}, expected ${packageVersion}`,
    );
  }
  if (installation.legacy.extensionExists || installation.legacy.managedSkills.length > 0) {
    installationProblems.push("legacy extension or managed skills are still present");
  }
  if (installationProblems.length > 0) {
    throw new Error(
      `Real-agent generation requires a clean local install. Run 'npm run install:local:clean' first:\n- ${installationProblems.join("\n- ")}`,
    );
  }

  if (existsSync(target) && readdirSync(target).length > 0) {
    throw new Error(`Target already exists and is not empty: ${target}`);
  }
  mkdirSync(target, { recursive: true });

  const prompt = [
    prompts[caseName],
    `Create the complete project directly in ${target}.`,
    "Keep every generated file inside that directory.",
    "Run the build and designer validation commands.",
    "Use browser QA at 375px and 1280px and save at least two screenshots inside the project.",
    "For full-page screenshots, reset scroll to the top so sticky elements are captured in their initial position.",
  ].join(" ");

  const commandArgs = [
    "--cwd",
    target,
    "--model",
    model,
    "--thinking",
    "high",
    "--max-time",
    String(maxTime),
    "-p",
    prompt,
  ];

  console.log(`Starting real-agent run ${runName}`);
  console.log(`Model: ${model}`);
  console.log(`Target: ${target}`);

  const tracePath = designerTracePath(target);
  const traceOffset = existsSync(tracePath) ? statSync(tracePath).size : 0;
  const child = spawn("omp", commandArgs, {
    cwd: target,
    env: { ...process.env, OMP_DESIGNER_MODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let transcript = "";
  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    transcript += text;
    process.stdout.write(text);
  });
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    transcript += text;
    process.stderr.write(text);
  });

  const exitCode = await new Promise((resolveCode, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolveCode(code));
  });

  const extension = traceSummary(tracePath, traceOffset);

  return { exitCode, extension, transcript: transcript.slice(-20_000) };
}

let agent = null;
try {
  if (!evaluateOnly) agent = await generate();
  else agent = {
    ...previousAgentEvidence(),
    exitCode: previousAgentEvidence()?.exitCode ?? null,
    extension: traceSummary(designerTracePath(target)),
    transcript: "[evaluate-only]",
  };
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const evaluationFacts = prompts[caseName];
const candidate = evaluate(target, evaluationFacts);
const baselineResult = baseline && existsSync(baseline) ? evaluate(baseline, evaluationFacts) : null;
const comparison = baselineResult
  ? {
      scoreDelta: candidate.score - baselineResult.score,
      blockerDelta:
        (candidate.quality.blockers ?? 0) + (candidate.layout.blockers ?? 0) -
        (baselineResult.quality.blockers ?? 0) - (baselineResult.layout.blockers ?? 0),
      warningDelta: candidate.warnings - baselineResult.warnings,
      screenshotDelta: candidate.screenshots - baselineResult.screenshots,
    }
  : null;

const report = {
  generatedAt: new Date().toISOString(),
  case: caseName,
  model,
  agent,
  candidate,
  baseline: baselineResult,
  comparison,
};

mkdirSync(reportsDir, { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log("\nEvaluation:");
console.log(JSON.stringify({
  candidate: {
    score: candidate.score,
    build: candidate.build.ok,
    qualityBlockers: candidate.quality.blockers,
    layoutBlockers: candidate.layout.blockers,
    warnings: candidate.warnings,
    screenshots: candidate.screenshots,
    screenshotsFresh: candidate.screenshotEvidence.fresh,
    compositionSignals: candidate.composition.signals.length,
    extensionValid: agent?.extension?.valid ?? null,
    agentExitCode: agent?.exitCode ?? null,
  },
  baseline: baselineResult ? {
    score: baselineResult.score,
    build: baselineResult.build.ok,
    qualityBlockers: baselineResult.quality.blockers,
    layoutBlockers: baselineResult.layout.blockers,
    warnings: baselineResult.warnings,
    screenshots: baselineResult.screenshots,
    compositionSignals: baselineResult.composition.signals.length,
  } : null,
  comparison,
  report: reportPath,
}, null, 2));

process.exit(
  candidate.build.ok &&
  candidate.quality.blockers === 0 &&
  candidate.layout.blockers === 0 &&
  candidate.screenshotEvidence.fresh &&
  (evaluateOnly || agent?.extension?.valid === true) &&
  (evaluateOnly || agent?.exitCode === 0)
    ? 0
    : 1,
);
