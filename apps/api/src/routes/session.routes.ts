import { Router } from "express";
import { z } from "zod";
import { Language, SessionType, SessionStatus } from "@codepad/shared";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { sessionService } from "../services/session.service.js";
import { logger } from "../utils/logger.js";

const router = Router();

const createSessionSchema = z.object({
  title: z.string().min(1).max(255),
  language: z.nativeEnum(Language),
  type: z.nativeEnum(SessionType).optional(),
  settings: z
    .object({
      maxParticipants: z.number().min(1).max(50).optional(),
      allowExecution: z.boolean().optional(),
      allowNetworkAccess: z.boolean().optional(),
      timeoutMinutes: z.number().min(5).max(480).optional(),
      recordingEnabled: z.boolean().optional(),
    })
    .optional(),
});

import { ValidationError } from "../utils/errors.js";

router.use(authenticate);

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

// Public search
router.get("/search", async (req, res, next) => {
  try {
    const query = (req.query["q"] as string) || "";
    if (!query || query.length < 3) {
      return res.json({ success: true, data: [] });
    }
    const results = await sessionService.searchSessions(query);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

// Join session
router.post("/join/:code", async (req, res, next) => {
  try {
    const userId = req.userPayload!.sub;
    const code = req.params["code"] as string;
    if (!code) throw new ValidationError("Session code is required");
    const session = await sessionService.getByCode(code);
    const participant = await sessionService.join(session.id, userId);
    res.json({ success: true, data: { session, participant } });
  } catch (err) {
    logger.error({ err, code: req.params.code }, "Failed to join session");
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const session = await sessionService.getById(req.params.id!);
    const participants = await sessionService.getParticipants(session.id);
    const files = await sessionService.getFiles(session.id);
    res.json({ success: true, data: { ...session, participants, files } });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/files", async (req, res, next) => {
  try {
    const files = await sessionService.getFiles(req.params.id!);
    res.json({ success: true, data: files });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/files", async (req, res, next) => {
  try {
    const { path, content } = z
      .object({ path: z.string(), content: z.string().optional() })
      .parse(req.body);
    const file = await sessionService.createFile(req.params.id!, path, content);
    res.status(201).json({ success: true, data: file });
  } catch (err) {
    next(err);
  }
});

router.put("/:id/files", async (req, res, next) => {
  try {
    const { path, content } = z.object({ path: z.string(), content: z.string() }).parse(req.body);
    await sessionService.updateFile(req.params.id!, path, content);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Protected routes below
// router.use(authenticate); // Moved above

router.post("/", validate(createSessionSchema), async (req, res, next) => {
  try {
    logger.info({ userId: req.userPayload!.sub, language: req.body.language }, "Creating session");
    const session = await sessionService.create(req.userPayload!.sub, req.body);
    logger.info({ sessionId: session.id, code: session.code }, "Session created");
    res.status(201).json({ success: true, data: session });
  } catch (err) {
    logger.error({ err, userId: req.userPayload!.sub }, "Failed to create session");
    next(err);
  }
});

router.get("/", validate(paginationSchema, "query"), async (req, res, next) => {
  try {
    const { sessions, total } = await sessionService.listByUser(
      req.userPayload!.sub,
      req.query.page as unknown as number,
      req.query.pageSize as unknown as number,
    );
    res.json({
      success: true,
      data: sessions,
      meta: {
        page: req.query.page as unknown as number,
        pageSize: req.query.pageSize as unknown as number,
        totalItems: total,
        totalPages: Math.ceil(total / (req.query.pageSize as unknown as number)),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/leave", async (req, res, next) => {
  try {
    await sessionService.leave(req.params.id!, req.userPayload!.sub);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.nativeEnum(SessionStatus) }).parse(req.body);
    await sessionService.updateStatus(req.params.id!, status, req.userPayload!.sub);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Duplicate routes removed

export { router as sessionRoutes };
