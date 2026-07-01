#!/usr/bin/env node
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const files = [
  "extension/index.ts",
  "extensions/designer.ts",
];
const cases = [];

function test(name, fn) {
  cases.push({ name, fn });
}

function read(path) {
  return readFileSync(path, "utf-8");
}

for (const file of files) {
  test(`${file} defines all four interaction modes`, () => {
    const content = read(file);
    for (const mode of ["Guided", "Adaptive", "Autonomous", "Batch"]) {
      assert.match(content, new RegExp(`\\| ${mode} \\|`), `${file} missing ${mode} row`);
    }
  });

  test(`${file} makes batch non-blocking`, () => {
    const content = read(file);
    assert.match(content, /Never ask questions in Batch/);
    assert.match(content, /Never wait for "accept" in Batch/);
    assert.match(content, /No approval wait; build after plan|continues immediately without approval wait/);
  });

  test(`${file} keeps autonomous to one emotion question`, () => {
    const content = read(file);
    assert.match(content, /Ask exactly ONE emotion question/);
    assert.match(content, /Awe \/ Trust \/ Excitement \/ Calm \/ Curiosity/);
    assert.match(content, /without a second approval wait/);
  });

  test(`${file} no longer has global wait-for-approval conflict`, () => {
    const content = read(file);
    assert.doesNotMatch(content, /WAIT for approval before building\. Do not build until/);
    assert.doesNotMatch(content, /Otherwise ask 3-5 multiple-choice questions/);
  });
}

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
console.log(`\n${cases.length} prompt contract tests passed`);
