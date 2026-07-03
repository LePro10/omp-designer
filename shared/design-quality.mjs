/**
 * Designer-quality behavior signals and report aggregation.
 *
 * These are non-blocking telemetry signals, not a revived skill-read gate. They
 * describe what the output looks like it did (artifacts present, claims sourced,
 * responsiveness, navigation, motion restraint) so behavior is observable.
 *
 * Each signal carries a `basis`:
 *   automatic    - derived deterministically from validator output or source
 *   heuristic    - inferred (task type, appropriateness) and may be wrong
 *   unavailable  - not observable from static artifacts (e.g. skill reads, Q&A)
 *
 * Nothing here enforces anything. Blocking stays with the validators' own
 * blocker severity and the release/security gates.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { emptyReview } from "./design-review.mjs";

// Warning-level validator rules that are stylistic suggestions rather than
// quality harm are surfaced as `info` in the aggregated report.
const INFO_RULES = new Set([
  "copy-cadence",
  "vague-marketing-language",
  "generic-copy-pattern",
  "remote-placeholder-asset",
  "transition-all",
  "long-motion-duration",
  "undocumented-source-color",
  "palette-row-deviation",
]);

const SOURCE_EXT = new Set([".tsx", ".jsx", ".ts", ".js", ".css", ".html", ".vue", ".svelte"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".next", ".git", "coverage", ".output", "test-output"]);

function readSource(projectDir) {
  if (!projectDir || !existsSync(projectDir)) return "";
  const chunks = [];
  let budget = 3000;
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (budget-- <= 0) return;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name));
      } else if (SOURCE_EXT.has(extname(entry.name))) {
        try {
          chunks.push(readFileSync(join(dir, entry.name), "utf8"));
        } catch {
          // ignore unreadable file
        }
      }
    }
  };
  walk(projectDir);
  return chunks.join("\n");
}

function isSmallEdit(userPrompt) {
  const p = userPrompt ?? "";
  const editish = /\b(?:improve only|only (?:the|its)\b|edit\b|tweak|adjust|small change|fix the|update the|change the)\b/i.test(p);
  const buildish = /\b(?:build|create|design a|new (?:page|site|app|landing)|landing page|from scratch|website|web app)\b/i.test(p);
  return editish && !buildish;
}

function wantsMultipleRoutes(userPrompt) {
  return /\b(?:various|multiple|several|many|multi[- ]?page)\s+(?:pages?|routes?)\b/i.test(userPrompt ?? "") ||
    /\bpages?\b[\s\S]{0,80}\b(?:various|multiple|several|many)\b/i.test(userPrompt ?? "");
}

function delegatesArtDirection(userPrompt) {
  return /\b(?:surprise me|your call|you decide|designer'?s? choice|up to you|whatever (?:you think|looks best))\b/i.test(userPrompt ?? "");
}

function issueRules(report) {
  return Array.isArray(report?.issues) ? report.issues : [];
}

function hasRule(report, rule) {
  return issueRules(report).some((issue) => issue.rule === rule);
}

function hasSeverity(report, severity) {
  return issueRules(report).some((issue) => issue.severity === severity);
}

/**
 * Split validator issues into blocker / warning / info. Blockers and functional
 * warnings stay; purely stylistic warnings become info so taste never blocks.
 */
export function classifyIssues(quality, layout) {
  const blockers = [];
  const warnings = [];
  const info = [];
  const push = (issue, source) => {
    const tagged = { source, ...issue };
    if (issue.severity === "blocker") blockers.push(tagged);
    else if (issue.severity === "warning") (INFO_RULES.has(issue.rule) ? info : warnings).push(tagged);
    else info.push(tagged);
  };
  for (const issue of issueRules(quality)) push(issue, "quality");
  for (const issue of issueRules(layout)) push(issue, "layout");
  return { blockers, warnings, info };
}

const signal = (value, basis, note) => (note ? { value, basis, note } : { value, basis });

/**
 * Derive non-blocking behavior signals from the project and validator output.
 * `quality` and `layout` are the JSON reports from fix-ai-slop / analyze-layout.
 * `composition` (optional) is the real-agent-eval composition summary.
 */
export function extractBehaviorSignals({ projectDir, userPrompt = "", quality = null, layout = null, composition = null } = {}) {
  const smallEdit = isSmallEdit(userPrompt);
  const source = readSource(projectDir);
  const hasProduct = projectDir ? existsSync(join(projectDir, "PRODUCT.md")) : false;
  const hasDesign = projectDir ? existsSync(join(projectDir, "DESIGN.md")) : false;
  const hasEvidence = projectDir ? existsSync(join(projectDir, "EVIDENCE.md")) : false;

  const factRules = new Set([
    "unsupported-percentage", "unsupported-multiplier", "unsupported-count",
    "unsupported-price", "unsupported-release-status", "unsupported-commerce-claim",
  ]);
  const hasFactFindings = issueRules(quality).some((i) => factRules.has(i.rule) || i.rule === "unsupported-social-proof");

  const hasNav = /<nav\b|role=["']navigation["']|<(?:Link|NavLink)\b|aria-label=["'][^"']*nav/i.test(source);
  const hasRouter = /react-router|createBrowserRouter|<Routes?\b|useRouter|next\/link|@remix-run|vue-router|svelte-kit|astro/i.test(source);

  const signals = {
    // Grounding artifacts, judged only where appropriate (build, not small edit).
    productMdWhenAppropriate: smallEdit ? signal("n/a", "heuristic", "small edit") : signal(hasProduct, "heuristic"),
    designMdWhenAppropriate: smallEdit ? signal("n/a", "heuristic", "small edit") : signal(hasDesign, "heuristic"),
    evidenceMdWhenClaims: hasFactFindings ? signal(hasEvidence, "heuristic", "claim-like copy detected") : signal("n/a", "heuristic", "no claim-like copy detected"),

    // Claim integrity, straight from the validator.
    avoidedUnsupportedNumbers: quality ? signal(!issueRules(quality).some((i) => factRules.has(i.rule) && i.severity === "blocker"), "automatic") : signal("n/a", "unavailable"),
    avoidedFakeSocialProof: quality ? signal(!hasRule(quality, "unsupported-social-proof"), "automatic") : signal("n/a", "unavailable"),
    avoidedNonfunctionalActions: quality ? signal(!(hasRule(quality, "nonfunctional-action") || hasRule(quality, "nonfunctional-signup")), "automatic") : signal("n/a", "unavailable"),

    // Responsiveness / mobile: source-level proxy, not real device QA.
    mobileLayoutChecked: layout ? signal(!hasRule(layout, "responsive-hints-missing"), "heuristic", "source responsiveness proxy, not device QA") : signal("n/a", "unavailable"),
    horizontalMobileFallback: layout && hasRule(layout, "horizontal-mobile-fallback") ? signal(false, "automatic") : signal(!source ? "n/a" : true, "heuristic"),

    // Navigation, only when multiple routes are requested or present.
    navigationChecked: (wantsMultipleRoutes(userPrompt) || hasRouter)
      ? signal(hasNav || hasRouter, "heuristic")
      : signal("n/a", "heuristic", "no multi-route requirement detected"),

    // Motion restraint / reduced motion.
    reducedMotionRespected: layout
      ? (hasRule(layout, "reduced-motion-missing") ? signal(false, "automatic") : signal(true, "heuristic", "no reduced-motion problem detected"))
      : signal("n/a", "unavailable"),
    motionNotSoleDependency: composition
      ? signal((composition.motionComponents ?? 0) < 8, "heuristic")
      : signal("n/a", "unavailable"),

    // Non-genericity: needs composition signals or human review.
    avoidedGenericComposition: composition
      ? signal((composition.signals?.length ?? 0) === 0, "heuristic", "equal-grid / rounded-surface proxy")
      : signal("n/a", "unavailable", "run with composition signals or human review"),

    // Intent handling that static artifacts cannot prove.
    surpriseMeDelegated: signal(delegatesArtDirection(userPrompt), "automatic"),
    honoredSurpriseMeWithoutExtraQuestions: delegatesArtDirection(userPrompt)
      ? signal("n/a", "unavailable", "turn-level Q&A is not observable from artifacts")
      : signal("n/a", "heuristic", "not delegated"),
    obeyedExplicitUserDecisions: signal("n/a", "unavailable", "requires transcript/human review"),
  };

  return signals;
}

/**
 * Assemble the full designer-quality report. `review` is an optional rubric
 * (defaults to a blank one for a reviewer to fill).
 */
export function buildDesignQualityReport({ projectDir, userPrompt = "", quality = null, layout = null, composition = null, review = null } = {}) {
  const { blockers, warnings, info } = classifyIssues(quality, layout);
  return {
    designReview: {
      basis: "human-or-model-reviewed",
      categories: review ?? emptyReview(),
    },
    behaviorSignals: extractBehaviorSignals({ projectDir, userPrompt, quality, layout, composition }),
    blockers,
    warnings,
    info,
    skillReadObservability: {
      status: "unavailable",
      reason: "host does not expose skill read events",
    },
  };
}
