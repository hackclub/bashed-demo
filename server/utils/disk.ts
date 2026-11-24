import { stat } from "node:fs/promises";
import type { H3Event } from "h3";

// The virtual machine's disk (built with `pnpm disk:build`, or into the Docker image), with
// a version that changes whenever it's rebuilt. It's served at /disk/<version>.ext2, so
// browsers can keep pieces of it for good without mixing in pieces of an older one.
export async function useDisk(event: H3Event) {
  const { diskPath } = useRuntimeConfig(event);
  const info = await stat(diskPath).catch(() => null);
  if (!info?.isFile()) {
    throw createError({
      statusCode: 503,
      statusMessage: "No disk: build it with `pnpm disk:build`",
    });
  }
  const version = `${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}`;
  return {
    path: diskPath,
    size: info.size,
    version,
    url: `/disk/${version}.ext2`,
  };
}
