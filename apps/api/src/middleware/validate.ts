import type { Request, Response, NextFunction } from "express";
import { type ZodSchema, ZodError } from "zod";
import { logger } from "../utils/logger.js";

export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        logger.warn({ issues: err.issues, body: req.body }, "Validation failed");
      }
      next(err);
    }
  };
}
