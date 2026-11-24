import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { databaseUrl } from "../utils/db";

// Applies the SQL migrations in server/database/migrations (made with `pnpm db:generate`)
// when the server starts, so a deploy never runs against an out of date database. Only in
// production: development uses `pnpm db:push`, and migrations can't be run on top of a
// database that was made that way. Requests wait until they're done, and if one fails the
// process exits rather than serving from a broken database.
export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev || import.meta.prerender) return;

  const url = databaseUrl();

  const done = (async () => {
    // One connection, so the lock is held by the same session that migrates. The lock makes
    // instances that start at the same time take turns, the later ones find nothing to do.
    const client = postgres(url, { max: 1 });
    try {
      await client`select pg_advisory_lock(7272740002)`;
      await migrate(drizzle(client), {
        migrationsFolder: "./server/database/migrations",
      });
      console.log("Database migrations applied");
    } finally {
      await client.end();
    }
  })();
  done.catch((error) => {
    console.error("Database migrations failed:", error);
    process.exit(1);
  });

  nitroApp.hooks.hook("request", () => done);
});
