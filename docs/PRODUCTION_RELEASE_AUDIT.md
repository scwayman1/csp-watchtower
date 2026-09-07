# Production release and portfolio audit

Date: 2026-09-07
Branch: `codex/restore-idempotency-security`
Release commit: `fa004ec`

## Release outcome

- The approved Lovable Cloud migrations and the reviewed invite/bootstrap edge-function sources were deployed and reconciled against the local branch.
- The deployed function sources were checked for unintended divergence; only the four approved function/helper files differed from the pre-release live archive, and the final source matches the reviewed implementation after Lovable formatting.
- Read-only endpoint probes passed for invalid invite validation, pre-auth signup completion, and unauthenticated bootstrap rejection.
- The published URL [`csp-watchtower.lovable.app`](https://csp-watchtower.lovable.app/auth) and the Cloudflare preview alias [`codex-restore-idempotency-se.csp-watchtower-preview.pages.dev`](https://codex-restore-idempotency-se.csp-watchtower-preview.pages.dev/auth) both rendered the login shell. Their observed JavaScript/CSS assets returned HTTP 200, with no browser console errors.

## Read-only duplicate and lifecycle audit

The deployed duplicate-preview view reported one heuristic economic candidate group containing four rows in `assigned_positions_economic_candidate`. It reported zero exact identified-order duplicate groups in `positions`, `assigned_positions`, or `covered_calls`. The economic group is a review candidate only; repeated economics may represent legitimate executions, partial fills, or replayed source rows.

Current aggregate lifecycle observations:

- 71 positions total; 42 are still marked active although their expiration is before the audit date.
- 18 assigned positions total; 10 active.
- 32 covered calls total; 18 active; no orphan assignment links.
- 17 active covered calls attach to active assigned positions; 1 active covered call attaches to an inactive assigned position.
- All 32 historical covered-call rows have a null `user_id` because the additive migration intentionally did not backfill that new nullable column. This is a known data-consistency gap, not a basis for an unreviewed cleanup.
- All positions and covered calls remain `unreviewed`.
- `account_reconciliation_runs` and the current reconciliation rollup both contain zero rows. No live baseline/current accounting rollup is available.

No financial rows were changed, deleted, merged, imported, or cleaned up during this audit.

## Limits and next evidence

The repository's `verifiedMay2026Payload` and related statement fixture are local test/reconciliation material. The audit found no evidence tying that fixture to the current live account or current period, so it is not current portfolio proof.

To establish live portfolio totals safely, obtain a current broker statement/export with account identity, statement period, holdings, and transaction/lifecycle history; run it through a reviewed staging or read-only reconciliation preview; resolve the four-row economic candidate and the one active-call/inactive-assignment case; account for the 32 null historical covered-call owners; then create an authenticated reconciliation run and rollup only after the statement tie-out succeeds. Until that evidence exists, this release is verified operationally but portfolio financial correctness remains unconfirmed.
