"use client";

import { useSessionStore } from "@/stores/session";
import { api } from "@/lib/api";
import { LANGUAGE_RUNTIMES, type Language } from "@codepad/shared";
import { cn } from "@/lib/utils";
import { 
  Play, 
  Copy, 
  Check, 
  Users, 
  Sun, 
  Moon, 
  Terminal as TerminalIcon,
  Settings,
  Share2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  LogOut
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface ToolbarProps {
  sessionCode?: string;
  language: Language;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
}

export function Toolbar({
  sessionCode,
  language,
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
}: ToolbarProps) {
  const router = useRouter();
  const { session, files, isExecuting, participants, isConnected, theme, setTheme } = useSessionStore();
  const [copied, setCopied] = useState(false);

  const runtime = LANGUAGE_RUNTIMES[language];

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

  const handleRun = async () => {
    const { session, files, isExecuting } = useSessionStore.getState();
    if (!session || isExecuting) return;

    useSessionStore.getState().setExecuting(true);
    useSessionStore.getState().setExecutionResult(null);
    window.dispatchEvent(new CustomEvent("exec:start"));

    try {
      await api.executeCodeStream(
        {
          sessionId: session.id,
          language,
          files,
        },
        (event, data) => {
          if (event === "chunk") {
            window.dispatchEvent(new CustomEvent("exec:chunk", { detail: data }));
          } else if (event === "result") {
            useSessionStore.getState().setExecutionResult(data);
          } else if (event === "error") {
            window.dispatchEvent(new CustomEvent("exec:error", { detail: data }));
          }
        }
      );
    } catch (err) {
      console.error("Execution failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Execution failed";
      window.dispatchEvent(new CustomEvent("exec:error", { detail: { error: errorMessage } }));
    } finally {
      useSessionStore.getState().setExecuting(false);
    }
  };

  const copyCode = () => {
    if (sessionCode) {
      navigator.clipboard.writeText(sessionCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/60 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left: Brand & Session Info */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              <TerminalIcon className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              Code<span className="text-primary">Pad</span>
            </h1>
          </div>

          {sessionCode && (
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 pl-4 pr-1 py-1 sm:flex">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Session</span>
              <code className="font-mono text-sm font-semibold text-primary">{sessionCode}</code>
              <button
                onClick={copyCode}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
              </button>
            </div>
          )}

          <div className="hidden rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/20 lg:block">
            {runtime?.displayName || language}
          </div>
        </div>

        {/* Center: Primary Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleRun}
            disabled={isExecuting || !isConnected}
            className={cn(
              "group relative flex items-center gap-2 overflow-hidden rounded-full px-6 py-2.5 text-sm font-semibold transition-all",
              isExecuting 
                ? "bg-slate-800 text-slate-400 cursor-wait" 
                : "bg-emerald-500 text-white hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isExecuting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            ) : (
              <Play className="h-4 w-4 fill-current transition-transform group-hover:scale-110" />
            )}
            <span>Run</span>
            <span className="ml-2 hidden rounded bg-emerald-600/50 px-1.5 py-0.5 text-[10px] font-medium sm:inline-block">
              ⌘↵
            </span>
          </button>
        </div>

        {/* Right: User Presence & Settings */}
        <div className="flex items-center gap-4">
          {/* Participants */}
          <div className="flex items-center gap-3 pr-2">
            <div className="flex -space-x-2.5">
              {participants.slice(0, 3).map((p) => (
                <div
                  key={p.userId}
                  className="relative h-8 w-8 rounded-full border-2 border-background ring-1 ring-white/10 overflow-hidden bg-slate-800 shadow-lg"
                  title={p.name}
                >
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-bold" style={{ color: p.color }}>
                      {p.name?.charAt(0).toUpperCase() || "A"}
                    </div>
                  )}
                </div>
              ))}
              {participants.length > 3 && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-slate-800 text-[10px] font-bold ring-1 ring-white/10 shadow-lg">
                  +{participants.length - 3}
                </div>
              )}
            </div>
            <div className="flex flex-col items-start leading-none sm:flex">
              <span className="text-sm font-semibold">{participants.length}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-tighter font-bold">Online</span>
            </div>
          </div>

          <div className="h-8 w-px bg-white/10 mx-1" />

          <div className="flex items-center gap-1">
            <button
              onClick={onToggleAudio}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-all",
                isAudioEnabled ? "text-emerald-400 bg-emerald-500/10" : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            <button
              onClick={onToggleVideo}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-all",
                isVideoEnabled ? "text-emerald-400 bg-emerald-500/10" : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>

            <div className="h-6 w-px bg-white/10 mx-1" />

            <button
              onClick={() => setTheme(theme === "vs-dark" ? "light" : "vs-dark")}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white/5 hover:text-white transition-all"
            >
              {theme === "vs-dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white/5 hover:text-white transition-all">
              <Share2 className="h-5 w-5" />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white/5 hover:text-white transition-all">
              <Settings className="h-5 w-5" />
            </button>

            <button 
              onClick={handleLeave}
              className="ml-2 flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden xl:inline">Leave</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
