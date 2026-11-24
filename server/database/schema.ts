import {
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { DemoKind, RepoHost } from "../../shared/utils/repo-hosts";

const bytea = customType<{ data: Buffer }>({
  dataType: () => "bytea",
});

// A project's demo, made by Bashed (POST /api/demos), which decides what it runs: a file
// in the project's repository, at a commit. Two kinds:
// - "framed": a preview the project's owner tries from its page on Bashed, in a frame at
//   /framed/<id>. It's gone five minutes after it's made (`expiresAt`).
// - "shipped": made when the project's shipped, for its reviewers and anyone else, at
//   /<id>. It stays.
export const demos = pgTable(
  "demos",
  {
    // A UUIDv6 (see uuid6), so they sort by when they were made
    id: uuid("id").primaryKey(),
    kind: text("kind").$type<DemoKind>().notNull(),
    // The project's ID on Bashed, for its admins' list of demos
    project: integer("project"),
    // Its repository: its host (see REPO_HOSTS) and path there, e.g. "hackclub/bashed"
    host: text("host").$type<RepoHost>().notNull(),
    path: text("path").notNull(),
    // The full SHA of the commit it runs
    commit: text("commit").notNull(),
    // The file it runs, as a path within the repository (e.g. "main.fish")
    entry: text("entry").notNull(),
    // The repository cloned at that commit (with its .git), as a .tar.gz, unpacked into the
    // virtual machine. Leave it out of queries that don't need it.
    archive: bytea("archive").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // When a framed one ends; null for a shipped one, which doesn't
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [index("demos_expires_at_idx").on(t.expiresAt)],
);
