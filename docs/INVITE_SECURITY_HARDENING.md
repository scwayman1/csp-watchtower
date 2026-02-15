# Invite Flow Security Hardening

**Date:** 2026-02-15  
**Branch:** `harden-invite-flow`

## Summary of Changes

### 1. Database Migration (`20260215224600_harden_invite_flow.sql`)

| Change | Tables Affected | Description |
|--------|----------------|-------------|
| `expires_at` column | `advisor_invites` | 48-hour TTL, NOT NULL, backfilled |
| `expires_at` column | `position_shares` | 48-hour TTL for unaccepted shares |
| `invite_expires_at` column | `clients` | 48-hour TTL for client invite tokens |
| `invite_acceptance_attempts` table | New | Rate limiting via IP + token hash tracking |
| `accept_dashboard_invite()` RPC | New | Server-side email match + expiration enforcement |
| `check_invite_rate_limit()` function | New | Rate limit check for edge functions |
| Updated `get_share_by_invite_token()` | `position_shares` | Now returns `expires_at` |
| Updated `get_client_by_invite_token()` | `clients` | Now returns `invite_expires_at` |

### 2. React Component Updates

- **AcceptInvite.tsx**: Now uses `accept_dashboard_invite` RPC instead of direct `position_shares` update. Added client-side expiration check for UX.
- **AcceptAdvisorInvite.tsx**: Added client-side expiration check before showing form.
- **AcceptClientInvite.tsx**: Added client-side expiration check before showing form.

### 3. Config Changes (`supabase/config.toml`)

- **`notify-client-signup`**: Changed `verify_jwt = false` → `verify_jwt = true`

---

## Issue-by-Issue Analysis

### Issue 1: `complete-advisor-signup` has `verify_jwt=false`

**Risk:** Anyone with a valid invite token can call this function and assign themselves the advisor role, even without being the intended recipient.

**Current state:** The function receives `userId`, `inviteId`, and `token` in the body. It trusts these values.

**Fix (edge function changes needed):**
- Keep `verify_jwt = false` (needed because the user just signed up and may not have a confirmed session yet)
- BUT the function MUST:
  1. Validate the invite token exists and is PENDING
  2. **Check `expires_at` — reject if expired**
  3. Verify the invite's `email` matches the email of the user being set up (look up `auth.users` by `userId`)
  4. Call `check_invite_rate_limit()` before processing
  5. Mark invite as ACCEPTED atomically (use a transaction or `UPDATE ... WHERE status = 'PENDING'` to prevent race conditions)

**Recommended edge function pseudocode:**
```typescript
// In complete-advisor-signup edge function:
const { userId, inviteId, token } = body;

// 1. Look up invite by token
const invite = await supabase.from('advisor_invites')
  .select('*').eq('invite_token', token).eq('id', inviteId).single();

// 2. Validate
if (!invite || invite.status !== 'PENDING') throw 'Invalid invite';
if (new Date(invite.expires_at) < new Date()) throw 'Invite expired';

// 3. Look up user email and verify match
const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
if (user.email !== invite.email) throw 'Email mismatch';

// 4. Rate limit
const rateCheck = await supabase.rpc('check_invite_rate_limit', { ... });
if (!rateCheck.allowed) throw rateCheck.reason;

// 5. Accept (atomic)
await supabase.from('advisor_invites')
  .update({ status: 'ACCEPTED', user_id: userId, accepted_at: new Date() })
  .eq('id', inviteId).eq('status', 'PENDING');
```

### Issue 2: `notify-client-signup` has `verify_jwt=false`

**Risk:** Anyone can trigger notification emails to advisors by calling this function with arbitrary data.

**Fix:** Changed to `verify_jwt = true` in config.toml. The client-side call in AcceptClientInvite.tsx already has a session (user just signed up/logged in), so JWT will be present.

**Edge function should also:** Verify the caller is the actual client being referenced (match `auth.uid()` against the client record's `user_id`).

### Issue 3: No invite token expiration

**Fix:** Added `expires_at` / `invite_expires_at` columns to all three tables with 48-hour default TTL. Server-side functions check expiration. Client-side checks provide good UX ("expired" message instead of cryptic errors).

**Note:** When creating new invites, the application code that inserts into these tables will automatically get the 48-hour default. To customize TTL, pass an explicit `expires_at` value.

### Issue 4: No rate limiting on invite acceptance

**Fix:** Created `invite_acceptance_attempts` table and `check_invite_rate_limit()` function. Defaults:
- Max 10 attempts per IP per hour
- Max 5 attempts per token per hour

**Edge functions must call this.** The RPC is available for edge functions using service role. The table has RLS enabled with no policies (service_role only).

### Issue 5: Email mismatch check is client-side only in AcceptInvite.tsx

**Fix:** Created `accept_dashboard_invite()` RPC function that enforces email match server-side. AcceptInvite.tsx now calls this RPC instead of directly updating `position_shares`. The client-side check remains for UX but is no longer the enforcement point.

### Issue 6: `repair-user-data` auto-fallback to investor role

**Risk:** Silently assigning investor role masks auth/data issues. Users may not realize their account is misconfigured.

**Recommended edge function changes:**
1. Add structured logging: log every repair action with `user_id`, `timestamp`, `what_was_repaired`, `previous_state`
2. Add a `repair_attempts` counter in the user's profile or a separate table
3. If repair has been attempted 3+ times for same user, stop repairing and return an error asking user to contact support
4. Never auto-assign role without verifying user actually exists in `auth.users`

---

## What Still Needs Manual Work

1. **Edge function source code updates** — The edge functions (`complete-advisor-signup`, `complete-client-signup`, `notify-client-signup`, `validate-advisor-invite`, `repair-user-data`) need to be updated to check expiration, call rate limiting, and enforce email matching. See pseudocode above.

2. **Invite creation code** — Wherever invites are created (UI or API), ensure `expires_at` is set. The DB default handles this, but explicit values are better for custom TTLs.

3. **Expired invite cleanup** — Consider a cron job or Supabase pg_cron to periodically mark expired invites as `EXPIRED` status and clean up the `invite_acceptance_attempts` table.

4. **Testing** — Test all three invite flows end-to-end after deploying the migration and edge function changes.
