"use client";

import { useSessionStore } from "@/stores/session";
import { cn } from "@/lib/utils";
import { Mic, MicOff, Video, VideoOff, MoreVertical, ShieldCheck, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function ParticipantsSidebar() {
  const { participants } = useSessionStore();

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2">
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
              {/* Avatar with Status Ring */}
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
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#020617] bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                )}
              </div>

              {/* User Info */}
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

              {/* Interaction Controls (visible on hover) */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400">
                  <Mic className="h-3.5 w-3.5" />
                </button>
                <button className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400">
                  <Video className="h-3.5 w-3.5" />
                </button>
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

      {/* LiveKit / Local User Controls */}
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
          
          <button className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
