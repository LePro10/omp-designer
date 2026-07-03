# Optional MCP setup

MCP is not required for designer mode. Configure a server only when its tools
help the team's actual workflow. `/designer` never edits or toggles this file.

Locations:

- omp: `~/.omp/agent/mcp.json`
- Pi: `~/.pi/agent/mcp.json`

## Minimal browser server

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@1.4.0",
        "--isolated",
        "--headless",
        "--slim",
        "--no-usage-statistics",
        "--no-performance-crux",
        "--chrome-arg=--no-sandbox",
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
}
```

Use `--executable-path` only when automatic Chrome discovery fails. Avoid disabling
the GPU unless the environment actually requires it.

## Optional reference servers

Current pinned examples:

```json
{
  "mcpServers": {
    "ui-layouts": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@ui-layouts/mcp@0.3.0"],
      "enabled": false
    },
    "21st-dev-magic": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@21st-dev/magic@0.1.0"],
      "env": {
        "API_KEY": "<YOUR_21ST_DEV_API_KEY>"
      },
      "enabled": false
    },
    "designmd": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "designmd-mcp@0.2.1"],
      "env": {
        "DESIGNMD_API_KEY": "<YOUR_DESIGNMD_API_KEY>"
      },
      "enabled": false
    }
  }
}
```

The placeholders are not credentials. Replace them locally only after obtaining
the corresponding key. Never pass keys in CLI arguments or commit the resulting
configuration.

## Verification

1. Test `npx` and each configured server independently.
2. Restart/reload the host after configuration changes.
3. Enable only the server needed for the current task.
4. Run `/designer-doctor` to see configuration visibility.
5. If an optional server fails, continue with local inspection; do not retry in a
   loop.

Pin versions in long-lived configurations and review release notes before
updating. `@latest` makes failures non-reproducible.
