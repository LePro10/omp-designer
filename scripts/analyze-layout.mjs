#!/usr/bin/env node
/**
 * analyze-layout.mjs - deterministic layout/design-system audit.
 *
 * Usage:
 *   node analyze-layout.mjs .
 *
 * Checks:
 * - DESIGN.md exists and declares palette hex values
 * - src/ hex colors stay within DESIGN.md
 * - DESIGN.md motion timings stay inside default ranges
 * - layout variety
 * - responsive class presence
 * - reduced-motion hints
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { homedir } from "node:os";

const projectDir = process.argv[2] || ".";
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".next", "build", "coverage"]);
const CODE_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js", ".css"]);
const HEX_RE = /#[0-9a-fA-F]{6}\b/g;

function walkDir(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) files.push(...walkDir(full));
    } else if (CODE_EXTENSIONS.has(extname(entry)) || basename(entry) === "DESIGN.md") {
      files.push(full);
    }
  }
  return files;
}

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf-8") : "";
}

function extractHexColors(content) {
  const colors = new Set();
  const matches = content.match(HEX_RE) ?? [];
  for (const color of matches) colors.add(color.toLowerCase());
  return colors;
}

function extractHexColorsFromMatchingLines(content, linePattern) {
  const colors = new Set();
  const lines = content.split("\n");
  for (const line of lines) {
    if (!linePattern.test(line)) continue;
    for (const color of extractHexColors(line)) colors.add(color);
  }
  return colors;
}

function readAllowedNonCsvColors(projectDir, designContent) {
  const allowed = new Set();
  const productContent = readIfExists(join(projectDir, "PRODUCT.md"));
  const productColors = extractHexColorsFromMatchingLines(productContent, /source:\s*user|brand\s+colou?rs?|provided\s+colou?rs?/i);
  const documentedDesignColors = extractHexColorsFromMatchingLines(designContent, /source:\s*user|user-provided|provided\s+brand|brand\s+colou?r|derived\s+from|derivation/i);
  for (const color of productColors) allowed.add(color);
  for (const color of documentedDesignColors) allowed.add(color);
  return allowed;
}

function extractFontSizes(content) {
  const sizes = new Set();
  const matches = content.match(/text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)/g) ?? [];
  for (const size of matches) sizes.add(size);
  return sizes;
}

function extractSpacing(content) {
  const spacing = new Set();
  const matches = content.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)-(?:0|1|2|3|4|5|6|8|10|12|16|20|24|32|48|64|96|128)\b/g) ?? [];
  for (const item of matches) spacing.add(item);
  return spacing;
}

function detectLayout(content) {
  if (content.includes("sticky") && /h-\[(?:200|300|400)vh\]/.test(content)) return "pinned-scroll";
  if (content.includes("useTransform") && /x\)|translateX|overflow-x/.test(content)) return "horizontal-scroll";
  if (content.includes("grid-cols") && content.includes("col-span")) return "bento-grid";
  if (/grid-cols-(?:3|4|5)/.test(content)) return "multi-column-grid";
  if (/grid-cols-2/.test(content)) return "two-column-grid";
  if (content.includes("flex-row") && /w-(?:1\/2|3\/5|2\/5)/.test(content)) return "split";
  if (content.includes("text-center") && /max-w-(?:2xl|3xl|4xl)/.test(content)) return "centered";
  if (content.includes("overflow-x-auto") || content.includes("overflow-x-scroll")) return "horizontal-scroll";
  if (content.includes("prose") || content.includes("article")) return "editorial";
  return "unknown";
}

function analyzeSections(files) {
  const sections = [];
  for (const file of files) {
    if (!file.endsWith(".tsx") && !file.endsWith(".jsx")) continue;
    const content = readFileSync(file, "utf-8");
    const name = basename(file).replace(/\.(tsx|jsx)$/, "");
    const layout = detectLayout(content);
    sections.push({
      name,
      layout,
      hasScrollAnimation: content.includes("whileInView") || content.includes("useScroll"),
      hasHover: content.includes("whileHover") || content.includes(":hover"),
      hasResponsive: /\b(?:sm|md|lg|xl):/.test(content),
      hasReducedMotion: content.includes("useReducedMotion") || content.includes("prefers-reduced-motion"),
      riskyHorizontal: layout === "horizontal-scroll" && !/(?:md:|max-md|sm:|vertical|stack)/i.test(content),
    });
  }
  return sections;
}

function detectMotionTimingIssues(designContent) {
  const issues = [];
  const rules = [
    { label: "Entrance", min: 240, max: 320 },
    { label: "Exit", min: 160, max: 220 },
    { label: "Hover", min: 140, max: 200 },
    { label: "Active/Press", min: 80, max: 120 },
    { label: "Stagger", min: 60, max: 90 },
    { label: "Counters", min: 900, max: 1200 },
  ];

  const lines = designContent.split("\n");
  for (const { label, min, max } of rules) {
    const line = lines.find((item) => item.toLowerCase().includes(label.toLowerCase()));
    if (!line) continue;
    const match = line.match(/\b(\d{2,4})ms\b/i);
    if (!match) continue;
    const value = Number(match[1]);
    if (value < min || value > max) {
      issues.push(`${label} timing ${value}ms outside ${min}-${max}ms`);
    }
  }
  return issues;
}

function readMotionIntensity(designContent) {
  const match = designContent.match(/MOTION_INTENSITY[:\s]*(\d)/i);
  return match ? Number(match[1]) : 3;
}

function readCsvPaletteColors() {
  const csvPaths = [
    join(projectDir, "data", "ui-ux-pro-max", "colors.csv"),
    join(projectDir, "colors.csv"),
    join(homedir(), ".omp", "agent", "managed-skills", "ui-ux-pro-max-skill", "src", "ui-ux-pro-max", "data", "colors.csv"),
    join(homedir(), "projects", "projects", "designer", "data", "ui-ux-pro-max", "colors.csv"),
  ];
  for (const csvPath of csvPaths) {
    if (existsSync(csvPath)) {
      const content = readFileSync(csvPath, "utf-8");
      return extractHexColors(content);
    }
  }
  return new Set();
}

function motionCeiling(intensity) {
  if (intensity <= 2) return 200;
  if (intensity <= 3) return 320;
  return 600;
}

function detectCodeMotionTimingIssues(files, motionIntensity) {
  const ceiling = motionCeiling(motionIntensity);
  const issues = [];
  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");
    lines.forEach((line, index) => {
      const secondsMatches = line.matchAll(/duration:\s*(\d+(?:\.\d+)?)/g);
      for (const match of secondsMatches) {
        const seconds = Number(match[1]);
        const ms = Math.round(seconds * 1000);
        const isCounter = /counter|count/i.test(line);
        if (seconds <= 10 && ms > ceiling && !isCounter) {
          issues.push(`${basename(file)}:${index + 1} duration ${ms}ms exceeds ${ceiling}ms ceiling (MOTION_INTENSITY ${motionIntensity})`);
        }
      }

      const classMatches = line.matchAll(/\bduration-(\d{3,4})\b/g);
      for (const match of classMatches) {
        const ms = Number(match[1]);
        if (ms > ceiling) {
          issues.push(`${basename(file)}:${index + 1} Tailwind duration-${ms} exceeds ${ceiling}ms ceiling (MOTION_INTENSITY ${motionIntensity})`);
        }
      }
    });
  }
  return issues;
}

function printSet(label, set) {
  const values = [...set].sort();
  console.log(`  ${label}: ${values.length ? values.join(", ") : "none"}`);
}

console.log(`\nAnalyzing layout in ${projectDir}/\n`);

let files = [];
try {
  files = walkDir(projectDir);
} catch (error) {
  console.error(`Could not analyze ${projectDir}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const srcFiles = files.filter((file) => CODE_EXTENSIONS.has(extname(file)));
const designPath = join(projectDir, "DESIGN.md");
const designContent = readIfExists(designPath);
const designColors = extractHexColors(designContent);
const usedColors = new Set();
const fontSizes = new Set();
const spacing = new Set();

for (const file of srcFiles) {
  const content = readFileSync(file, "utf-8");
  for (const color of extractHexColors(content)) usedColors.add(color);
  for (const size of extractFontSizes(content)) fontSizes.add(size);
  for (const item of extractSpacing(content)) spacing.add(item);
}

const sections = analyzeSections(srcFiles);
const layoutCounts = new Map();
for (const section of sections) {
  layoutCounts.set(section.layout, (layoutCounts.get(section.layout) ?? 0) + 1);
}
const blocking = [];
const warnings = [];
const motionIntensity = readMotionIntensity(designContent);
const codeMotionTimingIssues = detectCodeMotionTimingIssues(srcFiles, motionIntensity);
if (!designContent) {
  blocking.push("DESIGN.md missing at project root");
} else if (designColors.size === 0) {
  blocking.push("DESIGN.md has no hex palette values");
}

const csvPaletteColors = readCsvPaletteColors();
const allowedNonCsvColors = readAllowedNonCsvColors(projectDir, designContent);
if (csvPaletteColors.size > 0 && designColors.size > 0) {
  const invented = [...designColors].filter((color) => {
    if (csvPaletteColors.has(color)) return false;
    if (allowedNonCsvColors.has(color)) return false;
    // Allow common dark-mode surface colors (blacks, dark grays, whites)
    if (/^#(0[0-9a-f]{5}|1[0-9a-f]{5}|2[0-9a-f]{5}|f[0-9a-f]{5}|e[0-9a-f]{5})$/i.test(color)) return false;
    return true;
  });
  if (invented.length > 0) {
    blocking.push(`DESIGN.md colors not in CSV palette or documented user/brand derivation: ${invented.join(", ")}`);
  }
}

const offPalette = [...usedColors].filter((color) => designColors.size > 0 && !designColors.has(color));
if (offPalette.length > 0) blocking.push(`Off-palette colors in src/: ${offPalette.join(", ")}`);

const motionTimingIssues = detectMotionTimingIssues(designContent);
for (const issue of motionTimingIssues) blocking.push(issue);


const uniqueLayouts = [...layoutCounts.keys()].filter((layout) => layout !== "unknown");
if (sections.length >= 4 && uniqueLayouts.length < 3) warnings.push("Less than 3 known layout families across 4+ sections");
if (fontSizes.size < 4) warnings.push("Less than 4 text size classes detected; hierarchy may be flat");

const nonResponsive = sections.filter((section) => !section.hasResponsive && section.layout !== "unknown");
if (nonResponsive.length > 0) warnings.push(`Sections without responsive class hints: ${nonResponsive.map((section) => section.name).join(", ")}`);

const riskyHorizontal = sections.filter((section) => section.riskyHorizontal);
if (riskyHorizontal.length > 0) blocking.push(`Horizontal scroll without obvious mobile fallback: ${riskyHorizontal.map((section) => section.name).join(", ")}`);

const animatedSections = sections.filter((section) => section.hasScrollAnimation || section.hasHover);
const reducedMotionCoverage = sections.some((section) => section.hasReducedMotion) || srcFiles.some((file) => readFileSync(file, "utf-8").includes("prefers-reduced-motion"));
if (animatedSections.length > 0 && !reducedMotionCoverage) warnings.push("Animations detected but no reduced-motion handling found");

console.log("SECTIONS:");
for (const section of sections) {
  console.log(`  ${section.name}: ${section.layout} scroll=${section.hasScrollAnimation} hover=${section.hasHover} responsive=${section.hasResponsive}`);
}

console.log("\nLAYOUT VARIETY:");
console.log(`  Unique known layouts: ${uniqueLayouts.length}`);
for (const [layout, count] of layoutCounts.entries()) console.log(`  ${layout}: ${count}`);

console.log("\nDESIGN COLORS:");
printSet("DESIGN.md", designColors);
printSet("src", usedColors);
printSet("allowed non-CSV", allowedNonCsvColors);

console.log("\nTYPOGRAPHY AND SPACING:");
printSet("font sizes", fontSizes);
printSet("spacing", spacing);

console.log("\nMOTION TIMING:");
const allMotionIssues = [...motionTimingIssues, ...codeMotionTimingIssues];
if (allMotionIssues.length === 0) {
  console.log("  DESIGN.md and component timings within default ranges or not specified");
} else {
  for (const issue of allMotionIssues) console.log(`  FAIL ${issue}`);
}

if (warnings.length > 0) {
  console.log("\nWARNINGS:");
  for (const warning of warnings) console.log(`  WARN ${warning}`);
}

if (blocking.length > 0) {
  console.log("\nBLOCKING:");
  for (const item of blocking) console.log(`  FAIL ${item}`);
  console.log("");
  process.exit(1);
}

console.log("\nLayout/design-system audit passed.\n");
process.exit(0);
