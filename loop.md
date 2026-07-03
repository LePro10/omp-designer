# Improvement loop

Use evidence from actual output. Do not add another skill, gate, validator rule, or
MCP merely because it sounds comprehensive.

## Standard iteration

1. Run `npm run system:inspect` and establish exactly one package source.
2. For checkout testing, run `npm run install:local:clean`, fully restart omp,
   and verify `/designer-doctor`.
3. Pick one stable case and baseline under `test-output/`.
4. Run the current package with the real target model.
5. Check build, validators, artifacts, trace, desktop screenshot, and mobile
   screenshot.
6. Separate runtime failures, factual failures, implementation failures, and
   visual-quality failures.
7. Change the smallest responsible layer.
8. Run `npm test` and `npm run check:release`.
9. Rerun the same model and case against the prior output.
10. Keep the change only if the comparison improves without breaking proportional
   small-edit behavior.

Example:

```bash
node scripts/real-agent-eval.mjs \
  --run fieldnote-r2 \
  --case saas \
  --baseline test-output/fieldnote-r1 \
  --model opencode-go/deepseek-v4-flash:xhigh
```

## Diagnosis map

| Symptom | Change first |
| --- | --- |
| Prompt injected twice | install/discovery guard and doctor |
| Agent loops or cannot use tools | runtime hook |
| Invented metrics or social proof | evidence validator and core skill |
| Generic repeated composition | core/design skill, then visual review |
| Small edit creates process files | prompt contract |
| Contrast failure | selected palette or component usage |
| MCP failure blocks work | MCP policy, not another retry |
| Build passes but screenshot is wrong | browser QA/capture procedure |
| Test passes but production fails | make test call real runtime/module |

## Required evidence

Every output-affecting iteration should leave:

- candidate project under `test-output/<run>`,
- JSON comparison under `test-output/reports/`,
- an isolated trace with prompt injection, delivery outcome, and no duplicate,
- at least one narrow and one wide screenshot created after the final source edit,
- a short visual review,
- static test and release-check results.

The numeric harness score is not a design score. It measures buildability,
blockers, artifacts, source presence, and screenshot evidence. Visual review must
address hierarchy, specificity, composition, responsive behavior, and whether the
screenshot actually proves the claim.

## Model matrix

Use DeepSeek V4 Flash as the fast regression model because it exposes instruction
and workflow failures cheaply. Before a release, sample at least one additional
supported model on one full-build case and one small-edit case. Do not claim one
model has universally better taste without current comparative evidence.

## Installation during development

Use one source path. `npm run install:local:clean` removes known v2 leftovers,
runs package checks, and creates the local plugin link. Do not also copy
`extension/index.ts` or skills into agent directories. Fully restart after
changing install source, then run `/designer-doctor`.

The initial v5 DeepSeek comparisons ran while old v2 files still existed on the
host, even though the v2 mode was usually disabled. Treat those runs as
before/after workflow evidence, not as clean-install release evidence. R8 is the
first comparison produced after a cleaned local install and single-source
preflight.

## Rejected v4 patterns

- all-skills-upfront reading,
- tool blocking based on read order,
- MCP enable/disable mutation,
- autonomous session-stop loops,
- managed-skill copies beside the package,
- style-word blacklists as blockers,
- synthetic evaluation without a real model,
- reporting a deterministic score as visual quality.
