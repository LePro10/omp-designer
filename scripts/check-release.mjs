#!/usr/bin/env node
/**
 * check-release.mjs - release consistency and secret hygiene gate.
 *
 * Fails before npm publish if package/docs disagree on version or if package
 * files contain likely auth tokens. Keep this read-only and deterministic.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
const version = String(pkg.version);
const majorMinor = version.split(".").slice(0, 2).join(".");
const failures = [];

function read(path) {
  return readFileSync(join(root, path), "utf-8");
}

function requireIncludes(path, text, label) {
  const content = read(path);
  if (!content.includes(text)) failures.push(`${label}: ${path} must include ${text}`);
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (["node_modules", "dist", ".git", "test-output", "pi-backup (old)", ".next", "coverage"].includes(entry)) continue;
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

const secretPatterns = [
  { label: "npm token", regex: /npm_[A-Za-z0-9]{20,}/g },
  { label: "OpenAI key", regex: /sk-[A-Za-z0-9_-]{20,}/g },
  { label: "GitHub token", regex: /gh[pousr]_[A-Za-z0-9_]{20,}/g },
  { label: "Anthropic key", regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
];

const textExtensions = new Set([".md", ".ts", ".tsx", ".js", ".mjs", ".json", ".yml", ".yaml", ".txt", ".csv"]);

function scanSecrets() {
  for (const file of walk(root)) {
    if (!textExtensions.has(extname(file))) continue;
    const content = readFileSync(file, "utf-8");
    for (const { label, regex } of secretPatterns) {
      for (const match of content.matchAll(regex)) {
        const rel = file.slice(root.length + 1);
        const line = content.slice(0, match.index ?? 0).split("\n").length;
        failures.push(`${label}: ${rel}:${line} contains a likely secret`);
      }
    }
  }
}

if (!/^\d+\.\d+\.\d+$/.test(version)) failures.push(`package.json version must be semver, got ${version}`);
if (pkg.description?.includes("9 skills")) failures.push("package.json description still says 9 skills");

requireIncludes("README.md", `v${majorMinor}`, "README version");
requireIncludes("docs/problems.md", `v${majorMinor}`, "problems.md version");
requireIncludes("AGENTS.md", "12 design skills", "AGENTS skill count");

if (!existsSync(join(root, "skills", "ai-slop.md"))) failures.push("skills/ai-slop.md missing");
if (!existsSync(join(root, "scripts", "fix-ai-slop.mjs"))) failures.push("scripts/fix-ai-slop.mjs missing");
if (!existsSync(join(root, "scripts", "analyze-layout.mjs"))) failures.push("scripts/analyze-layout.mjs missing");

scanSecrets();

if (failures.length > 0) {
  console.error("Release check failed:\n");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Release check passed for omp-designer@${version}`);
