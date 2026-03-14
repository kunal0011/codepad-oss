import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload, ParticipantRole } from "@codepad/shared";
import { getConfig } from "../config/index.js";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";

declare global {
  namespace Express {
    interface Request {
      userPayload?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid Authorization header");
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, getConfig().jwtSecret) as JwtPayload;
    req.userPayload = payload;
    next();
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.userPayload) {
      throw new UnauthorizedError();
    }
    if (!roles.includes(req.userPayload.role)) {
      throw new ForbiddenError(`Requires one of: ${roles.join(", ")}`);
    }
    next();
  };
}

export function requireSessionRole(...roles: ParticipantRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Session role is attached by session middleware
    const sessionRole = (req as unknown as Record<string, unknown>)["sessionRole"] as ParticipantRole | undefined;
    if (!sessionRole || !roles.includes(sessionRole)) {
      throw new ForbiddenError(`Requires session role: ${roles.join(", ")}`);
    }
    next();
  };
}
