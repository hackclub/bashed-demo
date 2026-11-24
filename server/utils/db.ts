import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../database/schema";

export { schema };

let db: ReturnType<typeof drizzle<typeof schema>> | undefined;

// The database's URL: NUXT_DATABASE_URL (runtimeConfig), or DATABASE_URL as it is when the
// server runs, which is the variable Orchard adds when it connects a database to the app
export function databaseUrl() {
  const url = useRuntimeConfig().databaseUrl || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

// Lazily creates a single shared connection pool for the server process
export function useDB() {
  if (!db) db = drizzle(postgres(databaseUrl()), { schema });
  return db;
}
