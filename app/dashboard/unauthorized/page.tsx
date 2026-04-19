"use client";

import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home, Lock } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="relative w-full max-w-2xl text-center">
        {/* Decorative Blobs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-500/10 blur-[120px] rounded-full -z-10 animate-pulse"></div>
        
        {/* Glass Card */}
        <div className="bg-white/70 backdrop-blur-3xl border border-white/80 rounded-[48px] p-12 shadow-2xl shadow-rose-100/40 animate-in zoom-in-95 duration-500">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-rose-500 blur-2xl opacity-20 animate-pulse"></div>
              <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-tr from-rose-500 to-rose-600 flex items-center justify-center shadow-xl shadow-rose-200">
                <ShieldAlert size={48} className="text-white" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-white shadow-lg flex items-center justify-center border border-rose-50">
                 <Lock size={20} className="text-rose-500" />
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Accès Non Autorisé</h1>
          <p className="text-slate-500 text-lg font-medium mb-10 max-w-md mx-auto leading-relaxed">
            Désolé, vous n'avez pas les permissions nécessaires pour accéder à cette section administrative.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/dashboard"
              className="flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-slate-200 hover:scale-105 active:scale-95 transition-all w-full sm:w-auto"
            >
              <Home size={20} />
              Retour au Tableau de Bord
            </Link>
            <button 
              onClick={() => window.history.back()}
              className="flex items-center gap-3 bg-white text-slate-600 border border-slate-200 px-8 py-4 rounded-2xl font-black hover:bg-slate-50 transition-all w-full sm:w-auto"
            >
              <ArrowLeft size={20} />
              Page Précédente
            </button>
          </div>

          <div className="mt-12 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
            <Lock size={12} />
            Système de Sécurité GestionPro - Identifiant {Date.now().toString(16).toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
}
