# Designer Improvement Loop

You are improving the **omp-designer** package — a `/designer` extension for oh-my-pi that turns coding agents into UI/UX design specialists.

**Your workspace:** this directory (`~/projects/projects/designer`)

## The project at a glance

```
omp-designer/
├── extension/index.ts           ← omp extension (8-step workflow + 12 skills)
├── extensions/designer.ts       ← Pi extension
├── skills/
│   ├── designer-master.md       ← 8-step autonomous workflow
│   ├── ai-slop.md               ← Canonical anti-slop definition (679 lines)
│   ├── taste-skill.md           ← Anti-slop rules, AI tells, pre-flight
│   ├── product-md.md            ← Brief capture + EVIDENCE.md template
│   ├── design-md.md             ← Design system spec
│   ├── reference-study.md       ← Study real websites
│   ├── visual-critique.md       ← Screenshot evaluation + mobile QA
│   ├── copywriting.md           ← Human copy rules
│   ├── scroll-choreography.md   ← Narrative motion patterns
│   ├── animate.md               ← Animation patterns + easing
│   ├── review-skill.md          ← Post-build audit + dimension evaluation
│   └── ui-ux-pro-max.md         ← Design intelligence
├── data/
│   ├── ui-ux-pro-max/           ← 1.7 MB design database (GREP, never read full)
│   │   ├── colors.csv           ← 161 color palettes (primary palette source)
│   │   ├── typography.csv       ← 57 font pairings
│   │   └── ...                  ← styles, UX guidelines
│   └── scroll-templates.tsx     ← 5 reusable scroll patterns
├── scripts/
│   ├── fix-ai-slop.mjs          ← Read-only anti-slop validator; --fix mutates
│   ├── analyze-layout.mjs       ← Layout + palette + motion validator
│   ├── check-release.mjs        ← Version + secret hygiene release gate
│   ├── eval-suite.mjs           ← Golden prompt corpus validator/scorer
│   ├── audit-trace.mjs          ← JSONL run trace auditor
│   └── __tests__/               ← 30 regression tests (validators, layout, trace, prompt)
├── eval/                        ← Golden prompt corpus (20 prompts, 15 categories)
├── test-output/                 ← Test projects
└── docs/problems.md             ← Known issues + fixes
```

The installed copy lives at `~/.omp/agent/managed-skills/` (skills get copied there on `omp install`). Use `/designer-doctor` to check installed extension/script/skill/MCP state. Designer run traces are JSONL files under `~/.omp/agent/designer-traces/`. In omp, `session_stop` automatically runs `fix-ai-slop --check` + `analyze-layout` for generated projects before final responses.

## What you're doing

Iteratively making this system produce **better design output**. You have full freedom to:

- Modify any skill file (`skills/*.md`)
- Modify the extension code (`extension/index.ts`, `extensions/designer.ts`)
- Modify the CSV data (`data/ui-ux-pro-max/*.csv`)
- Try new approaches, experiment, compare different strategies
- Research what works in other systems and steal the best ideas
- Add new files, remove dead code, restructure things
- Run `npx impeccable detect` on test output to catch AI slop
- Run `npm run test:eval` to validate the golden prompt corpus
- Use `node scripts/eval-suite.mjs commands --out test-output/eval` for reproducible full-corpus model runs
- Use `node scripts/audit-trace.mjs <trace.jsonl> --strict` to verify claims about validator/build execution

## How each round works

### Step 1 — Pick what to improve

Read the system. What's the weakest link? Check:
- `docs/problems.md` — known issues
- The skills — are the rules clear enough? Missing anything?
- The extension — is the PROMPT_INJECT good? Does it wire everything correctly?
- The CSV data — are the palettes curated well?

Pick ONE thing to focus on this round.

### Step 2 — Research before changing

**Always look at what exists outside before guessing.** Search the web:

- `impeccable.style/slop` — the full 46 anti-patterns catalog. Read the ones you're not catching.
- "best [SaaS/portfolio/ecommerce] landing page design 2025"
- "award winning web design examples" — Awwwards, Fwa, CSS Design Awards
- What v0.dev, bolt.new, Lovable produce — what looks good, what doesn't
- "CSS scroll-driven animations 2025", "view transitions API", "container queries"
- "typography hierarchy best practices web design"
- "color theory accessible web design"
- "AI generated UI detection patterns"

Look at real sites. Don't guess what looks good — see what actually works.

### Step 3 — Make your change

ONE focused change per round. Examples:
- Tighten anti-slop rules in taste-skill
- Improve the PROMPT_INJECT in extension/index.ts
- Add better palette selection logic to designer-master
- Fix the workflow steps
- Curate better default palettes in the CSV
- Add animation patterns to animate skill
- Improve the review checklist
- Fix any issue from docs/problems.md

### Step 4 — Test with the REAL designer system

The test needs to use the actual `/designer` system — extension, PROMPT_INJECT, skill loading, everything.

⚠️ **CRITICAL: The state must go back to `false` IMMEDIATELY after the test.** If it stays `true`, the loop agent's NEXT message will trigger the designer extension — injecting PROMPT_INJECT and skills into the loop agent's context. The loop agent is NOT a designer, it's a developer. It must NOT get polluted with design context.

⚠️ **CRITICAL: Always test in a dedicated test folder.** The test agent must create projects inside `~/projects/projects/designer/test-output/` so output is isolated and easy to find. Add this to every prompt: `cd ~/projects/projects/designer/test-output && <rest of prompt>`.

```bash
# 1. Activate designer mode for the test
write '{"enabled":true}' to ~/.omp/agent/designer-state.json

# 2. Run the test (separate process — gets the designer context)
#    Always start with: cd ~/projects/projects/designer/test-output &&
omp -p --model <model> --thinking high --max-time 600 \
  "cd ~/projects/projects/designer/test-output && <prompt>"

# 3. IMMEDIATELY deactivate — before your next message
write '{"enabled":false}' to ~/.omp/agent/designer-state.json
```

**Why this works:** When `designer-state.json` is `true`, the extension's `before_agent_start` hook fires and injects PROMPT_INJECT while `resources_discover` exposes the managed skill files. The `omp -p` process gets this because it starts a fresh agent session while the state is `true`. Setting it back to `false` right after ensures the loop agent (you) doesn't get polluted on its next turn.

For regression rounds, don't invent a fresh one-off prompt first. Start with `eval/prompts.jsonl`, then add a new prompt only if it captures a new failure class.

### Realistic test prompts (use these, not sanitized briefs)

Real users don't write structured briefs. They write messy, vague, demanding messages. Test with prompts that match reality. Rotate between these — don't always use the same one:

**Prompt A — The vague dreamer:**
```
i want to create a stunning website about ai. surprise me. i want various pages effects animations scroll thing and so on. create me a plan first and then i will approve it. make me happy and surprise me with your stunning skills.
```

**Prompt B — The feature dumper:**
```
build me a landing page for my saas tool called flowboard. it does project management. i need hero section with animations, feature cards, pricing table, testimonials, a cta section, and footer. use react and tailwind. make it look premium and modern. add scroll animations and hover effects. dark mode would be cool too.
```

**Prompt C — The comparison shopper:**
```
create an e-commerce product page for handmade ceramics. think apple product page vibes but for pottery. big hero image, smooth scroll effects, product gallery, add to cart section. make it feel luxury but not cold.
```

**Prompt D — The "just make it look good":**
```
i need a portfolio site for a developer. blog section too. just make it look really good, i trust you. no generic stuff please.
```

**Prompt E — The copy-paste brief:**
```
Create a modern SaaS landing page for a project management tool called FlowBoard. Use React + Tailwind CSS. Include: Hero, Features, Pricing, CTA, Footer. Include real animations. Write real, non-generic copy. After building, run npm run build and npx impeccable detect src/
```

**Key insight:** The system must handle ALL of these — vague, demanding, messy, structured. If it only works with a perfectly formatted brief, it's broken.

### IMPORTANT: Re-install after changes

You MUST re-install the package after changing skills, so the installed copy at `~/.omp/agent/managed-skills/` reflects your changes:

```bash
# After modifying skills/ in this project:
cd ~/projects/projects/designer
omp install . --force
# OR manually copy:
cp skills/*.md ~/.omp/agent/managed-skills/designer-master/SKILL.md  # etc.
```

Actually, the simplest way — after any skill change, copy the changed file to the right place:

```bash
# Example: after editing skills/taste-skill.md
cp skills/taste-skill.md ~/.omp/agent/managed-skills/taste-skill/SKILL.md
```

For extension changes (`extension/index.ts`), you need to re-install:

```bash
cd ~/projects/projects/designer && omp install . --force
# ALSO copy to the installed location (omp install sometimes misses the extension):
cp extension/index.ts ~/.omp/agent/extensions/designer/index.ts
```

### Step 5 — Evaluate what DeepSeek produced

Look at the actual output. Be honest:

**Colors:**
- Does it use AI-slop hex codes? (#667eea, #764ba2, purple gradients)
- Did it pick from the CSV or invent colors?
- Is there only one accent color?

**Layout:**
- Is it just 3 identical cards in a row?
- Is there visual variety in section layouts?
- Does it use proper spacing (4px grid)?

**Copy:**
- Are there em-dashes (—)?
- Generic buzzwords ("revolutionary", "cutting-edge", "seamless", "unlock", "empower")?
- Fake testimonials or fake company names ("Trusted by Vercel, Linear, Stripe")?
- **Fake-precision numbers** ("47% faster", "89% adoption", "12x ROI")? These are the #1 AI tell.


**Animation:**
- Real scroll-triggered animations or just `transition: all 0.3s`?
- Proper easing or bounce/elastic everywhere?

**Technical:**
- Does it build without errors?
- Did `npx impeccable detect` pass?

**Score it 1-10. Be harsh. Most AI output is a 4-6.**

### Step 6 — Compare and decide

- Score improved → keep this change, note it, move to next weakness
- Score dropped or same → **revert immediately**, try a different approach
- Not sure → test with a different brief to check generality

### Step 7 — Log what you did

Keep notes. What you changed, why, score before/after. This helps you track what actually works.

## Iteration Log

### Iteration 9 (2026-07-01)
**Hypothesis:** Adversarial validator testing reveals false negatives; mechanical phase tracking converts text instructions into observable facts.
**Changes:**
- Fixed 3 validator bugs: TypeScript `returns` false positive, Unicode `×` multiplier false negative, en-dash `–` detection gap
- Expanded buzzword list from 40 to 63 entries (added synonyms: effortless, frictionless, pioneering, groundbreaking, etc.)
- Added 5 adversarial tests (total: 30 tests, was 26)
- Added mechanical phase tracking: `idle → planning → building → reviewing → validated` based on tool call patterns
- Phase-aware session_stop validation reports current phase when validation fails
- Doctor command shows phase, files written, validators run
- Synced AGENTS.md, docs/problems.md
**Result:** All 30 tests pass. Release gate passes. TypeScript compiles clean.
**Status:** Changes NOT committed, NOT published (npm auth blocked).

### Iteration 8 (2026-06-30)
**Hypothesis:** EVIDENCE.md documentation sections trigger false positives for buzzwords and commerce claims.
**Changes:**
- Buzzword/font detectors skip avoidance context lines
- EVIDENCE.md/PRODUCT.md excluded from evidence/commerce scanning
- Confidence-zero claims blocked when used in source
**Result:** 26 tests pass.

### Iteration 7 (2026-06-30)
**Hypothesis:** Conflicting "always Grill Me" rules cause inconsistent behavior.
**Changes:**
- 4 explicit interaction modes: Guided, Adaptive, Autonomous, Batch
- Prompt contract tests guard against drift
**Result:** 8 prompt contract tests pass.

### Iteration 6 (2026-06-30)
**Hypothesis:** Complex layouts need tablet breakpoint coverage.
**Changes:**
- `hasTabletBreakpoint()` in analyze-layout.mjs
- Complex grids require explicit `lg:` breakpoint handling
**Result:** 5 layout tests pass.

### Iteration 5 (2026-06-30)
**Hypothesis:** CSV palette rules are too rigid — user brand colors should be allowed.
**Changes:**
- `readAllowedNonCsvColors()` reads Source:user hex colors from PRODUCT.md/DESIGN.md
- Common surface colors still allowed
**Result:** 3 layout tests for brand color logic.

### Iteration 4 (2026-06-30)
**Hypothesis:** Need reproducible regression testing.
**Changes:**
- Golden prompt corpus: `eval/prompts.jsonl` (20 prompts, 15 categories)
- Eval harness: `eval-suite.mjs`
- Trace audit: `audit-trace.mjs`
**Result:** Corpus validation passes.

### Iteration 3 (2026-06-30)
**Hypothesis:** Agent forgets to run post-build validators.
**Changes:**
- `session_stop` hook auto-runs `fix-ai-slop --check` + `analyze-layout`
- Internal continuation on failure (blocks shipping)
**Result:** Auto-validation traced in JSONL.

### Iteration 2 (2026-06-30)
**Hypothesis:** No observability into what the agent actually did.
**Changes:**
- JSONL run trace in extension
- `/designer-doctor` command
**Result:** Trace events: designer_enabled/disabled, skills_discovered, prompt_injected, agent_start/end, tool_call/result.

### Iteration 1 (2026-06-30)
**Hypothesis:** Validator scripts mutate files during read-only checks.
**Changes:**
- `fix-ai-slop.mjs` default mode is `--check` (read-only); `--fix` is explicit
- `check-release.mjs` release gate
- 7 validator regression tests
**Result:** 7 tests pass. Release gate passes.

## Testing notes

- ⚠️ **Designer state must be `false` when the loop agent is working.** Only set it `true` for the `omp -p` test, then immediately back to `false`.
- The test agent (`omp -p`) gets the REAL designer system when state is `true` — PROMPT_INJECT + all 5 skills loaded automatically
- **Test output goes in `~/projects/projects/designer/test-output/`** — always `cd` there first in the prompt
- After changing skills, copy them to `~/.omp/agent/managed-skills/` so the test picks them up
- After changing extension code, run `omp install . --force` AND manually copy: `cp extension/index.ts ~/.omp/agent/extensions/designer/index.ts`
- Designer state is global — `~/.omp/agent/designer-state.json`
- The test agent CAN run `npx impeccable detect` — use it
- Use `--max-time 600` (10 min) to give the model enough time to build
- **Use realistic prompts** — vague, messy, demanding. Not sanitized structured briefs.
- **Rotate models** — don't always test with the same one. Try free tiers when paid is rate-limited.

## Rules

- ONE change per round. Don't rewrite everything at once.
- Always RESEARCH before changing. Don't guess what looks good.
- If a change makes things worse, REVERT immediately.
- Test with realistic prompts — vague, messy, demanding. Not sanitized briefs.
- After hitting 8+, test with different prompts to verify generality.
- The CSV data is the source of truth for colors/fonts. Never let the agent invent palettes.
- Always test in `~/projects/projects/designer/test-output/` — never in the project root.
- You can modify ANYTHING — skills, extension, CSV data, add new files, restructure.
