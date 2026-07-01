#!/usr/bin/env node
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const script = new URL("../audit-trace.mjs", import.meta.url).pathname;
const cases = [];

function test(name, fn) {
  cases.push({ name, fn });
}

function fixture(events) {
  const dir = mkdtempSync(join(tmpdir(), "designer-trace-"));
  const file = join(dir, "trace.jsonl");
  writeFileSync(file, events.map((event) => JSON.stringify({ timestamp: "2026-01-01T00:00:00.000Z", ...event })).join("\n") + "\n");
  return { dir, file };
}

function run(file, strict = false) {
  return spawnSync(process.execPath, [script, file, ...(strict ? ["--strict"] : [])], { encoding: "utf-8" });
}

const validEvents = [
  { event: "prompt_injected" },
  { event: "skills_discovered", count: 12, expected: 12 },
  { event: "tool_call", tool: "bash", commandKind: "fix-ai-slop" },
  { event: "tool_call", tool: "bash", commandKind: "analyze-layout" },
  { event: "tool_call", tool: "bash", commandKind: "npm-run-build" },
  { event: "auto_validation_started" },
  { event: "auto_validation_passed" },
];

test("accepts a trace with prompt, skills, and auto validation", () => {
  const { dir, file } = fixture(validEvents);
  try {
    const result = run(file);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /autoValidation/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("strict mode requires explicit agent validator and build calls", () => {
  const { dir, file } = fixture([
    { event: "prompt_injected" },
    { event: "skills_discovered", count: 12, expected: 12 },
    { event: "auto_validation_started" },
    { event: "auto_validation_passed" },
  ]);
  try {
    const result = run(file, true);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /agent never called fix-ai-slop/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("strict mode accepts validator and build calls", () => {
  const { dir, file } = fixture(validEvents);
  try {
    const result = run(file, true);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

let failed = 0;
for (const { name, fn } of cases) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error.stack || error.message);
  }
}

if (failed > 0) process.exit(1);
console.log(`\n${cases.length} trace audit tests passed`);
