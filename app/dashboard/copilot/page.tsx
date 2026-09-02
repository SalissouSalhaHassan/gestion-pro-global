"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import {
  Bot,
  Sparkles,
  Send,
  TrendingUp,
  AlertTriangle,
  Users,
  BrainCircuit,
  Lightbulb,
  Zap,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  time: string;
  kpi?: any;
}

export default function AICopilotPage() {
  const { t, locale, dir } = useLanguage();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text:
        locale === "ar"
          ? "مرحباً بك! أنا **GestionPro AI Copilot**، مساعدك الذكي لإدارة الأعمال والتحليلات المالية والمخزون. كيف يمكنني مساعدتك اليوم؟"
          : "Bonjour ! Je suis **GestionPro AI Copilot**, votre assistant d'intelligence décisionnelle pour vos ventes, stocks et rentabilité. Que souhaitez-vous analyser aujourd'hui ?",
      time: "À l'instant",
    },
  ]);

  const presetQuestions = [
    {
      label: locale === "ar" ? "📈 ما هي أرباح ومبيعات هذا الشهر؟" : "📈 Quelle est la rentabilité de ce mois ?",
      query: "Quelle est la rentabilité et les ventes de ce mois ?",
    },
    {
      label: locale === "ar" ? "⚠️ ما هي المنتجات القريبة من النفاد؟" : "⚠️ Quels articles sont en rupture de stock ?",
      query: "Quels sont les articles en rupture ou stock faible ?",
    },
    {
      label: locale === "ar" ? "👥 من هم العملاء الأكثر مديونية وتأخراً؟" : "👥 Quels clients ont des factures impayées ?",
      query: "Analyse des dettes et créances clients",
    },
    {
      label: locale === "ar" ? "🔮 توقع المبيعات للأسبوع القادم" : "🔮 Prévision des ventes pour la semaine",
      query: "Prévision des ventes et opportunités commerciales",
    },
  ];

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
      time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: textToSend, locale }),
      });

      const data = await res.json();

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: data.reply || "Analyse terminée.",
        time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        kpi: data.kpis,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error("AI prompt failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <BrainCircuit size={14} />
                NEURAL BUSINESS AI
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <Sparkles size={12} className="text-amber-400" />
                Copilot 4K Connected
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "المساعد الذكي للأعمال (AI Copilot)" : "Assistant IA Décisionnel"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "اسأل الذكاء الاصطناعي عن المبيعات، المخزون، وتوقعات الأرباح والحركات المالية فورياً"
                : "Posez vos questions stratégiques et obtenez des analyses financières et stocks en direct"}
            </p>
          </div>
        </div>
      </div>

      {/* Preset Fast Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {presetQuestions.map((q, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(q.query)}
            className="p-3.5 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/30 text-left transition-all text-xs font-bold text-slate-700 shadow-xs cursor-pointer flex items-center gap-2"
          >
            <span>{q.label}</span>
          </button>
        ))}
      </div>

      {/* Chat Messages Container */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 min-h-[420px] max-h-[550px] overflow-y-auto flex flex-col space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-3 ${
              m.sender === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${
                m.sender === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20"
              }`}
            >
              {m.sender === "user" ? "👤" : <Bot size={18} />}
            </div>

            <div
              className={`max-w-[80%] rounded-2xl p-4 text-sm ${
                m.sender === "user"
                  ? "bg-indigo-600 text-white font-bold"
                  : "bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed font-medium"
              }`}
            >
              <div className="whitespace-pre-line">{m.text}</div>

              {m.kpi && (
                <div className="mt-3 p-3 rounded-xl bg-white border border-indigo-100 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-500">{m.kpi.metric}</span>
                  <span className="text-sm font-black text-indigo-600">{m.kpi.value}</span>
                </div>
              )}

              <div
                className={`text-[10px] mt-2 font-bold ${
                  m.sender === "user" ? "text-indigo-200 text-right" : "text-slate-400"
                }`}
              >
                {m.time}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black animate-spin">
              <RefreshCw size={18} />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-slate-100 text-xs font-bold text-slate-500 animate-pulse">
              {locale === "ar" ? "الذكاء الاصطناعي يقوم بتحليل البيانات وإعداد التقرير..." : "GestionPro AI analyse vos données..."}
            </div>
          </div>
        )}
      </div>

      {/* Input Prompt Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm"
      >
        <input
          type="text"
          placeholder={
            locale === "ar"
              ? "اطرح سؤالك للذكاء الاصطناعي (مثلاً: ما هي مبيعات الأسمنت هذا الأسبوع؟)..."
              : "Posez une question sur vos ventes, stocks, finances..."
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-850 focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Send size={15} />
          <span>{locale === "ar" ? "تحليل" : "Envoyer"}</span>
        </button>
      </form>
    </div>
  );
}
