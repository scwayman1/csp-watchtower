/**
 * Shared webhook verification utilities for Supabase Edge Functions
 *
 * Use these helpers to verify webhook signatures from third-party providers
 * like Twilio, Stripe, Resend, etc.
 */

/**
 * Verifies a generic HMAC webhook signature
 *
 * @param req - The incoming request
 * @param opts - Verification options
 * @returns Object with verification result and raw body if successful
 */
export async function verifyHmacWebhook(req: Request, opts: {
  secret: string;
  signatureHeader: string;
  timestampHeader?: string;
  toleranceSeconds?: number;
  encoding?: 'base64' | 'hex';
}): Promise<{ ok: true; rawBody: string } | { ok: false; reason: string }> {
  const sig = req.headers.get(opts.signatureHeader);
  if (!sig) {
    return { ok: false, reason: "missing_signature" };
  }

  const rawBody = await req.text();
  const enc = new TextEncoder();

  // Optional replay protection
  if (opts.timestampHeader) {
    const ts = req.headers.get(opts.timestampHeader);
    if (!ts) {
      return { ok: false, reason: "missing_timestamp" };
    }
    const t = Number(ts);
    if (!Number.isFinite(t)) {
      return { ok: false, reason: "bad_timestamp" };
    }
    const now = Math.floor(Date.now() / 1000);
    const tol = opts.toleranceSeconds ?? 300;
    if (Math.abs(now - t) > tol) {
      return { ok: false, reason: "stale_request" };
    }
  }

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(opts.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const macArray = new Uint8Array(mac);

  let computed: string;
  if (opts.encoding === 'hex') {
    computed = Array.from(macArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } else {
    computed = btoa(String.fromCharCode(...macArray));
  }

  // Constant-time comparison
  const a = sig.trim();
  const b = computed.trim();
  if (a.length !== b.length) {
    return { ok: false, reason: "signature_mismatch" };
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  if (diff !== 0) {
    return { ok: false, reason: "signature_mismatch" };
  }

  return { ok: true, rawBody };
}

/**
 * Verifies Twilio webhook signature using their X-Twilio-Signature header
 *
 * Twilio uses HMAC-SHA1 with base64 encoding, and includes the full URL
 * concatenated with sorted POST parameters in the signature base.
 *
 * @param req - The incoming request (must be cloned before calling)
 * @param authToken - Your Twilio Auth Token
 * @param webhookUrl - The full URL that Twilio is calling
 * @returns Verification result
 */
export async function verifyTwilioWebhook(
  rawBody: string,
  signature: string | null,
  authToken: string,
  webhookUrl: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!signature) {
    return { ok: false, reason: "missing_signature" };
  }

  // Parse form data from raw body
  const params = new URLSearchParams(rawBody);

  // Sort parameters alphabetically by key and concatenate key+value
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}${value}`)
    .join('');

  // Twilio signature base: URL + sorted params
  const signatureBase = webhookUrl + sortedParams;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(signatureBase));
  const computed = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // Constant-time comparison
  const a = signature.trim();
  const b = computed.trim();
  if (a.length !== b.length) {
    return { ok: false, reason: "signature_mismatch" };
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  if (diff !== 0) {
    return { ok: false, reason: "signature_mismatch" };
  }

  return { ok: true };
}

/**
 * Verifies an internal service token for function-to-function calls
 *
 * Use this for functions that need to be callable without JWT but should
 * not be publicly accessible.
 *
 * @param req - The incoming request
 * @param expectedToken - The expected token from environment
 * @returns Verification result
 */
export function verifyInternalServiceToken(
  req: Request,
  expectedToken: string
): { ok: true } | { ok: false; reason: string } {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return { ok: false, reason: "missing_authorization" };
  }

  // Support both "Bearer <token>" and just "<token>"
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  // Constant-time comparison
  if (token.length !== expectedToken.length) {
    return { ok: false, reason: "invalid_token" };
  }
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }
  if (diff !== 0) {
    return { ok: false, reason: "invalid_token" };
  }

  return { ok: true };
}
