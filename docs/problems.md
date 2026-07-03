# Problems found and v5 decisions

## Fixed

### Duplicate installation and hook registration

The old documentation combined plugin installation, managed skill copies, and
manual extension paths. Real traces contained adjacent duplicate prompt and tool
events. v5 uses package-relative assets, documents one installation mechanism,
adds a process-wide registration guard, and reports legacy-copy risk in
`/designer-doctor`.

The affected development machine also had a v5 plugin link beside the old v2
manual extension and all 12 managed skills. This explains the observed strict
gate error. A dry-run-first uninstaller and clean local installer now detect and
remove that exact mix. Their destructive paths are regression-tested against an
isolated temporary HOME.

### Skill gate dominated the task

The 12-skill ordering gate blocked unrelated tools, created a ten-phase state
machine, and repeatedly continued after the agent was ready to stop. It measured
ritual completion rather than interface quality. v5 has four conditional skills
and no `tool_call`/`tool_result` gate.

### MCP ownership was wrong

The extension edited host MCP configuration and coupled designer mode to server
enablement. This caused cwd/global mismatches, reload requirements, and failures
unrelated to the user's design task. v5 only reports configured MCPs. Research is
optional and task-driven.

### Validators encoded style opinions as failures

The prior copy validator could treat punctuation, CSS percentages, and generic
word lists as hard errors. The layout validator expected full artifacts for small
changes. v5 limits blockers to evidence and objective accessibility defects;
style and documentation signals are warnings.

### The model could self-authorize claims

An agent could write `Source: user` into EVIDENCE.md and make an invented release
status pass its own validator. v5 now retains the original user prompt in runtime
memory and passes it directly to the delivery validator. Generated ledgers remain
useful documentation, but are not the authority during automatic checks.

### Data was not audited

`typography.csv` contained a concatenated record and several palette foreground
pairs were below 3:1. A CSV parser and contrast audit now run in the normal test
suite. Remaining 3:1–4.5:1 pairs are explicitly warned because their validity
depends on use.

### Tests exercised reimplementations

Several old tests duplicated logic or checked a synthetic gate rather than the
actual extension. v5 imports the real TypeScript extension, invokes its registered
handlers, tests real validator CLIs, audits packed release files, and runs a real
model comparison when output behavior changes.

### Mixed installation weakened E2E evidence

The later v5 DeepSeek runs exercised the v5 prompt, delivery validator, and trace,
but old v2 files remained discoverable on the host. The v2 mode was usually off,
so the comparison still identified real v5 improvements; it did not prove a
clean production install. Clean installation and restart are now explicit
preconditions for release-candidate model runs. The harness also stopped passing
an explicit extension path beside the installed plugin. The first clean,
single-source comparison is R8.

### Automated score was mistaken for design quality

The first v5 DeepSeek run reached 100/100 while screenshots still showed three
repetitive card-grid sections. The report now labels its number as an automated
delivery score and emits composition signals. A written screenshot review is part
of every comparison.

## Deliberate limitations

- Static validators cannot prove keyboard behavior, visual hierarchy, or motion
  quality.
- A palette row cannot guarantee accessible usage; component-level contrast still
  needs review.
- Session-stop validation does not prove browser QA.
- MCP handshakes prove server availability, not reference quality.
- A single model/case can catch regressions but cannot establish universal design
  quality.

## Follow-up criteria

Add complexity only when repeated real-agent evidence justifies it. A proposed
rule should include:

1. the concrete failed output,
2. why an existing prompt, review step, or validator cannot catch it,
3. a regression test,
4. before/after runs using the same case and model,
5. an escape path for legitimate exceptions.
