# MCP Server Setup

Configured in `~/.omp/agent/mcp.json` (OMP) or `~/.pi/agent/mcp.json` (Pi). Four MCP servers:

## 21st-dev-magic

Get a free API key at https://21st.dev/studio

```json
{
  "21st-dev-magic": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@21st-dev/magic@latest"],
    "env": { "API_KEY": "<YOUR_21ST_DEV_API_KEY>" },
    "enabled": false
  }
}
```

**Tools:**
| Tool | Status | Use |
|------|--------|-----|
| `logo_search` | Works | SVG icons, brand graphics |
| `21st_magic_component_inspiration` | Works | Component patterns, variants, code |
| `21st_magic_component_refiner` | Works | Refine existing components |
| `21st_magic_component_builder` | Timeout (30s) | Do not call |

## designmd

Get an API key at https://designmd.ai/api-keys (optional).

```json
{
  "designmd": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "designmd-mcp@latest"],
    "env": { "DESIGNMD_API_KEY": "<YOUR_DESIGNMD_API_KEY>" },
    "enabled": false
  }
}
```

## ui-layouts

No API key required.

```json
{
  "ui-layouts": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@ui-layouts/mcp@latest"],
    "enabled": false
  }
}
```

## chrome-devtools

No API key required. Find your Chrome binary:
- Linux: check `~/.cache/puppeteer/chrome/` or run `which google-chrome`
- macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`

```json
{
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
  }
}
```

**Tools used in designer mode:** navigate_page, take_screenshot, take_snapshot, evaluate_script, resize_page.

## MCP Discovery

omp discovers MCP servers from:
- `{cwd}/.omp/mcp.json` (project)
- `~/.omp/agent/mcp.json` (user)

## MCP Visibility

MCP servers are toggled by the `/designer` command. When designer mode is ON,
the extension sets `enabled: true` for all four servers in mcp.json.
Run `/reload` (Pi) or restart omp to activate the change.
