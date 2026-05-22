"use client";

import { useRef, useEffect, useState } from "react";
import { useSessionStore } from "@/stores/session";
import { formatDuration } from "@codepad/shared";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { cn } from "@/lib/utils";
import { Panel } from "@codepad/ui";
import { 
  Terminal as TerminalIcon, 
  Trash2, 
  Copy, 
  Download,
  Maximize2,
  ChevronDown
} from "lucide-react";

export function OutputPanel() {
  const { executionResult, isExecuting, setExecutionResult } = useSessionStore();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: {
        background: "transparent",
        foreground: "#cbd5e1",
        cursor: "#3b82f6",
        selectionBackground: "rgba(59, 130, 246, 0.3)",
      },
      allowTransparency: true,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Defer fit until container has dimensions (framer-motion animation)
    const fitTimeout = setTimeout(() => {
      try { fitAddon.fit(); } catch {}
    }, 300);

    const handleResize = () => {
      try { fitAddon.fit(); } catch {}
    };
    window.addEventListener("resize", handleResize);

    term.writeln("\x1b[1;34mWelcome to CodePad Terminal\x1b[0m");
    term.writeln("Output from your code execution will appear here.\r\n");

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
    };
  }, []);

  // Listen to streaming execution events
  useEffect(() => {
    const handleStart = () => {
      if (!xtermRef.current) return;
      xtermRef.current.clear();
      xtermRef.current.writeln("\x1b[1;33m[RUNNING]\x1b[0m Executing code...\r\n");
    };

    const handleChunk = (e: Event) => {
      const customEvent = e as CustomEvent;
      const chunk = customEvent.detail;
      if (!xtermRef.current) return;
      
      if (chunk.stream === "stderr") {
        xtermRef.current.write(`\x1b[1;31m${chunk.data}\x1b[0m`);
      } else {
        xtermRef.current.write(chunk.data);
      }
    };

    const handleError = (e: Event) => {
      const customEvent = e as CustomEvent;
      const errorData = customEvent.detail;
      if (!xtermRef.current) return;
      xtermRef.current.writeln(`\r\n\x1b[1;31m[ERROR] ${errorData.error || errorData}\x1b[0m`);
    };

    window.addEventListener("exec:start", handleStart);
    window.addEventListener("exec:chunk", handleChunk);
    window.addEventListener("exec:error", handleError);

    return () => {
      window.removeEventListener("exec:start", handleStart);
      window.removeEventListener("exec:chunk", handleChunk);
      window.removeEventListener("exec:error", handleError);
    };
  }, []);

  // Update terminal when execution result completes
  useEffect(() => {
    if (!xtermRef.current || !executionResult) return;

    const statusColor = executionResult.exitCode === 0 ? "32" : "31";
    xtermRef.current.writeln(`\r\n\x1b[1;${statusColor}m[FINISHED]\x1b[0m Exit code: ${executionResult.exitCode} (${formatDuration(executionResult.executionTimeMs)})`);
  }, [executionResult]);

  const clearTerminal = () => {
    xtermRef.current?.clear();
    setExecutionResult(null);
  };

  const copyTerminal = () => {
    // This is simplified, xterm has better selection APIs
    const buffer = xtermRef.current?.buffer.active;
    if (!buffer) return;
    let content = "";
    for (let i = 0; i < buffer.length; i++) {
      content += buffer.getLine(i)?.translateToString() + "\n";
    }
    navigator.clipboard.writeText(content);
  };

  return (
    <Panel className="flex h-full flex-col overflow-hidden rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-800">
            <TerminalIcon className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Terminal</span>
          {isExecuting && (
            <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
              <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-tighter">Executing</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button onClick={copyTerminal} className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-md transition-all" title="Copy Output">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-md transition-all" title="Download Log">
            <Download className="h-3.5 w-3.5" />
          </button>
          <button onClick={clearTerminal} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/5 rounded-md transition-all" title="Clear Console">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-md transition-all">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal area */}
      <div className="flex-1 p-2 bg-black/20">
        <div ref={terminalRef} className="h-full w-full" />
      </div>
    </Panel>
  );
}
