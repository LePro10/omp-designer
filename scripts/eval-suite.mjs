#!/usr/bin/env node
/**
 * eval-suite.mjs - deterministic harness for the omp-designer golden prompt corpus.
 *
 * It does not call an LLM by default. It gives the loop a stable corpus, validates
 * coverage, prints reproducible omp commands, and can score already-generated
 * outputs using the deterministic validators.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const corpusPath = join(root, "eval", "prompts.jsonl");
const qualityScript = join(root, "scripts", "fix-ai-slop.mjs");
const layoutScript = join(root, "scripts", "analyze-layout.mjs");
const args = process.argv.slice(2);
const command = args[0] || "validate";

function usage() {
  console.log(`Usage:
  node scripts/eval-suite.mjs validate
  node scripts/eval-suite.mjs list
  node scripts/eval-suite.mjs commands [--model <model>] [--out <dir>]
  node scripts/eval-suite.mjs score <output-root> [--write]
`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function loadCorpus() {
  if (!existsSync(corpusPath)) fail(`Missing corpus: ${corpusPath}`);
  const lines = readFileSync(corpusPath, "utf-8").split("\n").filter((line) => line.trim().length > 0);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      fail(`Invalid JSON on eval/prompts.jsonl:${index + 1}: ${error.message}`);
    }
  });
}

function validateCorpus(corpus) {
  const failures = [];
  const ids = new Set();
  const categories = new Set();
  const modes = new Set();
  let adversarial = 0;

  for (const [index, item] of corpus.entries()) {
    const where = `prompt ${index + 1}${item?.id ? ` (${item.id})` : ""}`;
    if (!item || typeof item !== "object") failures.push(`${where}: must be an object`);
    if (typeof item.id !== "string" || !/^[a-z0-9-]+$/.test(item.id)) failures.push(`${where}: id must be kebab-case`);
    if (ids.has(item.id)) failures.push(`${where}: duplicate id`);
    ids.add(item.id);
    if (typeof item.category !== "string") failures.push(`${where}: category missing`);
    if (typeof item.mode !== "string") failures.push(`${where}: mode missing`);
    if (typeof item.prompt !== "string" || item.prompt.length < 20) failures.push(`${where}: prompt too short`);
    if (!Array.isArray(item.expects) || item.expects.length < 2) failures.push(`${where}: expects must list at least 2 checks`);
    categories.add(item.category);
    modes.add(item.mode);
    if (item.category === "adversarial") adversarial += 1;
  }

  const requiredCategories = ["landing", "ecommerce", "redesign", "edit", "dashboard", "form", "content", "checkout", "multipage", "accessibility", "mobile", "adversarial"];
  for (const category of requiredCategories) {
    if (!categories.has(category)) failures.push(`missing category: ${category}`);
  }
  for (const mode of ["guided", "autonomous", "batch"]) {
    if (!modes.has(mode)) failures.push(`missing mode: ${mode}`);
  }
  if (corpus.length < 20) failures.push(`expected at least 20 prompts, got ${corpus.length}`);
  if (adversarial < 3) failures.push(`expected at least 3 adversarial prompts, got ${adversarial}`);

  return failures;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function commandFor(item, outputRoot, model) {
  const target = join(outputRoot, item.id);
  const prompt = `${item.prompt} Create or update the project at ${target}. Keep all output inside that directory.`;
  const modelFlag = model ? ` --model ${shellQuote(model)}` : "";
  return `omp -p${modelFlag} ${shellQuote(prompt)}`;
}

function runValidator(script, dir, extraArgs = []) {
  const result = spawnSync(process.execPath, [script, ...extraArgs, dir], {
    cwd: root,
    encoding: "utf-8",
    timeout: 60_000,
    maxBuffer: 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    output: `${result.stdout || ""}${result.stderr || ""}`.trim(),
  };
}

function scoreOutput(corpus, outputRoot, writeReport) {
  const rows = [];
  for (const item of corpus) {
    const dir = join(outputRoot, item.id);
    if (!existsSync(dir)) {
      rows.push({ id: item.id, status: "missing", quality: null, layout: null });
      continue;
    }
    const quality = runValidator(qualityScript, dir, ["--check"]);
    const layout = runValidator(layoutScript, dir);
    rows.push({
      id: item.id,
      status: quality.ok && layout.ok ? "pass" : "fail",
      quality: quality.status,
      layout: layout.status,
    });
  }

  const passed = rows.filter((row) => row.status === "pass").length;
  const failed = rows.filter((row) => row.status === "fail").length;
  const missing = rows.filter((row) => row.status === "missing").length;
  const report = {
    generatedAt: new Date().toISOString(),
    corpus: corpusPath,
    outputRoot,
    summary: { total: rows.length, passed, failed, missing },
    rows,
  };

  console.log(JSON.stringify(report, null, 2));
  if (writeReport) {
    const reportsDir = join(root, "eval", "reports");
    mkdirSync(reportsDir, { recursive: true });
    const out = join(reportsDir, `scorecard-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
    console.log(`\nWrote ${out}`);
  }

  return failed === 0 ? 0 : 1;
}

const corpus = loadCorpus();
const failures = validateCorpus(corpus);
if (command === "validate") {
  if (failures.length > 0) fail(`Corpus validation failed:\n${failures.map((f) => `  - ${f}`).join("\n")}`);
  console.log(`Corpus OK: ${corpus.length} prompts, ${new Set(corpus.map((p) => p.category)).size} categories`);
  process.exit(0);
}

if (failures.length > 0) fail(`Corpus validation failed before ${command}:\n${failures.map((f) => `  - ${f}`).join("\n")}`);

if (command === "list") {
  for (const item of corpus) console.log(`${item.id}\t${item.mode}\t${item.category}`);
  process.exit(0);
}

if (command === "commands") {
  const modelIndex = args.indexOf("--model");
  const outIndex = args.indexOf("--out");
  const model = modelIndex >= 0 ? args[modelIndex + 1] : "";
  const outputRoot = outIndex >= 0 ? args[outIndex + 1] : "test-output/eval";
  for (const item of corpus) console.log(commandFor(item, outputRoot, model));
  process.exit(0);
}

if (command === "score") {
  const outputRoot = args[1];
  if (!outputRoot) fail("score requires <output-root>");
  const code = scoreOutput(corpus, outputRoot, args.includes("--write"));
  process.exit(code);
}

usage();
process.exit(1);
