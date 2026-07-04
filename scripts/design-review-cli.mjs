#!/usr/bin/env node
/**
 * Model-backed visual design review.
 *
 * Fills the shared design-review rubric from the project's screenshots.
 * Two transports:
 *   --via omp (default): the review runs through the same omp CLI and model
 *     the pages are built with — same API, same account, zero extra setup.
 *     The model must be vision-capable; a blind model is rejected honestly.
 *   --via api: any OpenAI-compatible vision endpoint (LM Studio locally by
 *     default), for setups without an omp vision model.
 *
 * Usage:
 *   node scripts/design-review-cli.mjs --target <project> --model <model>
 *     [--via omp|api] [--base-url http://localhost:1234/v1] [--json] [--max-time 240]
 *
 * Env: DESIGNER_REVIEW_MODEL, DESIGNER_REVIEW_VIA,
 *      DESIGNER_REVIEW_BASE_URL, DESIGNER_REVIEW_API_KEY
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { REVIEW_CATEGORIES, validateReview } from "../shared/design-review.mjs";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");

function value(flag, fallback = "") {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

// Default reviewer: opencode-go/minimax-m3 (vision-capable). Users without
// access to it set --model / DESIGNER_REVIEW_MODEL to any vision model they
// have, or --via api for a local OpenAI-compatible endpoint.
const DEFAULT_REVIEW_MODEL = "opencode-go/minimax-m3:high";

const target = resolve(value("--target", "."));
const model = value("--model", process.env.DESIGNER_REVIEW_MODEL || DEFAULT_REVIEW_MODEL);
const via = value("--via", process.env.DESIGNER_REVIEW_VIA ?? "omp");
const baseUrl = value("--base-url", process.env.DESIGNER_REVIEW_BASE_URL ?? "http://localhost:1234/v1").replace(/\/$/, "");
const apiKey = process.env.DESIGNER_REVIEW_API_KEY ?? "";
const maxTime = Number(value("--max-time", "240"));


function findScreenshots(dir) {
  const results = [];
  const walk = (current, depth) => {
    if (depth > 3) return;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", "dist", ".git", "build"].includes(entry.name)) walk(full, depth + 1);
      } else if (
        /screenshot[^/]*\.png$/i.test(entry.name) ||
        (/\.png$/i.test(entry.name) && /(?:^|[/\\])screenshots$/i.test(current))
      ) {
        results.push(full);
      }
    }
  };
  walk(dir, 0);
  // Prefer full-page captures; cap the payload at three images.
  return results
    .sort((a, b) => Number(/full/i.test(b)) - Number(/full/i.test(a)))
    .slice(0, 3);
}

const screenshots = findScreenshots(target);
if (screenshots.length === 0) {
  console.error(`No screenshots found under ${target}; capture before requesting a review.`);
  process.exit(2);
}

const readDoc = (name) =>
  existsSync(join(target, name)) ? readFileSync(join(target, name), "utf8").slice(0, 3000) : "(absent)";

const categoryLines = Object.entries(REVIEW_CATEGORIES)
  .map(([key, question]) => `  "${key}": { "score": 0 | 1 | 2, "reason": "<grounded in what you see>" } // ${question}`)
  .join("\n");

const systemPrompt = [
  "You are a demanding design director reviewing a shipped landing page from its screenshots.",
  "Judge the pixels against the stated intent and against professional standards, not against effort.",
  "Score 0 = clear problem, 1 = acceptable, 2 = genuinely strong and product-specific.",
  "Most honest reviews contain several 1s; a straight-2 review is suspicious.",
  "Reply with ONLY a JSON object, no markdown fence, no prose around it.",
].join(" ");

const userText = [
  `Screenshots attached: ${screenshots.map((s) => basename(s)).join(", ")}.`,
  "", "DESIGN.md (intent):", readDoc("DESIGN.md"),
  "", "PRODUCT.md (facts):", readDoc("PRODUCT.md"),
  "", "Fill exactly this JSON shape:",
  "{",
  ` "review": {\n${categoryLines}\n },`,
  ' "verdict": "release-passable" | "usable but not good enough" | "technically valid but visually weak" | "failed",',
  ' "memorable": "<the one thing a visitor would remember, or \'nothing\'>",',
  ' "topFixes": ["<concrete fix>", "<concrete fix>", "<concrete fix>"]',
  "}",
].join("\n");

const imageParts = screenshots.map((path) => ({
  type: "image_url",
  image_url: { url: `data:image/png;base64,${readFileSync(path).toString("base64")}` },
}));

async function requestReview() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), maxTime * 1000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1800,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [{ type: "text", text: userText }, ...imageParts] },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${(await response.text()).slice(0, 400)}`);
    }
    const payload = await response.json();
    return payload?.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text) {
  for (let index = text.indexOf("{"); index >= 0; index = text.indexOf("{", index + 1)) {
    let depth = 0;
    for (let end = index; end < text.length; end += 1) {
      if (text[end] === "{") depth += 1;
      else if (text[end] === "}") {
        depth -= 1;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(text.slice(index, end + 1));
            if (parsed && typeof parsed === "object" && parsed.review) return parsed;
          } catch {
            // keep scanning later candidates
          }
          break;
        }
      }
    }
  }
  return null;
}

function requestReviewViaOmp() {
  const prompt = [
    systemPrompt,
    `First, OPEN AND LOOK AT these screenshot images with your file/image tools: ${screenshots.map((s) => basename(s)).join(", ")}.`,
    "If you cannot actually view the image contents, reply exactly CANNOT_VIEW_IMAGES and stop.",
    "Do not modify any file.",
    userText,
  ].join("\n\n");
  const result = spawnSync("omp", [
    "--cwd", target, "--model", model, "--max-time", String(maxTime), "-p", prompt,
  ], { encoding: "utf8", timeout: (maxTime + 90) * 1000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

let content;
try {
  content = via === "omp" ? requestReviewViaOmp() : await requestReview();
} catch (error) {
  console.error(`Review request failed (via ${via}, ${model}): ${error instanceof Error ? error.message : String(error)}`);
  process.exit(3);
}

if (/CANNOT_VIEW_IMAGES|cannot (?:view|see|access) (?:the )?images?/i.test(content)) {
  console.error(`Reviewer model ${model} cannot view the images; review rejected. Use a vision-capable model on the same API (omp models — images column) or --via api with a local vision endpoint.`);
  process.exit(4);
}

const parsed = extractJson(content);
if (!parsed) {
  console.error("Reviewer produced no parseable rubric JSON. Output tail:");
  console.error(String(content).slice(-1200));
  process.exit(3);
}

const validation = validateReview(parsed.review);
if (!validation.ok) {
  console.error(`Rubric invalid: ${validation.errors.join("; ")}`);
  process.exit(3);
}

const reviewDocument = {
  reviewedAt: new Date().toISOString(),
  model,
  screenshots: screenshots.map((s) => basename(s)),
  review: parsed.review,
  verdict: parsed.verdict ?? null,
  memorable: parsed.memorable ?? null,
  topFixes: Array.isArray(parsed.topFixes) ? parsed.topFixes.slice(0, 5) : [],
};

writeFileSync(join(target, "design-review.json"), `${JSON.stringify(reviewDocument, null, 2)}\n`);

if (jsonOutput) {
  console.log(JSON.stringify(reviewDocument, null, 2));
} else {
  console.log(`Design review (${model}) — verdict: ${reviewDocument.verdict}`);
  console.log(`Memorable: ${reviewDocument.memorable}`);
  for (const [key, entry] of Object.entries(parsed.review)) {
    console.log(`  ${entry.score} ${key}: ${entry.reason}`);
  }
  for (const fix of reviewDocument.topFixes) console.log(`  fix: ${fix}`);
  console.log(`Saved: ${join(target, "design-review.json")}`);
}
