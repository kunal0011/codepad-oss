import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { authService } from "../services/auth.service.js";
import { logger } from "../utils/logger.js";
import passport from "passport";
import { getConfig } from "../config/index.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(255),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    logger.info({ body: { ...req.body, password: "[REDACTED]" } }, "Register request received");
    const tokens = await authService.register(req.body.email, req.body.password, req.body.name);
    res.status(201).json({ success: true, data: tokens });
  } catch (err) {
    logger.error({ err }, "Register route error");
    next(err);
  }
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const tokens = await authService.login(req.body.email, req.body.password);
    res.json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", validate(refreshSchema), async (req, res, next) => {
  try {
    const tokens = await authService.refreshToken(req.body.refreshToken);
    res.json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", validate(refreshSchema), async (req, res, next) => {
  try {
    await authService.revokeRefreshToken(req.body.refreshToken);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── SSO Routes ─────────────────────────────────────────────

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  async (req, res, next) => {
    try {
      const tokens = await authService.generateTokens(req.user as any);
      const config = getConfig();
      res.redirect(`${config.frontendUrl}/auth/callback?token=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`);
    } catch (err) {
      logger.error({ err, provider: "google" }, "SSO callback error");
      next(err);
    }
  },
);

router.get("/github", passport.authenticate("github", { scope: ["user:email"] }));

router.get(
  "/github/callback",
  passport.authenticate("github", { session: false, failureRedirect: "/login" }),
  async (req, res, next) => {
    try {
      const tokens = await authService.generateTokens(req.user as any);
      const config = getConfig();
      res.redirect(`${config.frontendUrl}/auth/callback?token=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`);
    } catch (err) {
      logger.error({ err, provider: "github" }, "SSO callback error");
      next(err);
    }
  },
);

export { router as authRoutes };
