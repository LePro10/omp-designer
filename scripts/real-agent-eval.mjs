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
import { buildDesignQualityReport } from "../shared/design-quality.mjs";
import { analyzeScreenshot } from "../shared/screenshot-analysis.mjs";

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
  surprise: "Build a responsive landing page for a small-batch coffee roaster's subscription. Surprise me with the art direction; you decide the mood and typography. Do not invent metrics, awards, or testimonials. Build immediately without asking questions.",
  multipage: "Build a responsive multi-page site for a community woodworking studio: a home page, a classes page, and a contact page as separate routes. Provide real navigation between them. Do not invent prices or class schedules. Build immediately without asking questions.",
  "plan-en": "Create a plan for a multi-page portfolio site and wait for my approval before building anything.",
  "plan-de": "Erstelle zuerst einen Plan für eine mehrseitige Portfolio-Website und warte auf meine Freigabe, bevor du etwas umsetzt.",
  // Normal-user prompts: deliberately vague. The agent must infer art direction,
  // structure, and content on its own. Do not add specification to these.
  "coffee-brand": "make a beautiful website for my coffee brand",
  "fan-aio": "create a landing page for a premium PC fan and AIO brand",
  "ai-product": "make a stunning website for an AI product",
  "furniture-surprise": "surprise me with a website for a furniture studio",
  "robotics-antislop": "make a website for my robotics startup, but avoid generic gradients and SaaS clichés",
  "bakery-mobile": "make a mobile-first site for a local bakery",
  "style-apple": "build me a website for my smart home hub, in the style of apple",
  "skincare-shop": "make a landing page for my skincare brand's online shop",
  "editorial-mag": "build a website for an independent architecture magazine, editorial like a newspaper",
  "portfolio-brutalist": "make me a bold brutalist portfolio site",
};

// --suite runs the normal-user prompt corpus sequentially as release evidence.
if (args.includes("--suite")) {
  const suite = ["coffee-brand", "fan-aio", "ai-product", "furniture-surprise", "robotics-antislop", "bakery-mobile"];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const suiteMaxTime = value("--max-time", "1200");
  let failedRuns = 0;
  for (const suiteCase of suite) {
    console.log(`\n=== suite case: ${suiteCase} ===`);
    const result = spawnSync(process.execPath, [
      process.argv[1], "--run", `suite-${stamp}-${suiteCase}`, "--case", suiteCase, "--max-time", suiteMaxTime,
    ], { stdio: "inherit" });
    if (result.status !== 0) failedRuns += 1;
  }
  console.log(`\nSuite finished: ${suite.length - failedRuns}/${suite.length} runs completed. Review reports and screenshots per run.`);
  process.exit(failedRuns > 0 ? 1 : 0);
}

if (!runName && !evaluateOnly) {
  console.error("Usage: node scripts/real-agent-eval.mjs --run <name> [--case saas|editorial] [--baseline <path>] [--suite]");
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
  // Tailwind classes and vanilla CSS both count; a plain-CSS page must not
  // bypass composition review by never using a utility class.
  const equalGridSections =
    (source.match(/\b(?:sm:|md:|lg:|xl:)?grid-cols-[234]\b/g) ?? []).length +
    (source.match(/grid-template-columns:\s*repeat\(\s*[234]\s*,/g) ?? []).length;
  const roundedSurfaces =
    (source.match(/\brounded-(?:lg|xl|2xl|3xl)\b/g) ?? []).length +
    (source.match(/border-radius:\s*(?:1[2-9]|[2-9]\d)px|border-radius:\s*(?:0?\.75|1|1\.25|1\.5|2)rem/g) ?? []).length;
  const motionComponents =
    (source.match(/<motion\./g) ?? []).length +
    (source.match(/@keyframes\s+/g) ?? []).length;
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
  if (!existsSync(join(dir, "package.json"))) {
    // A deliberate static site (plain index.html) has nothing to build; that is
    // not a delivery failure and must not outscore taste problems in the report.
    if (existsSync(join(dir, "index.html"))) {
      return { ok: true, status: null, output: "static site without a build system" };
    }
    return { ok: false, status: null, output: "package.json missing" };
  }
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

  // Content analysis: a full-page screenshot dominated by uniform rows shows
  // nothing (hidden scroll-reveal content or wallpaper), whatever mtime says.
  const screenshotContent = screenshotPaths
    .filter((path) => /\.png$/i.test(path))
    .map((path) => analyzeScreenshot(path))
    .map(({ path, error, fullPage, blankRowFraction, maxBlankRunFraction }) => ({
      file: basename(path),
      ...(error
        ? { error }
        : {
            fullPage,
            blankRowFraction: Math.round(blankRowFraction * 100) / 100,
            maxBlankRunFraction: Math.round(maxBlankRunFraction * 100) / 100,
          }),
    }));
  const worstBlankRun = Math.max(
    0,
    ...screenshotContent.filter((entry) => entry.fullPage).map((entry) => entry.maxBlankRunFraction ?? 0),
  );
  if (worstBlankRun >= 0.3) {
    composition.signals.push(
      `A full-page screenshot has a contiguous blank band covering ${Math.round(worstBlankRun * 100)}% of the page; content is hidden at initial paint or the layout is empty.`,
    );
  }
  const designQuality = buildDesignQualityReport({
    projectDir: dir,
    userPrompt: userFacts,
    quality: quality.report,
    layout: layout.report,
    composition,
  });
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
  // Blank screenshot evidence caps the delivery score: a page whose capture is
  // one-third void cannot be reported as a near-perfect delivery.
  if (worstBlankRun >= 0.3) score = Math.min(score, 60);

  // Detected slop rules subtract from the score so taste is visible in the
  // number, not only in the issue list.
  const SLOP_RULES = new Set([
    "reveal-hidden-content", "ai-default-palette", "gradient-imagery", "gradient-heavy",
    "remote-placeholder-asset", "stat-tile-claim", "contact-details-unverified",
  ]);
  const slopRuleHits = [...new Set(
    [...(quality.report?.issues ?? []), ...(layout.report?.issues ?? [])]
      .filter((issue) => SLOP_RULES.has(issue.rule))
      .map((issue) => issue.rule),
  )].sort();
  score = Math.max(0, score - Math.min(15, slopRuleHits.length * 5));

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
      content: screenshotContent,
      worstBlankRun,
    },
    sourceFiles,
    warnings,
    slopRuleHits,
    composition,
    designQuality,
    scoreScope: "Automated delivery score; visual quality requires the designReview rubric and screenshot review.",
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
    "For full-page screenshots, first scroll through the whole page so lazy-loaded images are present, then reset scroll to the top so sticky elements are captured in their initial position.",
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
    env: {
      ...process.env,
      OMP_DESIGNER_MODE: "1",
      // In-session visual reviews default to minimax-m3 unless overridden.
      DESIGNER_REVIEW_MODEL: process.env.DESIGNER_REVIEW_MODEL || value("--review-model", "opencode-go/minimax-m3:high"),
      DESIGNER_REVIEW_VIA: process.env.DESIGNER_REVIEW_VIA || value("--review-via", "omp"),
    },
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

// Model-backed visual review. Defaults to opencode-go/minimax-m3 (vision-
// capable, same API family as the default builder); override with
// --review-model / DESIGNER_REVIEW_MODEL for other providers, --review-via
// api for a local endpoint, or --no-review. Vision-blind reviewers are
// rejected honestly and noted in the report rather than silently skipped.
const DEFAULT_REVIEW_MODEL = "opencode-go/minimax-m3:high";
const reviewModel = value("--review-model", process.env.DESIGNER_REVIEW_MODEL || DEFAULT_REVIEW_MODEL);
const reviewVia = value("--review-via", process.env.DESIGNER_REVIEW_VIA ?? "omp");
if (reviewModel && !args.includes("--no-review")) {
  const reviewRun = run(process.execPath, [
    join(root, "scripts", "design-review-cli.mjs"), "--target", target, "--model", reviewModel, "--via", reviewVia, "--json",
  ], root, 420_000);
  if (reviewRun.ok) {
    try {
      const parsedReview = JSON.parse(readFileSync(join(target, "design-review.json"), "utf8"));
      candidate.designQuality.designReview = {
        basis: `model-reviewed (${reviewModel})`,
        categories: parsedReview.review,
        verdict: parsedReview.verdict,
        memorable: parsedReview.memorable,
        topFixes: parsedReview.topFixes,
      };
    } catch {
      console.error("design-review.json unreadable after review run");
    }
  } else {
    const blind = /cannot view the images/i.test(reviewRun.output);
    candidate.designQuality.designReview.basis = blind
      ? `unavailable: reviewer model ${reviewModel} cannot view images`
      : `failed: ${reviewRun.output.slice(-200)}`;
    console.error(`Visual review ${blind ? "unavailable" : "failed"} (${reviewModel} via ${reviewVia}): ${reviewRun.output.slice(-300)}`);
  }
}
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
    worstBlankRun: candidate.screenshotEvidence.worstBlankRun,
    slopRuleHits: candidate.slopRuleHits,
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
