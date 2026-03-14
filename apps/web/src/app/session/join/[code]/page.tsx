"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import { Loader2, AlertCircle, Terminal } from "lucide-react";

export default function JoinSessionPage() {
  const { code } = useParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function join() {
      if (!code) return;
      
      try {
        const response = await api.joinSession(code as string);
        if (response.success && response.data) {
          router.push(`/session/${response.data.session.id}`);
        } else {
          setError(response.error?.message || "Failed to join session. Please check the code.");
        }
      } catch (err) {
        console.error("Join error:", err);
        setError("An unexpected error occurred while joining the session.");
      }
    }

    join();
  }, [code, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#020617] text-white p-6">
      {/* Background decoration */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[128px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md text-center z-10"
      >
        {!error ? (
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl border-2 border-primary/20 animate-spin" />
              <Loader2 className="absolute inset-0 m-auto h-10 w-10 animate-spin text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Joining Session</h1>
              <p className="text-slate-500 font-mono text-xl tracking-widest">{code}</p>
            </div>
            <p className="text-sm text-slate-400">Please wait while we connect you to the workspace...</p>
          </div>
        ) : (
          <div className="glass-panel-heavy p-10 rounded-3xl border border-red-500/20">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 mb-6 text-red-500">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Join Failed</h2>
            <p className="text-slate-400 mb-8">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-6 py-3 font-bold hover:bg-white/10 transition-all active:scale-95"
            >
              Back to Home
            </button>
          </div>
        )}
      </motion.div>

      {/* Footer Brand */}
      <div className="absolute bottom-12 flex items-center gap-2 opacity-20">
        <Terminal className="h-5 w-5 text-primary" />
        <span className="font-bold tracking-tight">CodePad</span>
      </div>
    </div>
  );
}
