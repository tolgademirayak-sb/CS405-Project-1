export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, s) => a.map((v) => v * s);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function normalize(a) {
  const l = Math.hypot(...a);
  if (l < 1e-10) throw Error("Zero-length direction");
  return mul(a, 1 / l);
}
export function basis(eye, target, up = [0, 1, 0]) {
  const z = normalize(sub(eye, target));
  let ref = up;
  if (Math.hypot(...cross(ref, z)) < 1e-6)
    ref = Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const x = normalize(cross(ref, z)),
    y = cross(z, x);
  return { x, y, z };
}
export function lookAt(eye, target, up = [0, 1, 0]) {
  const { x, y, z } = basis(eye, target, up);
  return new Float32Array([
    x[0],
    y[0],
    z[0],
    0,
    x[1],
    y[1],
    z[1],
    0,
    x[2],
    y[2],
    z[2],
    0,
    -dot(x, eye),
    -dot(y, eye),
    -dot(z, eye),
    1,
  ]);
}
function valid(n, f) {
  if (!(n > 0 && f > n)) throw Error("Require 0 < near < far");
}
export function perspective(fov, aspect, n, f) {
  valid(n, f);
  if (!(fov > 0 && fov < Math.PI && aspect > 0))
    throw Error("Invalid field of view/aspect");
  const s = 1 / Math.tan(fov / 2);
  return new Float32Array([
    s / aspect,
    0,
    0,
    0,
    0,
    s,
    0,
    0,
    0,
    0,
    f / (n - f),
    -1,
    0,
    0,
    (n * f) / (n - f),
    0,
  ]);
}
export function orthographic(h, aspect, n, f) {
  valid(n, f);
  if (!(h > 0 && aspect > 0)) throw Error("Invalid orthographic extent");
  return new Float32Array([
    2 / (h * aspect),
    0,
    0,
    0,
    0,
    2 / h,
    0,
    0,
    0,
    0,
    1 / (n - f),
    0,
    0,
    0,
    n / (n - f),
    1,
  ]);
}
export function frustum(
  eye,
  target,
  fov,
  aspect,
  n,
  f,
  ortho = false,
  height = 4,
) {
  const { x, y, z } = basis(eye, target);
  return [n, f].flatMap((d) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([sx, sy]) => {
      const hh = ortho ? height / 2 : Math.tan(fov / 2) * d;
      return add(
        add(eye, mul(z, -d)),
        add(mul(x, sx * hh * aspect), mul(y, sy * hh)),
      );
    }),
  );
}
