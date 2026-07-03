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
