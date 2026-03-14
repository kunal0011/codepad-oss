import { z } from "zod";

const configSchema = z.object({
  port: z.coerce.number().default(8080),
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
  frontendUrl: z.string().default("http://localhost:3000"),
  apiUrl: z.string().default("http://localhost:8080"),
  corsOrigins: z.string().default("http://localhost:3000"),

  // Database
  databaseUrl: z.string(),

  // Redis
  redisUrl: z.string().default("redis://localhost:6379"),

  // JWT
  jwtSecret: z.string().min(32),
  jwtAccessTokenTtl: z.coerce.number().default(900),
  jwtRefreshTokenTtl: z.coerce.number().default(604800),

  // OAuth
  googleClientId: z.string().optional(),
  googleClientSecret: z.string().optional(),
  githubClientId: z.string().optional(),
  githubClientSecret: z.string().optional(),

  // Execution Engine
  executionEngineUrl: z.string().default("http://localhost:8081"),

  // Collaboration
  collaborationWsPort: z.coerce.number().default(8082),
});

export type Config = z.infer<typeof configSchema>;

let config: Config | null = null;

export function getConfig(): Config {
  if (!config) {
    config = configSchema.parse({
      port: process.env["API_PORT"],
      nodeEnv: process.env["NODE_ENV"],
      frontendUrl: process.env["FRONTEND_URL"],
      apiUrl: process.env["API_URL"],
      corsOrigins: process.env["CORS_ORIGINS"],
      databaseUrl: process.env["DATABASE_URL"],
      redisUrl: process.env["REDIS_URL"],
      jwtSecret: process.env["JWT_SECRET"],
      jwtAccessTokenTtl: process.env["JWT_ACCESS_TOKEN_TTL"],
      jwtRefreshTokenTtl: process.env["JWT_REFRESH_TOKEN_TTL"],
      googleClientId: process.env["GOOGLE_CLIENT_ID"],
      googleClientSecret: process.env["GOOGLE_CLIENT_SECRET"],
      githubClientId: process.env["GITHUB_CLIENT_ID"],
      githubClientSecret: process.env["GITHUB_CLIENT_SECRET"],
      executionEngineUrl: process.env["EXECUTION_ENGINE_URL"],
      collaborationWsPort: process.env["COLLABORATION_WS_PORT"],
    });
  }
  return config;
}
