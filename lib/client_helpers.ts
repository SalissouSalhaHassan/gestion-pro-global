/**
 * Shared helpers for client data isolation.
 * 
 * Dépôt users can only see/edit clients they created (via created_by).
 * Admin/Manager users have full access to all clients.
 * The default client (ID=1) is always visible to everyone.
 */

// ─── Client-Side Session Helpers ───

export interface ClientSession {
  id: string | number;
  username: string;
  role: string | number;
  admin: string;
  emplacement: string;
  depots?: string;
  permissions?: string[];
}

/**
 * Reads the gp_session cookie on the client side.
 */
export function getClientSessionFromCookie(): ClientSession | null {
  try {
    const cookies = document.cookie.split("; ");
    const sessionCookie = cookies.find((cookie) => cookie.startsWith("gp_session="));
    if (!sessionCookie) return null;
    const decoded = decodeURIComponent(sessionCookie.split("=")[1]);
    return JSON.parse(decoded) as ClientSession;
  } catch (error) {
    console.error("Failed to read client session:", error);
    return null;
  }
}

/**
 * Checks if a client-side session has Admin or Manager privileges.
 */
export function isAdminOrManagerSession(session: ClientSession | null): boolean {
  if (!session) return false;
  const adminValue = String(session.admin ?? "").toLowerCase();
  const roleValue = String(session.role ?? "").toLowerCase();
  return (
    (session as any).admin === true ||
    adminValue === "oui" ||
    adminValue === "true" ||
    adminValue === "yes" ||
    roleValue === "1" ||
    roleValue === "admin"
  );
}

// ─── Default Client ID (always visible to all users) ───
export const DEFAULT_CLIENT_ID = 1;
