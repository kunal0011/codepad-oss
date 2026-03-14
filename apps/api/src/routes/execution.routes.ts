import { Router } from "express";
import { z } from "zod";
import { Language } from "@codepad/shared";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { executionService } from "../services/execution.service.js";

const router = Router();

const executeSchema = z.object({
  sessionId: z.string().uuid(),
  language: z.nativeEnum(Language),
  files: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
        isEntryPoint: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(50),
  stdin: z.string().optional(),
  timeout: z.number().min(1).max(60).optional(),
});

router.use(authenticate);

router.post("/", validate(executeSchema), async (req, res, next) => {
  try {
    const result = await executionService.execute(req.userPayload!.sub, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const execution = await executionService.getById(req.params.id!);
    res.json({ success: true, data: execution });
  } catch (err) {
    next(err);
  }
});

export { router as executionRoutes };
