import { createReadStream } from "node:fs";

// The virtual machine's disk (an ext2 image, see the Dockerfile), at /disk/<version>.ext2
// (see server/utils/disk.ts). CheerpX reads it in pieces as the machine needs them, with
// HTTP range requests, so only what's used is downloaded.
export default defineEventHandler(async (event) => {
  if (event.method != "GET" && event.method != "HEAD") {
    throw createError({ statusCode: 405 });
  }

  const disk = await useDisk(event);
  // An older version's gone
  if (getRouterParam(event, "file") != `${disk.version}.ext2`) {
    throw createError({ statusCode: 404, statusMessage: "No such disk" });
  }

  setResponseHeaders(event, {
    "Content-Type": "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    // CheerpX won't use a disk without one
    ETag: `"${disk.version}"`,
  });

  // One range, e.g. "bytes=0-131071", "bytes=4096-" or "bytes=-512" (the last 512)
  const range = /^bytes=(\d*)-(\d*)$/.exec(
    getRequestHeader(event, "range") ?? "",
  );
  let start = 0;
  let end = disk.size - 1;
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), end);
    } else {
      start = Math.max(disk.size - Number(range[2]), 0);
    }
    if (start > end) {
      setResponseHeader(event, "Content-Range", `bytes */${disk.size}`);
      throw createError({ statusCode: 416 });
    }
    setResponseStatus(event, 206);
    setResponseHeader(
      event,
      "Content-Range",
      `bytes ${start}-${end}/${disk.size}`,
    );
  }
  setResponseHeader(event, "Content-Length", end - start + 1);

  if (event.method == "HEAD") return null;
  return sendStream(event, createReadStream(disk.path, { start, end }));
});
