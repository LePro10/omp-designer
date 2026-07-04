#!/usr/bin/env node
/**
 * Context-aware copy and evidence audit.
 *
 * Exit 1: unsupported factual/commercial claim (blocker)
 * Exit 0: clean or warnings only
 *
 * Usage:
 *   node scripts/fix-ai-slop.mjs --check <project>
 *   node scripts/fix-ai-slop.mjs --json <project>
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const target = args.find((arg) => !arg.startsWith("--")) ?? ".";

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: node scripts/fix-ai-slop.mjs [--check] [--json] <project>");
  process.exit(0);
}

if (args.includes("--fix")) {
  console.error("--fix was removed: copy changes require human/model judgment.");
  process.exit(2);
}

const SOURCE_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js", ".html", ".vue", ".svelte"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".next", ".git", "coverage", ".output"]);
const issues = [];

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

function lineAt(content, index) {
  return content.slice(0, index).split("\n").length;
}

function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function addCandidate(candidates, seen, text, index, content) {
  const value = text.replace(/\s+/g, " ").trim();
  // Copy needs two letters OR a digit: "10x", "98%", "50k+" are visible claims
  // even though they contain at most one letter.
  if (value.length < 2 || !(/[A-Za-zÀ-ž]{2}/.test(value) || /\d/.test(value))) return;
  const key = `${index}:${value}`;
  if (seen.has(key)) return;
  seen.add(key);
  candidates.push({ text: value, line: lineAt(content, index) });
}

function visibleCopyCandidates(content) {
  const cleaned = stripComments(content);
  const candidates = [];
  const seen = new Set();

  // Text nodes in HTML/JSX/Svelte/Vue templates.
  for (const match of cleaned.matchAll(/>([^<>{}]+)</g)) {
    addCandidate(candidates, seen, match[1], (match.index ?? 0) + 1, cleaned);
  }

  // User-visible attributes.
  for (const match of cleaned.matchAll(/\b(?:aria-label|title|alt|placeholder)\s*=\s*["']([^"']+)["']/gi)) {
    addCandidate(candidates, seen, match[1], match.index ?? 0, cleaned);
  }

  // String literals frequently used for copy constants. Exclude imports,
  // class lists, URLs, selectors, and other implementation strings.
  for (const match of cleaned.matchAll(/(?<![A-Za-zÀ-ž0-9])(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g)) {
    const index = match.index ?? 0;
    const prefix = cleaned.slice(Math.max(0, index - 50), index);
    const value = match[2];
    if (/(?:className|class|href|src|import|from|require|fontFamily)\s*[:=]?\s*$/i.test(prefix)) continue;
    if (/^(?:https?:|\/|\.\/|#|[a-z-]+:)/i.test(value.trim())) continue;
    // Stat tokens ("10x", "98%", "50k+") behind copy-ish object keys are
    // visible claims even without whitespace: { value: "10x", label: "..." }.
    const statKeyed = /(?:value|stat|metric|number|count|figure|kpi|amount)\s*[:=]\s*$/i.test(prefix) &&
      /^[~≈]?\d[\d,.]*\s?(?:%|[x×]|\+|[km]\+?)$/i.test(value.trim());
    if (!statKeyed && !/\s/.test(value) && value.length < 24) continue;
    // CSS value expressions ("translate(-50%, -50%)", "0 4px 12px rgba(...)")
    // are implementation strings, not visible copy claims.
    const cssValueLike = /^(?:-?[\d.]+(?:px|r?em|vh|vw|vmin|vmax|%|m?s|deg|fr|ch|ex)?[\s,/]*|(?:translate|scale|rotate|skew)[XYZ]?\([^)]*\)[\s,]*|(?:calc|var|min|max|clamp|rgba?|hsla?|url|cubic-bezier|steps)\([^)]*\)[\s,]*|[a-z-]+-gradient\([^)]*\)[\s,]*)+$/i
      .test(value.trim());
    if (cssValueLike && !statKeyed) continue;
    addCandidate(candidates, seen, value, index, cleaned);
  }

  return candidates;
}

function readText(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const trustedUserFacts = process.env.DESIGNER_USER_FACTS?.trim() ?? "";
const product = readText(join(target, "PRODUCT.md"));
const evidence = readText(join(target, "EVIDENCE.md"));
const sourceLedger = trustedUserFacts || `${product}\n${evidence}`;

function isSupported(value) {
  const needle = value.toLowerCase().replace(/\s+/g, " ").trim();
  if (!needle) return false;
  if (trustedUserFacts) {
    return sourceLedger.toLowerCase().replace(/\s+/g, " ").includes(needle);
  }
  return sourceLedger
    .split("\n")
    .some((line) => {
      const lower = line.toLowerCase().replace(/\s+/g, " ");
      const markedSource = /source:\s*user|\|\s*(?:user|verified|supplied)\s*\|/.test(lower);
      const blocked = /must not use|\|\s*blocked\s*\||confidence\s*[:=]\s*0/.test(lower);
      return markedSource && !blocked && lower.includes(needle);
    });
}

function push(severity, file, candidate, rule, value, message) {
  issues.push({
    severity,
    file,
    line: candidate.line,
    rule,
    value,
    message,
  });
}

const BUZZWORDS = [
  "revolutionary",
  "cutting-edge",
  "seamless",
  "unlock",
  "empower",
  "game-changing",
  "world-class",
  "best-in-class",
  "future-proof",
  "supercharge",
];

const FACT_PATTERNS = [
  { rule: "unsupported-percentage", regex: /\b\d+(?:\.\d+)?\s?%/g },
  { rule: "unsupported-multiplier", regex: /\b\d+(?:\.\d+)?\s?[x×]\b/gi },
  {
    rule: "unsupported-count",
    regex: /\b\d[\d,.]*\s?(?:[km]\+?|\+)?\s+(?:active\s+)?(?:users|customers|teams|companies|orders|projects|seconds?|minutes?|hours?|days?|weeks?|months?|years?|countries|awards|downloads|installs|members|subscribers|developers|reviews|stars)\b/gi,
  },
  // "50k+" / "1M+" style audience counts, with or without a following noun.
  { rule: "unsupported-count", regex: /\b\d[\d,.]*\s?[km]\+/gi },
  {
    rule: "unsupported-count",
    regex: /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b/gi,
  },
  {
    rule: "unsupported-count",
    regex: /\b\d[\d,.]*\s*(?:-|–|to)\s*\d[\d,.]*\s+(?:users|customers|people|teams|companies|orders|projects|sites|locations)\b/gi,
  },
  { rule: "unsupported-price", regex: /(?:[$€£]\s?\d[\d,.]*|\b\d[\d,.]*\s?(?:USD|EUR|GBP)\b)/gi },
  {
    rule: "unsupported-release-status",
    regex: /\b(?:(?:get|join)(?: the)? (?:waitlist|early access)|early access (?:is )?(?:open|opening|available)|(?:launching|coming) soon|you(?:'re| are) on (?:the )?list|(?:now )?(?:in|open for) (?:beta|early access))\b/gi,
  },
];

const COMMERCE_PATTERNS = [
  /\bfree shipping\b/gi,
  /\bfree (?:trial|plan|tier|access|during|forever)\b/gi,
  /\bno credit card(?: required| needed)?\b/gi,
  /\bno spam\b/gi,
  /\bships? (?:within|in) \d+ (?:hours|days|weeks)\b/gi,
  /\b\d+[- ]day (?:returns?|refund|guarantee)\b/gi,
  /\blifetime warranty\b/gi,
  /\bworldwide shipping\b/gi,
];

const CAPABILITY_SIGNALS = [
  /\boffline\b/gi,
  /\bsync(?:s|ed|ing)?\b/gi,
  /\bautomatically\b/gi,
  /\bauto-?saves?\b/gi,
  /\b(?:voice|spoken)\b/gi,
  /\breal[ -]?time\b/gi,
  /\b(?:connectivity|connection|uploads?)\b/gi,
  /\bassign(?:s|ed|ing)?\b/gi,
  /\bshar(?:e|es|ed|ing)\b/gi,
  /\beveryone\b.{0,40}\b(?:can|could) see\b/gi,
];

let files;
try {
  files = walk(target);
} catch (error) {
  console.error(`Could not scan ${target}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const projectHasServerRoute = files.some((file) =>
  /(?:^|[/\\])(?:api|server)(?:[/\\]|\.|$)|[/\\]route\.(?:[cm]?[jt]s)$/i.test(file));

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const rel = file.startsWith(target) ? file.slice(target.length).replace(/^[/\\]/, "") : file;
  const candidates = visibleCopyCandidates(content);

  for (const candidate of candidates) {
    for (const pattern of FACT_PATTERNS) {
      pattern.regex.lastIndex = 0;
      for (const match of candidate.text.matchAll(pattern.regex)) {
        if (!isSupported(match[0])) {
          push(
            "blocker",
            rel,
            candidate,
            pattern.rule,
            match[0],
            "Externally verifiable claim is not sourced in PRODUCT.md or EVIDENCE.md.",
          );
        }
      }
    }

    for (const regex of COMMERCE_PATTERNS) {
      regex.lastIndex = 0;
      for (const match of candidate.text.matchAll(regex)) {
        if (!isSupported(match[0])) {
          push(
            "blocker",
            rel,
            candidate,
            "unsupported-commerce-claim",
            match[0],
            "Commercial policy is not sourced in PRODUCT.md or EVIDENCE.md.",
          );
        }
      }
    }

    for (const regex of CAPABILITY_SIGNALS) {
      regex.lastIndex = 0;
      for (const match of candidate.text.matchAll(regex)) {
        if (!isSupported(match[0])) {
          push(
            "warning",
            rel,
            candidate,
            "unsupported-capability-signal",
            match[0],
            "Confirm this product behavior is supplied or sourced; do not infer capabilities from the category.",
          );
        }
      }
    }

    if (/\b(?:trusted|used|loved) by\b/i.test(candidate.text) && !isSupported(candidate.text)) {
      push(
        "blocker",
        rel,
        candidate,
        "unsupported-social-proof",
        candidate.text,
        "Social proof requires a supplied source.",
      );
    }

    if (/\b(?:built|designed|developed|created|building)\b.{0,80}\bwith (?:input|feedback) from\b/i.test(candidate.text) && !isSupported(candidate.text)) {
      push(
        "blocker",
        rel,
        candidate,
        "unsupported-social-proof",
        candidate.text,
        "Claims of customer or user participation require a supplied source.",
      );
    }

    // Model-glitch script mixing: CJK/Hangul/Cyrillic fragments embedded in
    // otherwise-Latin copy are a strong generated-text tell.
    {
      const latinLetters = (candidate.text.match(/[A-Za-zÀ-ž]/g) ?? []).length;
      const foreign = candidate.text.match(/[一-鿿぀-ヿ가-힯Ѐ-ӿ]+/g);
      if (foreign && latinLetters >= foreign.join("").length * 2) {
        push(
          "blocker",
          rel,
          candidate,
          "mixed-script-copy",
          foreign.join(" "),
          "Copy mixes another script into Latin text mid-sentence; this reads as a generation glitch. Rewrite the sentence in one language.",
        );
      }
    }

    if (/[—–]/.test(candidate.text)) {
      push(
        "warning",
        rel,
        candidate,
        "copy-cadence",
        candidate.text,
        "Review punctuation and cadence; an isolated dash is not automatically a defect.",
      );
    }

    if (/not\s+just\b[\s\S]*\bbut\b/i.test(candidate.text) || /whether\s+you(?:'re| are)\b[\s\S]*\bor\b/i.test(candidate.text)) {
      push(
        "warning",
        rel,
        candidate,
        "generic-copy-pattern",
        candidate.text,
        "Review for generic model-like construction.",
      );
    }

    // Invented contact details look real to a visitor and cannot be honored.
    // Scanned only in visible copy, so SVG coordinates and dates do not match.
    for (const match of candidate.text.matchAll(/(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{2,4}(?:[\s.-]\d{2,4}){2,4}/g)) {
      const token = match[0].trim();
      const digits = token.replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 15) continue;
      if (!/^[+(]/.test(token) && !/\bphone|call|tel\b/i.test(candidate.text)) continue;
      if (isSupported(token) || isSupported(digits)) continue;
      push(
        "warning",
        rel,
        candidate,
        "contact-details-unverified",
        token,
        "A phone number appears in the copy but was not supplied by the user; visitors will dial it. Use a supplied number or an explicit placeholder.",
      );
    }
    for (const match of candidate.text.matchAll(/\b[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/gi)) {
      const address = match[0];
      if (/@(?:example\.(?:com|org)|test\.)/i.test(address)) continue;
      if (isSupported(address)) continue;
      push(
        "warning",
        rel,
        candidate,
        "contact-details-unverified",
        address,
        "An email address appears in the copy but was not supplied by the user. Use a supplied address or an explicit placeholder.",
      );
    }

    for (const word of BUZZWORDS) {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(candidate.text)) {
        push(
          "warning",
          rel,
          candidate,
          "vague-marketing-language",
          word,
          "Confirm that the word communicates a concrete product fact.",
        );
      }
    }
  }

  // Stat tiles split the number and its label across elements ("<div>12</div>
  // <div>Farm partners</div>"), evading the unit-word patterns above. A bare
  // numeric text node (>= 10, or any value with a %/x/+/k/M suffix) followed
  // closely by a short label reads as a metrics row and needs a source.
  for (const match of content.matchAll(/>\s*([~≈]?\d[\d,.]*\s?(?:%|[x×]|\+|[km]\+?)?)\s*</g)) {
    const token = match[1].trim();
    const bareNumber = /^\d[\d,.]*$/.test(token);
    if (/^0\d/.test(token)) continue; // "01" step markers
    if (bareNumber && Number.parseFloat(token.replace(/,/g, "")) < 10) continue;
    const tail = content.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 150);
    const label = tail.match(/>\s*([A-Za-zÀ-ž][^<>{}]{1,40})\s*</);
    if (!label || label[1].trim().split(/\s+/).length > 4) continue;
    const claim = `${token} ${label[1].trim()}`;
    if (isSupported(claim) || isSupported(token)) continue;
    push(
      "warning",
      rel,
      { line: lineAt(content, match.index ?? 0) },
      "stat-tile-claim",
      claim,
      "A bare numeric tile next to a label reads as a metric; verify the number is user-supplied or remove the stats row.",
    );
  }

  for (const match of content.matchAll(/<a\b[^>]*\bhref\s*=\s*["']#["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (/\b(?:join|contact|submit|sign up|waitlist|early access|start|try|buy|checkout)\b/i.test(label)) {
      issues.push({
        severity: "blocker",
        file: rel,
        line: lineAt(content, match.index ?? 0),
        rule: "nonfunctional-action",
        value: label,
        message: "A prominent action cannot point to '#'; implement a real behavior or present it as unavailable.",
      });
    }
  }

  const hasEmailCapture = /<input\b[^>]*\btype\s*=\s*["']email["']/i.test(content);
  const promisesSubmission = /(?:we(?:'ll| will) be in touch|you(?:'re| are) on (?:the )?list|you will hear from us|we will let you know|your spot is saved|request received|thanks for signing up)/i.test(content);
  const fetchTargets = [...content.matchAll(/\bfetch\s*\(\s*["'`]([^"'`]+)["'`]/gi)].map((match) => match[1]);
  const hasFetchDelivery = fetchTargets.some((url) => /^https?:\/\//i.test(url) || projectHasServerRoute);
  const hasDelivery = hasFetchDelivery ||
    /(?:\baxios\b|XMLHttpRequest|sendBeacon|<form\b[^>]*\baction\s*=|mailto:)/i.test(content);
  if (hasEmailCapture && promisesSubmission && !hasDelivery) {
    issues.push({
      severity: "blocker",
      file: rel,
      line: lineAt(content, content.search(/<input\b[^>]*\btype\s*=\s*["']email["']/i)),
      rule: "nonfunctional-signup",
      value: "email capture without delivery",
      message: "The UI promises signup/contact completion but has no delivery mechanism.",
    });
  }

  for (const host of ["images.unsplash.com", "source.unsplash.com", "picsum.photos", "images.pexels.com"]) {
    if (content.includes(host)) {
      issues.push({
        severity: "warning",
        file: rel,
        line: lineAt(content, content.indexOf(host)),
        rule: "remote-placeholder-asset",
        value: host,
        message: "Do not hotlink stock hosts. Download free-license images into the project (assets/), record source and license in EVIDENCE.md, and reference the local files.",
      });
    }
  }
}

// Emoji doing the work of icons is a generated-UI tell; a single accent is
// fine, a system of them is not.
{
  const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
  const distinctEmoji = new Set();
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const candidate of visibleCopyCandidates(content)) {
      for (const match of candidate.text.matchAll(emojiRe)) distinctEmoji.add(match[0]);
    }
  }
  if (distinctEmoji.size >= 3) {
    issues.push({
      severity: "warning",
      file: "(project)",
      line: 0,
      rule: "emoji-as-interface",
      value: [...distinctEmoji].slice(0, 6).join(" "),
      message: "Multiple distinct emoji act as interface icons; use one icon family (inline SVG) or typographic markers unless emoji are part of the brand.",
    });
  }
}

const uniqueIssues = [...new Map(
  issues.map((issue) => [`${issue.severity}:${issue.file}:${issue.line}:${issue.rule}:${issue.value}`, issue]),
).values()];
const blockers = uniqueIssues.filter((issue) => issue.severity === "blocker");
const warnings = uniqueIssues.filter((issue) => issue.severity === "warning");

const report = {
  target,
  filesScanned: files.length,
  blockers: blockers.length,
  warnings: warnings.length,
  issues: uniqueIssues,
};

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Copy/evidence audit: ${target}`);
  for (const issue of uniqueIssues) {
    console.log(
      `  [${issue.severity.toUpperCase()}] ${issue.file}:${issue.line} ${issue.rule}: ${JSON.stringify(issue.value)}`,
    );
    console.log(`    ${issue.message}`);
  }
  console.log(`\n${files.length} files, ${blockers.length} blockers, ${warnings.length} warnings`);
}

process.exit(blockers.length > 0 ? 1 : 0);
