#!/usr/bin/env node
import { installLocal } from "./install-local.mjs";
import { uninstallSystem } from "./uninstall-system.mjs";

const [command, ...args] = process.argv.slice(2);

try {
  if (command === "uninstall") {
    process.exitCode = uninstallSystem(args);
  } else if (command === "install-local") {
    process.exitCode = installLocal(args);
  } else {
    console.log(`omp-designer lifecycle

Usage:
  omp-designer uninstall [--apply] [--keep-data]
  omp-designer install-local [--apply] [--clean] [--skip-checks]

Commands default to dry-run. Use --apply for system changes.`);
    process.exitCode = command && !["--help", "-h"].includes(command) ? 2 : 0;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
