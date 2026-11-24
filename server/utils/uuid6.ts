import { randomBytes } from "node:crypto";

// A version 6 UUID (RFC 9562): the time first, so they sort by when they were made, then
// 62 random bits, so they can't be guessed. The time is in 100-nanosecond steps since the
// Gregorian calendar began (15 October 1582); IDs made within the same millisecond count
// on in those steps, so they still sort in order.
const GREGORIAN_OFFSET = BigInt("0x01b21dd213814000");
let lastMs = 0;
let sequence = 0;

export function uuid6() {
  const now = Date.now();
  sequence = now == lastMs ? (sequence + 1) % 10_000 : 0;
  lastMs = now;
  // 60 bits: 15 hex digits, split 8 (high), 4 (middle) and 3 (low, after the version)
  const time = (
    BigInt(now) * BigInt(10_000) +
    BigInt(sequence) +
    GREGORIAN_OFFSET
  )
    .toString(16)
    .padStart(15, "0");

  const random = randomBytes(8);
  // The variant (binary 10), then 14 bits of "clock sequence"; the last 48 bits are the
  // "node", random, so marked as not a real network card's address (the multicast bit)
  random[0] = (random[0]! & 0x3f) | 0x80;
  random[2] = random[2]! | 0x01;
  const rest = random.toString("hex");

  return `${time.slice(0, 8)}-${time.slice(8, 12)}-6${time.slice(12, 15)}-${rest.slice(0, 4)}-${rest.slice(4, 16)}`;
}

// Whether a string is one of those, as it's written (lowercase, with its dashes)
export function isUuid6(value: unknown): value is string {
  return (
    typeof value == "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-6[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value,
    )
  );
}
