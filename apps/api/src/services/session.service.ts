import {
  type SessionSettings,
  type Language,
  type SessionType,
  SessionStatus,
  ParticipantRole,
  PARTICIPANT_COLORS,
  generateSessionCode,
  LANGUAGE_RUNTIMES,
} from "@codepad/shared";
import {
  getDb,
  sessions,
  users,
  sessionParticipants,
  sessionFiles,
  eq,
  and,
  desc,
  sql,
} from "@codepad/database";
import { NotFoundError, ForbiddenError, ValidationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const defaultSettings: SessionSettings = {
  maxParticipants: 10,
  allowExecution: true,
  allowNetworkAccess: false,
  timeoutMinutes: 60,
  isPasswordProtected: false,
  recordingEnabled: false,
};

export class SessionService {
  private get db() {
    return getDb();
  }

  async create(
    ownerId: string,
    data: {
      title: string;
      language: Language;
      type?: SessionType;
      settings?: Partial<SessionSettings>;
    },
  ) {
    try {
      const code = generateSessionCode();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const [session] = await this.db
        .insert(sessions)
        .values({
          code,
          title: data.title,
          language: data.language,
          type: data.type ?? "sandbox",
          ownerId,
          settings: { ...defaultSettings, ...data.settings },
          expiresAt,
        })
        .returning();

      // Add owner as participant
      await this.db.insert(sessionParticipants).values({
        sessionId: session!.id,
        userId: ownerId,
        role: "owner",
        color: PARTICIPANT_COLORS[0]!,
      });

      // Create default entry file
      const runtime = LANGUAGE_RUNTIMES[data.language];
      await this.db.insert(sessionFiles).values({
        sessionId: session!.id,
        path: runtime.defaultFilename,
        content: getStarterCode(data.language),
        isEntryPoint: true,
      });

      return session!;
    } catch (err) {
      logger.error({ err, ownerId, data }, "Session create service error");
      throw err;
    }
  }

  async getById(sessionId: string) {
    const session = await this.db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });
    if (!session) throw new NotFoundError("Session", sessionId);

    // Get enriched participants and files
    const enrichedParticipants = await this.getParticipants(sessionId);
    const files = await this.getFiles(sessionId);

    return {
      ...session,
      participants: enrichedParticipants,
      files,
    };
  }

  async getByCode(code: string) {
    const session = await this.db.query.sessions.findFirst({
      where: eq(sessions.code, code.toUpperCase()),
    });
    if (!session) throw new NotFoundError("Session");
    return session;
  }

  async listByUser(userId: string, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;

    const results = await this.db
      .select()
      .from(sessions)
      .innerJoin(
        sessionParticipants,
        and(
          eq(sessionParticipants.sessionId, sessions.id),
          eq(sessionParticipants.userId, userId),
        ),
      )
      .orderBy(desc(sessions.updatedAt))
      .limit(pageSize)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(sessionParticipants)
      .where(eq(sessionParticipants.userId, userId));

    return {
      sessions: results.map((r) => r.sessions),
      total: Number(countResult?.count ?? 0),
    };
  }

  async searchSessions(query: string, page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;
    const searchPattern = `%${query.toLowerCase()}%`;

    // Only search active sessions
    const results = await this.db.query.sessions.findMany({
      where: and(
        eq(sessions.status, "active"),
        sql`lower(${sessions.title}) LIKE ${searchPattern} OR lower(${sessions.code}) LIKE ${searchPattern}`,
      ),
      limit: pageSize,
      offset,
      orderBy: [desc(sessions.updatedAt)],
    });

    return results;
  }

  async join(sessionId: string, userId: string, role?: ParticipantRole) {
    const session = await this.getById(sessionId);

    // Check if already a participant
    const existing = await this.db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.userId, userId),
      ),
    });

    if (existing) {
      return existing;
    }

    // Get current participant count for color assignment
    const participants = await this.db.query.sessionParticipants.findMany({
      where: eq(sessionParticipants.sessionId, sessionId),
    });

    const settings = session.settings as SessionSettings;
    if (participants.length >= settings.maxParticipants) {
      throw new ValidationError("Session is full");
    }

    const colorIndex = participants.length % PARTICIPANT_COLORS.length;

    const [participant] = await this.db
      .insert(sessionParticipants)
      .values({
        sessionId,
        userId,
        role: role ?? "editor",
        color: PARTICIPANT_COLORS[colorIndex]!,
      })
      .returning();

    // Activate session if not already
    if (session.status === "created") {
      await this.db
        .update(sessions)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(sessions.id, sessionId));
    }

    return participant!;
  }

  async leave(sessionId: string, userId: string) {
    await this.db
      .update(sessionParticipants)
      .set({ leftAt: new Date() })
      .where(
        and(
          eq(sessionParticipants.sessionId, sessionId),
          eq(sessionParticipants.userId, userId),
        ),
      );
  }

  async updateStatus(sessionId: string, status: SessionStatus, userId: string) {
    const session = await this.getById(sessionId);
    if (session.ownerId !== userId) {
      throw new ForbiddenError("Only the session owner can update status");
    }
    await this.db
      .update(sessions)
      .set({ status, updatedAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }

  async getFiles(sessionId: string) {
    return this.db.query.sessionFiles.findMany({
      where: eq(sessionFiles.sessionId, sessionId),
    });
  }

  async updateFile(sessionId: string, path: string, content: string) {
    const existing = await this.db.query.sessionFiles.findFirst({
      where: and(
        eq(sessionFiles.sessionId, sessionId),
        eq(sessionFiles.path, path),
      ),
    });

    if (existing) {
      await this.db
        .update(sessionFiles)
        .set({ content, updatedAt: new Date() })
        .where(eq(sessionFiles.id, existing.id));
    } else {
      await this.db.insert(sessionFiles).values({
        sessionId,
        path,
        content,
      });
    }
  }

  async getParticipants(sessionId: string) {
    const results = await this.db
      .select({
        userId: sessionParticipants.userId,
        name: users.name,
        avatarUrl: users.avatarUrl,
        role: sessionParticipants.role,
        color: sessionParticipants.color,
        joinedAt: sessionParticipants.joinedAt,
        leftAt: sessionParticipants.leftAt,
      })
      .from(sessionParticipants)
      .innerJoin(users, eq(sessionParticipants.userId, users.id))
      .where(eq(sessionParticipants.sessionId, sessionId));

    return results.map((r) => ({
      ...r,
      isConnected: r.leftAt === null,
    }));
  }
}

function getStarterCode(language: Language): string {
  const starters: Record<string, string> = {
    python: '# Welcome to CodePad!\n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()\n',
    javascript: '// Welcome to CodePad!\n\nfunction main() {\n  console.log("Hello, World!");\n}\n\nmain();\n',
    typescript: '// Welcome to CodePad!\n\nfunction main(): void {\n  console.log("Hello, World!");\n}\n\nmain();\n',
    java: '// Welcome to CodePad!\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
    go: '// Welcome to CodePad!\n\npackage main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, World!")\n}\n',
    cpp: '// Welcome to CodePad!\n\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n',
    ruby: "# Welcome to CodePad!\n\ndef main\n  puts 'Hello, World!'\nend\n\nmain\n",
    rust: '// Welcome to CodePad!\n\nfn main() {\n    println!("Hello, World!");\n}\n',
  };
  return starters[language] ?? "// Welcome to CodePad!\n";
}

export const sessionService = new SessionService();
