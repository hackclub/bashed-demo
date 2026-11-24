import { listRepositoryFiles, parseRepository } from "../../utils/repository";

// The files in a repository at its latest commit, for Bashed's picker of the file a demo
// runs. Only Bashed can ask (see server/utils/bashed.ts):
//
//   POST /api/repository/files
//   { "repo": "https://github.com/<owner>/<name>" }
//
// Answers with the commit and its files: each one's path, size, whether it's executable and
// its shebang line if it starts with one. Folders and links aren't listed; `truncated` says
// there were more than could be.
export default defineEventHandler(async (event) => {
  const body = await requireBashed(event);
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(body.toString("utf8"));
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Send JSON" });
  }
  return listRepositoryFiles(parseRepository(input?.repo));
});
