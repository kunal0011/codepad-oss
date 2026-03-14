"use client";

import { useRef, useCallback, useEffect, useMemo } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { useSessionStore } from "@/stores/session";
import { LANGUAGE_RUNTIMES, type Language } from "@codepad/shared";
import { cn } from "@/lib/utils";
import { Loader2, X } from "lucide-react";

interface CodeEditorProps {
  sessionId: string;
  language: Language;
  token: string;
}

export function CodeEditor({ sessionId, language, token }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const { files, activeFile, theme, setActiveFile, isConnected, setConnected } = useSessionStore();

  const runtime = LANGUAGE_RUNTIMES[language];

  // Initialize Yjs
  const { ydoc, provider } = useMemo(() => {
    const doc = new Y.Doc();
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8082";
    const p = new WebsocketProvider(wsUrl, sessionId, doc, {
      params: { token },
      connect: false, // Don't connect immediately
    });
    return { ydoc: doc, provider: p };
  }, [sessionId, token]);

  useEffect(() => {
    provider.connect();
    provider.on("status", (event: { status: string }) => {
      setConnected(event.status === "connected");
    });

    return () => {
      provider.disconnect();
      ydoc.destroy();
    };
  }, [provider, ydoc, setConnected]);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;

    // Editor settings for modern feel
    editor.updateOptions({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontLigatures: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      padding: { top: 16, bottom: 16 },
      lineNumbers: "on",
      renderLineHighlight: "all",
      bracketPairColorization: { enabled: true },
      autoClosingBrackets: "always",
      autoClosingQuotes: "always",
      tabSize: language === "python" || language === "ruby" ? 4 : 2,
      insertSpaces: true,
      wordWrap: "off",
      smoothScrolling: true,
      cursorSmoothCaretAnimation: "on",
      cursorBlinking: "smooth",
      roundedSelection: true,
    });

    // Create Yjs binding
    const yText = ydoc.getText("code");
    
    bindingRef.current = new MonacoBinding(
      yText,
      editor.getModel()!,
      new Set([editor]),
      provider.awareness
    );

    // Sync Monaco changes back to our store (needed for the "Run" button)
    editor.onDidChangeModelContent(() => {
      const content = editor.getValue();
      const { files, activeFile, setFiles } = useSessionStore.getState();
      if (activeFile) {
        const updatedFiles = files.map(f => 
          f.path === activeFile ? { ...f, content } : f
        );
        setFiles(updatedFiles);
      }
    });

    editor.focus();
  }, [language, ydoc, provider.awareness]);

  // Clean up binding on file change or unmount
  useEffect(() => {
    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    };
  }, [activeFile]);

  return (
    <div className="flex h-full flex-col overflow-hidden glass-panel rounded-xl">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {files.map((file) => (
            <button
              key={file.path}
              onClick={() => setActiveFile(file.path)}
              className={cn(
                "group flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200",
                file.path === activeFile
                  ? "bg-primary/20 text-primary shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-primary/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              )}
            >
              {file.path}
              {files.length > 1 && (
                <X className="h-3 w-3 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all" />
              )}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3 px-4">
          <div className={cn(
            "h-2 w-2 rounded-full transition-all duration-500",
            isConnected ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-red-500 shadow-[0_0_8px_#ef4444]"
          )} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {isConnected ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      {/* Editor area */}
      <div className="relative flex-1 bg-transparent">
        {!isConnected && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-slate-300">Connecting to session...</p>
            </div>
          </div>
        )}
        <Editor
          height="100%"
          language={runtime?.monacoId ?? "plaintext"}
          theme={theme === "vs-dark" ? "vs-dark" : "light"}
          onMount={handleMount}
          loading={null}
          options={{
            automaticLayout: true,
            readOnly: !isConnected,
          }}
        />
      </div>
    </div>
  );
}
