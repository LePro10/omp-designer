#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  formatInspection,
  inspectOmpSystem,
  runCommand,
} from "./lifecycle-lib.mjs";
import { uninstallSystem } from "./uninstall-system.mjs";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function value(args, flag, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function packageVersion() {
  return JSON.parse(readFileSync(resolve(PACKAGE_ROOT, "package.json"), "utf8")).version;
}

export function installLocal(args = process.argv.slice(2), io = console) {
  if (args.includes("--help") || args.includes("-h")) {
    io.log(`Usage: omp-designer install-local [--apply] [--clean] [--skip-checks] [--home <path>] [--omp <binary>]

Default is a dry-run.
--apply        Run checks and link this checkout with 'omp plugin link'.
--clean        First uninstall the current plugin and remove known v2 leftovers.
--skip-checks  Skip npm test and npm run check:release.

Use this only from a source checkout. Published installs should use:
  omp install npm:omp-designer@latest`);
    return 0;
  }

  const dryRun = !args.includes("--apply");
  const clean = args.includes("--clean");
  const skipChecks = args.includes("--skip-checks");
  const home = value(args, "--home", homedir());
  const ompBinary = value(args, "--omp", "omp");
  const before = inspectOmpSystem(home);
  const conflicts = before.legacy.extensionExists || before.legacy.managedSkills.length > 0;

  io.log(`omp-designer local install ${packageVersion()} (${dryRun ? "dry-run" : "apply"})`);
  io.log(`source: ${PACKAGE_ROOT}`);
  io.log(formatInspection(before));

  if (conflicts && !clean) {
    throw new Error("Legacy v2 files detected. Re-run with --clean, or run the uninstaller first.");
  }

  if (dryRun) {
    if (clean) io.log("would clean the registered plugin and known legacy v2 paths");
    if (!skipChecks) io.log("would run npm test and npm run check:release");
    io.log(`would run ${ompBinary} plugin link ${PACKAGE_ROOT} --force --scope user --json`);
    io.log("\nNo changes made. Re-run with --apply.");
    return 0;
  }

  if (clean || before.plugin.exists || before.plugin.lockVersion !== null) {
    uninstallSystem([
      "--apply",
      "--keep-data",
      "--home", home,
      "--omp", ompBinary,
    ], io);
  }

  if (!skipChecks) {
    runCommand("npm", ["test"], { cwd: PACKAGE_ROOT });
    runCommand("npm", ["run", "check:release"], { cwd: PACKAGE_ROOT });
  }

  runCommand(ompBinary, [
    "plugin",
    "link",
    PACKAGE_ROOT,
    "--force",
    "--scope",
    "user",
    "--json",
  ], {
    quiet: true,
    env: { ...process.env, HOME: home },
  });

  const after = inspectOmpSystem(home);
  io.log("\nAfter install:");
  io.log(formatInspection(after));
  if (!after.plugin.exists || after.plugin.realpath !== PACKAGE_ROOT) {
    throw new Error("Local plugin link was not created at the expected source path.");
  }
  if (after.plugin.version !== packageVersion()) {
    throw new Error(`Linked version mismatch: expected ${packageVersion()}, found ${after.plugin.version ?? "unknown"}.`);
  }
  if (after.legacy.extensionExists || after.legacy.managedSkills.length > 0) {
    throw new Error("Legacy files remain after install.");
  }

  io.log("\nLocal install complete. Fully restart omp, then run /designer-doctor.");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = installLocal();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
