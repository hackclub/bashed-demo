import { eq } from "drizzle-orm";
import { demoId } from "../../utils/demos";

// Takes a demo down. Only Bashed can (see server/utils/bashed.ts). Fine to repeat: a demo
// that's already gone is gone.
export default defineEventHandler(async (event) => {
  await requireBashed(event);
  const id = demoId(event);
  await useDB().delete(schema.demos).where(eq(schema.demos.id, id));
  setResponseStatus(event, 204);
  return null;
});
