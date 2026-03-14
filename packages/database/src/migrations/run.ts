import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

async function main() {
  const connectionString =
    process.env["DATABASE_URL"] ??
    "postgresql://codepad:codepad@localhost:5432/codepad";

  console.log("Running migrations...");
  console.log(`Database: ${connectionString.replace(/:[^:@]+@/, ":***@")}`);

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  // In production (Docker), we're running from /app
  // The migrations are at /app/packages/database/src/migrations
  const migrationsFolder = process.env["NODE_ENV"] === "production" 
    ? "/app/packages/database/src/migrations"
    : "./src/migrations";

  await migrate(db, { migrationsFolder });

  console.log("Migrations completed successfully");
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
