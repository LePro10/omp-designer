#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const script = new URL("../analyze-layout.mjs", import.meta.url).pathname;
const cases = [];

function test(name, fn) {
  cases.push({ name, fn });
}

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "designer-layout-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

function run(dir, json = false) {
  return spawnSync(process.execPath, [script, ...(json ? ["--json"] : []), dir], { encoding: "utf8" });
}

test("small edit without DESIGN.md warns but passes", () => {
  const dir = fixture({ "src/App.tsx": "export default () => <main className=\"md:grid\"><h1>Test</h1></main>;\n" });
  try {
    const result = run(dir);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /design-contract-missing/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("off-contract source color warns but does not block", () => {
  const dir = fixture({
    "DESIGN.md": "## Color\n- Primary #123C69\n",
    "src/App.tsx": "export default () => <main style={{ color: '#8BE9D4' }}><h1>Test</h1></main>;\n",
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /undocumented-source-color/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("animation without reduced motion warns but passes", () => {
  const dir = fixture({
    "DESIGN.md": "## Color\n- Primary #123C69\n",
    "src/App.tsx": "export default () => <motion.main animate={{opacity: 1}}><h1>Test</h1></motion.main>;\n",
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /reduced-motion-missing/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("JSON output has stable counts", () => {
  const dir = fixture({
    "DESIGN.md": "## Color\n- Primary #123C69\n",
    "src/App.tsx": "export default () => <main className=\"md:grid\" style={{color:'#123C69'}}><h1>Test</h1></main>;\n",
  });
  try {
    const result = run(dir, true);
    assert.equal(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.filesScanned, 1);
    assert.equal(report.blockers, 0);
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
console.log(`\n${cases.length} layout tests passed`);
