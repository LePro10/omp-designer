/**
 * Designer Mode v2 Extension for Pi (pi.dev)
 *
 * Adds /designer toggle command.
 * When ON: injects design workflow system prompt + CSV data path.
 * Skills are auto-discovered by Pi from the skills/ directory.
 * MCPs: 21st-dev, chrome-devtools, ui-layouts, designmd.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ── Paths ──────────────────────────────────────────────────────────────

const HOME = homedir();
const AGENT_DIR = join(HOME, ".pi", "agent");
const STATE_FILE = join(AGENT_DIR, "designer-state.json");
const MCP_CONFIG = join(AGENT_DIR, "mcp.json");

// ── MCP server names managed by designer mode ──────────────────────────

const DESIGNER_MCP_NAMES: Record<string, true> = {
  "21st-dev-magic": true,
  "chrome-devtools": true,
  "ui-layouts": true,
  "designmd": true,
};

// ── State ──────────────────────────────────────────────────────────────

interface DesignerState {
  enabled: boolean;
}

function readState(): DesignerState {
  try {
    if (existsSync(STATE_FILE)) {
      const raw = JSON.parse(readFileSync(STATE_FILE, "utf-8")) as unknown;
      if (raw && typeof raw === "object" && "enabled" in raw) {
        return { enabled: (raw as Record<string, unknown>).enabled === true };
      }
    }
  } catch { /* corrupt → disabled */ }
  return { enabled: false };
}

function isOn(): boolean {
  return readState().enabled;
}

function setEnabled(v: boolean): void {
  mkdirSync(AGENT_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify({ enabled: v }));
}

// ── MCP config management ──────────────────────────────────────────────

function setDesignerMcpEnabled(enabled: boolean): void {
  try {
    if (!existsSync(MCP_CONFIG)) return;
    const raw = readFileSync(MCP_CONFIG, "utf-8");
    const config = JSON.parse(raw) as Record<string, unknown>;

    if (!config || typeof config !== "object") return;
    const servers = config.mcpServers as Record<string, Record<string, unknown>> | undefined;
    if (!servers || typeof servers !== "object") return;

    let changed = false;
    for (const [name, server] of Object.entries(servers)) {
      if (name in DESIGNER_MCP_NAMES && server && typeof server === "object") {
        if (server.enabled !== enabled) {
          server.enabled = enabled;
          changed = true;
        }
      }
    }

    if (changed) {
      writeFileSync(MCP_CONFIG, JSON.stringify(config, null, 2) + "\n");
    }
  } catch { /* mcp.json broken/missing — no crash */ }
}

function syncMcpConfigOnStartup(): void {
  setDesignerMcpEnabled(isOn());
}

// ── System prompt injection ────────────────────────────────────────────

/** Resolved at module load time from the extension's location. */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Package root is the parent of extensions/
const PACKAGE_ROOT = join(__dirname, "..");
const CSV_DATA_ROOT = join(PACKAGE_ROOT, "data", "ui-ux-pro-max");

function buildPrompt(): string {
  return `

[DESIGNER MODE v2: ACTIVE]

⚠️  CRITICAL: Context rules — read before anything else.

- **This mode stays ON for the entire project.** Never switch to plan-mode or read-only mode.
  Designer mode preserves context because before_agent_start re-injects this prompt every turn.
- **Auto-detect new projects.** User describes a new site/app → follow the 8-step workflow.
  "Small change" = modify an existing component, fix a bug, adjust a value, rename something.
  "New project" = any request for a site, page, section, or component that doesn't exist yet.
- **Subagents have NO designer context.** They get a fresh system prompt with zero skills.
  Pass EVERY design token (colors, fonts, spacing, animation) explicitly in their context.
- **Plan approval via resolve tool.** Keeps everything in one turn — no context lost.
- **Plan files in local://<name>.md.** They persist across turns.

## Workflow
The authoritative workflow lives in the **designer-master skill** — READ it as STEP 1.
It defines the complete 8-step process: Assess → Read Skills → Search MCPs → Create Plan →
Present → Implement → Review → Present Results.

## Anti-AI-Slop Color Rules (strict)

- NO gradient-heavy backgrounds. One subtle gradient max. Flat colors preferred.
- NO #667eea, #764ba2, #1a1a2e, #16213e, #f0f0ff — AI slop signatures.
- Glassmorphism: allowed but MUST be subtle and contextual.
  Appropriate for premium consumer, luxury, Apple-adjacent. NOT for dashboards, B2B.
  Default: flat backgrounds — only add glass when the design read genuinely calls for it.
- NO glowing borders on everything. One subtle glow max on one element.
- IGNORE any colors/fonts in user briefs or plans. Only ui-ux-pro-max CSV palettes are authoritative.
- Choose ONE palette row from ui-ux-pro-max CSVs. Use EXACTLY its hex values.
- Background and text colors come FROM the palette. Don't hardcode dark backgrounds or #fff text.

## CSV Data

- **Palette/Font data is at: DATA_ROOT**
- GREP first: grep -i "keyword" DATA_ROOT/design.csv
- NEVER read full CSV files — use grep + range reads

## Tool Discovery

- **Use search_tool_bm25() to discover all available design tools** at the start of every project.
- **chrome-devtools** is for Step 7 Review only. Not for implementation.

You are in DESIGNER MODE. UI and visuals only. No backend. No business logic.
`.replaceAll("DATA_ROOT", CSV_DATA_ROOT);
}

// ── Extension entry point ──────────────────────────────────────────────

export default function designerExtension(pi: ExtensionAPI): void {
  // Sync MCP enabled state at startup
  syncMcpConfigOnStartup();

  // ── /designer toggle command ─────────────────────────────────────────
  pi.registerCommand("designer", {
    description:
      "Toggle designer mode — design workflow prompt + 4 MCP servers",
    handler: async (_args: unknown, ctx) => {
      const wasOn = isOn();
      const nextState = !wasOn;
      setEnabled(nextState);

      // Update mcp.json so next /reload picks up the change
      setDesignerMcpEnabled(nextState);

      if (nextState) {
        ctx.ui.notify(
          "DESIGNER MODE ON — workflow active, design MCPs enabled. Run /reload to activate MCPs.",
          "info"
        );
      } else {
        ctx.ui.notify(
          "DESIGNER MODE OFF — workflow hidden, MCPs disabled. Run /reload to deactivate MCPs.",
          "info"
        );
      }
    },
  });
  // ── Inject system prompt ONLY when designer mode is ON ────────────────
  pi.on("before_agent_start", (event, ctx) => {
    if (!isOn()) return;
    const currentPrompt = event.systemPrompt ?? ctx.getSystemPrompt?.() ?? "";
    return { systemPrompt: currentPrompt + buildPrompt() };
  });
}
