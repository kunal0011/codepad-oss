import { describe, it, expect, vi } from "vitest";
import { recordingService } from "./recording.service.js";

// Mock database
vi.mock("@codepad/database", () => ({
  getDb: vi.fn(() => ({
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "r-1", s3Key: "test.json" }]),
      })),
    })),
    query: {
      sessionRecordings: {
        findFirst: vi.fn().mockResolvedValue({ id: "r-1", s3Key: "test.json", sessionId: "s-1" }),
      },
    },
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue({}),
    })),
  })),
  sessionRecordings: { id: "id", sessionId: "sessionId", s3Key: "s3Key" },
  eq: vi.fn(),
}));

describe("RecordingService", () => {
  it("should create a recording entry", async () => {
    const recording = await recordingService.createRecording({
      sessionId: "s-1",
      s3Key: "session-s-1.json",
      expiresAt: new Date(),
    });
    expect(recording).toBeDefined();
    expect(recording.s3Key).toBe("test.json");
  });

  it("should get a recording by sessionId", async () => {
    const recording = await recordingService.getRecordingBySession("s-1");
    expect(recording.sessionId).toBe("s-1");
  });

  it("should generate a recording URL", async () => {
    const url = await recordingService.getRecordingUrl("s-1");
    expect(url).toContain("s3.amazonaws.com");
    expect(url).toContain("test.json");
  });
});
