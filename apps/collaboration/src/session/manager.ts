import * as Y from "yjs";
import { WebSocket } from "ws";
import { CollaborativeDocument, MSG_SYNC, MSG_AWARENESS } from "../crdt/document.js";
import { redisPersistence } from "../crdt/persistence.js";
import { presenceTracker } from "../presence/tracker.js";
import { permissionManager, Permission } from "../permissions/manager.js";
import { WsEvent, ParticipantRole } from "@codepad/shared";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { logger } from "../utils/logger.js";

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  name: string;
  color: string;
  sessionId: string;
}

export class SessionManager {
  private documents = new Map<string, CollaborativeDocument>();
  private connections = new Map<string, Set<ClientConnection>>();

  async getOrCreateDocument(sessionId: string): Promise<CollaborativeDocument> {
    let doc = this.documents.get(sessionId);
    if (!doc) {
      const initialState = await redisPersistence.getDocument(sessionId);
      doc = new CollaborativeDocument(sessionId, initialState ?? undefined);

      // Persist to Redis & Broadcast to other pods
      doc.doc.on("update", (update: Uint8Array, origin: unknown) => {
        // Only save and broadcast if the update originated locally (not from Redis sync)
        if (origin !== "redis-sync") {
          redisPersistence.saveUpdate(sessionId, update);
          
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MSG_SYNC);
          encoding.writeVarUint(encoder, 2); // sync step 2 = update
          encoding.writeVarUint8Array(encoder, update);
          const message = encoding.toUint8Array(encoder);
          this.broadcastToSession(sessionId, message, origin as WebSocket);
        }
      });

      // Subscribe to Redis updates from other pods
      redisPersistence.subscribe(sessionId, (update) => {
        // Apply update with "redis-sync" origin to avoid infinite loops
        Y.applyUpdate(doc!.doc, update, "redis-sync");
        
        // Broadcast this remote update to all local clients
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        encoding.writeVarUint(encoder, 2);
        encoding.writeVarUint8Array(encoder, update);
        const message = encoding.toUint8Array(encoder);
        this.broadcastToSession(sessionId, message);
      });

      // Broadcast awareness updates
      doc.awareness.on("update", ({ added, updated, removed }: {
        added: number[];
        updated: number[];
        removed: number[];
      }) => {
        const changedClients = [...added, ...updated, ...removed];
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_AWARENESS);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(doc!.awareness, changedClients),
        );
        const message = encoding.toUint8Array(encoder);
        this.broadcastToSession(sessionId, message);
      });

      this.documents.set(sessionId, doc);
      logger.info({ sessionId }, "Document created with Redis sync");
    }
    return doc;
  }

  async addConnection(conn: ClientConnection): Promise<void> {
    const { sessionId, userId, name, color } = conn;

    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, new Set());
    }
    this.connections.get(sessionId)!.add(conn);

    presenceTracker.addUser(sessionId, userId, name, color);

    // Grant EDITOR role by default — the API already controls who can join
    permissionManager.setRole(sessionId, userId, ParticipantRole.EDITOR);

    // Send sync step 1 to new client
    const doc = await this.getOrCreateDocument(sessionId);
    const syncMessage = doc.createSyncStep1();
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(syncMessage);
    }

    // Broadcast join event
    this.broadcastEvent(sessionId, WsEvent.SESSION_JOIN, {
      userId,
      name,
      color,
      participants: presenceTracker.getSessionUsers(sessionId),
    });

    logger.info({ sessionId, userId }, "Client connected");
  }

  removeConnection(conn: ClientConnection): void {
    const { sessionId, userId } = conn;
    const sessionConns = this.connections.get(sessionId);
    if (sessionConns) {
      sessionConns.delete(conn);
      if (sessionConns.size === 0) {
        this.connections.delete(sessionId);
        // Keep document alive for a while in case of reconnection
        setTimeout(() => {
          if (!this.connections.has(sessionId)) {
            const doc = this.documents.get(sessionId);
            if (doc) {
              doc.destroy();
              this.documents.delete(sessionId);
              logger.info({ sessionId }, "Document destroyed (no connections)");
            }
          }
        }, 60_000);
      }
    }

    presenceTracker.removeUser(sessionId, userId);

    this.broadcastEvent(sessionId, WsEvent.SESSION_LEAVE, {
      userId,
      participants: presenceTracker.getSessionUsers(sessionId),
    });

    logger.info({ sessionId, userId }, "Client disconnected");
  }

  handleMessage(conn: ClientConnection, data: Buffer): void {
    const message = new Uint8Array(data);
    const doc = this.documents.get(conn.sessionId);
    if (!doc) return;

    // Check permissions
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === MSG_SYNC) {
      if (!permissionManager.can(conn.sessionId, conn.userId, Permission.EDIT)) {
        logger.warn(
          { sessionId: conn.sessionId, userId: conn.userId },
          "Denied edit attempt due to insufficient permissions",
        );
        return;
      }
    }

    // Handle JSON events (presence update)
    if (data.toString().startsWith('{"event":')) {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.event === WsEvent.PRESENCE_UPDATE) {
          presenceTracker.updatePresence(conn.sessionId, {
            ...payload.data,
            userId: conn.userId,
            sessionId: conn.sessionId,
            timestamp: Date.now(),
          });
          // Broadcast to others
          this.broadcastEvent(conn.sessionId, WsEvent.PRESENCE_BROADCAST, {
            participants: presenceTracker.getSessionUsers(conn.sessionId),
          });
          return;
        }
      } catch (e) {
        // Not a JSON event, continue to Yjs handler
      }
    }

    const response = doc.handleSyncMessage(message, conn.ws);
    if (response && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(response);
    }
  }

  private broadcastToSession(sessionId: string, message: Uint8Array, exclude?: WebSocket): void {
    const conns = this.connections.get(sessionId);
    if (!conns) return;
    for (const conn of conns) {
      if (conn.ws !== exclude && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(message);
      }
    }
  }

  private broadcastEvent(sessionId: string, event: string, data: unknown): void {
    const conns = this.connections.get(sessionId);
    if (!conns) return;
    const message = JSON.stringify({ event, data });
    for (const conn of conns) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(message);
      }
    }
  }

  getActiveSessionCount(): number {
    return this.documents.size;
  }

  getActiveConnectionCount(): number {
    let total = 0;
    for (const conns of this.connections.values()) {
      total += conns.size;
    }
    return total;
  }
}

export const sessionManager = new SessionManager();
