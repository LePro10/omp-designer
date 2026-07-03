#!/usr/bin/env node
// secret-scan-allow-file: this file intentionally contains fake secret fixtures
// used to test the scanner itself. The repo-wide scanTree skips it by this marker.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findSecrets, redactSecrets, scanTree } from "../../shared/security.mjs";

const cases = [
  ["npm token", "npm_abc123def456ghi789jkl012mno345"],
  ["OpenAI key", "sk-abcdefghijklmnopqrstuvwxyz"],
  ["Anthropic key", "sk-ant-abcdefghijklmnopqrstuvwxyz0123"],
  ["GitHub token", "ghp_ABCDEFGHIJKLMNOPQRSTuvwxyz0123"],
  ["AWS key", "AKIA1234567890ABCDEF"],
  ["private key", "-----BEGIN OPENSSH PRIVATE KEY-----"],
  ["JWT", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturevalue123456"],
  ["database credentials", "postgres://admin:secret@db.example.com/app"],
];

let failed = 0;
for (const [name, value] of cases) {
  try {
    const findings = findSecrets(`prefix ${value} suffix`);
    assert.ok(findings.length > 0, `${name} was not detected`);
    const redacted = redactSecrets(`prefix ${value} suffix`);
    assert.ok(!redacted.includes(value), `${name} was not redacted`);
    console.log(`ok - detects and redacts ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error.stack || error.message);
  }
}

for (const safe of ["<YOUR_KEY>", "a1b2c3d4e5f67890", "sk-short-placeholder", "https://example.com"]) {
  try {
    assert.deepEqual(findSecrets(safe), []);
    console.log(`ok - ignores ${safe}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ignores ${safe}`);
  }
}

// Repo-wide scan: a planted canary in a dotfile must surface; placeholders and
// skipped directories must not. Proves the working-tree scan covers dotfiles.
const dir = mkdtempSync(join(tmpdir(), "sec-scan-"));
try {
  writeFileSync(join(dir, ".env"), "OPENAI_API_KEY=sk-canary1234567890abcdefghijklmnop\n");
  writeFileSync(join(dir, ".env.example"), "OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>\n");
  writeFileSync(join(dir, "README.md"), "no secrets here\n");
  mkdirSync(join(dir, "node_modules"));
  writeFileSync(join(dir, "node_modules", "leak.js"), "const k = 'sk-shouldbeignored1234567890abcd';\n");

  const findings = await scanTree(dir);
  const files = findings.map((f) => f.file);
  assert.ok(files.includes(".env"), "planted canary in .env dotfile was not found");
  assert.ok(!files.includes(".env.example"), ".env.example placeholder must not be flagged");
  assert.ok(!files.some((f) => f.includes("node_modules")), "node_modules must be skipped");
  console.log("ok - scanTree finds dotfile canary, ignores placeholders and node_modules");
} catch (error) {
  failed += 1;
  console.error("not ok - scanTree working-tree scan");
  console.error(error.stack || error.message);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed > 0) process.exit(1);
console.log(`\n${cases.length + 4} unit checks + scan test passed`);
