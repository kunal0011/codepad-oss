import { getDb, sessionRecordings, eq } from "@codepad/database";
import { NotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export class RecordingService {
  private get db() {
    return getDb();
  }

  async createRecording(data: {
    sessionId: string;
    s3Key: string;
    durationMs?: number;
    sizeBytes?: number;
    expiresAt: Date;
  }) {
    const [recording] = await this.db
      .insert(sessionRecordings)
      .values({
        sessionId: data.sessionId,
        s3Key: data.s3Key,
        durationMs: data.durationMs,
        sizeBytes: data.sizeBytes,
        expiresAt: data.expiresAt,
      })
      .returning();
    
    logger.info({ sessionId: data.sessionId, s3Key: data.s3Key }, "Session recording created");
    return recording!;
  }

  async getRecordingBySession(sessionId: string) {
    const recording = await this.db.query.sessionRecordings.findFirst({
      where: eq(sessionRecordings.sessionId, sessionId),
    });
    if (!recording) throw new NotFoundError("Recording", sessionId);
    return recording;
  }

  async getRecordingUrl(sessionId: string): Promise<string> {
    const recording = await this.getRecordingBySession(sessionId);
    // In a real production environment, we would generate a signed URL here.
    // For now, we'll return a stubbed URL.
    return `https://s3.amazonaws.com/codepad-recordings/${recording.s3Key}?token=stub-token`;
  }

  async deleteRecording(id: string) {
    await this.db.delete(sessionRecordings).where(eq(sessionRecordings.id, id));
    logger.info({ recordingId: id }, "Session recording metadata deleted");
  }
}

export const recordingService = new RecordingService();
