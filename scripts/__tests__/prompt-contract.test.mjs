#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const extension = readFileSync("extension/index.ts", "utf8");
const core = readFileSync("skills/designer-master.md", "utf8");
const promptSource = `${extension}\n${core}`;

const checks = [
  ["no mandatory all-MCP research", !/Attempt ALL|attempt all MCP/i.test(promptSource)],
  ["no all-skills-upfront contract", !/read ALL skills|all 12 skills/i.test(promptSource)],
  ["no permanent ordering violation", !/permanent(?:ly)? blocks? the gate/i.test(promptSource)],
  ["immediate-build requests do not force questions", /build immediately[\s\S]*do not ask preference questions/i.test(promptSource)],
  ["approval requests are honored", /asks? for a plan or approval[\s\S]*wait/i.test(promptSource)],
  ["approval phase is read-only", /read-only plan phase[\s\S]*write no project files/i.test(extension)],
  ["artifacts wait for approval", /After approval and before implementation[\s\S]*PRODUCT\.md/i.test(promptSource)],
  ["multi-page scope cannot collapse silently", /multiple pages or routes[\s\S]*never silently collapse/i.test(extension)],
  ["plans map explicit deliverables", /Extract the user's explicit deliverables and map each one/i.test(core)],
  ["delegated direction does not trigger another question", /surprise me[\s\S]*instead of adding another preference question/i.test(core)],
  ["delivery review is deferred", /Do not read the delivery-review skill[\s\S]*plan-only turn/i.test(extension)],
  ["plans do not invent forms", /Do not plan a signup\/contact form unless a real destination exists/i.test(extension)],
  ["simulated AI is labelled", /simulated AI[\s\S]*visible demo/i.test(extension)],
  ["educational claims require sources", /educational claims[\s\S]*source verification/i.test(extension)],
  ["motion has a site-wide budget", /one primary scroll-driven narrative for the site/i.test(extension)],
  ["plan-only stop has deterministic checks", /plan_checks_failed[\s\S]*Rewrite only the approval plan/i.test(extension)],
  ["process evidence must be literal", /Never claim a skill, reference, CSV row, browser, or test was read or run unless that action actually occurred/i.test(extension)],
  ["plan tokens remain provisional", /exact palette, typography, performance, and accessibility assertions as provisional until checked/i.test(extension)],
  ["small edits stay proportional", /small edit[\s\S]*do not create\s+process documents/i.test(core)],
  ["MCP use is optional", /MCP research is optional/i.test(extension)],
  ["product facts are closed", /closed fact set/i.test(promptSource)],
  ["repeated card grids are reviewed", /two sections both resolve to equal card grids/i.test(promptSource)],
  ["motion is not a default dependency", /Do not install a motion library only to fade sections/i.test(promptSource)],
  ["fake signup success is prohibited", /Do not simulate signup or contact success without a real delivery mechanism/i.test(promptSource)],
];

let failed = 0;
for (const [name, pass] of checks) {
  if (pass) console.log(`ok - ${name}`);
  else {
    failed += 1;
    console.error(`not ok - ${name}`);
  }
}

assert.equal(failed, 0);
console.log(`\n${checks.length} prompt contract tests passed`);
