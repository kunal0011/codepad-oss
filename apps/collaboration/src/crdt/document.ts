import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { logger } from "../utils/logger.js";

export const MSG_SYNC = 0;
export const MSG_AWARENESS = 1;

export class CollaborativeDocument {
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;
  private snapshotCallback?: (state: Uint8Array) => void;
  private snapshotTimer?: NodeJS.Timeout;

  constructor(
    public readonly sessionId: string,
    initialState?: Uint8Array,
  ) {
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    if (initialState) {
      Y.applyUpdate(this.doc, initialState);
    }

    this.doc.on("update", () => {
      this.scheduleSnapshot();
    });
  }

  getText(name = "code"): Y.Text {
    return this.doc.getText(name);
  }

  getState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  getStateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc);
  }

  applyUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update);
  }

  handleSyncMessage(message: Uint8Array): Uint8Array | null {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MSG_SYNC: {
        encoding.writeVarUint(encoder, MSG_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, this.doc, null);
        if (encoding.length(encoder) > 1) {
          return encoding.toUint8Array(encoder);
        }
        break;
      }
      case MSG_AWARENESS: {
        awarenessProtocol.applyAwarenessUpdate(
          this.awareness,
          decoding.readVarUint8Array(decoder),
          null,
        );
        break;
      }
    }
    return null;
  }

  createSyncStep1(): Uint8Array {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    return encoding.toUint8Array(encoder);
  }

  createSyncStep2(stateVector: Uint8Array): Uint8Array {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep2(encoder, this.doc, stateVector);
    return encoding.toUint8Array(encoder);
  }

  onSnapshot(callback: (state: Uint8Array) => void): void {
    this.snapshotCallback = callback;
  }

  private scheduleSnapshot(): void {
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
    }
    this.snapshotTimer = setTimeout(() => {
      if (this.snapshotCallback) {
        const state = this.getState();
        this.snapshotCallback(state);
        logger.debug(
          { sessionId: this.sessionId, stateSize: state.length },
          "CRDT snapshot created",
        );
      }
    }, 30_000); // 30 second debounce
  }

  destroy(): void {
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
    }
    this.awareness.destroy();
    this.doc.destroy();
  }
}
