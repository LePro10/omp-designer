#!/usr/bin/env node
/**
 * Proportional visual-system source audit.
 *
 * This script reports observable source risks. It does not pretend to replace
 * browser, screenshot, contrast-at-use, or interaction testing.
 *
 * Exit 1: objective blocker (currently invalid selected palette contrast < 3:1)
 * Exit 0: clean or warnings only
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const project = args.find((arg) => !arg.startsWith("--")) ?? ".";
const SOURCE_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js", ".css", ".html", ".vue", ".svelte"]);
const SOURCE_DIRS = ["src", "app", "pages"];
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".next", ".git", "coverage", ".output"]);
const HEX_RE = /#[0-9a-fA-F]{6}\b/g;
const issues = [];

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: node scripts/analyze-layout.mjs [--json] <project>");
  process.exit(0);
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) files.push(...walk(full));
    } else if (SOURCE_EXTENSIONS.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

function sourceFiles() {
  const roots = SOURCE_DIRS.map((dir) => join(project, dir)).filter(existsSync);
  if (roots.length === 0 && existsSync(join(project, "index.html"))) return [join(project, "index.html")];
  return roots.flatMap(walk);
}

function read(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function colors(content) {
  return new Set((content.match(HEX_RE) ?? []).map((color) => color.toLowerCase()));
}

function lineAt(content, index) {
  return content.slice(0, index).split("\n").length;
}

function push(severity, rule, message, details = {}) {
  issues.push({ severity, rule, message, ...details });
}

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

function selectedPaletteRow(design) {
  const patterns = [
    /colors\.csv[^\n]*?\brow\s*#?\s*(\d{1,3})/i,
    /source\s+row\s*:\s*#?\s*(\d{1,3})/i,
    /palette\s+row\s*:\s*#?\s*(\d{1,3})/i,
  ];
  for (const pattern of patterns) {
    const match = design.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function relativeLuminance(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const channels = [1, 3, 5]
    .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  if (a == null || b == null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function auditSelectedPalette(design) {
  const rowNumber = selectedPaletteRow(design);
  if (rowNumber == null) return null;

  const palettePath = join(project, "data", "ui-ux-pro-max", "colors.csv");
  const fallbackPath = new URL("../data/ui-ux-pro-max/colors.csv", import.meta.url).pathname;
  const path = existsSync(palettePath) ? palettePath : fallbackPath;
  if (!existsSync(path)) {
    push("warning", "palette-data-missing", "DESIGN.md selects a CSV row, but colors.csv is unavailable.");
    return null;
  }

  const rows = parseCsv(read(path));
  const header = rows[0] ?? [];
  const row = rows.slice(1).find((candidate) => Number(candidate[0]) === rowNumber);
  if (!row) {
    push("blocker", "palette-row-missing", `DESIGN.md selects colors.csv row ${rowNumber}, which does not exist.`);
    return null;
  }

  const pairs = [
    ["Primary", "On Primary"],
    ["Secondary", "On Secondary"],
    ["Accent", "On Accent"],
    ["Background", "Foreground"],
    ["Card", "Card Foreground"],
    ["Muted", "Muted Foreground"],
    ["Destructive", "On Destructive"],
  ];

  for (const [surface, foreground] of pairs) {
    const first = row[header.indexOf(surface)];
    const second = row[header.indexOf(foreground)];
    const ratio = contrast(first, second);
    if (ratio == null) continue;
    const rounded = Math.round(ratio * 100) / 100;
    if (ratio < 3) {
      push(
        "blocker",
        "palette-contrast",
        `Row ${rowNumber} ${surface}/${foreground} contrast is ${rounded}:1 (${first}/${second}).`,
      );
    } else if (ratio < 4.5) {
      push(
        "warning",
        "palette-contrast",
        `Row ${rowNumber} ${surface}/${foreground} contrast is ${rounded}:1; verify intended text size and usage.`,
      );
    }
  }

  return {
    number: rowNumber,
    name: row[1],
    colors: new Set(row.filter((value) => /^#[0-9a-f]{6}$/i.test(value)).map((value) => value.toLowerCase())),
  };
}

const designPath = join(project, "DESIGN.md");
const design = read(designPath);
const files = sourceFiles();
const designColors = colors(design);
const usedColors = new Map();

for (const file of files) {
  const content = read(file);
  for (const match of content.matchAll(HEX_RE)) {
    const value = match[0].toLowerCase();
    if (!usedColors.has(value)) usedColors.set(value, []);
    usedColors.get(value).push({
      file: file.slice(project.length).replace(/^[/\\]/, ""),
      line: lineAt(content, match.index ?? 0),
    });
  }
}

if (!design) {
  push(
    "warning",
    "design-contract-missing",
    "DESIGN.md is absent. This is acceptable for a small edit, but major visual work should document its tokens.",
  );
}

const palette = design ? auditSelectedPalette(design) : null;

if (designColors.size > 0) {
  for (const [color, locations] of usedColors) {
    if (!designColors.has(color)) {
      const first = locations[0];
      push(
        "warning",
        "undocumented-source-color",
        `${color} is used in source but not documented in DESIGN.md.`,
        { file: first.file, line: first.line, value: color },
      );
    }
  }
}

if (palette && designColors.size > 0) {
  for (const color of designColors) {
    if (palette.colors.has(color)) continue;
    const line = design.split("\n").find((candidate) => candidate.toLowerCase().includes(color));
    if (line && /source:\s*user|existing brand|derived|contrast correction|custom/i.test(line)) continue;
    push(
      "warning",
      "palette-row-deviation",
      `${color} is not in selected row ${palette.number}; document its brand source or correction rationale.`,
      { value: color },
    );
  }
}

let animated = false;
let reducedMotion = false;
let horizontal = false;
let horizontalFallback = false;
let responsive = false;

for (const file of files) {
  const content = read(file);
  animated ||= /whileInView|useScroll|@keyframes|animation:|transition:|motion\./.test(content);
  reducedMotion ||= /prefers-reduced-motion|useReducedMotion/.test(content);
  horizontal ||= /overflow-x-(?:auto|scroll)|translateX|useTransform\([^,\n]*,[^\n]*x/i.test(content);
  horizontalFallback ||= /(?:max-md:|md:|@media)[^\n]*(?:overflow|block|grid|flex-col)|prefers-reduced-motion/i.test(content);
  responsive ||= /\b(?:sm|md|lg|xl):|@media|clamp\(/.test(content);

  for (const match of content.matchAll(/\bduration:\s*(\d+(?:\.\d+)?)/g)) {
    const seconds = Number(match[1]);
    if (seconds > 0.8 && seconds <= 10) {
      push(
        "warning",
        "long-motion-duration",
        `${basename(file)}:${lineAt(content, match.index ?? 0)} declares a ${seconds}s transition; verify that it does not delay content.`,
      );
    }
  }

  if (/transition:\s*all\b/.test(content)) {
    push(
      "warning",
      "transition-all",
      `${basename(file)} uses transition: all; list the intended properties.`,
    );
  }
}

if (animated && !reducedMotion) {
  push("warning", "reduced-motion-missing", "Animation exists but no reduced-motion handling was found.");
}
if (horizontal && !horizontalFallback) {
  push("warning", "horizontal-mobile-fallback", "Horizontal behavior exists without an obvious narrow-screen fallback.");
}
if (files.length > 0 && !responsive) {
  push("warning", "responsive-hints-missing", "No responsive classes, media queries, or fluid clamp values were detected.");
}

const uniqueIssues = [...new Map(
  issues.map((issue) => [`${issue.severity}:${issue.rule}:${issue.file ?? ""}:${issue.line ?? ""}:${issue.message}`, issue]),
).values()];
const blockers = uniqueIssues.filter((issue) => issue.severity === "blocker");
const warnings = uniqueIssues.filter((issue) => issue.severity === "warning");

const report = {
  project,
  filesScanned: files.length,
  designPresent: Boolean(design),
  selectedPalette: palette ? { number: palette.number, name: palette.name } : null,
  sourceColors: [...usedColors.keys()].sort(),
  blockers: blockers.length,
  warnings: warnings.length,
  issues: uniqueIssues,
};

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Visual-system audit: ${project}`);
  for (const issue of uniqueIssues) {
    const location = issue.file ? ` ${issue.file}${issue.line ? `:${issue.line}` : ""}` : "";
    console.log(`  [${issue.severity.toUpperCase()}]${location} ${issue.rule}: ${issue.message}`);
  }
  console.log(`\n${files.length} files, ${blockers.length} blockers, ${warnings.length} warnings`);
}

process.exit(blockers.length > 0 ? 1 : 0);
