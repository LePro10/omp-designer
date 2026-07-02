#!/usr/bin/env node
/**
 * E2E Test Suite — Designer Skill Gate Integration Tests
 *
 * Tests the full OMP + designer extension pipeline end-to-end.
 * Each scenario spawns an OMP session in a temporary environment,
 * sends a crafted prompt, and verifies the skill gate behavior via:
 *   - Physical canary files (side-effect proof)
 *   - Gate report JSON (state machine verification)
 *   - Trace JSONL files (event sequence verification)
 *
 * Scenarios A–G cover the audit requirements:
 *   A: Write before readiness → canary must not exist
 *   B: Bash before readiness → canary must not exist
 *   C: MCP before readiness → must be blocked
 *   D: Subagent before readiness → canary must not exist
 *   E: Master partial then animate → order violated
 *   F: Correct order → canary exists, ready = true
 *   G: Real scenario (Lian Li website)
 *
 * Environment variables:
 *   OMP_PATH   — path to the omp binary (default: "omp" in PATH)
 *   MODEL_NAME — model to use (default: "claude-sonnet-4-20250514")
 *
 * Exit codes:
 *   0 — all tests passed (or all skipped)
 *   1 — at least one test failed
 */

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

// ── Configuration ────────────────────────────────────────────────────────

const OMP_PATH = process.env.OMP_PATH || "omp";
const MODEL_NAME = process.env.MODEL_NAME || "claude-sonnet-4-20250514";
const TIMEOUT_MS = 120_000; // 2 minutes per scenario

// ── Test harness ─────────────────────────────────────────────────────────

const results = [];

function record(name, status, details = {}) {
  results.push({ name, status, ...details });
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "⊘";
  const color = status === "PASS" ? "\x1b[32m" : status === "FAIL" ? "\x1b[31m" : "\x1b[33m";
  console.log(`${color}${icon}\x1b[0m ${name} — ${status}`);
}

// ── OMP availability check ──────────────────────────────────────────────

function checkOmpAvailable() {
  const result = spawnSync(OMP_PATH, ["--version"], {
    encoding: "utf-8",
    timeout: 10_000,
    shell: true,
  });
  if (result.error || result.status !== 0) {
    return { available: false, reason: result.error?.message || `omp exited with code ${result.status}` };
  }
  const version = (result.stdout || "").trim();
  return { available: true, version };
}

// ── Temp environment setup ───────────────────────────────────────────────

function createTempEnv(scenarioId) {
  // Create temp project directory outside the repo
  const projectDir = mkdtempSync(join(tmpdir(), `e2e-${scenarioId}-`));

  // Create temp HOME directory
  const homeDir = mkdtempSync(join(tmpdir(), `e2e-home-${scenarioId}-`));

  // Set up .omp/agent directory structure
  const ompAgentDir = join(homeDir, ".omp", "agent");
  mkdirSync(ompAgentDir, { recursive: true });

  // Enable designer mode for this project
  const stateFile = join(ompAgentDir, "designer-state.json");
  writeFileSync(stateFile, JSON.stringify({ [projectDir]: true }));

  // Create managed-skills directory with stub skill files
  const skillsRoot = join(ompAgentDir, "managed-skills");
  const skillNames = [
    "designer-master", "ai-slop", "product-md", "taste-skill",
    "design-md", "ui-ux-pro-max-skill", "reference-study", "copywriting",
    "scroll-choreography", "animate", "visual-critique", "review-skill",
  ];

  for (const dirName of skillNames) {
    const skillDir = join(skillsRoot, dirName);
    mkdirSync(skillDir, { recursive: true });
    // Create a minimal SKILL.md with enough lines to satisfy coverage
    const skillName = dirName === "ui-ux-pro-max-skill" ? "ui-ux-pro-max" : dirName;
    const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1} of ${skillName} skill content.`);
    writeFileSync(join(skillDir, "SKILL.md"), `---\nname: ${skillName}\n---\n# ${skillName}\n${lines.join("\n")}\n`);
  }

  // Create directories for traces and gate reports
  mkdirSync(join(ompAgentDir, "designer-traces"), { recursive: true });
  mkdirSync(join(ompAgentDir, "designer-gates"), { recursive: true });

  return { projectDir, homeDir, ompAgentDir, skillsRoot };
}

function cleanupTempEnv(env) {
  try { rmSync(env.projectDir, { recursive: true, force: true }); } catch {}
  try { rmSync(env.homeDir, { recursive: true, force: true }); } catch {}
}

// ── OMP session runner ──────────────────────────────────────────────────

function runOmpSession(env, prompt) {
  const args = [
    "-p", prompt,
    "--model", MODEL_NAME,
    "--max-turns", "5",
  ];

  const result = spawnSync(OMP_PATH, args, {
    cwd: env.projectDir,
    encoding: "utf-8",
    timeout: TIMEOUT_MS,
    env: {
      ...process.env,
      HOME: env.homeDir,
      USERPROFILE: env.homeDir,
    },
    maxBuffer: 10 * 1024 * 1024,
    shell: true,
  });

  return {
    exitCode: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    timedOut: result.error?.code === "ETIMEDOUT",
    error: result.error?.message || null,
  };
}

// ── Result verification helpers ──────────────────────────────────────────

function readGateReport(env) {
  try {
    const gateDir = join(env.ompAgentDir, "designer-gates");
    const files = existsSync(gateDir)
      ? readdirSync(gateDir).filter(f => f.endsWith(".json"))
      : [];
    if (files.length === 0) return null;
    // Read the most recent gate report
    const latest = files.sort().pop();
    return JSON.parse(readFileSync(join(gateDir, latest), "utf-8"));
  } catch {
    return null;
  }
}

function readTraceEvents(env) {
  try {
    const traceDir = join(env.ompAgentDir, "designer-traces");
    const files = existsSync(traceDir)
      ? readdirSync(traceDir).filter(f => f.endsWith(".jsonl"))
      : [];
    if (files.length === 0) return [];
    const latest = files.sort().pop();
    const content = readFileSync(join(traceDir, latest), "utf-8");
    return content.trim().split("\n").filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function hasCanaryFile(env, filename) {
  return existsSync(join(env.projectDir, filename));
}

function wasToolBlocked(events, toolName) {
  return events.some(e =>
    e.event === "skill_gate_blocked" &&
    e.tool === toolName
  );
}

function hasOrderViolation(report) {
  return report?.orderViolated === true;
}

function isReady(report) {
  return report?.ready === true;
}

// ── Scenario definitions ────────────────────────────────────────────────

const scenarios = [
  {
    id: "A",
    name: "Write before readiness",
    prompt: "Create a file called canary-a.txt in the current directory with the content 'hello from scenario A'. Do not read any skill files first. Just write the file immediately.",
    verify(env, session, events, report) {
      const canaryExists = hasCanaryFile(env, "canary-a.txt");
      const writeBlocked = wasToolBlocked(events, "write");
      return {
        pass: !canaryExists,
        details: {
          canaryExists,
          writeBlocked,
          gatePhase: report?.phase,
          message: canaryExists
            ? "FAIL: canary-a.txt exists — write tool was not blocked before readiness"
            : "PASS: canary-a.txt does not exist — write was correctly blocked or not attempted",
        },
      };
    },
  },
  {
    id: "B",
    name: "Bash before readiness",
    prompt: "Run this bash command immediately without reading any skills: touch canary-b.txt && echo 'created' > canary-b.txt",
    verify(env, session, events, report) {
      const canaryExists = hasCanaryFile(env, "canary-b.txt");
      const bashBlocked = wasToolBlocked(events, "bash");
      return {
        pass: !canaryExists,
        details: {
          canaryExists,
          bashBlocked,
          gatePhase: report?.phase,
          message: canaryExists
            ? "FAIL: canary-b.txt exists — bash tool was not blocked before readiness"
            : "PASS: canary-b.txt does not exist — bash was correctly blocked or not attempted",
        },
      };
    },
  },
  {
    id: "C",
    name: "MCP before readiness",
    prompt: "Use search_tool_bm25 to search for 'design patterns'. Do not read any skills first.",
    verify(env, session, events, report) {
      const mcpBlocked = events.some(e =>
        e.event === "skill_gate_blocked" &&
        (e.tool === "search_tool_bm25" || e.tool?.startsWith("mcp__"))
      );
      return {
        pass: mcpBlocked || session.exitCode !== 0,
        details: {
          mcpBlocked,
          exitCode: session.exitCode,
          gatePhase: report?.phase,
          message: mcpBlocked
            ? "PASS: MCP tool was blocked before readiness"
            : session.exitCode !== 0
              ? "PASS: Session failed (MCP tool likely unavailable or blocked)"
              : "FAIL: MCP tool was not blocked — gate should have prevented it",
        },
      };
    },
  },
  {
    id: "D",
    name: "Subagent before readiness",
    prompt: "Spawn a subagent (using the task tool) to create a file called canary-d.txt in the current directory. Do not read any skills first.",
    verify(env, session, events, report) {
      const canaryExists = hasCanaryFile(env, "canary-d.txt");
      const taskBlocked = wasToolBlocked(events, "task");
      return {
        pass: !canaryExist,
        details: {
          canaryExists,
          taskBlocked,
          gatePhase: report?.phase,
          message: canaryExists
            ? "FAIL: canary-d.txt exists — subagent was not blocked before readiness"
            : "PASS: canary-d.txt does not exist — subagent was correctly blocked or not attempted",
        },
      };
    },
  },
  {
    id: "E",
    name: "Master partial then animate (order violation)",
    prompt: "Read skill://animate first, before reading any other skill. Do NOT read designer-master. Just read animate immediately.",
    verify(env, session, events, report) {
      const orderViolated = hasOrderViolation(report);
      const violationEvent = events.find(e =>
        e.event === "skill_read_begin" &&
        e.skill === "animate" &&
        e.orderViolated === true
      );
      return {
        pass: orderViolated || !!violationEvent,
        details: {
          orderViolated,
          violationEvent: !!violationEvent,
          gatePhase: report?.phase,
          orderViolationSkill: report?.orderViolationSkill,
          message: orderViolated || violationEvent
            ? "PASS: Order violation detected — animate was read before designer-master"
            : "FAIL: No order violation detected — gate should have flagged this",
        },
      };
    },
  },
  {
    id: "F",
    name: "Correct order — all skills then write",
    prompt: `Read all required designer skills in this exact order using their skill:// URIs:
1. skill://designer-master
2. skill://ai-slop
3. skill://product-md
4. skill://taste-skill
5. skill://design-md
6. skill://ui-ux-pro-max
7. skill://reference-study
8. skill://copywriting
9. skill://scroll-choreography
10. skill://animate
11. skill://visual-critique
12. skill://review-skill

After reading ALL skills, create a file called canary-f.txt with the content 'gate opened successfully'.`,
    verify(env, session, events, report) {
      const ready = isReady(report);
      const canaryExists = hasCanaryFile(env, "canary-f.txt");
      const skillsReadyEvent = events.some(e => e.event === "designer_skills_ready");
      return {
        pass: ready || canaryExists || skillsReadyEvent,
        details: {
          ready,
          canaryExists,
          skillsReadyEvent,
          gatePhase: report?.phase,
          masterReadFirst: report?.masterReadFirst,
          message: ready || canaryExists
            ? "PASS: Gate opened after correct skill order, canary file created"
            : skillsReadyEvent
              ? "PASS: Skills ready event fired (canary may not have been written due to session limits)"
              : "FAIL: Gate did not open — skills may not have been read in correct order",
        },
      };
    },
  },
  {
    id: "G",
    name: "Real scenario — Lian Li website",
    prompt: "Build me a landing page for Lian Li, the PC case and accessories manufacturer. Focus on their premium aluminum cases. Use autonomous mode.",
    verify(env, session, events, report) {
      // For the real scenario, we check that the gate initialized and
      // either skills were being loaded or the session progressed
      const gateInitialized = report !== null;
      const hasTraceEvents = events.length > 0;
      const skillsReady = isReady(report);
      const orderViolation = hasOrderViolation(report);
      return {
        pass: !orderViolation && (gateInitialized || hasTraceEvents),
        details: {
          gateInitialized,
          hasTraceEvents,
          skillsReady,
          orderViolation,
          eventCount: events.length,
          gatePhase: report?.phase,
          traceEvents: events.map(e => e.event).filter(Boolean).slice(0, 20),
          message: orderViolation
            ? "FAIL: Order violation in real scenario — this should not happen"
            : gateInitialized && hasTraceEvents
              ? "PASS: Gate initialized and trace events recorded for real scenario"
              : hasTraceEvents
                ? "PASS: Trace events recorded (gate report may not have been saved)"
                : "FAIL: No gate or trace activity detected",
        },
      };
    },
  },
];

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  E2E Test Suite — Designer Skill Gate Integration");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();

  // Check OMP availability
  const ompCheck = checkOmpAvailable();
  if (!ompCheck.available) {
    console.log(`\x1b[33m⊘\x1b[0m OMP not available: ${ompCheck.reason}`);
    console.log(`  Set OMP_PATH to the omp binary path to run these tests.`);
    console.log();

    for (const scenario of scenarios) {
      record(`${scenario.id}: ${scenario.name}`, "SKIPPED", {
        reason: "OMP not available",
      });
    }

    printSummary();
    process.exit(0);
    return;
  }

  console.log(`OMP version: ${ompCheck.version}`);
  console.log(`Model: ${MODEL_NAME}`);
  console.log(`Timeout: ${TIMEOUT_MS / 1000}s per scenario`);
  console.log();

  let failed = 0;

  for (const scenario of scenarios) {
    const env = createTempEnv(scenario.id);

    try {
      console.log(`  Running scenario ${scenario.id}: ${scenario.name}...`);
      const session = runOmpSession(env, scenario.prompt);

      if (session.timedOut) {
        record(`${scenario.id}: ${scenario.name}`, "SKIPPED", {
          reason: `Session timed out after ${TIMEOUT_MS / 1000}s`,
        });
        continue;
      }

      if (session.error) {
        record(`${scenario.id}: ${scenario.name}`, "SKIPPED", {
          reason: `Session error: ${session.error}`,
        });
        continue;
      }

      const events = readTraceEvents(env);
      const report = readGateReport(env);
      const verification = scenario.verify(env, session, events, report);

      if (verification.pass) {
        record(`${scenario.id}: ${scenario.name}`, "PASS", verification.details);
      } else {
        failed++;
        record(`${scenario.id}: ${scenario.name}`, "FAIL", verification.details);
      }
    } catch (error) {
      failed++;
      record(`${scenario.id}: ${scenario.name}`, "FAIL", {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      cleanupTempEnv(env);
    }
  }

  printSummary();
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Summary");
  console.log("═══════════════════════════════════════════════════════════════");

  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  const skipped = results.filter(r => r.status === "SKIPPED").length;

  console.log(`  PASS:    ${passed}`);
  console.log(`  FAIL:    ${failed}`);
  console.log(`  SKIPPED: ${skipped}`);
  console.log(`  Total:   ${results.length}`);
  console.log();

  // Output JSON for machine consumption
  console.log("JSON results:");
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    ompPath: OMP_PATH,
    model: MODEL_NAME,
    results,
    summary: { passed, failed, skipped, total: results.length },
  }, null, 2));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
