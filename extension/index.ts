/**
 * omp-designer v5 extension for oh-my-pi.
 *
 * Design goals:
 * - one extension instance, even when discovery returns the same package twice
 * - package-relative assets (no dependency on legacy managed-skill copies)
 * - prompt-only workflow guidance; no skill-read tool gate
 * - MCP configuration is observed, never mutated
 * - bounded delivery validation with no infinite continuation loop
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HOME = homedir();
const MODULE_FILE = fileURLToPath(import.meta.url);
const PACKAGE_ROOT = resolve(dirname(MODULE_FILE), "..");
const SKILLS_ROOT = join(PACKAGE_ROOT, "skills");
const DATA_ROOT = join(PACKAGE_ROOT, "data", "ui-ux-pro-max");
const SCRIPTS_ROOT = join(PACKAGE_ROOT, "scripts");
const QUALITY_SCRIPT = join(SCRIPTS_ROOT, "fix-ai-slop.mjs");
const LAYOUT_SCRIPT = join(SCRIPTS_ROOT, "analyze-layout.mjs");

const AGENT_ROOT = join(HOME, ".omp", "agent");
const STATE_FILE = join(AGENT_ROOT, "designer-state.json");
const MCP_CONFIG = join(AGENT_ROOT, "mcp.json");
const TRACE_DIR = join(AGENT_ROOT, "designer-traces");
const LEGACY_EXTENSION = join(AGENT_ROOT, "extensions", "designer", "index.ts");
const GLOBAL_STATE_KEY = "*";
const INSTANCE_SYMBOL = Symbol.for("omp-designer.v5.registered");
const INSTANCE_ENV = "OMP_DESIGNER_V5_REGISTERED_PID";
const INSTANCE_LOCK = join(tmpdir(), `omp-designer-v5-${process.pid}.lock`);

const DESIGNER_SKILLS = Object.freeze([
  { name: "designer-master", file: join(SKILLS_ROOT, "designer-master.md"), role: "core" },
  { name: "design-md", file: join(SKILLS_ROOT, "design-md.md"), role: "visual-system" },
  { name: "animate", file: join(SKILLS_ROOT, "animate.md"), role: "motion" },
  { name: "review-skill", file: join(SKILLS_ROOT, "review-skill.md"), role: "review" },
]);

const DESIGNER_MCP_NAMES = new Set([
  "21st-dev-magic",
  "ui-layouts",
  "designmd",
  "chrome-devtools",
]);

const PROMPT_MARKER_RE = /\n?\[DESIGNER MODE: ACTIVE v5\][\s\S]*?\[\/DESIGNER MODE\]\n?/g;

const DESIGNER_PROMPT = `[DESIGNER MODE: ACTIVE v5]

You are the project's UI/UX design engineer. Produce specific, usable interfaces while respecting the user's scope and existing code.

## Workflow

1. Read ${join(SKILLS_ROOT, "designer-master.md")} once at the start of a substantive design task.
2. Inspect the existing project before proposing or changing architecture.
3. Choose interaction behavior from the user's request:
   - If the user explicitly asks for a plan or approval, present a concise plan and wait.
   - If the user says to build immediately, do not ask preference questions.
   - Otherwise ask at most two questions, and only when the answer materially changes the result.
4. For a new page or major redesign, create short PRODUCT.md, EVIDENCE.md, and DESIGN.md files. For a small edit, do not create process artifacts unless they add value.
5. Read ${join(SKILLS_ROOT, "design-md.md")} for a new visual system or major redesign.
6. Read ${join(SKILLS_ROOT, "animate.md")} only when meaningful motion is requested or already present.
7. Build and test in the user's project. Preserve established brand tokens and dependencies unless the user asked for a redesign.
8. Read ${join(SKILLS_ROOT, "review-skill.md")} before delivery and perform the proportional review it describes.

## Research and MCP policy

MCP research is optional and task-driven. Never call every MCP merely to fill a research log.
- Prefer the built-in browser or chrome-devtools for browser QA.
- Use ui-layouts only when a component/layout reference would materially help.
- Use 21st-dev only for a relevant component or logo search.
- Use designmd only when an external design-kit reference is genuinely useful.
- If a server is unavailable, continue with local inspection. Do not loop on MCP failures.

Palette data: ${join(DATA_ROOT, "colors.csv")}
Typography data: ${join(DATA_ROOT, "typography.csv")}
Search these files by relevant terms and read only matching rows. A user-provided brand system takes precedence. Validate contrast instead of assuming a CSV row is accessible.

## Product and copy integrity

- Do not invent prices, metrics, customers, certifications, testimonials, shipping terms, or product capabilities.
- Treat the user's product description as a closed fact set. Before writing page copy, list the allowed capabilities in PRODUCT.md. Words such as offline, sync, automatic, voice, real-time, platform support, and audience size are claims; omit them unless supplied or sourced.
- Label demo data as demo data.
- A product preview with invented names, addresses, job numbers, or record content must show a visible "Example" or "Demo" label.
- Prefer concrete copy tied to the actual product. Treat buzzword and style lists as review signals, not universal bans.
- Do not use third-party logos as social proof unless the user supplied or verified that relationship.
- Do not hotlink random stock-photo placeholders in final work.
- Do not ship prominent links or buttons that point to "#" or have no behavior.
- Do not simulate signup or contact success without a real delivery mechanism. If no destination is supplied, use truthful in-page navigation or plain status copy.

## Implementation quality

- Use semantic HTML, visible focus, usable keyboard behavior, and responsive layouts.
- For a full marketing page, inspect the composition map before coding. If two sections both resolve to equal card grids, redesign one around the content relationship or workflow unless repeated comparison is the actual information structure.
- Preserve reduced-motion behavior when animation exists.
- Do not add animation, dark mode, routes, dependencies, or sections that the task does not need.
- Do not install a motion library only to fade sections into view.
- Avoid fake product screenshots. Use a real component preview, supplied assets, generated assets, or an explicit placeholder.

## Delivery checks

For substantive frontend work, run:
1. node ${QUALITY_SCRIPT} --check .
2. node ${LAYOUT_SCRIPT} .
3. the project's build command
4. browser QA at a narrow and wide viewport

Warnings are review input. Only true blockers should prevent delivery. Report commands actually run and unresolved limitations accurately.

[/DESIGNER MODE]`;

interface CommandContext {
  cwd?: string;
  ui?: { notify?: (message: string, level: string) => void };
  editor?: { setText?: (text: string) => void };
}

interface ExtensionContext {
  cwd?: string;
}

interface ExtensionAPI {
  registerCommand(
    name: string,
    options: {
      description: string;
      aliases?: string[];
      handler: (args: unknown, ctx: CommandContext) => void | Promise<void>;
    },
  ): void;
  on(
    event: string,
    handler: (event?: unknown, ctx?: ExtensionContext) => unknown | Promise<unknown>,
  ): void;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function readState(): Record<string, boolean> {
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const record = parsed as Record<string, unknown>;

    // Migrate the old global shape without discarding it.
    if (typeof record.enabled === "boolean") {
      if (typeof record.cwd === "string") return { [record.cwd]: record.enabled };
      return { [GLOBAL_STATE_KEY]: record.enabled };
    }

    return Object.fromEntries(
      Object.entries(record).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
    );
  } catch {
    return {};
  }
}

function writeState(state: Record<string, boolean>): void {
  mkdirSync(AGENT_ROOT, { recursive: true });
  const temporary = `${STATE_FILE}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, STATE_FILE);
}

function isEnabled(cwd = process.cwd()): boolean {
  if (process.env.OMP_DESIGNER_MODE === "1") return true;
  if (process.env.OMP_DESIGNER_MODE === "0") return false;
  const state = readState();
  return state[cwd] === true || state[GLOBAL_STATE_KEY] === true;
}

function toggle(cwd: string): boolean {
  const state = readState();
  delete state[GLOBAL_STATE_KEY];
  const enabled = state[cwd] !== true;
  if (enabled) state[cwd] = true;
  else delete state[cwd];
  writeState(state);
  return enabled;
}

function normalizeSystemPrompt(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" ? [value] : [];
}

function stripDesignerPrompt(prompts: string[]): string[] {
  return prompts
    .map((prompt) => prompt.replace(PROMPT_MARKER_RE, "\n").trim())
    .filter(Boolean);
}

function tracePath(cwd: string): string {
  const base = cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? "root";
  return join(TRACE_DIR, `${base}-${shortHash(cwd)}.jsonl`);
}

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/npm_[A-Za-z0-9]{20,}/g, "[REDACTED]")
      .replace(/sk-(?:ant-)?[A-Za-z0-9_-]{20,}/g, "[REDACTED]")
      .replace(/gh[pousr]_[A-Za-z0-9_]{20,}/g, "[REDACTED]")
      .replace(/Bearer\s+[A-Za-z0-9_.\-+/=]{20,}/g, "[REDACTED]");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, redact(item)]),
    );
  }
  return value;
}

function writeTrace(cwd: string, event: string, details: Record<string, unknown> = {}): void {
  try {
    mkdirSync(TRACE_DIR, { recursive: true });
    appendFileSync(tracePath(cwd), `${JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      cwd,
      ...redact(details) as Record<string, unknown>,
    })}\n`);
  } catch {
    // Observability must not break the agent.
  }
}

function safeRealpath(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

function mcpSummary(): string {
  try {
    const parsed = JSON.parse(readFileSync(MCP_CONFIG, "utf8")) as Record<string, unknown>;
    const servers = asRecord(parsed.mcpServers);
    const configured = [...DESIGNER_MCP_NAMES].filter((name) => name in servers);
    const enabled = configured.filter((name) => asRecord(servers[name]).enabled === true);
    return `${configured.length}/4 configured, ${enabled.length} enabled (${enabled.join(", ") || "none"})`;
  } catch {
    return "not configured or invalid";
  }
}

function doctorReport(cwd: string): string {
  const moduleRealpath = safeRealpath(MODULE_FILE);
  const legacyRealpath = safeRealpath(LEGACY_EXTENSION);
  const duplicateRisk = Boolean(
    legacyRealpath &&
    moduleRealpath &&
    legacyRealpath !== moduleRealpath,
  );
  const skills = DESIGNER_SKILLS.map((skill) => `${skill.name}: ${existsSync(skill.file) ? "present" : "missing"}`);

  return [
    "Designer doctor v5",
    "",
    `Mode for cwd: ${isEnabled(cwd) ? "enabled" : "disabled"}`,
    `Loaded module: ${MODULE_FILE}`,
    `Package root: ${PACKAGE_ROOT}`,
    `Legacy extension copy: ${legacyRealpath ?? "none"}`,
    `Duplicate-load risk: ${duplicateRisk ? "YES - remove the legacy copy or unlink the plugin" : "no"}`,
    `Quality validator: ${existsSync(QUALITY_SCRIPT) ? "present" : "missing"}`,
    `Layout validator: ${existsSync(LAYOUT_SCRIPT) ? "present" : "missing"}`,
    `Palette data: ${existsSync(join(DATA_ROOT, "colors.csv")) ? "present" : "missing"}`,
    `MCPs: ${mcpSummary()}`,
    "",
    ...skills,
    "",
    "Designer mode no longer mutates mcp.json and no longer blocks tools while skills are read.",
  ].join("\n");
}

function looksLikeFrontendProject(cwd: string): boolean {
  return existsSync(join(cwd, "package.json")) &&
    ["src", "app", "pages", "index.html"].some((entry) => existsSync(join(cwd, entry)));
}

interface CheckResult {
  name: string;
  ok: boolean;
  skipped?: string;
  output: string;
}

function runProcess(name: string, command: string, args: string[], cwd: string, timeout: number, extraEnv: Record<string, string> = {}): CheckResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout,
    maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, ...extraEnv },
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.error) return { name, ok: false, output: result.error.message };
  return { name, ok: result.status === 0, output };
}

function projectBuildCheck(cwd: string): CheckResult {
  try {
    const parsed = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as Record<string, unknown>;
    const scripts = asRecord(parsed.scripts);
    if (typeof scripts.build !== "string") {
      return { name: "build", ok: true, skipped: "no build script", output: "" };
    }
    return runProcess("build", "npm", ["run", "build"], cwd, 120_000);
  } catch (error) {
    return { name: "build", ok: false, output: error instanceof Error ? error.message : String(error) };
  }
}

function deliveryChecks(cwd: string, userFacts = ""): CheckResult[] {
  if (!looksLikeFrontendProject(cwd)) {
    return [{ name: "project", ok: true, skipped: "not a frontend project", output: "" }];
  }
  const factEnv: Record<string, string> = userFacts ? { DESIGNER_USER_FACTS: userFacts } : {};
  return [
    runProcess("quality", process.execPath, [QUALITY_SCRIPT, "--check", "."], cwd, 45_000, factEnv),
    runProcess("layout", process.execPath, [LAYOUT_SCRIPT, "."], cwd, 45_000),
    projectBuildCheck(cwd),
  ];
}

function truncate(text: string, max = 7000): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n...[truncated ${text.length - max} characters]`;
}

export default function designerExtension(pi: ExtensionAPI): void {
  // OMP can discover the same extension through a plugin and an explicit path.
  // Those loaders may use separate JS realms, so globalThis alone is not a
  // sufficient process-wide guard. Environment variables are shared by both.
  if (process.env[INSTANCE_ENV] === String(process.pid)) return;
  process.env[INSTANCE_ENV] = String(process.pid);

  const registry = globalThis as Record<symbol, unknown>;
  if (registry[INSTANCE_SYMBOL]) return;

  // Bun loader realms can isolate both globalThis and process.env. An exclusive
  // process-scoped file is the final atomic guard across those realms.
  try {
    const descriptor = openSync(INSTANCE_LOCK, "wx", 0o600);
    closeSync(descriptor);
    process.once("exit", () => {
      try {
        unlinkSync(INSTANCE_LOCK);
      } catch {
        // The process is exiting; stale cleanup cannot affect the session.
      }
    });
  } catch (error) {
    if (asRecord(error).code === "EEXIST") return;
    // If a platform cannot provide the lock, keep the two in-memory guards.
  }

  registry[INSTANCE_SYMBOL] = { module: MODULE_FILE, registeredAt: new Date().toISOString() };

  const validationAttempts = new Map<string, number>();
  const userFactsByCwd = new Map<string, string>();

  pi.registerCommand("designer", {
    description: "Toggle the focused omp-designer workflow for this project",
    aliases: ["design"],
    handler: (_args, ctx) => {
      const cwd = ctx.cwd ?? process.cwd();
      const enabled = toggle(cwd);
      writeTrace(cwd, enabled ? "designer_enabled" : "designer_disabled", { version: 5 });
      ctx.ui?.notify?.(
        enabled
          ? "DESIGNER MODE ON - focused workflow active. MCP configuration is unchanged."
          : "DESIGNER MODE OFF",
        "info",
      );
      ctx.editor?.setText?.("");
    },
  });

  pi.registerCommand("designer-doctor", {
    description: "Show designer install, asset, duplicate-load, and MCP health",
    aliases: ["design-doctor"],
    handler: (_args, ctx) => {
      const cwd = ctx.cwd ?? process.cwd();
      ctx.editor?.setText?.(doctorReport(cwd));
      ctx.ui?.notify?.("Designer doctor report written to the editor.", "info");
      writeTrace(cwd, "doctor_run", { version: 5 });
    },
  });

  pi.on("resources_discover", (_event, ctx) => {
    const cwd = ctx?.cwd ?? process.cwd();
    if (!isEnabled(cwd)) return;
    const skillPaths = DESIGNER_SKILLS.map((skill) => skill.file).filter(existsSync);
    writeTrace(cwd, "skills_discovered", { count: skillPaths.length, expected: DESIGNER_SKILLS.length });
    return { skillPaths };
  });

  pi.on("before_agent_start", (event, ctx) => {
    const cwd = ctx?.cwd ?? process.cwd();
    if (!isEnabled(cwd)) return;
    const userPrompt = typeof asRecord(event).prompt === "string" ? String(asRecord(event).prompt) : "";
    if (userPrompt && !userPrompt.includes("[DESIGNER DELIVERY CHECKS FAILED]")) {
      userFactsByCwd.set(cwd, userPrompt);
    }
    const prompts = stripDesignerPrompt(normalizeSystemPrompt(asRecord(event).systemPrompt));
    writeTrace(cwd, "prompt_injected", { version: 5, promptChars: DESIGNER_PROMPT.length });
    return { systemPrompt: [...prompts, DESIGNER_PROMPT] };
  });

  pi.on("session_stop", (event, ctx) => {
    const cwd = ctx?.cwd ?? process.cwd();
    if (!isEnabled(cwd)) return;

    const sessionId = typeof asRecord(event).session_id === "string"
      ? String(asRecord(event).session_id)
      : `${cwd}:unknown`;
    const attempt = (validationAttempts.get(sessionId) ?? 0) + 1;
    validationAttempts.set(sessionId, attempt);

    const checks = deliveryChecks(cwd, userFactsByCwd.get(cwd) ?? "");
    const failures = checks.filter((check) => !check.ok);
    writeTrace(cwd, failures.length === 0 ? "delivery_checks_passed" : "delivery_checks_failed", {
      sessionId,
      attempt,
      checks: checks.map(({ name, ok, skipped }) => ({ name, ok, skipped })),
    });

    if (failures.length === 0) {
      validationAttempts.delete(sessionId);
      return;
    }

    // One continuation gives the agent a chance to repair. The second failure
    // is reported by the normal assistant response instead of creating a loop.
    if (attempt >= 2) return;

    return {
      continue: true,
      additionalContext: truncate([
        "[DESIGNER DELIVERY CHECKS FAILED]",
        "Fix the true blockers below, rerun the checks, and report any remaining limitation.",
        "Warnings do not require cosmetic churn.",
        "If visible output changes, repeat browser QA and refresh affected screenshots.",
        "",
        ...failures.map((failure) => `## ${failure.name}\n${failure.output || "failed without output"}`),
        "[/DESIGNER DELIVERY CHECKS FAILED]",
      ].join("\n")),
    };
  });
}

export {
  DATA_ROOT,
  DESIGNER_PROMPT,
  DESIGNER_SKILLS,
  PACKAGE_ROOT,
  doctorReport,
  isEnabled,
};
