#!/usr/bin/env node
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import {
  formatInspection,
  inspectOmpSystem,
  removeOrphanPlugin,
  removeLegacyTargets,
  uninstallPlugin,
} from "./lifecycle-lib.mjs";

function value(args, flag, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

export function uninstallSystem(args = process.argv.slice(2), io = console) {
  if (args.includes("--help") || args.includes("-h")) {
    io.log(`Usage: omp-designer uninstall [--apply] [--keep-data] [--home <path>] [--omp <binary>]

Default is a dry-run.
--apply      Remove the registered plugin and all package-owned OMP data.
--keep-data  Preserve designer state and traces for a local reinstall.

MCP configuration and credentials are never modified.`);
    return 0;
  }

  const dryRun = !args.includes("--apply");
  const keepData = args.includes("--keep-data");
  const purgeData = !keepData;
  const home = value(args, "--home", homedir());
  const ompBinary = value(args, "--omp", "omp");
  const skipPlugin = args.includes("--skip-plugin");
  const before = inspectOmpSystem(home);

  io.log(`omp-designer system uninstall (${dryRun ? "dry-run" : "apply"})`);
  io.log(formatInspection(before));

  if (!skipPlugin) {
    if (!removeOrphanPlugin(before, {
      dryRun,
      log: (message) => io.log(message),
    })) {
      uninstallPlugin({
        ompBinary,
        installed: before.plugin.lockVersion !== null,
        dryRun,
        env: { ...process.env, HOME: home },
        log: (message) => io.log(message),
      });
      if (dryRun && before.plugin.exists) {
        io.log(`would verify and remove orphan plugin path ${before.paths.pluginPath} if omp leaves it behind`);
      } else if (!dryRun) {
        removeOrphanPlugin(inspectOmpSystem(home), {
          dryRun: false,
          log: (message) => io.log(message),
        });
      }
    }
  }
  removeLegacyTargets(before, {
    dryRun,
    purgeData,
    log: (message) => io.log(message),
  });

  if (dryRun) {
    io.log("\nNo changes made. Re-run with --apply.");
    return 0;
  }

  const after = inspectOmpSystem(home);
  io.log("\nAfter cleanup:");
  io.log(formatInspection(after));
  if (after.plugin.exists || after.legacy.extensionExists || after.legacy.managedSkills.length > 0) {
    throw new Error("Cleanup incomplete; inspect the paths above.");
  }
  if (purgeData && (
    after.retainedData.stateExists ||
    after.retainedData.tracesExist ||
    after.legacy.gatesExist ||
    after.legacy.phasesExist
  )) {
    throw new Error("Full cleanup incomplete; designer state, trace, gate, or phase data remains.");
  }
  io.log("\nUninstall complete. Restart omp before testing another installation.");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = uninstallSystem();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
