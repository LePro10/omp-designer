#!/usr/bin/env node
/**
 * security.test.mjs — Tests for secret scanner patterns and trace redaction.
 *
 * Covers:
 *   1. Secret detection regexes from check-release.mjs (detection + no false positives)
 *   2. Trace redaction logic from extension/index.ts (redactSecrets)
 */
import assert from "node:assert/strict";

// ── Test harness (same pattern as sibling test files) ────────────────────

const cases = [];

function test(name, fn) {
  cases.push({ name, fn });
}

// ── Secret scanner patterns (from check-release.mjs) ─────────────────────

const secretPatterns = [
  { label: "npm token", regex: /npm_[A-Za-z0-9]{20,}/g },
  { label: "OpenAI key", regex: /sk-[A-Za-z0-9_-]{20,}/g },
  { label: "GitHub token", regex: /gh[pousr]_[A-Za-z0-9_]{20,}/g },
  { label: "Anthropic key", regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { label: "AWS access key", regex: /AKIA[0-9A-Z]{16}/g },
  { label: "Private key block", regex: /-----BEGIN\s+(RSA|EC|DSA|OPENSSH)\s+PRIVATE\s+KEY-----/g },
  { label: "JWT", regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { label: "Bearer token", regex: /Bearer\s+[A-Za-z0-9_.\-+/=]{20,}/g },
  { label: "Database URI with credentials", regex: /(?:postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@/g },
  { label: "Long hex API key in env field", regex: /["'](?:API_KEY|TOKEN|SECRET|PASSWORD|api_key|token|secret|password)["']\s*[:=]\s*["'][0-9a-fA-F]{32,}["']/g },
];

function detect(label, text) {
  const entry = secretPatterns.find((p) => p.label === label);
  assert.ok(entry, `Unknown pattern label: ${label}`);
  entry.regex.lastIndex = 0;
  return entry.regex.test(text);
}

// ── Redaction patterns (from extension/index.ts SECRET_PATTERNS) ─────────

const REDACT_PATTERNS = [
  /npm_[A-Za-z0-9]{20,}/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  /gh[pousr]_[A-Za-z0-9_]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /Bearer\s+[A-Za-z0-9_.\-+/=]{20,}/g,
];

function redactSecrets(value) {
  if (typeof value === "string") {
    let result = value;
    for (const pattern of REDACT_PATTERNS) {
      pattern.lastIndex = 0;
      result = result.replace(pattern, "[REDACTED]");
    }
    result = result.replace(
      /(?:API_KEY|TOKEN|SECRET|PASSWORD)\s*[:=]\s*["']?([0-9a-fA-F]{32,})["']?/gi,
      (match) => match.replace(/[0-9a-fA-F]{32,}/, "[REDACTED]"),
    );
    return result;
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = redactSecrets(v);
    }
    return result;
  }
  return value;
}

// ═══════════════════════════════════════════════════════════════════════
// 1. Secret scanner — detection
// ═══════════════════════════════════════════════════════════════════════

test("detects npm token", () => {
  assert.ok(detect("npm token", "npm_abc123def456ghi789jkl012mno345"));
});

test("detects OpenAI key", () => {
  assert.ok(detect("OpenAI key", "sk-abcdefghijklmnopqrstuvwxyz"));
});

test("detects GitHub token", () => {
  assert.ok(detect("GitHub token", "ghp_ABCDEFGHIJKLMNOPQRSTuvwxyz0123"));
  assert.ok(detect("GitHub token", "gho_ABCDEFGHIJKLMNOPQRSTuvwxyz0123"));
  assert.ok(detect("GitHub token", "ghs_ABCDEFGHIJKLMNOPQRSTuvwxyz0123"));
});

test("detects Anthropic key", () => {
  assert.ok(detect("Anthropic key", "sk-ant-abcdefghijklmnopqrstuvwxyz0123"));
});

test("detects AWS access key", () => {
  assert.ok(detect("AWS access key", "AKIA1234567890ABCDEF"));
});

test("detects private key block", () => {
  assert.ok(detect("Private key block", "-----BEGIN RSA PRIVATE KEY-----"));
  assert.ok(detect("Private key block", "-----BEGIN EC PRIVATE KEY-----"));
  assert.ok(detect("Private key block", "-----BEGIN OPENSSH PRIVATE KEY-----"));
});

test("detects JWT", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR5U";
  assert.ok(detect("JWT", jwt));
});

test("detects Bearer token", () => {
  assert.ok(detect("Bearer token", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abc"));
});

test("detects database URI with credentials", () => {
  assert.ok(detect("Database URI with credentials", "postgres://admin:supersecret@db.example.com:5432/mydb"));
  assert.ok(detect("Database URI with credentials", "mysql://root:password123@localhost/app"));
  assert.ok(detect("Database URI with credentials", "mongodb://user:pass@cluster.mongodb.net/db"));
  assert.ok(detect("Database URI with credentials", "redis://default:redispass@cache.local:6379"));
});

test("detects long hex API key in env field", () => {
  assert.ok(detect("Long hex API key in env field", '"API_KEY": "abcdef1234567890abcdef1234567890"'));
  assert.ok(detect("Long hex API key in env field", "'token' = 'abcdef1234567890abcdef1234567890'"));
  assert.ok(detect("Long hex API key in env field", '"SECRET":"abcdef1234567890abcdef1234567890"'));
});

// ═══════════════════════════════════════════════════════════════════════
// 1b. Secret scanner — no false positives
// ═══════════════════════════════════════════════════════════════════════

test("does NOT flag placeholder <YOUR_KEY>", () => {
  for (const { label, regex } of secretPatterns) {
    regex.lastIndex = 0;
    assert.ok(!regex.test("<YOUR_KEY>"), `${label} falsely matched <YOUR_KEY>`);
  }
});

test("does NOT flag 16-char hex content hash", () => {
  const hash = "a1b2c3d4e5f67890";
  for (const { label, regex } of secretPatterns) {
    regex.lastIndex = 0;
    assert.ok(!regex.test(hash), `${label} falsely matched 16-char hex hash`);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Trace redaction
// ═══════════════════════════════════════════════════════════════════════

test("redacts npm token in string", () => {
  const result = redactSecrets("token=npm_abc123def456ghi789jkl012mno345");
  assert.ok(!result.includes("npm_abc"), `npm token not redacted: ${result}`);
  assert.ok(result.includes("[REDACTED]"));
});

test("redacts OpenAI key in string", () => {
  const result = redactSecrets("key: sk-abcdefghijklmnopqrstuvwxyz");
  assert.ok(!result.includes("sk-abcdef"), `OpenAI key not redacted: ${result}`);
  assert.ok(result.includes("[REDACTED]"));
});

test("redacts nested object values", () => {
  const input = {
    config: {
      auth: {
        token: "npm_abc123def456ghi789jkl012mno345",
        label: "my-auth",
      },
    },
  };
  const result = redactSecrets(input);
  assert.equal(result.config.auth.label, "my-auth");
  assert.ok(!result.config.auth.token.includes("npm_abc"));
  assert.equal(result.config.auth.token, "[REDACTED]");
});

test("redacts array elements", () => {
  const input = [
    "normal string",
    "secret: ghp_ABCDEFGHIJKLMNOPQRSTuvwxyz0123",
    "another normal",
  ];
  const result = redactSecrets(input);
  assert.equal(result[0], "normal string");
  assert.ok(!result[1].includes("ghp_"));
  assert.ok(result[1].includes("[REDACTED]"));
  assert.equal(result[2], "another normal");
});

test("does NOT alter non-secret strings", () => {
  const input = {
    message: "Hello, world!",
    path: "/usr/local/bin/node",
    version: "1.2.3",
    count: 42,
    flag: true,
    empty: null,
  };
  const result = redactSecrets(input);
  assert.deepEqual(result, input);
});

// ── Runner ───────────────────────────────────────────────────────────────

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
console.log(`\n${cases.length} security tests passed`);
