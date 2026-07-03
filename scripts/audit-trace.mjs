#!/usr/bin/env node
/**
 * Audit v5 designer JSONL traces for duplicate loading and delivery outcomes.
 */

import { readFileSync } from "node:fs";

const path = process.argv[2];
const strict = process.argv.includes("--strict");
const plan = process.argv.includes("--plan");
if (!path || path === "--help" || path === "-h") {
  console.log("Usage: node scripts/audit-trace.mjs <trace.jsonl> [--strict] [--plan]");
  process.exit(path ? 0 : 2);
}

let events;
try {
  events = readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSON at line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

const failures = [];
const warnings = [];
const counts = {};
for (const event of events) counts[event.event] = (counts[event.event] ?? 0) + 1;

const duplicateEvents = [];
for (let index = 1; index < events.length; index += 1) {
  const previous = events[index - 1];
  const current = events[index];
  if (
    previous.event === current.event &&
    previous.timestamp === current.timestamp &&
    previous.cwd === current.cwd
  ) {
    duplicateEvents.push(index + 1);
  }
}

if (duplicateEvents.length > 0) {
  failures.push(`probable duplicate extension load at ${duplicateEvents.length} adjacent events`);
}
if (!counts.prompt_injected) failures.push("missing prompt_injected");
const passedEvent = plan ? "plan_checks_passed" : "delivery_checks_passed";
const failedEvent = plan ? "plan_checks_failed" : "delivery_checks_failed";
if (!counts[passedEvent] && !counts[failedEvent]) {
  failures.push(`missing ${plan ? "plan" : "delivery"} check outcome`);
}
if (counts.skill_gate_blocked || counts.session_stop_gate_not_ready) {
  failures.push("legacy skill-gate events are present");
}
if ((counts[failedEvent] ?? 0) > 2) {
  failures.push(`more than two ${plan ? "plan" : "delivery"} failures indicate a continuation loop`);
}
if (strict && !counts[passedEvent]) failures.push(`strict: ${plan ? "plan" : "delivery"} checks never passed`);
if (!strict && !counts[passedEvent]) warnings.push(`${plan ? "plan" : "delivery"} checks did not pass`);

const report = {
  trace: path,
  events: events.length,
  first: events[0]?.timestamp ?? null,
  last: events.at(-1)?.timestamp ?? null,
  counts,
  duplicateEvents,
  strict,
  plan,
  failures,
  warnings,
};

console.log(JSON.stringify(report, null, 2));
process.exit(failures.length > 0 ? 1 : 0);
