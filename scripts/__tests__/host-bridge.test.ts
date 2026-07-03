/**
 * P2 host-bridge evidence.
 *
 * This harness simulates the documented OMP/Pi host event contract
 * (registerCommand + on("before_agent_start" | "resources_discover" |
 * "session_stop")) closely enough to drive the REAL adapter modules and assert
 * on their hook-level behavior, without a live model or a real OMP process.
 *
 * The OMP adapter writes trace events (which distinguish "checks ran" from
 * "checks skipped") under $HOME/.omp/agent/designer-traces. bun's os.homedir()
 * ignores a $HOME override, so the harness reads the real trace dir and deletes
 * exactly the per-cwd trace files it created (each keyed by a sha256 of the cwd).
 */
import { afterAll, describe, expect, test } from "bun:test";
import {
  mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync, existsSync, readdirSync, readFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

process.env.OMP_DESIGNER_MODE = "1";
process.env.PI_DESIGNER_MODE = "1";

// Real adapter modules under test.
const omp = await import("../../extension/index.ts");
const pi = await import("../../extensions/designer.ts");

const TRACE_DIR = join(homedir(), ".omp", "agent", "designer-traces");
const tempDirs: string[] = [];
const traceCwds = new Set<string>();

// Mirror the adapter's trace filename scheme so cleanup targets only our files.
function tracePath(cwd: string): string {
  const base = cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? "root";
  const hash = createHash("sha256").update(cwd).digest("hex").slice(0, 12);
  return join(TRACE_DIR, `${base}-${hash}.jsonl`);
}

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  for (const cwd of traceCwds) rmSync(tracePath(cwd), { force: true });
  delete process.env.OMP_DESIGNER_MODE;
  delete process.env.PI_DESIGNER_MODE;
  delete process.env.OMP_DESIGNER_V5_REGISTERED_PID;
});

type Handler = (event?: unknown, ctx?: { cwd?: string }) => unknown;

// A fake host that records the exact surface an adapter registers against.
function makeHost() {
  const commands: string[] = [];
  const handlers = new Map<string, Handler[]>();
  const api = {
    registerCommand(name: string, _options: unknown) {
      commands.push(name);
    },
    on(event: string, handler: Handler) {
      const entries = handlers.get(event) ?? [];
      entries.push(handler);
      handlers.set(event, entries);
    },
  };
  const fire = (event: string, payload: unknown, ctx: { cwd?: string }) => {
    if (ctx?.cwd) traceCwds.add(ctx.cwd);
    return handlers.get(event)?.[0]?.(payload, ctx);
  };
  return { commands, handlers, api, fire };
}

function makeTempProject(withBuildScript: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), "omp-e2e-proj-"));
  tempDirs.push(dir);
  const pkg: Record<string, unknown> = { name: "e2e-fixture", private: true };
  if (withBuildScript) pkg.scripts = { build: "node -e \"process.exit(1)\"" };
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "main.js"), "export const x = 1;\n");
  writeFileSync(join(dir, "index.html"), "<!doctype html><h1>hi</h1>\n");
  return dir;
}

// Stamp every existing source file into the past so a fresh session baseline
// (Date.now at before_agent_start) sees no change unless the test writes one.
function ageSources(dir: string): void {
  const past = new Date(Date.now() - 60_000);
  const stamp = (p: string) => {
    for (const entry of readdirSync(p, { withFileTypes: true })) {
      const full = join(p, entry.name);
      if (entry.isDirectory()) stamp(full);
      else utimesSync(full, past, past);
    }
  };
  stamp(dir);
}

function traceEvents(cwd: string): string[] {
  if (!existsSync(TRACE_DIR)) return [];
  const events: string[] = [];
  for (const file of readdirSync(TRACE_DIR)) {
    if (!file.endsWith(".jsonl")) continue;
    for (const line of readFileSync(join(TRACE_DIR, file), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as { event?: string; cwd?: string };
        if (parsed.cwd === cwd && typeof parsed.event === "string") events.push(parsed.event);
      } catch {
        // ignore malformed trace lines
      }
    }
  }
  return events;
}

const assistant = (text: string) => ({ last_assistant_message: { content: [{ type: "text", text }] } });

// The OMP duplicate-load guard is process-global, so the adapter can only be
// registered once per process. Register a single shared host and give every
// scenario a distinct cwd/session so in-adapter state never bleeds across tests.
const host = makeHost();
omp.default(host.api as never);

describe("P2: OMP hook registration", () => {
  test("registers the documented commands and hooks, and no tool gate", () => {
    expect(host.commands).toEqual(["designer", "designer-doctor"]);
    expect(host.handlers.has("before_agent_start")).toBe(true);
    expect(host.handlers.has("resources_discover")).toBe(true);
    expect(host.handlers.has("session_stop")).toBe(true);
    expect(host.handlers.has("tool_call")).toBe(false);
    expect(host.handlers.has("tool_result")).toBe(false);
  });

  test("resources_discover exposes exactly the four skill resources", () => {
    const result = host.fire("resources_discover", {}, { cwd: process.cwd() }) as { skillPaths: string[] };
    expect(result.skillPaths).toHaveLength(4);
    expect(result.skillPaths.every((p) => p.startsWith(omp.PACKAGE_ROOT) && p.endsWith(".md"))).toBe(true);
  });

  test("before_agent_start injects the designer prompt exactly once", () => {
    const cwd = "/tmp/omp-e2e-inject";
    const first = host.fire("before_agent_start", { prompt: "build a page", systemPrompt: ["base"] }, { cwd }) as { systemPrompt: string[] };
    expect(first.systemPrompt.filter((p) => p.includes("[DESIGNER MODE: ACTIVE v5]"))).toHaveLength(1);
    // Re-injection over an already-decorated prompt must not stack a second copy.
    const second = host.fire("before_agent_start", { systemPrompt: first.systemPrompt }, { cwd }) as { systemPrompt: string[] };
    expect(second.systemPrompt.filter((p) => p.includes("[DESIGNER MODE: ACTIVE v5]"))).toHaveLength(1);
  });
});

describe("P2: plan continuation exactness", () => {
  const cwd = "/tmp/omp-e2e-plan";
  const invalidPlan = "A single-page site with several sections."; // collapses requested multiple pages

  const startPlanSession = (prompt: string, c = cwd) =>
    host.fire("before_agent_start", { prompt, systemPrompt: ["base"] }, { cwd: c });

  test("fires exactly one bounded continuation on the first invalid plan, then stops", () => {
    startPlanSession("Create a plan for various pages and wait for my approval.");
    const first = host.fire("session_stop", { session_id: "plan-1", ...assistant(invalidPlan) }, { cwd }) as {
      continue?: boolean; additionalContext?: string;
    };
    expect(first.continue).toBe(true);
    expect(first.additionalContext).toContain("[DESIGNER PLAN CHECKS FAILED]");
    expect(first.additionalContext).toContain("Rewrite only the approval plan");
    expect(first.additionalContext).toContain("wait");
    expect((first.additionalContext ?? "").length).toBeLessThanOrEqual(7000);

    // Same session, still-invalid plan: bounded, no second continuation (no loop).
    const second = host.fire("session_stop", { session_id: "plan-1", ...assistant(invalidPlan) }, { cwd });
    expect(second).toBeUndefined();
  });

  test("a valid plan passes without continuation", () => {
    startPlanSession("Create a plan for various pages and wait for my approval.", "/tmp/omp-e2e-plan-ok");
    const result = host.fire("session_stop", {
      session_id: "plan-ok",
      ...assistant("Routes: `/`, `/archive`, and `/field`. I will wait for approval."),
    }, { cwd: "/tmp/omp-e2e-plan-ok" });
    expect(result).toBeUndefined();
  });

  test("an explicit detailed-specification request bypasses the length block", () => {
    const c = "/tmp/omp-e2e-plan-detailed";
    startPlanSession("Write a detailed specification plan for various pages and wait for my approval.", c);
    const longBody = `Routes: \`/\`, \`/a\`, and \`/b\`. ${"word ".repeat(900)} I will wait for approval.`;
    const result = host.fire("session_stop", { session_id: "plan-detailed", ...assistant(longBody) }, { cwd: c });
    expect(result).toBeUndefined();
  });

  test("an overlong plan without a detail request is continued once for length", () => {
    const c = "/tmp/omp-e2e-plan-long";
    startPlanSession("Create a plan for various pages and wait for my approval.", c);
    const longBody = `Routes: \`/\`, \`/a\`, and \`/b\`. ${"word ".repeat(900)} I will wait for approval.`;
    const result = host.fire("session_stop", { session_id: "plan-long", ...assistant(longBody) }, { cwd: c }) as {
      continue?: boolean; additionalContext?: string;
    };
    expect(result.continue).toBe(true);
    expect(result.additionalContext).toContain("is long");
  });
});

describe("P2: delivery-check bridge", () => {
  test("a pure chat/build turn with no project change does not spawn checks", () => {
    const dir = makeTempProject(true); // build script exits 1 -> would fail loudly if spawned
    ageSources(dir);
    host.fire("before_agent_start", { prompt: "Build a bakery landing page.", systemPrompt: ["base"] }, { cwd: dir });
    const result = host.fire("session_stop", { session_id: "noop", ...assistant("Some layout advice.") }, { cwd: dir });
    expect(result).toBeUndefined();
    expect(traceEvents(dir)).toContain("delivery_checks_skipped");
    expect(traceEvents(dir)).not.toContain("delivery_checks_failed");
    expect(traceEvents(dir)).not.toContain("delivery_checks_passed");
  });

  test("generated build output alone does not count as a project change", () => {
    const dir = makeTempProject(false);
    ageSources(dir);
    host.fire("before_agent_start", { prompt: "Build a bakery landing page.", systemPrompt: ["base"] }, { cwd: dir });
    // Fresh output in ignored dirs after the baseline must not trigger checks.
    const future = new Date(Date.now() + 60_000);
    for (const ignored of ["dist", "node_modules", ".next"]) {
      mkdirSync(join(dir, ignored), { recursive: true });
      const f = join(dir, ignored, "bundle.js");
      writeFileSync(f, "generated");
      utimesSync(f, future, future);
    }
    const result = host.fire("session_stop", { session_id: "genout", ...assistant("done") }, { cwd: dir });
    expect(result).toBeUndefined();
    expect(traceEvents(dir)).toContain("delivery_checks_skipped");
  });

  test("a real frontend source change after session start does run delivery checks", () => {
    const dir = makeTempProject(false); // no build script -> build check is skipped-ok, validators still run
    ageSources(dir);
    host.fire("before_agent_start", { prompt: "Build a bakery landing page.", systemPrompt: ["base"] }, { cwd: dir });
    // A genuine source edit after the baseline.
    const future = new Date(Date.now() + 60_000);
    const changed = join(dir, "src", "main.js");
    writeFileSync(changed, "export const x = 2;\n");
    utimesSync(changed, future, future);
    host.fire("session_stop", { session_id: "changed", ...assistant("Shipped the page.") }, { cwd: dir });
    const events = traceEvents(dir);
    // The delivery path ran (passed or failed), i.e. it was NOT skipped this turn.
    expect(events.some((e) => e === "delivery_checks_passed" || e === "delivery_checks_failed")).toBe(true);
  });
});

describe("P2: duplicate load and loader realms", () => {
  test("a second default() call in the same process registers no duplicate hooks", () => {
    const dup = makeHost();
    omp.default(dup.api as never); // guarded by INSTANCE_ENV/registry/lock
    expect(dup.commands).toHaveLength(0);
    expect(dup.handlers.size).toBe(0);
  });

  test("a separately imported realm does not double-register in the same process", async () => {
    const realm2 = await import("../../extension/index.ts?realm=2");
    const host2 = makeHost();
    realm2.default(host2.api as never);
    expect(host2.commands).toHaveLength(0);
    expect(host2.handlers.size).toBe(0);
  });
});

describe("P2: OMP vs Pi capability difference", () => {
  test("Pi registers the same commands/hooks but has no delivery-check backstop", () => {
    const piHost = makeHost();
    pi.default(piHost.api as never);
    expect(piHost.commands).toEqual(["designer", "designer-doctor"]);
    expect(piHost.handlers.has("session_stop")).toBe(true);

    const dir = makeTempProject(true); // build would exit 1 if a backstop existed
    ageSources(dir);
    // A build-mode turn with a real change: OMP would run delivery checks; Pi must not.
    piHost.fire("before_agent_start", { prompt: "Build a bakery landing page.", systemPrompt: ["base"] }, { cwd: dir });
    const future = new Date(Date.now() + 60_000);
    const changed = join(dir, "src", "main.js");
    writeFileSync(changed, "export const x = 3;\n");
    utimesSync(changed, future, future);
    const result = piHost.fire("session_stop", { session_id: "pi-build", ...assistant("done") }, { cwd: dir });
    // Pi returns nothing for a non-plan turn: it is prompt-only + plan-check.
    expect(result).toBeUndefined();
  });

  test("both adapters still gate a plan turn identically", () => {
    const piHost = makeHost();
    pi.default(piHost.api as never);
    const cwd = "/tmp/omp-e2e-pi-plan";
    piHost.fire("before_agent_start", { prompt: "Create a plan for various pages and wait for approval.", systemPrompt: ["base"] }, { cwd });
    const result = piHost.fire("session_stop", {
      session_id: "pi-plan",
      ...assistant("A single-page site with several sections."),
    }, { cwd }) as { continue?: boolean; additionalContext?: string };
    expect(result.continue).toBe(true);
    expect(result.additionalContext).toContain("[DESIGNER PLAN CHECKS FAILED]");
  });
});

describe("P2: fallback session id collision resistance", () => {
  test("two host-omitted-session-id sessions in the same cwd do not collide", () => {
    // Both sessions omit session_id; without a robust fallback they would share
    // one attempt counter and the second would be silently suppressed.
    const cwd = "/tmp/omp-e2e-collide";
    const invalid = "A single-page site with several sections.";

    host.fire("before_agent_start", { prompt: "Create a plan for various pages and wait for approval.", systemPrompt: ["base"] }, { cwd });
    const a = host.fire("session_stop", { ...assistant(invalid) }, { cwd }) as { continue?: boolean };
    expect(a.continue).toBe(true);

    // A new, independent session in the same cwd (new baseline -> new fallback id).
    host.fire("before_agent_start", { prompt: "Create a plan for various pages and wait for approval.", systemPrompt: ["base"] }, { cwd });
    const b = host.fire("session_stop", { ...assistant(invalid) }, { cwd }) as { continue?: boolean };
    expect(b.continue).toBe(true);
  });
});
