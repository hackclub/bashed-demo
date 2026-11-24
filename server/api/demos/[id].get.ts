import { demoId, findDemo, toDemo } from "../../utils/demos";

// A demo, for its page, while it's up (a framed one that's run out is "Gone", 410). Public,
// like everything it says (it's all in the public repository).
export default defineEventHandler(async (event) => {
  const row = await findDemo(demoId(event));
  return toDemo(row);
});
