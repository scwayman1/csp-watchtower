# Lovable Cloud restoration rollout

This package is prepared for the Lovable Cloud backend used by the `Put Tracker Pro` project. It is intentionally not a production deployment script: the old Lovable app and the Cloudflare preview share the same live database, so execution requires a reviewed release window.

## Exact package

Apply or publish the following in filename order:

1. `supabase/migrations/20260215224600_harden_invite_flow.sql`
   - Adds invite expiry metadata, the service-only rate-limit table/function, and the authenticated dashboard-share RPC.
   - Its backfills are limited to invite metadata (`advisor_invites`, `position_shares`, and client invite expiry); it does not rewrite positions, assignments, covered calls, or reconciliation rows.
2. `supabase/migrations/20260906000000_atomic_advisor_invite_acceptance.sql`
   - Adds the locked, atomic advisor acceptance RPC and grants it only to `service_role`.
3. `supabase/migrations/20260906000100_order_ingestion_idempotency.sql`
   - Adds nullable ingestion metadata, unique replay keys, and a read-only `security_invoker` duplicate-preview view.
   - It performs no backfill, delete, merge, or update of financial rows.
4. `supabase/migrations/20260906000200_invite_rpc_security.sql`
   - Restricts SECURITY DEFINER invite helper grants and binds dashboard-share acceptance to `auth.uid()` and the authenticated email.

Deploy the compatible Edge Function sources after the schema is present:

- `supabase/functions/bootstrap-admin/index.ts`
- `supabase/functions/validate-advisor-invite/index.ts`
- `supabase/functions/complete-advisor-signup/index.ts`
- `supabase/functions/_shared/access-control.ts`

The frontend compatibility fix is `src/pages/AcceptInvite.tsx`; it uses the authenticated `accept_dashboard_invite` RPC instead of a direct client-side update. `src/integrations/supabase/types.ts` is updated for the deployed columns and RPC.

## Compatibility findings

- The old advisor invite page sends the same `{ userId, inviteId, token }` body and accepts `{ success: true }`; the revised function preserves that contract. It remains pre-auth so email-confirmation-required signups can complete the server-side setup using the service-role user lookup.
- `validate-advisor-invite` still returns `{ invite }` for a pending invite. Accepted and expired invites now return explicit 400/410 errors, which the existing page already treats as invalid.
- Older writes omit the new ingestion columns. Because the columns are nullable, those writes remain valid; the unique indexes do not merge or constrain legacy NULL rows.
- The duplicate-preview view uses `security_invoker` and is granted only to authenticated users, so base-table RLS remains in force.
- The dashboard-share acceptance RPC is now the only authenticated update path. The old direct update was not atomic and was not covered by the existing RLS policy.
- `bootstrap-admin` keeps the existing `{ user_id }` request and success response, but now requires both a bearer session and an existing admin caller before granting roles. If the database has no admin, first-admin provisioning must be performed through an owner-controlled out-of-band path; no arbitrary authenticated user is elevated automatically.
- `parse-order` was not changed in this restoration; its existing response contract remains the source for the frontend replay-key builder. No separate parse-order deployment is required for this package.

## Lovable Cloud execution path

The signed-in project UI exposes Cloud → Database (including SQL editor) and Cloud → Edge functions. Lovable’s documented deployment model is chronological `supabase/migrations` processing on publish/sync, with Lovable Cloud remaining the Supabase-compatible backend. A feature-branch push alone is not a production deployment; use the connected/default Lovable sync or the reviewed Lovable publish flow. Do not run the SQL editor or click Publish until the release is approved.

References:

- https://docs.lovable.dev/tips-tricks/external-deployment-hosting
- https://docs.lovable.dev/tips-tricks/deployment-hosting-ownership
- https://docs.lovable.dev/integrations/github

## Rollout and rollback

1. Confirm the release is pointed at the existing Lovable Cloud ref and record read-only counts for the invite tables, positions, assigned positions, covered calls, and reconciliation runs.
2. Apply/publish the four migrations in order. Verify the schema before enabling the new function sources.
3. Verify function behavior with invalid-token probes, then exercise authenticated invite flows in preview using a test invitation; do not use a financial import for the first probe.
4. Deploy the Cloudflare preview build and validate `/auth`, `/accept-invite/:token`, `/accept-advisor-invite/:token`, and advisor dashboard routes. Leave the old published URL unchanged. Exercise `bootstrap-admin` only with an existing admin session in a non-production/test account; if no admin exists, stop and obtain owner-controlled provisioning rather than bypassing the guard.
5. Only after compatibility passes should a separate production cutover be considered.

The migrations are additive and have no safe automatic down migration. If application validation fails, roll back the frontend/function release while leaving the new nullable columns, indexes, views, and RPCs in place; the old schema consumers ignore those additions. Do not drop the new columns or revoke the RPCs while a new frontend is deployed. Do not attempt a data rollback or cleanup as part of this restoration.
