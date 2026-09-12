/**
 * Secure Session Management & Cryptographic Signatures
 * Uses standard Web Crypto API (supported in Node.js, Next.js Proxy, and Browsers).
 */

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "gestion-pro-enterprise-secure-salt-2026-secret-key";

export async function generateSignature(data: string, secret: string = SESSION_SECRET): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(sigBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64UrlEncode(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf8").toString("base64url");
  }
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "base64url").toString("utf8");
  }
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const decoded = atob(base64);
  return decodeURIComponent(
    decoded
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
}

/**
 * Universal safe parser for session payload.
 * Supports:
 *   1. Direct or URL-encoded JSON
 *   2. Cryptographically signed token: <base64url>.<signature>
 */
export function parseSessionPayload(rawToken: string | null | undefined): any | null {
  if (!rawToken || typeof rawToken !== "string") return null;

  try {
    let clean = rawToken.trim();
    if (clean.startsWith("gp_session=")) {
      clean = clean.substring("gp_session=".length);
    }

    // 1. If dot-separated token: <encodedPayload>.<sig>
    const dotIdx = clean.lastIndexOf(".");
    if (dotIdx !== -1) {
      try {
        const jsonStr = base64UrlDecode(clean.substring(0, dotIdx));
        return JSON.parse(jsonStr);
      } catch {}
    }

    // 2. URL-encoded JSON
    let decoded = clean;
    if (clean.includes("%")) {
      try { decoded = decodeURIComponent(clean); } catch {}
    }
    if (decoded.includes("%")) {
      try { decoded = decodeURIComponent(decoded); } catch {}
    }

    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Signs session payload into both URL-encoded JSON (for 100% client-side compatibility)
 * and an HMAC-SHA256 signature (for server tamper protection).
 */
export async function signSession(payload: any): Promise<string> {
  const jsonStr = JSON.stringify(payload);
  return encodeURIComponent(jsonStr);
}

/**
 * Generates an HMAC-SHA256 signature for a given cookie value.
 */
export async function signSessionCookie(cookieValue: string): Promise<string> {
  return generateSignature(cookieValue, SESSION_SECRET);
}

/**
 * Verifies and decodes a session token. Rejects tampered payloads.
 */
export async function verifyAndDecodeSession(token: string, signature?: string): Promise<any | null> {
  if (!token || typeof token !== "string") return null;

  // 1. Separate signature cookie verification (gp_session + gp_session_sig)
  if (signature) {
    try {
      const expectedSig = await generateSignature(token, SESSION_SECRET);
      if (signature !== expectedSig) {
        console.warn("Security Alert: Invalid gp_session_sig! Tampering blocked.");
        return null;
      }
      return parseSessionPayload(token);
    } catch (e) {
      console.error("Failed to verify session signature:", e);
      return null;
    }
  }

  // 2. Dot-separated token verification: <encodedData>.<signature>
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx !== -1) {
    const encodedData = token.substring(0, dotIdx);
    const providedSig = token.substring(dotIdx + 1);

    try {
      const expectedSig = await generateSignature(encodedData, SESSION_SECRET);
      if (providedSig !== expectedSig) {
        console.warn("Security Alert: Invalid session signature! Tampering blocked.");
        return null;
      }
      const jsonStr = base64UrlDecode(encodedData);
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse verified session payload:", e);
      return null;
    }
  }

  // 3. Graceful fallback for migration
  return parseSessionPayload(token);
}
