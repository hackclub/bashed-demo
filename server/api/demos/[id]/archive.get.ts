import { eq } from "drizzle-orm";
import { demoId, findDemo } from "../../../utils/demos";

// The demo's repository, packed (.tar.gz), for the page to put in the virtual machine,
// while the demo's up. Asked for with its commit (?commit=<SHA>), which never changes for a
// demo, so a copy can be cached for good.
export default defineEventHandler(async (event) => {
  const demo = await findDemo(demoId(event));
  if (getQuery(event).commit != demo.commit)
    throw createError({ statusCode: 404, statusMessage: "No such demo" });
  const [row] = await useDB()
    .select({ archive: schema.demos.archive })
    .from(schema.demos)
    .where(eq(schema.demos.id, demo.id));
  if (!row)
    throw createError({ statusCode: 404, statusMessage: "No such demo" });

  setResponseHeaders(event, {
    "Content-Type": "application/gzip",
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  return row.archive;
});
