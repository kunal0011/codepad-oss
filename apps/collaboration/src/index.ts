import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import jwt from "jsonwebtoken";
import { URL } from "url";
import { sessionManager } from "./session/manager.js";
import { presenceTracker } from "./presence/tracker.js";
import { permissionManager } from "./permissions/manager.js";
import { ParticipantRole } from "@codepad/shared";
import { logger } from "./utils/logger.js";

const PORT = parseInt(process.env["COLLABORATION_WS_PORT"] ?? "8082", 10);
const JWT_SECRET = process.env["JWT_SECRET"] ?? "change-me-in-production";

const server = http.createServer((_req, res) => {
  // Health check
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "ok",
      service: "codepad-collaboration",
      activeSessions: sessionManager.getActiveSessionCount(),
      activeConnections: sessionManager.getActiveConnectionCount(),
    }),
  );
});

const wss = new WebSocketServer({ server });

wss.on("connection", async (ws: WebSocket, req) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    
    // y-websocket puts the room name (sessionId) in the path: /sessionId
    const sessionId = url.pathname.slice(1);
    const token = url.searchParams.get("token");

    if (!sessionId || !token) {
      logger.warn({ pathname: url.pathname, token: !!token }, "Rejected connection: Missing sessionId or token");
      ws.close(4001, "Missing sessionId or token");
      return;
    }

    // Verify JWT
    let payload: { sub: string; email: string };
    if (token === "dev-token") {
      // Mock payload for development/testing
      payload = { sub: "dev-user", email: "dev@codepad.local" };
      // Grant permission for development bypass
      permissionManager.setRole(sessionId, payload.sub, ParticipantRole.EDITOR);
    } else {
      try {
        payload = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
      } catch (err) {
        logger.warn({ token }, "Invalid token");
        ws.close(4003, "Invalid token");
        return;
      }
    }

    const conn = {
      ws,
      userId: payload.sub,
      name: payload.email.split("@")[0] ?? "Anonymous",
      color: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"),
      sessionId,
    };

    await sessionManager.addConnection(conn);

    ws.on("message", (data: Buffer) => {
      try {
        sessionManager.handleMessage(conn, data);
      } catch (err) {
        logger.error({ err, sessionId, userId: conn.userId }, "Error handling message");
      }
    });

    ws.on("close", () => {
      sessionManager.removeConnection(conn);
    });

    ws.on("error", (err) => {
      logger.error({ err, sessionId, userId: conn.userId }, "WebSocket error");
      sessionManager.removeConnection(conn);
    });

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(heartbeat);
      }
    }, 5000);

    ws.on("close", () => clearInterval(heartbeat));
  } catch (err) {
    logger.error({ err }, "Connection setup error");
    ws.close(4000, "Internal error");
  }
});

// Periodic cleanup of stale connections
setInterval(() => {
  presenceTracker.cleanup();
}, 30_000);

server.listen(PORT, () => {
  logger.info({ port: PORT }, "Collaboration service started");
});
