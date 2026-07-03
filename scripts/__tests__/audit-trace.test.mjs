#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const script = new URL("../audit-trace.mjs", import.meta.url).pathname;

function fixture(events) {
  const dir = mkdtempSync(join(tmpdir(), "designer-trace-"));
  const file = join(dir, "trace.jsonl");
  writeFileSync(file, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
  return { dir, file };
}

function run(events, strict = false) {
  const data = fixture(events);
  const result = spawnSync(process.execPath, [script, data.file, ...(strict ? ["--strict"] : [])], {
    encoding: "utf8",
  });
  rmSync(data.dir, { recursive: true, force: true });
  return result;
}

const valid = [
  { timestamp: "2026-01-01T00:00:00.000Z", cwd: "/tmp/site", event: "prompt_injected" },
  { timestamp: "2026-01-01T00:00:01.000Z", cwd: "/tmp/site", event: "skills_discovered" },
  { timestamp: "2026-01-01T00:01:00.000Z", cwd: "/tmp/site", event: "delivery_checks_passed" },
];

assert.equal(run(valid, true).status, 0);
console.log("ok - accepts complete v5 trace");

const duplicate = [
  ...valid.slice(0, 1),
  { timestamp: "2026-01-01T00:00:00.000Z", cwd: "/tmp/site", event: "prompt_injected" },
  ...valid.slice(1),
];
assert.equal(run(duplicate).status, 1);
console.log("ok - rejects duplicate extension events");

const legacy = [
  ...valid,
  { timestamp: "2026-01-01T00:00:02.000Z", cwd: "/tmp/site", event: "skill_gate_blocked" },
];
assert.equal(run(legacy).status, 1);
console.log("ok - rejects legacy gate events");

assert.equal(run(valid.slice(0, 2), true).status, 1);
console.log("ok - strict mode requires passed delivery checks");

console.log("\n4 trace tests passed");
