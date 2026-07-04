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
  ["art direction requires a product-specific anchor", /distinctive anchor that carries the page/i.test(extension)],
  ["default AI palette is a named failure pattern", /violet\/purple primary \+ cyan accent on near-black/i.test(extension)],
  ["gradient wallpaper hero is a named failure pattern", /gradient or glow wallpaper hero/i.test(extension)],
  ["gradient blobs cannot stand in for imagery", /standing in for product imagery/i.test(extension)],
  ["content must be visible at initial paint", /visible at initial paint/i.test(promptSource)],
  ["blank screenshot bands are a delivery failure", /blank regions in a full-page screenshot are a delivery failure/i.test(extension)],
  ["screenshots must actually be reviewed", /open the saved full-page screenshots and look at them/i.test(extension)],
  ["style-of requests extract principles, not pixels", /in the style of X" is a brief about X's principles, not its pixels/i.test(extension)],
  ["named-reference protocol with working profiles exists", /Requests in the style of a named site[\s\S]*Apple:[\s\S]*Linear:[\s\S]*Stripe:/.test(core)],
  ["human taste marks include a single rule-break", /One deliberate rule-break\W+Exactly one memorable move/i.test(core)],
  ["finishing details are named", /title, meta description, favicon[\s\S]*::selection/i.test(core)],
  ["copy discipline bans Get Started buttons", /Buttons name their object/i.test(core)],
  ["landing pages default to the full question chain", /question chain[\s\S]*fuller story[\s\S]*Never pad/i.test(extension)],
  ["expression skill is registered and referenced", /expression\.md[\s\S]*signature moment/i.test(extension) && /"expression"/.test(extension)],
  ["checks never police boldness", /only police honesty and function — never boldness/i.test(extension)],
  ["ambition dials exist with a bold default", /VARIANCE[\s\S]*MOTION[\s\S]*DENSITY[\s\S]*Bold is the default for marketing pages/i.test(readFileSync("skills/expression.md", "utf8"))],
  ["photography is downloaded and sourced, never hotlinked", /free-license photography[\s\S]*never hotlinked/i.test(extension) && /record each file's source URL and license/i.test(core)],
  ["direction is derived, not defaulted", /light is the default for most consumer[\s\S]*dark must be earned/i.test(core)],
  ["three candidate directions are considered", /one safe, one bold, one unexpected/i.test(core)],
  ["hardware gets a physical render option", /Physical product render/i.test(core)],
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
