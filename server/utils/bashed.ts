import { createHmac, timingSafeEqual } from "node:crypto";
import type { H3Event } from "h3";

// Bashed's requests (putting up and taking down demos) are signed with the secret both sides
// share (BASHED_SECRET), in an X-Bashed-Signature header:
//
//   X-Bashed-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256>
//
// where the HMAC is of `<t>.<METHOD>.<path>.<raw body>`, e.g. `1764000000.PUT./api/demos/12.{...}`.
// Requests more than five minutes old (or ahead) are refused, so one overheard can't be
// replayed later. scripts/bashed-request.mjs signs requests the same way, by hand.
const MAX_AGE_SECONDS = 5 * 60;

export function signBashedRequest(
  secret: string,
  timestamp: number,
  method: string,
  path: string,
  body: string | Buffer,
) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${method.toUpperCase()}.${path}.`)
    .update(body)
    .digest("hex");
}

// Throws unless the request was signed by Bashed. Returns its raw body, since the signature
// covers it byte for byte.
export async function requireBashed(event: H3Event): Promise<Buffer> {
  const { bashedSecret } = useRuntimeConfig(event);
  if (!bashedSecret) {
    throw createError({
      statusCode: 503,
      statusMessage: "BASHED_SECRET is not set",
    });
  }

  const header = getRequestHeader(event, "x-bashed-signature") ?? "";
  const parts = Object.fromEntries(
    header.split(",").map((part) => part.trim().split("=", 2)),
  );
  const timestamp = Number(parts.t);
  const signature = String(parts.v1 ?? "");
  // GET requests have no body (and h3 won't read one)
  const body =
    (event.method == "GET" || event.method == "HEAD"
      ? null
      : await readRawBody(event, false)) ?? Buffer.alloc(0);

  const age = Math.abs(Date.now() / 1000 - timestamp);
  const expected = Number.isFinite(timestamp)
    ? signBashedRequest(
        bashedSecret,
        timestamp,
        event.method,
        getRequestURL(event).pathname,
        body,
      )
    : "";
  const valid =
    age <= MAX_AGE_SECONDS &&
    /^[0-9a-f]{64}$/.test(signature) &&
    timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex"),
    );
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: "Bad signature" });
  }
  return body;
}
