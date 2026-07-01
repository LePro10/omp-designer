#!/usr/bin/env node
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const script = new URL("../fix-ai-slop.mjs", import.meta.url).pathname;
const cases = [];

function test(name, fn) {
  cases.push({ name, fn });
}

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "fix-ai-slop-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(full.split("/").slice(0, -1).join("/"), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf-8" });
}

test("check mode reports em-dashes without mutating files", () => {
  const dir = fixture({ "src/App.tsx": "export const copy = 'Quiet — focused';\n" });
  try {
    const result = run(["--check", dir]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /em-dash/);
    assert.equal(readFileSync(join(dir, "src/App.tsx"), "utf-8"), "export const copy = 'Quiet — focused';\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fix mode rewrites em-dashes deterministically", () => {
  const dir = fixture({ "src/App.tsx": "export const copy = 'Quiet — focused';\n" });
  try {
    const result = run(["--fix", dir]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(readFileSync(join(dir, "src/App.tsx"), "utf-8"), "export const copy = 'Quiet, focused';\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("compound fonts do not trigger overused root-font bans", () => {
  const dir = fixture({ "src/style.css": ".code { font-family: 'Roboto Mono', monospace; }\n" });
  try {
    const result = run(["--check", dir]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("avoidance documentation can mention banned buzzwords", () => {
  const dir = fixture({ "DESIGN.md": "Avoid: unlock, seamless, innovative, curated.\n" });
  try {
    const result = run(["--check", dir]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("spaced multipliers are still fake precision", () => {
  const dir = fixture({ "src/App.tsx": "export const claim = 'Teams move 12 x faster here.';\n" });
  try {
    const result = run(["--check", dir]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /fake-number:multiplier/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("EVIDENCE.md may document forbidden commerce claims", () => {
  const dir = fixture({
    "EVIDENCE.md": "| Claim | Source | Confidence | Allowed wording |\n| returns | missing | 0 | MUST NOT USE |\n"
  });
  try {
    const result = run(["--check", dir]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("confidence-zero evidence claims fail when used in source", () => {
  const dir = fixture({
    "EVIDENCE.md": "| Claim | Source | Confidence | Allowed wording |\n| FedEx | missing | 0 | MUST NOT USE |\n",
    "src/App.tsx": "export const shipping = 'Ships with FedEx tracking.';\n"
  });
  try {
    const result = run(["--check", dir]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /evidence:unsupported-claim/);
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
console.log(`\n${cases.length} validator regression tests passed`);
