# Promote `dev` → `main`

Runbook: [`harness/platform/promote-dev-to-main.md`](../../platform/promote-dev-to-main.md)
(workspace) or the same path inside a harness checkout.

## Resolve the repo

1. Confirm this folder has `origin/dev` and `origin/main`. Harness does not
   — edit `main` only. e2e has `dev` once scaffolded but no semantic-release.
2. Do not promote every sibling. Libraries (`blocks`) before consumers
   (`cases`, `admin`, `contractor`, `auth`, `forms`, `workflow`, `widgets`).

## Preflight

```bash
git fetch origin main dev
git log --oneline origin/main..origin/dev
git log --oneline origin/dev..origin/main
```

- `dev` ahead, 0 behind → open the promote PR.
- `dev` behind → merge `main` into `dev` first; wait for CI.
- `dev` == `main` → already promoted; stop.

Run that repo's quality gate. Do not add commits while promoting.

## Merge

Open the pull request with **head `dev` and base `main`**. Do not create a
branch. Agent branch prefixes (`rs/…`) do not apply to `/promote`. A side
branch is the wrong promote even when it points at the same commit as `dev`.

Merge with a **merge commit** (never squash, never rebase). Leave the
default merge subject, `Merge pull request #N from <owner>/dev`. Do not set
a custom title. Semantic-release on `main` needs the original `feat:` /
`fix:` commits.

Wait for `release.yml` on `main`. Confirm the stable tag (and npm `latest`
for libraries).

## After release — `dev` ← `main` (required)

Promote is **not done** when `main` is green. Semantic-release may write
`chore(release): X.Y.Z` only on `main`. Merge `main` back into `dev` so
the next `dev` → `main` PR does not conflict on `package.json` /
CHANGELOG (ADR 0010).

- Fast-forward `dev` when `dev` has nothing new; otherwise a merge commit.
- Do **not** re-promote a `dev`-sync-only merge.
- Same fold after a hotfix off `main`.
- Wait for `dev` CI.

Never hand-bump `version`. Never `npm publish` / local-deploy.

## Path to `main`

In repos with `dev`, product work (including library pins) lands on `dev`.
Cloud agents branch from `origin/dev` and open PRs **into `dev`** unless
asked otherwise. `main` is reached only by promoting `dev`. A PR off
`main` is a **hotfix** and should be unusual. After a hotfix or a stable
`chore(release)`, merge `main` back into `dev` before any other `dev` work.
`harness` has no `dev`.

## Consumers after a library cut

Replace an exact `X.Y.Z-rc.N` pin with `^X.Y.Z` and refresh the lockfile
**on `dev`**. Promote `dev` → `main` when prod should pick it up. Do not
open a parallel pin PR off `main` for the same bump. A `^` range on an
older minor will not update until the lockfile does. Update `AGENTS.md`
`## Learnings` when it names the pin.
