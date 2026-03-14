import { create } from "zustand";
import type {
  Session,
  SessionParticipant,
  FileEntry,
  ExecutionResult,
  Language,
} from "@codepad/shared";

interface SessionState {
  // Session data
  session: Session | null;
  participants: SessionParticipant[];
  files: FileEntry[];
  activeFile: string | null;

  // Editor state
  isExecuting: boolean;
  executionResult: ExecutionResult | null;
  theme: "vs-dark" | "light";

  // Connection
  isConnected: boolean;
  connectionError: string | null;

  // Actions
  setSession: (session: Session) => void;
  setParticipants: (participants: SessionParticipant[]) => void;
  setFiles: (files: FileEntry[]) => void;
  setActiveFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  addFile: (file: FileEntry) => void;
  setExecuting: (executing: boolean) => void;
  setExecutionResult: (result: ExecutionResult | null) => void;
  setTheme: (theme: "vs-dark" | "light") => void;
  setConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  session: null,
  participants: [],
  files: [],
  activeFile: null,
  isExecuting: false,
  executionResult: null,
  theme: "vs-dark" as const,
  isConnected: false,
  connectionError: null,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  setSession: (session) => set({ session }),
  setParticipants: (participants) => set({ participants }),
  setFiles: (files) =>
    set((state) => ({
      files,
      activeFile: state.activeFile ?? files.find((f) => f.isEntryPoint)?.path ?? files[0]?.path ?? null,
    })),
  setActiveFile: (path) => set({ activeFile: path }),
  updateFileContent: (path, content) =>
    set((state) => ({
      files: state.files.map((f) => (f.path === path ? { ...f, content } : f)),
    })),
  addFile: (file) =>
    set((state) => ({ files: [...state.files, file] })),
  setExecuting: (isExecuting) => set({ isExecuting }),
  setExecutionResult: (executionResult) => set({ executionResult }),
  setTheme: (theme) => set({ theme }),
  setConnected: (isConnected) => set({ isConnected }),
  setConnectionError: (connectionError) => set({ connectionError }),
  reset: () => set(initialState),
}));
