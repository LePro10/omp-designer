#!/usr/bin/env node
/**
 * audit-trace.mjs - verify designer run JSONL traces.
 *
 * Usage:
 *   node scripts/audit-trace.mjs <trace.jsonl> [--strict]
 *
 * Default checks prove the mechanical gates fired. --strict also requires that
 * the agent itself called build/browser-impeccable-like checks before session end.
 */
import { readFileSync } from "node:fs";

const tracePath = process.argv[2];
const strict = process.argv.includes("--strict");
if (!tracePath || tracePath === "--help" || tracePath === "-h") {
  console.log("Usage: node scripts/audit-trace.mjs <trace.jsonl> [--strict]");
  process.exit(tracePath ? 0 : 1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function loadTrace(path) {
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        fail(`Invalid JSON at ${path}:${index + 1}: ${error.message}`);
      }
    });
}

function hasEvent(events, name) {
  return events.some((event) => event.event === name);
}

function commandKinds(events) {
  return new Set(events.map((event) => event.commandKind).filter(Boolean));
}

const events = loadTrace(tracePath);
const failures = [];
const kinds = commandKinds(events);

for (const required of ["prompt_injected", "auto_validation_started"]) {
  if (!hasEvent(events, required)) failures.push(`missing event: ${required}`);
}

if (!hasEvent(events, "auto_validation_passed") && !hasEvent(events, "auto_validation_failed")) {
  failures.push("missing auto_validation_passed or auto_validation_failed");
}

if (!hasEvent(events, "skills_discovered")) failures.push("missing event: skills_discovered");

if (strict) {
  if (!kinds.has("fix-ai-slop")) failures.push("strict: agent never called fix-ai-slop");
  if (!kinds.has("analyze-layout")) failures.push("strict: agent never called analyze-layout");
  if (!kinds.has("npm-run-build") && !kinds.has("bun-run-build")) failures.push("strict: agent never called a build script");
}

const summary = {
  trace: tracePath,
  events: events.length,
  first: events[0]?.timestamp ?? null,
  last: events.at(-1)?.timestamp ?? null,
  commandKinds: [...kinds].sort(),
  autoValidation: hasEvent(events, "auto_validation_passed") ? "passed" : hasEvent(events, "auto_validation_failed") ? "failed" : "missing",
  strict,
  failures,
};

console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) process.exit(1);
