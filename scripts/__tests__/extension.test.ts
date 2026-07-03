import { afterAll, describe, expect, test } from "bun:test";

process.env.OMP_DESIGNER_MODE = "1";

const module = await import("../../extension/index.ts");

interface Registration {
  name: string;
  options: Record<string, unknown>;
}

const commands: Registration[] = [];
const handlers = new Map<string, Array<(event?: unknown, ctx?: { cwd?: string }) => unknown>>();
const api = {
  registerCommand(name: string, options: Record<string, unknown>) {
    commands.push({ name, options });
  },
  on(event: string, handler: (event?: unknown, ctx?: { cwd?: string }) => unknown) {
    const entries = handlers.get(event) ?? [];
    entries.push(handler);
    handlers.set(event, entries);
  },
};

module.default(api);

afterAll(() => {
  delete process.env.OMP_DESIGNER_MODE;
  delete process.env.OMP_DESIGNER_V5_REGISTERED_PID;
});

describe("v5 extension", () => {
  test("registers once without a tool gate", () => {
    module.default(api);
    expect(commands.map((command) => command.name)).toEqual(["designer", "designer-doctor"]);
    expect(handlers.has("tool_call")).toBe(false);
    expect(handlers.has("tool_result")).toBe(false);
  });

  test("discovers exactly four package-relative skills", () => {
    const handler = handlers.get("resources_discover")?.[0];
    expect(handler).toBeDefined();
    const result = handler?.({}, { cwd: process.cwd() }) as { skillPaths: string[] };
    expect(result.skillPaths).toHaveLength(4);
    expect(result.skillPaths.every((path) => path.startsWith(module.PACKAGE_ROOT))).toBe(true);
  });

  test("injects one concise prompt", () => {
    const handler = handlers.get("before_agent_start")?.[0];
    const result = handler?.(
      { systemPrompt: ["base"] },
      { cwd: process.cwd() },
    ) as { systemPrompt: string[] };
    expect(result.systemPrompt).toHaveLength(2);
    const prompt = result.systemPrompt[1];
    expect(prompt.length).toBeLessThan(8_000);
    expect(prompt).toContain("MCP research is optional");
    expect(prompt).not.toContain("Attempt ALL");
    expect(prompt).not.toContain("permanently blocks the gate");
  });

  test("replaces an existing v5 prompt instead of stacking it", () => {
    const handler = handlers.get("before_agent_start")?.[0];
    const result = handler?.(
      { systemPrompt: ["base", module.DESIGNER_PROMPT] },
      { cwd: process.cwd() },
    ) as { systemPrompt: string[] };
    expect(result.systemPrompt.filter((prompt) => prompt.includes("[DESIGNER MODE: ACTIVE v5]"))).toHaveLength(1);
  });

  test("all runtime assets exist in the package", async () => {
    for (const skill of module.DESIGNER_SKILLS) {
      expect(await Bun.file(skill.file).exists()).toBe(true);
    }
    expect(await Bun.file(`${module.DATA_ROOT}/colors.csv`).exists()).toBe(true);
  });
});
