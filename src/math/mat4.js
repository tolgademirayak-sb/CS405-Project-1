// Column-major matrices; column vectors; multiply(a,b) applies b first.
export const identity = () =>
  new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
export function multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
export const compose = (...m) => m.reduce(multiply, identity());
export function translate(x, y, z) {
  const m = identity();
  m.set([x, y, z], 12);
  return m;
}
export const scale = (x, y = x, z = x) =>
  new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
export function rotateX(a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}
export function rotateY(a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}
export function rotateZ(a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
export function transpose(a) {
  const m = new Float32Array(16);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) m[4 * c + r] = a[4 * r + c];
  return m;
}
export function transform(m, p) {
  const v = [...p];
  if (v.length === 3) v.push(1);
  return [0, 1, 2, 3].map((r) =>
    v.reduce((s, x, c) => s + m[c * 4 + r] * x, 0),
  );
}
export function inverseRigid(m) {
  const o = identity();
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) o[c * 4 + r] = m[r * 4 + c];
  for (let r = 0; r < 3; r++)
    o[12 + r] = -(o[r] * m[12] + o[4 + r] * m[13] + o[8 + r] * m[14]);
  return o;
}
// General inverse is used only for mouse unprojection, not rigid-transform grading.
export function inverse(m) {
  const a = Array.from({ length: 4 }, (_, r) => [
    ...Array.from({ length: 4 }, (_, c) => m[c * 4 + r]),
    ...Array.from({ length: 4 }, (_, c) => +(c === r)),
  ]);
  for (let i = 0; i < 4; i++) {
    let p = i;
    for (let r = i + 1; r < 4; r++)
      if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r;
    if (Math.abs(a[p][i]) < 1e-12) throw Error("Singular matrix");
    [a[p], a[i]] = [a[i], a[p]];
    const d = a[i][i];
    a[i] = a[i].map((x) => x / d);
    for (let r = 0; r < 4; r++)
      if (r !== i) {
        const f = a[r][i];
        a[r] = a[r].map((x, c) => x - f * a[i][c]);
      }
  }
  return new Float32Array(
    Array.from({ length: 16 }, (_, i) => a[i % 4][4 + Math.floor(i / 4)]),
  );
}
export const fmt = (m) =>
  Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: 4 }, (_, c) =>
      (Math.abs(m[c * 4 + r]) < 0.0005 ? 0 : m[c * 4 + r])
        .toFixed(3)
        .padStart(8),
    ).join(" "),
  ).join("\n");
