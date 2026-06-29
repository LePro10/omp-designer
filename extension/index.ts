/**
 * Designer Mode v2 Extension for omp (oh-my-pi)
 *
 * Adds /designer toggle command.
 * When ON: 9 design skills loaded + system prompt injected.
 * MCPs: 21st-dev, ui-layouts, designmd, chrome-devtools.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const HOME = homedir();
const STATE_FILE = join(HOME, ".omp", "agent", "designer-state.json");
const SKILLS_ROOT = join(HOME, ".omp", "agent", "managed-skills");
const CSV_DATA_ROOT = join(SKILLS_ROOT, "ui-ux-pro-max-skill", "data");

const SKILL_PATHS = [
  join(SKILLS_ROOT, "designer-master", "SKILL.md"),
  join(SKILLS_ROOT, "taste-skill", "SKILL.md"),
  join(SKILLS_ROOT, "animate", "SKILL.md"),
  join(SKILLS_ROOT, "product-md", "SKILL.md"),
  join(SKILLS_ROOT, "design-md", "SKILL.md"),
  join(SKILLS_ROOT, "reference-study", "SKILL.md"),
  join(SKILLS_ROOT, "visual-critique", "SKILL.md"),
  join(SKILLS_ROOT, "copywriting", "SKILL.md"),
  join(SKILLS_ROOT, "scroll-choreography", "SKILL.md"),
];

// PROMPT_INJECT is SHORT. It tells the agent WHAT to do and WHEN to read skills.
// The skills contain the actual detailed rules. Don't duplicate them here.
const PROMPT_INJECT = `[DESIGNER MODE: ACTIVE]

You are an autonomous UI/UX designer. You produce production-ready websites.

## STEP 1: Read the workflow

READ designer-master/SKILL.md FIRST. It defines the complete Grill Me -> Plan -> Build workflow.
Follow it exactly. It tells you when to read each other skill.

## STEP 2: MCP Tools

You have 4 MCP servers. Use search_tool_bm25 to discover them:
search_tool_bm25("21st-dev ui-layouts chrome-devtools designmd")

What they provide:
- 21st-dev-magic: component inspiration, SVG logos. Use SHORT queries: "hero", "bento", "pricing"
- ui-layouts: 60+ real React/TSX components. Use: search_components("hero"), get_component_source_code("hero-section")
- chrome-devtools: headless browser screenshots. Use: navigate_page(url), take_screenshot()
- designmd: design system references. Use: search_design_systems("saas")

## STEP 3: Read skills as you need them

The designer-master skill tells you WHEN to read each skill. Here is the map:

| When | Read this skill | Why |
|------|----------------|-----|
| Before asking questions | product-md/SKILL.md | How to capture the brief |
| During planning | taste-skill/SKILL.md (Section 0-1) | Design read + dials |
| During planning | data/ui-ux-pro-max/colors.csv | Pick palette (grep, don't read full) |
| During planning | data/ui-ux-pro-max/typography.csv | Pick fonts (grep, don't read full) |
| Before building | design-md/SKILL.md | How to write DESIGN.md |
| Before building | copywriting/SKILL.md | Human copy rules |
| Before building | scroll-choreography/SKILL.md | Narrative motion patterns |
| During building | animate/SKILL.md | Animation patterns + easing |
| After building | visual-critique/SKILL.md | Screenshot evaluation + mobile QA |
| After building | taste-skill/SKILL.md (Section 9) | AI tells checklist |

## STEP 4: Build

After reading designer-master/SKILL.md, follow its 3-phase workflow:
1. GRILL ME: ask 3-5 multiple-choice questions using the ask tool
2. PLAN: use MCPs, create mood board, present plan, wait for "accept"
3. BUILD: write PRODUCT.md, DESIGN.md, build components, critique, ship

## COLOR PALETTE

Pick ONE row from the palette table in designer-master/SKILL.md. Use EXACTLY its hex values. Lock it. Do not change later.
For more palettes: grep -i "keyword" ${CSV_DATA_ROOT}/colors.csv

## HONESTY RULE

Do NOT claim results before building. Only report what you actually verified.

You are in DESIGNER MODE. Read designer-master/SKILL.md now.`;

// Per-session state: { "cwd1": true, "cwd2": false }
function readState(): Record<string, boolean> {
  try {
    if (existsSync(STATE_FILE)) {
      const raw = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
      // Handle legacy format { enabled, cwd }
      if (raw && typeof raw === "object" && "enabled" in raw) {
        return raw.cwd ? { [raw.cwd]: raw.enabled } : {};
      }
      return raw;
    }
  } catch {}
  return {};
}

function writeState(state: Record<string, boolean>): void {
  mkdirSync(join(HOME, ".omp", "agent"), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state));
}

function isOn(cwd?: string): boolean {
  if (!cwd) return false;
  const state = readState();
  return state[cwd] === true;
}

function toggle(cwd: string): boolean {
  const state = readState();
  const newState = !state[cwd];
  state[cwd] = newState;
  writeState(state);
  setDesignerMcpEnabled(newState);
  return newState;
}

// MCP server names managed by designer mode
const DESIGNER_MCP_NAMES = new Set([
  "21st-dev-magic",
  "ui-layouts",
  "designmd",
  "chrome-devtools",
]);

const MCP_CONFIG = join(HOME, ".omp", "agent", "mcp.json");

function setDesignerMcpEnabled(enabled: boolean): void {
  try {
    if (!existsSync(MCP_CONFIG)) return;
    const raw = readFileSync(MCP_CONFIG, "utf-8");
    const config = JSON.parse(raw);
    if (!config || typeof config !== "object" || !config.mcpServers) return;
    let changed = false;
    for (const [name, server] of Object.entries(config.mcpServers)) {
      if (DESIGNER_MCP_NAMES.has(name) && server && typeof server === "object") {
        if ((server as Record<string, unknown>).enabled !== enabled) {
          (server as Record<string, unknown>).enabled = enabled;
          changed = true;
        }
      }
    }
    if (changed) {
      writeFileSync(MCP_CONFIG, JSON.stringify(config, null, 2) + String.fromCharCode(10));
    }
  } catch { /* mcp.json missing or corrupt — no crash */ }
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
  on(event: "resources_discover", handler: (event?: unknown, ctx?: { cwd?: string }) => ResourceDiscoverResult | undefined): void;
  on(event: "before_agent_start", handler: (event: AgentStartEvent, ctx?: { cwd?: string }) => { systemPrompt: string[] } | undefined): void;
}

export default function (pi: ExtensionAPI): void {
  // Sync MCP enabled state on startup
  try {
    const state = readState();
    const cwd = process.cwd();
    if (state[cwd]) {
      setDesignerMcpEnabled(true);
    }
  } catch {}

  pi.registerCommand("designer", {
    description: "Toggle designer mode — autonomous UI/UX design workflow",
    aliases: ["design"],
    handler: (_args: unknown, ctx: CommandContext) => {
      const cwd = process.cwd();
      const nowOn = toggle(cwd);
      ctx?.ui?.notify?.(
        nowOn ? "DESIGNER MODE ON — skills loaded, MCPs enabled. Run /reload to activate MCPs." : "DESIGNER MODE OFF",
        "info"
      );
      ctx?.editor?.setText?.("");
    },
  });

  pi.on("resources_discover", (_event?: unknown, ctx?: { cwd?: string }) => {
    if (!isOn(ctx?.cwd)) return;
    return { skillPaths: SKILL_PATHS };
  });

  pi.on("before_agent_start", (event: AgentStartEvent, ctx?: { cwd?: string }) => {
    if (!isOn(ctx?.cwd)) return;
    const existing = event?.systemPrompt;
    const prompts = Array.isArray(existing)
      ? existing
      : existing
        ? [existing]
        : [];
    return { systemPrompt: [...prompts, PROMPT_INJECT] };
  });
}
