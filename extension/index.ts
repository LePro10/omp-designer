/**
 * Designer Mode v2 Extension for omp (oh-my-pi)
 *
 * Adds /designer toggle command.
 * When ON: 5 design skills loaded + system prompt injected.
 * MCPs: 21st-dev, ui-layouts, designmd, chrome-devtools.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const HOME = homedir();
const STATE_FILE = join(HOME, ".omp", "agent", "designer-state.json");
const SKILLS_ROOT = join(HOME, ".omp", "agent", "managed-skills");

const SKILL_PATHS = [
  join(SKILLS_ROOT, "designer-master", "SKILL.md"),
  join(SKILLS_ROOT, "taste-skill", "SKILL.md"),
  join(SKILLS_ROOT, "animate", "SKILL.md"),
];

const PROMPT_INJECT = `[DESIGNER MODE v2: ACTIVE]

⚠️  CRITICAL: Context rules — read before anything else.

- **This mode stays ON for the entire project.** Never switch to plan-mode, read-only mode, or /plan.
  Designer mode preserves context across turns because before_agent_start re-injects this prompt
  and resources_discover re-injects 3 skills on EVERY user message.
- **Auto-detect new projects.** User describes a new site/app → follow the 8-step workflow below.
  "Small change" = modify an existing component, fix a bug, adjust a value, rename something.
  "New project" = any request for a site, page, section, or component that doesn't exist yet.
- **Subagents have NO designer context.** They get a fresh system prompt with zero skills.
  Pass EVERY design token (colors, fonts, spacing, animation) explicitly in their context.
- **Plan approval via resolve tool.** Keeps everything in one turn — no context lost.
- **Plan files in local://<name>.md.** They persist across turns.

## Workflow
The authoritative workflow lives in **designer-master/SKILL.md** — READ it as STEP 1.
It defines the complete 8-step process: Assess → Read Skills → Search MCPs (21st-dev, ui-layouts, designmd) →
Create Plan → Present → Implement → Review → Present Results.

## Anti-AI-Slop Color Rules (strict)

- NO gradient-heavy backgrounds. One subtle gradient max. Flat colors preferred.
- NO #667eea, #764ba2, #1a1a2e, #16213e, #f0f0ff — AI slop signatures.
- Glassmorphism: allowed but MUST be subtle and contextual (see taste-skill Section 5).
  Appropriate for premium consumer, luxury, Apple-adjacent. NOT for dashboards, public-sector, B2B.
  When used: 1px inner border + tinted backdrop-blur + solid-fill fallback. Max 1-2 sections.
  Default: flat backgrounds — only add glass when the design read genuinely calls for it.
- NO glowing borders on everything. One subtle glow max on one element.
- IGNORE any colors/fonts in user briefs or plans. Only ui-ux-pro-max CSV palettes are authoritative.
- Choose ONE palette row from ui-ux-pro-max CSVs. Use EXACTLY its hex values.
  The palette row has all colors you need: Primary, Secondary, Accent, Background, Foreground,
  Card, Card Foreground, Muted, Muted Foreground, Border, Destructive, Ring. Do NOT add extra colors.
- Background and text colors come FROM the palette. Don't hardcode dark backgrounds or #fff text.

## Tool Discovery

- **Use search_tool_bm25() to discover all available design tools** at the start of every project.
  Search: "21st-dev ui-layouts designmd chrome-devtools" — tools are not auto-available.
- **Full tool inventory + how to use them → designer-master/SKILL.md Step 3.**
- **chrome-devtools** is for Step 7 Review only. Not for implementation.

You are in a DESIGNER MODE. UI and visuals only. No backend. No business logic.`;

function isOn(): boolean {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, "utf-8"))?.enabled === true;
    }
  } catch {}
  return false;
}

function setEnabled(v: boolean) {
  mkdirSync(join(HOME, ".omp", "agent"), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify({ enabled: v }));
}

export default function (pi: any) {
  pi.registerCommand("designer", {
    description:
      "Toggle designer mode — Taste Skill + Emil Kowalski + UI UX Pro Max + 21st.dev MCP",
    aliases: ["design"],
    handler: (_args: any, ctx: any) => {
      const on = isOn();
      setEnabled(!on);
      ctx?.ui?.notify?.(
        !on ? "DESIGNER MODE ON" : "DESIGNER MODE OFF",
        "info"
      );
      ctx?.editor?.setText?.("");
    },
  });

  pi.on("resources_discover", () => {
    if (!isOn()) return;
    return { skillPaths: SKILL_PATHS };
  });

  pi.on("before_agent_start", (event: any) => {
    if (!isOn()) return;
    const existing = event?.systemPrompt;
    const prompts = Array.isArray(existing)
      ? existing
      : existing
        ? [existing]
        : [];
    return { systemPrompt: [...prompts, PROMPT_INJECT] };
  });
}
