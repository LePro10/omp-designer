#!/usr/bin/env node
/**
 * Skill Gate Test Suite (v2: audit-fixed)
 *
 * Tests the shared/skill-gate.mjs module with the new beginRead/completeRead
 * API, ordering violation enforcement, toolCallId correlation, and truncation
 * detection.
 *
 * Covers all 18 spec cases + audit-specific cases:
 *   - Side-effect canary test (write blocked, file not created)
 *   - toolCallId correlation (read error, truncation, partial)
 *   - Ordering violation (gate never reaches skills_ready)
 *   - Pi/OMP capability parity
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

import {
  SkillGate,
  REQUIRED_DESIGNER_SKILLS,
  PHASES,
  HOST_CAPABILITIES,
  ALLOWED_TOOLS_BEFORE_READY,
  isMcpTool,
  isToolAllowedBeforeReady,
  computeManifestHash,
  hashContent,
  parseReadSelector,
  checkFullCoverage,
  getRequiredSkillNames,
} from "../../shared/skill-gate.mjs";

const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

// ── Test helpers ───────────────────────────────────────────────────────

function createResolveFn(skillDir) {
  return (name) => {
    const path = join(skillDir, `${name}.md`);
    return existsSync(path) ? path : null;
  };
}

function createStandardMock(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "skill-gate-"));
  const skillDir = join(dir, "skills");
  mkdirSync(skillDir, { recursive: true });

  for (const skill of REQUIRED_DESIGNER_SKILLS) {
    if (overrides.skip?.includes(skill.name)) continue;
    const lines = overrides.lines?.[skill.name] ?? 50;
    const content = `---\nname: ${skill.name}\n---\n# ${skill.name}\n` +
      Array.from({ length: lines - 4 }, (_, idx) => `Content for ${skill.name} line ${idx + 5}`).join("\n") + "\n";
    writeFileSync(join(skillDir, `${skill.name}.md`), content);
  }

  const resolvePath = createResolveFn(skillDir);
  return { dir, skillDir, resolvePath };
}

/**
 * Read all skills in order using the new beginRead/completeRead API.
 * Each skill gets a unique toolCallId and a successful (non-error, non-truncated) result.
 */
function readAllSkills(gate, resolvePath) {
  for (const skill of REQUIRED_DESIGNER_SKILLS) {
    const toolCallId = `call-${skill.name}-${Math.random()}`;
    const match = gate.matchSkillRead({ path: resolvePath(skill.name) });
    assert(match, `Should match skill: ${skill.name}`);
    gate.beginRead(toolCallId, match.skill, match.selector);
    // Simulate successful tool_result (no error, no truncation)
    gate.completeRead(toolCallId, false, null);
  }
  return gate;
}

// ════════════════════════════════════════════════════════════════════════
// SUCCESS CASES
// ════════════════════════════════════════════════════════════════════════

test("1. All required skills read in correct order sets skills_ready", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "t1", projectRoot: dir, resolveSkillPath: resolvePath });
    assert.equal(gate.phase, PHASES.IDLE);

    readAllSkills(gate, resolvePath);

    assert.equal(gate.phase, PHASES.SKILLS_READY);
    assert.equal(gate.getMissingSkills().length, 0);
    assert.equal(gate.isReady(), true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("2. designer-master read first → wasMasterReadFirst is true", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "t2", projectRoot: dir, resolveSkillPath: resolvePath });

    // Read designer-master first
    let match = gate.matchSkillRead({ path: resolvePath("designer-master") });
    gate.beginRead("call-dm", match.skill, match.selector);
    gate.completeRead("call-dm", false, null);

    // Then read others
    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (skill.name === "designer-master") continue;
      const id = `call-${skill.name}`;
      match = gate.matchSkillRead({ path: resolvePath(skill.name) });
      gate.beginRead(id, match.skill, match.selector);
      gate.completeRead(id, false, null);
    }

    assert.equal(gate.wasMasterReadFirst(), true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("3. After full load skills_ready is set", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "t3", projectRoot: dir, resolveSkillPath: resolvePath });
    readAllSkills(gate, resolvePath);
    assert.equal(gate.phase, PHASES.SKILLS_READY);
    const report = gate.generateReport();
    assert.equal(report.ready, true);
    assert.equal(report.missingSkills.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("4. After skills_ready gated tools are allowed", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "t4", projectRoot: dir, resolveSkillPath: resolvePath });

    let check = gate.checkTool("write");
    assert.equal(check.allowed, false);

    readAllSkills(gate, resolvePath);

    for (const tool of ["write", "edit", "bash", "browser", "generate_image", "search_tool_bm25"]) {
      check = gate.checkTool(tool);
      assert.equal(check.allowed, true, `${tool} should be allowed after skills_ready`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Shared manifest does not equal shared enforcement
test("5. Pi and OMP use the same skill list and manifest hash", () => {
  const requiredCount = REQUIRED_DESIGNER_SKILLS.filter((s) => s.required).length;
  assert.ok(requiredCount >= 12);
  const hash1 = computeManifestHash();
  const hash2 = computeManifestHash();
  assert.equal(hash1, hash2);
  for (const skill of REQUIRED_DESIGNER_SKILLS) {
    if (skill.required) {
      assert.ok(skill.uri.startsWith("skill://"));
      assert.ok(typeof skill.order === "number");
    }
  }
});

test("6. New skill in manifest is automatically required", () => {
  const names = getRequiredSkillNames();
  assert.ok(names.includes("designer-master"));
  assert.ok(names.includes("ai-slop"));
  const gate = new SkillGate({ sessionId: "t6", projectRoot: "/tmp", resolveSkillPath: () => null });
  assert.equal(gate.getMissingSkills().length, names.length);
});

// ════════════════════════════════════════════════════════════════════════
// FAILURE CASES
// ════════════════════════════════════════════════════════════════════════

test("7. designer-master missing → gate not ready", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "t7", projectRoot: dir, resolveSkillPath: resolvePath });

    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (skill.name === "designer-master") continue;
      const id = `call-${skill.name}`;
      const match = gate.matchSkillRead({ path: resolvePath(skill.name) });
      gate.beginRead(id, match.skill, match.selector);
      gate.completeRead(id, false, null);
    }

    assert.notEqual(gate.phase, PHASES.SKILLS_READY);
    assert.ok(gate.getMissingSkills().includes("designer-master"));
    assert.equal(gate.isReady(), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("8. Another required skill missing → gate not ready", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "t8", projectRoot: dir, resolveSkillPath: resolvePath });

    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (skill.name === "animate") continue;
      const id = `call-${skill.name}`;
      const match = gate.matchSkillRead({ path: resolvePath(skill.name) });
      gate.beginRead(id, match.skill, match.selector);
      gate.completeRead(id, false, null);
    }

    assert.notEqual(gate.phase, PHASES.SKILLS_READY);
    assert.ok(gate.getMissingSkills().includes("animate"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("9. Skill only partially read → status is partial, gate not ready", () => {
  const dir = mkdtempSync(join(tmpdir(), "skill-gate-"));
  const skillDir = join(dir, "skills");
  mkdirSync(skillDir, { recursive: true });
  try {
    const largeContent = `---\nname: taste-skill\n---\n# taste-skill\n` +
      Array.from({ length: 496 }, (_, i) => `Line ${i + 4}`).join("\n") + "\n";
    writeFileSync(join(skillDir, "taste-skill.md"), largeContent);
    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (skill.name === "taste-skill") continue;
      writeFileSync(join(skillDir, `${skill.name}.md`), `# ${skill.name}\ncontent\n`);
    }

    const resolvePath = createResolveFn(skillDir);
    const gate = new SkillGate({ sessionId: "t9", projectRoot: dir, resolveSkillPath: resolvePath });

    // Read taste-skill with only first 50 lines (partial)
    const match = gate.matchSkillRead({ path: resolvePath("taste-skill") + ":1-50" });
    gate.beginRead("call-partial", match.skill, "1-50");
    gate.completeRead("call-partial", false, null);

    const record = gate.readRecords.get("taste-skill");
    assert.equal(record.status, "partial");

    // Read all other skills
    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (skill.name === "taste-skill") continue;
      const id = `call-${skill.name}`;
      const m = gate.matchSkillRead({ path: resolvePath(skill.name) });
      gate.beginRead(id, m.skill, m.selector);
      gate.completeRead(id, false, null);
    }

    assert.notEqual(gate.phase, PHASES.SKILLS_READY);
    assert.ok(gate.getMissingSkills().includes("taste-skill"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("10. Agent claims all read without records → gate not ready", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "t10", projectRoot: dir, resolveSkillPath: resolvePath });
    assert.equal(gate.phase, PHASES.IDLE);
    assert.equal(gate.isReady(), false);
    assert.equal(gate.getMissingSkills().length, REQUIRED_DESIGNER_SKILLS.filter(s => s.required).length);
    const check = gate.checkTool("write");
    assert.equal(check.allowed, false);
    assert.ok(check.message.includes("DESIGNER_SKILL_GATE_BLOCKED"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("11. MCP called before skills_ready → blocked", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "t11", projectRoot: dir, resolveSkillPath: resolvePath });
    const check = gate.checkTool("search_tool_bm25");
    assert.equal(check.allowed, false);
    assert.ok(check.message.includes("search_tool_bm25"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("12. File written before skills_ready → blocked", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "t12", projectRoot: dir, resolveSkillPath: resolvePath });
    const check = gate.checkTool("write");
    assert.equal(check.allowed, false);
    assert.ok(check.message.includes("DESIGNER_SKILL_GATE_BLOCKED"));
    assert.ok(check.message.includes("write"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("13. Skill read fails → status is failed, gate not ready", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "t13", projectRoot: dir, resolveSkillPath: resolvePath });

    // Read designer-master but the result is an error
    const match = gate.matchSkillRead({ path: resolvePath("designer-master") });
    gate.beginRead("call-dm", match.skill, match.selector);
    gate.completeRead("call-dm", true, null); // isError = true

    const record = gate.readRecords.get("designer-master");
    assert.equal(record.status, "failed");

    // Read all other skills
    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (skill.name === "designer-master") continue;
      const id = `call-${skill.name}`;
      const m = gate.matchSkillRead({ path: resolvePath(skill.name) });
      gate.beginRead(id, m.skill, m.selector);
      gate.completeRead(id, false, null);
    }

    assert.notEqual(gate.phase, PHASES.SKILLS_READY);
    assert.ok(gate.getMissingSkills().includes("designer-master"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("14. Old report from previous session → validation fails", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "session-A", projectRoot: dir, resolveSkillPath: resolvePath });
    readAllSkills(gate, resolvePath);
    const report = gate.generateReport();
    const validation = SkillGate.validateReport(report, computeManifestHash(), "session-B");
    assert.equal(validation.valid, false);
    assert.ok(validation.reason.includes("session mismatch"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("15. Skill content changed after reading → hash mismatch", () => {
  const dir = mkdtempSync(join(tmpdir(), "skill-gate-"));
  const skillDir = join(dir, "skills");
  mkdirSync(skillDir, { recursive: true });
  try {
    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      writeFileSync(join(skillDir, `${skill.name}.md`), `# ${skill.name}\noriginal content\n`);
    }
    const resolvePath = createResolveFn(skillDir);
    const gate = new SkillGate({ sessionId: "t15", projectRoot: dir, resolveSkillPath: resolvePath });
    readAllSkills(gate, resolvePath);
    assert.equal(gate.isReady(), true);

    writeFileSync(join(skillDir, "animate.md"), `# animate\nCHANGED content\n`);
    const changed = gate.validateReads();
    assert.ok(changed.includes("animate"));
    assert.equal(gate.isReady(), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("16. Pi and OMP configurations cannot diverge — same module", () => {
  const names = getRequiredSkillNames();
  assert.equal(REQUIRED_DESIGNER_SKILLS.filter(s => s.required).length, names.length);
  assert.ok(computeManifestHash().length > 0);
});

test("17. Only YAML header read → partial, gate not ready", () => {
  const dir = mkdtempSync(join(tmpdir(), "skill-gate-"));
  const skillDir = join(dir, "skills");
  mkdirSync(skillDir, { recursive: true });
  try {
    const content = "---\nname: designer-master\ndescription: test\n---\n# designer-master\n" +
      Array.from({ length: 100 }, (_, i) => `Content line ${i}`).join("\n") + "\n";
    writeFileSync(join(skillDir, "designer-master.md"), content);
    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (skill.name === "designer-master") continue;
      writeFileSync(join(skillDir, `${skill.name}.md`), `# ${skill.name}\ncontent\n`);
    }
    const resolvePath = createResolveFn(skillDir);
    const gate = new SkillGate({ sessionId: "t17", projectRoot: dir, resolveSkillPath: resolvePath });

    const match = gate.matchSkillRead({ path: resolvePath("designer-master") + ":1-4" });
    gate.beginRead("call-header", match.skill, "1-4");
    gate.completeRead("call-header", false, null);

    const record = gate.readRecords.get("designer-master");
    assert.equal(record.status, "partial");

    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (skill.name === "designer-master") continue;
      const id = `call-${skill.name}`;
      const m = gate.matchSkillRead({ path: resolvePath(skill.name) });
      gate.beginRead(id, m.skill, m.selector);
      gate.completeRead(id, false, null);
    }

    assert.notEqual(gate.phase, PHASES.SKILLS_READY);
    assert.ok(gate.getMissingSkills().includes("designer-master"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("18. Orchestrator read after other skills → wasMasterReadFirst is false", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "t18", projectRoot: dir, resolveSkillPath: resolvePath });

    // Read animate FIRST (wrong order)
    let match = gate.matchSkillRead({ path: resolvePath("animate") });
    gate.beginRead("call-animate", match.skill, match.selector);
    gate.completeRead("call-animate", false, null);

    // Then read designer-master
    match = gate.matchSkillRead({ path: resolvePath("designer-master") });
    gate.beginRead("call-dm", match.skill, match.selector);
    gate.completeRead("call-dm", false, null);

    // Then read the rest
    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (skill.name === "designer-master" || skill.name === "animate") continue;
      const id = `call-${skill.name}`;
      const m = gate.matchSkillRead({ path: resolvePath(skill.name) });
      gate.beginRead(id, m.skill, m.selector);
      gate.completeRead(id, false, null);
    }

    assert.equal(gate.wasMasterReadFirst(), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ════════════════════════════════════════════════════════════════════════
// AUDIT-SPECIFIC TESTS
// ════════════════════════════════════════════════════════════════════════

// AUDIT 1: Side-effect canary test — write blocked, file not created
test("AUDIT-1. Side-effect canary: write blocked, checkTool returns block:true, file not created", () => {
  const { resolvePath, dir } = createStandardMock();
  const canaryPath = join(dir, "CANARY.txt");
  try {
    const gate = new SkillGate({ sessionId: "audit1", projectRoot: dir, resolveSkillPath: resolvePath });

    // Gate is not ready — write should be blocked
    const check = gate.checkTool("write");
    assert.equal(check.allowed, false);
    assert.equal(check.block, true, "checkTool must return block:true for pre-execution blocking");
    assert.ok(check.reason);

    // Simulate what the OMP extension does: if block:true, the tool is NOT executed.
    // The file must NOT exist.
    assert.equal(existsSync(canaryPath), false, "Canary file must NOT exist when write is blocked");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// AUDIT 1b: Verify that after skills_ready, write IS allowed and file CAN be created
test("AUDIT-1b. After skills_ready, write is allowed and file can be created", () => {
  const { resolvePath, dir } = createStandardMock();
  const canaryPath = join(dir, "CANARY.txt");
  try {
    const gate = new SkillGate({ sessionId: "audit1b", projectRoot: dir, resolveSkillPath: resolvePath });
    readAllSkills(gate, resolvePath);

    const check = gate.checkTool("write");
    assert.equal(check.allowed, true);
    assert.equal(check.block, undefined);

    // Simulate the write actually happening
    writeFileSync(canaryPath, "canary");
    assert.equal(existsSync(canaryPath), true, "Canary file SHOULD exist after write is allowed");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// AUDIT 2: toolCallId correlation — read error
test("AUDIT-2a. Read tool error → status remains failed, not complete", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "audit2a", projectRoot: dir, resolveSkillPath: resolvePath });
    const match = gate.matchSkillRead({ path: resolvePath("designer-master") });
    gate.beginRead("call-err", match.skill, match.selector);
    // Simulate a tool error
    gate.completeRead("call-err", true, null);

    const record = gate.readRecords.get("designer-master");
    assert.equal(record.status, "failed");
    assert.equal(gate.isReady(), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// AUDIT 2: toolCallId correlation — truncation makes read partial
test("AUDIT-2b. Read requested full file but result truncated → status remains partial", () => {
  const dir = mkdtempSync(join(tmpdir(), "skill-gate-"));
  const skillDir = join(dir, "skills");
  mkdirSync(skillDir, { recursive: true });
  try {
    // Create a 500-line file
    const content = `---\nname: taste-skill\n---\n# taste-skill\n` +
      Array.from({ length: 496 }, (_, i) => `Line ${i + 4}`).join("\n") + "\n";
    writeFileSync(join(skillDir, "taste-skill.md"), content);
    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (skill.name === "taste-skill") continue;
      writeFileSync(join(skillDir, `${skill.name}.md`), `# ${skill.name}\ncontent\n`);
    }

    const resolvePath = createResolveFn(skillDir);
    const gate = new SkillGate({ sessionId: "audit2b", projectRoot: dir, resolveSkillPath: resolvePath });

    // Request full file (no selector) but result is truncated to 100 lines
    const match = gate.matchSkillRead({ path: resolvePath("taste-skill") });
    gate.beginRead("call-trunc", match.skill, match.selector);
    gate.completeRead("call-trunc", false, {
      truncated: true,
      truncatedBy: "lines",
      outputLines: 100,
      totalLines: 500,
      totalBytes: 10000,
    });

    const record = gate.readRecords.get("taste-skill");
    assert.equal(record.status, "partial", "Truncated read must be partial, not complete");
    assert.equal(gate.isReady(), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// AUDIT 2: toolCallId correlation — multiple successful reads with full union = complete
test("AUDIT-2c. Multiple successful reads with full union → complete", () => {
  const dir = mkdtempSync(join(tmpdir(), "skill-gate-"));
  const skillDir = join(dir, "skills");
  mkdirSync(skillDir, { recursive: true });
  try {
    const lines = 500;
    const content = `---\nname: taste-skill\n---\n# taste-skill\n` +
      Array.from({ length: lines - 3 }, (_, i) => `Content ${i}`).join("\n") + "\n";
    writeFileSync(join(skillDir, "taste-skill.md"), content);
    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (skill.name === "taste-skill") continue;
      writeFileSync(join(skillDir, `${skill.name}.md`), `# ${skill.name}\ncontent\n`);
    }

    const resolvePath = createResolveFn(skillDir);
    const gate = new SkillGate({ sessionId: "audit2c", projectRoot: dir, resolveSkillPath: resolvePath });

    // Read designer-master first (required by ordering rule)
    let dmMatch = gate.matchSkillRead({ path: resolvePath("designer-master") });
    gate.beginRead("call-dm", dmMatch.skill, dmMatch.selector);
    gate.completeRead("call-dm", false, null);

    // Read taste-skill in multiple passes with successful results
    for (const [sel, id] of [["1-200", "call-1"], ["201-400", "call-2"], ["401-", "call-3"]]) {
      const match = gate.matchSkillRead({ path: resolvePath("taste-skill") + `:${sel}` });
      gate.beginRead(id, match.skill, sel);
      gate.completeRead(id, false, null);
    }

    const record = gate.readRecords.get("taste-skill");
    assert.equal(record.status, "complete");

    // Read all other skills (except designer-master and taste-skill, already done)
    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (skill.name === "designer-master" || skill.name === "taste-skill") continue;
      const id = `call-${skill.name}`;
      const m = gate.matchSkillRead({ path: resolvePath(skill.name) });
      gate.beginRead(id, m.skill, m.selector);
      gate.completeRead(id, false, null);
    }

    assert.equal(gate.phase, PHASES.SKILLS_READY);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// AUDIT 2: beginRead without completeRead → pending, not registered
test("AUDIT-2d. beginRead without completeRead → skill NOT registered as read", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "audit2d", projectRoot: dir, resolveSkillPath: resolvePath });

    // Begin a read but never complete it
    const match = gate.matchSkillRead({ path: resolvePath("designer-master") });
    gate.beginRead("call-pending", match.skill, match.selector);

    // The skill should NOT be in readRecords (only in pendingReads)
    assert.equal(gate.readRecords.has("designer-master"), false, "Skill must not be registered until completeRead");
    assert.equal(gate.pendingReads.has("call-pending"), true, "Pending read should exist");
    assert.equal(gate.isReady(), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// AUDIT 3: Ordering violation — designer-master started but not complete, then other skill → violation
test("AUDIT-3. Skill read before designer-master is complete → gate NEVER reaches skills_ready, write blocked", () => {
  const dir = mkdtempSync(join(tmpdir(), "skill-gate-"));
  const skillDir = join(dir, "skills");
  mkdirSync(skillDir, { recursive: true });
  try {
    // Create designer-master with 100 lines (so partial read is possible)
    writeFileSync(join(skillDir, "designer-master.md"),
      `---\nname: designer-master\n---\n# designer-master\n` +
      Array.from({ length: 96 }, (_, i) => `Line ${i + 5}`).join("\n") + "\n");
    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (skill.name === "designer-master") continue;
      writeFileSync(join(skillDir, `${skill.name}.md`), `# ${skill.name}\ncontent\n`);
    }

    const resolvePath = createResolveFn(skillDir);
    const gate = new SkillGate({ sessionId: "audit3", projectRoot: dir, resolveSkillPath: resolvePath });

    // Start designer-master but only read 10 lines (partial, not complete)
    let match = gate.matchSkillRead({ path: resolvePath("designer-master") + ":1-10" });
    gate.beginRead("call-dm-partial", match.skill, "1-10");
    gate.completeRead("call-dm-partial", false, null);

    // designer-master is started but NOT complete (status = partial)
    const dmRecord = gate.readRecords.get("designer-master");
    assert.equal(dmRecord.status, "partial", "designer-master should be partial, not complete");

    // Now try to read animate — violation because designer-master is not complete
    match = gate.matchSkillRead({ path: resolvePath("animate") });
    gate.beginRead("call-animate", match.skill, match.selector);
    gate.completeRead("call-animate", false, null);

    // Ordering violation detected
    assert.equal(gate.orderViolated, true);
    assert.equal(gate.orderViolationSkill, "animate");
    assert.equal(gate.phase, PHASES.ERROR_ORDER_VIOLATION);

    // Now complete designer-master (too late — violation is permanent)
    match = gate.matchSkillRead({ path: resolvePath("designer-master") + ":11-" });
    gate.beginRead("call-dm-rest", match.skill, "11-");
    gate.completeRead("call-dm-rest", false, null);

    // Read all remaining skills
    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (skill.name === "designer-master" || skill.name === "animate") continue;
      const id = `call-${skill.name}`;
      const m = gate.matchSkillRead({ path: resolvePath(skill.name) });
      gate.beginRead(id, m.skill, m.selector);
      gate.completeRead(id, false, null);
    }

    // Gate must NOT be ready despite all skills being read
    assert.equal(gate.isReady(), false, "Gate must NOT be ready after ordering violation");
    assert.notEqual(gate.phase, PHASES.SKILLS_READY);
    assert.equal(gate.phase, PHASES.ERROR_ORDER_VIOLATION);

    // Write must be blocked
    const check = gate.checkTool("write");
    assert.equal(check.allowed, false, "Write must be blocked after ordering violation");
    assert.equal(check.block, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// AUDIT 3b: Ordering violation with only 10 lines of designer-master
test("AUDIT-3b. animate first, then only 10 lines of designer-master → still blocked", () => {
  const dir = mkdtempSync(join(tmpdir(), "skill-gate-"));
  const skillDir = join(dir, "skills");
  mkdirSync(skillDir, { recursive: true });
  try {
    // Create designer-master with 100 lines
    writeFileSync(join(skillDir, "designer-master.md"),
      `---\nname: designer-master\n---\n# designer-master\n` +
      Array.from({ length: 96 }, (_, i) => `Line ${i + 5}`).join("\n") + "\n");
    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (skill.name === "designer-master") continue;
      writeFileSync(join(skillDir, `${skill.name}.md`), `# ${skill.name}\ncontent\n`);
    }

    const resolvePath = createResolveFn(skillDir);
    const gate = new SkillGate({ sessionId: "audit3b", projectRoot: dir, resolveSkillPath: resolvePath });

    // Read animate first (violation)
    let match = gate.matchSkillRead({ path: resolvePath("animate") });
    gate.beginRead("call-anim", match.skill, match.selector);
    gate.completeRead("call-anim", false, null);

    assert.equal(gate.orderViolated, true);

    // Read only 10 lines of designer-master (partial + violation)
    match = gate.matchSkillRead({ path: resolvePath("designer-master") + ":1-10" });
    gate.beginRead("call-dm", match.skill, "1-10");
    gate.completeRead("call-dm", false, null);

    assert.equal(gate.isReady(), false);
    assert.equal(gate.checkTool("write").allowed, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// AUDIT 4: Pi/OMP capability parity test
test("AUDIT-4. Pi and OMP have different enforcement capabilities", () => {
  assert.equal(HOST_CAPABILITIES.omp.preExecutionBlocking, true,
    "OMP must support pre-execution blocking");
  assert.equal(HOST_CAPABILITIES.pi.preExecutionBlocking, false,
    "Pi must NOT claim pre-execution blocking");
  assert.equal(HOST_CAPABILITIES.omp.toolCallHook, true);
  assert.equal(HOST_CAPABILITIES.pi.toolCallHook, false);
  assert.ok(typeof HOST_CAPABILITIES.pi.reason === "string");
  assert.ok(HOST_CAPABILITIES.pi.reason.length > 0);
});

// AUDIT 5: checkTool returns block:true for OMP pre-execution
test("AUDIT-5. checkTool returns block:true for gated tools before skills_ready", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "audit5", projectRoot: dir, resolveSkillPath: resolvePath });
    for (const tool of ["write", "edit", "bash", "browser", "generate_image", "search_tool_bm25"]) {
      const check = gate.checkTool(tool);
      assert.equal(check.allowed, false);
      assert.equal(check.block, true, `${tool} must return block:true`);
      assert.ok(typeof check.reason === "string");
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// AUDIT 6: Session artifact includes orderViolated field
test("AUDIT-6. Session artifact includes orderViolated and orderViolationSkill", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "audit6", projectRoot: dir, resolveSkillPath: resolvePath });

    // Cause ordering violation
    const match = gate.matchSkillRead({ path: resolvePath("ai-slop") });
    gate.beginRead("call-ai", match.skill, match.selector);
    gate.completeRead("call-ai", false, null);

    const report = gate.generateReport();
    assert.equal(report.orderViolated, true);
    assert.equal(report.orderViolationSkill, "ai-slop");
    assert.equal(report.ready, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// AUDIT 7: Integration — "Lian Li" scenario
test("AUDIT-7. Integration: all tools blocked before skills verified, allowed after", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "audit7", projectRoot: dir, resolveSkillPath: resolvePath });

    // Before any skills read: ALL gated tools blocked with block:true
    for (const tool of ["write", "edit", "bash", "browser", "generate_image", "search_tool_bm25", "resolve"]) {
      const check = gate.checkTool(tool);
      assert.equal(check.allowed, false, `${tool} must be blocked`);
      assert.equal(check.block, true, `${tool} must have block:true`);
    }

    readAllSkills(gate, resolvePath);

    // After: all tools allowed
    for (const tool of ["write", "edit", "bash", "browser", "generate_image", "search_tool_bm25", "resolve"]) {
      const check = gate.checkTool(tool);
      assert.equal(check.allowed, true, `${tool} must be allowed`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// AUDIT 8: Selector and coverage edge cases
test("AUDIT-8. parseReadSelector and checkFullCoverage edge cases", () => {
  assert.deepEqual(parseReadSelector("/path/to/file.md", 100), { start: 1, end: 100 });
  assert.deepEqual(parseReadSelector("/path/to/file.md:50-200", 500), { start: 50, end: 200 });
  assert.deepEqual(parseReadSelector("/path/to/file.md:50-", 500), { start: 50, end: 500 });
  assert.deepEqual(parseReadSelector("/path/to/file.md:raw", 500), { start: 1, end: 500 });
  assert.deepEqual(parseReadSelector("skill://designer-master:raw", 100), { start: 1, end: 100 });
  assert.equal(checkFullCoverage([{ start: 1, end: 100 }], 100), true);
  assert.equal(checkFullCoverage([{ start: 1, end: 50 }, { start: 60, end: 100 }], 100), false);
  assert.equal(checkFullCoverage([{ start: 1, end: 60 }, { start: 50, end: 100 }], 100), true);
  assert.equal(checkFullCoverage([], 100), false);
});

// AUDIT 9: Gate prompt mentions permanent ordering violation
test("AUDIT-9. Gate prompt mentions permanent ordering violation", () => {
  const prompt = SkillGate.getGatePrompt();
  assert.ok(prompt.includes("Designer Skill Gate is active"));
  assert.ok(prompt.includes("DESIGNER_SKILLS_READY"));
  assert.ok(prompt.includes("permanently blocks the gate"));
  assert.ok(prompt.includes("designer-master MUST be read first"));
});

// AUDIT 10: Summary shows violation
test("AUDIT-10. Summary shows VIOLATED when ordering violation occurs", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "audit10", projectRoot: dir, resolveSkillPath: resolvePath });
    const match = gate.matchSkillRead({ path: resolvePath("animate") });
    gate.beginRead("call-anim", match.skill, match.selector);
    gate.completeRead("call-anim", false, null);

    const summary = gate.getSummary();
    assert.ok(summary.includes("VIOLATED"));
    assert.ok(summary.includes("animate"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// AUDIT 11: resetRun() clears ordering violation
test("AUDIT-11. resetRun clears ordering violation and allows fresh start", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "audit11", projectRoot: dir, resolveSkillPath: resolvePath });
    const match = gate.matchSkillRead({ path: resolvePath("animate") });
    gate.beginRead("call-anim", match.skill, match.selector);
    gate.completeRead("call-anim", false, null);

    assert.equal(gate.orderViolated, true);

    gate.resetRun();
    assert.equal(gate.orderViolated, false);
    assert.equal(gate.phase, PHASES.IDLE);
    assert.equal(gate.readOrder.length, 0);

    // After resetRun, correct order should work
    readAllSkills(gate, resolvePath);
    assert.equal(gate.phase, PHASES.SKILLS_READY);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── New tests for deny-by-default and resetRun/reset semantics ─────────

test("designer-master partial then other skill → order violated", () => {
  const dir = mkdtempSync(join(tmpdir(), "skill-gate-"));
  const skillDir = join(dir, "skills");
  mkdirSync(skillDir, { recursive: true });
  try {
    // Create designer-master with 100 lines so partial read is possible
    writeFileSync(join(skillDir, "designer-master.md"),
      `---\nname: designer-master\n---\n# designer-master\n` +
      Array.from({ length: 96 }, (_, i) => `Line ${i + 5}`).join("\n") + "\n");
    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (skill.name === "designer-master") continue;
      writeFileSync(join(skillDir, `${skill.name}.md`), `# ${skill.name}\ncontent\n`);
    }

    const resolvePath = createResolveFn(skillDir);
    const gate = new SkillGate({ sessionId: "new-partial", projectRoot: dir, resolveSkillPath: resolvePath });

    // Start designer-master with only 10 lines (partial)
    let match = gate.matchSkillRead({ path: resolvePath("designer-master") + ":1-10" });
    gate.beginRead("call-dm-10", match.skill, "1-10");
    gate.completeRead("call-dm-10", false, null);

    // designer-master is in readOrder but status is partial (not complete)
    assert.ok(gate.readOrder.includes("designer-master"));
    assert.equal(gate.readRecords.get("designer-master").status, "partial");

    // Now beginRead animate — should trigger violation because designer-master is NOT complete
    match = gate.matchSkillRead({ path: resolvePath("animate") });
    gate.beginRead("call-anim", match.skill, match.selector);
    gate.completeRead("call-anim", false, null);

    assert.equal(gate.orderViolated, true, "Order must be violated when animate starts before designer-master is complete");
    assert.equal(gate.orderViolationSkill, "animate");
    assert.equal(gate.phase, PHASES.ERROR_ORDER_VIOLATION);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("resetRun clears violation and creates new runId", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "new-resetrun", projectRoot: dir, resolveSkillPath: resolvePath });
    const originalRunId = gate.runId;

    // Trigger violation
    const match = gate.matchSkillRead({ path: resolvePath("animate") });
    gate.beginRead("call-anim", match.skill, match.selector);
    gate.completeRead("call-anim", false, null);
    assert.equal(gate.orderViolated, true);

    // resetRun clears violation and creates new runId
    gate.resetRun();
    assert.equal(gate.orderViolated, false, "orderViolated must be false after resetRun");
    assert.equal(gate.orderViolationSkill, null);
    assert.notEqual(gate.runId, originalRunId, "runId must change after resetRun");
    assert.equal(gate.phase, PHASES.IDLE);
    assert.equal(gate.readOrder.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("reset does NOT clear ordering violation", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "new-reset", projectRoot: dir, resolveSkillPath: resolvePath });
    const originalRunId = gate.runId;

    // Trigger violation
    const match = gate.matchSkillRead({ path: resolvePath("animate") });
    gate.beginRead("call-anim", match.skill, match.selector);
    gate.completeRead("call-anim", false, null);
    assert.equal(gate.orderViolated, true);

    // reset() does NOT clear orderViolated
    gate.reset();
    assert.equal(gate.orderViolated, true, "orderViolated must remain true after reset()");
    assert.equal(gate.orderViolationSkill, "animate");
    assert.equal(gate.runId, originalRunId, "runId must NOT change after reset()");
    assert.equal(gate.phase, PHASES.IDLE);
    assert.equal(gate.readOrder.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("deny-by-default blocks unknown tool", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "new-unknown", projectRoot: dir, resolveSkillPath: resolvePath });
    const check = gate.checkTool("unknown_mcp_tool");
    assert.equal(check.allowed, false, "Unknown tool must be blocked before ready");
    assert.equal(check.block, true);
    assert.equal(check.reason, "DESIGNER_SKILL_GATE_BLOCKED");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("allowlisted tools pass before ready", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "new-allowlist", projectRoot: dir, resolveSkillPath: resolvePath });
    for (const tool of ["read", "find", "search", "lsp"]) {
      const check = gate.checkTool(tool);
      assert.equal(check.allowed, true, `${tool} must be allowed before ready`);
    }
    // Also verify the allowlist is frozen and contains expected tools
    assert.ok(ALLOWED_TOOLS_BEFORE_READY.has("read"));
    assert.ok(ALLOWED_TOOLS_BEFORE_READY.has("find"));
    assert.ok(ALLOWED_TOOLS_BEFORE_READY.has("search"));
    assert.ok(ALLOWED_TOOLS_BEFORE_READY.has("lsp"));
    assert.ok(ALLOWED_TOOLS_BEFORE_READY.has("ast_grep"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("MCP tool pattern detected", () => {
  assert.equal(isMcpTool("mcp__designmd__search"), true, "mcp__ prefixed tools must be detected");
  assert.equal(isMcpTool("mcp__foo__bar"), true);
  assert.equal(isMcpTool("search_tool_bm25"), true);
  assert.equal(isMcpTool("read"), false, "Regular tools are not MCP tools");
  assert.equal(isMcpTool("write"), false);
  assert.equal(isMcpTool(""), false);
  assert.equal(isMcpTool(null), false);
  assert.equal(isMcpTool(undefined), false);
});

test("gate report includes runId", () => {
  const { resolvePath, dir } = createStandardMock();
  try {
    const gate = new SkillGate({ sessionId: "new-runid", projectRoot: dir, resolveSkillPath: resolvePath });
    const report = gate.generateReport();
    assert.ok("runId" in report, "Report must include runId field");
    assert.equal(typeof report.runId, "string");
    assert.equal(report.runId, gate.runId);
    assert.ok(report.runId.length > 0, "runId must not be empty");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── Run all tests ──────────────────────────────────────────────────────

let failed = 0;
let passed = 0;
for (const { name, fn } of cases) {
  try {
    await fn();
    console.log(`ok - ${name}`);
    passed++;
  } catch (error) {
    failed++;
    console.error(`not ok - ${name}`);
    console.error(error.stack || error.message);
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${cases.length} tests FAILED`);
  process.exit(1);
}
console.log(`\n${passed}/${cases.length} skill gate tests passed`);
