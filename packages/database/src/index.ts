import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export * from "./schema.js";
export { eq, and, or, desc, asc, sql, ilike, count, gt, lt, gte, lte, ne, isNull, isNotNull, inArray, between, like, notInArray } from "drizzle-orm";

let db: ReturnType<typeof createDb> | null = null;

function createDb(connectionString: string) {
  const client = postgres(connectionString, {
    max: parseInt(process.env["DATABASE_POOL_SIZE"] ?? "20", 10),
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

export function getDb(connectionString?: string): ReturnType<typeof createDb> {
  if (!db) {
    const url = connectionString ?? process.env["DATABASE_URL"];
    if (!url) {
      throw new Error("DATABASE_URL is required");
    }
    db = createDb(url);
  }
  return db;
}

export type Database = ReturnType<typeof createDb>;
