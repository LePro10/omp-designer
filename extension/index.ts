/**
 * Designer Mode v2 Extension for omp (oh-my-pi)
 *
 * Adds /designer toggle command.
 * When ON: design workflow prompt + managed design skills + MCP toggles.
 */

import { homedir } from "node:os";
import { join, relative } from "node:path";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const HOME = homedir();
const STATE_FILE = join(HOME, ".omp", "agent", "designer-state.json");
const SKILLS_ROOT = join(HOME, ".omp", "agent", "managed-skills");
const EXTENSION_ROOT = join(HOME, ".omp", "agent", "extensions", "designer");
const CSV_DATA_ROOT = join(SKILLS_ROOT, "ui-ux-pro-max-skill", "src", "ui-ux-pro-max", "data");
const QUALITY_SCRIPT = join(EXTENSION_ROOT, "fix-ai-slop.mjs");
const LAYOUT_SCRIPT = join(EXTENSION_ROOT, "analyze-layout.mjs");
const TRACE_DIR = join(HOME, ".omp", "agent", "designer-traces");

const DESIGNER_MARKER_PATTERN = /\[DESIGNER MODE(?: v\d+)?: ACTIVE\]/;
const GLOBAL_STATE_KEY = "*";

const SKILL_PATHS = [
  join(SKILLS_ROOT, "designer-master", "SKILL.md"),
  join(SKILLS_ROOT, "ai-slop", "SKILL.md"),
  join(SKILLS_ROOT, "taste-skill", "SKILL.md"),
  join(SKILLS_ROOT, "animate", "SKILL.md"),
  join(SKILLS_ROOT, "product-md", "SKILL.md"),
  join(SKILLS_ROOT, "design-md", "SKILL.md"),
  join(SKILLS_ROOT, "reference-study", "SKILL.md"),
  join(SKILLS_ROOT, "visual-critique", "SKILL.md"),
  join(SKILLS_ROOT, "copywriting", "SKILL.md"),
  join(SKILLS_ROOT, "scroll-choreography", "SKILL.md"),
  join(SKILLS_ROOT, "review-skill", "SKILL.md"),
  join(SKILLS_ROOT, "ui-ux-pro-max-skill", "SKILL.md"),
];

const PROMPT_INJECT = `[DESIGNER MODE: ACTIVE]

You are an autonomous UI/UX designer. You produce production-ready websites.

## STEP 1: Branch selection

If the user says "surprise me", "impress me", "just build it", "i trust you": ask exactly ONE question: "What emotion should this site evoke?" Options: Awe / Trust / Excitement / Calm / Curiosity.

Otherwise ask 3-5 multiple-choice questions for missing facts: audience, vibe, complexity, references, dark mode.

## STEP 2: Write PRODUCT.md + EVIDENCE.md (before any design work)

Write PRODUCT.md with: what it is, audience, brand voice, provided facts (prefix "Source: user"), missing facts as [NEEDS INPUT].

Write EVIDENCE.md tracking every factual claim:
| Claim | Source | Confidence | Allowed wording |
If the user didn't provide it: confidence 0, "MUST NOT USE".

## STEP 3: Plan (MANDATORY, do not skip)

Write a plan with these sections:

1. **Brand & Voice** - name, one-liner, voice, anti-patterns
2. **Visual System** - palette row + exact hex values, typography row + exact fonts, dials (DESIGN_VARIANCE 1-5, MOTION_INTENSITY 1-5, VISUAL_DENSITY 1-5)
3. **Stack** - framework, motion library, icons/images
4. **Pages/Routes** - only what the user asked for
5. **Sections** - for each: purpose, layout family, copy direction, animation
6. **MCP Research Log** - every MCP query + result (see below)
7. **Risks & Mitigations**

Present the plan. End with: "Type 'accept' to build, or tell me what to change."
WAIT for approval before building. Do not build until the user says "accept" or "go" or "build it".

Exception: if the user explicitly says "build it now" or "just make it", you may build after the plan without waiting.

## STEP 4: MCP research (during planning, not after)

Run search_tool_bm25("21st-dev ui-layouts chrome-devtools designmd").

Attempt ALL of these. If a tool is unavailable, try web_search or browser as fallback. Document every attempt:
- designmd: search for design system matching the vibe
- ui-layouts: find component source for one key section
- 21st-dev: component inspiration for hero
- chrome-devtools/browser: screenshot 2-3 reference sites

If ALL MCPs are unavailable, use web_search to find 2-3 reference sites and screenshot them with browser. Document what you learned.
Silent skipping is not acceptable. Every attempt must appear in the plan.

## STEP 5: Design tokens

Palette: ${CSV_DATA_ROOT}/colors.csv - pick by row number and product type. Copy exact hex values.
Typography: ${CSV_DATA_ROOT}/typography.csv - pick by row number. Copy exact font names.
Avoid: Inter, Roboto, Geist, Plus Jakarta Sans, Space Grotesk (overused).
Write DESIGN.md with all tokens before building any component.

## STEP 6: Build

Build all components following the plan. For each section:
- Confirm it appears in the approved plan
- Use only DESIGN.md colors and fonts
- Use generate_image for hero visuals. If unavailable, build product-specific SVG or component preview. Never use Unsplash/Pexels/Pixabay/Picsum.

## STEP 7: Post-build self-check (MANDATORY, do not skip)

Before declaring done, run ALL of these from the project root:

1. node ${QUALITY_SCRIPT} --check .  -- read-only: catches em-dashes, buzzwords, fake numbers, stock photos, unsupported EVIDENCE.md claims
2. node ${LAYOUT_SCRIPT} .  -- read-only: catches off-palette colors, motion timing issues, layout problems
3. npm run build  -- catches type errors and build failures
4. npx -y impeccable detect src/  -- catches gradient-text, ai-color-palette, em-dashes (if available)

If ANY command reports issues: fix and rerun. Do not declare done with blocking issues.
For em-dashes only, run node ${QUALITY_SCRIPT} --fix . and then rerun --check.

Then take screenshots:
- Desktop full page
- Mobile 375px full page
- Section viewport screenshots: hero, first content section, features, conversion, footer

Before screenshots: scroll top to bottom and back to trigger reveal animations.

## STEP 8: Anti-slop verification

Apply these tests to the final output:
- **Substitution test**: Could the product name and accent color be swapped while 80% stays plausible for another product? If yes, rewrite generic parts.
- **Rationale test**: Does every section answer "what user need does this serve?" If only answer is "landing pages usually do this", rewrite.
- **Anti-overcorrection**: Is the direction predictable from the category alone? (e.g., coffee -> warm brown, luxury -> gold) If yes, justify why this specific project needs this direction.

## CRITICAL RULES (these apply even if you skip the skills)

**Copy:**
Banned words: revolutionize, cutting-edge, seamless, empower, unlock, leverage, synergy, next-gen, game-changing, best-in-class, world-class, robust, scalable, holistic, comprehensive, innovative, transformative, elevate, curated.
Banned patterns: "Not just X, but Y", "Whether you're X or Y", "All-in-one", "Built for everyone".
Read every visible string aloud. If it sounds like marketing email, rewrite. Short sentences. Active voice.

**Motion:**
Every scroll effect must explain the product. No decoration-only scroll. No horizontal scroll on mobile. One pinned scene max unless brief asks for narrative.

**Images:**
Never use stock photo CDNs. Prefer generate_image. Fallback: product-specific SVG or component preview.

**Honesty:**
No invented prices, metrics, counts, testimonials. If missing: "Price on request" or [NEEDS INPUT].

**Scope after approval:**
Allowed: animation timing, copy polish, spacing, responsive fixes.
Requires re-approval: new pages, new features, new sections, SDK examples.

[/DESIGNER MODE]`;

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

function writeTrace(cwd: string | undefined, event: string, details: Record<string, unknown> = {}): void {
  try {
    if (!isOn(cwd) && event !== "designer_disabled") return;
    mkdirSync(TRACE_DIR, { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      cwd: cwd ?? process.cwd(),
      ...details,
    };
    appendFileSync(tracePathForCwd(cwd), JSON.stringify(entry) + "\n");
  } catch { /* tracing must never break the agent loop */ }
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
  if (safe) summary.path = safe;
  const kind = commandKind(input.command);
  if (kind) summary.commandKind = kind;
  if (typeof record.isError === "boolean") summary.isError = record.isError;
  if (typeof result.isError === "boolean") summary.isError = result.isError;
  return summary;
}

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
  const skillsFound = SKILL_PATHS.filter((path) => existsSync(path)).length;
  const tracePath = tracePathForCwd(cwd);
  const lines = [
    "Designer doctor",
    "",
    `Source/package version: ${packageVersion(cwd)}`,
    `Designer mode for cwd: ${isOn(cwd) ? "enabled" : "disabled"}`,
    `Installed extension hash: ${fileHash(join(EXTENSION_ROOT, "index.ts"))}`,
    `Installed fix-ai-slop: ${existsSync(QUALITY_SCRIPT) ? "present" : "missing"} (${fileHash(QUALITY_SCRIPT)})`,
    `Installed analyze-layout: ${existsSync(LAYOUT_SCRIPT) ? "present" : "missing"} (${fileHash(LAYOUT_SCRIPT)})`,
    `Managed skills found: ${skillsFound}/${SKILL_PATHS.length}`,
    `MCP config: ${mcpStatus()}`,
    `Trace file: ${tracePath}`,
    "",
    "Release gate: run npm run check:release && npm run test:validators from the source repo.",
  ];
  return lines.join("\n");
}

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

export default function (pi: ExtensionAPI): void {
  try {
    if (isOn(process.cwd())) setDesignerMcpEnabled(true);
  } catch {}

  pi.registerCommand("designer", {
    description: "Toggle designer mode -- autonomous UI/UX design workflow",
    aliases: ["design"],
    handler: (_args: unknown, ctx: CommandContext) => {
      const cwd = process.cwd();
      const nowOn = toggle(cwd);
      writeTrace(cwd, nowOn ? "designer_enabled" : "designer_disabled");
      ctx?.ui?.notify?.(
        nowOn ? "DESIGNER MODE ON -- skills loaded, MCPs enabled. Run /reload to activate MCPs." : "DESIGNER MODE OFF",
        "info"
      );
      ctx?.editor?.setText?.("");
    },
  });

  pi.registerCommand("designer-doctor", {
    description: "Show designer source/install/trace health",
    aliases: ["design-doctor"],
    handler: (_args: unknown, ctx: CommandContext) => {
      const cwd = process.cwd();
      const report = buildDoctorReport(cwd);
      ctx?.editor?.setText?.(report);
      ctx?.ui?.notify?.("Designer doctor report written to the editor.", "info");
      writeTrace(cwd, "doctor_run");
    },
  });

  pi.on("resources_discover", (_event?: unknown, ctx?: { cwd?: string }) => {
    if (!isOn(ctx?.cwd)) return;
    const skillPaths = SKILL_PATHS.filter((path) => existsSync(path));
    writeTrace(ctx?.cwd, "skills_discovered", { count: skillPaths.length, expected: SKILL_PATHS.length });
    return { skillPaths };
  });

  pi.on("before_agent_start", (event?: unknown, ctx?: { cwd?: string }) => {
    if (!isOn(ctx?.cwd)) return;
    const agentEvent = asRecord(event);
    const prompts = withoutDesignerPrompts(normalizePromptList(agentEvent.systemPrompt as string | string[] | undefined));
    writeTrace(ctx?.cwd, "prompt_injected", { skillsExpected: SKILL_PATHS.length });
    return { systemPrompt: [...prompts, PROMPT_INJECT] };
  });

  pi.on("agent_start", (_event?: unknown, ctx?: { cwd?: string }) => {
    writeTrace(ctx?.cwd, "agent_start");
  });

  pi.on("agent_end", (_event?: unknown, ctx?: { cwd?: string }) => {
    writeTrace(ctx?.cwd, "agent_end");
  });

  pi.on("tool_call", (event?: unknown, ctx?: { cwd?: string }) => {
    writeTrace(ctx?.cwd, "tool_call", summarizeToolEvent(event, ctx?.cwd));
  });

  pi.on("tool_result", (event?: unknown, ctx?: { cwd?: string }) => {
    writeTrace(ctx?.cwd, "tool_result", summarizeToolEvent(event, ctx?.cwd));
  });
}
