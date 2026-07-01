#!/usr/bin/env node
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const script = new URL("../analyze-layout.mjs", import.meta.url).pathname;
const cases = [];

function test(name, fn) {
  cases.push({ name, fn });
}

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "analyze-layout-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(full.split("/").slice(0, -1).join("/"), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

function run(dir) {
  return spawnSync(process.execPath, [script, dir], { encoding: "utf-8" });
}

const app = (color) => `export default function App(){return <main style={{color:'${color}'}}><h1 className="text-sm text-base text-lg text-xl">Test</h1></main>}`;

test("allows user-provided brand colors outside CSV", () => {
  const dir = fixture({
    "PRODUCT.md": "Provided facts\n- Source: user Brand colors #123C69 and #E8B04A\n",
    "DESIGN.md": "Palette\n- Brand navy #123C69 (Source: user)\n- Brand gold #E8B04A (Source: user)\n- Surface #ffffff\nMotion\nMOTION_INTENSITY: 3\nEntrance 280ms\nStagger 70ms\n",
    "src/App.tsx": app("#123C69"),
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /allowed non-CSV: #123c69, #e8b04a/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("allows documented derivations from user brand colors", () => {
  const dir = fixture({
    "PRODUCT.md": "Provided facts\n- Source: user Brand color #123C69\n",
    "DESIGN.md": "Palette\n- Brand navy #123C69 (Source: user)\n- Accent mist #8BE9D4 (derived from #123C69 for interactive focus states)\n- Surface #ffffff\nMotion\nMOTION_INTENSITY: 3\nEntrance 280ms\nStagger 70ms\n",
    "src/App.tsx": app("#8BE9D4"),
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("blocks undocumented invented design colors", () => {
  const dir = fixture({
    "DESIGN.md": "Palette\n- Accent #8BE9D4\n- Surface #ffffff\nMotion\nMOTION_INTENSITY: 3\nEntrance 280ms\nStagger 70ms\n",
    "src/App.tsx": app("#8BE9D4"),
  });
  try {
    const result = run(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /not in CSV palette or documented user\/brand derivation/);
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
console.log(`\n${cases.length} layout analyzer tests passed`);
