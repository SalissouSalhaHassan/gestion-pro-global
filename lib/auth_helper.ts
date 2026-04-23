import { cookies } from "next/headers";

export interface CustomSession {
  id: string | number;
  username: string;
  role: string | number;
  admin: string;
  emplacement: string;
  depots?: string;
}

/**
 * Gets the custom user session from the 'gp_session' cookie.
 * @returns The session object or null if not found/invalid.
 */
export async function getServerSession(): Promise<CustomSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gp_session")?.value;

  if (!sessionCookie) return null;

  try {
    const decoded = decodeURIComponent(sessionCookie);
    return JSON.parse(decoded) as CustomSession;
  } catch (error) {
    console.error("Failed to parse custom session cookie:", error);
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
  
  return isAdminFlag || isRoleAdmin;
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
 * Gets the list of allowed depots for the user.
 */
export async function getAllowedDepots(session?: CustomSession | null): Promise<string[]> {
  const s = session || await getServerSession();
  if (!s || !s.depots) return [];
  return s.depots.split(",").map(d => d.trim()).filter(d => d.length > 0);
}

