#!/usr/bin/env bun
/**
 * P2 optional smoke runner.
 *
 * Drives the REAL designer adapters through the documented host event contract
 * and emits a small machine-readable report. TypeScript adapters require the bun
 * runtime, so this file re-execs itself under bun when launched with node.
 *
 * Usage:
 *   bun scripts/e2e-smoke.mjs [--simulated] [--real-omp] [--report <path>]
 *
 * Modes:
 *   --simulated (default)  No model or real OMP process; exercises adapter hooks.
 *   --real-omp             Attempt a real OMP run; SKIPPED (not PASS) when OMP or
 *                          model access is unavailable, with a precise reason.
 *
 * Report shape:
 *   { mode, host, tests: [], skipped: [], failures: [], artifacts: [] }
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync, readdirSync, readFileSync, existsSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const wantRealOmp = args.includes("--real-omp");
const reportFlagIndex = args.indexOf("--report");
const reportPath = reportFlagIndex >= 0 ? args[reportFlagIndex + 1] : null;

// TypeScript adapters only load under bun; re-exec if we are on node.
if (!process.versions.bun) {
  const result = spawnSync("bun", [fileURLToPath(import.meta.url), ...args], { stdio: "inherit" });
  if (result.error) {
    const report = {
      mode: wantRealOmp ? "real-omp" : "simulated",
      host: "omp",
      tests: [],
      skipped: [{ name: "all", reason: "bun runtime is required to load the TypeScript adapters" }],
      failures: [],
      artifacts: [],
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(0);
  }
  process.exit(result.status ?? 1);
}

process.env.OMP_DESIGNER_MODE = "1";
process.env.PI_DESIGNER_MODE = "1";

const omp = await import("../extension/index.ts");
const pi = await import("../extensions/designer.ts");

const TRACE_DIR = join(homedir(), ".omp", "agent", "designer-traces");
const tempDirs = [];
const traceCwds = new Set();

function tracePath(cwd) {
  const base = cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? "root";
  const hash = createHash("sha256").update(cwd).digest("hex").slice(0, 12);
  return join(TRACE_DIR, `${base}-${hash}.jsonl`);
}

function traceEvents(cwd) {
  const file = tracePath(cwd);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean).flatMap((line) => {
    try {
      const parsed = JSON.parse(line);
      return parsed.cwd === cwd && typeof parsed.event === "string" ? [parsed.event] : [];
    } catch {
      return [];
    }
  });
}

function makeHost() {
  const commands = [];
  const handlers = new Map();
  const api = {
    registerCommand(name) { commands.push(name); },
    on(event, handler) {
      const entries = handlers.get(event) ?? [];
      entries.push(handler);
      handlers.set(event, entries);
    },
  };
  const fire = (event, payload, ctx) => {
    if (ctx?.cwd) traceCwds.add(ctx.cwd);
    return handlers.get(event)?.[0]?.(payload, ctx);
  };
  return { commands, handlers, api, fire };
}

function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), "omp-smoke-"));
  tempDirs.push(dir);
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "smoke", private: true, scripts: { build: "node -e \"process.exit(1)\"" } }));
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "main.js"), "export const x = 1;\n");
  writeFileSync(join(dir, "index.html"), "<!doctype html><h1>hi</h1>\n");
  const past = new Date(Date.now() - 60_000);
  for (const f of ["package.json", "src/main.js", "index.html"]) utimesSync(join(dir, f), past, past);
  return dir;
}

const assistant = (text) => ({ last_assistant_message: { content: [{ type: "text", text }] } });

const tests = [];
const failures = [];
const skipped = [];
const artifacts = [];

function check(name, fn) {
  try {
    fn();
    tests.push(name);
  } catch (error) {
    failures.push({ name, reason: error instanceof Error ? error.message : String(error) });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ---- Simulated scenarios against the real adapters ----
const host = makeHost();
omp.default(host.api);

check("omp registers documented commands and hooks", () => {
  assert(JSON.stringify(host.commands) === JSON.stringify(["designer", "designer-doctor"]), "unexpected commands");
  for (const hook of ["before_agent_start", "resources_discover", "session_stop"]) {
    assert(host.handlers.has(hook), `missing hook ${hook}`);
  }
  assert(!host.handlers.has("tool_call") && !host.handlers.has("tool_result"), "unexpected tool gate hooks");
});

check("omp injects the designer prompt exactly once", () => {
  const cwd = "/tmp/omp-smoke-inject";
  const out = host.fire("before_agent_start", { prompt: "build a page", systemPrompt: ["base"] }, { cwd });
  assert(out.systemPrompt.filter((p) => p.includes("[DESIGNER MODE: ACTIVE v5]")).length === 1, "prompt not injected once");
});

check("resources_discover exposes four skills", () => {
  const out = host.fire("resources_discover", {}, { cwd: process.cwd() });
  assert(out.skillPaths.length === 4, `expected 4 skills, got ${out.skillPaths.length}`);
});

check("plan continuation fires once then stops (bounded)", () => {
  const cwd = "/tmp/omp-smoke-plan";
  host.fire("before_agent_start", { prompt: "Create a plan for various pages and wait for approval.", systemPrompt: ["base"] }, { cwd });
  const first = host.fire("session_stop", { session_id: "p1", ...assistant("A single-page site with several sections.") }, { cwd });
  assert(first?.continue === true, "first invalid plan did not continue");
  const second = host.fire("session_stop", { session_id: "p1", ...assistant("A single-page site with several sections.") }, { cwd });
  assert(second === undefined, "second invalid plan should not continue");
});

check("delivery checks are skipped on a no-change turn", () => {
  const dir = makeProject();
  host.fire("before_agent_start", { prompt: "Build a bakery landing page.", systemPrompt: ["base"] }, { cwd: dir });
  const out = host.fire("session_stop", { session_id: "noop", ...assistant("advice only") }, { cwd: dir });
  assert(out === undefined, "no-change turn should not continue");
  assert(traceEvents(dir).includes("delivery_checks_skipped"), "expected delivery_checks_skipped");
});

check("pi adapter has no delivery-check backstop", () => {
  const piHost = makeHost();
  pi.default(piHost.api);
  const dir = makeProject();
  piHost.fire("before_agent_start", { prompt: "Build a bakery landing page.", systemPrompt: ["base"] }, { cwd: dir });
  const future = new Date(Date.now() + 60_000);
  writeFileSync(join(dir, "src", "main.js"), "export const x = 2;\n");
  utimesSync(join(dir, "src", "main.js"), future, future);
  const out = piHost.fire("session_stop", { session_id: "pi", ...assistant("done") }, { cwd: dir });
  assert(out === undefined, "pi should not run a delivery backstop");
});

// ---- Optional real OMP mode ----
if (wantRealOmp) {
  const probe = spawnSync("omp", ["--version"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) {
    skipped.push({ name: "real-omp", reason: "omp binary not found or not runnable on PATH" });
  } else {
    // A reliable, automated real-model OMP run is not implemented here: it needs
    // model credentials and a deterministic project fixture. Report honestly.
    skipped.push({ name: "real-omp", reason: "automated real-model OMP driver not implemented; run manually via scripts/real-agent-eval.mjs" });
  }
} else {
  skipped.push({ name: "real-omp", reason: "not requested (pass --real-omp to attempt)" });
}

// ---- Cleanup ----
for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
for (const cwd of traceCwds) rmSync(tracePath(cwd), { force: true });

if (reportPath) artifacts.push(reportPath);

const report = {
  mode: wantRealOmp ? "real-omp" : "simulated",
  host: "omp",
  tests,
  skipped,
  failures,
  artifacts,
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (reportPath) {
  mkdirSync(join(reportPath, ".."), { recursive: true });
  writeFileSync(reportPath, serialized);
}
process.stdout.write(serialized);

const status = failures.length === 0 ? "PASS" : "FAIL";
process.stderr.write(`\n${status}: ${tests.length} passed, ${failures.length} failed, ${skipped.length} skipped\n`);
process.exit(failures.length === 0 ? 0 : 1);
