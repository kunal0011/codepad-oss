import Redis from "ioredis";
import { logger } from "../utils/logger.js";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

export class RedisPersistence {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(REDIS_URL);
    this.redis.on("error", (err) => {
      logger.error({ err }, "Redis persistence error");
    });
  }

  async saveSnapshot(sessionId: string, state: Uint8Array): Promise<void> {
    try {
      // Store as a buffer
      await this.redis.set(`session:${sessionId}:snapshot`, Buffer.from(state));
      // Set expiration for 7 days (COL-003 / SESSION_DEFAULTS)
      await this.redis.expire(`session:${sessionId}:snapshot`, 7 * 24 * 60 * 60);
      logger.debug({ sessionId, size: state.length }, "Saved session snapshot to Redis");
    } catch (err) {
      logger.error({ err, sessionId }, "Failed to save session snapshot");
    }
  }

  async getSnapshot(sessionId: string): Promise<Uint8Array | null> {
    try {
      const data = await this.redis.getBuffer(`session:${sessionId}:snapshot`);
      if (!data) return null;
      return new Uint8Array(data);
    } catch (err) {
      logger.error({ err, sessionId }, "Failed to get session snapshot");
      return null;
    }
  }

  async deleteSnapshot(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}:snapshot`);
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export const persistence = new RedisPersistence();
