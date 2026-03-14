import type { PresenceUpdate } from "@codepad/shared";
import { logger } from "../utils/logger.js";

export interface ConnectedUser {
  userId: string;
  name: string;
  color: string;
  cursor?: { line: number; column: number };
  selection?: { start: { line: number; column: number }; end: { line: number; column: number } };
  activeFile?: string;
  lastSeen: number;
}

export class PresenceTracker {
  private sessions = new Map<string, Map<string, ConnectedUser>>();

  addUser(sessionId: string, userId: string, name: string, color: string): void {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Map());
    }
    this.sessions.get(sessionId)!.set(userId, {
      userId,
      name,
      color,
      lastSeen: Date.now(),
    });
    logger.debug({ sessionId, userId }, "User added to presence");
  }

  removeUser(sessionId: string, userId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.delete(userId);
      if (session.size === 0) {
        this.sessions.delete(sessionId);
      }
    }
  }

  updatePresence(sessionId: string, update: PresenceUpdate): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const user = session.get(update.userId);
    if (!user) return;

    if (update.cursor) user.cursor = update.cursor;
    if (update.selection) user.selection = update.selection;
    if (update.activeFile) user.activeFile = update.activeFile;
    user.lastSeen = Date.now();
  }

  getSessionUsers(sessionId: string): ConnectedUser[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return Array.from(session.values());
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getTotalConnections(): number {
    let total = 0;
    for (const session of this.sessions.values()) {
      total += session.size;
    }
    return total;
  }

  // Clean up stale connections (no heartbeat for 15s)
  cleanup(): void {
    const staleThreshold = Date.now() - 15_000;
    for (const [sessionId, session] of this.sessions) {
      for (const [userId, user] of session) {
        if (user.lastSeen < staleThreshold) {
          session.delete(userId);
          logger.info({ sessionId, userId }, "Stale presence removed");
        }
      }
      if (session.size === 0) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

export const presenceTracker = new PresenceTracker();
