"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Package, Users, FileText, ArrowRight, Loader2, Command } from "lucide-react";
import Link from "next/link";

export default function UnifiedSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ articles: any[], clients: any[], invoices: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      setIsOpen(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      setIsOpen(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <div className="relative w-full max-w-xl mx-auto" ref={dropdownRef}>
      <div className="relative group">
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
        </div>
        <input
          type="text"
          placeholder="Recherche globale (Article, Client, Facture...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          className="w-full bg-white/80 hover:bg-white focus:bg-white backdrop-blur-xl border border-slate-200 focus:border-indigo-500/50 rounded-2xl py-3.5 pl-14 pr-12 text-sm font-bold text-slate-900 shadow-sm focus:shadow-xl focus:shadow-indigo-500/10 transition-all outline-none"
        />
        {query && (
          <button 
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={14} />
          </button>
        )}
        <div className="absolute right-14 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md opacity-40 group-focus-within:opacity-0 transition-opacity">
           <Command size={10} />
           <span className="text-[10px] font-black uppercase">K</span>
        </div>
      </div>

      {isOpen && results && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-white/95 backdrop-blur-2xl border border-slate-200/60 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] overflow-hidden z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="max-h-[70vh] overflow-y-auto p-3 space-y-4 custom-scrollbar">
            
            {/* Articles */}
            {results.articles.length > 0 && (
              <section>
                <h3 className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <Package size={12} />
                  Articles
                </h3>
                <div className="space-y-1 mt-1">
                  {results.articles.map((art) => (
                    <Link 
                      key={art.id} 
                      href="/dashboard/articles" 
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-between p-3 rounded-2xl hover:bg-indigo-50 group/item transition-all"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-800 group-hover/item:text-indigo-600">{art.designation}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{art.reference}</span>
                      </div>
                      <ArrowRight size={14} className="text-slate-300 opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-1 transition-all" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Clients */}
            {results.clients.length > 0 && (
              <section>
                <h3 className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <Users size={12} />
                  Clients
                </h3>
                <div className="space-y-1 mt-1">
                  {results.clients.map((c) => (
                    <Link 
                      key={c.id} 
                      href="/dashboard/clients" 
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-between p-3 rounded-2xl hover:bg-emerald-50 group/item transition-all"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-800 group-hover/item:text-emerald-600">{c.nom}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{c.ref_client} • {c.tel}</span>
                      </div>
                      <ArrowRight size={14} className="text-slate-300 opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-1 transition-all" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Invoices */}
            {results.invoices.length > 0 && (
              <section>
                <h3 className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <FileText size={12} />
                  Factures
                </h3>
                <div className="space-y-1 mt-1">
                  {results.invoices.map((inv) => (
                    <Link 
                      key={inv.id} 
                      href="/dashboard/invoices" 
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-between p-3 rounded-2xl hover:bg-rose-50 group/item transition-all"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-800 group-hover/item:text-rose-600">{inv.bl_number}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{inv.total_ttc} F CFA • {inv.date_facture}</span>
                      </div>
                      <ArrowRight size={14} className="text-slate-300 opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-1 transition-all" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {results.articles.length === 0 && results.clients.length === 0 && results.invoices.length === 0 && (
              <div className="p-12 text-center">
                 <Search size={40} className="mx-auto text-slate-200 mb-4" />
                 <p className="text-slate-900 font-black">Aucun résultat</p>
                 <p className="text-slate-400 text-xs font-medium mt-1">Essayez d'autres mots-clés.</p>
              </div>
            )}
          </div>
          
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
             <div className="flex items-center gap-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <span className="flex items-center gap-1.5"><kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-200">↑↓</kbd> Naviguer</span>
                <span className="flex items-center gap-1.5"><kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-200">↵</kbd> Sélectionner</span>
             </div>
             <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Logiciel Easy Enterprise</span>
          </div>
        </div>
      )}
    </div>
  );
}
