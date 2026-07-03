#!/usr/bin/env node
/**
 * Structural and accessibility audit for the two runtime CSV datasets.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
const warnings = [];

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (quoted) {
      if (char === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function auditStructure(name) {
  const path = join(root, "data", "ui-ux-pro-max", name);
  const rows = parseCsv(readFileSync(path, "utf8"));
  const width = rows[0].length;
  const ids = new Set();
  for (const [index, row] of rows.slice(1).entries()) {
    if (row.length !== width) {
      failures.push(`${name}:${index + 2} has ${row.length} columns; expected ${width}`);
    }
    const id = Number(row[0]);
    if (!Number.isInteger(id) || id < 1) failures.push(`${name}:${index + 2} has invalid id ${JSON.stringify(row[0])}`);
    if (ids.has(id)) failures.push(`${name}:${index + 2} duplicates id ${id}`);
    ids.add(id);
  }
  const sorted = [...ids].sort((a, b) => a - b);
  sorted.forEach((id, index) => {
    if (id !== index + 1) failures.push(`${name} is missing id ${index + 1}`);
  });
  return { path, rows, records: rows.length - 1, columns: width };
}

function luminance(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const values = [1, 3, 5]
    .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function contrast(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  if (a == null || b == null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const colorData = auditStructure("colors.csv");
const typographyData = auditStructure("typography.csv");
const header = colorData.rows[0];
const pairs = [
  ["Primary", "On Primary"],
  ["Secondary", "On Secondary"],
  ["Accent", "On Accent"],
  ["Background", "Foreground"],
  ["Card", "Card Foreground"],
  ["Muted", "Muted Foreground"],
  ["Destructive", "On Destructive"],
];

let below45 = 0;
for (const row of colorData.rows.slice(1)) {
  for (const [surface, foreground] of pairs) {
    const first = row[header.indexOf(surface)];
    const second = row[header.indexOf(foreground)];
    const ratio = contrast(first, second);
    if (ratio == null) continue;
    if (ratio < 3) {
      failures.push(
        `colors.csv row ${row[0]} ${surface}/${foreground} is ${ratio.toFixed(2)}:1 (${first}/${second})`,
      );
    } else if (ratio < 4.5) {
      below45 += 1;
    }
  }
}

if (below45 > 0) {
  warnings.push(
    `${below45} palette pairs are between 3:1 and 4.5:1; they require large-text, graphic, or corrected usage.`,
  );
}

console.log(`colors.csv: ${colorData.records} records, ${colorData.columns} columns`);
console.log(`typography.csv: ${typographyData.records} records, ${typographyData.columns} columns`);
for (const warning of warnings) console.log(`WARNING: ${warning}`);
for (const failure of failures) console.error(`FAIL: ${failure}`);

process.exit(failures.length > 0 ? 1 : 0);

