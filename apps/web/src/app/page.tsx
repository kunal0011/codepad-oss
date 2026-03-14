"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Language } from "@codepad/shared";
import { motion } from "framer-motion";
import { 
  Terminal, 
  Users, 
  Cpu, 
  Video, 
  Shield, 
  ArrowRight,
  Code2,
  Sparkles,
  Zap,
  LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { value: Language.PYTHON, label: "Python", icon: "🐍", color: "#3776ab" },
  { value: Language.JAVASCRIPT, label: "Node.js", icon: "⚡", color: "#f7df1e" },
  { value: Language.TYPESCRIPT, label: "TypeScript", icon: "📘", color: "#3178c6" },
  { value: Language.GO, label: "Go", icon: "🔵", color: "#00add8" },
  { value: Language.RUST, label: "Rust", icon: "🦀", color: "#dea584" },
  { value: Language.JAVA, label: "Java", icon: "☕", color: "#ed8b00" },
];

export default function HomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(api.getToken());
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#020617] text-slate-200 selection:bg-primary/30">
      {/* Navigation - Ultra High Visibility */}
      <nav className="fixed top-0 left-0 right-0 z-[999] border-b border-white/10 bg-black py-4 shadow-2xl">
        <div className="flex items-center justify-between px-8 mx-auto max-w-7xl w-full">
          <div className="flex items-center gap-2">
            <Terminal className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold tracking-tight text-white">CodePad</span>
          </div>
          
          <div className="flex items-center gap-6">
            <Link href="/auth/login" className="text-sm font-bold text-slate-300 hover:text-white transition-all">
              Log In
            </Link>
            <Link 
              href="/auth/register" 
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-500 transition-all shadow-lg"
            >
              Sign Up
            </Link>
            {token && (
              <Link 
                href="/dashboard" 
                className="ml-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition-all border border-white/10"
              >
                Dashboard
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Background Orbs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] pointer-events-none" />
      
      {/* Mesh Grid */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <main className="relative z-10 mx-auto max-w-7xl px-6 pt-32 pb-20">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 mb-8 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">v1.0 Now Live</span>
          </motion.div>

          {/* Hero Heading */}
          <motion.h1 variants={itemVariants} className="max-w-4xl text-5xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl">
            Collaborative coding <br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-emerald-400 bg-clip-text text-transparent">
              without friction.
            </span>
          </motion.h1>

          <motion.p variants={itemVariants} className="mt-8 max-w-2xl text-lg text-slate-400 sm:text-xl">
            The professional environment for pair programming, interviews, and real-time synchronization. 
            Built with CRDTs and isolated cloud execution.
          </motion.p>

          {/* Action Cards */}
          <div className="mt-20 grid w-full grid-cols-1 gap-8 lg:grid-cols-12">
            
            {/* New Session Card */}
            <motion.div 
              variants={itemVariants}
              className="lg:col-span-7 group relative rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-xl transition-all hover:bg-white/[0.04]"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="text-left">
                  <h2 className="text-2xl font-bold">Start a New Workspace</h2>
                  <p className="text-sm text-slate-500 mt-1">Spin up a fresh environment in seconds.</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Zap className="h-6 w-6 fill-current" />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => router.push(`/session/new?lang=${lang.value}`)}
                    className="flex flex-col items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-5 text-center transition-all hover:border-primary/50 hover:bg-primary/5 hover:scale-[1.02] active:scale-95"
                  >
                    <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">{lang.icon}</span>
                    <span className="text-xs font-bold uppercase tracking-wider">{lang.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Join Session Card */}
            <motion.div 
              variants={itemVariants}
              className="lg:col-span-5 rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-xl transition-all hover:bg-white/[0.04]"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="text-left">
                  <h2 className="text-2xl font-bold">Join Existing</h2>
                  <p className="text-sm text-slate-500 mt-1">Connect to an ongoing session.</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                  <Users className="h-6 w-6" />
                </div>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="ABCDEF"
                    maxLength={6}
                    className="w-full h-20 rounded-2xl border border-white/10 bg-black/40 px-4 text-center font-mono text-4xl tracking-[0.4em] text-white placeholder:text-slate-800 focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                  <div className="absolute -top-3 left-6 px-2 bg-[#020617] text-[10px] font-bold text-slate-500 uppercase tracking-widest">Session Code</div>
                </div>

                <button
                  onClick={() => joinCode.length === 6 && router.push(`/session/join/${joinCode}`)}
                  disabled={joinCode.length !== 6}
                  className="group flex w-full items-center justify-center gap-3 h-16 rounded-2xl bg-primary px-6 font-bold text-white transition-all hover:bg-blue-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  <span>Connect to Workspace</span>
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </button>

                {/* Features Grid */}
                <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-white/5">
                  {[
                    { icon: Cpu, label: "V8 Sandbox" },
                    { icon: Video, label: "Live Video" },
                    { icon: Shield, label: "Secure Exec" },
                    { icon: Code2, label: "IntelliSense" }
                  ].map((feat, i) => (
                    <div key={i} className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors">
                      <feat.icon className="h-4 w-4" />
                      <span className="text-[10px] font-bold uppercase tracking-tight">{feat.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/5 bg-black/40 py-12 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <span className="font-bold tracking-tight text-white">CodePad</span>
          </div>
          <div className="text-slate-500 text-xs font-medium">
            © 2026 CodePad Engine. All rights reserved.
          </div>
          <div className="flex gap-6">
            {["GitHub", "Docs", "Status"].map((link) => (
              <a key={link} href="#" className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">{link}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
