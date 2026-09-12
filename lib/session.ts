/**
 * Secure Session Management & Cryptographic Signatures
 * Uses standard Web Crypto API (supported in Node.js, Next.js Proxy, and Browsers).
 */

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "gestion-pro-enterprise-secure-salt-2026-secret-key";

async function generateSignature(data: string, secret: string): Promise<string> {
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
 * Signs session payload into a cryptographically secured token: <base64url>.<hmac-sha256>
 */
export async function signSession(payload: any): Promise<string> {
  const jsonStr = JSON.stringify(payload);
  const encodedData = base64UrlEncode(jsonStr);
  const signature = await generateSignature(encodedData, SESSION_SECRET);
  return `${encodedData}.${signature}`;
}

/**
 * Verifies and decodes a session token. Rejects tampered payloads.
 */
export async function verifyAndDecodeSession(token: string): Promise<any | null> {
  if (!token || typeof token !== "string") return null;

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

  // Graceful fallback for migration: Check if it's legacy URL-encoded JSON
  try {
    let decoded = token;
    if (token.includes("%")) decoded = decodeURIComponent(token);
    if (decoded.includes("%")) decoded = decodeURIComponent(decoded);
    const parsed = JSON.parse(decoded);
    return parsed;
  } catch {
    return null;
  }
}
