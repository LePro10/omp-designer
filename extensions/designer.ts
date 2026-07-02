/**
 * Designer Mode v2 Extension for Pi (pi.dev)
 *
 * Adds /designer toggle command.
 * When ON: injects design workflow system prompt + skill gate instructions.
 * Skills are auto-discovered by Pi from the skills/ directory.
 * MCPs: 21st-dev, chrome-devtools, ui-layouts, designmd.
 *
 * Uses shared/skill-gate.mjs as the single source of truth for the skill
 * manifest and gate prompt — same module as the OMP extension.
 *
 * CAPABILITY LIMITATION: Pi's Extension API only exposes before_agent_start
 * and registerCommand. There are no tool_call, tool_result, or session_stop
 * hooks. Therefore, Pi CANNOT enforce pre-execution blocking of tools.
 * Enforcement on Pi relies on prompt instructions only — this is NOT
 * technical enforcement. For true pre-execution blocking, use OMP.
 *
 * See HOST_CAPABILITIES in shared/skill-gate.mjs for the capability matrix.
 */

import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ── Shared core (same module as OMP) ───────────────────────────────────

import {
  SkillGate,
  REQUIRED_DESIGNER_SKILLS,
  PHASES,
  HOST_CAPABILITIES,
  computeManifestHash,
} from "../shared/skill-gate.mjs";

// ── Paths ──────────────────────────────────────────────────────────────

const HOME = homedir();
const AGENT_DIR = join(HOME, ".pi", "agent");
const STATE_FILE = join(AGENT_DIR, "designer-state.json");
const MCP_CONFIG = join(AGENT_DIR, "mcp.json");
const GATE_DIR = join(AGENT_DIR, "designer-gates");

// Resolved at module load time from the extension's location.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Package root is the parent of extensions/
const PACKAGE_ROOT = join(__dirname, "..");
const CSV_DATA_ROOT = join(PACKAGE_ROOT, "data", "ui-ux-pro-max");
const SKILLS_SOURCE_DIR = join(PACKAGE_ROOT, "skills");

interface PiCommandContext {
  ui: { notify: (msg: string, level: string) => void };
}

interface PiAgentStartEvent {
  systemPrompt?: string;
}

interface PiExtensionAPI {
  registerCommand(
    name: string,
    opts: { description: string; handler: (args: unknown, ctx: PiCommandContext) => void | Promise<void> }
  ): void;
  on(event: "before_agent_start", handler: (event: PiAgentStartEvent) => { systemPrompt: string } | undefined): void;
}

// ── Skill path resolution (Pi: skills/<name>.md in the package) ─────────

function resolveSkillPath(name: string): string | null {
  const path = join(SKILLS_SOURCE_DIR, `${name}.md`);
  return existsSync(path) ? path : null;
}

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

// ── Skill gate report persistence ──────────────────────────────────────

function gateReportPath(): string {
  return join(GATE_DIR, "pi-designer-gate.json");
}

function saveGateReport(gate: SkillGate): void {
  try {
    mkdirSync(GATE_DIR, { recursive: true });
    writeFileSync(gateReportPath(), JSON.stringify(gate.generateReport(), null, 2) + "\n");
  } catch { /* persistence must never crash */ }
}

// ── System prompt injection ────────────────────────────────────────────

function buildPrompt(): string {
  const requiredSkills = REQUIRED_DESIGNER_SKILLS.filter((s) => s.required);
  const skillList = requiredSkills
    .map((s) => `  ${s.order}. ${s.name} (${s.uri})`)
    .join("\n");

  return `

[DESIGNER MODE v2: ACTIVE]

${SkillGate.getGatePrompt()}

## STEP 1: Choose interaction mode

Pick exactly one mode before acting:

| Mode | Trigger | First action | Approval |
| --- | --- | --- | --- |
| Guided | user asks to be asked, says "ask what you need", or brief is ambiguous and not urgent | Ask 3-5 multiple-choice questions | Wait for "accept", "go", or "build it" after plan |
| Adaptive | normal brief with a few missing facts | Ask only decision-critical questions; skip nice-to-have questions | Wait for "accept", "go", or "build it" after plan |
| Autonomous | "surprise me", "impress me", "i trust you" | Ask exactly ONE emotion question: Awe / Trust / Excitement / Calm / Curiosity | After answer: present plan, then build without a second approval wait unless user requests one |
| Batch | "do not wait", "no approval", "build it now", "just make it", "batch", or pi/omp headless task | Ask no questions; document assumptions in PRODUCT.md | No approval wait; build after plan |

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

Build components following the plan. Use generate_image for hero visuals. If unavailable, build product-specific SVG. Never use stock photo CDNs.

## STEP 7: Post-build self-check (MANDATORY)

Run from project root:
1. node ~/.omp/agent/extensions/designer/fix-ai-slop.mjs --check .
2. node ~/.omp/agent/extensions/designer/analyze-layout.mjs .
3. npm run build
4. npx -y impeccable detect src/ if available
For em-dashes only, run node ~/.omp/agent/extensions/designer/fix-ai-slop.mjs --fix . and then rerun --check.

If ANY reports issues: fix and rerun. Take desktop, mobile 375px, tablet 1024px, and section viewport screenshots (hero, features, conversion, footer). Scroll top to bottom before screenshots.

## STEP 8: Anti-slop verification

- Substitution test: could product name be swapped while 80% stays the same?
- Rationale test: does every section answer "what user need does this serve?"
- Anti-overcorrection: is direction predictable from category alone?

## CRITICAL RULES

**Copy:** Banned words: revolutionize, cutting-edge, seamless, empower, unlock, leverage, synergy, next-gen, game-changing, best-in-class, world-class, robust, scalable, holistic, comprehensive, innovative, transformative, elevate, curated, effortless, frictionless, pioneering, groundbreaking, next-level, future-proof, bulletproof, blazing-fast, lightning-fast, world-leading, industry-leading, turnkey, battle-tested, mission-critical, enterprise-grade, supercharge. Read every string aloud.

**Motion:** Every scroll effect must explain the product. No horizontal scroll on mobile. One pinned scene max.

**Images:** Never use stock photo CDNs. Prefer generate_image. Fallback: product-specific SVG.

**Honesty:** No invented prices, metrics, counts, testimonials. If missing: "Price on request" or [NEEDS INPUT].

[/DESIGNER MODE]
`;
}

// ── Extension entry point ──────────────────────────────────────────────

export default function designerExtension(pi: PiExtensionAPI): void {
  // Sync MCP enabled state at startup
  syncMcpConfigOnStartup();

  // ── /designer toggle command ─────────────────────────────────────────
  pi.registerCommand("designer", {
    description:
      "Toggle designer mode — design workflow prompt + skill gate + 4 MCP servers",
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
        // Initialize skill gate for session
        const gate = new SkillGate({
          sessionId: `pi-${Date.now()}`,
          projectRoot: process.cwd(),
          resolveSkillPath,
        });
        saveGateReport(gate);

        ctx.ui.notify(
          "DESIGNER MODE ON — skill gate prompt active (NOT pre-execution enforced on Pi). Read all required skills before proceeding. Run /reload to activate MCPs.",
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
  pi.on("before_agent_start", (event) => {
    if (!isOn()) return;
    const currentPrompt = event.systemPrompt ?? "";
    if (currentPrompt.includes("[DESIGNER MODE")) return;

    // Initialize skill gate for this session (Pi doesn't have agent_start event)
    const gate = new SkillGate({
      sessionId: `pi-${Date.now()}`,
      projectRoot: process.cwd(),
      resolveSkillPath,
    });
    saveGateReport(gate);

    const piCapabilityNote = HOST_CAPABILITIES.pi.preExecutionBlocking
      ? ""
      : "\n\nNOTE: Pi does not support pre-execution tool blocking. Skill reading is enforced via prompt instructions only. For technical enforcement, use OMP.\n";
    return { systemPrompt: currentPrompt + buildPrompt() + piCapabilityNote };
  });
}
