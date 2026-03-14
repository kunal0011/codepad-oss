import { Router } from "express";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "codepad-api",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

router.get("/ready", async (_req, res) => {
  // TODO: check DB and Redis connectivity
  res.json({ status: "ready" });
});

export { router as healthRoutes };
