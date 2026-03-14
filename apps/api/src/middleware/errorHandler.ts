import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import type { ApiResponse } from "@codepad/shared";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response<ApiResponse<never>>,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: { issues: err.issues },
      },
    });
    return;
  }

  logger.error({ err, url: req.url, method: req.method }, "Unhandled error");
  console.error(`[EMERGENCY ERROR] ${req.method} ${req.url}:`, err);

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
}
