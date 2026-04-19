import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * POST /api/settings/supabase
 * Updates the .env.local file with new Supabase URL and Anon Key.
 * Requires server restart to take effect.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      supabaseUrl?: string;
      supabaseKey?: string;
    };

    const { supabaseUrl, supabaseKey } = body;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { ok: false, error: "supabaseUrl et supabaseKey sont requis." },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(supabaseUrl);
    } catch {
      return NextResponse.json(
        { ok: false, error: "URL Supabase invalide." },
        { status: 400 }
      );
    }

    // Path to .env.local in the project root
    const envPath = path.join(process.cwd(), ".env.local");

    // Read existing .env.local content
    let envContent = "";
    try {
      envContent = await fs.readFile(envPath, "utf-8");
    } catch {
      // File doesn't exist yet, start fresh
      envContent = "";
    }

    // Parse existing env vars (preserve any extra vars)
    const lines = envContent.split(/\r?\n/);
    const envMap = new Map<string, string>();
    const orderedKeys: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx);
      const value = trimmed.substring(eqIdx + 1);
      if (!envMap.has(key)) orderedKeys.push(key);
      envMap.set(key, value);
    }

    // Update or add the Supabase vars
    if (!envMap.has("NEXT_PUBLIC_SUPABASE_URL")) orderedKeys.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!envMap.has("NEXT_PUBLIC_SUPABASE_ANON_KEY")) orderedKeys.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    envMap.set("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl.trim());
    envMap.set("NEXT_PUBLIC_SUPABASE_ANON_KEY", supabaseKey.trim());

    // Rebuild .env.local
    const newContent = orderedKeys.map((key) => `${key}=${envMap.get(key)}`).join("\n") + "\n";

    await fs.writeFile(envPath, newContent, "utf-8");

    return NextResponse.json({
      ok: true,
      message: "Configuration Supabase enregistrée dans .env.local. Redémarrez le serveur pour appliquer.",
    });
  } catch (err) {
    console.error("Error saving Supabase config:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Erreur interne du serveur.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/settings/supabase
 * Returns the current Supabase configuration (URL only, key is masked).
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return NextResponse.json({
    ok: true,
    supabaseUrl: url,
    supabaseKeyMasked: key ? `${key.substring(0, 20)}...${key.substring(key.length - 6)}` : "",
    supabaseKeyLength: key.length,
  });
}
