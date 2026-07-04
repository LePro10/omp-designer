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
  // Static projects (index.html + css/ + js/ at the root) have no standard
  // source dir; walk the project root so their styles are audited too.
  if (roots.length === 0 && existsSync(join(project, "index.html"))) return walk(project);
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

function hexToHsl(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const [r, g, b] = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  if (hue < 0) hue += 360;
  return { hue, saturation, lightness };
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

// Default-aesthetic (AI slop) signals. These are taste-critical warnings, not
// blockers: each pattern has legitimate uses, but together they are the
// statistical-average look this system exists to prevent.
const allSource = files.map(read).join("\n");

const revealMechanism = /IntersectionObserver|whileInView|useInView|data-(?:reveal|aos|animate)\b/.test(allSource);
const hiddenInitialState = /opacity:\s*0\s*[;!}\n]|initial=\{\{[^}]*opacity:\s*0/.test(allSource);
if (revealMechanism && hiddenInitialState) {
  push(
    "warning",
    "reveal-hidden-content",
    "Content starts at opacity 0 and is revealed on scroll. Initial paint, no-JS, reduced-motion, and full-page screenshots will show blank regions unless content is legible before the reveal runs.",
  );
}

const sourceHsl = [...usedColors.keys()].map((hex) => ({ hex, hsl: hexToHsl(hex) })).filter((entry) => entry.hsl);
const nearBlackSurface = sourceHsl.find(({ hsl }) => hsl.lightness <= 0.12);
const violetAccent = sourceHsl.find(({ hsl }) =>
  hsl.hue >= 245 && hsl.hue <= 290 && hsl.saturation >= 0.45 && hsl.lightness >= 0.35 && hsl.lightness <= 0.8);
const cyanAccent = sourceHsl.find(({ hsl }) =>
  hsl.hue >= 168 && hsl.hue <= 200 && hsl.saturation >= 0.45 && hsl.lightness >= 0.3 && hsl.lightness <= 0.8);
if (nearBlackSurface && violetAccent && cyanAccent) {
  push(
    "warning",
    "ai-default-palette",
    `Violet (${violetAccent.hex}) + cyan (${cyanAccent.hex}) on near-black (${nearBlackSurface.hex}) is the statistical-default AI-product look; justify it from the brand or replace it with a product-derived palette.`,
  );
}

// The colored left-border accent strip on containers is one of the most
// reliable generated-UI tells when it repeats across a page.
const leftBorderAccents = (allSource.match(/border-left:\s*[3-6]px\s+solid|border-l-4\b/g) ?? []).length;
if (leftBorderAccents >= 3) {
  push(
    "warning",
    "left-border-accent",
    `${leftBorderAccents} containers use a colored left-border accent strip — a recognizable generated-UI pattern. Communicate grouping with layout, background tone, or rules instead.`,
  );
}

const gradientCount = (allSource.match(/(?:linear|radial|conic)-gradient\(/g) ?? []).length;
if (gradientCount >= 6) {
  push(
    "warning",
    "gradient-heavy",
    `${gradientCount} CSS gradients were found; verify they carry product content rather than acting as wallpaper.`,
  );
}

const radialGradients = (allSource.match(/radial-gradient\(/g) ?? []).length;
if (radialGradients >= 3 && /blur\(|border-radius:\s*50%/.test(allSource)) {
  push(
    "warning",
    "gradient-imagery",
    "Multiple radial gradients combined with blur or circular masking suggest gradient blobs standing in for product imagery; use a real product view, an honest diagram, or an explicit placeholder instead.",
  );
}

// Finishing details templates omit: title, meta description, favicon.
const entryHtmlPath = ["index.html", join("public", "index.html")]
  .map((candidate) => join(project, candidate))
  .find(existsSync);
if (entryHtmlPath) {
  const entryHtml = read(entryHtmlPath);
  const missingDetails = [];
  if (!/<title>\s*[^<\s][^<]*<\/title>/i.test(entryHtml)) missingDetails.push("page title");
  if (!/<meta[^>]+name=["']description["'][^>]+content=["'][^"']+["']/i.test(entryHtml) &&
      !/<meta[^>]+content=["'][^"']+["'][^>]+name=["']description["']/i.test(entryHtml)) {
    missingDetails.push("meta description");
  }
  if (!/<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(entryHtml)) missingDetails.push("favicon");
  if (missingDetails.length > 0) {
    push(
      "warning",
      "missing-page-details",
      `The entry page lacks: ${missingDetails.join(", ")}. These finishing details separate a designed page from a template.`,
    );
  }
}

// A landing page that stops after a hero and a couple of blocks has not
// answered the visitor's question chain. Counted on the entry page only.
if (entryHtmlPath) {
  const entryHtml = read(entryHtmlPath);
  const sectionCount = (entryHtml.match(/<(?:section|article)\b/gi) ?? []).length;
  if (/<h1[\s>]/i.test(entryHtml) && sectionCount > 0 && sectionCount < 4) {
    push(
      "warning",
      "page-depth-thin",
      `The entry page has ${sectionCount} content section(s). A product landing page usually needs to answer the full question chain (what, how, in use, details, practicalities, action) — extend it with earned sections, never padding.`,
    );
  }
}

// Timid display scale: a landing page whose largest text never leaves body
// range reads as a default theme. Only judged when font sizes are declared.
const TAILWIND_TEXT_REM = {
  "text-4xl": 2.25, "text-5xl": 3, "text-6xl": 3.75, "text-7xl": 4.5, "text-8xl": 6, "text-9xl": 8,
};
{
  const hasHero = /<h1[\s>]/i.test(allSource);
  let maxRem = 0;
  let declared = false;
  for (const match of allSource.matchAll(/font(?:-size)?:\s*[^;{}]*?(\d*\.?\d+)(rem|px|em)/gi)) {
    declared = true;
    const value = Number(match[1]) * (match[2].toLowerCase() === "px" ? 1 / 16 : 1);
    if (value > maxRem) maxRem = value;
  }
  // clamp() maxima anywhere count toward the ceiling: over-counting merely
  // suppresses the warning, which is the safe direction.
  for (const match of allSource.matchAll(/clamp\(([^)]*)\)/gi)) {
    for (const inner of match[1].matchAll(/(\d*\.?\d+)(rem|px)/gi)) {
      const value = Number(inner[1]) * (inner[2].toLowerCase() === "px" ? 1 / 16 : 1);
      if (value > maxRem) maxRem = value;
    }
  }
  for (const [cls, rem] of Object.entries(TAILWIND_TEXT_REM)) {
    if (allSource.includes(cls)) {
      declared = true;
      if (rem > maxRem) maxRem = rem;
    }
  }
  if (hasHero && declared && maxRem > 0 && maxRem < 3.5) {
    push(
      "warning",
      "display-scale-timid",
      `The largest declared type size is ${Math.round(maxRem * 100) / 100}rem. Display type on a landing page usually needs real scale contrast (4x body or more) to read as designed.`,
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
