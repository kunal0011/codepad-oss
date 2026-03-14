"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Session } from "@codepad/shared";
import { 
  Plus, 
  Search, 
  Terminal, 
  History, 
  Clock, 
  Users, 
  Settings,
  ChevronRight,
  Code2,
  Brain,
  Video,
  Loader2,
  LogOut,
  Globe,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const [mySessions, setSessions] = useState<Session[]>([]);
  const [searchResults, setSearchResults] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadSessions() {
      try {
        const response = await api.listSessions();
        if (response.success && response.data) {
          setSessions(response.data);
        }
      } catch (err) {
        console.error("Failed to load sessions:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSessions();
  }, []);

  // Handle global search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 3) {
        try {
          setIsSearching(true);
          const response = await api.searchSessions(searchQuery);
          if (response.success && response.data) {
            setSearchResults(response.data);
          }
        } catch (err) {
          console.error("Search failed:", err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleLogout = () => {
    api.clearToken();
    router.push("/auth/login");
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#020617] text-slate-200">
      {/* Background decoration */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[128px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#020617]/60 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Terminal className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">CodePad</span>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
            <div className="h-10 w-10 rounded-full border-2 border-primary/20 p-0.5">
              <div className="h-full w-full rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-primary">
                JD
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">Workspace Dashboard</h1>
            <p className="text-slate-500 font-medium">Manage your collaborative coding sessions and assessments.</p>
          </div>
          
          <button 
            onClick={() => router.push("/session/new")}
            className="flex items-center gap-2 px-6 h-14 rounded-2xl bg-primary font-bold text-white shadow-xl hover:bg-blue-500 hover:shadow-primary/20 transition-all active:scale-95"
          >
            <Plus className="h-5 w-5" />
            <span>New Session</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left: Global Search & Join */}
          <div className="lg:col-span-5 space-y-8">
            <div className="glass-panel-heavy rounded-3xl p-8 border border-white/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                  <Globe className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold">Join a Workspace</h2>
              </div>

              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input 
                  type="text"
                  placeholder="Search by title or 6-digit code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 rounded-2xl bg-black/40 border border-white/10 focus:border-primary/50 focus:outline-none transition-all text-sm font-medium"
                />
                {isSearching && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                )}
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                <AnimatePresence mode="popLayout">
                  {searchResults.map((session) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      onClick={() => router.push(`/session/join/${session.code}`)}
                      className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-emerald-500/30 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl">
                          {session.language === "python" ? "🐍" : "⚡"}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-200 truncate max-w-[150px]">{session.title}</p>
                          <p className="text-[10px] font-mono text-emerald-500 font-bold uppercase tracking-widest">{session.code}</p>
                        </div>
                      </div>
                      <button className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {searchQuery.length >= 3 && searchResults.length === 0 && !isSearching && (
                  <div className="text-center py-8 opacity-40">
                    <p className="text-xs font-bold uppercase tracking-widest">No workspaces found</p>
                  </div>
                )}

                {searchQuery.length < 3 && (
                  <div className="text-center py-12 opacity-30">
                    <Globe className="h-10 w-10 mx-auto mb-3 text-slate-600" />
                    <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                      Enter at least 3 characters <br/> to search globally
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: My Sessions */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <History className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">My Active Workspaces</h2>
            </div>

            <div className="space-y-4">
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="h-24 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
                ))
              ) : mySessions.length > 0 ? (
                <AnimatePresence mode="popLayout">
                  {mySessions.map((session, i) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => router.push(`/session/${session.id}`)}
                      className="group flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/10 hover:bg-white/[0.05] hover:border-primary/30 transition-all cursor-pointer shadow-lg"
                    >
                      <div className="flex items-center gap-5">
                        <div className="h-12 w-12 rounded-xl bg-slate-800 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                          {session.language === "python" ? "🐍" : "⚡"}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-slate-200">{session.title}</h3>
                            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-[9px] font-bold text-primary uppercase tracking-widest border border-primary/20">
                              {session.code}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-slate-500 text-[10px] font-bold uppercase tracking-tighter">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Active</span>
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Workspace</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <ChevronRight className="h-5 w-5 text-slate-700 group-hover:text-primary transition-colors" />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center glass-panel rounded-3xl opacity-50 border-dashed">
                  <Terminal className="h-12 w-12 mb-4 text-slate-600" />
                  <p className="font-medium text-slate-400">You haven&apos;t joined any workspaces yet</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
