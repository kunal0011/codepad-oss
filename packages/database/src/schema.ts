import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["admin", "member", "viewer"]);
export const sessionStatusEnum = pgEnum("session_status", [
  "created", "active", "paused", "completed", "expired",
]);
export const sessionTypeEnum = pgEnum("session_type", [
  "pair_programming", "interview", "teaching", "sandbox",
]);
export const participantRoleEnum = pgEnum("participant_role", [
  "owner", "editor", "viewer", "interviewer",
]);
export const languageEnum = pgEnum("language", [
  "python", "javascript", "typescript", "java", "go", "cpp", "ruby", "rust",
]);
export const executionStatusEnum = pgEnum("execution_status", [
  "queued", "running", "completed", "timeout", "error", "killed",
]);
export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"]);

// ─── Organizations ──────────────────────────────────────────
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  plan: varchar("plan", { length: 50 }).notNull().default("free"),
  maxSeats: integer("max_seats").notNull().default(5),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Users ──────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: text("password_hash"),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").notNull().default("member"),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
  googleId: varchar("google_id", { length: 255 }),
  githubId: varchar("github_id", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  loginAttempts: integer("login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("users_email_idx").on(table.email),
  index("users_org_idx").on(table.orgId),
  uniqueIndex("users_google_idx").on(table.googleId),
  uniqueIndex("users_github_idx").on(table.githubId),
]);

// ─── Refresh Tokens ─────────────────────────────────────────
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("refresh_tokens_user_idx").on(table.userId),
  index("refresh_tokens_hash_idx").on(table.tokenHash),
]);

// ─── Sessions ───────────────────────────────────────────────
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  language: languageEnum("language").notNull(),
  type: sessionTypeEnum("type").notNull().default("sandbox"),
  status: sessionStatusEnum("status").notNull().default("created"),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  passwordHash: text("password_hash"),
  settings: jsonb("settings").notNull().default({
    maxParticipants: 10,
    allowExecution: true,
    allowNetworkAccess: false,
    timeoutMinutes: 60,
    isPasswordProtected: false,
    recordingEnabled: false,
  }),
  templateId: uuid("template_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("sessions_owner_idx").on(table.ownerId),
  index("sessions_status_idx").on(table.status),
  index("sessions_code_idx").on(table.code),
]);

// ─── Session Participants ───────────────────────────────────
export const sessionParticipants = pgTable("session_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  role: participantRoleEnum("role").notNull().default("editor"),
  color: varchar("color", { length: 7 }).notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
}, (table) => [
  index("participants_session_idx").on(table.sessionId),
  uniqueIndex("participants_session_user_idx").on(table.sessionId, table.userId),
]);

// ─── Session Files ──────────────────────────────────────────
export const sessionFiles = pgTable("session_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  path: varchar("path", { length: 500 }).notNull(),
  content: text("content").notNull().default(""),
  isEntryPoint: boolean("is_entry_point").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("files_session_idx").on(table.sessionId),
  uniqueIndex("files_session_path_idx").on(table.sessionId, table.path),
]);

// ─── Executions ─────────────────────────────────────────────
export const executions = pgTable("executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id),
  language: languageEnum("language").notNull(),
  status: executionStatusEnum("status").notNull().default("queued"),
  stdout: text("stdout").default(""),
  stderr: text("stderr").default(""),
  exitCode: integer("exit_code"),
  executionTimeMs: integer("execution_time_ms"),
  memoryUsedBytes: integer("memory_used_bytes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("executions_session_idx").on(table.sessionId),
  index("executions_user_idx").on(table.userId),
]);

// ─── Session Snapshots (CRDT state) ────────────────────────
export const sessionSnapshots = pgTable("session_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  crdtState: text("crdt_state").notNull(), // base64-encoded Yjs state
  version: integer("version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("snapshots_session_idx").on(table.sessionId),
]);

// ─── Session Recordings ────────────────────────────────────
export const sessionRecordings = pgTable("session_recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  s3Key: text("s3_key").notNull(),
  durationMs: integer("duration_ms"),
  sizeBytes: integer("size_bytes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("recordings_session_idx").on(table.sessionId),
]);

// ─── Questions ──────────────────────────────────────────────
export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  difficulty: difficultyEnum("difficulty").notNull(),
  tags: jsonb("tags").notNull().default([]),
  language: languageEnum("language").notNull(),
  starterCode: text("starter_code").notNull().default(""),
  solutionCode: text("solution_code"),
  testCases: jsonb("test_cases").notNull().default([]),
  timeLimitMinutes: integer("time_limit_minutes"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  orgId: uuid("org_id").references(() => organizations.id),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("questions_difficulty_idx").on(table.difficulty),
  index("questions_language_idx").on(table.language),
  index("questions_org_idx").on(table.orgId),
]);

// ─── Assessments ────────────────────────────────────────────
export const assessments = pgTable("assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull(),
  questionIds: jsonb("question_ids").notNull().default([]),
  totalTimeLimitMinutes: integer("total_time_limit_minutes").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  orgId: uuid("org_id").references(() => organizations.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Evaluations ────────────────────────────────────────────
export const evaluations = pgTable("evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  candidateId: uuid("candidate_id").notNull().references(() => users.id),
  evaluatorId: uuid("evaluator_id").notNull().references(() => users.id),
  rubricScores: jsonb("rubric_scores").notNull().default([]),
  notes: text("notes").default(""),
  overallScore: integer("overall_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("evaluations_session_idx").on(table.sessionId),
  index("evaluations_candidate_idx").on(table.candidateId),
  uniqueIndex("evaluations_session_evaluator_idx").on(table.sessionId, table.evaluatorId),
]);

// ─── Audit Log ──────────────────────────────────────────────
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  resource: varchar("resource", { length: 100 }).notNull(),
  resourceId: uuid("resource_id"),
  details: jsonb("details").default({}),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("audit_user_idx").on(table.userId),
  index("audit_action_idx").on(table.action),
  index("audit_created_idx").on(table.createdAt),
]);
