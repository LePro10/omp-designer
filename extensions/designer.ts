/**
 * omp-designer v5 extension for Pi.
 *
 * Pi receives the same focused workflow as OMP, without tool interception or
 * MCP configuration mutation.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DESIGNER_PROMPT, DESIGNER_SKILLS } from "../extension/index.ts";

const AGENT_ROOT = join(homedir(), ".pi", "agent");
const STATE_FILE = join(AGENT_ROOT, "designer-state.json");
const GLOBAL_STATE_KEY = "*";
const PROMPT_MARKER_RE = /\n?\[DESIGNER MODE: ACTIVE v5\][\s\S]*?\[\/DESIGNER MODE\]\n?/g;

interface PiCommandContext {
  cwd?: string;
  ui?: { notify?: (message: string, level: string) => void };
  editor?: { setText?: (text: string) => void };
}

interface PiExtensionAPI {
  registerCommand(
    name: string,
    options: {
      description: string;
      handler: (args: unknown, ctx: PiCommandContext) => void | Promise<void>;
    },
  ): void;
  on(
    event: string,
    handler: (event?: unknown, ctx?: { cwd?: string }) => unknown | Promise<unknown>,
  ): void;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function readState(): Record<string, boolean> {
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8")) as Record<string, unknown>;
    if (typeof parsed.enabled === "boolean") return { [GLOBAL_STATE_KEY]: parsed.enabled };
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
    );
  } catch {
    return {};
  }
}

function writeState(state: Record<string, boolean>): void {
  mkdirSync(AGENT_ROOT, { recursive: true });
  const temporary = `${STATE_FILE}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, STATE_FILE);
}

function isEnabled(cwd = process.cwd()): boolean {
  if (process.env.PI_DESIGNER_MODE === "1") return true;
  if (process.env.PI_DESIGNER_MODE === "0") return false;
  const state = readState();
  return state[cwd] === true || state[GLOBAL_STATE_KEY] === true;
}

function toggle(cwd: string): boolean {
  const state = readState();
  delete state[GLOBAL_STATE_KEY];
  const enabled = state[cwd] !== true;
  if (enabled) state[cwd] = true;
  else delete state[cwd];
  writeState(state);
  return enabled;
}

function normalizePrompts(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" ? [value] : [];
}

export default function designerExtension(pi: PiExtensionAPI): void {
  pi.registerCommand("designer", {
    description: "Toggle the focused designer workflow for this project",
    handler: (_args, ctx) => {
      const cwd = ctx.cwd ?? process.cwd();
      const enabled = toggle(cwd);
      ctx.ui?.notify?.(
        enabled
          ? "DESIGNER MODE ON - focused workflow active. MCP configuration is unchanged."
          : "DESIGNER MODE OFF",
        "info",
      );
      ctx.editor?.setText?.("");
    },
  });

  pi.registerCommand("designer-doctor", {
    description: "Check designer skill assets",
    handler: (_args, ctx) => {
      const cwd = ctx.cwd ?? process.cwd();
      const lines = [
        "Designer doctor v5 (Pi)",
        "",
        `Mode for cwd: ${isEnabled(cwd) ? "enabled" : "disabled"}`,
        ...DESIGNER_SKILLS.map((skill) => `${skill.name}: ${existsSync(skill.file) ? "present" : "missing"}`),
        "",
        "Designer mode does not mutate mcp.json.",
      ];
      ctx.editor?.setText?.(lines.join("\n"));
    },
  });

  pi.on("resources_discover", (_event, ctx) => {
    const cwd = ctx?.cwd ?? process.cwd();
    if (!isEnabled(cwd)) return;
    return { skillPaths: DESIGNER_SKILLS.map((skill) => skill.file).filter(existsSync) };
  });

  pi.on("before_agent_start", (event, ctx) => {
    const cwd = ctx?.cwd ?? process.cwd();
    if (!isEnabled(cwd)) return;
    const prompts = normalizePrompts(asRecord(event).systemPrompt)
      .map((prompt) => prompt.replace(PROMPT_MARKER_RE, "\n").trim())
      .filter(Boolean);
    return { systemPrompt: [...prompts, DESIGNER_PROMPT] };
  });
}
