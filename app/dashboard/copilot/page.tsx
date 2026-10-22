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
  Loader2,
  Building2,
  Copy,
  Check,
  Volume2,
  VolumeX,
  ExternalLink,
  ChevronRight,
  PieChart as PieChartIcon,
  HelpCircle,
  Clock,
  Sparkle,
  ArrowUpRight
} from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from "recharts";

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
  chartData?: {
    type: "bar" | "pie";
    title: string;
    data: any[];
    dataKey: string;
  };
  suggestions?: string[];
  quickActions?: {
    label: string;
    href: string;
    icon?: string;
  }[];
}

export default function AICopilotPage() {
  const { t, locale, dir } = useLanguage();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechActive, setSpeechActive] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const match = document.cookie.match(/gp_session=([^;]+)/);
      if (match) {
        const parsed = JSON.parse(decodeURIComponent(match[1]));
        if (parsed.organization_name) {
          setOrgName(parsed.organization_name);
        }
      }
    } catch (e) {}
  }, []);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text:
        locale === "ar"
          ? "مرحباً بك! أنا **GestionPro AI Executive Copilot**، مستشارك التنفيذي المدعوم بالذكاء الاصطناعي لتحليل المبيعات، وهوامش الربح، والتنبؤات بالمخزون، ورادار مكافحة التلاعب.\n\nجميع بياناتك ومؤشراتك معزولة ومحمية بنسبة 100% خاصة بمؤسستكم. اختر من الاقتراحات السريعة أدناه أو اكتب/تحدث بسؤالك مباشرة."
          : "Bonjour ! Je suis **GestionPro AI Executive Copilot**, votre analyste décisionnel en temps réel pour vos ventes, marges, stocks et prévisions.\n\nToutes vos métriques sont 100% isolées et dédiées à votre organisation. Choisissez une suggestion rapide ci-dessous ou posez votre question à la voix ou à l'écrit.",
      time: "À l'instant",
      kpi: {
        title: locale === "ar" ? "حالة النظام والبيانات" : "Statut Système & Sécurité",
        val1: locale === "ar" ? "متصل ونشط" : "En Ligne",
        lbl1: locale === "ar" ? "خوادم السحاب" : "Connexion Cloud 4K",
        val2: "100% Isolé",
        lbl2: locale === "ar" ? "تشفير المؤسسة" : "Chiffrement Dédié",
      },
      suggestions: [
        locale === "ar" ? "📊 أرباح ومبيعات هذا الشهر" : "📊 Rentabilité & Ventes du mois",
        locale === "ar" ? "⚠️ فحص المخزون والإنذار المبكر" : "⚠️ Diagnostic des ruptures de stock",
        locale === "ar" ? "👥 كشف ديون العملاء الأكثر تأخراً" : "👥 Top des créances et clients débiteurs",
        locale === "ar" ? "🔮 توقع المبيعات للأسبوع القادم" : "🔮 Modèle prédictif des ventes J+7",
      ],
      quickActions: [
        { label: locale === "ar" ? "تقرير الأرباح (P&L)" : "Rapport P&L", href: "/dashboard/reports/profit-loss" },
        { label: locale === "ar" ? "رادار الأمان" : "Radar Anti-Fraude", href: "/dashboard/audit" },
        { label: locale === "ar" ? "المخزون والمستودعات" : "Gestion Stocks", href: "/dashboard/stocks" },
      ],
    },
  ]);

  const presetQuestions = [
    {
      label: locale === "ar" ? "📊 أرباح ومبيعات الشهر" : "📊 Rentabilité & Ventes du mois",
      query: "Quelle est la rentabilité et les ventes de ce mois ?",
      icon: TrendingUp,
      color: "from-blue-600 to-indigo-600",
    },
    {
      label: locale === "ar" ? "⚠️ فحص المخزون والإنذار" : "⚠️ Ruptures et alertes stock",
      query: "Quels sont les articles en rupture ou stock faible ?",
      icon: AlertTriangle,
      color: "from-amber-500 to-orange-600",
    },
    {
      label: locale === "ar" ? "👥 ديون العملاء المعلقة" : "👥 Top créances débiteurs",
      query: "Analyse des dettes et créances clients",
      icon: Users,
      color: "from-rose-500 to-pink-600",
    },
    {
      label: locale === "ar" ? "🔮 توقع المبيعات (J+7)" : "🔮 Prévision des ventes (J+7)",
      query: "Prévision des ventes et opportunités commerciales",
      icon: Zap,
      color: "from-purple-600 to-violet-600",
    },
    {
      label: locale === "ar" ? "🛡️ رادار الأمان ومكافحة التلاعب" : "🛡️ Bilan Radar Anti-Fraude",
      query: "Quel est le bilan du radar de sécurité et anti-fraude ?",
      icon: ShieldCheck,
      color: "from-emerald-600 to-teal-600",
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
        text: data.reply || (locale === "ar" ? "تم التحليل بنجاح." : "Analyse terminée."),
        time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        kpi: data.kpis,
        chartData: data.chartData,
        suggestions: data.suggestions,
        quickActions: data.quickActions,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error("AI prompt failed", err);
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text: locale === "ar"
          ? "⚠️ تعذر الاتصال بمحرك الذكاء الاصطناعي، يرجى المحاولة بعد قليل."
          : "⚠️ Impossible de joindre le moteur décisionnel IA. Réessayez dans un instant.",
        time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const speakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speechActive) {
      window.speechSynthesis.cancel();
      setSpeechActive(false);
      return;
    }

    const cleanText = text.replace(/[*#_`]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = locale === "ar" ? "ar-SA" : "fr-FR";
    utterance.rate = 1.05;
    utterance.onend = () => setSpeechActive(false);
    utterance.onerror = () => setSpeechActive(false);

    setSpeechActive(true);
    window.speechSynthesis.speak(utterance);
  };

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
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto pb-12 font-sans" dir={dir}>
      {/* 4K Executive Ultra Control Header */}
      <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-indigo-500/25 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-lg shadow-indigo-500/25">
                <BrainCircuit size={15} />
                NEURAL BUSINESS COPILOT 4K
              </span>
              {orgName && (
                <span className="text-xs font-bold text-indigo-200 flex items-center gap-1.5 bg-indigo-950/80 px-3 py-1 rounded-xl border border-indigo-500/30">
                  <Building2 size={13} className="text-indigo-400" />
                  {orgName} (Isolé & Dédié)
                </span>
              )}
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 bg-emerald-950/70 px-3 py-1 rounded-xl border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                DÉCISIONNEL TEMPS RÉEL
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
              {locale === "ar" ? "المساعد التنفيذي ومحلل الأعمال بالذكاء الاصطناعي" : "Assistant Exécutif & Décisionnel IA"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1.5 max-w-2xl leading-relaxed">
              {locale === "ar"
                ? "اسأل صوتياً أو كتابياً عن أي مؤشر مالي، أرباح، تنبؤات المبيعات، ومراقبة المخازن والديون مع رسوم بيانية تفاعلية"
                : "Analyses financières prédictives en langage naturel, détection des risques et rentabilité consolidée en temps réel"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/dashboard/reports/profit-loss"
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 border border-white/10 shadow-sm"
            >
              <BarChart3 size={15} className="text-indigo-300" />
              <span>{locale === "ar" ? "الأرباح (P&L)" : "Compte P&L"}</span>
            </Link>
            <Link
              href="/dashboard/audit"
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 border border-white/10 shadow-sm"
            >
              <ShieldCheck size={15} className="text-emerald-400" />
              <span>{locale === "ar" ? "رادار الأمان" : "Radar Audit"}</span>
            </Link>
            <button
              onClick={() => {
                setMessages([messages[0]]);
              }}
              title={locale === "ar" ? "إعادة بدء المحادثة" : "Réinitialiser la conversation"}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/10 cursor-pointer"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Preset Questions Chips Bar with Global Modern Badges */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
        {presetQuestions.map((q, idx) => {
          const Icon = q.icon;
          return (
            <button
              key={idx}
              onClick={() => handleSendMessage(q.query)}
              className="group px-4 py-2.5 rounded-2xl bg-white hover:bg-indigo-50/60 border border-slate-200/90 hover:border-indigo-400 text-slate-800 text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-2.5 cursor-pointer"
            >
              <div className={`w-6 h-6 rounded-lg bg-gradient-to-tr ${q.color} text-white flex items-center justify-center shadow-xs`}>
                <Icon size={13} />
              </div>
              <span>{q.label}</span>
              <ChevronRight size={14} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </button>
          );
        })}
      </div>

      {/* Chat Messages Container */}
      <div className="bg-white rounded-[32px] border border-slate-200/90 shadow-sm overflow-hidden flex flex-col h-[580px]">
        {/* Messages List Area */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3.5 max-w-3xl ${
                m.sender === "user" ? (locale === "ar" ? "mr-auto flex-row-reverse" : "ml-auto flex-row-reverse") : ""
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                  m.sender === "user"
                    ? "bg-slate-900 text-white"
                    : "bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 text-white"
                }`}
              >
                {m.sender === "user" ? <Users size={18} /> : <Bot size={20} />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-2.5 max-w-[90%]">
                <div
                  className={`p-5 rounded-3xl text-xs leading-relaxed shadow-xs ${
                    m.sender === "user"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-tr-none"
                      : "bg-slate-50/90 text-slate-900 border border-slate-200/80 font-normal rounded-tl-none"
                  }`}
                >
                  <div className="whitespace-pre-line prose prose-xs text-slate-800">
                    {m.text}
                  </div>

                  {/* Embedded Interactive Chart Widget */}
                  {m.chartData && (
                    <div className="mt-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-black uppercase text-indigo-700 tracking-wider flex items-center gap-1.5">
                          <BarChart3 size={14} />
                          {m.chartData.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">Données en direct</span>
                      </div>
                      <div className="w-full h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          {m.chartData.type === "bar" ? (
                            <BarChart data={m.chartData.data}>
                              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "#0f172a",
                                  borderRadius: "12px",
                                  border: "none",
                                  color: "#fff",
                                  fontSize: "11px",
                                }}
                              />
                              <Bar dataKey={m.chartData.dataKey} radius={[6, 6, 0, 0]}>
                                {m.chartData.data.map((entry: any, index: number) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={index % 2 === 0 ? "#4f46e5" : "#7c3aed"}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          ) : (
                            <PieChart>
                              <Pie
                                data={m.chartData.data}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={60}
                                label={({ name, percent }: any) =>
                                  `${name} (${(percent * 100).toFixed(0)}%)`
                                }
                              >
                                {m.chartData.data.map((entry: any, index: number) => (
                                  <Cell key={`pie-cell-${index}`} fill={entry.fill || "#4f46e5"} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Embedded KPI Dual Metric Widget */}
                  {m.kpi && (
                    <div className="mt-3.5 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider block">
                        {m.kpi.title}
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-center pt-1">
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="font-black font-mono text-sm text-slate-900">{m.kpi.val1}</div>
                          <div className="text-[10px] text-slate-500 font-bold">{m.kpi.lbl1}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="font-black font-mono text-sm text-emerald-600">{m.kpi.val2}</div>
                          <div className="text-[10px] text-slate-500 font-bold">{m.kpi.lbl2}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Action Navigation Buttons */}
                  {m.quickActions && m.quickActions.length > 0 && (
                    <div className="mt-3.5 pt-3 border-t border-slate-200/70 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block w-full">
                        {locale === "ar" ? "روابط سريعة ذات صلة:" : "Accès Rapides Recommandés :"}
                      </span>
                      {m.quickActions.map((act, aIdx) => (
                        <Link
                          key={aIdx}
                          href={act.href}
                          className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition-all flex items-center gap-1.5 border border-indigo-200/60"
                        >
                          <span>{act.label}</span>
                          <ArrowUpRight size={12} />
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* AI Next Follow-up Suggestions */}
                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 space-y-1.5">
                      <span className="text-[10px] font-bold text-indigo-500 flex items-center gap-1">
                        <Sparkle size={11} />
                        {locale === "ar" ? "أسئلة مقترحة للمتابعة:" : "Questions complémentaires suggérées :"}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {m.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => handleSendMessage(sug)}
                            className="text-[11px] font-semibold text-slate-600 bg-white hover:bg-indigo-50 hover:text-indigo-700 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors text-left cursor-pointer"
                          >
                            • {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Message Utility Footbar */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium px-2">
                  <div className="flex items-center gap-2">
                    <Clock size={11} />
                    <span>{m.time}</span>
                  </div>
                  {m.sender === "ai" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(m.text, m.id)}
                        className="hover:text-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                        title={locale === "ar" ? "نسخ النص" : "Copier le texte"}
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check size={12} className="text-emerald-600" />
                            <span className="text-emerald-600">{locale === "ar" ? "تم النسخ" : "Copié"}</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>{locale === "ar" ? "نسخ" : "Copier"}</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => speakText(m.text)}
                        className="hover:text-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                        title={locale === "ar" ? "قراءة صوتية" : "Lecture audio"}
                      >
                        {speechActive ? <VolumeX size={12} className="text-indigo-600" /> : <Volume2 size={12} />}
                        <span>{speechActive ? (locale === "ar" ? "إيقاف" : "Stop") : (locale === "ar" ? "استماع" : "Écouter")}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3.5 max-w-md items-center text-slate-500 text-xs font-bold animate-pulse">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md">
                <Bot size={18} />
              </div>
              <div className="flex items-center gap-2.5 p-4 rounded-3xl bg-slate-50 border border-slate-200">
                <Loader2 size={16} className="animate-spin text-indigo-600" />
                <span>{locale === "ar" ? "المساعد يحلل قواعد البيانات والمؤشرات الآن..." : "Analyse décisionnelle en cours..."}</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Global Executive Input Bar */}
        <div className="p-4 lg:p-5 border-t border-slate-200/80 bg-slate-50/70 flex items-center gap-3">
          <button
            type="button"
            onClick={toggleVoice}
            className={`p-3.5 rounded-2xl transition-all cursor-pointer shadow-sm ${
              isListening
                ? "bg-rose-600 text-white animate-bounce ring-4 ring-rose-500/30"
                : "bg-white text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200"
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
                ? "اسأل Copilot: مبيعات هذا الشهر، حالة المخازن، كشف ديون العملاء، أو التوقعات..."
                : "Posez votre question à Copilot (ex: chiffre d'affaires, rupture de stock, prévision...)"
            }
            className="flex-1 py-3.5 px-5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs placeholder:text-slate-400 placeholder:font-normal"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || loading}
            className="px-5 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white rounded-2xl font-bold transition-all shadow-md shadow-indigo-600/25 disabled:opacity-50 cursor-pointer flex items-center gap-2"
          >
            <Send size={16} />
            <span className="hidden sm:inline text-xs">{locale === "ar" ? "إرسال" : "Envoyer"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
