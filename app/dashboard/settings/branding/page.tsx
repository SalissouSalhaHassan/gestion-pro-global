"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function BrandingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/settings?tab=branding");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      <p className="text-xs font-bold text-slate-500">
        Redirection vers le Studio Unifié Paramètres & Branding...
      </p>
    </div>
  );
}
