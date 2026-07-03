#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  inspectOmpSystem,
  legacyRemovalTargets,
  removeOrphanPlugin,
  removeLegacyTargets,
  uninstallPlugin,
} from "../lifecycle-lib.mjs";
import { installLocal } from "../install-local.mjs";
import { uninstallSystem } from "../uninstall-system.mjs";

const packageRoot = resolve(new URL("../..", import.meta.url).pathname);
// Derive the expected version from package.json so a version bump does not break
// these lifecycle assertions.
const pkgVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function makeHome() {
  return mkdtempSync(join(tmpdir(), "omp-designer-home-"));
}

function write(path, content = "") {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function seedLegacy(home) {
  write(join(home, ".omp/agent/extensions/designer/index.ts"), "// legacy designer\n");
  for (const name of ["designer-master", "animate", "review-skill"]) {
    write(join(home, `.omp/agent/managed-skills/${name}/SKILL.md`), `---\nname: ${name}\n---\n`);
  }
  write(join(home, ".omp/agent/designer-state.json"), "{}\n");
  write(join(home, ".omp/agent/designer-traces/run.jsonl"), "{}\n");
  write(join(home, ".omp/agent/designer-gates/run.json"), "{}\n");
  write(join(home, ".omp/agent/designer-phases/run.json"), "{}\n");
}

function fakeOmp(home, { leavePluginOnUninstall = false } = {}) {
  const path = join(home, "bin", "omp");
  write(path, `#!/usr/bin/env node
const { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");
const args = process.argv.slice(2);
const home = process.env.HOME;
const pluginPath = join(home, ".omp/plugins/node_modules/omp-designer");
const lockPath = join(home, ".omp/plugins/omp-plugins.lock.json");
if (args[0] === "plugin" && args[1] === "uninstall") {
  if (!args.includes("--dry-run")) {
    ${leavePluginOnUninstall ? "" : "rmSync(pluginPath, { recursive: true, force: true });"}
    rmSync(lockPath, { force: true });
  }
  console.log(JSON.stringify({ uninstalled: "omp-designer" }));
  process.exit(0);
}
if (args[0] === "plugin" && args[1] === "link") {
  const source = args[2];
  const version = JSON.parse(readFileSync(join(source, "package.json"), "utf8")).version;
  mkdirSync(dirname(pluginPath), { recursive: true });
  rmSync(pluginPath, { recursive: true, force: true });
  symlinkSync(source, pluginPath, "dir");
  writeFileSync(lockPath, JSON.stringify({ plugins: { "omp-designer": { version, enabled: true } } }));
  console.log(JSON.stringify({ name: "omp-designer", version, path: source }));
  process.exit(0);
}
console.error("unexpected fake omp args", args);
process.exit(2);
`);
  chmodSync(path, 0o755);
  return path;
}

function quietIo() {
  const lines = [];
  return {
    lines,
    log(message = "") {
      lines.push(String(message));
    },
  };
}

test("inspection finds plugin metadata and exact legacy paths", () => {
  const home = makeHome();
  try {
    seedLegacy(home);
    const pluginPath = join(home, ".omp/plugins/node_modules/omp-designer");
    mkdirSync(dirname(pluginPath), { recursive: true });
    symlinkSync(packageRoot, pluginPath, "dir");
    write(join(home, ".omp/plugins/omp-plugins.lock.json"), JSON.stringify({
      plugins: { "omp-designer": { version: "4.0.0", enabled: true } },
    }));

    const report = inspectOmpSystem(home);
    assert.equal(report.plugin.version, pkgVersion);
    assert.equal(report.plugin.lockVersion, "4.0.0");
    assert.equal(report.legacy.extensionExists, true);
    assert.deepEqual(
      report.legacy.managedSkills.map((entry) => entry.name),
      ["animate", "designer-master", "review-skill"],
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("library cleanup can preserve state and traces", () => {
  const home = makeHome();
  try {
    seedLegacy(home);
    const before = inspectOmpSystem(home);
    const targets = legacyRemovalTargets(before);
    assert.equal(targets.some((path) => path.endsWith("designer-state.json")), false);
    assert.equal(targets.some((path) => path.endsWith("designer-traces")), false);

    removeLegacyTargets(before, { dryRun: false, log() {} });
    const after = inspectOmpSystem(home);
    assert.equal(after.legacy.extensionExists, false);
    assert.equal(after.legacy.managedSkills.length, 0);
    assert.equal(after.retainedData.stateExists, true);
    assert.equal(after.retainedData.tracesExist, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("full library cleanup removes state, traces, and obsolete runtime data", () => {
  const home = makeHome();
  try {
    seedLegacy(home);
    const before = inspectOmpSystem(home);
    removeLegacyTargets(before, { dryRun: false, purgeData: true, log() {} });
    assert.equal(existsSync(before.paths.stateFile), false);
    assert.equal(existsSync(before.paths.traces), false);
    assert.equal(existsSync(before.paths.legacyGates), false);
    assert.equal(existsSync(before.paths.legacyPhases), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("system uninstall removes all package-owned data by default", () => {
  const home = makeHome();
  try {
    seedLegacy(home);
    const io = quietIo();
    assert.equal(uninstallSystem([
      "--apply",
      "--skip-plugin",
      "--home", home,
    ], io), 0);
    const after = inspectOmpSystem(home);
    assert.equal(after.legacy.extensionExists, false);
    assert.equal(after.legacy.managedSkills.length, 0);
    assert.equal(after.legacy.gatesExist, false);
    assert.equal(after.legacy.phasesExist, false);
    assert.equal(after.retainedData.stateExists, false);
    assert.equal(after.retainedData.tracesExist, false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("keep-data is explicit and still removes load-bearing legacy files", () => {
  const home = makeHome();
  try {
    seedLegacy(home);
    const io = quietIo();
    assert.equal(uninstallSystem([
      "--apply",
      "--keep-data",
      "--skip-plugin",
      "--home", home,
    ], io), 0);
    const after = inspectOmpSystem(home);
    assert.equal(after.legacy.extensionExists, false);
    assert.equal(after.legacy.managedSkills.length, 0);
    assert.equal(after.retainedData.stateExists, true);
    assert.equal(after.retainedData.tracesExist, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("local installer rejects mixed installs unless clean is explicit", () => {
  const home = makeHome();
  try {
    seedLegacy(home);
    assert.throws(
      () => installLocal(["--home", home, "--skip-checks"], quietIo()),
      /Legacy v2 files detected/,
    );
    assert.equal(
      installLocal(["--home", home, "--skip-checks", "--clean"], quietIo()),
      0,
    );
    assert.equal(inspectOmpSystem(home).legacy.extensionExists, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("plugin dry-run never invokes the omp binary", () => {
  const messages = [];
  const result = uninstallPlugin({
    ompBinary: "/definitely/missing/omp",
    installed: true,
    dryRun: true,
    log(message) {
      messages.push(message);
    },
  });
  assert.equal(result.skipped, true);
  assert.match(messages.join("\n"), /would run/);
});

test("an orphan plugin link is removed without invoking omp", () => {
  const home = makeHome();
  try {
    const pluginPath = join(home, ".omp/plugins/node_modules/omp-designer");
    mkdirSync(dirname(pluginPath), { recursive: true });
    symlinkSync(packageRoot, pluginPath, "dir");
    const before = inspectOmpSystem(home);
    assert.equal(before.plugin.lockVersion, null);
    assert.equal(removeOrphanPlugin(before, { dryRun: false, log() {} }), true);
    assert.equal(existsSync(pluginPath), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("system uninstall removes a plugin path left behind by omp", () => {
  const home = makeHome();
  try {
    const omp = fakeOmp(home, { leavePluginOnUninstall: true });
    const pluginPath = join(home, ".omp/plugins/node_modules/omp-designer");
    mkdirSync(dirname(pluginPath), { recursive: true });
    symlinkSync(packageRoot, pluginPath, "dir");
    write(join(home, ".omp/plugins/omp-plugins.lock.json"), JSON.stringify({
      plugins: { "omp-designer": { version: "5.0.0", enabled: true } },
    }));

    assert.equal(uninstallSystem([
      "--apply",
      "--home", home,
      "--omp", omp,
    ], quietIo()), 0);
    assert.equal(inspectOmpSystem(home).plugin.exists, false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("clean local install and uninstall work in an isolated HOME", () => {
  const home = makeHome();
  try {
    seedLegacy(home);
    const omp = fakeOmp(home);
    const io = quietIo();
    assert.equal(installLocal([
      "--apply",
      "--clean",
      "--skip-checks",
      "--home", home,
      "--omp", omp,
    ], io), 0);

    const installed = inspectOmpSystem(home);
    assert.equal(installed.plugin.realpath, packageRoot);
    assert.equal(installed.plugin.version, pkgVersion);
    assert.equal(installed.plugin.lockVersion, pkgVersion);
    assert.equal(installed.legacy.extensionExists, false);
    assert.equal(installed.legacy.managedSkills.length, 0);
    assert.equal(installed.retainedData.stateExists, true);

    assert.equal(uninstallSystem([
      "--apply",
      "--home", home,
      "--omp", omp,
    ], io), 0);
    assert.equal(inspectOmpSystem(home).plugin.exists, false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error.stack || error.message);
  }
}

if (failed > 0) process.exit(1);
console.log(`\n${tests.length} lifecycle tests passed`);
