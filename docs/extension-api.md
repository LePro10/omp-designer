# omp Extension API Rules

## The Factory Function Rule (CRITICAL)

omp extensions MUST export a factory function — a plain object will crash:

```typescript
// ✅ CORRECT:
export default function (pi: any) {
  pi.registerCommand("designer", { ... });
  pi.on("resources_discover", () => { ... });
}

// ❌ WRONG — crashes with "not a valid factory function":
export default {
  commands: new Map([["designer", { ... }]]),
  handlers: new Map([["resources_discover", [...]]]),
};
```

## The `return {}` Rule (CRITICAL)

Handlers that should return nothing MUST return `undefined` (no return or `return;`).
Returning `{}` will crash:

```typescript
// ✅ CORRECT (mode OFF):
pi.on("resources_discover", () => {
  if (!isOn()) return; // ← undefined, fine
  return { skillPaths: [...] };
});

// ❌ WRONG — will crash somewhere in omp internals:
pi.on("resources_discover", () => {
  if (!isOn()) return {}; // ← EXPLODES
});
```

## The `message` vs `systemPrompt` Rule (CRITICAL)

In `before_agent_start`, NEVER use `message` — it crashes with
`h.content is undefined`. Always use `systemPrompt`:

```typescript
// ✅ CORRECT:
pi.on("before_agent_start", (event: any) => {
  if (!isOn()) return;
  const existing = event?.systemPrompt;
  const prompts = Array.isArray(existing) ? existing : existing ? [existing] : [];
  return { systemPrompt: [...prompts, MY_PROMPT] };
});

// ❌ WRONG — crashes:
pi.on("before_agent_start", () => {
  return { message: "some text" };
});
```

## Available Events

| Event | Returns | Purpose |
|-------|---------|---------|
| `resources_discover` | `{ skillPaths: string[] } \| undefined` | Inject skills into context |
| `before_agent_start` | `{ systemPrompt: string[], message?: any } \| undefined` | Modify system prompt |
| `context` | Modified messages array | Alter conversation before sending |
| `tool_result` | Modified tool result | Intercept/alter tool output |
| `input` | Modified text/image input | Alter user input before processing |

## Available Commands (registerCommand)

```typescript
pi.registerCommand("command-name", {
  description: "what it does",
  aliases: ["alt-name"],
  handler: (args: any, ctx: any) => {
    ctx?.ui?.notify?.("message", "info");
    ctx?.editor?.setText?.("");
  },
});
```

## Available API Methods (`pi`)

| Method | Purpose |
|--------|---------|
| `pi.registerCommand(name, opts)` | Register slash command |
| `pi.on(event, callback)` | Register event handler |
| `pi.registerTool(tool)` | Register a custom tool |
| `pi.registerShortcut(key, opts)` | Register keyboard shortcut |
| `pi.registerFlag(name, opts)` | Register CLI flag |
| `pi.setModel(f)` | Change active model |
| `pi.getFlag(name)` | Get flag value |
| `pi.on(event, callback)` | Event listener |
