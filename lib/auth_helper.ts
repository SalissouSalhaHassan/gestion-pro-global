import { cookies, headers } from "next/headers";
import { verifyAndDecodeSession } from "@/lib/session";

export interface CustomSession {
  id: string | number;
  username: string;
  role: string | number;
  admin: string;
  emplacement: string;
  depots?: string;
  organization_id?: string;
  organization_name?: string;
  plan?: string;
  permissions?: string[];
}

/**
 * Gets the custom user session from the 'gp_session' cookie or Authorization header.
 * Automatically verifies cryptographic signature to prevent tampering.
 * @returns The session object or null if not found/invalid.
 */
export async function getServerSession(): Promise<CustomSession | null> {
  const cookieStore = await cookies();
  let sessionRaw = cookieStore.get("gp_session")?.value;
  let sessionSig = cookieStore.get("gp_session_sig")?.value;

  if (!sessionRaw) {
    const head = await headers();
    const auth = head.get("authorization");
    if (auth && auth.startsWith("Bearer ")) {
      sessionRaw = auth.substring(7);
    }
  }

  if (!sessionRaw) return null;

  try {
    const session = await verifyAndDecodeSession(sessionRaw, sessionSig);
    if (!session) return null;
    return session as CustomSession;
  } catch (error) {
    console.error("Failed to verify session token:", error);
    return null;
  }
}

/**
 * Checks if the current user is an Administrator or Manager.
 */
export async function isAdminOrManager(session?: CustomSession | null): Promise<boolean> {
  const s = session || await getServerSession();
  if (!s) return false;
  
  // Robust check for administrative privileges
  const isAdminFlag = s.admin === "Oui" || s.admin === "oui" || s.admin === "true" || (s as any).admin === true;
  const isRoleAdmin = s.role === 1 || s.role === "1" || s.role === "admin";
  const isRoleManager = s.role === 2 || s.role === "2" || (typeof s.role === "string" && s.role.toLowerCase() === "manager");
  
  return isAdminFlag || isRoleAdmin || isRoleManager;
}

/**
 * Checks if the current user is a Seller (Vendeur).
 */
export async function isSeller(session?: CustomSession | null): Promise<boolean> {
  const s = session || await getServerSession();
  if (!s) return false;
  return !await isAdminOrManager(s) && (s.role === 2 || s.role === "2");
}

/**
 * Gets the list of allowed depots for the user. (Synchronous if session provided)
 */
export function getAllowedDepots(session: CustomSession): string[] {
  if (!session || !session.depots) return [];
  return session.depots.split(",").map(d => d.trim()).filter(d => d.length > 0);
}

/**
 * Async version of getAllowedDepots
 */
export async function getAllowedDepotsAsync(): Promise<string[]> {
  const s = await getServerSession();
  if (!s) return [];
  return getAllowedDepots(s);
}

/**
 * Checks if the current user is a Platform Super Admin (Master Console & SaaS Platform Access).
 * Regular company administrators (Admin) do NOT have Super Admin privileges.
 */
export function isSuperAdmin(session?: CustomSession | null): boolean {
  if (!session) return false;
  const username = (session.username || "").toLowerCase();
  const orgId = session.organization_id;
  const isMasterOrg = orgId === "00000000-0000-0000-0000-000000000001";
  
  if (username === "superadmin") return true;
  if (isMasterOrg && username === "admin") return true;
  return false;
}


