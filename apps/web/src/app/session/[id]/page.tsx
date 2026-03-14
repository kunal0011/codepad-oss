"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/session";
import { Toolbar } from "@/components/session/Toolbar";
import { ParticipantsSidebar } from "@/components/session/ParticipantsSidebar";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { OutputPanel } from "@/components/terminal/OutputPanel";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, Maximize2, Terminal as TerminalIcon, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SessionPage() {
  const { id } = useParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { session, setSession, setParticipants, setFiles, reset } = useSessionStore();

  useEffect(() => {
    async function loadSession() {
      if (!id) return;
      
      try {
        setIsLoading(true);
        const response = await api.getSession(id as string);
        
        if (response.success && response.data) {
          setSession(response.data);
          setParticipants(response.data.participants || []);
          setFiles(response.data.files || []);
        } else {
          setError("Session not found or expired");
        }
      } catch (err) {
        console.error("Failed to load session:", err);
        setError("An unexpected error occurred while loading the session");
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();

    return () => {
      // Don't reset on every re-render, only on true unmount from the session
    };
  }, [id, setSession, setParticipants, setFiles]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#020617] text-white">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl border-2 border-primary/20 animate-spin" />
            <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Initializing Workspace</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#020617] p-6 text-white text-center">
        <div className="max-w-md glass-panel-heavy p-10 rounded-3xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 mb-6">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-slate-400 mb-8">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-6 py-3 font-bold hover:bg-white/10 transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex h-screen flex-col bg-[#020617] text-slate-200 overflow-hidden font-sans">
      <Toolbar sessionCode={session.code} language={session.language} />

      <main className="flex flex-1 overflow-hidden p-4 gap-4">
        {/* Left: Sidebar */}
        <motion.aside 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="hidden w-72 flex-col gap-4 lg:flex"
        >
          <div className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Explorer</span>
              <FileCode className="h-3.5 w-3.5 text-slate-500" />
            </div>
            <div className="flex-1 p-2">
              {/* File list will go here */}
              <div className="text-[10px] text-slate-600 text-center mt-10 uppercase font-bold tracking-tighter">Workspace Files</div>
            </div>
          </div>
          
          <div className="h-64 glass-panel rounded-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Participants</span>
              <Maximize2 className="h-3.5 w-3.5 text-slate-500" />
            </div>
            <ParticipantsSidebar />
          </div>
        </motion.aside>

        {/* Right: Main Content (Editor & Terminal) */}
        <div className="flex flex-1 flex-col gap-4 min-w-0">
          {/* Editor Area */}
          <motion.section 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex-[2] min-h-0"
          >
            <CodeEditor 
              sessionId={session.id} 
              language={session.language} 
              token="dev-token" // This will come from auth later
            />
          </motion.section>

          {/* Terminal Area */}
          <motion.section 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex-1 min-h-0"
          >
            <OutputPanel />
          </motion.section>
        </div>
      </main>
    </div>
  );
}
