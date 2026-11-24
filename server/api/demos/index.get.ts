import { desc } from "drizzle-orm";
import { demoColumns, isActive, toDemo } from "../../utils/demos";

// Every demo that's up (shipped ones, and framed ones that haven't run out), newest first,
// for Bashed's admins. Only Bashed can ask (see server/utils/bashed.ts).
export default defineEventHandler(async (event) => {
  await requireBashed(event);
  const rows = await useDB()
    .select(demoColumns)
    .from(schema.demos)
    .where(isActive())
    .orderBy(desc(schema.demos.id));
  return rows.map(toDemo);
});
