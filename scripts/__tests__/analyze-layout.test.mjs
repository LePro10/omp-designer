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

test("scroll-reveal starting at opacity 0 warns", () => {
  const dir = fixture({
    "index.html": "<html><body><section class=\"reveal\"><h1>Hi</h1></section></body></html>",
    "css/style.css": ".reveal { opacity: 0; transform: translateY(20px); }\n",
    "js/main.js": "const io = new IntersectionObserver(() => {}); io.observe(document.querySelector('.reveal'));\n",
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /reveal-hidden-content/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("violet + cyan on near-black warns as ai-default-palette", () => {
  const dir = fixture({
    "index.html": "<html><body><h1>App</h1></body></html>",
    "css/style.css": "body { background: #0c0a0f; color: #f5f0ff; } .cta { background: #7c5cfc; } .tag { color: #06cddc; }\n",
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /ai-default-palette/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("warm palette without violet/cyan does not trigger ai-default-palette", () => {
  const dir = fixture({
    "index.html": "<html><body><h1>Cafe</h1></body></html>",
    "css/style.css": "body { background: #faf5f0; color: #2c1810; } .cta { background: #8b5e3c; }\n",
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /ai-default-palette/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("many gradients and blurred radial blobs warn", () => {
  const gradients = Array.from({ length: 4 }, (_, index) =>
    `.blob${index} { background: radial-gradient(circle, #fff, #000); filter: blur(40px); border-radius: 50%; }`).join("\n");
  const dir = fixture({
    "index.html": "<html><body><h1>App</h1></body></html>",
    "css/style.css": `${gradients}\n.hero { background: linear-gradient(#111, #222); }\n.card { background: linear-gradient(#333, #444); }\n`,
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /gradient-heavy/);
    assert.match(result.stdout, /gradient-imagery/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("missing title/meta/favicon warns; complete head passes", () => {
  const bare = fixture({
    "index.html": "<html><body><h1>App</h1></body></html>",
  });
  const complete = fixture({
    "index.html": "<html><head><title>App</title><meta name=\"description\" content=\"x\"><link rel=\"icon\" href=\"data:,\"></head><body><h1>App</h1></body></html>",
  });
  try {
    assert.match(run(bare).stdout, /missing-page-details.*page title.*meta description.*favicon/);
    assert.doesNotMatch(run(complete).stdout, /missing-page-details/);
  } finally {
    rmSync(bare, { recursive: true, force: true });
    rmSync(complete, { recursive: true, force: true });
  }
});

test("timid display scale warns; clamp with real scale passes", () => {
  const timid = fixture({
    "index.html": "<html><body><h1>App</h1></body></html>",
    "css/style.css": "h1 { font-size: 2rem; } p { font-size: 1rem; }\n",
  });
  const bold = fixture({
    "index.html": "<html><body><h1>App</h1></body></html>",
    "css/style.css": "h1 { font-size: clamp(2.5rem, 6vw, 5rem); } p { font-size: 1rem; }\n",
  });
  const undeclared = fixture({
    "index.html": "<html><body><h1>App</h1></body></html>",
  });
  try {
    assert.match(run(timid).stdout, /display-scale-timid/);
    assert.doesNotMatch(run(bold).stdout, /display-scale-timid/);
    assert.doesNotMatch(run(undeclared).stdout, /display-scale-timid/);
  } finally {
    rmSync(timid, { recursive: true, force: true });
    rmSync(bold, { recursive: true, force: true });
    rmSync(undeclared, { recursive: true, force: true });
  }
});

test("thin landing pages warn; deep pages pass", () => {
  const thin = fixture({
    "index.html": "<html><body><h1>App</h1><section>a</section><section>b</section></body></html>",
  });
  const deep = fixture({
    "index.html": `<html><body><h1>App</h1>${"<section>x</section>".repeat(6)}</body></html>`,
  });
  try {
    assert.match(run(thin).stdout, /page-depth-thin/);
    assert.doesNotMatch(run(deep).stdout, /page-depth-thin/);
  } finally {
    rmSync(thin, { recursive: true, force: true });
    rmSync(deep, { recursive: true, force: true });
  }
});

test("repeated left-border accent strips warn; a single blockquote does not", () => {
  const strips = fixture({
    "index.html": "<html><body><h1>App</h1></body></html>",
    "css/style.css": ".a{border-left: 4px solid red}.b{border-left: 3px solid blue}.c{border-left: 5px solid teal}\n",
  });
  const quote = fixture({
    "index.html": "<html><body><h1>App</h1></body></html>",
    "css/style.css": "blockquote{border-left: 4px solid #ccc}\n",
  });
  try {
    assert.match(run(strips).stdout, /left-border-accent/);
    assert.doesNotMatch(run(quote).stdout, /left-border-accent/);
  } finally {
    rmSync(strips, { recursive: true, force: true });
    rmSync(quote, { recursive: true, force: true });
  }
});

test("static root css/js files are scanned", () => {
  const dir = fixture({
    "index.html": "<html><body><h1>App</h1></body></html>",
    "css/style.css": "body { color: #123c69; } @media (max-width: 600px) { body { font-size: 14px; } }\n",
  });
  try {
    const result = run(dir, true);
    assert.equal(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.filesScanned, 2, JSON.stringify(report));
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
