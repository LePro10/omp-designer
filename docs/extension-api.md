# Extension API notes

These are the runtime assumptions used by v5 and covered by integration tests.

## Export a factory

```typescript
export default function extension(pi: ExtensionAPI): void {
  pi.registerCommand("designer", options);
  pi.on("before_agent_start", handler);
}
```

A plain object is not a valid extension.

## Return `undefined` when inactive

```typescript
pi.on("resources_discover", (_event, ctx) => {
  if (!isEnabled(ctx?.cwd)) return;
  return { skillPaths };
});
```

Do not return an empty object from a handler whose event expects a specific
result shape.

## Prompt injection

`before_agent_start` modifies `systemPrompt`. Normalize the existing value,
remove an earlier designer marker, and append one prompt. Do not return a
synthetic message.

```typescript
return { systemPrompt: [...basePrompts, DESIGNER_PROMPT] };
```

## Events used

| Event | v5 purpose |
| --- | --- |
| `resources_discover` | expose four package-relative skills |
| `before_agent_start` | inject one current designer prompt |
| `session_stop` | OMP: bounded plan check + post-execution validator/build backstop. Pi: plan check only |

`tool_call` and `tool_result` are intentionally not used for workflow gating.
There is no skill-read hard gate.

## Session-stop result

A failed delivery check may return:

```typescript
{
  continue: true,
  additionalContext: "Fix the listed objective blockers and rerun checks."
}
```

The extension permits only one repair continuation for a session. A subsequent
failure is reported normally instead of creating a loop. Warnings alone do not
request continuation.

## Duplicate registration

An extension can be discovered through more than one loader realm. Use a
process-wide marker and an atomic process-scoped lock in addition to a
`globalThis` symbol. The integration test calls the factory twice and expects one
command/handler set; the simulated host-bridge test additionally imports a second
loader realm and confirms it registers no duplicate hooks.

## Context

Prefer `ctx.cwd`, falling back to `process.cwd()`. State, traces, checks, and
doctor output must all refer to the same resolved project directory.
