import * as Y from "yjs";
import Redis from "ioredis";
import { logger } from "../utils/logger.js";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

export class RedisPersistence {
  private redis: Redis;
  private sub: Redis;
  private pub: Redis;

  constructor() {
    this.redis = new Redis(REDIS_URL);
    this.pub = new Redis(REDIS_URL);
    this.sub = new Redis(REDIS_URL);
    
    this.redis.on("error", (err) => logger.error({ err }, "Redis Error"));
    this.pub.on("error", (err) => logger.error({ err }, "Redis Pub Error"));
    this.sub.on("error", (err) => logger.error({ err }, "Redis Sub Error"));
  }

  async getDocument(sessionId: string): Promise<Uint8Array | null> {
    const data = await this.redis.getBuffer(`doc:${sessionId}`);
    return data ? new Uint8Array(data) : null;
  }

  async saveUpdate(sessionId: string, update: Uint8Array) {
    // Store latest state (in a real system we might use a more granular log)
    // For now, we apply update to existing state and store
    const existing = await this.getDocument(sessionId);
    const doc = new Y.Doc();
    if (existing) {
      Y.applyUpdate(doc, existing);
    }
    Y.applyUpdate(doc, update);
    
    const state = Y.encodeStateAsUpdate(doc);
    await this.redis.set(`doc:${sessionId}`, Buffer.from(state));
    
    // Broadcast to other pods
    await this.pub.publish(`sync:${sessionId}`, Buffer.from(update));
  }

  subscribe(sessionId: string, onUpdate: (update: Uint8Array) => void) {
    const channel = `sync:${sessionId}`;
    this.sub.subscribe(channel);
    
    const handler = (chan: string, message: string | Buffer) => {
      if (chan === channel) {
        onUpdate(new Uint8Array(message as Buffer));
      }
    };

    this.sub.on("messageBuffer", handler);

    return () => {
      this.sub.unsubscribe(channel);
      this.sub.off("messageBuffer", handler);
    };
  }
}

export const redisPersistence = new RedisPersistence();
