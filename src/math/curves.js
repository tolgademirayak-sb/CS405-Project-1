export const lerp = (a, b, t) => a.map((v, i) => (1 - t) * v + t * b[i]);
export function casteljau(p, t) {
  const levels = [p.map((v) => [...v])];
  while (levels.at(-1).length > 1) {
    const a = levels.at(-1);
    levels.push(a.slice(0, -1).map((v, i) => lerp(v, a[i + 1], t)));
  }
  return levels;
}
export function bezier(p, t) {
  const u = 1 - t,
    w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return p[0].map((_, d) => p.reduce((s, v, i) => s + w[i] * v[d], 0));
}
export function bezierTangent(p, t) {
  const u = 1 - t;
  return p[0].map(
    (_, d) =>
      3 * u * u * (p[1][d] - p[0][d]) +
      6 * u * t * (p[2][d] - p[1][d]) +
      3 * t * t * (p[3][d] - p[2][d]),
  );
}
export function catmull(p, t) {
  return p[0].map((_, d) => {
    const [a, b, c, e] = p.map((v) => v[d]);
    return (
      0.5 *
      (2 * b +
        (-a + c) * t +
        (2 * a - 5 * b + 4 * c - e) * t * t +
        (-a + 3 * b - 3 * c + e) * t * t * t)
    );
  });
}
export function catmullTangent(p, t) {
  return p[0].map((_, d) => {
    const [a, b, c, e] = p.map((v) => v[d]);
    return (
      0.5 *
      (-a +
        c +
        2 * (2 * a - 5 * b + 4 * c - e) * t +
        3 * (-a + 3 * b - 3 * c + e) * t * t)
    );
  });
}
export function segment(points, t, type = "bezier") {
  const p = type === "bezier" ? points : points.filter((_, i) => i % 3 === 0),
    n = type === "bezier" ? (p.length - 1) / 3 : p.length - 1;
  const s = Math.max(0, Math.min(1, t)) * n,
    i = Math.min(n - 1, Math.floor(s)),
    u = s - i;
  return {
    p:
      type === "bezier"
        ? p.slice(i * 3, i * 3 + 4)
        : [
            p[Math.max(0, i - 1)],
            p[i],
            p[i + 1],
            p[Math.min(p.length - 1, i + 2)],
          ],
    u,
    n,
  };
}
export function evaluate(points, t, type = "bezier", tangent = false) {
  const { p, u, n } = segment(points, t, type);
  const v =
    type === "bezier"
      ? tangent
        ? bezierTangent(p, u)
        : bezier(p, u)
      : tangent
        ? catmullTangent(p, u)
        : catmull(p, u);
  return tangent ? v.map((x) => x * n) : v;
}
// All cubic segments have equal parameter intervals: opposite, equal handles enforce C1.
export function movePoint(points, i, pos) {
  const delta = pos.map((v, d) => v - points[i][d]);
  points[i] = [...pos];
  if (i % 3 === 0) {
    for (const j of [i - 1, i + 1])
      if (points[j]) points[j] = points[j].map((v, d) => v + delta[d]);
  } else {
    const k = i % 3 === 1 ? i - 1 : i + 1,
      j = 2 * k - i;
    if (k > 0 && k < points.length - 1 && points[j])
      points[j] = points[k].map((v, d) => 2 * v - points[i][d]);
  }
}
// Three cubic pieces trace the top contour of the large melon in the supplied image.
export const initialPoints = () => [
  [0.29, 0.77],
  [0.36, 0.88],
  [0.48, 0.9],
  [0.56, 0.88],
  [0.64, 0.86],
  [0.74, 0.81],
  [0.8, 0.75],
  [0.86, 0.69],
  [0.89, 0.6],
  [0.9, 0.49],
];
export const exportCurve = (points, type) => ({
  schemaVersion: 1,
  painting: {
    artist: "Şeker Ahmed Paşa",
    title: "Kavunlu Natürmort",
    source: "Course-provided Project1/assets/kavunlu.js",
  },
  type,
  coordinates:
    "normalized painting coordinates; origin bottom-left; x right, y up",
  parameterization: "equal segment intervals",
  points: points.map((p) => p.map((v) => +v.toFixed(6))),
});
