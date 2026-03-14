import { Language, type LanguageRuntime } from "../types/index.js";

export const LANGUAGE_RUNTIMES: Record<Language, LanguageRuntime> = {
  [Language.PYTHON]: {
    language: Language.PYTHON,
    version: "3.12",
    displayName: "Python 3.12",
    monacoId: "python",
    defaultFilename: "main.py",
    runCommand: "python3 main.py",
    imageTag: "codepad/runtime-python:3.12",
  },
  [Language.JAVASCRIPT]: {
    language: Language.JAVASCRIPT,
    version: "22",
    displayName: "Node.js 22",
    monacoId: "javascript",
    defaultFilename: "index.js",
    runCommand: "node index.js",
    imageTag: "codepad/runtime-node:22",
  },
  [Language.TYPESCRIPT]: {
    language: Language.TYPESCRIPT,
    version: "5.6",
    displayName: "TypeScript 5.6",
    monacoId: "typescript",
    defaultFilename: "index.ts",
    compileCommand: "tsc --outDir /tmp/out index.ts",
    runCommand: "node /tmp/out/index.js",
    imageTag: "codepad/runtime-node:22",
  },
  [Language.JAVA]: {
    language: Language.JAVA,
    version: "21",
    displayName: "Java 21",
    monacoId: "java",
    defaultFilename: "Main.java",
    compileCommand: "javac Main.java",
    runCommand: "java Main",
    imageTag: "codepad/runtime-java:21",
  },
  [Language.GO]: {
    language: Language.GO,
    version: "1.23",
    displayName: "Go 1.23",
    monacoId: "go",
    defaultFilename: "main.go",
    runCommand: "go run main.go",
    imageTag: "codepad/runtime-go:1.23",
  },
  [Language.CPP]: {
    language: Language.CPP,
    version: "17",
    displayName: "C++ 17",
    monacoId: "cpp",
    defaultFilename: "main.cpp",
    compileCommand: "g++ -std=c++17 -o /tmp/a.out main.cpp",
    runCommand: "/tmp/a.out",
    imageTag: "codepad/runtime-cpp:17",
  },
  [Language.RUBY]: {
    language: Language.RUBY,
    version: "3.3",
    displayName: "Ruby 3.3",
    monacoId: "ruby",
    defaultFilename: "main.rb",
    runCommand: "ruby main.rb",
    imageTag: "codepad/runtime-ruby:3.3",
  },
  [Language.RUST]: {
    language: Language.RUST,
    version: "1.82",
    displayName: "Rust 1.82",
    monacoId: "rust",
    defaultFilename: "main.rs",
    compileCommand: "rustc -o /tmp/a.out main.rs",
    runCommand: "/tmp/a.out",
    imageTag: "codepad/runtime-rust:1.82",
  },
};

export const EXECUTION_LIMITS = {
  maxMemoryMB: 512,
  maxCpuCores: 1,
  maxTimeoutSec: 30,
  maxOutputBytes: 1_048_576, // 1MB
  maxOutputRateBytes: 10_240, // 10KB/s
  maxBurstBytes: 51_200, // 50KB
  maxFileSizeBytes: 10_485_760, // 10MB
  maxFiles: 50,
  idleTimeoutSec: 1800, // 30 min
  maxLifetimeSec: 3600, // 60 min
} as const;

export const SESSION_DEFAULTS = {
  maxParticipants: 10,
  snapshotIntervalSec: 30,
  sessionExpiryDays: 7,
  archiveAfterDays: 90,
  maxReconnectAttempts: 5,
  heartbeatIntervalMs: 5000,
  heartbeatTimeoutMs: 15000,
} as const;

export const AUTH_DEFAULTS = {
  accessTokenTtlSec: 900, // 15 min
  refreshTokenTtlDays: 7,
  maxLoginAttempts: 5,
  lockoutDurationMin: 15,
  bcryptRounds: 12,
} as const;

export const RATE_LIMITS = {
  perUser: { windowMs: 60_000, max: 100 },
  perOrg: { windowMs: 60_000, max: 1000 },
  execution: { windowMs: 60_000, max: 30 },
} as const;

export const PARTICIPANT_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
  "#BB8FCE", "#85C1E9", "#F0B27A", "#82E0AA",
] as const;
