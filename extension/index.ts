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
  readdirSync,
  realpathSync,
  statSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { redactSecrets } from "../shared/security.mjs";

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
   - If the user explicitly asks for a plan or approval, enter a read-only plan phase: inspect and read the core plus only relevant design/motion skills, write no project files, present a concise plan, and wait. Artifact creation and implementation happen only after approval.
   - If the user says to build immediately, do not ask preference questions.
   - Otherwise ask at most two questions, and only when the answer materially changes the result.
4. After approval and before implementation of a new page or major redesign, create short PRODUCT.md, EVIDENCE.md, and DESIGN.md files. For a small edit, do not create process artifacts unless they add value.
5. Read ${join(SKILLS_ROOT, "design-md.md")} for a new visual system or major redesign.
6. Read ${join(SKILLS_ROOT, "animate.md")} only when meaningful motion is requested or already present.
7. Build and test in the user's project. Preserve established brand tokens and dependencies unless the user asked for a redesign.
8. Read ${join(SKILLS_ROOT, "review-skill.md")} before delivery and perform the proportional review it describes.

## Plan-only contract

When approval is requested, the plan is the deliverable for this turn.
- Preserve every explicit scope item. If the user requests multiple pages or routes, plan multiple concrete routes; never silently collapse them into sections of one page.
- Map the requested pages, effects, animation, scroll behavior, and approval boundary to named plan items. Do not substitute your preferred architecture for the brief.
- Aim for about 700 words and stay under 800 unless the user explicitly asks for a detailed specification, in which case go as long as needed. Cover direction, route/page purpose, interaction narrative, responsive behavior, stack, and factual/technical risks.
- Do not write PRODUCT.md, EVIDENCE.md, DESIGN.md, scaffold code, or install dependencies before approval.
- Do not read the delivery-review skill or run delivery checks during the plan-only turn.
- Never claim a skill, reference, CSV row, browser, or test was read or run unless that action actually occurred. Do not imply tool evidence from instructions merely present in the system prompt.
- Treat exact palette, typography, performance, and accessibility assertions as provisional until checked. Name a CSV row or claim contrast only after reading the complete row and validating the intended pair.
- Apply factual and functional constraints to the plan itself: do not propose metrics, testimonials, signup/contact success, or unsupported capabilities that could not be truthfully implemented.
- Mark every simulated AI output or interaction as a visible demo in the plan; never describe a scripted sequence as live reasoning or a real model.
- For timelines or educational claims, include source verification as a pre-build requirement and label future scenarios as speculation.
- Budget motion: choose one primary scroll-driven narrative for the site. Keep other pages to purposeful state, hover, and transition feedback unless the brief explicitly requires multiple narrative scenes.
- End by clearly waiting for approval. Do not ask a second preference question when the user delegated the direction with "surprise me."

## Research and MCP policy

MCP research is optional and task-driven. Never call every MCP merely to fill a research log. Prefer the built-in browser or chrome-devtools for QA; use ui-layouts, 21st-dev, or designmd only when a reference materially helps. If a server is unavailable, continue with local inspection and do not loop on failures.

Palette data: ${join(DATA_ROOT, "colors.csv")}
Typography data: ${join(DATA_ROOT, "typography.csv")}
Search these files by relevant terms and read only matching rows. A user-provided brand system takes precedence. Validate contrast instead of assuming a CSV row is accessible.

## Product and copy integrity

- Treat the user's product description as a closed fact set. Before writing page copy, list allowed capabilities in PRODUCT.md and omit unsupplied claims: prices, metrics, customers, certifications, testimonials, shipping terms, and product capabilities. Words such as offline, sync, automatic, voice, real-time, platform support, and audience size are claims. Label demo/example data visibly.
- Do not use unverified third-party logos as social proof, hotlink placeholder stock photos, or ship prominent links or buttons that point to "#" or have no behavior.
- Do not simulate signup or contact success without a real delivery mechanism. If no destination is supplied, use truthful in-page navigation or plain status copy.
- Do not plan a signup/contact form unless a real destination exists or obtaining one is an explicit unresolved requirement.
- Full copy/evidence rules: designer-master.md.

## Implementation quality

- Use semantic HTML, visible focus, usable keyboard behavior, responsive layouts, and reduced-motion support when animation exists.
- For a full marketing page, inspect the composition map before coding. If two sections both resolve to equal card grids, redesign one around the content relationship or workflow unless repeated comparison is the actual information structure.
- Do not add animation, dark mode, routes, dependencies, or sections that the task does not need. Do not install a motion library only to fade sections into view. Avoid fake product screenshots; use a real component preview or an explicit placeholder.
- Full build guidance: designer-master.md and design-md.md.

## Delivery checks

For substantive frontend work, run:
1. node ${QUALITY_SCRIPT} --check .
2. node ${LAYOUT_SCRIPT} .
3. the project's build command
4. browser QA at a narrow and wide viewport

Warnings are review input. Only true blockers should prevent delivery. Report commands actually run and unresolved limitations accurately.

[/DESIGNER MODE]`;

const PLAN_ONLY_PROMPT = DESIGNER_PROMPT
  .replace(
    `8. Read ${join(SKILLS_ROOT, "review-skill.md")} before delivery and perform the proportional review it describes.`,
    "8. Do not read or execute the delivery-review skill during this plan-only turn.",
  )
  .replace(
    /## Delivery checks[\s\S]*?\n\nWarnings are review input\. Only true blockers should prevent delivery\. Report commands actually run and unresolved limitations accurately\.\n/,
    "",
  );

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
    // Single source of truth for secret patterns: shared/security.mjs.
    return redactSecrets(value);
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

// Directories that never count as user work for change detection: dependencies,
// VCS internals, and build/generated output the delivery checks themselves emit.
const CHANGE_SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", ".next", ".nuxt", ".svelte-kit",
  "coverage", ".cache", ".turbo", ".output", ".vercel", "test-output",
]);

// Whether any source/artifact file under cwd was written since the session began.
// Bounded walk so a pure chat/planning turn (no file writes) skips heavy checks
// and their side effects instead of spawning a build on a no-op turn.
function projectChangedSince(cwd: string, since: number): boolean {
  let budget = 4000;
  const walk = (dir: string): boolean => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries) {
      if (budget-- <= 0) return false;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (CHANGE_SKIP_DIRS.has(entry.name)) continue;
        if (walk(full)) return true;
      } else if (entry.isFile()) {
        try {
          if (statSync(full).mtimeMs > since) return true;
        } catch {
          // Unreadable file: ignore.
        }
      }
    }
    return false;
  };
  return walk(cwd);
}

interface CheckResult {
  name: string;
  ok: boolean;
  skipped?: string;
  output: string;
}

interface PlanCheckResult {
  ok: boolean;
  violations: string[];
}

function messageText(value: unknown): string {
  const content = asRecord(value).content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      const record = asRecord(block);
      return record.type === "text" && typeof record.text === "string" ? record.text : "";
    })
    .filter(Boolean)
    .join("\n");
}

// The project is English-native: English intent must be robust. German is a
// fallback only, because the owner writes prompts in German.

// The user already has a plan and wants it built now — this outranks any gate
// signal so "review my existing plan and implement it" is NOT treated as plan-only.
function wantsImmediateImplementation(p: string): boolean {
  return /\b(?:implement|build|execute|apply|carry out|proceed with|go ahead with|ship)\b[\s\S]{0,25}\b(?:the|my|this|that|your|existing)\s+(?:plan|spec|design)\b/i.test(p) ||
    /\bjust (?:build|implement|code|do) it\b/i.test(p) ||
    /\b(?:implement|build|code) it now\b/i.test(p);
}

// Explicit approval gate: "wait for approval", "get sign-off first", "for my approval".
function mentionsApprovalGate(p: string): boolean {
  return /\bwait(?:ing)?\s+for\b[\s\S]{0,25}\b(?:ap{1,2}rov|sign[- ]?off|go[- ]?ahead|green[- ]?light|confirm)/i.test(p) ||
    /\b(?:await|pending|for|need|needs|require[sd]?|get|getting|my|your)\b[\s\S]{0,15}\bap{1,2}rov/i.test(p) ||
    /\bap{1,2}rov\w*\b[\s\S]{0,20}\b(?:first|before)\b/i.test(p) ||
    /\bsign[- ]?off\b/i.test(p) ||
    /\bgo[- ]?ahead\b/i.test(p) ||
    /\bgreen[- ]?light\b/i.test(p);
}

// A prospective approval word: the user intends to approve/confirm before work.
// "review" is deliberately excluded — "review my existing plan and implement it"
// is a build request, not an approval gate.
function mentionsApprovalWord(p: string): boolean {
  return /\bap{1,2}rov(?:e|es|ed|al|ing)?\b/i.test(p) ||
    /\bconfirm(?:ation|ed|s)?\b/i.test(p) ||
    /\bsign[- ]?off\b/i.test(p) ||
    /\bgo[- ]?ahead\b/i.test(p) ||
    /\bgreen[- ]?light\b/i.test(p);
}

// Plan is explicitly staged before any building: "make a plan first", "plan before you build".
function mentionsPlanFirst(p: string): boolean {
  return /\bplan\b[\s\S]{0,40}\b(?:first|before|for (?:your |my )?(?:ap{1,2}roval|review|sign))/i.test(p) ||
    /\b(?:first|before (?:you|we|i)\b[\s\S]{0,25}|before (?:implement|build|cod))\b[\s\S]{0,30}\bplan\b/i.test(p);
}

// Implementation is deferred: "do not implement yet", "before you build".
function defersImplementation(p: string): boolean {
  return /\bbefore (?:you |we |i )?(?:implement|build|start|begin|cod|writ|develop|scaffold)/i.test(p) ||
    /\b(?:do ?n['o]?t|don['o]?t|dont|please don['o]?t|no need to|hold off(?: on| from)?)\b[\s\S]{0,30}\b(?:implement|build|code|develop|create|scaffold|start)\b/i.test(p) ||
    /\b(?:implement|build|code|develop|scaffold)\w*\b[\s\S]{0,15}\byet\b/i.test(p);
}

// German fallback: "erst planen", "warte auf Freigabe", "noch nicht umsetzen".
function mentionsGermanPlanGate(p: string): boolean {
  return /\b(?:erst|zuerst)\b[\s\S]{0,25}\b(?:plan|entwurf|konzept)/i.test(p) ||
    /\bplan\w*\b[\s\S]{0,20}\berst\b/i.test(p) ||
    /\bfreigabe\b/i.test(p) ||
    /\b(?:warte|warten|abwarten)\b[\s\S]{0,25}\b(?:freigabe|genehmigung|zustimmung|best[äa]tigung|ok)\b/i.test(p) ||
    /\bnoch\s+nicht\b[\s\S]{0,25}\b(?:umsetz|implementier|baue|bauen|programmier|entwickel|erstell)/i.test(p);
}

function asksForApprovalPlan(prompt: string): boolean {
  const p = prompt ?? "";
  if (wantsImmediateImplementation(p)) return false;
  const hasPlanWord = /\bplan\b/i.test(p);
  return mentionsApprovalGate(p) ||
    (hasPlanWord && mentionsApprovalWord(p)) ||
    mentionsPlanFirst(p) ||
    defersImplementation(p) ||
    mentionsGermanPlanGate(p);
}

// The user explicitly asked for a long/detailed plan, so the length ceiling does not apply.
function wantsDetailedPlan(prompt: string): boolean {
  const p = prompt ?? "";
  return /\b(?:detailed|in[- ]?depth|comprehensive|thorough|exhaustive|granular|step[- ]by[- ]step|long[- ]form)\b[\s\S]{0,25}\b(?:spec|specification|plan|breakdown|document|write[- ]?up|proposal|blueprint|outline|rfc)\b/i.test(p) ||
    /\b(?:detailed specification|full spec)\b/i.test(p) ||
    /\b(?:detailliert|ausführlich|umfassend|gründlich)\w*\b[\s\S]{0,25}\b(?:plan|spezifikation|konzept|dokument)/i.test(p);
}

function asksForMultiplePages(prompt: string): boolean {
  return /\b(?:various|multiple|several|many|multi[- ]?page)\s+(?:pages?|routes?)\b/i.test(prompt) ||
    /\bpages?\b[\s\S]{0,80}\b(?:various|multiple|several|many)\b/i.test(prompt);
}

function planChecks(userPrompt: string, response: string): PlanCheckResult {
  const violations: string[] = [];
  if (!response.trim()) violations.push("The approval plan is missing.");
  const wordCount = response.trim().split(/\s+/).filter(Boolean).length;
  // Length is a soft ceiling: allowed without limit when the user explicitly
  // asked for a detailed specification, otherwise a continuation to tighten it.
  if (wordCount > 800 && !wantsDetailedPlan(userPrompt)) {
    violations.push(`The approval plan is long (${wordCount} words); aim for about 700 words and stay under 800, unless the user asked for a detailed specification.`);
  }

  if (asksForMultiplePages(userPrompt)) {
    const routes = new Set(
      [...response.matchAll(/`(\/(?:[a-z0-9][a-z0-9/_-]*)?)`/gi)].map((match) => match[1]),
    );
    if (/\bsingle[- ]page\b/i.test(response)) {
      violations.push("The user requested multiple pages, but the plan proposes a single page.");
    }
    if (routes.size < 2) {
      violations.push("The user requested multiple pages, but fewer than two concrete routes are named.");
    }
  }

  if (!/\b(?:form|signup|contact|newsletter|email capture)\b/i.test(userPrompt) &&
      /\b(?:add|include|build|feature|animated|minimal|signup|contact|connect|newsletter)\b[\s\S]{0,30}\bform\b/i.test(response)) {
    violations.push("The plan adds a form without a user-supplied destination or form requirement.");
  }

  if (!/\b(?:metric|statistic|percentage|benchmark|data point)\b/i.test(userPrompt) &&
      /\b(?:add|include|show|display|feature|animated|floating)\b[\s\S]{0,25}\b(?:metrics?|statistics?|stats?|stat counters?|data points?)\b/i.test(response)) {
    violations.push("The plan adds metrics or statistics without a supplied data source.");
  }

  if (/\b(?:scroll[- ]?jacking|lenis)\b/i.test(response)) {
    violations.push("The plan proposes scroll-jacking or Lenis instead of preserving native scroll.");
  }

  if (/\b(?:historical timeline|timeline (?:of|showing)|AI milestones|evolution timeline)\b/i.test(response) &&
      !/\b(?:source|verify|verification|fact[- ]?check)\b/i.test(response)) {
    violations.push("Historical or timeline content lacks an explicit source-verification step.");
  }

  if (/\b(?:links?|href|points?|leads?)\b[\s\S]{0,35}(?:to\s+)?[`"']?#[`"']?/i.test(response) ||
      /\bdemo (?:link|placeholder)\b/i.test(response)) {
    violations.push("The plan includes a dead or placeholder link instead of a real destination.");
  }

  if (/\b(?:live|real[- ]?time)\b[\s\S]{0,50}\b(?:AI|reasoning|model output)\b/i.test(response) &&
      !/\b(?:labelled|labeled|visible)\b[\s\S]{0,30}\bdemo\b/i.test(response)) {
    violations.push("A scripted AI interaction is described as live without a visible demo label.");
  }

  return { ok: violations.length === 0, violations };
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
  const planRepairAttempts = new Map<string, number>();
  const userFactsByCwd = new Map<string, string>();
  // When each session's work began, used to detect real file changes.
  const sessionStartByCwd = new Map<string, number>();
  // A monotonic per-session token, used to build a collision-resistant fallback
  // id when the host omits session_id — a plain timestamp collides when two
  // sessions in the same cwd start within the same millisecond.
  const sessionTokenByCwd = new Map<string, string>();
  let sessionCounter = 0;

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
    const isContinuation = userPrompt.includes("[DESIGNER DELIVERY CHECKS FAILED]") ||
      userPrompt.includes("[DESIGNER PLAN CHECKS FAILED]");
    if (userPrompt && !isContinuation) {
      userFactsByCwd.set(cwd, userPrompt);
    }
    // Mark the session start once per real turn. A continuation keeps the
    // original baseline and token so changes across the repair still register
    // and the attempt counter stays keyed to the same session.
    if (!isContinuation || !sessionStartByCwd.has(cwd)) {
      sessionStartByCwd.set(cwd, Date.now());
      sessionTokenByCwd.set(cwd, `${Date.now()}-${++sessionCounter}`);
    }
    const prompt = asksForApprovalPlan(userPrompt) ? PLAN_ONLY_PROMPT : DESIGNER_PROMPT;
    const prompts = stripDesignerPrompt(normalizeSystemPrompt(asRecord(event).systemPrompt));
    writeTrace(cwd, "prompt_injected", {
      version: 5,
      promptChars: prompt.length,
      mode: prompt === PLAN_ONLY_PROMPT ? "plan" : "build",
    });
    return { systemPrompt: [...prompts, prompt] };
  });

  pi.on("session_stop", (event, ctx) => {
    const cwd = ctx?.cwd ?? process.cwd();
    if (!isEnabled(cwd)) return;
    const eventRecord = asRecord(event);
    const sessionStart = sessionStartByCwd.get(cwd);
    // Prefer the host session id; otherwise fall back to cwd + this session's
    // monotonic token so separate sessions in the same cwd do not collide.
    const sessionId = typeof eventRecord.session_id === "string" && eventRecord.session_id
      ? String(eventRecord.session_id)
      : `${cwd}:${sessionTokenByCwd.get(cwd) ?? "nostart"}`;
    const userPrompt = userFactsByCwd.get(cwd) ?? "";

    if (asksForApprovalPlan(userPrompt)) {
      const response = messageText(eventRecord.last_assistant_message);
      const result = planChecks(userPrompt, response);
      writeTrace(cwd, result.ok ? "plan_checks_passed" : "plan_checks_failed", {
        sessionId,
        violations: result.violations,
      });
      if (result.ok) {
        planRepairAttempts.delete(sessionId);
        return;
      }

      const repairAttempt = (planRepairAttempts.get(sessionId) ?? 0) + 1;
      planRepairAttempts.set(sessionId, repairAttempt);
      if (repairAttempt >= 2) return;
      return {
        continue: true,
        additionalContext: truncate([
          "[DESIGNER PLAN CHECKS FAILED]",
          "Rewrite only the approval plan. Do not create or modify project files.",
          "Preserve the user's explicit architecture and scope. Keep correct parts concise.",
          ...result.violations.map((violation) => `- ${violation}`),
          "End by waiting for approval.",
          "[/DESIGNER PLAN CHECKS FAILED]",
        ].join("\n")),
      };
    }

    if (!looksLikeFrontendProject(cwd)) {
      writeTrace(cwd, "delivery_checks_skipped", { reason: "not a frontend project" });
      return;
    }

    // Pure chat/planning turns produce no file writes; running build + validators
    // then would be a side effect (dist output) and latency for no reason.
    if (sessionStart !== undefined && !projectChangedSince(cwd, sessionStart)) {
      writeTrace(cwd, "delivery_checks_skipped", { reason: "no project changes this session" });
      return;
    }

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
  PLAN_ONLY_PROMPT,
  PACKAGE_ROOT,
  asksForApprovalPlan,
  doctorReport,
  isEnabled,
  planChecks,
  projectChangedSince,
};
