import type { H3Event } from "h3";
import { eq, gt, isNull, lt, or } from "drizzle-orm";
import { isUuid6 } from "./uuid6";
import type { DemoKind, RepoHost } from "#shared/utils/repo-hosts";

// How long a framed demo (a preview tried from Bashed) lasts
export const FRAMED_LIFETIME_MS = 2 * 60 * 1000;

// The demo's ID from the route: a UUIDv6 (see uuid6)
export function demoId(event: H3Event): string {
  const id = getRouterParam(event, "id")?.toLowerCase();
  if (!isUuid6(id))
    throw createError({ statusCode: 404, statusMessage: "No such demo" });
  return id;
}

// Every column but the archive
export const demoColumns = {
  id: schema.demos.id,
  kind: schema.demos.kind,
  project: schema.demos.project,
  host: schema.demos.host,
  path: schema.demos.path,
  commit: schema.demos.commit,
  entry: schema.demos.entry,
  createdAt: schema.demos.createdAt,
  expiresAt: schema.demos.expiresAt,
};

// Demos that are still up: every shipped one, and framed ones that haven't run out yet
export function isActive() {
  return or(
    isNull(schema.demos.expiresAt),
    gt(schema.demos.expiresAt, new Date()),
  );
}

// Deletes framed demos that have run out
export async function deleteEnded() {
  await useDB()
    .delete(schema.demos)
    .where(lt(schema.demos.expiresAt, new Date()));
}

// One demo, if it's still up: 404 if there's no such demo, 410 ("Gone") for a framed one
// that's run out
export async function findDemo(id: string) {
  const [row] = await useDB()
    .select(demoColumns)
    .from(schema.demos)
    .where(eq(schema.demos.id, id));
  if (!row)
    throw createError({ statusCode: 404, statusMessage: "No such demo" });
  if (row.expiresAt && row.expiresAt <= new Date())
    throw createError({
      statusCode: 410,
      statusMessage: "This preview has ended",
    });
  return row;
}

export function toDemo(row: {
  id: string;
  kind: DemoKind;
  project: number | null;
  host: RepoHost;
  path: string;
  commit: string;
  entry: string;
  createdAt: Date;
  expiresAt: Date | null;
}): Demo {
  return {
    id: row.id,
    kind: row.kind,
    project: row.project,
    host: row.host,
    path: row.path,
    name: row.path.split("/").at(-1)!,
    commit: row.commit,
    entry: row.entry,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    page: row.kind == "framed" ? `/framed/${row.id}` : `/${row.id}`,
  };
}
