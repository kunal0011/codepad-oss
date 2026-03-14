import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { type JwtPayload, type AuthTokens, AUTH_DEFAULTS } from "@codepad/shared";
import { getDb, users, refreshTokens, eq } from "@codepad/database";
import { getConfig } from "../config/index.js";
import { UnauthorizedError, ConflictError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { createHash, randomBytes } from "crypto";

export class AuthService {
  private get db() {
    return getDb();
  }

  async register(email: string, password: string, name: string): Promise<AuthTokens> {
    const existing = await this.db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existing) {
      throw new ConflictError("Email already registered");
    }

    const passwordHash = await bcrypt.hash(password, AUTH_DEFAULTS.bcryptRounds);

    const [user] = await this.db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        name,
        passwordHash,
      })
      .returning();

    return this.generateTokens(user!);
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    try {
      const user = await this.db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
      });

      if (!user || !user.passwordHash) {
        throw new UnauthorizedError("Invalid email or password");
      }

      // Check lockout
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new UnauthorizedError("Account temporarily locked. Try again later.");
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        // Increment failed attempts
        const attempts = user.loginAttempts + 1;
        const updates: Record<string, unknown> = { loginAttempts: attempts };
        if (attempts >= AUTH_DEFAULTS.maxLoginAttempts) {
          updates["lockedUntil"] = new Date(
            Date.now() + AUTH_DEFAULTS.lockoutDurationMin * 60 * 1000,
          );
        }
        await this.db.update(users).set(updates).where(eq(users.id, user.id));
        throw new UnauthorizedError("Invalid email or password");
      }

      // Reset failed attempts on success
      await this.db
        .update(users)
        .set({ loginAttempts: 0, lockedUntil: null })
        .where(eq(users.id, user.id));

      return this.generateTokens(user);
    } catch (err) {
      logger.error({ err, email }, "Login service error");
      throw err;
    }
  }

  async refreshToken(token: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(token);

    const stored = await this.db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, tokenHash),
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    // Revoke the old token
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, stored.id));

    const user = await this.db.query.users.findFirst({
      where: eq(users.id, stored.userId),
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError("User account is disabled");
    }

    return this.generateTokens(user);
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  async generateTokens(user: typeof users.$inferSelect): Promise<AuthTokens> {
    const config = getConfig();

    const payload: Omit<JwtPayload, "iat" | "exp"> = {
      sub: user.id,
      email: user.email,
      role: user.role as JwtPayload["role"],
      orgId: user.orgId ?? undefined,
    };

    const accessToken = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtAccessTokenTtl,
    });

    const refreshTokenValue = randomBytes(40).toString("hex");
    const tokenHash = this.hashToken(refreshTokenValue);

    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + config.jwtRefreshTokenTtl * 1000),
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: config.jwtAccessTokenTtl,
    };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}

export const authService = new AuthService();
