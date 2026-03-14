"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Language } from "@codepad/shared";
import { 
  Terminal, 
  ArrowLeft,
  ArrowRight, 
  Sparkles,
  Zap,
  Code2,
  FileText,
  Clock,
  Layout,
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { value: Language.PYTHON, label: "Python 3.12", icon: "🐍", desc: "Best for data & AI" },
  { value: Language.JAVASCRIPT, label: "Node.js 22", icon: "⚡", desc: "Fast & non-blocking" },
  { value: Language.TYPESCRIPT, label: "TypeScript 5.6", icon: "📘", desc: "Type-safe scalability" },
  { value: Language.GO, label: "Go 1.25", icon: "🔵", desc: "Efficient & concurrent" },
  { value: Language.RUST, label: "Rust 1.82", icon: "🦀", desc: "Memory safety & speed" },
  { value: Language.JAVA, label: "Java 21", icon: "☕", desc: "Robust & enterprise" },
];

export default function NewSessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020617] flex items-center justify-center flex-col gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Loading Configuration</p>
      </div>
    }>
      <NewSessionContent />
    </Suspense>
  );
}

function NewSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLang = searchParams.get("lang") as Language || Language.PYTHON;

  const [title, setTitle] = useState("Untitled Session");
  const [language, setLanguage] = useState<Language>(initialLang);
  const [isSubmitting, setIsExecuting] = useState(false);

  const handleCreate = async () => {
    try {
      setIsExecuting(true);
      const response = await api.createSession({
        title,
        language,
        type: "pair_programming",
      });

      if (response.success && response.data) {
        router.push(`/session/${response.data.id}`);
      }
    } catch (err) {
      console.error("Failed to create session:", err);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#020617] text-slate-200 p-6 sm:p-12">
      {/* Background decoration */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[128px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-4xl"
      >
        {/* Breadcrumb / Back */}
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-12 font-bold uppercase tracking-widest text-[10px]"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Dashboard
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left: Configuration */}
          <div className="lg:col-span-7 space-y-10">
            <div>
              <h1 className="text-5xl font-extrabold tracking-tight mb-4">Initialize Workspace</h1>
              <p className="text-slate-500 text-lg">Configure your collaborative environment.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Workspace Name</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                  <input 
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full h-16 pl-14 pr-4 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all text-xl font-bold"
                    placeholder="Untitled Session"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1 font-mono">Select Language Engine</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.value}
                      onClick={() => setLanguage(lang.value)}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group",
                        language === lang.value
                          ? "bg-primary/20 border-primary shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      )}
                    >
                      <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">{lang.icon}</span>
                      <div>
                        <p className="font-bold text-sm text-slate-200 leading-tight">{lang.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{lang.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Preview & Submit */}
          <div className="lg:col-span-5">
            <div className="sticky top-12 glass-panel-heavy rounded-3xl p-8 border border-white/10">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-8 border border-primary/20 shadow-lg">
                <Sparkles className="h-6 w-6" />
              </div>
              
              <h3 className="text-xl font-bold mb-6 leading-tight">Configuration <br/>Summary</h3>
              
              <div className="space-y-4 mb-10">
                {[
                  { icon: Code2, label: "Engine", value: LANGUAGES.find(l => l.value === language)?.label },
                  { icon: Layout, label: "Environment", value: "Modern IDE" },
                  { icon: Clock, label: "TTL", value: "60 Minutes" },
                  { icon: Zap, label: "Provisioning", value: "Sub-second" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-white/5">
                    <div className="flex items-center gap-2 text-slate-500">
                      <item.icon className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-200">{item.value}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleCreate}
                disabled={isSubmitting}
                className="group relative flex w-full items-center justify-center gap-3 h-16 rounded-2xl bg-primary px-6 font-bold text-white shadow-2xl transition-all hover:bg-blue-500 hover:shadow-primary/20 active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <span>Create Workspace</span>
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
              
              <p className="mt-6 text-[9px] text-center font-bold text-slate-600 uppercase tracking-widest leading-relaxed">
                By creating a workspace, you agree to our <br/>
                <a href="#" className="text-primary hover:underline">Terms of Service</a>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
