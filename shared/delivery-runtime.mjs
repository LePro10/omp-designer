import { existsSync } from "node:fs";
import { basename, delimiter, join } from "node:path";

const JS_RUNTIME = /^(node|nodejs|bun)(\.exe)?$/i;

// Words that mean a script leaves the machine: deploys, publishes, migrates a
// shared database, or pushes. Skipping a local-only build by mistake is cheap;
// shipping to production from a post-turn hook is not.
const SIDE_EFFECT = /\b(deploy|publish|release|migrate|push|upload|wrangler|vercel|netlify|firebase|convex|serverless|sls|cdk|terraform|pulumi|eas\s+(?:build|submit|update))\b/i;

const NESTED_RUN = /\b(?:(?:npm|pnpm|bun)\s+run|yarn(?:\s+run)?)\s+([\w:.@/-]+)/g;

/**
 * Binary that runs `<runtime> script.mjs`. Under omp, `process.execPath` is the
 * omp CLI itself, so spawning validators with it hits omp's flag parser or boots
 * a whole agent.
 */
export function resolveScriptRuntime(execPath = process.execPath, pathEnv = process.env.PATH ?? "", platform = process.platform) {
  if (JS_RUNTIME.test(basename(execPath))) return execPath;
  const suffix = platform === "win32" ? ".exe" : "";
  for (const name of ["node", "bun"]) {
    for (const dir of pathEnv.split(delimiter)) {
      if (!dir) continue;
      const candidate = join(dir, `${name}${suffix}`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

// Finds a side-effect word in `name`, its pre/post hooks, and any script they
// call through `npm run`/`yarn`/`pnpm run`/`bun run`.
function sideEffectIn(scripts, name, seen = new Set()) {
  if (seen.has(name)) return null;
  seen.add(name);
  for (const key of [`pre${name}`, name, `post${name}`]) {
    const body = scripts[key];
    if (typeof body !== "string") continue;
    const match = body.match(SIDE_EFFECT);
    if (match) return { script: key, word: match[1] };
    for (const [, nested] of body.matchAll(NESTED_RUN)) {
      const found = sideEffectIn(scripts, nested, seen);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Decide which package script the delivery hook may run.
 * Returns `{ script }` to run `npm run <script>`, or `{ skipped }` with a reason.
 */
export function chooseBuildScript(scripts = {}, env = process.env) {
  if (env.OMP_DESIGNER_BUILD === "0") return { skipped: "disabled by OMP_DESIGNER_BUILD=0" };
  if (typeof scripts["designer:build"] === "string") return { script: "designer:build" };
  if (typeof scripts.build !== "string") return { skipped: "no build script" };
  const hit = sideEffectIn(scripts, "build");
  if (hit) {
    return {
      skipped: `"${hit.script}" looks like it ships (matched "${hit.word}"); add a local-only "designer:build" script to check builds`,
    };
  }
  return { script: "build" };
}
