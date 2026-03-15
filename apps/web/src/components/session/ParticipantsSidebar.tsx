"use client";

import { useSessionStore } from "@/stores/session";
import { cn } from "@/lib/utils";
import { Mic, MicOff, Video, VideoOff, MoreVertical, ShieldCheck, User, FolderOpen, Users as UsersIcon, Plus, FileCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export function ParticipantsSidebar() {
  const router = useRouter();
  const { participants, files, activeFile, setActiveFile, session, setFiles } = useSessionStore();
  const [activeTab, setActiveTab] = useState<"files" | "users">("files");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName || !session) return;

    try {
      const response = await api.createFile(session.id, newFileName);
      if (response.success && response.data) {
        setFiles([...files, response.data]);
        setActiveFile(response.data.path);
        setNewFileName("");
        setIsCreatingFile(false);
      }
    } catch (err) {
      console.error("Failed to create file:", err);
    }
  };

  const handleLeave = async () => {
    if (!session) return;
    try {
      await api.leaveSession(session.id);
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to leave session:", err);
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex h-full flex-col bg-transparent">
      {/* Tabs */}
      <div className="flex border-b border-white/5 p-1 mx-2 mt-2 bg-white/5 rounded-xl">
        <button
          onClick={() => setActiveTab("files")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg",
            activeTab === "files" ? "bg-[#020617] text-primary shadow-sm" : "text-slate-500 hover:text-slate-300"
          )}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Files
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg",
            activeTab === "users" ? "bg-[#020617] text-primary shadow-sm" : "text-slate-500 hover:text-slate-300"
          )}
        >
          <UsersIcon className="h-3.5 w-3.5" />
          Users
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-3">
        {activeTab === "files" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Explorer</h3>
              <button 
                onClick={() => setIsCreatingFile(true)}
                className="rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-primary transition-all"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {isCreatingFile && (
              <form onSubmit={handleCreateFile} className="px-1 mb-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="filename.py"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onBlur={() => !newFileName && setIsCreatingFile(false)}
                  className="w-full rounded-lg bg-black/40 border border-primary/30 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </form>
            )}

            <div className="space-y-1">
              {files.map((file) => (
                <button
                  key={file.path}
                  onClick={() => setActiveFile(file.path)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition-all",
                    activeFile === file.path 
                      ? "bg-primary/10 text-primary border border-primary/20" 
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent"
                  )}
                >
                  <FileCode className={cn(
                    "h-4 w-4 transition-colors",
                    activeFile === file.path ? "text-primary" : "text-slate-600 group-hover:text-slate-400"
                  )} />
                  <span className="truncate">{file.path}</span>
                  {file.isEntryPoint && (
                    <span className="ml-auto text-[8px] opacity-40">●</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {participants.map((p, i) => (
                <motion.div
                  key={p.userId}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl p-2.5 transition-all",
                    p.isConnected ? "bg-white/5 hover:bg-white/10" : "opacity-50 grayscale"
                  )}
                >
                  <div className="relative">
                    <div 
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shadow-inner"
                      style={{ 
                        backgroundColor: `${p.color}20`,
                        color: p.color,
                        border: `1px solid ${p.color}40`
                      }}
                    >
                      {p.name?.charAt(0).toUpperCase() || "A"}
                    </div>
                    {p.isConnected && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#020617] bg-emerald-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs font-bold text-slate-200">
                        {p.name}
                      </p>
                      {p.role === "owner" && (
                        <ShieldCheck className="h-3 w-3 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-500">
                      {p.role}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {participants.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                  <User className="h-6 w-6 text-slate-600" />
                </div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">No one here yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto p-4 border-t border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Mic className="h-4 w-4 text-primary" />
            </div>
            <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <Video className="h-4 w-4 text-slate-400" />
            </div>
          </div>
          
          <button 
            onClick={handleLeave}
            className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
