# omp-designer — AI-Powered UI/UX Design Mode

Toggleable `/designer` command for [Pi](https://pi.dev) and [oh-my-pi](https://github.com/can1357/oh-my-pi) that turns your coding agent into a UI/UX design specialist. When ON: **5 specialized skills**, **4 MCP integrations**, **161 color palettes**, **57 font pairings**, **50-point pre-flight checklist** — all enforced, not suggested.

```bash
# Pi:
pi install npm:omp-designer

# omp:
omp install npm:omp-designer
```

Then `/designer` to toggle ON/OFF.

## What ships

```
omp-designer/
├── extensions/designer.ts    # Pi extension (pi.dev API)
├── extension/index.ts        # omp extension (oh-my-pi API)
├── skills/                   # Auto-discovered by both
│   ├── designer-master.md    # 8-step orchestrator workflow
│   ├── taste-skill.md        # 78 KB anti-AI-slop rules + 50 pre-flight checks
│   ├── animate.md            # Emil Kowalski animation patterns
│   ├── ui-ux-pro-max.md      # Design intelligence instruction set
│   └── review-skill.md       # Post-build audit
└── data/ui-ux-pro-max/       # 1.7 MB CSV design database
    ├── design.csv            # 161 color palettes
    ├── typography.csv        # 57 font pairings
    ├── styles.csv            # 67 UI styles
    ├── ux-guidelines.csv     # 99 UX rules
    └── …
```

## Quickstart

```bash
# 1. Install
pi install npm:omp-designer     # or: omp install npm:omp-designer

# 2. Configure MCP servers (one-time)
#    Edit ~/.pi/agent/mcp.json (Pi) or ~/.omp/agent/mcp.json (omp)
#    See MCP Setup below

# 3. Start coding
pi                               # or: omp
/designer                        # → DESIGNER MODE ON
"Build me a SaaS landing page"   # agent follows 8-step design workflow
/designer                        # → DESIGNER MODE OFF
```

## MCP Setup

4 MCP servers are pre-configured but disabled by default. `/designer` toggles them ON/OFF via `mcp.json`. **API keys are YOUR responsibility** — none are bundled.

### Required (free)

| Server | Setup |
|--------|-------|
| **ui-layouts** | No key needed. `npx @ui-layouts/mcp@latest` |
| **chrome-devtools** | No key needed. Uses local Chrome. See Chrome setup below |

### Optional (need API keys)

| Server | Get key at |
|--------|-----------|
| **21st-dev-magic** | [21st.dev](https://21st.dev) — free tier for SVG logo search + component patterns |
| **designmd** | [designmd.ai/api-keys](https://designmd.ai/api-keys) — design system references |

### Add your keys

```json
// ~/.pi/agent/mcp.json or ~/.omp/agent/mcp.json
{
  "mcpServers": {
    "21st-dev-magic": {
      "command": "npx",
      "args": ["-y", "@21st-dev/magic@latest"],
      "env": { "API_KEY": "your-21st-key-here" },
      "enabled": false
    },
    "designmd": {
      "command": "npx",
      "args": ["-y", "designmd-mcp@latest"],
      "env": { "DESIGNMD_API_KEY": "your-designmd-key-here" },
      "enabled": false
    }
  }
}
```

After adding keys, `/reload` (Pi) or restart omp.

### Chrome setup (chrome-devtools)

```json
{
  "chrome-devtools": {
    "type": "stdio",
    "command": "npx",
    "args": [
      "-y", "chrome-devtools-mcp@latest",
      "--isolated", "--headless",
      "--no-usage-statistics", "--no-performance-crux",
      "--executable-path", "/path/to/chrome",
      "--chrome-arg=--no-sandbox",
      "--chrome-arg=--disable-gpu",
      "--chrome-arg=--disable-dev-shm-usage",
      "--chrome-arg=--disable-logging",
      "--chrome-arg=--log-level=3"
    ]
  }
}
```

> **Chrome log spam fix:** `--chrome-arg=--disable-logging --chrome-arg=--log-level=3` suppresses the `ERROR:fallback_task_provider.cc` and `ERROR:extension_web_request_event_router.cc` noise. These are harmless Chromium internal messages, not from the designer package.

Find your Chrome binary:
- Linux: `which google-chrome` or Puppeteer cache `~/.cache/puppeteer/chrome/…`
- macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`

## Model recommendation

Per AGENTS.md: the default model should be **Kimi K2.6** for best design taste. Smaller models produce more AI-slop regardless of rules.

```yaml
# ~/.pi/agent/config.yml (Pi) or ~/.omp/agent/config.yml (omp)
modelRoles:
  default: opencode-go/kimi-k2.6:high
```

## The 8-step workflow

1. **Assess** — infers project type, vibe, audience from context
2. **Read Skills** — loads design rules lazily (sections only, never full files)
3. **Search MCPs** — discovers components, logos, patterns from 21st-dev + ui-layouts
4. **Create Plan** — picks palette/fonts FROM CSV data (not memory), sets design dials
5. **Present** — shows tokens for user approval
6. **Implement** — builds with real components, generated images, proper animations
7. **Review** — 3-cycle audit: build, console, a11y, color audit, 50-point pre-flight
8. **Present Results** — before/after, screenshots, report card

## Anti-Slop Enforcement

Every turn, the system prompt blocks:

- `#667eea`, `#764ba2`, `#1a1a2e`, `#16213e`, `#f0f0ff`
- Em-dashes (—) anywhere on the page
- Inter as default font
- Three equal cards in a row
- Glassmorphism without justification
- Scroll cues (`↓ scroll to explore`)
- Version labels on marketing pages
- "Jane Doe, CEO of Acme" fake testimonials
- … and 40+ more in the pre-flight checklist

## Uninstall

```bash
pi remove npm:omp-designer      # Pi
omp plugin uninstall omp-designer  # omp
```

Also removes MCP server entries from `mcp.json` when toggled OFF.

## License

MIT. Bundled skills retain their respective licenses:
- ui-ux-pro-max: MIT (NextLevelBuilder)
- taste-skill: MIT (tasteskill.dev / Leonxlnx)
