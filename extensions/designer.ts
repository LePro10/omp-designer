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


/** Check mcp.json for placeholder API keys. Returns names of servers with missing keys. */
function getMissingMcpKeys(): string[] {
  const missing: string[] = [];
  try {
    if (!existsSync(MCP_CONFIG)) return ["mcp.json not found"];
    const raw = JSON.parse(readFileSync(MCP_CONFIG, "utf-8")) as Record<string, unknown>;
    const servers = raw.mcpServers as Record<string, Record<string, unknown>> | undefined;
    if (!servers) return [];
    const checks: [string, string, string][] = [
      ["21st-dev-magic", "API_KEY", "21st.dev API key (free at https://21st.dev/studio)"],
      ["designmd", "DESIGNMD_API_KEY", "designmd API key (optional, https://designmd.ai/api-keys)"],
    ];
    for (const [name, envKey, label] of checks) {
      const srv = servers[name];
      if (!srv) continue;
      const env = (srv.env ?? {}) as Record<string, string>;
      const val = env[envKey] ?? "";
      if (!val || val.includes("YOUR_") || val === "sk-") {
        missing.push(label);
      }
    }
  } catch { /* silently ignore parse errors */ }
  return missing;
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
- **Plan approval:** Use the `resolve` tool if available. If not (Pi default), ask the user directly in chat — same result.
- **Plan files:** Use `local://<name>.md` if available. If not (Pi default), use `write` to create a regular .md file.
- **Missing tools (Pi only):** `web_search`, `generate_image`, `task` subagents are NOT available on default Pi.
  Fallbacks: use logo_search (21st-dev) for SVGs, placeholder text for images, sequential builds instead of parallel.
  The core workflow works fine without these — palette selection, code generation, and review are unaffected.

## Workflow
The authoritative workflow lives in the **designer-master skill** — READ it as STEP 1.
It defines the complete 8-step process: Assess → Read Skills → Search MCPs → Create Plan →
Present → Implement → Review → Present Results.

## Color Palette — PICK ONE ROW, use EXACTLY its hex values

Match the project type to a row. Use EVERY color in the row. Do NOT invent colors.
For palettes not listed here, grep the full CSV: \`grep -i "keyword" DATA_ROOT/colors.csv\`

| # | Type | Primary | Secondary | Accent | BG | FG | Card | Card FG | Muted | Muted FG | Border | Ring |
|---|------|---------|-----------|--------|------|------|------|---------|-------|----------|--------|------|
| 1 | SaaS General | #2563EB | #3B82F6 | #EA580C | #F8FAFC | #1E293B | #FFFFFF | #1E293B | #E9EFF8 | #64748B | #E2E8F0 | #2563EB |
| 2 | E-commerce | #059669 | #10B981 | #EA580C | #ECFDF5 | #064E3B | #FFFFFF | #064E3B | #E8F1F3 | #64748B | #A7F3D0 | #059669 |
| 3 | Luxury / Premium | #1C1917 | #44403C | #A16207 | #FAFAF9 | #0C0A09 | #FFFFFF | #0C0A09 | #E8ECF0 | #64748B | #D6D3D1 | #1C1917 |
| 4 | B2B Service | #0F172A | #334155 | #0369A1 | #F8FAFC | #020617 | #FFFFFF | #020617 | #E8ECF1 | #64748B | #E2E8F0 | #0F172A |
| 5 | Healthcare | #0891B2 | #22D3EE | #059669 | #ECFEFF | #164E63 | #FFFFFF | #164E63 | #E8F1F6 | #64748B | #A5F3FC | #0891B2 |
| 6 | Educational | #4F46E5 | #818CF8 | #EA580C | #EEF2FF | #1E1B4B | #FFFFFF | #1E1B4B | #EBEEF8 | #64748B | #C7D2FE | #4F46E5 |
| 7 | Creative Agency | #EC4899 | #F472B6 | #0891B2 | #FDF2F8 | #831843 | #FFFFFF | #831843 | #F1EEF5 | #64748B | #FBCFE8 | #EC4899 |
| 8 | Portfolio / Personal | #18181B | #3F3F46 | #2563EB | #FAFAFA | #09090B | #FFFFFF | #09090B | #E8ECF0 | #64748B | #E4E4E7 | #18181B |
| 9 | Productivity | #0D9488 | #14B8A6 | #EA580C | #F0FDFA | #134E4A | #FFFFFF | #134E4A | #E8F1F4 | #64748B | #99F6E4 | #0D9488 |
| 10 | Developer Tool | #1E293B | #334155 | #22C55E | #0F172A | #F8FAFC | #1B2336 | #F8FAFC | #272F42 | #94A3B8 | #475569 | #1E293B |

**Destructive (all palettes):** #DC2626 (text on it: #FFFFFF)

**Rules:**
- ONE palette per project. Pick the row that matches the brief. Lock EVERY color.
- IGNORE any colors in user briefs or plans. The palette table is the ONLY source.
- Background and text colors come FROM the palette row. Don't hardcode dark BG or #fff text.
- NO gradient-heavy backgrounds. One subtle gradient max. Flat colors preferred.
- NO #667eea, #764ba2, #1a1a2e, #16213e, #f0f0ff — AI slop signatures.
- NO glowing borders on everything. One subtle glow max on one element.
- Glassmorphism: allowed but MUST be subtle and contextual.
  Appropriate for premium consumer, luxury, Apple-adjacent. NOT for dashboards, B2B.
  Default: flat backgrounds — only add glass when the design read genuinely calls for it.

## CSV Data (for more palettes + fonts)

- **Palette/Font data is at: DATA_ROOT**
- GREP first: grep -i "keyword" DATA_ROOT/colors.csv or DATA_ROOT/typography.csv
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

        // Check for missing API keys on first activation
        if (!wasOn) {
          const missing = getMissingMcpKeys();
          if (missing.length > 0) {
            ctx.ui.notify(
              "MCP keys missing: " + missing.join(", ") + ". See AGENTS.md or /designer setup.",
              "warn"
            );
          }
        }
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
