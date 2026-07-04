#!/usr/bin/env node
/**
 * Build a local gallery of all real-agent runs: screenshots, scores, slop
 * rules, and visual-review verdicts side by side, so a human can compare
 * outputs in one place instead of opening JSON reports one by one.
 *
 * Output: test-output/gallery.html (local file, never packed or published).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const outputRoot = join(root, "test-output");
const reportsDir = join(outputRoot, "reports");

if (!existsSync(reportsDir)) {
  console.error("No test-output/reports directory; run real-agent evals first.");
  process.exit(1);
}

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const entries = [];
for (const file of readdirSync(reportsDir)) {
  if (!file.endsWith(".json")) continue;
  let report;
  try {
    report = JSON.parse(readFileSync(join(reportsDir, file), "utf8"));
  } catch {
    continue;
  }
  const name = file.replace(/\.json$/, "");
  const dir = join(outputRoot, name);
  if (!existsSync(dir)) continue;

  const shots = [];
  const walk = (current, depth) => {
    if (depth > 2) return;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory() && !["node_modules", "dist", ".git"].includes(entry.name)) walk(full, depth + 1);
      else if (/screenshot[^/]*\.png$/i.test(entry.name)) shots.push(relative(outputRoot, full));
    }
  };
  walk(dir, 0);

  let review = null;
  if (existsSync(join(dir, "design-review.json"))) {
    try {
      review = JSON.parse(readFileSync(join(dir, "design-review.json"), "utf8"));
    } catch {
      review = null;
    }
  }

  entries.push({
    name,
    generatedAt: report.generatedAt ?? "",
    caseName: report.case ?? "",
    model: report.model ?? "",
    score: report.candidate?.score ?? null,
    blockers: (report.candidate?.quality?.blockers ?? 0) + (report.candidate?.layout?.blockers ?? 0),
    warnings: report.candidate?.warnings ?? null,
    worstBlankRun: report.candidate?.screenshotEvidence?.worstBlankRun ?? null,
    slop: report.candidate?.slopRuleHits ?? [],
    verdict: review?.verdict ?? null,
    memorable: review?.memorable ?? null,
    shots: shots.sort((a, b) => Number(/full/i.test(b)) - Number(/full/i.test(a))).slice(0, 2),
  });
}

entries.sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)));

const cards = entries.map((entry) => `
  <article>
    <header>
      <h2>${escapeHtml(entry.name)} <small>${escapeHtml(entry.caseName)}</small></h2>
      <p>
        score <strong>${entry.score ?? "—"}</strong> ·
        blockers ${entry.blockers} · warnings ${entry.warnings ?? "—"} ·
        worst blank ${entry.worstBlankRun ?? "—"}
        ${entry.slop.length ? ` · slop: ${escapeHtml(entry.slop.join(", "))}` : ""}
      </p>
      ${entry.verdict ? `<p class="verdict">reviewer: <strong>${escapeHtml(entry.verdict)}</strong> — ${escapeHtml(entry.memorable ?? "")}</p>` : ""}
      <p class="meta">${escapeHtml(entry.model)} · ${escapeHtml(entry.generatedAt)}</p>
    </header>
    <div class="shots">
      ${entry.shots.map((shot) => `<a href="${escapeHtml(shot)}"><img loading="lazy" src="${escapeHtml(shot)}" alt="${escapeHtml(entry.name)}"></a>`).join("")}
    </div>
  </article>`).join("\n");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>omp-designer run gallery</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 2rem; background: #fafaf8; color: #1a1a1a; }
  h1 { font-size: 1.4rem; } h2 { font-size: 1.05rem; margin: 0; } h2 small { color: #888; font-weight: normal; }
  article { border-top: 1px solid #ddd; padding: 1.2rem 0; }
  .shots { display: flex; gap: 1rem; margin-top: .6rem; overflow-x: auto; }
  .shots img { width: 320px; max-height: 560px; object-fit: cover; object-position: top; border: 1px solid #ccc; background: #fff; }
  .meta { color: #999; font-size: .8rem; } .verdict { color: #7a3b06; }
  p { margin: .2rem 0; }
</style></head><body>
<h1>omp-designer run gallery — ${entries.length} runs</h1>
${cards}
</body></html>
`;

writeFileSync(join(outputRoot, "gallery.html"), html);
console.log(`Wrote test-output/gallery.html (${entries.length} runs).`);
