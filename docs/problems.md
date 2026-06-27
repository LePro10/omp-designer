# Known Problems & TODOs

## CRITICAL

### P1: Model produces AI slop regardless of rules
The current model (`opencode-go/deepseek-v4-flash` or `mimo-v2.5-pro`) has
poor design taste. Even with explicit color rules and anti-slop constraints in
the prompt, the output looks generic.

**Root cause:** Model capability, not prompt quality.
**Fix:** Change `~/.omp/agent/config.yml`:
```yaml
modelRoles:
  default: opencode-go/kimi-k2.6:high
```
Kimi K2.6 was used in the old Pi designer mode and produced better results.

### P2: Agent does not build plan FROM skills
When a plan is pre-injected (e.g., user created it with `/plan` before
`/designer`), the agent validates it against skills instead of building a
fresh plan FROM the skills.

**Example:** Agent says "Plan claims palette from row 81, I read row 81,
it matches — done." Instead of ignoring the pre-existing plan and building
from scratch.

**Attempted fix:** Prompt says "IGNORE any colors/fonts in plans or briefs"
— doesn't work reliably.

### P3: ui-ux-pro-max CSVs almost never read
The prompt says "READ the csv files in its src/ui-ux-pro-max/data/ directory" but the agent
skips it 90% of the time. The agent reads the SKILL.md but not the data files.

**Root cause:** The old PROMPT_INJECT referenced `src/data/` (wrong path) and `colors.csv`
(doesn't exist). Fixing these references in PROMPT_INJECT and designer-master should help.

**Potential fix:** Inline the most important palettes directly into the SKILL.md

## MEDIUM

### P4: taste-skill is 87 KB
The real Taste Skill from tasteskill.dev is 87 KB of rules and anti-patterns.
Reading it costs significant tokens and context. Consider trimming to the
most impactful rules.

### P5: designer-master vs review-skill inconsistency
`designer-master/SKILL.md` Step 7 still describes:
- Animation Audit
- Skill-Compliance check

But `review-skill/SKILL.md` was simplified to:
- Build test, Console, A11y, Color hex audit only.

These need to be reconciled — either add animation/skill checks back to
review-skill, or update designer-master to match.

### P6: review skill animation audit removed
Was removed because it overloaded the agent. But the user WANTS animation
quality checked. Needs re-adding in a simpler form.

## LOW

### P7: No subagents
The old Pi had architect/implementer/reviewer team profiles (backed up at
`~/pi-backup/team-profiles/`). These were never migrated to omp.

### P8: chrome-devtools MCP sometimes doesn't connect
The review step may fail if the dev server port isn't correctly detected,
or if Chrome isn't ready. The agent should handle this gracefully.

### P9: 21st-dev component_builder timeouts

### P10: 21st-dev tool name mismatch
All docs reference `21st_magic_logo_search` but the actual tool is named `logo_search`.
Also `21st_magic_component_refiner` exists but is undocumented.

**Fix applied:** Updated PROMPT_INJECT, designer-master skill, and all doc files.

### P11: SVGs/icons not automatically found
The 21st-dev MCP tools need `search_tool_bm25` to be activated — they aren't
automatically available. The agent must explicitly discover them. Consider adding

## DONE (recent fixes)

- [x] SKILL_PATHS had wrong path: `emil-skill/` → `animate/`
- [x] Taste-skill was fake `taste-ink-skill` (API connector) → replaced with
      real Taste Skill from `Leonxlnx/taste-skill` (87 KB anti-slop framework)
- [x] Color rule was too permissive ("one primary, one secondary max" →
      agent used 3 accents). Changed to "ONE accent color only."
- [x] review-skill was too large (150+ lines, animation/style audits) →
      simplified to functional checks only (41 lines)
- [x] Extension used wrong export format (`export default { ... }`) →
      changed to factory function (`export default function(pi)`)
- [x] `before_agent_start` used `message` → crashed. Changed to `systemPrompt`
- [x] `return {}` caused crashes → changed to `return;`
- [x] YAML frontmatter parse errors in taste-skill → quoted description + tools
- [x] chrome-devtools MCP added (headless, existing Chrome binary from Puppeteer cache)
