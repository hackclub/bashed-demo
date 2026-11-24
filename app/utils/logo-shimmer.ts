import type { Terminal } from "@xterm/xterm";

// Bashed's simple logo (public/logo-small.svg) drawn in the terminal while the machine
// boots, as text art: traced from the SVG at whatever size fits, with Unicode's block octants
// (Symbols for Legacy Computing Supplement), which split a character into 2 × 4 pixels.
// It's grey, with a white highlight sweeping across it from left to right, over and over.
// With reduced motion it's drawn once, still and grey.
//
// The terminal's font (Adwaita Mono, see main.css) has every octant, and its blocks fill
// whole cells, so the pixels tile. Returns a function that stops it and clears the screen
// for the machine's output.

const LOGO_URL = "/logo-small.svg";
// The SVG's size
const LOGO_WIDTH = 292.097;
const LOGO_HEIGHT = 85.685;
// The widest it's drawn, in characters
const MAX_COLUMNS = 50;

type RGB = [number, number, number];

const GREY: RGB = [78, 82, 94];
const WHITE: RGB = [255, 255, 255];
// The highlight: how wide it is (in pixels, it fades out to either side), how far it leans
// (pixels across per pixel down), and how long one sweep takes (in seconds)
const HIGHLIGHT_WIDTH = 13;
const HIGHLIGHT_LEAN = 0.6;
const SWEEP_SECONDS = 1.6;

// The character for each pattern of a cell's 8 pixels. Bit n - 1 is pixel n, numbered left
// to right, top to bottom:
//   1 2
//   3 4
//   5 6
//   7 8
// Most patterns are octants (U+1CD00 to U+1CDE5, in order); the rest were already in
// Unicode as other block characters, which the octants skip.
const OCTANT = (() => {
  const existing: Record<string, number> = {
    "": 0x20,
    "1": 0x1cea8,
    "2": 0x1ceab,
    "12": 0x1fb82,
    "13": 0x2598,
    "24": 0x259d,
    "1234": 0x2580,
    "35": 0x1fbe6,
    "46": 0x1fbe7,
    "123456": 0x1fb85,
    "7": 0x1cea3,
    "57": 0x2596,
    "1357": 0x258c,
    "2457": 0x259e,
    "123457": 0x259b,
    "8": 0x1cea0,
    "68": 0x2597,
    "1368": 0x259a,
    "2468": 0x2590,
    "123468": 0x259c,
    "78": 0x2582,
    "5678": 0x2584,
    "135678": 0x2599,
    "245678": 0x259f,
    "345678": 0x2586,
    "12345678": 0x2588,
  };
  const table: string[] = [];
  let next = 0x1cd00;
  for (let mask = 0; mask < 256; mask++) {
    const name = [1, 2, 3, 4, 5, 6, 7, 8]
      .filter((n) => mask & (1 << (n - 1)))
      .join("");
    table.push(String.fromCodePoint(existing[name] ?? next++));
  }
  return table;
})();

export async function startLogoShimmer(term: Terminal, screen: HTMLElement) {
  // A character's size, for tracing the logo without stretching it
  const box = screen.querySelector(".xterm-screen")?.getBoundingClientRect();
  const cellWidth = box ? box.width / term.cols : 9;
  const cellHeight = box ? box.height / term.rows : 19;
  // A pixel is half a character wide and a quarter of one tall
  const pixelAspect = cellWidth / 2 / (cellHeight / 4);

  // As wide as fits (leaving room for the line under it), but no wider than MAX_COLUMNS
  let columns = Math.min(term.cols - 4, MAX_COLUMNS);
  const heightFor = (c: number) =>
    Math.max(4, Math.round((c * 2 * LOGO_HEIGHT * pixelAspect) / LOGO_WIDTH));
  while (columns > 8 && Math.ceil(heightFor(columns) / 4) + 3 > term.rows)
    columns--;
  const width = columns * 2;
  const height = heightFor(columns);
  const rows = Math.ceil(height / 4);

  const inside = await traceLogo(width, height).catch(() => null);
  if (!inside) return () => {};

  // Each cell's pattern, worked out once
  const masks = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => {
      let mask = 0;
      for (let n = 0; n < 8; n++) {
        const x = column * 2 + (n % 2);
        const y = row * 4 + Math.floor(n / 2);
        if (inside[y]?.[x]) mask |= 1 << n;
      }
      return mask;
    }),
  );

  const top = Math.max(1, Math.floor((term.rows - rows - 2) / 2) + 1);
  const left = Math.floor((term.cols - columns) / 2) + 1;

  // A cell's colour at a time: grey, whitening as the highlight passes. It starts off the
  // left edge and finishes off the right, so each sweep comes in from the side.
  const travel = width + height * HIGHLIGHT_LEAN + HIGHLIGHT_WIDTH * 2;
  function colour(column: number, row: number, time: number) {
    const x = column * 2 + 1;
    const y = row * 4 + 2;
    const centre =
      ((time % SWEEP_SECONDS) / SWEEP_SECONDS) * travel - HIGHLIGHT_WIDTH;
    const distance = Math.abs(x + (height - y) * HIGHLIGHT_LEAN - centre);
    const glow =
      distance < HIGHLIGHT_WIDTH
        ? (1 + Math.cos((distance / HIGHLIGHT_WIDTH) * Math.PI)) / 2
        : 0;
    return GREY.map((c, i) => Math.round(c + (WHITE[i]! - c) * glow)).join(";");
  }

  function frame(time: number) {
    let out = "";
    for (let row = 0; row < rows; row++) {
      out += `\x1b[${top + row};${left}H`;
      for (let column = 0; column < columns; column++) {
        const mask = masks[row]![column]!;
        const rgb = mask ? colour(column, row, time) : "";
        if (mask == 0) out += "\x1b[0m ";
        // Full cells as coloured spaces, which fill the cell whatever the font does
        else if (mask == 255) out += `\x1b[0m\x1b[48;2;${rgb}m `;
        else out += `\x1b[0m\x1b[38;2;${rgb}m${OCTANT[mask]}`;
      }
    }
    return out + "\x1b[0m";
  }

  // Hidden cursor, a clear screen, the logo and a line under it
  const caption = "starting the machine";
  term.write(
    "\x1b[?25l\x1b[2J" +
      frame(0) +
      `\x1b[${top + rows + 1};${Math.floor((term.cols - caption.length) / 2) + 1}H` +
      `\x1b[2m${caption}\x1b[0m`,
  );

  let stopped = false;
  let request = 0;
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const start = performance.now();
    let last = 0;
    const tick = (now: number) => {
      if (stopped) return;
      // About 30 frames a second is plenty for text
      if (now - last > 33) {
        last = now;
        term.write(frame((now - start) / 1000));
      }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
  }

  return () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(request);
    // Back to a clear screen and a cursor, for the machine
    term.write("\x1b[0m\x1b[2J\x1b[3J\x1b[H\x1b[?25h");
  };
}

// Which pixels of a width × height trace of the logo are inside it, row by row
async function traceLogo(width: number, height: number) {
  const image = new Image();
  image.src = LOGO_URL;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  return Array.from({ length: height }, (_, y) =>
    Array.from(
      { length: width },
      (_, x) => data[(y * width + x) * 4 + 3]! > 110,
    ),
  );
}
