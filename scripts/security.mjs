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

