import { describe, it, expect, vi } from "vitest";
import { PresenceTracker } from "./tracker.js";

describe("PresenceTracker", () => {
  it("should add and retrieve users", () => {
    const tracker = new PresenceTracker();
    tracker.addUser("session-1", "user-1", "Alice", "#FF0000");
    
    const users = tracker.getSessionUsers("session-1");
    expect(users).toHaveLength(1);
    expect(users[0]!.name).toBe("Alice");
    expect(users[0]!.userId).toBe("user-1");
  });

  it("should remove users", () => {
    const tracker = new PresenceTracker();
    tracker.addUser("session-1", "user-1", "Alice", "#FF0000");
    tracker.removeUser("session-1", "user-1");
    
    expect(tracker.getSessionUsers("session-1")).toHaveLength(0);
  });

  it("should update presence", () => {
    const tracker = new PresenceTracker();
    tracker.addUser("session-1", "user-1", "Alice", "#FF0000");
    
    const update = {
      userId: "user-1",
      sessionId: "session-1",
      cursor: { line: 10, column: 5 },
      timestamp: Date.now()
    };
    
    tracker.updatePresence("session-1", update);
    const users = tracker.getSessionUsers("session-1");
    expect(users[0]!.cursor).toEqual({ line: 10, column: 5 });
  });

  it("should cleanup stale users", () => {
    vi.useFakeTimers();
    const tracker = new PresenceTracker();
    tracker.addUser("session-1", "user-1", "Alice", "#FF0000");
    
    // Advance time by 20s (threshold is 15s)
    vi.advanceTimersByTime(20000);
    
    tracker.cleanup();
    expect(tracker.getSessionUsers("session-1")).toHaveLength(0);
    vi.useRealTimers();
  });
});
