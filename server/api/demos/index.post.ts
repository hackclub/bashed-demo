import {
  archiveRepository,
  parseCommit,
  parseEntry,
  parseRepository,
} from "../../utils/repository";
import {
  FRAMED_LIFETIME_MS,
  deleteEnded,
  demoColumns,
  toDemo,
} from "../../utils/demos";
import { uuid6 } from "../../utils/uuid6";
import { DEMO_KINDS, type DemoKind } from "#shared/utils/repo-hosts";

// Makes a project's demo. Only Bashed can (see server/utils/bashed.ts), and it decides
// what runs:
//
//   POST /api/demos
//   {
//     "repo": "https://github.com/<owner>/<name>",  (or on GitLab or Codeberg)
//     "entry": "main.fish",                         (the file it runs)
//     "kind": "framed" | "shipped",
//     "commit": "<full SHA>",                       (optional: the latest if it's left out)
//     "project": 12                                 (optional: its ID on Bashed)
//   }
//
// A framed demo is a five-minute preview, at /framed/<id>; a shipped one stays, at /<id>.
// The repository's cloned at the commit and kept, so the demo keeps running that version
// whatever's pushed later. Answers with the demo once it's ready (cloning takes a few
// seconds), or an error saying what was wrong.
export default defineEventHandler(async (event) => {
  const body = await requireBashed(event);

  let input: Record<string, unknown>;
  try {
    input = JSON.parse(body.toString("utf8"));
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Send JSON" });
  }
  const repository = parseRepository(input?.repo);
  const entry = parseEntry(input?.entry);
  const commit = parseCommit(input?.commit);
  const kind = input?.kind;
  if (!DEMO_KINDS.includes(kind as DemoKind))
    throw createError({
      statusCode: 400,
      statusMessage: `kind must be ${DEMO_KINDS.join(" or ")}`,
    });
  const project = input?.project ?? null;
  if (
    project !== null &&
    !(Number.isSafeInteger(project) && Number(project) > 0)
  )
    throw createError({
      statusCode: 400,
      statusMessage: "project must be a project's ID on Bashed",
    });

  // Framed demos that have run out go now and then, so they don't pile up
  await deleteEnded();

  const packed = await archiveRepository(repository, commit, entry);
  const [row] = await useDB()
    .insert(schema.demos)
    .values({
      id: uuid6(),
      kind: kind as DemoKind,
      project: project as number | null,
      host: repository.host,
      path: repository.path,
      commit: packed.commit,
      entry,
      archive: packed.archive,
      expiresAt:
        kind == "framed" ? new Date(Date.now() + FRAMED_LIFETIME_MS) : null,
    })
    .returning(demoColumns);
  setResponseStatus(event, 201);
  return toDemo(row!);
});
