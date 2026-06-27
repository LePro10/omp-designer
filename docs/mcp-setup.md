# MCP Server Setup

Configured in `~/.omp/agent/mcp.json`. Two MCP servers:

## 21st-dev-magic

```json
{
  "21st-dev-magic": {
    "command": "npx",
    "args": ["-y", "@21st-dev/magic@latest"],
    "env": { "API_KEY": "db28ed54db43b5bab1db3dfdda099b28e4242eaad4bb7d17c99a30c0c25673b3" }
  }
}
```

**Tools:**
| Tool | Status | Use |
|------|--------|-----|
| `logo_search` | ✅ Works | SVG icons, brand graphics (named `logo_search`, NOT `21st_magic_logo_search`) |
| `21st_magic_component_inspiration` | ✅ Works | Component patterns, variants, code |
| `21st_magic_component_refiner` | ✅ Works | Refine existing components |
| `21st_magic_component_builder` | ❌ Timeout (30s) | NEVER call — blocked by prompt |


**API Key source:** From old Pi backup (`~/pi-backup/configs/mcp-servers.json`)

## chrome-devtools

```json
{
  "chrome-devtools": {
    "command": "npx",
    "args": [
      "-y", "chrome-devtools-mcp@latest",
      "--isolated", "--headless",
      "--no-usage-statistics", "--no-performance-crux",
      "--executable-path", "/home/leandro/.cache/puppeteer/chrome/linux-149.0.7827.22/chrome-linux64/chrome",
      "--chrome-arg=--no-sandbox", "--chrome-arg=--disable-gpu",
      "--chrome-arg=--disable-dev-shm-usage"
    ],
    "env": {
      "CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS": "1",
      "CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS": "1"
    }
  }
}
```

**Chrome Binary:** Puppeteer's bundled Chrome v149.0.7827.22 (641 MB)
at `~/.cache/puppeteer/chrome/linux-149.0.7827.22/chrome-linux64/chrome`.
Leftover from the old Pi installation — no download needed.

**Headless:** Yes — runs without visible window. Configured via `--headless` flag.

**Tools used in designer mode:** navigate_page, take_screenshot, take_snapshot,
list_console_messages, evaluate_script, resize_page.

**Note:** Lighthouse audit on `localhost` often fails (needs public URL).

## MCP Discovery

omp discovers MCP servers from:
- `{cwd}/.omp/mcp.json` (project)
- `{cwd}/.omp/.mcp.json` (project)
- `~/.omp/mcp.json` (user)
- `~/.omp/.mcp.json` (user)
- `~/.omp/agent/mcp.json` (user — current location)

Current config stored at `~/.omp/agent/mcp.json` (added `/mcp add` created this path).

## MCP Visibility

Both MCP servers are ALWAYS running (configured in mcp.json).
But the agent only KNOWS about them when Designer Mode is ON (via PROMPT_INJECT).
This mimics the "only visible when /designer is ON" behavior.
