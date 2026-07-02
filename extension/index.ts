/**
 * Designer Mode v2 Extension for omp (oh-my-pi)
 *
 * Adds /designer toggle command.
 * When ON: design workflow prompt + managed design skills + MCP toggles.
 *
 * Skill Gate: technically enforces that all required skills are fully read
 * before any write/edit/build/MCP/plan-approval action is allowed.
 * Uses shared/skill-gate.mjs as the single source of truth for the skill
 * manifest, state machine, and gate logic.
 */

import { homedir } from "node:os";
import { join, relative } from "node:path";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

// ── Shared core (single source of truth for Pi + OMP) ──────────────────

import {
  SkillGate,
  REQUIRED_DESIGNER_SKILLS,
  PHASES,
  PHASE_ORDER,
  PAST_GATE_PHASES,
  computeManifestHash,
  hashContent,
  getRequiredSkillNames,
  isToolAllowedBeforeReady,
} from "../shared/skill-gate.mjs";

// ── Paths ──────────────────────────────────────────────────────────────

const HOME = homedir();
const STATE_FILE = join(HOME, ".omp", "agent", "designer-state.json");
const SKILLS_ROOT = join(HOME, ".omp", "agent", "managed-skills");
const EXTENSION_ROOT = join(HOME, ".omp", "agent", "extensions", "designer");
const CSV_DATA_ROOT = join(SKILLS_ROOT, "ui-ux-pro-max-skill", "src", "ui-ux-pro-max", "data");
const QUALITY_SCRIPT = join(EXTENSION_ROOT, "fix-ai-slop.mjs");
const LAYOUT_SCRIPT = join(EXTENSION_ROOT, "analyze-layout.mjs");
const TRACE_DIR = join(HOME, ".omp", "agent", "designer-traces");
const GATE_DIR = join(HOME, ".omp", "agent", "designer-gates");

const DESIGNER_MARKER_PATTERN = /\[DESIGNER MODE(?: v\d+)?: ACTIVE\]/;
const GLOBAL_STATE_KEY = "*";

// ── Skill path resolution ──────────────────────────────────────────────

/**
 * Maps a skill name from the manifest to its installed file path.
 * OMP stores skills at ~/.omp/agent/managed-skills/<dir>/SKILL.md.
 * Note: "ui-ux-pro-max" skill lives in the "ui-ux-pro-max-skill" directory.
 */
function resolveSkillPath(name: string): string | null {
  const dirName = name === "ui-ux-pro-max" ? "ui-ux-pro-max-skill" : name;
  const path = join(SKILLS_ROOT, dirName, "SKILL.md");
  return existsSync(path) ? path : null;
}

// ── Prompt injection (reduced — gate is technically enforced) ───────────

const PROMPT_INJECT = `[DESIGNER MODE: ACTIVE]

${SkillGate.getGatePrompt()}

## STEP 1: Choose interaction mode

Pick exactly one mode before acting:

| Mode | Trigger | First action | Approval |
| --- | --- | --- | --- |
| Guided | user asks to be asked, says "ask what you need", or brief is ambiguous and not urgent | Ask 3-5 multiple-choice questions | Wait for "accept", "go", or "build it" after plan |
| Adaptive | normal brief with a few missing facts | Ask only decision-critical questions; skip nice-to-have questions | Wait for "accept", "go", or "build it" after plan |
| Autonomous | "surprise me", "impress me", "i trust you" | Ask exactly ONE emotion question: Awe / Trust / Excitement / Calm / Curiosity | After answer: present plan, then build without a second approval wait unless user requests one |
| Batch | "do not wait", "no approval", "build it now", "just make it", "batch", or omp -p style task | Ask no questions; document assumptions in PRODUCT.md | No approval wait; build after plan |

Never combine modes. Never ask questions in Batch. Never wait for "accept" in Batch.

## STEP 2: Write PRODUCT.md + EVIDENCE.md (after skills are loaded)

Write PRODUCT.md with: what it is, audience, brand voice, provided facts (prefix "Source: user"), missing facts as [NEEDS INPUT].
Write EVIDENCE.md tracking every factual claim. If the user didn't provide it: confidence 0, "MUST NOT USE".

## STEP 3: Plan (MANDATORY, do not skip)

Write a plan with: Brand & Voice, Visual System (palette + hex, typography + fonts, dials), Stack, Pages/Routes, Sections, MCP Research Log, Risks & Mitigations.
Approval handling follows STEP 1. Guided/Adaptive: end with "Type 'accept' to build, or tell me what to change." Autonomous: continue after plan. Batch: continue immediately.

## STEP 4: MCP research (during planning)

Run search_tool_bm25("21st-dev ui-layouts chrome-devtools designmd").
Attempt ALL. If unavailable, try web_search or browser as fallback. Document every attempt. Silent skipping is not acceptable.

## STEP 5: Design tokens

Palette: ${CSV_DATA_ROOT}/colors.csv is the default source. If the user provides brand colors, preserve them. Any non-CSV color must appear as Source: user in PRODUCT.md or as a documented derivation in DESIGN.md.
Typography: ${CSV_DATA_ROOT}/typography.csv - pick by row number. Copy exact font names.
Avoid: Inter, Roboto, Geist, Plus Jakarta Sans, Space Grotesk (overused).
Write DESIGN.md with all tokens before building any component.

## STEP 6: Build

Build all components following the plan. Use generate_image for hero visuals. If unavailable, build product-specific SVG or component preview. Never use Unsplash/Pexels/Pixabay/Picsum.

## STEP 7: Post-build self-check (MANDATORY, do not skip)

Before declaring done, run ALL of these from the project root:

1. node ${QUALITY_SCRIPT} --check .  -- read-only: catches em-dashes, buzzwords, fake numbers, stock photos, unsupported EVIDENCE.md claims
2. node ${LAYOUT_SCRIPT} .  -- read-only: catches off-palette colors, motion timing issues, layout problems
3. npm run build  -- catches type errors and build failures
4. npx -y impeccable detect src/  -- catches gradient-text, ai-color-palette, em-dashes (if available)

If ANY command reports issues: fix and rerun. Do not declare done with blocking issues.
For em-dashes only, run node ${QUALITY_SCRIPT} --fix . and then rerun --check.
Take desktop, mobile 375px, tablet 1024px, and section viewport screenshots. Scroll top to bottom before screenshots.

## STEP 8: Anti-slop verification

- Substitution test: Could the product name and accent color be swapped while 80% stays plausible for another product? If yes, rewrite generic parts.
- Rationale test: Does every section answer "what user need does this serve?" If only answer is "landing pages usually do this", rewrite.
- Anti-overcorrection: Is the direction predictable from the category alone? If yes, justify why this specific project needs this direction.

## CRITICAL RULES

**Copy:**
Banned words: revolutionize, cutting-edge, seamless, empower, unlock, leverage, synergy, next-gen, game-changing, best-in-class, world-class, robust, scalable, holistic, comprehensive, innovative, transformative, elevate, curated, effortless, frictionless, pioneering, groundbreaking, next-level, future-proof, bulletproof, blazing-fast, lightning-fast, world-leading, industry-leading, turnkey, battle-tested, mission-critical, enterprise-grade, supercharge.
Banned patterns: "Not just X, but Y", "Whether you're X or Y", "All-in-one", "Built for everyone".
Read every visible string aloud. If it sounds like marketing email, rewrite. Short sentences. Active voice.

**Motion:** Every scroll effect must explain the product. No decoration-only scroll. No horizontal scroll on mobile. One pinned scene max unless brief asks for narrative.
**Images:** Never use stock photo CDNs. Prefer generate_image. Fallback: product-specific SVG or component preview.
**Honesty:** No invented prices, metrics, counts, testimonials. If missing: "Price on request" or [NEEDS INPUT].
**Scope after approval:** Allowed: animation timing, copy polish, spacing, responsive fixes. Requires re-approval: new pages, new features, new sections, SDK examples.

[/DESIGNER MODE]`;

// ── State management ───────────────────────────────────────────────────

function readState(): Record<string, boolean> {
  try {
    if (existsSync(STATE_FILE)) {
      const raw = JSON.parse(readFileSync(STATE_FILE, "utf-8")) as unknown;
      if (!raw || typeof raw !== "object") return {};

      const record = raw as Record<string, unknown>;
      if ("enabled" in record) {
        if (typeof record.cwd === "string") {
          return { [record.cwd]: record.enabled === true };
        }
        return { [GLOBAL_STATE_KEY]: record.enabled === true };
      }

      const state: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(record)) {
        if (typeof value === "boolean") state[key] = value;
      }
      return state;
    }
  } catch {}
  return {};
}

function writeState(state: Record<string, boolean>): void {
  mkdirSync(join(HOME, ".omp", "agent"), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state));
}

function isOn(cwd?: string): boolean {
  const state = readState();
  const activeCwd = cwd ?? process.cwd();
  return state[activeCwd] === true || state[GLOBAL_STATE_KEY] === true;
}

function toggle(cwd: string): boolean {
  const state = readState();
  delete state[GLOBAL_STATE_KEY];
  const newState = !state[cwd];
  state[cwd] = newState;
  writeState(state);
  setDesignerMcpEnabled(newState);
  return newState;
}

// ── MCP config management ──────────────────────────────────────────────

const DESIGNER_MCP_NAMES: Record<string, true> = {
  "21st-dev-magic": true,
  "ui-layouts": true,
  "designmd": true,
  "chrome-devtools": true,
};

const MCP_CONFIG = join(HOME, ".omp", "agent", "mcp.json");

function setDesignerMcpEnabled(enabled: boolean): void {
  try {
    if (!existsSync(MCP_CONFIG)) return;
    const raw = readFileSync(MCP_CONFIG, "utf-8");
    const config = JSON.parse(raw) as Record<string, unknown>;
    const servers = config.mcpServers as Record<string, Record<string, unknown>> | undefined;
    if (!servers || typeof servers !== "object") return;

    let changed = false;
    for (const [name, server] of Object.entries(servers)) {
      if (DESIGNER_MCP_NAMES[name] === true && server && typeof server === "object") {
        if (server.enabled !== enabled) {
          server.enabled = enabled;
          changed = true;
        }
      }
    }

    if (changed) {
      writeFileSync(MCP_CONFIG, JSON.stringify(config, null, 2) + String.fromCharCode(10));
    }
  } catch { /* mcp.json missing or corrupt */ }
}

// ── Prompt normalization ───────────────────────────────────────────────

function normalizePromptList(systemPrompt?: string | string[]): string[] {
  if (Array.isArray(systemPrompt)) return systemPrompt;
  return systemPrompt ? [systemPrompt] : [];
}

function removeDesignerPrompt(prompt: string): string {
  const markerIndex = prompt.search(DESIGNER_MARKER_PATTERN);
  if (markerIndex < 0) return prompt;
  return prompt.slice(0, markerIndex).trimEnd();
}

function withoutDesignerPrompts(prompts: string[]): string[] {
  const cleaned: string[] = [];
  for (const prompt of prompts) {
    const withoutDesigner = removeDesignerPrompt(prompt);
    if (withoutDesigner.trim().length > 0) cleaned.push(withoutDesigner);
  }
  return cleaned;
}

// ── Utilities ──────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function tracePathForCwd(cwd?: string): string {
  const activeCwd = cwd ?? process.cwd();
  const basename = activeCwd.split("/").filter(Boolean).pop() ?? "root";
  return join(TRACE_DIR, `${basename}-${shortHash(activeCwd)}.jsonl`);
}

function safePath(path: unknown, cwd?: string): string | undefined {
  if (typeof path !== "string") return undefined;
  const activeCwd = cwd ?? process.cwd();
  if (path.startsWith(activeCwd)) return relative(activeCwd, path) || ".";
  if (path.startsWith(HOME)) return `~/${relative(HOME, path)}`;
  return path;
}

function commandKind(command: unknown): string | undefined {
  if (typeof command !== "string") return undefined;
  if (command.includes("fix-ai-slop.mjs")) return "fix-ai-slop";
  if (command.includes("analyze-layout.mjs")) return "analyze-layout";
  if (command.includes("npm run build")) return "npm-run-build";
  if (command.includes("bun run build")) return "bun-run-build";
  if (command.includes("impeccable detect")) return "impeccable-detect";
  return command.trim().split(/\s+/)[0];
}

// ── Trace redaction ──────────────────────────────────────────────────

const SECRET_PATTERNS = [
  /npm_[A-Za-z0-9]{20,}/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  /gh[pousr]_[A-Za-z0-9_]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /Bearer\s+[A-Za-z0-9_.\-+/=]{20,}/g,
];

function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    let result = value;
    for (const pattern of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      result = result.replace(pattern, "[REDACTED]");
    }
    // Redact long hex strings that look like API keys (32+ hex chars in env-like contexts)
    result = result.replace(/(?:API_KEY|TOKEN|SECRET|PASSWORD)\s*[:=]\s*["']?([0-9a-fA-F]{32,})["']?/gi,
      (match) => match.replace(/[0-9a-fA-F]{32,}/, "[REDACTED]"));
    return result;
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = redactSecrets(v);
    }
    return result;
  }
  return value;
}

function writeTrace(cwd: string | undefined, event: string, details: Record<string, unknown> = {}): void {
  try {
    if (!isOn(cwd) && event !== "designer_disabled") return;
    mkdirSync(TRACE_DIR, { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      cwd: cwd ?? process.cwd(),
      ...redactSecrets(details) as Record<string, unknown>,
    };
    appendFileSync(tracePathForCwd(cwd), JSON.stringify(entry) + "\n");
  } catch { /* tracing must never break the agent loop */ }
}

// ── Skill gate instances (in-memory, per-cwd) ──────────────────────────

const gateInstances = new Map<string, SkillGate>();

function getGate(cwd?: string): SkillGate | undefined {
  const activeCwd = cwd ?? process.cwd();
  return gateInstances.get(activeCwd);
}

function initGate(cwd: string): SkillGate {
  const gate = new SkillGate({
    sessionId: randomUUID(),
    projectRoot: cwd,
    resolveSkillPath,
  });
  gateInstances.set(cwd, gate);
  return gate;
}

function gateReportPathForCwd(cwd?: string): string {
  const activeCwd = cwd ?? process.cwd();
  const basename = activeCwd.split("/").filter(Boolean).pop() ?? "root";
  return join(GATE_DIR, `${basename}-${shortHash(activeCwd)}.json`);
}

function saveGateReport(cwd?: string): void {
  const gate = getGate(cwd);
  if (!gate) return;
  try {
    mkdirSync(GATE_DIR, { recursive: true });
    writeFileSync(gateReportPathForCwd(cwd), JSON.stringify(gate.generateReport(), null, 2) + "\n");
  } catch { /* gate report persistence must never break the agent */ }
}

function readGateReport(cwd?: string): Record<string, unknown> | null {
  try {
    const path = gateReportPathForCwd(cwd);
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    }
  } catch {}
  return null;
}

// ── Phase inference (post-gate, observational) ─────────────────────────

/**
 * Infer a phase transition from a tool call, based on the new state machine.
 * Only called after skills_ready — the gate handles idle → loading_skills → skills_ready.
 */
function inferPhaseTransition(
  details: Record<string, unknown>,
  currentPhase: string,
): string | null {
  const tool = typeof details.tool === "string" ? details.tool : "";
  const relPath = typeof details.relativePath === "string" ? details.relativePath : "";
  const kind = typeof details.commandKind === "string" ? details.commandKind : "";

  // Validator or build command → validating
  if (kind === "fix-ai-slop" || kind === "analyze-layout" || kind === "impeccable-detect" ||
      kind === "npm-run-build" || kind === "bun-run-build") {
    return PHASES.VALIDATING;
  }

  // Writing src/ files → building
  if ((tool === "write" || tool === "edit") && relPath.startsWith("src/")) {
    return PHASES.BUILDING;
  }

  // Writing DESIGN.md → plan_ready
  if ((tool === "write" || tool === "edit") && relPath === "DESIGN.md") {
    return PHASES.PLAN_READY;
  }

  // Writing PRODUCT.md/EVIDENCE.md → brief_ready
  if ((tool === "write" || tool === "edit") && (relPath === "PRODUCT.md" || relPath === "EVIDENCE.md")) {
    return PHASES.BRIEF_READY;
  }

  // resolve tool → approved
  if (tool === "resolve") {
    return PHASES.APPROVED;
  }

  return null;
}

function summarizeToolEvent(event: unknown, cwd?: string): Record<string, unknown> {
  const record = asRecord(event);
  const input = asRecord(record.input);
  const result = asRecord(record.result);
  const summary: Record<string, unknown> = {};
  const toolName = typeof record.toolName === "string" ? record.toolName : record.name;
  if (typeof toolName === "string") summary.tool = toolName;
  const filePath = input.path ?? input.file ?? input.cwd;
  const safe = safePath(filePath, cwd);
  if (safe) summary.relativePath = safe;
  if (typeof filePath === "string") summary.filePath = filePath;
  const kind = commandKind(input.command);
  if (kind) summary.commandKind = kind;
  if (typeof record.isError === "boolean") summary.isError = record.isError;
  if (typeof result.isError === "boolean") summary.isError = result.isError;
  return summary;
}

// ── Doctor report ──────────────────────────────────────────────────────

function fileHash(path: string): string {
  if (!existsSync(path)) return "missing";
  return shortHash(readFileSync(path, "utf-8"));
}

function packageVersion(cwd: string): string {
  const cwdPackage = join(cwd, "package.json");
  if (existsSync(cwdPackage)) {
    try {
      const parsed = JSON.parse(readFileSync(cwdPackage, "utf-8")) as Record<string, unknown>;
      if (typeof parsed.version === "string") return parsed.version;
    } catch {}
  }
  const extensionPackage = join(EXTENSION_ROOT, "package.json");
  if (existsSync(extensionPackage)) {
    try {
      const parsed = JSON.parse(readFileSync(extensionPackage, "utf-8")) as Record<string, unknown>;
      if (typeof parsed.version === "string") return parsed.version;
    } catch {}
  }
  return "unknown";
}

function mcpStatus(): string {
  try {
    if (!existsSync(MCP_CONFIG)) return "missing";
    const raw = JSON.parse(readFileSync(MCP_CONFIG, "utf-8")) as Record<string, unknown>;
    const servers = asRecord(raw.mcpServers);
    const enabled = Object.entries(servers)
      .filter(([name, server]) => DESIGNER_MCP_NAMES[name] === true && asRecord(server).enabled === true)
      .map(([name]) => name);
    return `${enabled.length}/4 enabled${enabled.length > 0 ? ` (${enabled.join(", ")})` : ""}`;
  } catch {
    return "invalid";
  }
}

function buildDoctorReport(cwd: string): string {
  const requiredSkills = REQUIRED_DESIGNER_SKILLS.filter((s) => s.required);
  const skillsFound = requiredSkills.filter((s) => {
    const p = resolveSkillPath(s.name);
    return p && existsSync(p);
  }).length;
  const gate = getGate(cwd);
  const savedReport = readGateReport(cwd);
  const gateSummary = gate?.getSummary() ?? "Skill gate: not initialized";
  const lines = [
    "Designer doctor",
    "",
    `Source/package version: ${packageVersion(cwd)}`,
    `Designer mode for cwd: ${isOn(cwd) ? "enabled" : "disabled"}`,
    `Skill gate: ${gate ? gate.phase : (savedReport?.phase as string ?? "idle")}`,
    gateSummary,
    `Manifest hash: ${computeManifestHash()}`,
    `Required skills installed: ${skillsFound}/${requiredSkills.length}`,
    "",
    `Installed extension hash: ${fileHash(join(EXTENSION_ROOT, "index.ts"))}`,
    `Installed fix-ai-slop: ${existsSync(QUALITY_SCRIPT) ? "present" : "missing"} (${fileHash(QUALITY_SCRIPT)})`,
    `Installed analyze-layout: ${existsSync(LAYOUT_SCRIPT) ? "present" : "missing"} (${fileHash(LAYOUT_SCRIPT)})`,
    `MCP config: ${mcpStatus()}`,
    `Trace file: ${tracePathForCwd(cwd)}`,
    `Gate report: ${gateReportPathForCwd(cwd)}`,
    "",
    "Release gate: run npm run check:release && npm run test:skill-gate && npm run test:validators from the source repo.",
  ];
  return lines.join("\n");
}

// ── Session stop validation ────────────────────────────────────────────

function looksLikeDesignerProject(cwd: string): boolean {
  const hasDesignArtifact =
    existsSync(join(cwd, "DESIGN.md")) ||
    existsSync(join(cwd, "PRODUCT.md")) ||
    existsSync(join(cwd, "EVIDENCE.md"));
  const hasAppSurface = existsSync(join(cwd, "src")) || existsSync(join(cwd, "package.json"));
  return hasDesignArtifact && hasAppSurface;
}

function truncateForContext(text: string): string {
  const max = 6000;
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n...[truncated ${text.length - max} chars]`;
}

function runNodeValidator(scriptPath: string, args: string[], cwd: string): { ok: boolean; output: string } {
  if (!existsSync(scriptPath)) {
    return { ok: false, output: `Missing validator: ${scriptPath}` };
  }
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: "utf-8",
    timeout: 45_000,
    maxBuffer: 1024 * 1024,
  });
  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const stderr = typeof result.stderr === "string" ? result.stderr : "";
  const output = `${stdout}${stderr}`.trim();
  if (result.error) {
    return { ok: false, output: result.error.message };
  }
  return { ok: result.status === 0, output };
}

function runSessionStopValidation(cwd: string): { ok: true; skipped?: string } | { ok: false; output: string } {
  if (!looksLikeDesignerProject(cwd)) {
    return { ok: true, skipped: "no DESIGN.md/PRODUCT.md/EVIDENCE.md project artifacts" };
  }

  const quality = runNodeValidator(QUALITY_SCRIPT, ["--check", "."], cwd);
  const layout = runNodeValidator(LAYOUT_SCRIPT, ["."], cwd);
  const failures = [
    quality.ok ? "" : `fix-ai-slop --check failed:\n${quality.output}`,
    layout.ok ? "" : `analyze-layout failed:\n${layout.output}`,
  ].filter(Boolean);

  if (failures.length === 0) return { ok: true };
  return { ok: false, output: truncateForContext(failures.join("\n\n")) };
}

// ── Extension API interfaces ───────────────────────────────────────────

interface CommandContext {
  ui?: { notify?: (msg: string, level: string) => void };
  editor?: { setText?: (text: string) => void };
}

interface AgentStartEvent {
  systemPrompt?: string | string[];
}

interface ResourceDiscoverResult {
  skillPaths: string[];
}

interface ExtensionAPI {
  registerCommand(
    name: string,
    opts: { description: string; aliases?: string[]; handler: (args: unknown, ctx: CommandContext) => void }
  ): void;
  on(event: string, handler: (event?: unknown, ctx?: { cwd?: string }) => unknown): void;
}

// ── Extension entry point ──────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
  try {
    if (isOn(process.cwd())) setDesignerMcpEnabled(true);
  } catch {}

  // ── /designer toggle ─────────────────────────────────────────────────

  pi.registerCommand("designer", {
    description: "Toggle designer mode -- autonomous UI/UX design workflow with skill gate enforcement",
    aliases: ["design"],
    handler: (_args: unknown, ctx: CommandContext) => {
      const cwd = process.cwd();
      const nowOn = toggle(cwd);
      writeTrace(cwd, nowOn ? "designer_enabled" : "designer_disabled");
      if (nowOn) {
        const gate = initGate(cwd);
        writeTrace(cwd, "skill_gate_initialized", { sessionId: gate.sessionId, phase: gate.phase });
        ctx?.ui?.notify?.(
          "DESIGNER MODE ON -- skill gate active. Read all required skills before proceeding. Run /reload to activate MCPs.",
          "info"
        );
      } else {
        gateInstances.delete(cwd);
        ctx?.ui?.notify?.("DESIGNER MODE OFF", "info");
      }
      ctx?.editor?.setText?.("");
    },
  });

  // ── /designer-doctor ─────────────────────────────────────────────────

  pi.registerCommand("designer-doctor", {
    description: "Show designer source/install/skill-gate/trace health",
    aliases: ["design-doctor"],
    handler: (_args: unknown, ctx: CommandContext) => {
      const cwd = process.cwd();
      const report = buildDoctorReport(cwd);
      ctx?.editor?.setText?.(report);
      ctx?.ui?.notify?.("Designer doctor report written to the editor.", "info");
      writeTrace(cwd, "doctor_run");
    },
  });

  // ── /designer-reset ────────────────────────────────────────────────

  pi.registerCommand("designer-reset", {
    description: "Reset the skill gate for a fresh run (clears ordering violations)",
    aliases: ["design-reset"],
    handler: (_args: unknown, ctx: CommandContext) => {
      const cwd = process.cwd();
      const gate = getGate(cwd);
      if (gate) {
        gate.resetRun();
        saveGateReport(cwd);
        writeTrace(cwd, "gate_reset", { newRunId: gate.runId });
        ctx?.ui?.notify?.(
          "Designer gate reset — fresh run started. Read designer-master first.",
          "info"
        );
      } else {
        ctx?.ui?.notify?.("No active designer gate to reset.", "warn");
      }
      ctx?.editor?.setText?.("");
    },
  });

  // ── Skill discovery ──────────────────────────────────────────────────

  pi.on("resources_discover", (_event?: unknown, ctx?: { cwd?: string }) => {
    if (!isOn(ctx?.cwd)) return;
    const requiredSkills = REQUIRED_DESIGNER_SKILLS.filter((s) => s.required);
    const skillPaths = requiredSkills
      .map((s) => resolveSkillPath(s.name))
      .filter((p): p is string => p !== null);
    writeTrace(ctx?.cwd, "skills_discovered", {
      count: skillPaths.length,
      expected: requiredSkills.length,
      manifestHash: computeManifestHash(),
    });
    return { skillPaths };
  });

  // ── Prompt injection ─────────────────────────────────────────────────

  pi.on("before_agent_start", (event?: unknown, ctx?: { cwd?: string }) => {
    if (!isOn(ctx?.cwd)) return;
    const agentEvent = asRecord(event);
    const prompts = withoutDesignerPrompts(normalizePromptList(agentEvent.systemPrompt as string | string[] | undefined));
    const requiredCount = REQUIRED_DESIGNER_SKILLS.filter((s) => s.required).length;
    writeTrace(ctx?.cwd, "prompt_injected", { skillsExpected: requiredCount, gateActive: true });
    return { systemPrompt: [...prompts, PROMPT_INJECT] };
  });

  // ── Agent start: initialize skill gate ───────────────────────────────

  pi.on("agent_start", (_event?: unknown, ctx?: { cwd?: string }) => {
    if (isOn(ctx?.cwd)) {
      const cwd = ctx?.cwd ?? process.cwd();
      // Initialize gate if not already done (e.g., agent started without /designer toggle)
      if (!getGate(cwd)) {
        initGate(cwd);
      }
      writeTrace(cwd, "agent_start", { gatePhase: getGate(cwd)?.phase ?? "idle" });
    } else {
      writeTrace(ctx?.cwd, "agent_start");
    }
  });

  pi.on("agent_end", (_event?: unknown, ctx?: { cwd?: string }) => {
    saveGateReport(ctx?.cwd);
    writeTrace(ctx?.cwd, "agent_end", { gatePhase: getGate(ctx?.cwd)?.phase ?? "idle" });
  });

  // ── Tool call: PRE-EXECUTION blocking + skill-read begin ───────────
  //
  // OMP Extension API: tool_call handlers can return { block: true, reason }
  // to prevent the tool from executing. This is verified from the OMP source:
  //   shared-events.ts → ToolCallEventResult { block?: boolean; reason?: string }
  //   extensions/types.ts → "Fired before a tool executes. Can block."
  //
  // Deny-by-default: ALL tools are checked against the allowlist.
  // Only read-only/inspection tools are allowed before skills_ready.
  // Everything else — write, edit, bash, MCP, browser, unknown tools — is blocked.

  pi.on("tool_call", (event?: unknown, ctx?: { cwd?: string }) => {
    const eventRecord = asRecord(event);
    const toolCallId = typeof eventRecord.toolCallId === "string" ? eventRecord.toolCallId : "";
    const toolName = typeof eventRecord.toolName === "string" ? eventRecord.toolName : "";
    const input = asRecord(eventRecord.input);

    const details = summarizeToolEvent(event, ctx?.cwd);
    writeTrace(ctx?.cwd, "tool_call", { ...details, toolCallId });

    if (!isOn(ctx?.cwd)) return;

    const gate = getGate(ctx?.cwd);
    if (!gate) return;

    // ── Detect skill reads: register as pending (not complete yet) ──
    const match = gate.matchSkillRead(input);
    if (match) {
      gate.beginRead(toolCallId, match.skill, match.selector);
      const skillName = (match.skill as { name: string }).name;
      writeTrace(ctx?.cwd, "skill_read_begin", {
        skill: skillName,
        selector: match.selector || "(none)",
        toolCallId,
        gatePhase: gate.phase as string,
        orderViolated: gate.orderViolated,
      });
      // Skill reads are never blocked — allow the read to proceed
      return;
    }

    // ── Gate check: deny-by-default for ALL tools ──
    if (toolName) {
      const check = gate.checkTool(toolName);
      if (!check.allowed) {
        writeTrace(ctx?.cwd, "skill_gate_blocked", {
          tool: toolName,
          toolCallId,
          missing: check.missingSkills,
          phase: gate.phase,
          preExecution: true,
        });
        saveGateReport(ctx?.cwd);
        // Return { block: true, reason } — OMP prevents the tool from executing
        return { block: true, reason: check.message };
      }
    }
  });

  // ── Tool result: complete skill reads + post-gate phase tracking ────

  pi.on("tool_result", (event?: unknown, ctx?: { cwd?: string }) => {
    const eventRecord = asRecord(event);
    const toolCallId = typeof eventRecord.toolCallId === "string" ? eventRecord.toolCallId : "";
    const isError = eventRecord.isError === true;
    const details = asRecord(eventRecord.details);

    // Extract truncation info from ReadToolDetails if present
    const truncation = details?.truncation ?? null;

    const summary = summarizeToolEvent(event, ctx?.cwd);
    writeTrace(ctx?.cwd, "tool_result", { ...summary, toolCallId, isError });

    if (!isOn(ctx?.cwd)) return;

    const gate = getGate(ctx?.cwd);
    if (!gate) return;

    // ── Complete pending skill reads ──
    // Only register the read as (partially or fully) complete if the
    // tool_result was successful and content wasn't truncated in a way
    // that breaks coverage.
    if (toolCallId && gate.pendingReads.has(toolCallId)) {
      // Capture skill name BEFORE completeRead deletes the pending entry
      const pendingEntry = gate.pendingReads.get(toolCallId);
      const skillName = pendingEntry ? (pendingEntry.skill as { name: string }).name : "(unknown)";
      const registered = gate.completeRead(toolCallId, isError, truncation);

      if (!registered && isError) {
        writeTrace(ctx?.cwd, "skill_read_failed", { skill: skillName, toolCallId });
      } else {
        const record = gate.readRecords.get(skillName);
        writeTrace(ctx?.cwd, "skill_read_complete", {
          skill: skillName,
          toolCallId,
          status: record?.status ?? "pending",
          bytesRead: record?.bytesRead ?? 0,
          gatePhase: gate.phase as string,
        });
      }

      // Check if gate just opened
      if ((gate.phase as string) === PHASES.SKILLS_READY) {
        saveGateReport(ctx?.cwd);
        writeTrace(ctx?.cwd, "designer_skills_ready", {
          masterReadFirst: gate.wasMasterReadFirst(),
          summary: gate.getSummary(),
        });
      }
    }

    // ── Post-gate phase inference (observational, for reporting) ──
    if (gate.isReady()) {
      const inferred = inferPhaseTransition(summary, gate.phase);
      if (inferred) {
        if (gate.transitionTo(inferred)) {
          writeTrace(ctx?.cwd, "phase_transition", { from: gate.phase, to: inferred });
          saveGateReport(ctx?.cwd);
        }
      }
    }
  });

  // ── Session stop: validate gate + run post-build validators ──────────

  pi.on("session_stop", (_event?: unknown, ctx?: { cwd?: string }) => {
    if (!isOn(ctx?.cwd)) return;
    const cwd = ctx?.cwd ?? process.cwd();
    const gate = getGate(cwd);

    saveGateReport(cwd);

    // ── Gate validation ──────────────────────────────────────────────
    if (gate && !gate.isReady()) {
      const report = gate.generateReport();
      writeTrace(cwd, "session_stop_gate_not_ready", {
        missing: report.missingSkills,
        phase: report.phase,
        orderViolated: report.orderViolated,
      });

      // Ordering violation is permanent — requires explicit /designer-reset
      if (report.orderViolated) {
        return {
          continue: true,
          additionalContext: [
            "[DESIGNER SKILL GATE: ORDER VIOLATION]",
            `Phase: ${report.phase}`,
            `Violation: ${report.orderViolationSkill} was started before designer-master completed.`,
            "",
            "designer-master MUST be read completely before any other required skill.",
            "This violation is permanent for this run.",
            "Run /designer-reset to start a fresh skill gate run.",
            "[/DESIGNER SKILL GATE]",
          ].join("\n"),
        };
      }

      return {
        continue: true,
        additionalContext: [
          "[DESIGNER SKILL GATE: NOT READY]",
          `Phase: ${report.phase}`,
          `Missing skills: ${report.missingSkills.join(", ")}`,
          "",
          "You must read all required skills before the session can end.",
          "Read the missing skills using their skill:// URIs.",
          "The extension verifies completion — do not claim skills were read.",
          "[/DESIGNER SKILL GATE]",
        ].join("\n"),
      };
    }

    // Validate skill content hasn't changed
    if (gate) {
      const changed = gate.validateReads();
      if (changed.length > 0) {
        writeTrace(cwd, "skill_content_changed", { changed });
        return {
          continue: true,
          additionalContext: [
            "[DESIGNER SKILL GATE: CONTENT CHANGED]",
            `Skills with changed content: ${changed.join(", ")}`,
            "Re-read these skills before continuing.",
            "[/DESIGNER SKILL GATE]",
          ].join("\n"),
        };
      }
    }

    // ── Post-build validation ────────────────────────────────────────
    const phase = gate?.phase ?? "unknown";
    writeTrace(cwd, "auto_validation_started", { phase });
    const validation = runSessionStopValidation(cwd);
    if (validation.ok) {
      if (gate) gate.transitionTo(PHASES.DONE);
      writeTrace(cwd, "auto_validation_passed", {
        phase: gate?.phase ?? "done",
        ...(validation.skipped ? { skipped: validation.skipped } : {}),
      });
      return;
    }

    writeTrace(cwd, "auto_validation_failed", { phase });
    return {
      continue: true,
      additionalContext: [
        "[DESIGNER AUTO-VALIDATION FAILED]",
        `Phase: ${phase}`,
        "Before answering the user, fix these blocking issues and rerun validation from the project root.",
        "",
        validation.output,
        "",
        "Required commands after fixes:",
        `node ${QUALITY_SCRIPT} --check .`,
        `node ${LAYOUT_SCRIPT} .`,
        "[/DESIGNER AUTO-VALIDATION FAILED]",
      ].join("\n"),
    };
  });
}
