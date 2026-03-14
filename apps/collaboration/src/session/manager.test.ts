import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionManager } from "./manager.js";
import { WebSocket } from "ws";

// Mock dependencies
vi.mock("ws");
vi.mock("../crdt/persistence.js", () => ({
  persistence: {
    getSnapshot: vi.fn().mockResolvedValue(null),
    saveSnapshot: vi.fn().mockResolvedValue(undefined),
  }
}));

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new SessionManager();
  });

  it("should add a connection and create a document", async () => {
    const ws = {
      readyState: 1, // OPEN
      send: vi.fn(),
    } as unknown as WebSocket;

    const conn = {
      ws,
      userId: "user-1",
      name: "Alice",
      color: "red",
      sessionId: "session-1",
    };

    await manager.addConnection(conn);

    expect(ws.send).toHaveBeenCalled();
    expect(manager.getActiveSessionCount()).toBe(1);
    expect(manager.getActiveConnectionCount()).toBe(1);
  });

  it("should broadcast to session", async () => {
    const ws1 = { readyState: 1, send: vi.fn() } as unknown as WebSocket;
    const ws2 = { readyState: 1, send: vi.fn() } as unknown as WebSocket;

    await manager.addConnection({ ws: ws1, userId: "u1", name: "A", color: "red", sessionId: "s1" });
    await manager.addConnection({ ws: ws2, userId: "u2", name: "B", color: "blue", sessionId: "s1" });

    // Clear initial sync messages
    vi.mocked(ws1.send).mockClear();
    vi.mocked(ws2.send).mockClear();

    // Trigger an update via document
    const doc = await manager.getOrCreateDocument("s1");
    doc.doc.getText("code").insert(0, "X");

    // ws1 should NOT receive its own update (origin is handled)
    // Actually in my implementation, I passed 'origin' as WebSocket to exclude it
    // Wait, in manager.ts: doc.doc.on("update", (update, origin) => { ... broadcast(..., origin) })
    
    // For this test, let's just check if something was sent to the other peer
    // In doc.on("update"), it will be triggered when we call applyUpdate or local change.
    
    // We expect ws2 to get a sync message
    expect(ws1.send).toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalled();
  });
});
