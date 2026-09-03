"use client";

import { useState, useRef, useEffect } from "react";
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
  Mic,
  MicOff,
  ArrowRight,
  ShieldCheck,
  FileText,
  Package,
  Layers,
  BarChart3,
  Loader2
} from "lucide-react";
import Link from "next/link";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  time: string;
  kpi?: {
    title: string;
    val1: string;
    lbl1: string;
    val2: string;
    lbl2: string;
  };
}

export default function AICopilotPage() {
  const { t, locale, dir } = useLanguage();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text:
        locale === "ar"
          ? "مرحباً بك! أنا **GestionPro AI Executive Copilot**، مستشارك الذكي لإدارة الأعمال والتحليلات المالية والمخزون والتنبؤات. كيف يمكنني مساعدتك اليوم؟"
          : "Bonjour ! Je suis **GestionPro AI Executive Copilot**, votre analyste décisionnel en temps réel pour vos ventes, marges, stocks et prévisions. Que souhaitez-vous analyser ?",
      time: "À l'instant",
      kpi: {
        title: "Statut Système",
        val1: "En Ligne",
        lbl1: "Connexion Cloud",
        val2: "100%",
        lbl2: "Données Synchronisées",
      },
    },
  ]);

  const presetQuestions = [
    {
      label: locale === "ar" ? "📊 أرباح ومبيعات هذا الشهر" : "📊 Rentabilité & Chiffre d'Affaires du mois",
      query: "Quelle est la rentabilité et les ventes de ce mois ?",
    },
    {
      label: locale === "ar" ? "⚠️ فحص المخزون والإنذار المبكر" : "⚠️ Analyse des ruptures et stocks faibles",
      query: "Quels sont les articles en rupture ou stock faible ?",
    },
    {
      label: locale === "ar" ? "👥 كشف ديون العملاء الأكثر تأخراً" : "👥 Top des créances et clients débiteurs",
      query: "Analyse des dettes et créances clients",
    },
    {
      label: locale === "ar" ? "🔮 توقع المبيعات للأسبوع القادم" : "🔮 Modèle prédictif des ventes (J+7)",
      query: "Prévision des ventes et opportunités commerciales",
    },
    {
      label: locale === "ar" ? "🛡️ ملخص رادار الأمان ومكافحة التلاعب" : "🛡️ Synthèse du Radar Anti-Fraude",
      query: "Quel est le bilan du radar de sécurité et anti-fraude ?",
    },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

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

  // Web Speech Recognition for Voice Input
  const toggleVoice = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(locale === "ar" ? "المتصفح لا يدعم ميزة الإملاء الصوتي المباشر." : "Votre navigateur ne supporte pas la reconnaissance vocale.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = locale === "ar" ? "ar-SA" : "fr-FR";
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        handleSendMessage(transcript);
      };

      recognition.start();
    } catch (e) {
      console.error("Voice recognition error", e);
      setIsListening(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto pb-12 font-sans" dir={dir}>
      {/* 4K Executive Control Header */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <BrainCircuit size={14} />
                NEURAL BUSINESS COPILOT 4K
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                INTELLIGENCE DÉCISIONNELLE CONNECTÉE
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "المساعد التنفيذي ومحلل الأعمال بالذكاء الاصطناعي" : "Assistant Exécutif & Décisionnel IA"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "اسأل صوتياً أو كتابياً عن أي مؤشر مالي، أرباح، تنبؤات المبيعات، أو تدقيق أمان فوري لشركتك"
                : "Analyse prédictive en langage naturel, rentabilité en temps réel et alertes de gestion prioritaires"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/reports/profit-loss"
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <BarChart3 size={14} />
              <span>{locale === "ar" ? "الأرباح (P&L)" : "P&L"}</span>
            </Link>
            <Link
              href="/dashboard/audit"
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <ShieldCheck size={14} />
              <span>{locale === "ar" ? "رادار الأمان" : "Audit"}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Preset Questions Chips Bar */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
        {presetQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q.query)}
            className="px-4 py-2 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-500 hover:bg-indigo-50/50 text-slate-700 text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <Sparkles size={13} className="text-indigo-600" />
            <span>{q.label}</span>
          </button>
        ))}
      </div>

      {/* Chat Messages Box */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col h-[520px]">
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3.5 max-w-2xl ${
                m.sender === "user" ? (locale === "ar" ? "mr-auto flex-row-reverse" : "ml-auto flex-row-reverse") : ""
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                  m.sender === "user"
                    ? "bg-slate-900 text-white"
                    : "bg-gradient-to-tr from-indigo-600 to-purple-600 text-white"
                }`}
              >
                {m.sender === "user" ? <Users size={16} /> : <Bot size={18} />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-2 max-w-[85%]">
                <div
                  className={`p-4 rounded-3xl text-xs leading-relaxed shadow-xs ${
                    m.sender === "user"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-tr-none"
                      : "bg-slate-50 text-slate-900 border border-slate-200/80 font-normal rounded-tl-none"
                  }`}
                >
                  <div className="whitespace-pre-line prose prose-xs">
                    {m.text}
                  </div>

                  {/* Embedded KPI Widget if provided */}
                  {m.kpi && (
                    <div className="mt-3 p-3 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider block">
                        {m.kpi.title}
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-center pt-1">
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="font-black font-mono text-sm text-slate-900">{m.kpi.val1}</div>
                          <div className="text-[10px] text-slate-500 font-bold">{m.kpi.lbl1}</div>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="font-black font-mono text-sm text-emerald-600">{m.kpi.val2}</div>
                          <div className="text-[10px] text-slate-500 font-bold">{m.kpi.lbl2}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-medium px-2">
                  {m.time}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 max-w-md items-center text-slate-400 text-xs font-bold animate-pulse">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center">
                <Bot size={16} />
              </div>
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <Loader2 size={14} className="animate-spin text-indigo-600" />
                <span>{locale === "ar" ? "المساعد يحلل بيانات المؤسسة الآن..." : "Analyse des données en cours..."}</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 flex items-center gap-3">
          <button
            type="button"
            onClick={toggleVoice}
            className={`p-3 rounded-2xl transition-all cursor-pointer shadow-sm ${
              isListening
                ? "bg-rose-600 text-white animate-bounce"
                : "bg-white text-slate-600 hover:text-indigo-600 border border-slate-200"
            }`}
            title={locale === "ar" ? "إملاء صوتي مباشر" : "Reconnaissance vocale"}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder={
              locale === "ar"
                ? "اسأل Copilot: مثلاً: ما هي مبيعات هذا الشهر؟ أو من هم أكثر العملاء مديونية؟"
                : "Posez votre question à Copilot (ex: chiffre d'affaires, rupture de stock, prévision...)"
            }
            className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || loading}
            className="p-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-bold transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
