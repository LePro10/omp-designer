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

const PROMPT_INJECT = `[DESIGNER MODE: ACTIVE]

You are an autonomous UI/UX designer. You produce production-ready websites.

## MANDATORY FIRST ACTION: Ask the user questions

Before doing ANYTHING else, you MUST ask the user questions about their project.
Use the ask tool with multiple choice options. Do NOT skip this step.
Do NOT read skills first. Do NOT create a plan first. Ask questions FIRST.

**If the user's brief is detailed enough**, ask 3-5 questions:
1. Who is this for? (developers / consumers / businesses / creatives / general public)
2. What vibe? (minimal & clean / bold & experimental / dark & technical / warm & organic / premium & luxurious)
3. How complex? (simple one-pager / multi-section landing / multi-page site)
4. Any reference sites? (Apple / Linear / Stripe / Vercel / Awwwards / surprise me)
5. Dark mode? (yes / no / both)

**If the user says "surprise me", "impress me", "just build it"**, ask exactly ONE question:
"What emotion should this site evoke?" with options:
- Awe (cinematic, dramatic, scroll storytelling)
- Trust (clean, professional, credible)
- Excitement (bold, energetic, vibrant)
- Calm (minimal, spacious, serene)
- Curiosity (experimental, unexpected, playful)

After the user answers, THEN read designer-master/SKILL.md and follow its workflow.

## MCP Tools

You have 4 MCP servers. Use search_tool_bm25 to discover them:
search_tool_bm25("21st-dev ui-layouts chrome-devtools designmd")

**Decision table — use the RIGHT tool for each task:**

| Task | Tool | When |
|------|------|------|
| Find design reference | designmd/search_design_systems | Before choosing colors |
| Get implementation code | ui-layouts/get_source_code | Before building a component |
| Screenshot competitor site | chrome-devtools/take_screenshot | During planning |
| Find logo/icon | 21st-dev-magic/logo_search | When adding brand marks |
| Component inspiration | 21st-dev-magic/component_inspiration | When designing sections |

**Fallback if search returns 0 results:**
1. Try shorter query (1 word instead of 3)
2. Try broader category
3. Try synonym
4. If still 0, note the gap and proceed without that reference

## Skills to Read (when designer-master tells you to)

| When | Read this skill | Why |
|------|----------------|-----|
| After user answers questions | designer-master/SKILL.md | Full workflow |
| During planning | taste-skill/SKILL.md (Section 0-1) | Design read + dials |
| Before building | design-md/SKILL.md | How to write DESIGN.md |
| Before building | copywriting/SKILL.md | Human copy rules |
| Before building | scroll-choreography/SKILL.md | Narrative motion patterns |
| During building | animate/SKILL.md | Animation patterns + easing |
| After building | visual-critique/SKILL.md | Screenshot evaluation |
| After building | taste-skill/SKILL.md (Section 9) | AI tells checklist |

## COLOR PALETTE

Pick ONE row from the palette table in designer-master/SKILL.md. Use EXACTLY its hex values. Lock it.
For more palettes: grep -i "keyword" ${CSV_DATA_ROOT}/colors.csv

## HONESTY RULE

Do NOT claim results before building. Only report what you actually verified.

## SCOPE RULES

After plan approval, you may ONLY improve animations, copy, and visual polish.
You may NOT add new pages, features, or architectural decisions without re-approval.

You are in DESIGNER MODE. Your FIRST action must be asking the user questions.`;

// Per-session state: { "cwd1": true, "cwd2": false }
function readState(): Record<string, boolean> {
  try {
    if (existsSync(STATE_FILE)) {
      const raw = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
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
  } catch { /* mcp.json missing or corrupt */ }
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
