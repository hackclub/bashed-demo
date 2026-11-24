// Headers for every response:
// - cross-origin isolation, which CheerpX needs (for SharedArrayBuffer). Everything a page
//   loads is from here or Leaning Technologies' CDN, which allows it.
// - framed demos (/framed/...) are shown in a frame on Bashed, which isn't cross-origin
//   isolated itself, so they isolate themselves with Document-Isolation-Policy (Chromium;
//   elsewhere the page offers to open in a tab of its own instead). Only Bashed may frame
//   them; nothing may frame the other pages.
// - Cross-Origin-Resource-Policy, so they can still be framed by a page that is isolated
// - no content sniffing, and no referrer beyond the site to the links on the pages
export default defineEventHandler((event) => {
  const framed = getRequestURL(event).pathname.startsWith("/framed/");
  const { bashedUrl } = useRuntimeConfig(event).public;
  let bashed = "'none'";
  try {
    bashed = new URL(bashedUrl).origin;
  } catch {}

  setResponseHeaders(event, {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Content-Security-Policy": `frame-ancestors ${framed ? bashed : "'none'"}; base-uri 'self'; object-src 'none'`,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  if (framed)
    setResponseHeader(
      event,
      "Document-Isolation-Policy",
      "isolate-and-require-corp",
    );
});
