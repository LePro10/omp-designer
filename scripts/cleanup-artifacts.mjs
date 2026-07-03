#!/usr/bin/env node
/**
 * Safe cleanup for locally generated, gitignored artifacts.
 *
 * Dry-run by default: it only lists what it would remove. Pass --apply to
 * delete. It never touches files outside the repository root, never removes
 * source, docs, skills, shared modules, or `.env*`, and by default retains
 * release evidence (test-output/reports and test-output/e2e-canary).
 *
 * Usage:
 *   node scripts/cleanup-artifacts.mjs [--apply] [--include-evidence] [--root <dir>]
 *
 * Targets (all gitignored generated output):
 *   test-output/<run dirs>       generated eval projects
 *   *.png, *.webp                root-level screenshots
 *   omp-session-*.html           captured session dumps
 */
import { existsSync, readdirSync, statSync, rmSync, realpathSync } from "node:fs";
import { join, resolve, basename } from "node:path";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const includeEvidence = args.includes("--include-evidence");
const rootArg = args.indexOf("--root");
const root = realpathSync(resolve(rootArg >= 0 ? args[rootArg + 1] : process.cwd()));

// Retained inside test-output unless --include-evidence: machine-readable
// comparison reports and the e2e canary are the reproducible release evidence.
const EVIDENCE_DIRS = new Set(["reports", "e2e-canary"]);

// Never removed, even if matched by a pattern.
const PROTECTED = new Set([".env", ".env.example", ".git", ".gitignore"]);

function dirSize(path) {
  let total = 0;
  const stack = [path];
  while (stack.length) {
    const current = stack.pop();
    let stat;
    try {
      stat = statSync(current);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) stack.push(join(current, entry));
    } else {
      total += stat.size;
    }
  }
  return total;
}

// Guard: a target must resolve to a path strictly inside the repo root.
function insideRoot(path) {
  try {
    const real = realpathSync(path);
    return real === root ? false : real.startsWith(`${root}/`);
  } catch {
    return false;
  }
}

const targets = [];

const testOutput = join(root, "test-output");
if (existsSync(testOutput)) {
  for (const entry of readdirSync(testOutput)) {
    if (!includeEvidence && EVIDENCE_DIRS.has(entry)) continue;
    targets.push(join(testOutput, entry));
  }
}

for (const entry of readdirSync(root)) {
  if (PROTECTED.has(entry)) continue;
  if (/\.(?:png|webp)$/i.test(entry) || /^omp-session-.*\.html$/i.test(entry)) {
    targets.push(join(root, entry));
  }
}

const safeTargets = targets.filter((path) => insideRoot(path) && !PROTECTED.has(basename(path)));

let totalBytes = 0;
const rows = [];
for (const path of safeTargets) {
  const bytes = dirSize(path);
  totalBytes += bytes;
  rows.push({ path: path.slice(root.length + 1), bytes });
}

const mib = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;

if (rows.length === 0) {
  console.log("No generated artifacts to clean.");
} else {
  console.log(`${apply ? "Removing" : "Would remove"} ${rows.length} generated artifact(s), ${mib(totalBytes)} total:`);
  for (const { path, bytes } of rows.sort((a, b) => b.bytes - a.bytes)) {
    console.log(`  ${apply ? "removed" : "-"} ${path} (${mib(bytes)})`);
  }
  if (!includeEvidence) {
    console.log("\nRetained release evidence: test-output/reports, test-output/e2e-canary (use --include-evidence to remove).");
  }
  if (apply) {
    for (const path of safeTargets) rmSync(path, { recursive: true, force: true });
    console.log(`\nRemoved ${rows.length} artifact(s).`);
  } else {
    console.log("\nDry run. Re-run with --apply to delete.");
  }
}

// Machine-readable summary for scripting.
if (args.includes("--json")) {
  console.log(JSON.stringify({ apply, root, reclaimableBytes: totalBytes, targets: rows }, null, 2));
}
