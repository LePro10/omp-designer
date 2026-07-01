# AGENTS.md — AI Onboarding for omp-designer

> **If you're an AI agent and someone shared this repo with you:** follow this file exactly.
> It contains the complete install → configure → verify workflow.
> Ask the user for missing information. Never guess API keys.

---

## What this is

`omp-designer` is a toggleable `/designer` extension for [Pi](https://pi.dev) and [oh-my-pi](https://github.com/can1357/oh-my-pi) that loads
12 design skills + 4 MCP integrations. It turns any coding agent into a UI/UX design
specialist with anti-AI-slop enforcement, EVIDENCE.md truth tracking, and deterministic validators.

## Step 0: Check prerequisites

Before installing, verify the user's agent has the tools the designer workflow needs.

### Pi users (pi.dev)

Pi ships with only `read`, `write`, `edit`, `bash` by default. The designer workflow uses these additional tools:

| Tool | Used for | Status |
|------|----------|--------|
| `search_tool_bm25` | MCP tool discovery | ✅ Built-in |
| `web_search` | Looking up design references, motion.dev examples | ❌ Needs extension |
| `generate_image` | Hero images, visual assets | ❌ Needs extension |
| `task` / subagents | Parallel component building | ❌ Needs extension |
| `resolve` | Plan approval in one turn | ❌ omp-only, fallback to manual approval |
| `local://` URIs | Plan file persistence | ❌ omp-only, fallback to `write` |

**If the user is on Pi, ASK:** "Pi only has 4 built-in tools. The designer workflow works best with web_search, task/subagents, and generate_image. Should I install community extensions for these?"

Recommended Pi extensions:
- Subagents: `pi install git:github.com/tintinweb/pi-subagents`
- Web search: `pi install npm:@anthropic/pi-web-search` (or check pi.dev/packages)
- Image generation: check pi.dev/packages for a `generate_image` extension

**If the user says no, that's fine.** The core designer workflow (palette selection, code generation, review) still works without them. The skills have built-in fallbacks for missing tools.

### omp users (oh-my-pi)

omp ships with 15+ tools including `web_search`, `generate_image`, `task`, `resolve`, `local://`. No extra setup needed beyond MCP configuration.

## Step 1: Install

Pi or omp must be installed first.

```bash
# For Pi (pi.dev):
pi install npm:omp-designer

# For oh-my-pi (omp):
omp install npm:omp-designer
```

If the user doesn't have Pi or omp installed:
- Pi: `curl -fsSL https://pi.dev/install.sh | sh`
- omp: follow https://github.com/can1357/oh-my-pi

Verify: ask the user to type `/designer` in their agent. They should see "DESIGNER MODE ON".

## Step 2: Configure MCP servers

This package uses 4 MCP servers. Two are free, two need API keys.

### ASK THE USER these questions (one at a time):

**Question 1:** "Do you have a 21st.dev API key? Get a free one at https://21st.dev/studio — it enables SVG logo search and component patterns."

If YES → add to `~/.pi/agent/mcp.json` or `~/.omp/agent/mcp.json`:
```json
"21st-dev-magic": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@21st-dev/magic@latest"],
  "env": { "API_KEY": "<their-key>" },
  "enabled": false
}
```

If NO → skip. 21st-dev is optional. The agent will use ui-layouts + hand-crafted components instead.

**Question 2:** "Do you have a designmd API key? Get one at https://designmd.ai/api-keys — it provides design system references."

If YES → add:
```json
"designmd": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "designmd-mcp@latest"],
  "env": { "DESIGNMD_API_KEY": "<their-key>" },
  "enabled": false
}
```

If NO → skip. designmd is entirely optional.

**No questions needed for these (auto-configure):**

```json
"chrome-devtools": {
  "type": "stdio",
  "command": "npx",
  "args": [
    "-y", "chrome-devtools-mcp@latest",
    "--isolated", "--headless",
    "--no-usage-statistics", "--no-performance-crux",
    "--chrome-arg=--no-sandbox",
    "--chrome-arg=--disable-gpu",
    "--chrome-arg=--disable-dev-shm-usage",
    "--chrome-arg=--disable-logging",
    "--chrome-arg=--log-level=3"
  ],
  "env": {
    "CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS": "1",
    "CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS": "1"
  },
  "enabled": false
},
"ui-layouts": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@ui-layouts/mcp@latest"],
  "enabled": false
}
```

> **IMPORTANT:** Find the Chrome binary path. On Linux check `~/.cache/puppeteer/chrome/` or run `which google-chrome`. On macOS it's `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Add `"--executable-path"` to chrome-devtools args if not auto-detected.

> **Chrome log spam:** The `--disable-logging --log-level=3` args suppress harmless Chrome internal errors (`fallback_task_provider.cc`, `extension_web_request_event_router.cc`).

## Step 3: Recommend model

Tell the user: "For best design results, use MiniMax M3. It has the best design taste and follows anti-slop rules most consistently."

Pi (`~/.pi/agent/config.yml`):
```yaml
modelRoles:
  default: minimax/MiniMax-M3:high
```

omp (`~/.omp/agent/config.yml`):
```yaml
modelRoles:
  default: minimax/MiniMax-M3:high
```

If the user prefers another model, that's fine — but warn them that small/fast models will produce more generic designs.

## Step 4: Verify installation

After setup, ask the user to:

1. Start Pi/omp
2. Type `/designer` → should see "DESIGNER MODE ON"
3. Type `/designer` again → should see "DESIGNER MODE OFF"
4. Type `/reload` (Pi) or restart (omp) to activate MCP servers
5. Optional: type `/designer-doctor` → should show source/install/skill/MCP/trace health

## What NOT to do

- NEVER guess API keys or tokens
- NEVER paste npm tokens, API keys, auth headers, or `.env` values into chat or CLI arguments
- NEVER publish without running `npm run check:release`
- NEVER hardcode the user's home directory paths — use `~` or ask
- NEVER skip the MCP configuration step
- NEVER modify the skill files in `skills/`
- NEVER read full CSV files from `data/ui-ux-pro-max/` — use grep + range reads

## Package structure (for reference)

```
omp-designer/
├── extensions/designer.ts    # Pi extension (pi.dev API)
├── extension/index.ts        # omp extension (prompt, MCP toggling, trace, doctor)
├── skills/                   # 12 auto-discovered design skills
│   ├── ai-slop.md            # Canonical anti-slop reference
│   ├── designer-master.md    # 8-step orchestration workflow
│   ├── product-md.md         # PRODUCT.md + EVIDENCE.md workflow
│   ├── design-md.md          # Design system spec
│   ├── taste-skill.md        # Anti-slop rules + pre-flight
│   ├── ui-ux-pro-max.md      # CSV design intelligence instructions
│   ├── copywriting.md        # Human copy rules
│   ├── animate.md            # Animation patterns and easing
│   ├── scroll-choreography.md # Narrative scroll patterns
│   ├── reference-study.md    # Reference study protocol
│   ├── visual-critique.md    # Screenshot and mobile QA
│   └── review-skill.md       # Post-build audit
├── data/ui-ux-pro-max/       # 1.7 MB CSV design database
│   ├── colors.csv            # 161 color palettes
│   ├── typography.csv        # 57 font pairings
│   └── ...                   # styles, UX guidelines, framework stacks
├── scripts/
│   ├── fix-ai-slop.mjs       # Read-only lint by default; --fix mutates
│   ├── analyze-layout.mjs    # Layout, palette, and motion validator
│   ├── check-release.mjs     # Version + secret hygiene release gate
│   ├── eval-suite.mjs        # Golden prompt corpus validator/scorer
│   └── audit-trace.mjs       # JSONL run trace auditor
├── eval/                      # Golden prompt corpus + fixtures
├── docs/                     # Architecture, MCP setup, problems
├── README.md                 # Human-readable install guide
└── package.json              # Dual manifest (pi + omp)
```

## Troubleshooting

**MCP servers not connecting?**
- Run `/reload` (Pi) or restart omp
- Check that `npx` is available: `which npx`
- Check API keys in mcp.json are correct

**Source or installed copy may be stale?**
- Run `/designer-doctor`
- Check installed extension hash, script presence, managed skill count, MCP status, and trace path

**Agent says done but may have skipped validation?**
- In omp designer mode, `session_stop` automatically runs `fix-ai-slop --check` and `analyze-layout` for generated projects
- Check `/designer-doctor` trace path for `auto_validation_started` and `auto_validation_passed`

**Chrome errors in log?**
- Add `--chrome-arg=--disable-logging --chrome-arg=--log-level=3` to chrome-devtools args
- These are harmless Chromium internal messages, not from the designer package

**Designer mode ON but still getting AI-slop?**
- Check the model: small/fast models ignore design rules. Switch to MiniMax M3 or Claude Opus.
- Check that skills are loaded: run `/reload` and look for skill names in startup output
- Verify the system prompt injection is working — look for "[DESIGNER MODE v2: ACTIVE]" in context

**Missing tools on Pi (resolve, local://, generate_image)?**
- `resolve`: agent will fall back to asking the user via chat. Slower but works.
- `local://`: agent will fall back to writing plan files with `write` tool. Same result.
- `generate_image`: agent will use logo_search (21st-dev) for SVGs, placeholder descriptions for photos.
- `task`/subagents: agent will build components sequentially instead of in parallel. Slower, same quality.
- `web_search`: agent will use known URLs and MCP tools instead of web search. No external lookups needed.

## Key URLs

- GitHub: https://github.com/LePro10/omp-designer
- npm: https://www.npmjs.com/package/omp-designer
- Pi docs: https://github.com/earendil-works/pi
- omp docs: https://github.com/can1357/oh-my-pi
- 21st.dev API keys: https://21st.dev/studio (free tier)
- designmd API keys: https://designmd.ai/api-keys (optional)
