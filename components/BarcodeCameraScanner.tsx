"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { Camera, X, Zap, RefreshCw, Barcode, CheckCircle2, Sparkles } from "lucide-react";

interface BarcodeCameraScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  title?: string;
}

export default function BarcodeCameraScanner({
  onScan,
  onClose,
  title,
}: BarcodeCameraScannerProps) {
  const { locale } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [scannedSuccess, setScannedSuccess] = useState<string | null>(null);

  // Play audio beep sound
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  };

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function startCamera() {
      try {
        setCameraError(null);
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }

        // Initialize BarcodeDetector if natively supported in browser
        if ("BarcodeDetector" in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"],
          });

          const interval = setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState === 4) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0) {
                  const detectedValue = barcodes[0].rawValue;
                  if (detectedValue) {
                    playBeep();
                    setScannedSuccess(detectedValue);
                    clearInterval(interval);
                    setTimeout(() => {
                      onScan(detectedValue);
                      onClose();
                    }, 600);
                  }
                }
              } catch (err) {}
            }
          }, 300);

          return () => clearInterval(interval);
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        setCameraError(
          locale === "ar"
            ? "تعذر الوصول إلى الكاميرا. يرجى التأكد من منح الإذن أو إدخال الباركود يدوياً."
            : "Impossible d'accéder à la caméra. Vérifiez les autorisations ou saisissez le code manuellement."
        );
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [locale, onScan, onClose]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    playBeep();
    onScan(manualCode.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 text-white rounded-3xl shadow-2xl border border-white/10 overflow-hidden relative">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/10 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Camera size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black">
                {title || (locale === "ar" ? "ماسح الباركود بالكاميرا" : "Scanner Barcode Caméra")}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                {locale === "ar" ? "وجّه الكاميرا نحو باركود الصنف" : "Pointez vers le code-barres de l'article"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Camera Viewfinder */}
        <div className="relative w-full h-[280px] bg-black overflow-hidden flex items-center justify-center">
          {cameraError ? (
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                <Barcode size={24} />
              </div>
              <p className="text-xs text-slate-300">{cameraError}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Target Overlays */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-56 h-36 border-2 border-dashed border-indigo-400/80 rounded-2xl flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                  {/* Animated Laser Scanning Line */}
                  <div className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-bounce" />
                </div>
              </div>

              {/* Scanned Badge */}
              {scannedSuccess && (
                <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 animate-in zoom-in-95">
                  <CheckCircle2 size={42} className="text-emerald-400 animate-bounce" />
                  <span className="text-sm font-black text-white">{scannedSuccess}</span>
                  <span className="text-xs text-emerald-300 font-bold">
                    {locale === "ar" ? "تم التقاط الباركود!" : "Code Détecté !"}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Manual Fallback Form */}
        <form onSubmit={handleManualSubmit} className="p-4 bg-slate-950/70 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={locale === "ar" ? "أو اكتب رقم الباركود يدوياً..." : "Ou saisir le code manuellement..."}
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {locale === "ar" ? "إضافة" : "Valider"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
