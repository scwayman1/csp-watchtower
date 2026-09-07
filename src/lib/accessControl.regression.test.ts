import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getBearerToken, getClientIp, normalizeEmail, sha256Hex } from "../../supabase/functions/_shared/access-control";

const read = (path: string) => readFileSync(path, "utf8");

describe("access-control regression coverage", () => {
  it("parses auth/IP safely and hashes invite tokens", async () => {
    expect(getBearerToken(new Request("https://example.test"))).toBeNull();
    expect(getBearerToken(new Request("https://example.test", { headers: { authorization: "Bearer  access-token " } }))).toBe("access-token");
    expect(normalizeEmail("  Advisor@Example.COM ")).toBe("advisor@example.com");
    expect(getClientIp(new Request("https://example.test", { headers: { "x-forwarded-for": "198.51.100.10, 10.0.0.1" } }))).toBe("198.51.100.10");
    expect(await sha256Hex("invite-token")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("keeps advisor acceptance authenticated, rate-limited, and atomic", () => {
    const source = read("supabase/functions/complete-advisor-signup/index.ts");
    const migration = read("supabase/migrations/20260906000000_atomic_advisor_invite_acceptance.sql");
    expect(source).toContain("supabase.auth.admin.getUserById(userId)");
    expect(source).not.toContain("supabase.auth.getUser(accessToken)");
    expect(source).toContain("check_invite_rate_limit");
    expect(source).toContain('rpc("complete_advisor_signup"');
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("v_invite.expires_at <= now()");
    expect(migration).toContain("lower(trim(v_invite.email)) IS DISTINCT FROM lower(trim(p_user_email))");
    expect(migration).toContain("ON CONFLICT (user_id, role) DO NOTHING");
  });

  it("uses the authenticated dashboard-share RPC instead of a direct client update", () => {
    const source = read("src/pages/AcceptInvite.tsx");
    const migration = read("supabase/migrations/20260906000200_invite_rpc_security.sql");
    expect(source).toContain('"accept_dashboard_invite"');
    expect(source).not.toContain("from('position_shares')");
    expect(migration).toContain("auth.uid() <> p_user_id");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.accept_dashboard_invite");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.accept_dashboard_invite(TEXT, UUID, TEXT)");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.check_invite_rate_limit");
  });

  it("requires current admin authority for bootstrap-admin", () => {
    const source = read("supabase/functions/bootstrap-admin/index.ts");
    expect(source).toContain("supabaseAdmin.auth.getUser(accessToken)");
    expect(source).toContain("eq('role', 'admin')");
    expect(source).toContain("Admin authority required");
  });
});
