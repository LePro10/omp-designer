# /designer System — AI Agent Context

> This file is the entry point. Read this first before touching any code.
> Project root: `/home/leandro/projects/projects/designer`

---

## TL;DR

`/designer` v2 is a toggleable command for **oh-my-pi** (`omp`) that turns the AI
into a UI/UX design specialist. When ON, 3 skills are loaded into context,
four MCP servers are available, and a structured 8-step workflow is enforced.
When OFF, everything is hidden — agent returns to normal coding mode.

## CRITICAL CONTEXT RULES

- **No /plan.** No plan-mode. No read-only mode switching. Designer mode stays
  ON for the entire project (plan + implement + review).
- **Context persists** because `before_agent_start` fires on every user message,
  re-injecting PROMPT_INJECT + all 5 skills. Mode switching would destroy this.
- **Subagents have NO designer context.** Pass every design token explicitly.
- **Plan approval via `resolve`** keeps everything in one turn.
- **`local://` plan files** persist across turns.

---

## Your Job

The system works but needs refinement. High-priority problems:

1. **Model quality** — `deepseek-v4-flash` produces AI slop regardless of rules.
   Change `~/.omp/agent/config.yml` default model to `kimi-k2.6`.
2. **Plan from skills** — When a plan is pre-injected, the agent validates it
   instead of building a fresh plan from skills. The prompt says "IGNORE plans"
   but doesn't enforce it.
3. **CSVs not read** — `ui-ux-pro-max-skill` has 161 palettes in CSV files.
   The agent almost never reads them despite explicit instructions.
   (CSV data at `src/ui-ux-pro-max/data/` — NOT `src/data/`)
4. **Taste skill too large** — 87 KB is a massive context hit. Consider trimming.
5. **Animation/Skill-compliance audit** — The `designer-master` skill mentions it
   but `review-skill` was simplified to functional checks only. Reconcile.
6. **Tool name mismatch** — `21st_magic_logo_search` doesn't exist. Real tool is
   `logo_search`. Also `21st_magic_component_refiner` exists but undocumented.
7. **MCP tool discovery** — 21st-dev tools need `search_tool_bm25` to activate.
   Not automatically available.

---

## Quickstart

```bash
source ~/.bashrc
omp                           # start omp
/designer                     # toggle ON — skills + MCPs loaded
/designer                     # toggle OFF — everything hidden
```

### After changes to the extension:
```bash
omp --extension ~/.omp/agent/extensions/designer/index.ts --print "hello"
tail -5 ~/.omp/logs/omp.$(date +%Y-%m-%d).log | grep -E "(error|Failed)" || echo "OK"
```

---

## Project Structure

```
/home/leandro/projects/projects/designer/
├── AGENTS.md                    ← YOU ARE HERE
├── architecture.md              → System architecture overview
├── docs/
│   ├── extension-api.md         → omp extension API rules
│   ├── problems.md              → Known bugs & todos
│   └── mcp-setup.md             → MCP server documentation
├── skills/
│   ├── designer-master.md       → Orchestrator workflow
│   ├── taste-skill.md           → Anti-Slop Taste Skill (tasteskill.dev)
│   ├── animate.md               → Emil Kowalski animation patterns
│   ├── ui-ux-pro-max.md         → Design intelligence database
│   └── review-skill.md          → Post-review pipeline
└── extension/
    └── index.ts                 → Copy of the /designer extension code
```

### Important system paths (not in this project):
```
~/.omp/agent/extensions/designer/index.ts     → LIVE extension (edit this)
~/.omp/agent/extensions/designer/package.json
~/.omp/agent/managed-skills/*/SKILL.md        → LIVE skills (edit these)
~/.omp/agent/mcp.json                         → MCP config
~/.omp/agent/config.yml                       → Model roles & settings
~/.omp/agent/designer-state.json              → ON/OFF state
~/.cache/puppeteer/chrome/linux-149.0.7827.22/chrome-linux64/chrome → Chrome binary
```

Make changes to files in `~/.omp/agent/` — the project here contains docs only.

---

## Key Architecture Rules

- **Factory function required:** `export default function (pi: any) { ... }`
- **Never `export default { ... }`** — omp crashes with "not a valid factory function"
- **Never `return {}`** from handlers — use `return;` instead
- **`before_agent_start`:** use `systemPrompt` (not `message`) — `message` crashes (`h.content undefined`)
- **`resources_discover`:** returns `{ skillPaths: string[] }` or `undefined`
- **State persistence:** file-based (`designer-state.json`) not `appendEntry`

---

## Extension Code (`~/.omp/agent/extensions/designer/index.ts`)

Three hooks:
1. **`registerCommand("designer", ...)`** — toggles ON/OFF via file state
2. **`resources_discover`** — returns 5 skill paths when ON
3. **`before_agent_start`** — appends `PROMPT_INJECT` (2 KB) to system prompt when ON

The `PROMPT_INJECT` string defines the 7-step workflow the agent must follow.
It also lists anti-AI-slop color rules and available MCP tools.

---

## Shell Integration

```bash
# ~/.bashrc and ~/.zshrc:
omp() {
  command omp --extension "$HOME/.omp/agent/extensions/designer/index.ts" "$@"
}
```
