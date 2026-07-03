#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const PACKAGE_NAME = "omp-designer";

export const LEGACY_SKILL_NAMES = Object.freeze([
  "ai-slop",
  "animate",
  "copywriting",
  "design-md",
  "designer-master",
  "product-md",
  "reference-study",
  "review-skill",
  "scroll-choreography",
  "taste-skill",
  "ui-ux-pro-max-skill",
  "visual-critique",
]);

export function ompPaths(home = homedir()) {
  const ompRoot = join(home, ".omp");
  const agentRoot = join(ompRoot, "agent");
  return {
    home,
    ompRoot,
    agentRoot,
    pluginPath: join(ompRoot, "plugins", "node_modules", PACKAGE_NAME),
    pluginLock: join(ompRoot, "plugins", "omp-plugins.lock.json"),
    legacyExtension: join(agentRoot, "extensions", "designer"),
    managedSkillsRoot: join(agentRoot, "managed-skills"),
    stateFile: join(agentRoot, "designer-state.json"),
    traces: join(agentRoot, "designer-traces"),
    legacyGates: join(agentRoot, "designer-gates"),
    legacyPhases: join(agentRoot, "designer-phases"),
  };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function packageVersionAt(path) {
  const manifest = readJson(join(path, "package.json"));
  return typeof manifest?.version === "string" ? manifest.version : null;
}

function linkTarget(path) {
  try {
    if (!lstatSync(path).isSymbolicLink()) return null;
    return resolve(join(path, ".."), readlinkSync(path));
  } catch {
    return null;
  }
}

export function inspectOmpSystem(home = homedir()) {
  const paths = ompPaths(home);
  const lock = readJson(paths.pluginLock);
  const lockEntry = lock?.plugins?.[PACKAGE_NAME] ?? null;
  const managedSkills = LEGACY_SKILL_NAMES
    .map((name) => ({ name, path: join(paths.managedSkillsRoot, name) }))
    .filter((entry) => existsSync(entry.path));
  const pluginExists = existsSync(paths.pluginPath);
  const pluginTarget = linkTarget(paths.pluginPath);
  let pluginRealpath = null;
  try {
    pluginRealpath = pluginExists ? realpathSync(paths.pluginPath) : null;
  } catch {
    pluginRealpath = null;
  }

  return {
    paths,
    plugin: {
      exists: pluginExists,
      target: pluginTarget,
      realpath: pluginRealpath,
      version: pluginExists ? packageVersionAt(paths.pluginPath) : null,
      lockVersion: typeof lockEntry?.version === "string" ? lockEntry.version : null,
      lockEnabled: lockEntry?.enabled === true,
    },
    legacy: {
      extensionExists: existsSync(paths.legacyExtension),
      managedSkills,
      gatesExist: existsSync(paths.legacyGates),
      phasesExist: existsSync(paths.legacyPhases),
    },
    retainedData: {
      stateExists: existsSync(paths.stateFile),
      tracesExist: existsSync(paths.traces),
    },
  };
}

export function legacyRemovalTargets(report, { purgeData = false } = {}) {
  const targets = [];
  if (report.legacy.extensionExists) targets.push(report.paths.legacyExtension);
  targets.push(...report.legacy.managedSkills.map((entry) => entry.path));
  if (purgeData) {
    for (const path of [
      report.paths.legacyGates,
      report.paths.legacyPhases,
      report.paths.stateFile,
      report.paths.traces,
    ]) {
      if (existsSync(path)) targets.push(path);
    }
  }
  return targets;
}

function assertOwnedTarget(path, report, purgeData) {
  const allowed = new Set(legacyRemovalTargets(report, { purgeData }));
  if (!allowed.has(path)) {
    throw new Error(`Refusing to remove non-owned path: ${path}`);
  }
}

export function removeLegacyTargets(report, {
  dryRun = true,
  purgeData = false,
  log = console.log,
} = {}) {
  const targets = legacyRemovalTargets(report, { purgeData });
  for (const path of targets) {
    assertOwnedTarget(path, report, purgeData);
    log(`${dryRun ? "would remove" : "remove"} ${path}`);
    if (!dryRun) rmSync(path, { recursive: true, force: true });
  }
  return targets;
}

export function removeOrphanPlugin(report, {
  dryRun = true,
  log = console.log,
} = {}) {
  if (!report.plugin.exists || report.plugin.lockVersion !== null) return false;
  const path = report.paths.pluginPath;
  if (path !== ompPaths(report.paths.home).pluginPath) {
    throw new Error(`Refusing to remove unexpected plugin path: ${path}`);
  }
  log(`${dryRun ? "would remove orphan plugin path" : "remove orphan plugin path"} ${path}`);
  if (!dryRun) rmSync(path, { recursive: true, force: true });
  return true;
}

export function runCommand(command, args, {
  cwd,
  env = process.env,
  allowFailure = false,
  quiet = false,
} = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: quiet ? "pipe" : "inherit",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    const detail = quiet ? `\n${result.stdout ?? ""}${result.stderr ?? ""}`.trimEnd() : "";
    throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}.${detail}`);
  }
  return result;
}

export function uninstallPlugin({
  ompBinary = "omp",
  installed = true,
  dryRun = true,
  env = process.env,
  log = console.log,
} = {}) {
  if (!installed) {
    log("plugin not registered; skip omp plugin uninstall");
    return { skipped: true, status: 0 };
  }
  const args = ["plugin", "uninstall", PACKAGE_NAME];
  log(`${dryRun ? "would run" : "run"} ${ompBinary} ${args.join(" ")}`);
  if (dryRun) return { skipped: true, status: 0 };
  const result = runCommand(ompBinary, args, { quiet: true, allowFailure: true, env });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(`Plugin uninstall failed (${result.status}): ${output}`);
  }
  return result;
}

export function formatInspection(report) {
  const lines = [
    `plugin: ${report.plugin.exists ? `${report.plugin.version ?? "unknown"} (${report.plugin.realpath ?? "unresolved"})` : "not installed"}`,
    `plugin lock: ${report.plugin.lockVersion ?? "none"}${report.plugin.lockEnabled ? " enabled" : ""}`,
    `legacy extension: ${report.legacy.extensionExists ? "present" : "none"}`,
    `legacy managed skills: ${report.legacy.managedSkills.length}${report.legacy.managedSkills.length ? ` (${report.legacy.managedSkills.map((entry) => entry.name).join(", ")})` : ""}`,
    `state retained: ${report.retainedData.stateExists ? "yes" : "no"}`,
    `traces retained: ${report.retainedData.tracesExist ? "yes" : "no"}`,
  ];
  return lines.join("\n");
}
