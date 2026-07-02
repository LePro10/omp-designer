/**
 * Designer Skill Gate — Shared Core Logic (v2: audit-fixed)
 *
 * Single source of truth for:
 * - Required skill manifest (used by both Pi and OMP extensions)
 * - State machine (idle → loading_skills → skills_ready → … → done)
 * - Skill-read tracking with content hashing, line-coverage, and
 *   toolCallId correlation (reads are only registered after successful tool_result)
 * - Tool-gating logic (block gated tools before execution via tool_call { block: true })
 * - Ordering enforcement (designer-master must be read first — violation is permanent)
 *
 * Both extension/index.ts (OMP) and extensions/designer.ts (Pi) import from
 * this file. No separate skill lists or gate logic may exist elsewhere.
 *
 * Capabilities differ between hosts:
 * - OMP: pre-execution blocking via tool_call { block: true } — no side effects
 * - Pi:  no tool_call/tool_result hooks — prompt-only enforcement
 */

import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

// ── Phases ─────────────────────────────────────────────────────────────

export const PHASES = Object.freeze({
  IDLE: "idle",
  LOADING_SKILLS: "loading_skills",
  SKILLS_READY: "skills_ready",
  DISCOVERY: "discovery",
  BRIEF_READY: "brief_ready",
  PLAN_READY: "plan_ready",
  APPROVED: "approved",
  BUILDING: "building",
  VALIDATING: "validating",
  DONE: "done",
  ERROR_ORDER_VIOLATION: "error_order_violation",
});

export const PHASE_ORDER = Object.freeze([
  PHASES.IDLE,
  PHASES.LOADING_SKILLS,
  PHASES.SKILLS_READY,
  PHASES.DISCOVERY,
  PHASES.BRIEF_READY,
  PHASES.PLAN_READY,
  PHASES.APPROVED,
  PHASES.BUILDING,
  PHASES.VALIDATING,
  PHASES.DONE,
]);

/**
 * Phases at or beyond which the skill gate is open.
 * Once skills_ready is reached, gated tools are allowed.
 */
export const PAST_GATE_PHASES = new Set([
  PHASES.SKILLS_READY,
  PHASES.DISCOVERY,
  PHASES.BRIEF_READY,
  PHASES.PLAN_READY,
  PHASES.APPROVED,
  PHASES.BUILDING,
  PHASES.VALIDATING,
  PHASES.DONE,
]);

// ── Host capabilities ──────────────────────────────────────────────────

/**
 * OMP supports pre-execution blocking: tool_call handlers can return
 * { block: true, reason: "..." } and the tool is never executed.
 * This is verified from the OMP Extension API source:
 *   shared-events.ts → ToolCallEventResult { block?: boolean; reason?: string }
 *   extensions/types.ts → "Fired before a tool executes. Can block."
 */
export const HOST_CAPABILITIES = Object.freeze({
  omp: {
    preExecutionBlocking: true,
    skillReadTracking: true,
    sessionStopValidation: true,
    toolCallHook: true,
    toolResultHook: true,
    sessionStopHook: true,
    traceLogging: true,
    phaseInference: true,
    doctorCommand: true,
    reason: "OMP Extension API supports tool_call { block: true }, tool_result, session_stop, agent_start/end, resources_discover",
  },
  pi: {
    preExecutionBlocking: false,
    skillReadTracking: false,
    sessionStopValidation: false,
    toolCallHook: false,
    toolResultHook: false,
    sessionStopHook: false,
    traceLogging: false,
    phaseInference: false,
    doctorCommand: false,
    mode: "prompt-only",
    reason: "Pi Extension API only exposes before_agent_start and registerCommand. No tool interception hooks exist. Skill reading relies on model compliance with prompt instructions. For guaranteed enforcement, use OMP.",
  },
});

// ── Skill Manifest (THE central source of truth) ───────────────────────

export const REQUIRED_DESIGNER_SKILLS = Object.freeze([
  { name: "designer-master",     uri: "skill://designer-master",     order: 0,  required: true, phases: ["all"] },
  { name: "ai-slop",             uri: "skill://ai-slop",             order: 1,  required: true, phases: ["all"] },
  { name: "product-md",          uri: "skill://product-md",          order: 2,  required: true, phases: ["all"] },
  { name: "taste-skill",         uri: "skill://taste-skill",         order: 3,  required: true, phases: ["all"] },
  { name: "design-md",           uri: "skill://design-md",           order: 4,  required: true, phases: ["all"] },
  { name: "ui-ux-pro-max",       uri: "skill://ui-ux-pro-max",       order: 5,  required: true, phases: ["all"] },
  { name: "reference-study",     uri: "skill://reference-study",     order: 6,  required: true, phases: ["all"] },
  { name: "copywriting",         uri: "skill://copywriting",         order: 7,  required: true, phases: ["all"] },
  { name: "scroll-choreography", uri: "skill://scroll-choreography", order: 8,  required: true, phases: ["all"] },
  { name: "animate",             uri: "skill://animate",             order: 9,  required: true, phases: ["all"] },
  { name: "visual-critique",     uri: "skill://visual-critique",     order: 10, required: true, phases: ["all"] },
  { name: "review-skill",        uri: "skill://review-skill",        order: 11, required: true, phases: ["all"] },
]);

// ── Tool classification ───────────────────────────────────────────────
//
// Before skills_ready, only these tools are allowed (deny-by-default).
// Everything else — including unknown tools and dynamic MCP tools — is blocked.

export const ALLOWED_TOOLS_BEFORE_READY = Object.freeze(new Set([
  // Read-only file/code inspection
  "read", "find", "search", "lsp", "ast_grep",
  // Memory and session management (no side effects on user projects)
  "recall", "reflect", "retain", "memory_edit",
  "checkpoint", "rewind", "todo", "irc", "job",
  // Reporting only
  "report_tool_issue",
  // NOTE: eval and debug are NOT allowed — eval can write files via kernel
  // write() helper, debug can launch processes. Both have real side effects.
]));

/**
 * Check if a tool name matches a dynamic MCP tool pattern.
 * MCP tools are named like mcp__server__tool or search_tool_bm25.
 * All MCP tools are blocked before skills_ready.
 */
export function isMcpTool(toolName) {
  if (!toolName || typeof toolName !== "string") return false;
  return toolName.startsWith("mcp__") || toolName === "search_tool_bm25";
}

/**
 * Check if a tool is allowed before skills_ready.
 * Deny-by-default: only tools in the allowlist are permitted.
 */
export function isToolAllowedBeforeReady(toolName) {
  if (ALLOWED_TOOLS_BEFORE_READY.has(toolName)) return true;
  // MCP tools are always blocked before readiness
  if (isMcpTool(toolName)) return false;
  // Unknown tools are blocked (deny-by-default)
  return false;
}

// ── Utility functions ──────────────────────────────────────────────────

export function hashContent(content) {
  return createHash("sha256").update(content, "utf-8").digest("hex").slice(0, 16);
}

export function computeManifestHash() {
  const canonical = REQUIRED_DESIGNER_SKILLS.map((s) => ({
    name: s.name,
    uri: s.uri,
    order: s.order,
    required: s.required,
  }));
  return hashContent(JSON.stringify(canonical));
}

export function getRequiredSkillNames() {
  return REQUIRED_DESIGNER_SKILLS.filter((s) => s.required).map((s) => s.name);
}

export function getSkillByName(name) {
  return REQUIRED_DESIGNER_SKILLS.find((s) => s.name === name) ?? null;
}

export function isGatedTool(toolName) {
  return GATED_TOOLS.has(toolName);
}

/**
 * Compute metadata for all required skill files.
 */
export function computeSkillMetadata(resolveSkillPath) {
  const metadata = new Map();
  for (const skill of REQUIRED_DESIGNER_SKILLS) {
    if (!skill.required) continue;
    const path = resolveSkillPath(skill.name);
    if (!path || !existsSync(path)) {
      metadata.set(skill.name, {
        name: skill.name,
        path: path ?? "(missing)",
        totalLines: 0,
        totalBytes: 0,
        fileHash: "missing",
        lineOffsets: [0],
      });
      continue;
    }
    const content = readFileSync(path, "utf-8");
    const lines = content.split("\n");
    const lineOffsets = [0];
    for (let i = 0; i < lines.length; i++) {
      const lineBytes = Buffer.byteLength(lines[i], "utf-8") + 1;
      lineOffsets.push(lineOffsets[i] + lineBytes);
    }
    metadata.set(skill.name, {
      name: skill.name,
      path,
      totalLines: lines.length,
      totalBytes: Buffer.byteLength(content, "utf-8"),
      fileHash: hashContent(content),
      lineOffsets,
    });
  }
  return metadata;
}

/**
 * Parse a read-tool path/URI to extract the line-range selector.
 */
export function parseReadSelector(rawPath, totalLines) {
  if (!rawPath || typeof rawPath !== "string") {
    return { start: 1, end: Math.min(300, totalLines) };
  }

  let selector = "";
  let basePath = rawPath;

  const skillUriMatch = rawPath.match(/^(skill:\/\/[^:/]+)(?::(.+))?$/);
  if (skillUriMatch) {
    selector = skillUriMatch[2] ?? "";
    basePath = skillUriMatch[1];
  } else {
    const lastColon = rawPath.lastIndexOf(":");
    if (lastColon > 0) {
      const after = rawPath.slice(lastColon + 1);
      if (/^(\d+(-\d*)?|\d+\+\d+|raw|conflicts)$/.test(after)) {
        selector = after;
        basePath = rawPath.slice(0, lastColon);
      }
    }
  }

  if (!selector) {
    return { start: 1, end: Math.min(300, totalLines) };
  }
  if (selector === "raw") {
    return { start: 1, end: totalLines };
  }
  if (selector === "conflicts") {
    return { start: 0, end: 0 };
  }
  const rangeMatch = selector.match(/^(\d+)-(\d*)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : totalLines;
    return { start, end: Math.min(end, totalLines) };
  }
  const plusMatch = selector.match(/^(\d+)\+(\d+)$/);
  if (plusMatch) {
    const start = parseInt(plusMatch[1], 10);
    const count = parseInt(plusMatch[2], 10);
    return { start, end: Math.min(start + count - 1, totalLines) };
  }
  const fromMatch = selector.match(/^(\d+)$/);
  if (fromMatch) {
    const start = parseInt(fromMatch[1], 10);
    return { start, end: Math.min(start + 299, totalLines) };
  }
  return { start: 1, end: totalLines };
}

/**
 * Check if a set of line ranges fully covers 1..totalLines.
 */
export function checkFullCoverage(ranges, totalLines) {
  if (ranges.length === 0 || totalLines === 0) return false;
  const valid = ranges.filter((r) => r.end >= r.start && r.start >= 1);
  if (valid.length === 0) return false;
  const sorted = [...valid].sort((a, b) => a.start - b.start);
  let covered = 0;
  for (const range of sorted) {
    if (range.start > covered + 1) return false;
    covered = Math.max(covered, range.end);
  }
  return covered >= totalLines;
}

/**
 * Compute bytes covered by a line range using precomputed offsets.
 */
export function rangeBytes(meta, start, end) {
  if (!meta || !meta.lineOffsets || meta.lineOffsets.length === 0) return 0;
  const s = Math.max(0, start - 1);
  const e = Math.min(end, meta.totalLines);
  return meta.lineOffsets[e] - meta.lineOffsets[s];
}

// ── PendingRead: tracks a tool_call → tool_result correlation ───────────

/**
 * @typedef {Object} PendingRead
 * @property {string} toolCallId
 * @property {object} skill
 * @property {string} selector
 * @property {{start: number, end: number}} range
 * @property {string} startedAt
 */

// ── SkillGate class ────────────────────────────────────────────────────

/**
 * @typedef {Object} SkillReadRecord
 * @property {string} name
 * @property {string} uri
 * @property {string} startedAt
 * @property {string} completedAt
 * @property {string} contentHash
 * @property {number} bytesRead
 * @property {"pending"|"partial"|"complete"|"failed"} status
 * @property {Array<{start: number, end: number}>} ranges
 */

export class SkillGate {
  /**
   * @param {Object} options
   * @param {string} options.sessionId
   * @param {string} options.projectRoot
   * @param {(name: string) => string | null} options.resolveSkillPath
   */
  constructor({ sessionId, projectRoot, resolveSkillPath }) {
    this.sessionId = sessionId;
    this.runId = randomUUID();
    this.projectRoot = projectRoot;
    this.manifestHash = computeManifestHash();
    this.resolveSkillPath = resolveSkillPath;
    this.skillMetadata = computeSkillMetadata(resolveSkillPath);
    this.phase = PHASES.IDLE;
    /** @type {Map<string, SkillReadRecord>} */
    this.readRecords = new Map();
    /** @type {string[]} */
    this.readOrder = [];
    /** @type {Array<{tool: string, timestamp: string, missing: string[]}>} */
    this.violations = [];
    /** @type {Map<string, PendingRead>} pending reads keyed by toolCallId */
    this.pendingReads = new Map();
    /** @type {boolean} ordering violation — permanent until explicit resetRun() */
    this.orderViolated = false;
    /** @type {string|null} name of the skill read before designer-master completed */
    this.orderViolationSkill = null;
  }

  /**
   * Match a tool-call input to a required skill.
   * @returns {{ skill: object, selector: string } | null}
   */
  matchSkillRead(input) {
    if (!input || typeof input !== "object") return null;
    const rawPath = typeof input.path === "string" ? input.path
      : typeof input.file === "string" ? input.file
      : typeof input.uri === "string" ? input.uri
      : "";
    if (!rawPath) return null;

    // 1) Match skill:// URI
    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (rawPath === skill.uri || rawPath.startsWith(skill.uri + ":")) {
        const sel = rawPath.length > skill.uri.length ? rawPath.slice(skill.uri.length + 1) : "";
        return { skill, selector: sel };
      }
    }

    // 2) Match by file path
    for (const [name, meta] of this.skillMetadata) {
      if (meta.path && meta.path !== "(missing)" && rawPath.startsWith(meta.path)) {
        const skill = getSkillByName(name);
        if (skill) {
          const sel = rawPath.length > meta.path.length ? rawPath.slice(meta.path.length + 1) : "";
          return { skill, selector: sel };
        }
      }
    }

    // 3) Match by skill name in path
    for (const skill of REQUIRED_DESIGNER_SKILLS) {
      if (rawPath.includes(`/${skill.name}/`) || rawPath.includes(`/${skill.name}.md`)) {
        return { skill, selector: "" };
      }
      if (skill.name === "ui-ux-pro-max" && rawPath.includes("/ui-ux-pro-max-skill/")) {
        return { skill, selector: "" };
      }
    }

    return null;
  }

  /**
   * Begin a skill read — called from tool_call handler.
   * Stores the pending read keyed by toolCallId. Does NOT register the skill
   * as read yet. The read is only registered after the tool_result confirms
   * success (no error, no truncation that breaks coverage).
   *
   * @param {string} toolCallId — unique ID from the tool_call event
   * @param {object} skill — from REQUIRED_DESIGNER_SKILLS
   * @param {string} selector — line-range selector from the read path
   * @returns {boolean} true if this was a valid skill-read attempt
   */
  beginRead(toolCallId, skill, selector) {
    const meta = this.skillMetadata.get(skill.name);
    if (!meta) return false;

    // Track read order at tool_call time (for ordering violation detection).
    // Ordering check: designer-master must be COMPLETE (not just started)
    // before any other required skill can begin.
    if (!this.readOrder.includes(skill.name)) {
      const masterRecord = this.readRecords.get("designer-master");
      const masterComplete = masterRecord?.status === "complete";

      if (skill.name !== "designer-master" && !masterComplete) {
        this.orderViolated = true;
        this.orderViolationSkill = skill.name;
        this.phase = PHASES.ERROR_ORDER_VIOLATION;
      }
      this.readOrder.push(skill.name);

      if (this.phase === PHASES.IDLE && !this.orderViolated) {
        this.phase = PHASES.LOADING_SKILLS;
      }
    }

    // Parse the selector to compute the expected range
    const range = parseReadSelector(
      selector ? `${meta.path}:${selector}` : meta.path,
      meta.totalLines,
    );

    this.pendingReads.set(toolCallId, {
      toolCallId,
      skill,
      selector,
      range,
      startedAt: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Complete a skill read — called from tool_result handler.
   * Only registers the skill as (partially or fully) read if the tool_result
   * was successful (no error) and the content was not truncated in a way
   * that breaks the claimed coverage.
   *
   * @param {string} toolCallId — unique ID matching the beginRead call
   * @param {boolean} isError — whether the tool_result had an error
   * @param {object|null} truncation — ReadToolDetails.truncation if available
   * @returns {boolean} true if the read was registered (even partially)
   */
  completeRead(toolCallId, isError, truncation) {
    const pending = this.pendingReads.get(toolCallId);
    if (!pending) return false;

    this.pendingReads.delete(toolCallId);

    const meta = this.skillMetadata.get(pending.skill.name);
    if (!meta) return false;

    // If the read errored, mark as failed (don't register coverage)
    if (isError) {
      let record = this.readRecords.get(pending.skill.name);
      if (!record) {
        record = {
          name: pending.skill.name,
          uri: pending.skill.uri,
          startedAt: pending.startedAt,
          completedAt: "",
          contentHash: "",
          bytesRead: 0,
          status: "failed",
          ranges: [],
        };
        this.readRecords.set(pending.skill.name, record);
      } else {
        record.status = "failed";
      }
      return false;
    }

    // Check if truncation reduced the actual content below the requested range
    let effectiveRange = pending.range;
    if (truncation && truncation.truncated) {
      // The result was truncated — the actual lines returned may be fewer
      // than the requested range. We can only count the lines that were
      // actually delivered, not what was requested.
      const outputLines = truncation.outputLines ?? 0;
      const truncatedBy = truncation.truncatedBy;
      // If truncated by lines, only outputLines were returned
      if (truncatedBy === "lines" || truncatedBy === "middle") {
        effectiveRange = {
          start: pending.range.start,
          end: Math.min(pending.range.start + outputLines - 1, pending.range.end),
        };
      }
      // If truncated by bytes, we can't know exact lines — be conservative
      // and treat as partial (don't claim full range coverage)
      if (truncatedBy === "bytes") {
        effectiveRange = {
          start: pending.range.start,
          end: Math.min(pending.range.start + Math.floor(outputLines * 0.8) - 1, pending.range.end),
        };
      }
    }

    // Now register the read with the effective (possibly reduced) range
    let record = this.readRecords.get(pending.skill.name);
    if (!record) {
      record = {
        name: pending.skill.name,
        uri: pending.skill.uri,
        startedAt: pending.startedAt,
        completedAt: "",
        contentHash: "",
        bytesRead: 0,
        status: "partial",
        ranges: [],
      };
      this.readRecords.set(pending.skill.name, record);
    }

    if (record.status === "complete") return true;

    record.ranges.push(effectiveRange);
    record.bytesRead += rangeBytes(meta, effectiveRange.start, effectiveRange.end);

    // Only set complete if full line coverage is achieved
    if (checkFullCoverage(record.ranges, meta.totalLines)) {
      record.completedAt = new Date().toISOString();
      record.contentHash = meta.fileHash;
      record.bytesRead = meta.totalBytes;
      record.status = "complete";
    }

    // Check if all required skills are now complete (and no ordering violation)
    this._checkReady();
    return true;
  }

  /**
   * Mark a pending read as failed (e.g., tool_call was blocked or errored).
   */
  failPendingRead(toolCallId) {
    const pending = this.pendingReads.get(toolCallId);
    if (!pending) return false;
    this.pendingReads.delete(toolCallId);

    let record = this.readRecords.get(pending.skill.name);
    if (!record) {
      record = {
        name: pending.skill.name,
        uri: pending.skill.uri,
        startedAt: pending.startedAt,
        completedAt: "",
        contentHash: "",
        bytesRead: 0,
        status: "failed",
        ranges: [],
      };
      this.readRecords.set(pending.skill.name, record);
    } else if (record.status !== "complete") {
      record.status = "failed";
    }
    return true;
  }

  /**
   * Check if all required skills are complete and transition to skills_ready.
   * Will NOT transition if an ordering violation occurred.
   * @returns {boolean} true if just transitioned
   */
  _checkReady() {
    // Ordering violation is permanent — gate can never open
    if (this.orderViolated) {
      this.phase = PHASES.ERROR_ORDER_VIOLATION;
      return false;
    }

    if (this.phase !== PHASES.LOADING_SKILLS && this.phase !== PHASES.IDLE) return false;

    const missing = this.getMissingSkills();
    if (missing.length === 0) {
      this.phase = PHASES.SKILLS_READY;
      return true;
    }
    if (this.readOrder.length > 0 && this.phase === PHASES.IDLE) {
      this.phase = PHASES.LOADING_SKILLS;
    }
    return false;
  }

  /**
   * Get names of required skills that haven't been fully read.
   * @returns {string[]}
   */
  getMissingSkills() {
    return REQUIRED_DESIGNER_SKILLS
      .filter((s) => s.required)
      .filter((s) => {
        const r = this.readRecords.get(s.name);
        return !r || r.status !== "complete";
      })
      .map((s) => s.name);
  }

  /**
   * Check if designer-master was the first skill read (at beginRead time).
   * @returns {boolean}
   */
  wasMasterReadFirst() {
    return this.readOrder[0] === "designer-master";
  }

  /**
   * Check if the gate is open (all skills read AND no ordering violation).
   * @returns {boolean}
   */
  isReady() {
    if (this.orderViolated) return false;
    return PAST_GATE_PHASES.has(this.phase);
  }

  /**
   * Check if a tool is allowed at the current phase.
   * Deny-by-default: only allowlisted tools pass before skills_ready.
   * @param {string} toolName
   * @returns {{ allowed: boolean, block?: boolean, reason?: string, message?: string, missingSkills?: string[] }}
   */
  checkTool(toolName) {
    // If gate is open, everything is allowed
    if (this.isReady()) {
      return { allowed: true };
    }

    // Deny-by-default: check allowlist
    if (isToolAllowedBeforeReady(toolName)) {
      return { allowed: true };
    }

    // Blocked — determine missing skills
    let missing;
    if (this.orderViolated) {
      missing = [`${this.orderViolationSkill} was started before designer-master completed (permanent violation — use /designer-reset)`];
    } else {
      missing = this.getMissingSkills();
    }

    this.violations.push({
      tool: toolName,
      timestamp: new Date().toISOString(),
      missing,
    });

    const message = [
      "DESIGNER_SKILL_GATE_BLOCKED:",
      `Attempted action "${toolName}" before all required skills were read.`,
      `Missing skills: ${missing.join(", ")}`,
      "",
      "Read the missing skills using their skill:// URI or file path.",
      "The extension verifies completion before unlocking the gate.",
    ].join("\n");

    return {
      allowed: false,
      block: true,
      reason: "DESIGNER_SKILL_GATE_BLOCKED",
      tool: toolName,
      missingSkills: missing,
      message,
    };
  }

  /**
   * Validate that previously-read skills still match their current file hashes.
   * @returns {string[]} names of skills whose content changed
   */
  validateReads() {
    const changed = [];
    for (const [name, record] of this.readRecords) {
      if (record.status !== "complete") continue;
      const meta = this.skillMetadata.get(name);
      if (!meta) continue;
      const path = this.resolveSkillPath(name);
      if (!path || !existsSync(path)) {
        record.status = "failed";
        changed.push(name);
        continue;
      }
      const currentHash = hashContent(readFileSync(path, "utf-8"));
      if (currentHash !== record.contentHash) {
        record.status = "partial";
        record.contentHash = "";
        record.completedAt = "";
        changed.push(name);
      }
    }
    if (changed.length > 0 && this.isReady()) {
      this.phase = PHASES.LOADING_SKILLS;
    }
    return changed;
  }

  /**
   * Transition to a new phase if the transition is valid.
   * @param {string} newPhase
   * @returns {boolean} true if transitioned
   */
  transitionTo(newPhase) {
    if (!PHASE_ORDER.includes(newPhase) && newPhase !== PHASES.ERROR_ORDER_VIOLATION) return false;

    if (newPhase === PHASES.SKILLS_READY) {
      if (this.orderViolated) return false;
      const missing = this.getMissingSkills();
      if (missing.length > 0) return false;
    }

    const currentIdx = PHASE_ORDER.indexOf(this.phase);
    const newIdx = PHASE_ORDER.indexOf(newPhase);
    if (newIdx < currentIdx && newPhase !== PHASES.LOADING_SKILLS) {
      return false;
    }

    this.phase = newPhase;
    return true;
  }

  /**
   * Reset the gate entirely (for error_order_violation recovery).
   * The caller must decide whether to allow a fresh start.
   */
  /**
   * Reset the gate for a fresh run (explicit user action via /designer-reset).
   * Creates a new runId. This is the ONLY way to clear an ordering violation.
   * NOT called automatically by session_stop.
   */
  resetRun() {
    this.runId = randomUUID();
    this.phase = PHASES.IDLE;
    this.readRecords.clear();
    this.readOrder = [];
    this.violations = [];
    this.pendingReads.clear();
    this.orderViolated = false;
    this.orderViolationSkill = null;
  }

  /**
   * @deprecated Use resetRun() instead. Kept for backward compatibility.
   * Does NOT clear ordering violations — those require explicit resetRun().
   */
  reset() {
    this.phase = PHASES.IDLE;
    this.readRecords.clear();
    this.readOrder = [];
    this.violations = [];
    this.pendingReads.clear();
    // NOTE: orderViolated is NOT cleared here
  }

  /**
   * Generate a machine-readable session artifact.
   */
  generateReport() {
    const skills = REQUIRED_DESIGNER_SKILLS
      .filter((s) => s.required)
      .map((s) => {
        const r = this.readRecords.get(s.name);
        return {
          name: s.name,
          order: s.order,
          status: r?.status ?? "pending",
          contentHash: r?.contentHash ?? "",
          bytesRead: r?.bytesRead ?? 0,
          startedAt: r?.startedAt ?? "",
          completedAt: r?.completedAt ?? "",
        };
      });

    return {
      sessionId: this.sessionId,
      runId: this.runId,
      projectRoot: this.projectRoot,
      phase: this.phase,
      manifestHash: this.manifestHash,
      skills,
      missingSkills: this.getMissingSkills(),
      ready: this.isReady(),
      masterReadFirst: this.wasMasterReadFirst(),
      orderViolated: this.orderViolated,
      orderViolationSkill: this.orderViolationSkill,
      violations: this.violations,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate a report from a previous session or a stale read.
   * @param {object} report
   * @param {string} currentManifestHash
   * @param {string} currentSessionId
   * @returns {{ valid: boolean, reason?: string }}
   */
  static validateReport(report, currentManifestHash, currentSessionId) {
    if (!report || typeof report !== "object") {
      return { valid: false, reason: "invalid report object" };
    }
    if (report.sessionId !== currentSessionId) {
      return { valid: false, reason: "session mismatch — report from different session" };
    }
    if (report.manifestHash !== currentManifestHash) {
      return { valid: false, reason: "manifest hash mismatch — skill list changed" };
    }
    if (!report.ready) {
      return { valid: false, reason: "report indicates not ready" };
    }
    if (report.orderViolated) {
      return { valid: false, reason: "ordering violation — designer-master was not read first" };
    }
    if (!Array.isArray(report.skills)) {
      return { valid: false, reason: "missing skills array" };
    }
    for (const skill of report.skills) {
      if (skill.status !== "complete") {
        return { valid: false, reason: `skill ${skill.name} not complete` };
      }
    }
    return { valid: true };
  }

  /**
   * Generate a user-facing summary after skills are loaded.
   * @returns {string}
   */
  getSummary() {
    const total = REQUIRED_DESIGNER_SKILLS.filter((s) => s.required).length;
    const complete = REQUIRED_DESIGNER_SKILLS
      .filter((s) => s.required)
      .filter((s) => this.readRecords.get(s.name)?.status === "complete").length;
    const missing = this.getMissingSkills();

    if (this.orderViolated) {
      return [
        `Designer skills loaded: ${complete}/${total}`,
        `Orchestrator: designer-master`,
        `Skill gate: VIOLATED — ${this.orderViolationSkill} was read before designer-master`,
      ].join("\n");
    }

    const ready = missing.length === 0 && !this.orderViolated;
    return [
      `Designer skills loaded: ${complete}/${total}`,
      `Orchestrator: designer-master`,
      `Skill gate: ${ready ? "ready" : "waiting (" + missing.join(", ") + ")"}`,
    ].join("\n");
  }

  /**
   * Get the prompt text explaining the gate to inject into the system prompt.
   * @returns {string}
   */
  static getGatePrompt() {
    const skillList = REQUIRED_DESIGNER_SKILLS
      .filter((s) => s.required)
      .map((s) => `  ${s.order}. ${s.name} (${s.uri})`)
      .join("\n");

    return `Designer Skill Gate is active.

The extension will first load designer-master and every required designer skill.
Planning, MCP research, file modification, and implementation remain locked until
the extension reports DESIGNER_SKILLS_READY.

Do not claim that skills were read. Wait for the verified readiness state.

Required skills (read in this order):
${skillList}

designer-master MUST be read first and completely. Reading any other skill before
designer-master permanently blocks the gate — the session cannot recover without
a full reset. No other action is permitted until all skills are verified as read.`;
  }
}
