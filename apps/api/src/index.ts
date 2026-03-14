import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { logger } from "./utils/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRoutes } from "./routes/health.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { sessionRoutes } from "./routes/session.routes.js";
import { executionRoutes } from "./routes/execution.routes.js";
import { assessmentRoutes } from "./routes/assessment.routes.js";
import { recordingRoutes } from "./routes/recording.routes.js";
import passport from "passport";
import { configurePassport } from "./config/passport.js";

const app = express();
const port = parseInt(process.env["API_PORT"] ?? "8080", 10);

configurePassport();
app.use(passport.initialize());

// ─── Global Middleware ──────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env["CORS_ORIGINS"]?.split(",") ?? "http://localhost:3000",
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));

app.use(
  pinoHttp({
    logger,
  }),
);

// Rate limiting (exempt health checks)
const limiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health" || req.path === "/ready",
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests" } },
});
app.use(limiter);

// ─── Routes ─────────────────────────────────────────────────
app.use(healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/sessions", sessionRoutes);
app.use("/api/v1/executions", executionRoutes);
app.use("/api/v1/assessments", assessmentRoutes);
app.use("/api/v1/recordings", recordingRoutes);

// ─── Error Handler ──────────────────────────────────────────
app.use(errorHandler);

// ─── Start ──────────────────────────────────────────────────
app.listen(port, () => {
  logger.info({ port, env: process.env["NODE_ENV"] ?? "development" }, "CodePad API started");
});

export default app;
