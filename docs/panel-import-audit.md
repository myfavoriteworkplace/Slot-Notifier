# Panel Import Audit

Catches missing imports in extracted panel components **before** a Render deploy, preventing production `ReferenceError` crashes.

## Background

When code is extracted from `ClinicDashboard.tsx` into separate panel files, identifiers that were "free" in the parent's scope (locally defined or imported there) can be left out of the new file's explicit imports. Vite's dev server hides this because all modules share one module graph — Render's production build compiles each chunk in isolation, so missing imports become hard runtime crashes.

## Running the audit

```bash
python3 script/audit-panel-imports.py
```

All five panels must report `✅ OK` before deploying to Render.

## Adding a new panel

1. Create the new panel file under `client/src/components/`.
2. Add its path to the `PANELS` list at the top of `script/audit-panel-imports.py`.
3. Run the audit and resolve any reported gaps before committing.

## Extending the `NON_LUCIDE` allowlist

If the audit flags a false positive (e.g. a custom component or shadcn primitive it doesn't know about), add the identifier to the `NON_LUCIDE` set in `script/audit-panel-imports.py`. Add a comment explaining what the identifier is so future maintainers understand why it's excluded.

## What the script checks

| Check | How |
|---|---|
| Lucide icon used as a JSX tag but not imported | Compares `<IconName` usages against the file's lucide-react import block |
| Lucide icon passed as a prop value but not imported | Catches `icon={IconName}` and `const X = IconName` patterns |
| Constants / functions from `clinic-constants.tsx` | Checks all exported names against what the panel imports |

The script intentionally ignores shadcn/ui primitives, custom project components, and JS built-ins — these are tracked in the `NON_LUCIDE` allowlist.
