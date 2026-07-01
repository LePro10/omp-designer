#!/usr/bin/env node
/**
 * fix-ai-slop.mjs - deterministic anti-slop lint/fix tool.
 *
 * Usage:
 *   node fix-ai-slop.mjs [--check] <dir>   # read-only validation (default)
 *   node fix-ai-slop.mjs --fix <dir>       # deterministic text fixes, then validation
 *
 * Default mode is intentionally read-only. Validation must not silently mutate
 * release candidates; run --fix explicitly when you want safe rewrites.
 *
 * Auto-fixes with --fix:
 * - Em-dashes in code/text files.
 *
 * Fails on:
 * - Em-dashes in --check mode
 * - Buzzwords outside avoidance-context documentation
 * - Fake precision numbers
 * - Fake/real-company social proof
 * - AI-slop colors
 * - Common LLM copy patterns
 * - Unsourced stock-photo hotlinks
 * - Unsupported EVIDENCE.md claims used in output
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, dirname, basename } from "node:path";

const args = process.argv.slice(2);
const mode = args.includes("--fix") ? "fix" : "check";
const targetDir = args.find((arg) => !arg.startsWith("--")) || "src";

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: node fix-ai-slop.mjs [--check] [--fix] <dir>");
  process.exit(0);
}

const TEXT_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js", ".css", ".html", ".md"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".next", "build", "coverage"]);

const BUZZWORDS = [
  "revolutionary", "revolutionize", "revolutionizing", "cutting-edge", "state-of-the-art",
  "seamless", "seamlessly", "empower", "empowering", "unlock", "unleash", "unleashing",
  "leverage", "leveraging", "synergy", "synergize", "next-gen", "next-generation",
  "game-changing", "best-in-class", "world-class", "robust", "scalable", "holistic",
  "comprehensive", "innovative", "innovation", "transformative", "elevate", "elevate your",
  "streamline", "streamlined", "paradigm", "foster", "curated", "curate",
  "effortless", "effortlessly", "frictionless", "frictionlessly", "pioneering",
  "groundbreaking", "next-level", "future-proof", "future-proofing", "bulletproof",
  "rock-solid", "blazing-fast", "lightning-fast", "world-leading", "industry-leading",
  "cut above", "second to none", "one-stop", "turnkey", "battle-tested",
  "mission-critical", "enterprise-grade", "military-grade", "supercharge", "supercharged"
];

const REAL_COMPANY_NAMES = [
  "vercel", "linear", "stripe", "notion", "slack", "jira", "asana", "trello", "figma",
  "github", "microsoft", "google", "apple", "meta", "amazon", "netflix", "airbnb",
  "uber", "shopify", "salesforce", "openai", "anthropic"
];

const SLOP_COLORS = ["#667eea", "#764ba2", "#1a1a2e", "#16213e", "#f0f0ff"];
const STOCK_PHOTO_HOSTS = [
  "images.unsplash.com",
  "source.unsplash.com",
  "unsplash.com",
  "images.pexels.com",
  "pexels.com",
  "cdn.pixabay.com",
  "pixabay.com",
  "picsum.photos"
];
const OVERUSED_FONTS = [
  "Inter",
  "Roboto",
  "Geist",
  "Plus Jakarta Sans",
  "Space Grotesk"
];

const COMPOUND_FONT_EXCEPTIONS = [
  "Roboto Mono",
  "Roboto Condensed",
  "Roboto Flex",
  "Roboto Serif",
  "Roboto Slab",
  "Space Mono"
];

const COPY_PATTERNS = [
  { label: "not-just-but", regex: /not\s+just\s+[^\n.]+,?\s+but\s+[^\n.]+/gi },
  { label: "whether-you-are", regex: /whether\s+you(?:'re|\s+are)\s+[^\n.]+\s+or\s+[^\n.]+/gi },
  { label: "all-in-one", regex: /all-in-one/gi },
  { label: "trusted-by", regex: /trusted\s+by|loved\s+by|used\s+by\s+\d/gi }
];

const FAKE_NUMBER_PATTERNS = [
  { label: "percentage", regex: /\b\d+(?:\.\d+)?\s?%\b/g },
  { label: "multiplier", regex: /\b\d+(?:\.\d+)?\s?[x×](?!\w)/gi },
  { label: "large-count", regex: /\b\d[\d,]*(?:\+)?\s+(?:teams|users|customers|companies|startups|developers|creators|projects|tasks|workflows|hours|days|weeks|months|years|conditions|hospitals|clinics|schools|stores|orders|deployments|laureates|awards|countries|cities)\b/gi },
  { label: "roi", regex: /\b\d+(?:\.\d+)?\s?(?:roi|return|adoption|retention|conversion|uptime)\b/gi }
];

const CURRENCY_PATTERN = { label: "currency", regex: /(?:[$€£]\s?\d[\d,]*(?:\.\d{2})?|\b\d[\d,]*(?:\.\d{2})?\s?(?:USD|EUR|GBP)\b)/gi };

const COMMERCE_CLAIM_PATTERNS = [
  { label: "free-shipping", regex: /\bfree\s+shipping\b/gi },
  { label: "shipping-region", regex: /\b(?:continental\s+US|continental\s+United\s+States|worldwide\s+shipping|international\s+shipping)\b/gi },
  { label: "ships-within", regex: /\bships?\s+(?:within|in)\s+\d+\s+(?:hours|days|weeks|months)\b/gi },
  { label: "lead-time", regex: /\blead\s+time\s*[:\-]?\s*[^.\n]+/gi },
  { label: "returns", regex: /\b(?:returns|refunds?|exchanges?)\b/gi },
  { label: "warranty", regex: /\b(?:warranty|guarantee|guaranteed)\b/gi },
];

/** Lines matching this are code, not copy — skip commerce claims on them. */
const CODE_LINE_MARKER = /\b(?:function|const|let|var|export|import|return|interface|type|class)\b|=>|:.*[{;]/;

function walkDir(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) files.push(...walkDir(full));
    } else if (TEXT_EXTENSIONS.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

function inferProjectRoot(dir) {
  const normalized = dir.replace(/\/+$/, "");
  return basename(normalized) === "src" ? dirname(normalized) : normalized;
}

function readProductFacts(dir) {
  const productPath = join(inferProjectRoot(dir), "PRODUCT.md");
  return existsSync(productPath) ? readFileSync(productPath, "utf-8") : "";
}

function readEvidence(dir) {
  const evidencePath = join(inferProjectRoot(dir), "EVIDENCE.md");
  if (!existsSync(evidencePath)) return { claims: [], exists: false };
  const content = readFileSync(evidencePath, "utf-8");
  const claims = [];
  const lines = content.split("\n");
  for (const line of lines) {
    if (!line.includes("|")) continue;
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 4) continue;
    const [claim, source, confidence, allowed] = cells;
    if (claim === "Claim" || claim === "---") continue;
    const confNum = parseInt(confidence, 10);
    if (!isNaN(confNum) && confNum === 0) {
      claims.push({ claim, source, confidence: 0, allowed });
    }
  }
  return { claims, exists: true };
}

function detectUnsupportedEvidenceClaims(content, evidence) {
  if (!evidence.exists || evidence.claims.length === 0) return [];
  const issues = [];
  const generic = new Set(["none", "missing", "price", "user count", "free shipping"]);
  for (const { claim, allowed } of evidence.claims) {
    if (claim.length < 3 || generic.has(claim.toLowerCase())) continue;
    const escaped = claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    for (const match of content.matchAll(regex)) {
      issues.push({
        label: "evidence:unsupported-claim",
        value: `"${claim}" (allowed: ${allowed})`,
        line: lineNumberForIndex(content, match.index ?? 0)
      });
    }
  }
  return issues;
}

function lineNumberForIndex(content, index) {
  return content.slice(0, index).split("\n").length;
}

function collectMatches(content, regex, label) {
  const matches = [];
  for (const match of content.matchAll(regex)) {
    matches.push({ label, value: match[0], line: lineNumberForIndex(content, match.index ?? 0) });
  }
  return matches;
}

function fixEmDashes(content) {
  const before = content;
  const fixed = content.replace(/\s[—–]\s/g, ", ").replace(/[—–]/g, ",");
  return { content: fixed, count: before === fixed ? 0 : (before.match(/[—–]/g) || []).length - (fixed.match(/[—–]/g) || []).length };
}

function detectEmDashes(content) {
  return collectMatches(content, /[—–]/g, "em-dash");
}

function detectBuzzwords(content) {
  const results = [];
  const lines = content.split("\n");
  const avoidanceMarkers = /anti.?pattern|avoid|what to (avoid|not)|not (use|default|allowed)|ban|forbidden|never use|do not use|MUST NOT|instead of|rather than|replace with|instead:|overused/i;
  for (const word of BUZZWORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    for (const match of content.matchAll(regex)) {
      const lineIdx = lineNumberForIndex(content, match.index ?? 0);
      const line = lines[lineIdx - 1] || "";
      if (avoidanceMarkers.test(line)) continue;
      results.push({ label: `buzzword:${word}`, value: match[0], line: lineIdx });
    }
  }
  return results;
}

function detectFakeNumbers(content) {
  return FAKE_NUMBER_PATTERNS.flatMap(({ label, regex }) => collectMatches(content, regex, `fake-number:${label}`));
}

function detectCurrency(content) {
  return collectMatches(content, CURRENCY_PATTERN.regex, `fake-number:${CURRENCY_PATTERN.label}`);
}

function hasUserProvidedFact(productFacts, value) {
  const needle = value.toLowerCase();
  return productFacts
    .split("\n")
    .some((line) => /source:\s*user/i.test(line) && line.toLowerCase().includes(needle));
}

function removeSourcedFactualIssues(issues, productFacts) {
  return issues.filter((issue) => {
    const needsSource = issue.label.startsWith("fake-number:") || issue.label.startsWith("commerce:");
    if (!needsSource) return true;
    return !hasUserProvidedFact(productFacts, issue.value);
  });
}

function detectCompanies(content) {
  const socialProof = /trusted\s+by|loved\s+by|used\s+by|teams\s+at|customers\s+include/gi.test(content);
  if (!socialProof) return [];
  return REAL_COMPANY_NAMES.flatMap((name) => collectMatches(content, new RegExp(`\\b${name}\\b`, "gi"), `real-company:${name}`));
}

function detectSlopColors(content) {
  return SLOP_COLORS.flatMap((color) => collectMatches(content, new RegExp(color, "gi"), `slop-color:${color}`));
}

function detectCopyPatterns(content) {
  return COPY_PATTERNS.flatMap(({ label, regex }) => collectMatches(content, regex, `pattern:${label}`));
}

function detectStockPhotoHotlinks(content) {
  return STOCK_PHOTO_HOSTS.flatMap((host) => {
    const escaped = host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return collectMatches(content, new RegExp(escaped, "gi"), `stock-photo:${host}`);
  });
}

function detectCommerceClaims(content) {
  const lines = content.split("\n");
  return COMMERCE_CLAIM_PATTERNS.flatMap(({ label, regex }) =>
    collectMatches(content, regex, `commerce:${label}`).filter((m) => {
      const line = lines[m.line - 1] || "";
      return !CODE_LINE_MARKER.test(line);
    })
  );
}

function detectOverusedFonts(content) {
  const results = [];
  const lines = content.split("\n");
  const avoidanceMarkers = /anti.?pattern|avoid|what to (avoid|not)|not (use|default|allowed)|ban|forbidden|never use|do not use|MUST NOT|instead of|rather than|overused|default font/i;

  for (const exception of COMPOUND_FONT_EXCEPTIONS) {
    const escaped = exception.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const exRegex = new RegExp(`['"]${escaped}['"]|family=${escaped.replace(/\s+/g, "[+\\s]+")}|${escaped}`, "gi");
    for (const m of content.matchAll(exRegex)) {
      results.push({ label: "compound-font-ok", value: m[0], line: lineNumberForIndex(content, m.index ?? 0) });
    }
  }
  const okLines = new Set(results.filter((r) => r.label === "compound-font-ok").map((r) => r.line));

  return OVERUSED_FONTS.flatMap((font) => {
    const escaped = font.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[+\\s]+");
    const regex = new RegExp(`(?:family=${escaped}|font-family[^;\n]*${escaped}|['"]${escaped}['"]|\\b${escaped}\\b)`, "gi");
    return collectMatches(content, regex, `overused-font:${font}`).filter((m) => {
      if (okLines.has(m.line)) return false;
      const line = lines[m.line - 1] || "";
      if (avoidanceMarkers.test(line)) return false;
      return true;
    });
  });
}

function printIssues(file, issues) {
  if (issues.length === 0) return;
  console.log(`  FAIL ${file}`);
  for (const issue of issues.slice(0, 20)) {
    console.log(`    line ${issue.line}: ${issue.label} -> "${issue.value.trim()}"`);
  }
  if (issues.length > 20) console.log(`    ... ${issues.length - 20} more`);
}

console.log(`\nScanning ${targetDir}/ for AI slop (${mode} mode)...\n`);

let files = [];
try {
  files = walkDir(targetDir);
} catch (error) {
  console.error(`Could not scan ${targetDir}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const productFacts = readProductFacts(targetDir);
const evidence = readEvidence(targetDir);
if (evidence.exists) {
  console.log(`  EVIDENCE.md found: ${evidence.claims.length} unsupported claim(s) to watch`);
}

let totalEmDashes = 0;
let totalIssues = 0;

for (const file of files) {
  const original = readFileSync(file, "utf-8");
  const fixed = fixEmDashes(original);
  const contentForChecks = mode === "fix" ? fixed.content : original;

  if (fixed.count > 0) {
    totalEmDashes += fixed.count;
    if (mode === "fix") {
      writeFileSync(file, fixed.content);
      console.log(`  fixed ${fixed.count} em-dash(es) in ${file}`);
    }
  }

  const issues = removeSourcedFactualIssues([
    ...(mode === "check" ? detectEmDashes(original) : []),
    ...detectBuzzwords(contentForChecks),
    ...detectFakeNumbers(contentForChecks),
    ...detectCurrency(contentForChecks),
    ...detectCompanies(contentForChecks),
    ...detectSlopColors(contentForChecks),
    ...detectCopyPatterns(contentForChecks),
    ...detectStockPhotoHotlinks(contentForChecks),
    ...detectOverusedFonts(contentForChecks),
    ...(basename(file) !== "EVIDENCE.md" && basename(file) !== "PRODUCT.md" ? detectUnsupportedEvidenceClaims(contentForChecks, evidence) : []),
    ...(basename(file) !== "EVIDENCE.md" ? detectCommerceClaims(contentForChecks) : []),
  ], productFacts);

  printIssues(file, issues);
  totalIssues += issues.length;
}

console.log("\nSummary:");
console.log(`  Files scanned: ${files.length}`);
console.log(`  Em-dashes ${mode === "fix" ? "fixed" : "found"}: ${totalEmDashes}`);
console.log(`  Blocking issues found: ${totalIssues}`);

if (totalIssues === 0) {
  console.log("\nClean. No blocking AI slop detected.\n");
  process.exit(0);
}

console.log(mode === "check"
  ? "\nFix the blocking issues or rerun with --fix for deterministic em-dash cleanup.\n"
  : "\nFix the remaining blocking issues above and rerun.\n");
process.exit(1);
