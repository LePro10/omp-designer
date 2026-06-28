# AGENTS.md — AI Onboarding for omp-designer

> **If you're an AI agent and someone shared this repo with you:** follow this file exactly.
> It contains the complete install → configure → verify workflow.
> Ask the user for missing information. Never guess API keys.

---

## What this is

`omp-designer` is a toggleable `/designer` extension for Pi and oh-my-pi that loads
5 design skills + 4 MCP integrations. It turns any coding agent into a UI/UX design
specialist with anti-AI-slop enforcement.

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

Tell the user: "For best design results, set your default model to Kimi K2.6. Smaller models produce AI-slop regardless of rules."

Pi (`~/.pi/agent/config.yml`):
```yaml
modelRoles:
  default: opencode-go/kimi-k2.6:high
```

omp (`~/.omp/agent/config.yml`):
```yaml
modelRoles:
  default: opencode-go/kimi-k2.6:high
```

If the user prefers another model, that's fine — but warn them that small/fast models will produce more generic designs.

## Step 4: Verify installation

After setup, ask the user to:

1. Start Pi/omp
2. Type `/designer` → should see "DESIGNER MODE ON"
3. Type `/designer` again → should see "DESIGNER MODE OFF"
4. Type `/reload` (Pi) or restart (omp) to activate MCP servers

## What NOT to do

- NEVER guess API keys or tokens
- NEVER hardcode the user's home directory paths — use `~` or ask
- NEVER skip the MCP configuration step
- NEVER modify the skill files in `skills/`
- NEVER read full CSV files from `data/ui-ux-pro-max/` — use grep + range reads

## Package structure (for reference)

```
omp-designer/
├── extensions/designer.ts    # Pi extension (pi.dev API)
├── extension/index.ts        # omp extension (oh-my-pi API)
├── skills/                   # Auto-discovered design skills
│   ├── designer-master.md    # 8-step orchestration workflow
│   ├── taste-skill.md        # Anti-slop rules + 50-point pre-flight
│   ├── animate.md            # Animation patterns and easing
│   ├── ui-ux-pro-max.md      # Design intelligence instructions
│   └── review-skill.md       # Post-build audit
├── data/ui-ux-pro-max/       # 1.7 MB CSV design database
│   ├── design.csv            # 161 color palettes
│   ├── typography.csv        # 57 font pairings
│   ├── colors.csv            # 31 KB color data
│   ├── styles.csv            # 67 UI styles
│   ├── ux-guidelines.csv     # 99 UX rules
│   └── stacks/               # Per-framework configs
├── docs/                     # Architecture, MCP setup, problems
├── README.md                 # Human-readable install guide
└── package.json              # Dual manifest (pi + omp)
```

## Troubleshooting

**MCP servers not connecting?**
- Run `/reload` (Pi) or restart omp
- Check that `npx` is available: `which npx`
- Check API keys in mcp.json are correct

**Chrome errors in log?**
- Add `--chrome-arg=--disable-logging --chrome-arg=--log-level=3` to chrome-devtools args
- These are harmless Chromium internal messages, not from the designer package

**Designer mode ON but still getting AI-slop?**
- Check the model: small/fast models ignore design rules. Switch to Kimi K2.6 or Claude Opus
- Check that skills are loaded: run `/reload` and look for skill names in startup output
- Verify the system prompt injection is working — look for "[DESIGNER MODE v2: ACTIVE]" in context

## Key URLs

- GitHub: https://github.com/LePro10/omp-designer
- npm: https://www.npmjs.com/package/omp-designer
- Pi docs: https://github.com/earendil-works/pi
- omp docs: https://github.com/can1357/oh-my-pi
- 21st.dev API keys: https://21st.dev/studio (free tier)
- designmd API keys: https://designmd.ai/api-keys (optional)
