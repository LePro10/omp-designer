#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const script = new URL("../fix-ai-slop.mjs", import.meta.url).pathname;
const cases = [];

function test(name, fn) {
  cases.push({ name, fn });
}

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "designer-copy-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

function run(dir, env = {}) {
  return spawnSync(process.execPath, [script, "--check", dir], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

test("dash is a warning and does not block or mutate", () => {
  const original = "export const copy = 'Quiet — focused work.';\n";
  const dir = fixture({ "src/App.tsx": original });
  try {
    const result = run(dir);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /copy-cadence/);
    assert.equal(readFileSync(join(dir, "src/App.tsx"), "utf8"), original);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CSS and class percentages are not treated as claims", () => {
  const dir = fixture({
    "src/App.tsx": "export default () => <div className=\"w-[80%] translate-x-[50%]\">Hello there</div>;\n",
    "src/style.css": ".meter { width: 80%; transform: translateX(50%); }\n",
  });
  try {
    assert.equal(run(dir).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unsupported visible percentage blocks", () => {
  const dir = fixture({ "src/App.tsx": "export default () => <p>Teams finish projects 47% faster.</p>;\n" });
  try {
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /unsupported-percentage/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("spelled-out performance time blocks", () => {
  const dir = fixture({
    "src/App.tsx": "export default () => <h2>Three minutes per site visit</h2>;\n",
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /unsupported-count/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unsupported audience range blocks", () => {
  const dir = fixture({
    "src/App.tsx": "export default () => <p>Built for 2 to 20 people in the field.</p>;\n",
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /unsupported-count/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("user-sourced visible percentage passes", () => {
  const dir = fixture({
    "PRODUCT.md": "- Source: user — measured result is 47% faster.\n",
    "src/App.tsx": "export default () => <p>Measured result: 47% faster.</p>;\n",
  });
  try {
    assert.equal(run(dir).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("blocked evidence does not authorize a claim", () => {
test("trusted user facts override a model-authored ledger", () => {
  const dir = fixture({
    "PRODUCT.md": "- Source: user — measured result is 47% faster.\n",
    "src/App.tsx": "export default () => <p>Measured result: 47% faster.</p>;\n",
  });
  try {
    const result = run(dir, { DESIGNER_USER_FACTS: "Build a project without invented metrics." });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /unsupported-percentage/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("trusted user facts can authorize an exact claim", () => {
  const dir = fixture({
    "src/App.tsx": "export default () => <p>Measured result: 47% faster.</p>;\n",
  });
  try {
    const result = run(dir, { DESIGNER_USER_FACTS: "The measured result is 47% faster." });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

  const dir = fixture({
    "EVIDENCE.md": "| 47% faster | none | blocked | omit |\n",
    "src/App.tsx": "export default () => <p>Work gets 47% faster.</p>;\n",
  });
  try {
    assert.equal(run(dir).status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unsupported social proof blocks", () => {
  const dir = fixture({ "src/App.tsx": "export default () => <p>Trusted by product teams.</p>;\n" });
  try {
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /unsupported-social-proof/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unsupported co-design social proof blocks", () => {
  const dir = fixture({
    "src/App.tsx": "export default () => <p>Built with input from real field teams.</p>;\n",
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /unsupported-social-proof/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unsupported commerce promise blocks", () => {
  const dir = fixture({ "src/App.tsx": "export default () => <p>Free shipping on every order.</p>;\n" });
  try {
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /unsupported-commerce-claim/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unsupported free-access promise blocks", () => {
  const dir = fixture({
    "src/App.tsx": "export default () => <p>Free during early access. No credit card needed.</p>;\n",
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /unsupported-commerce-claim/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unsupported release status blocks", () => {
  const dir = fixture({
    "src/App.tsx": "export default () => <><button>Get early access</button><p>You're on the list</p></>;\n",
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /unsupported-release-status/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("inferred capability is a review warning", () => {
  const dir = fixture({
    "src/App.tsx": "export default () => <p>Your notes sync automatically when you are back online.</p>;\n",
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /unsupported-capability-signal/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("placeholder primary action blocks", () => {
  const dir = fixture({
    "src/App.tsx": "export default () => <a href=\"#\">Join the waitlist</a>;\n",
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /nonfunctional-action/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("local-only email signup blocks", () => {
  const dir = fixture({
    "src/App.tsx": "export default () => <form onSubmit={e => e.preventDefault()}><input type=\"email\" /><button>Stay updated</button><p>We will be in touch.</p></form>;\n",
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /nonfunctional-signup/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("relative fetch without a server route still blocks", () => {
  const dir = fixture({
    "src/App.tsx": "export default () => <form onSubmit={() => fetch('/api/waitlist')}><input type=\"email\" /><p>We will be in touch.</p></form>;\n",
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /nonfunctional-signup/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("email form with a delivery action passes the behavior check", () => {
  const dir = fixture({
    "src/App.tsx": "export default () => <form action=\"/subscribe\"><input type=\"email\" /><button>Stay updated</button><p>We will be in touch.</p></form>;\n",
  });
  try {
    assert.equal(run(dir).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("logo hash link remains allowed", () => {
  const dir = fixture({
    "src/App.tsx": "export default () => <a href=\"#\">Fieldnote</a>;\n",
  });
  try {
    assert.equal(run(dir).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("comments are ignored", () => {
  const dir = fixture({
    "src/App.tsx": "// TODO remove the fake 99% claim\nexport default () => <p>Clear project status.</p>;\n",
  });
  try {
    assert.equal(run(dir).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("apostrophes in JSX text do not create cross-component candidates", () => {
  const dir = fixture({
    "src/App.tsx": "export default () => <><p>It isn't a claim.</p><div className=\"w-[47%]\">Layout</div><p>It's practical.</p></>;\n",
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("remote placeholder asset is warning only", () => {
  const dir = fixture({
    "src/App.tsx": "export default () => <img src=\"https://picsum.photos/800/600\" alt=\"Workshop\" />;\n",
  });
  try {
    const result = run(dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /remote-placeholder-asset/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stat tokens behind object keys block without a source", () => {
  const dir = fixture({
    "src/stats.js": "export const stats = [{ value: \"10x\", label: \"Faster Output\" }, { value: \"98%\", label: \"Task Accuracy\" }, { value: \"50k+\", label: \"Active Users\" }];\n",
  });
  try {
    const result = run(dir, { DESIGNER_USER_FACTS: "make a stunning website for an AI product" });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /unsupported-multiplier.*"10x"/);
    assert.match(result.stdout, /unsupported-percentage.*"98%"/);
    assert.match(result.stdout, /unsupported-count.*"50k\+"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("k+ audience counts in text nodes block", () => {
  const dir = fixture({
    "index.html": "<html><body><p>Join 50k+ active users today.</p></body></html>",
  });
  try {
    const result = run(dir, { DESIGNER_USER_FACTS: "build a site" });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /unsupported-count/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("split stat tiles warn, step markers do not", () => {
  const dir = fixture({
    "index.html": [
      "<html><body>",
      "<div class=\"stat\"><span>12</span><span>Farm partners</span></div>",
      "<div class=\"step\"><span>01</span><span>Sourcing</span></div>",
      "<div class=\"step\"><span>4</span><span>Origins</span></div>",
      "</body></html>",
    ].join("\n"),
  });
  try {
    const result = run(dir, { DESIGNER_USER_FACTS: "make a site for my coffee brand" });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /stat-tile-claim.*12 Farm partners/);
    assert.doesNotMatch(result.stdout, /stat-tile-claim.*01/);
    assert.doesNotMatch(result.stdout, /stat-tile-claim.*4 Origins/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("invented phone and email warn; supplied and placeholder ones pass", () => {
  const dir = fixture({
    "index.html": [
      "<html><body>",
      "<p>Call us on +44 20 7491 1600 or write to studio@grainandbeam.com.</p>",
      "<p>Support: help@example.com</p>",
      "<svg viewBox=\"0 0 1600 900\"><polygon points=\"10 20 30 40 50 60\"/></svg>",
      "</body></html>",
    ].join("\n"),
  });
  try {
    const unsourced = run(dir, { DESIGNER_USER_FACTS: "surprise me with a website for a furniture studio" });
    assert.equal(unsourced.status, 0, unsourced.stdout + unsourced.stderr);
    assert.match(unsourced.stdout, /contact-details-unverified.*\+44 20 7491 1600/);
    assert.match(unsourced.stdout, /contact-details-unverified.*studio@grainandbeam\.com/);
    assert.doesNotMatch(unsourced.stdout, /contact-details-unverified.*example\.com/);
    assert.doesNotMatch(unsourced.stdout, /contact-details-unverified.*10 20 30/);

    const sourced = run(dir, { DESIGNER_USER_FACTS: "my studio: phone +44 20 7491 1600, mail studio@grainandbeam.com" });
    assert.doesNotMatch(sourced.stdout, /contact-details-unverified/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CJK leakage inside Latin copy blocks; a genuinely non-Latin page passes", () => {
  const glitch = fixture({
    "index.html": "<html><body><p>No synthetic fragrance, no不必要的 extras, just honest skincare.</p></body></html>",
  });
  const chinese = fixture({
    "index.html": "<html><body><p>纯净配方，不含香精，成分透明。</p></body></html>",
  });
  try {
    const bad = run(glitch, { DESIGNER_USER_FACTS: "build a site" });
    assert.equal(bad.status, 1, bad.stdout + bad.stderr);
    assert.match(bad.stdout, /mixed-script-copy/);

    const ok = run(chinese, { DESIGNER_USER_FACTS: "build a site" });
    assert.doesNotMatch(ok.stdout, /mixed-script-copy/);
  } finally {
    rmSync(glitch, { recursive: true, force: true });
    rmSync(chinese, { recursive: true, force: true });
  }
});

test("emoji icon systems warn; a single accent emoji passes", () => {
  const system = fixture({
    "index.html": "<html><body><p>🚀 Fast</p><p>🔒 Secure</p><p>⚡ Powerful</p></body></html>",
  });
  const accent = fixture({
    "index.html": "<html><body><p>Fresh croissants every morning 🥐</p></body></html>",
  });
  try {
    assert.match(run(system, { DESIGNER_USER_FACTS: "x" }).stdout, /emoji-as-interface/);
    assert.doesNotMatch(run(accent, { DESIGNER_USER_FACTS: "x" }).stdout, /emoji-as-interface/);
  } finally {
    rmSync(system, { recursive: true, force: true });
    rmSync(accent, { recursive: true, force: true });
  }
});

test("CSS-in-JS transform percentages do not become claims", () => {
  const dir = fixture({
    "src/anim.js": "el.style.transform = \"translate(-50%, -50%)\"; el.style.width = \"100%\";\n",
  });
  try {
    const result = run(dir, { DESIGNER_USER_FACTS: "build a site" });
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
console.log(`\n${cases.length} copy/evidence tests passed`);
