/**
 * Shared access-control helpers for invite/admin edge functions.
 *
 * Provides: bearer token extraction, client IP detection, email
 * normalization, and SHA-256 hex hashing (used for rate-limit token hashes).
 */

/** Extract the bearer token from the Authorization header, or null. */
export function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return token.trim() || null;
}

/** Best-effort client IP from proxy headers, or null. */
export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    null
  );
}

/** Normalize an email for comparisons (trim + lowercase). */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** SHA-256 hex digest of a string (e.g., an invite token for rate limiting). */
export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
