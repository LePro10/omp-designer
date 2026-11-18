#!/usr/bin/env node
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { chooseBuildScript, resolveScriptRuntime } from "../../shared/delivery-runtime.mjs";

const dirs = [];
function binDir(...names) {
  const dir = mkdtempSync(join(tmpdir(), "omp-designer-runtime-"));
  dirs.push(dir);
  for (const name of names) {
    writeFileSync(join(dir, name), "");
    chmodSync(join(dir, name), 0o755);
  }
  return dir;
}

const env = {};
const cases = [
  ["keeps node/bun execPath", () => {
    assert.equal(resolveScriptRuntime("/usr/bin/node", "", "linux"), "/usr/bin/node");
    assert.equal(resolveScriptRuntime("/home/u/.bun/bin/bun", "", "linux"), "/home/u/.bun/bin/bun");
  }],
  ["replaces the omp CLI with node from PATH", () => {
    const empty = binDir();
    const tools = binDir("node", "bun");
    assert.equal(resolveScriptRuntime("/home/u/.bun/bin/omp", [empty, tools].join(delimiter), "linux"), join(tools, "node"));
  }],
  ["falls back to bun, then null", () => {
    const onlyBun = binDir("bun");
    assert.equal(resolveScriptRuntime("/x/dist/cli.js", onlyBun, "linux"), join(onlyBun, "bun"));
    assert.equal(resolveScriptRuntime("/x/dist/cli.js", binDir(), "linux"), null);
  }],
  ["runs a local-only build", () => {
    assert.deepEqual(chooseBuildScript({ build: "tsc && vite build" }, env), { script: "build" });
  }],
  ["skips a build that deploys", () => {
    const choice = chooseBuildScript({ build: "npx convex deploy --cmd 'next build'" }, env);
    assert.equal(choice.script, undefined);
    assert.match(choice.skipped, /"build" looks like it ships \(matched "convex"\).*designer:build/);
  }],
  ["skips when a pre/post hook or nested script ships", () => {
    assert.ok(chooseBuildScript({ build: "vite build", postbuild: "wrangler pages deploy dist" }, env).skipped);
    assert.ok(chooseBuildScript({ build: "npm run build:prod", "build:prod": "vite build && firebase deploy" }, env).skipped);
    assert.ok(chooseBuildScript({ build: "yarn ship", ship: "npm publish" }, env).skipped);
  }],
  ["ignores self-referencing scripts without looping", () => {
    assert.deepEqual(chooseBuildScript({ build: "npm run build" }, env), { script: "build" });
  }],
  ["prefers designer:build over a shipping build", () => {
    assert.deepEqual(
      chooseBuildScript({ build: "npx convex deploy --cmd 'next build'", "designer:build": "next build" }, env),
      { script: "designer:build" },
    );
  }],
  ["honours OMP_DESIGNER_BUILD=0 and missing scripts", () => {
    assert.match(chooseBuildScript({ build: "vite build" }, { OMP_DESIGNER_BUILD: "0" }).skipped, /OMP_DESIGNER_BUILD=0/);
    assert.equal(chooseBuildScript({}, env).skipped, "no build script");
  }],
];

let failed = 0;
for (const [name, run] of cases) {
  try {
    run();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}\n${error instanceof Error ? error.message : String(error)}`);
  }
}
for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
if (failed > 0) process.exit(1);
