// Material 3 Expressive shapes, as SVG paths in a 100×100 box (from Bashed's app/utils/shapes.ts)

type Point = [number, number];

function toPath(points: Point[]) {
  return `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L")}Z`;
}

// A shape from how far its edge is from the middle at each angle (1 is the box's edge)
function polarShape(radius: (angle: number) => number) {
  return toPath(
    Array.from({ length: 180 }, (_, i) => {
      const angle = (i / 180) * Math.PI * 2;
      const r = 50 * radius(angle);
      return [50 + r * Math.cos(angle), 50 + r * Math.sin(angle)];
    }),
  );
}

// A circle with `lobes` bumps round its edge, `depth` deep
export function wavyCircle(lobes: number, depth: number) {
  return polarShape((angle) => 1 - depth + depth * Math.cos(lobes * angle));
}

// The scalloped cookie behind icons
export const COOKIE_SHAPE = wavyCircle(9, 0.08);
