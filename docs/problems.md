# Known Problems & TODOs

## LATEST CHANGES (v3.2)

- [x] **Grill Me enforcement:** PROMPT_INJECT now says "MANDATORY FIRST ACTION: Ask the user questions" — agent MUST ask questions before doing anything else
- [x] **Short PROMPT_INJECT:** Reduced from 180 lines to ~70 lines. Skills contain the actual rules, PROMPT_INJECT just references them.
- [x] **MCP toggling restored:** Extension enables/disables MCPs in mcp.json when /designer is toggled
- [x] **Prominent MCP section:** MCP tools listed with exact tool names and example calls
- [x] **Per-session designer state:** /designer only affects current session
- [x] **Skill reading map:** Explicit table of WHEN to read each skill

## REMAINING

### P1: Agent doesn't always read skills
The agent may skip reading skills even when told to. The PROMPT_INJECT now says "READ designer-master/SKILL.md FIRST" but the agent might not comply.
**Status:** v3.2 makes Grill Me mandatory as the FIRST action. Testing.

### P2: Em-dashes still appear
The model produces em-dashes reflexively despite the ban.
**Workaround:** fix-ai-slop.mjs catches them post-build.

### P3: Image generation not used
Agent defaults to Unsplash or CSS illustrations instead of generate_image.
**Status:** Added better prompts. Model preference issue.

### P4: Agent can't see screenshots
Model limitation. Agent can take screenshots but can't evaluate visually.
**Workaround:** Layout analysis tool + code-based critique.

### P5: CSS @import warning
Tailwind v4 generates CSS with @import after other rules.
**Status:** Warning only, doesn't break functionality.

---

## FIXED

- [x] CSVs never read → Inlined palette table in PROMPT_INJECT
- [x] Fake numbers → Banned in taste-skill + PROMPT_INJECT
- [x] Fake social proof → Banned in taste-skill + PROMPT_INJECT
- [x] Em-dashes in PROMPT_INJECT → Replaced with double-dashes
- [x] Approval conflict → Grill-Plan-Build workflow with explicit approval gate
- [x] Multi-page support → Detects "various pages" and creates React Router
- [x] Premature claims → HONESTY RULE added
- [x] MCP tools not discovered → Prominent MCP section in PROMPT_INJECT
- [x] Color palette not locked → "LOCK the palette" reinforced
- [x] JSX in template literal → Removed, replaced with text descriptions
- [x] Per-session state → State file stores per-cwd entries
- [x] MCP toggling → Extension enables/disables MCPs on toggle

---

## Test Outputs

| Project | Domain | Score | Key Feature |
|---------|--------|-------|-------------|
| test-output/orbitask/ | SaaS | 9.5/10 | Pinned scroll, bento grid |
| test-output/luna/ | Portfolio | 9.5/10 | Horizontal scroll gallery |
| test-output/flux/ | Creative Agency | 9.5/10 | Pinned horizontal scroll |
| test-output/ironpulse/ | Fitness | 9/10 | Pinned scroll, progress ring |
| test-output/kuro/ | Restaurant | 9/10 | CSS ramen bowl illustration |
| test-output/nexus/ | SaaS | 9/10 | Terminal hero, DESIGN.md |
| test-output/flowboard-landing/ | SaaS | 9/10 | Inline kanban mockup |
| test-output/forge/ | DevTools | 9/10 | Terminal hero, dark-first |
| test-output/ember-coffee/ | E-commerce | 8.5/10 | Pinned timeline |
| test-output/aperture/ | AI narrative | 8.5/10 | 7 sections, canvas |
| test-output/syncboard-landing/ | SaaS | 8.5/10 | Animated cursor mockup |
| test-output/ceramics-product/ | E-commerce | 9/10 | Masonry gallery |
| test-output/dev-portfolio/ | Portfolio | 9/10 | Terminal typewriter |

All 13 tests: zero AI tells.
