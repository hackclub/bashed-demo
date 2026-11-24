import { defineConfig } from "drizzle-kit";

// Skipped when there's no .env, e.g. for `pnpm db:generate`, which doesn't connect
try {
  process.loadEnvFile(".env");
} catch {}

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/database/schema.ts",
  out: "./server/database/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
