import {
  type ExecutionRequest,
  type ExecutionResult,
  ExecutionStatus,
  EXECUTION_LIMITS,
  sanitizeOutput,
  truncateOutput,
} from "@codepad/shared";
import { getDb, executions, eq } from "@codepad/database";
import { getConfig } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { ValidationError } from "../utils/errors.js";
import { CircuitBreaker } from "../utils/circuitBreaker.js";

export class ExecutionService {
  private get db() {
    return getDb();
  }

  private circuitBreaker = new CircuitBreaker("execution-engine");

  async execute(userId: string, request: ExecutionRequest): Promise<ExecutionResult> {
    // Validate file size
    const totalSize = request.files.reduce((sum, f) => sum + Buffer.byteLength(f.content), 0);
    if (totalSize > EXECUTION_LIMITS.maxFileSizeBytes) {
      throw new ValidationError(
        `Total file size exceeds limit of ${EXECUTION_LIMITS.maxFileSizeBytes / 1024 / 1024}MB`,
      );
    }
    if (request.files.length > EXECUTION_LIMITS.maxFiles) {
      throw new ValidationError(`Maximum ${EXECUTION_LIMITS.maxFiles} files allowed`);
    }

    // Create execution record
    const [execution] = await this.db
      .insert(executions)
      .values({
        sessionId: request.sessionId,
        userId,
        language: request.language,
        status: "queued",
      })
      .returning();

    try {
      // Forward to execution engine using circuit breaker
      const config = getConfig();

      // Ensure at least one file is marked as entry point
      const files = request.files.map((f, i) => ({
        ...f,
        isEntryPoint: f.isEntryPoint ?? (i === 0),
      }));

      const response = await this.circuitBreaker.run(async () => {
        const resp = await fetch(`${config.executionEngineUrl}/api/v1/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            executionId: execution!.id,
            language: request.language,
            files,
            stdin: request.stdin,
            timeout: request.timeout ?? EXECUTION_LIMITS.maxTimeoutSec,
            memoryLimit: EXECUTION_LIMITS.maxMemoryMB,
            cpuLimit: EXECUTION_LIMITS.maxCpuCores,
          }),
          signal: AbortSignal.timeout(
            (request.timeout ?? EXECUTION_LIMITS.maxTimeoutSec) * 1000 + 5000,
          ),
        });

        if (!resp.ok) {
          throw new Error(`Execution engine returned ${resp.status}`);
        }
        return resp;
      });

      const result = (await response.json()) as {
        stdout: string;
        stderr: string;
        exitCode: number;
        executionTimeMs: number;
        memoryUsedBytes: number;
      };

      // Sanitize and truncate output
      const stdout = truncateOutput(
        sanitizeOutput(result.stdout),
        EXECUTION_LIMITS.maxOutputBytes,
      );
      const stderr = truncateOutput(
        sanitizeOutput(result.stderr),
        EXECUTION_LIMITS.maxOutputBytes,
      );

      // Update execution record
      await this.db
        .update(executions)
        .set({
          status: "completed",
          stdout: stdout.text,
          stderr: stderr.text,
          exitCode: result.exitCode,
          executionTimeMs: result.executionTimeMs,
          memoryUsedBytes: result.memoryUsedBytes,
          completedAt: new Date(),
        })
        .where(eq(executions.id, execution!.id));

      return {
        id: execution!.id,
        status: ExecutionStatus.COMPLETED,
        stdout: stdout.text,
        stderr: stderr.text,
        exitCode: result.exitCode,
        executionTimeMs: result.executionTimeMs,
        memoryUsedBytes: result.memoryUsedBytes,
      };
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
      const status = isTimeout ? "timeout" : "error";
      const message = error instanceof Error ? error.message : "Unknown execution error";

      await this.db
        .update(executions)
        .set({
          status,
          stderr: message,
          completedAt: new Date(),
        })
        .where(eq(executions.id, execution!.id));

      logger.error({ executionId: execution!.id, error: message }, "Execution failed");

      return {
        id: execution!.id,
        status: isTimeout ? ExecutionStatus.TIMEOUT : ExecutionStatus.ERROR,
        stdout: "",
        stderr: message,
        exitCode: -1,
        executionTimeMs: 0,
        memoryUsedBytes: 0,
      };
    }
  }

  async getById(executionId: string) {
    return this.db.query.executions.findFirst({
      where: eq(executions.id, executionId),
    });
  }
}

export const executionService = new ExecutionService();
