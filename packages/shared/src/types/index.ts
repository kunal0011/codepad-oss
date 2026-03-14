// ─── User & Auth ────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  orgId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = "admin",
  MEMBER = "member",
  VIEWER = "viewer",
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  orgId?: string;
  iat: number;
  exp: number;
}

// ─── Session ────────────────────────────────────────────────
export interface Session {
  id: string;
  code: string;
  title: string;
  language: Language;
  type: SessionType;
  status: SessionStatus;
  ownerId: string;
  participants: SessionParticipant[];
  settings: SessionSettings;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export enum SessionType {
  PAIR_PROGRAMMING = "pair_programming",
  INTERVIEW = "interview",
  TEACHING = "teaching",
  SANDBOX = "sandbox",
}

export enum SessionStatus {
  CREATED = "created",
  ACTIVE = "active",
  PAUSED = "paused",
  COMPLETED = "completed",
  EXPIRED = "expired",
}

export interface SessionParticipant {
  userId: string;
  name: string;
  avatarUrl?: string;
  role: ParticipantRole;
  joinedAt: Date;
  isConnected: boolean;
  cursorPosition?: CursorPosition;
  color: string;
}

export enum ParticipantRole {
  OWNER = "owner",
  EDITOR = "editor",
  VIEWER = "viewer",
  INTERVIEWER = "interviewer",
}

export interface SessionSettings {
  maxParticipants: number;
  allowExecution: boolean;
  allowNetworkAccess: boolean;
  timeoutMinutes: number;
  isPasswordProtected: boolean;
  recordingEnabled: boolean;
}

// ─── Code Execution ─────────────────────────────────────────
export enum Language {
  PYTHON = "python",
  JAVASCRIPT = "javascript",
  TYPESCRIPT = "typescript",
  JAVA = "java",
  GO = "go",
  CPP = "cpp",
  RUBY = "ruby",
  RUST = "rust",
}

export interface LanguageRuntime {
  language: Language;
  version: string;
  displayName: string;
  monacoId: string;
  defaultFilename: string;
  compileCommand?: string;
  runCommand: string;
  imageTag: string;
}

export interface ExecutionRequest {
  sessionId: string;
  language: Language;
  files: FileEntry[];
  stdin?: string;
  timeout?: number;
}

export interface ExecutionResult {
  id: string;
  status: ExecutionStatus;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  memoryUsedBytes: number;
}

export enum ExecutionStatus {
  QUEUED = "queued",
  RUNNING = "running",
  COMPLETED = "completed",
  TIMEOUT = "timeout",
  ERROR = "error",
  KILLED = "killed",
}

export interface FileEntry {
  path: string;
  content: string;
  isEntryPoint: boolean;
}

// ─── Collaboration ──────────────────────────────────────────
export interface CursorPosition {
  line: number;
  column: number;
}

export interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}

export interface PresenceUpdate {
  userId: string;
  sessionId: string;
  cursor?: CursorPosition;
  selection?: SelectionRange;
  activeFile?: string;
  timestamp: number;
}

// ─── WebSocket Events ───────────────────────────────────────
export enum WsEvent {
  // Connection
  CONNECT = "connect",
  DISCONNECT = "disconnect",
  ERROR = "error",

  // Session
  SESSION_JOIN = "session:join",
  SESSION_LEAVE = "session:leave",
  SESSION_STATE = "session:state",

  // Document
  DOC_UPDATE = "doc:update",
  DOC_SYNC = "doc:sync",

  // Presence
  PRESENCE_UPDATE = "presence:update",
  PRESENCE_BROADCAST = "presence:broadcast",

  // Execution
  EXEC_REQUEST = "exec:request",
  EXEC_OUTPUT = "exec:output",
  EXEC_COMPLETE = "exec:complete",
  EXEC_ERROR = "exec:error",

  // Chat
  CHAT_MESSAGE = "chat:message",
}

// ─── Interview & Assessment ─────────────────────────────────
export interface Question {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  tags: string[];
  language: Language;
  starterCode: string;
  testCases: TestCase[];
  timeLimitMinutes?: number;
  createdBy: string;
}

export enum Difficulty {
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard",
}

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface Assessment {
  id: string;
  title: string;
  questions: string[]; // question IDs
  totalTimeLimitMinutes: number;
  createdBy: string;
}

export interface Evaluation {
  id: string;
  sessionId: string;
  candidateId: string;
  evaluatorId: string;
  rubricScores: RubricScore[];
  notes: string;
  overallScore: number;
  createdAt: Date;
}

export interface RubricScore {
  dimension: string;
  score: number; // 1-5
  comment?: string;
}

// ─── API Responses ──────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
