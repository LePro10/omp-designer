# Installation lifecycle

Use exactly one `omp-designer` source at a time. A published npm installation, a
local plugin link, and a manually copied extension are not additive installation
methods.

## Inspect first

From a checkout:

```bash
cd /path/to/omp-designer
npm run system:inspect
```

From the published package:

```bash
npx --yes omp-designer@latest uninstall
```

Both commands are dry-runs. They report the current plugin, lock metadata, the
known v2 manual extension, the 12 known v2 managed skills, and retained state.
They do not invoke an uninstall command or change files.

## Test a local checkout

```bash
npm run install:local:clean
```

This command:

1. asks omp to uninstall the registered `omp-designer` plugin,
2. removes only the known v2 manual extension and managed-skill directories,
3. explicitly preserves designer state and traces needed for comparison,
4. runs `npm test` and `npm run check:release`,
5. links the current checkout with `omp plugin link`,
6. verifies the linked path, package version, and absence of v2 leftovers.

Fully restart omp after the command. Run `/designer-doctor` and require one
source, four skills, and no duplicate-load risk before using a real-agent run as
release evidence. The real-agent harness verifies this installation state and
does not pass a second explicit extension path to OMP.

Use `npm run install:local:apply` only when inspection already shows no legacy
mix. It refuses to proceed if old v2 files exist. `npm run install:local` is its
dry-run.

## Switch from local to published

Do not install the npm package over the local link:

```bash
npm run uninstall:system:apply
omp install npm:omp-designer@latest
```

When working outside a checkout, the published CLI can uninstall itself:

```bash
npx --yes omp-designer@latest uninstall --apply
omp install npm:omp-designer@latest
```

Fully restart omp and run `/designer-doctor`.

## Remove the system installation

Repository commands require the checkout as the current directory:

```bash
cd /path/to/omp-designer
npm run uninstall:system
npm run uninstall:system:apply
```

From any directory, use the currently installed OMP package:

```bash
# Preview
node "$HOME/.omp/plugins/node_modules/omp-designer/scripts/lifecycle-cli.mjs" uninstall

# Apply
node "$HOME/.omp/plugins/node_modules/omp-designer/scripts/lifecycle-cli.mjs" uninstall --apply
```

After v5 is published, the equivalent download-and-run form is:

```bash
npx --yes omp-designer@latest uninstall --apply
```

Normal uninstall removes all package-owned OMP data:

- `~/.omp/agent/designer-state.json`
- `~/.omp/agent/designer-traces/`
- `~/.omp/agent/designer-gates/`
- `~/.omp/agent/designer-phases/`
- the registered plugin, known v2 extension, and 12 known managed skills

Preserving state and traces is only intended for a local reinstall:

```bash
npm run uninstall:system:apply -- --keep-data
```

The lifecycle scripts never read, write, or remove `mcp.json`, API keys, npm
tokens, provider configuration, unrelated skills/extensions, general OMP
sessions, or unrelated agent memory. Those are not executable package remnants
and cannot create a duplicate designer load.

## Supported host

The lifecycle scripts manage the oh-my-pi (`omp`) installation layout. Pi package
installation remains available through `pi install npm:omp-designer`, but these
cleanup scripts do not claim to manage Pi's host-specific files.

## Test evidence

Lifecycle regression tests create an isolated temporary HOME and a fake omp
binary. They cover mixed-install detection, dry-run safety, full cleanup,
explicit retention, clean local linking, and uninstall.

The earlier DeepSeek V4 Flash comparisons were run with the v5 plugin active
while disabled v2 files and their managed-skill metadata still existed. Those
runs remain useful v5 runtime/validator comparisons, but they are not
clean-install E2E proof. R8 was subsequently run after clean install with a
single plugin source; its review is stored beside the generated report under
`test-output/reports/`.
