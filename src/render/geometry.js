import { transform } from "../math/mat4.js";
export const world = (m, p) => transform(m, p).slice(0, 3);
export function vertex(out, p, c = [1, 1, 1], uv = [0, 0], tex = 0) {
  out.push(...p, ...c, ...uv, tex);
}
export function line(out, a, b, c) {
  vertex(out, a, c);
  vertex(out, b, c);
}
export function cube(out, m, c) {
  const v = [
    [-0.5, -0.5, -0.5],
    [0.5, -0.5, -0.5],
    [0.5, 0.5, -0.5],
    [-0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5],
    [0.5, -0.5, 0.5],
    [0.5, 0.5, 0.5],
    [-0.5, 0.5, 0.5],
  ].map((p) => world(m, p));
  const f = [
    [0, 1, 2, 3],
    [5, 4, 7, 6],
    [4, 0, 3, 7],
    [1, 5, 6, 2],
    [3, 2, 6, 7],
    [4, 5, 1, 0],
  ];
  f.forEach((a, j) => {
    for (const i of [0, 1, 2, 0, 2, 3])
      vertex(
        out,
        v[a[i]],
        c.map((x) => x * [0.55, 0.95, 0.65, 0.8, 1, 0.45][j]),
      );
  });
}
export function quad(out, w, h, z) {
  const p = [
      [-w / 2, -h / 2, z],
      [w / 2, -h / 2, z],
      [w / 2, h / 2, z],
      [-w / 2, h / 2, z],
    ],
    uv = [
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ];
  for (const i of [0, 1, 2, 0, 2, 3]) vertex(out, p[i], [1, 1, 1], uv[i], 1);
}
export function axes(out, m, size = 0.3) {
  const o = world(m, [0, 0, 0]);
  [
    [size, 0, 0],
    [0, size, 0],
    [0, 0, size],
  ].forEach((p, i) =>
    line(
      out,
      o,
      world(m, p),
      [
        [1, 0.1, 0.1],
        [0.1, 1, 0.3],
        [0.2, 0.5, 1],
      ][i],
    ),
  );
}
