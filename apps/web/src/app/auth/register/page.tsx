"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import { 
  Terminal, 
  Mail, 
  Lock, 
  User,
  ArrowRight, 
  Github, 
  Chrome,
  AlertCircle,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.register(email, password, name);
      if (response.success) {
        setIsSuccess(true);
        setTimeout(() => router.push("/auth/login"), 2000);
      } else {
        setError(response.error?.message || "Failed to create account");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSSO = (provider: "google" | "github") => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/${provider}`;
  };

  if (isSuccess) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden bg-[#020617] text-slate-200 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel-heavy p-12 rounded-3xl text-center max-w-sm"
        >
          <div className="mx-auto h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Account Created!</h2>
          <p className="text-slate-400">Welcome to CodePad. Redirecting you to login...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#020617] text-slate-200 flex items-center justify-center p-6">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-[0_0_20px_rgba(59,130,246,0.5)] mb-4">
            <Terminal className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Create Account</h1>
          <p className="text-slate-500 text-sm mt-2 font-medium">Join the professional coding platform</p>
        </div>

        <div className="glass-panel-heavy rounded-3xl p-8 backdrop-blur-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-black/40 border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-black/40 border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-black/40 border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm"
                  placeholder="••••••••"
                />
              </div>
              <p className="text-[9px] text-slate-600 ml-1">At least 8 characters with numbers & symbols</p>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-500"
              >
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-xs font-medium">{error}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="group w-full h-12 rounded-xl bg-primary flex items-center justify-center gap-2 font-bold text-white shadow-xl hover:bg-blue-500 hover:shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
              <span className="bg-[#020617] px-4 text-slate-500">Or sign up with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => handleSSO("github")}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-semibold text-sm"
            >
              <Github className="h-5 w-5" />
              <span>GitHub</span>
            </button>
            <button 
              onClick={() => handleSSO("google")}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-semibold text-sm"
            >
              <Chrome className="h-5 w-5" />
              <span>Google</span>
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-sm text-slate-500 font-medium">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-primary hover:text-blue-400 font-bold transition-colors underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
