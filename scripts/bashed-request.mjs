// Sends a request to the demo site's API signed the way Bashed signs them (see
// server/utils/bashed.ts), with BASHED_SECRET from .env. For trying things before Bashed
// sends them itself, and as a working example of the signature for Bashed's side.
//
//   pnpm bashed POST /api/demos '{"repo":"https://github.com/part-avocado/bonsai","entry":"main.fish","kind":"shipped"}'
//   pnpm bashed GET /api/demos
//   pnpm bashed POST /api/repository/files '{"repo":"https://github.com/part-avocado/bonsai"}'
//   pnpm bashed DELETE /api/demos/<id>
//
// Sends to http://localhost:3001 unless DEMO_URL says otherwise.
import { createHmac } from "node:crypto";

try {
  process.loadEnvFile(".env");
} catch {}

const [method, path, body = ""] = process.argv.slice(2);
const secret = process.env.BASHED_SECRET;
if (!method || !path?.startsWith("/")) {
  console.error("usage: bashed-request.mjs <METHOD> <path> [JSON body]");
  process.exit(1);
}
if (!secret) {
  console.error("Set BASHED_SECRET in .env");
  process.exit(1);
}

const timestamp = Math.floor(Date.now() / 1000);
const signature = createHmac("sha256", secret)
  .update(`${timestamp}.${method.toUpperCase()}.${path}.${body}`)
  .digest("hex");

const response = await fetch(
  new URL(path, process.env.DEMO_URL ?? "http://localhost:3001"),
  {
    method,
    headers: {
      "X-Bashed-Signature": `t=${timestamp},v1=${signature}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body || undefined,
  },
);
console.log(response.status, response.statusText);
const text = await response.text();
if (text) console.log(text);
process.exit(response.ok ? 0 : 1);
