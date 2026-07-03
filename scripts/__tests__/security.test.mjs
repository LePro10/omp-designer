#!/usr/bin/env node
import assert from "node:assert/strict";
import { findSecrets, redactSecrets } from "../security.mjs";

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

if (failed > 0) process.exit(1);
console.log(`\n${cases.length + 4} security tests passed`);
