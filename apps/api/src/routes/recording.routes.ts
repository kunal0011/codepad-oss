import { Router } from "express";
import { recordingService } from "../services/recording.service.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

router.get("/session/:sessionId", async (req, res, next) => {
  try {
    const recording = await recordingService.getRecordingBySession(req.params.sessionId!);
    res.json({ success: true, data: recording });
  } catch (err) {
    next(err);
  }
});

router.get("/session/:sessionId/url", async (req, res, next) => {
  try {
    const url = await recordingService.getRecordingUrl(req.params.sessionId!);
    res.json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
});

export { router as recordingRoutes };
