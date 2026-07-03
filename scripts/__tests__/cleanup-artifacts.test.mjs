#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const script = new URL("../cleanup-artifacts.mjs", import.meta.url).pathname;

function makeRepo() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cleanup-root-")));
  mkdirSync(join(root, "test-output", "run1"), { recursive: true });
  writeFileSync(join(root, "test-output", "run1", "index.html"), "<h1>x</h1>");
  mkdirSync(join(root, "test-output", "reports"), { recursive: true });
  writeFileSync(join(root, "test-output", "reports", "run1.json"), "{}");
  mkdirSync(join(root, "test-output", "e2e-canary"), { recursive: true });
  writeFileSync(join(root, "test-output", "e2e-canary", "note.txt"), "canary");
  writeFileSync(join(root, "screenshot-home.png"), "png");
  writeFileSync(join(root, "omp-session-abc.html"), "session");
  writeFileSync(join(root, ".env"), "OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>");
  return root;
}

const run = (root, ...flags) =>
  spawnSync(process.execPath, [script, "--root", root, ...flags], { encoding: "utf8" });

let failed = 0;
const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error.stack || error.message);
  }
};

test("dry run lists generated artifacts and removes nothing", () => {
  const root = makeRepo();
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Would remove/);
    assert.match(result.stdout, /test-output\/run1/);
    assert.match(result.stdout, /screenshot-home\.png/);
    assert.match(result.stdout, /omp-session-abc\.html/);
    // Nothing deleted on a dry run.
    assert.ok(existsSync(join(root, "test-output", "run1")));
    assert.ok(existsSync(join(root, "screenshot-home.png")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("apply removes generated artifacts but retains evidence and .env", () => {
  const root = makeRepo();
  try {
    const result = run(root, "--apply");
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(!existsSync(join(root, "test-output", "run1")), "run1 should be removed");
    assert.ok(!existsSync(join(root, "screenshot-home.png")), "screenshot should be removed");
    assert.ok(!existsSync(join(root, "omp-session-abc.html")), "session dump should be removed");
    // Retained release evidence and secrets.
    assert.ok(existsSync(join(root, "test-output", "reports")), "reports must be retained");
    assert.ok(existsSync(join(root, "test-output", "e2e-canary")), "canary must be retained");
    assert.ok(existsSync(join(root, ".env")), ".env must never be removed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("--include-evidence also removes reports and canary", () => {
  const root = makeRepo();
  try {
    run(root, "--apply", "--include-evidence");
    assert.ok(!existsSync(join(root, "test-output", "reports")), "reports removed with --include-evidence");
    assert.ok(!existsSync(join(root, "test-output", "e2e-canary")), "canary removed with --include-evidence");
    assert.ok(existsSync(join(root, ".env")), ".env still retained");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

if (failed > 0) process.exit(1);
console.log("\n3 cleanup-artifacts tests passed");
