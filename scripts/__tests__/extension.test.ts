import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

  test("plan-only prompt omits the delivery-review path and delivery commands", () => {
    const handler = handlers.get("before_agent_start")?.[0];
    const result = handler?.(
      {
        prompt: "Create a plan first and then I will approve it.",
        systemPrompt: ["base"],
      },
      { cwd: "/tmp/omp-designer-plan-prompt" },
    ) as { systemPrompt: string[] };
    const prompt = result.systemPrompt.at(-1) ?? "";
    expect(prompt).toContain("plan-only turn");
    expect(prompt).not.toContain("review-skill.md");
    expect(prompt).not.toContain("For substantive frontend work, run:");
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

  test("does not run delivery checks for an empty plan-only workspace", () => {
    const promptHandler = handlers.get("before_agent_start")?.[0];
    promptHandler?.(
      {
        prompt: "Create a plan for various pages and wait for my approval.",
        systemPrompt: ["base"],
      },
      { cwd: "/tmp/omp-designer-plan-only-empty" },
    );
    const handler = handlers.get("session_stop")?.[0];
    expect(handler).toBeDefined();
    const result = handler?.(
      {
        session_id: "plan-only",
        last_assistant_message: {
          content: [{ type: "text", text: "A single-page site with several sections." }],
        },
      },
      { cwd: "/tmp/omp-designer-plan-only-empty" },
    ) as { continue?: boolean; additionalContext?: string };
    expect(result.continue).toBe(true);
    expect(result.additionalContext).toContain("multiple pages");
    expect(result.additionalContext).toContain("fewer than two concrete routes");
  });

  test("accepts a compliant multi-page approval plan without continuation", () => {
    const promptHandler = handlers.get("before_agent_start")?.[0];
    promptHandler?.(
      {
        prompt: "Create a plan for various pages and wait for my approval.",
        systemPrompt: ["base"],
      },
      { cwd: "/tmp/omp-designer-plan-compliant" },
    );
    const handler = handlers.get("session_stop")?.[0];
    const result = handler?.(
      {
        session_id: "plan-compliant",
        last_assistant_message: {
          content: [{ type: "text", text: "Routes: `/`, `/archive`, and `/field`. I will wait for approval." }],
        },
      },
      { cwd: "/tmp/omp-designer-plan-compliant" },
    );
    expect(result).toBeUndefined();
  });

  test("plan checker rejects an unsolicited form", () => {
    const result = module.planChecks(
      "Plan various pages and wait for approval.",
      "Routes are `/` and `/about`. The footer has a contact form.",
    );
    expect(result.ok).toBe(false);
    expect(result.violations.join(" ")).toContain("form");
  });

  test("plan checker rejects unsourced metrics and scroll-jacking", () => {
    const result = module.planChecks(
      "Plan various pages with scroll effects and wait for approval.",
      "Routes: `/` and `/future`. Add animated metrics and Lenis if scroll-jacking is needed.",
    );
    expect(result.ok).toBe(false);
    expect(result.violations.join(" ")).toContain("metrics");
    expect(result.violations.join(" ")).toContain("native scroll");
  });

  test("plan checker does not treat an explicit no-metrics boundary as a claim", () => {
    const result = module.planChecks(
      "Plan various pages and wait for approval.",
      "Routes: `/`, `/about`, and `/future`. No forms, metrics, statistics, or historical claims. I will wait for approval.",
    );
    expect(result.ok).toBe(true);
  });

  test("plan checker rejects dead placeholder links", () => {
    const result = module.planChecks(
      "Plan various pages and wait for approval.",
      "Routes: `/`, `/about`, and `/connect`. GitHub links lead to `#` as demo links.",
    );
    expect(result.ok).toBe(false);
    expect(result.violations.join(" ")).toContain("placeholder link");
  });

  test("recognizes the original misspelled approval request and rejects an overlong plan", () => {
    const promptHandler = handlers.get("before_agent_start")?.[0];
    promptHandler?.(
      {
        prompt: "Create a plan for various pages and then i will aprove it.",
        systemPrompt: ["base"],
      },
      { cwd: "/tmp/omp-designer-plan-typo" },
    );
    const handler = handlers.get("session_stop")?.[0];
    const result = handler?.(
      {
        session_id: "plan-typo",
        last_assistant_message: {
          content: [{ type: "text", text: `Routes: \`/\` and \`/about\`. ${"word ".repeat(810)}` }],
        },
      },
      { cwd: "/tmp/omp-designer-plan-typo" },
    ) as { continue?: boolean; additionalContext?: string };
    expect(result.continue).toBe(true);
    expect(result.additionalContext).toContain("is long");
  });

  test("allows an overlong plan when the user asks for a detailed specification", () => {
    const promptHandler = handlers.get("before_agent_start")?.[0];
    promptHandler?.(
      {
        prompt: "Create a detailed specification plan for various pages and wait for my approval.",
        systemPrompt: ["base"],
      },
      { cwd: "/tmp/omp-designer-plan-detailed" },
    );
    const handler = handlers.get("session_stop")?.[0];
    const result = handler?.(
      {
        session_id: "plan-detailed",
        last_assistant_message: {
          content: [{ type: "text", text: `Routes: \`/\` and \`/about\`. ${"word ".repeat(810)} I will wait for approval.` }],
        },
      },
      { cwd: "/tmp/omp-designer-plan-detailed" },
    ) as { continue?: boolean; additionalContext?: string } | undefined;
    // A detailed spec was explicitly requested, so length alone must not force a rewrite.
    expect(result).toBeUndefined();
  });

  test("plan intent: English positives and negatives", () => {
    const yes = [
      "make a plan first",
      "wait for approval",
      "do not implement yet",
      "draft a plan and I will approve it",
      "before you build anything, outline a plan",
      "get my sign-off first",
    ];
    const no = [
      "review my existing plan and implement it",
      "build a landing page for my bakery",
      "add a hero section and ship it",
      "just build it",
    ];
    for (const prompt of yes) expect(module.asksForApprovalPlan(prompt)).toBe(true);
    for (const prompt of no) expect(module.asksForApprovalPlan(prompt)).toBe(false);
  });

  test("plan intent: German fallback positives and negatives", () => {
    const yes = ["erst planen", "warte auf Freigabe", "noch nicht umsetzen"];
    const no = ["baue eine Landingpage für meine Bäckerei", "setze den Plan jetzt um"];
    for (const prompt of yes) expect(module.asksForApprovalPlan(prompt)).toBe(true);
    for (const prompt of no) expect(module.asksForApprovalPlan(prompt)).toBe(false);
  });

  test("plan length: overlong without a detail request is flagged; concise is fine", () => {
    const overlong = module.planChecks(
      "Plan the homepage and wait for approval.",
      `Routes: \`/\`. ${"word ".repeat(810)}`,
    );
    expect(overlong.ok).toBe(false);
    expect(overlong.violations.join(" ")).toContain("is long");

    const concise = module.planChecks(
      "Plan the homepage and wait for approval.",
      "Routes: `/`. A concise plan under the ceiling. I will wait for approval.",
    );
    expect(concise.ok).toBe(true);

    const detailed = module.planChecks(
      "Write a detailed specification and wait for approval.",
      `Routes: \`/\`. ${"word ".repeat(810)}`,
    );
    expect(detailed.ok).toBe(true);
  });

  test("projectChangedSince detects real writes and ignores stale/ignored files", () => {
    const dir = mkdtempSync(join(tmpdir(), "omp-change-"));
    try {
      const past = new Date(Date.now() - 60_000);
      writeFileSync(join(dir, "index.html"), "<h1>hi</h1>");
      utimesSync(join(dir, "index.html"), past, past);
      mkdirSync(join(dir, "node_modules"));
      writeFileSync(join(dir, "node_modules", "dep.js"), "recent but ignored");

      const baseline = Date.now();
      // Only stale + ignored files exist -> unchanged since baseline.
      expect(module.projectChangedSince(dir, baseline)).toBe(false);

      // A real source write dated after the baseline -> changed.
      const future = new Date(baseline + 60_000);
      writeFileSync(join(dir, "app.js"), "console.log(1)");
      utimesSync(join(dir, "app.js"), future, future);
      expect(module.projectChangedSince(dir, baseline)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a pure chat/build turn with no file changes does not run delivery checks", () => {
    const dir = mkdtempSync(join(tmpdir(), "omp-noop-"));
    try {
      writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "t", scripts: { build: "exit 1" } }));
      mkdirSync(join(dir, "src"));
      writeFileSync(join(dir, "src", "main.js"), "export const x = 1;");
      const past = new Date(Date.now() - 60_000);
      for (const f of ["package.json", "src/main.js"]) utimesSync(join(dir, f), past, past);

      const promptHandler = handlers.get("before_agent_start")?.[0];
      promptHandler?.({ prompt: "Build a landing page for my bakery.", systemPrompt: ["base"] }, { cwd: dir });

      const handler = handlers.get("session_stop")?.[0];
      const result = handler?.(
        {
          session_id: "noop-build",
          last_assistant_message: { content: [{ type: "text", text: "Here is some advice about layout." }] },
        },
        { cwd: dir },
      );
      // Returned before spawning build/validators (build script would exit 1).
      expect(result).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
