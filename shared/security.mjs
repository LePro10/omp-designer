export const SECRET_PATTERNS = Object.freeze([
  { label: "npm token", regex: /npm_[A-Za-z0-9]{20,}/g },
  { label: "OpenAI/Anthropic key", regex: /sk-(?:ant-)?[A-Za-z0-9_-]{20,}/g },
  { label: "GitHub token", regex: /gh[pousr]_[A-Za-z0-9_]{20,}/g },
  { label: "AWS access key", regex: /AKIA[0-9A-Z]{16}/g },
  { label: "private key", regex: /-----BEGIN\s+(?:RSA|EC|DSA|OPENSSH)?\s*PRIVATE\s+KEY-----/g },
  { label: "JWT", regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { label: "Bearer token", regex: /Bearer\s+[A-Za-z0-9_.\-+/=]{20,}/g },
  { label: "database URI credentials", regex: /(?:postgres|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@/g },
]);

export function findSecrets(content) {
  const findings = [];
  for (const { label, regex } of SECRET_PATTERNS) {
    regex.lastIndex = 0;
    for (const match of content.matchAll(regex)) {
      findings.push({
        label,
        value: match[0],
        index: match.index ?? 0,
      });
    }
  }
  return findings;
}

export function redactSecrets(content) {
  let result = content;
  for (const { regex } of SECRET_PATTERNS) {
    regex.lastIndex = 0;
    result = result.replace(regex, "[REDACTED]");
  }
  return result;
}

// Directories never worth scanning: dependencies, VCS internals, generated
// output, and archived material that does not ship.
const SCAN_SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "test-output",
  "pi-backup (old)",
]);

// Only scan text-like files; binaries and media never carry reviewable secrets.
const SCAN_TEXT_EXT = new Set([
  ".md", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".yml", ".yaml",
  ".csv", ".txt", ".env", ".example", ".sh", ".html", ".css",
]);

async function collectScanFiles(dir, root, out, fs, path) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SCAN_SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectScanFiles(full, root, out, fs, path);
    } else if (entry.isFile()) {
      // In scope: known text extensions, plus dotfiles whose final segment is a
      // known text type (e.g. .env, .env.example) so secrets in dotfiles surface.
      const ext = path.extname(entry.name).toLowerCase();
      const lastSegment = `.${entry.name.split(".").pop().toLowerCase()}`;
      if (SCAN_TEXT_EXT.has(ext) || SCAN_TEXT_EXT.has(lastSegment)) {
        out.push(path.relative(root, full));
      }
    }
  }
}

/**
 * Walk a directory tree (repo files, dotfiles, docs, tests, examples) and
 * return every secret finding as { file, label, line, value }.
 * Skips dependencies, VCS internals, generated output, and archived backups.
 */
export async function scanTree(root) {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const files = [];
  await collectScanFiles(root, root, files, fs, path);
  const findings = [];
  for (const rel of files) {
    let content;
    try {
      content = await fs.readFile(path.join(root, rel), "utf8");
    } catch {
      continue;
    }
    // A file may opt out entirely (dedicated secret-scanner fixtures) with a
    // top-level marker; that stays auditable in the file itself.
    if (content.includes("secret-scan-allow-file")) continue;
    const lines = content.split("\n");
    for (const finding of findSecrets(content)) {
      const line = content.slice(0, finding.index).split("\n").length;
      // A single line may opt out with an inline marker (e.g. documented examples).
      if (lines[line - 1]?.includes("secret-scan-allow")) continue;
      findings.push({ file: rel, label: finding.label, line, value: finding.value });
    }
  }
  return findings;
}

