import { describe, it, expect, vi } from "vitest";
import { CollaborativeDocument } from "./document.js";
import * as Y from "yjs";

describe("CollaborativeDocument", () => {
  const sessionId = "test-session";

  it("should initialize with empty document", () => {
    const doc = new CollaborativeDocument(sessionId);
    expect(doc.sessionId).toBe(sessionId);
    expect(doc.getText().toString()).toBe("");
  });

  it("should initialize with initial state", () => {
    const ydoc = new Y.Doc();
    const text = ydoc.getText("code");
    text.insert(0, "initial content");
    const state = Y.encodeStateAsUpdate(ydoc);

    const doc = new CollaborativeDocument(sessionId, state);
    expect(doc.getText().toString()).toBe("initial content");
  });

  it("should apply updates correctly", () => {
    const doc = new CollaborativeDocument(sessionId);
    const ydoc = new Y.Doc();
    const text = ydoc.getText("code");
    text.insert(0, "new content");
    const update = Y.encodeStateAsUpdate(ydoc);

    doc.applyUpdate(update);
    expect(doc.getText().toString()).toBe("new content");
  });

  it("should converge between two documents", () => {
    const doc1 = new CollaborativeDocument(sessionId);
    const doc2 = new CollaborativeDocument(sessionId);

    // Doc 1 changes
    const ydoc1 = new Y.Doc();
    ydoc1.getText("code").insert(0, "A");
    doc1.applyUpdate(Y.encodeStateAsUpdate(ydoc1));

    // Doc 2 changes
    const ydoc2 = new Y.Doc();
    ydoc2.getText("code").insert(0, "B");
    doc2.applyUpdate(Y.encodeStateAsUpdate(ydoc2));

    // Sync Doc 1 -> Doc 2
    doc2.applyUpdate(doc1.getState());
    // Sync Doc 2 -> Doc 1
    doc1.applyUpdate(doc2.getState());

    expect(doc1.getText().toString()).toBe(doc2.getText().toString());
    // CRDT handles conflict resolution, likely "BA" or "AB" depending on implementation details
    expect(doc1.getText().toString()).toHaveLength(2);
  });

  it("should schedule snapshot on update", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const doc = new CollaborativeDocument(sessionId);
    doc.onSnapshot(callback);

    // Trigger update
    const ydoc = new Y.Doc();
    ydoc.getText("code").insert(0, "data");
    doc.applyUpdate(Y.encodeStateAsUpdate(ydoc));

    // Should not have called immediately (30s debounce)
    expect(callback).not.toHaveBeenCalled();

    // Advance time
    vi.advanceTimersByTime(30000);
    expect(callback).toHaveBeenCalled();
    
    const state = callback.mock.calls[0]![0];
    expect(state).toBeInstanceOf(Uint8Array);
    
    vi.useRealTimers();
  });
});
