# System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   omp (oh-my-pi)                     │
│  ~/.bun/bin/omp — v16.1.3                           │
│  Wrapper: omp() in .bashrc/.zshrc                   │
└────────────────────┬────────────────────────────────┘
                     │ -e / --extension
                     ▼
┌─────────────────────────────────────────────────────┐
│            Designer Extension (index.ts)              │
│                                                      │
│  registerCommand("designer")  ←  toggle ON/OFF      │
│  resources_discover           ←  inject skills      │
│  before_agent_start           ←  inject prompt      │
└──────────┬──────────┬──────────────────────┬─────────┘
           │          │                      │
           ▼          ▼                      ▼
┌──────────────┐ ┌──────────┐ ┌──────────────────────┐
│  5 Skills    │ │ 2 MCPs   │ │ PROMPT_INJECT (2 KB) │
│ (managed-    │ │ (mcp.json│ │                      │
│  skills/)    │ │  config) │ │ 7-Step Workflow      │
│              │ │          │ │ + Anti-Slop Rules    │
│ • designer-  │ │ • 21st-  │ │ + MCP Tool List      │
│   master     │ │   dev    │ │ + Consequences       │
│ • taste      │ │ • chrome │ └──────────────────────┘
│ • animate    │ │   dev-   │
│ • ui-ux-pro- │ │   tools  │
│   max        │ └──────────┘
│ • review-    │
│   skill      │
└──────────────┘
```

## Data Flow

### /designer ON:
1. User types `/designer`
2. Extension writes `{"enabled":true}` to `designer-state.json`
3. Extension notifies "DESIGNER MODE ON"
4. Next user message triggers `before_agent_start`:
   - Reads `event.systemPrompt` (existing prompts)
   - Appends PROMPT_INJECT string
   - Returns modified `{ systemPrompt: [...] }`
5. `resources_discover` fires:
   - Checks `isOn()` → true
   - Returns 5 SKILL.md paths
   - omp loads them into agent context

### Agent execution (7 steps):
1. READ all 5 skills
2. SEARCH 21st-dev MCP
3. CREATE design plan FROM skills
4. PRESENT plan for approval
5. IMPLEMENT
6. REVIEW (chrome-devtools headless)
7. PRESENT results

### /designer OFF:
1. State file → `{"enabled":false}`
2. Next turn: `isOn()` → false for both handlers
3. Skills disappear from context
4. Agent returns to normal mode

## State Machine

```
          /designer
  OFF ───────────────► ON
   ▲                   │
   │                   │ /designer
   └───────────────────┘
```

State is persisted in `~/.omp/agent/designer-state.json` — survives restarts.

## File Dependencies

```
index.ts
  ├── node:os        (homedir)
  ├── node:path      (join)
  └── node:fs        (readFileSync, writeFileSync, existsSync, mkdirSync)

mcp.json
  ├── chrome-devtools-mcp@latest (npx)
  └── @21st-dev/magic@latest     (npx)

Skills
  ├── designer-master/SKILL.md
  │     └── references → taste-skill, animate, ui-ux-pro-max, review-skill
  ├── taste-skill/SKILL.md
  │     └── references → tasteskill.dev (Leonxlnx/taste-skill)
  ├── animate/SKILL.md
  │     └── references/ → easing-and-timing.md, framer-motion.md
  ├── ui-ux-pro-max-skill/SKILL.md
  │     └── src/ui-ux-pro-max/data/ → design.csv, typography.csv, styles.csv, ...
  │     └── (NOTE: NOT src/data/ — actual path is src/ui-ux-pro-max/data/)
  └── review-skill/SKILL.md
        └── references → chrome-devtools MCP
```
