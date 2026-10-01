# Verify e2e

Runbook for `/verify-e2e` after a user-visible or cross-service change.

## Resolve the area

1. Read `e2e/COVERAGE.md` (workspace) or this repo's Identity **E2E areas**.
2. Pick the matching `@area` tag (`@auth`, `@cases`, `@contractor`, `@admin`,
   `@forms`, `@workflow`, `@widgets`, `@chat`, `@calendar`, `@documents`,
   `@notifications`, `@prequalification`, `@promotions`, `@signatures`).
3. Note the tier: `prod-safe` / `cheap` / `dev-only`.

## Environment matrix

| Env                | When                                                                 | Command                                            |
| ------------------ | -------------------------------------------------------------------- | -------------------------------------------------- |
| Preview (ADR 0011) | PR into `dev` is open — preferred for UI/journey on the unmerged SHA | `cd e2e && pnpm test:preview --slug <slug>`        |
| Prod cheap         | No open preview, or after the change is on prod                      | `cd e2e && pnpm test:prod:verify --grep @<area>`   |
| Prod smoke only    | No password secrets                                                  | `cd e2e && pnpm test:prod`                         |
| Dev                | Deployed `*.carteracredit.workers.dev`                               | `cd e2e && pnpm test:dev --grep @<area>`           |
| Local              | `pnpm --dir harness dev` up                                          | `cd e2e && E2E_ENV=local pnpm test --grep @<area>` |

When a PR into `dev` is open, wait for the `<!-- cartera-preview-stack -->`
comment (`/healthz` ok). Sign in on
`https://<slug>-auth.carteracredit.workers.dev/login` with Cursor Cloud
password secrets (clean browser profile — cookies share
`.carteracredit.workers.dev` with stable-dev). Passkeys / Google / OTP do
not work on preview aliases. Prod cheap cannot validate the unmerged branch.

## Interpret results

- **Green** — verification passed. Task may be marked done.
- **Skipped (`allowWrites` / `env.name === "prod"`)** — expected for
  onboarding writes on prod. Do not invent a prod write for those. If the
  task needed that journey, add or keep a `required-missing` COVERAGE.md row.
- **Red** — not done. Fix the product or the spec, or report the failure.
- **No spec** — add a spec or a `required-missing` row in the same task.

## Hands and eyes

```bash
cd e2e
pnpm snap customer /cases
pnpm snap operator https://admin.carteracredit.workers.dev
pnpm snap guest https://auth.carteracredit.workers.dev/login
pnpm probe GET /healthz
```

Never toggle persona password-login. Never read prod KV.
