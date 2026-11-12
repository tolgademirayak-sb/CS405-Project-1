import { test } from "node:test";
import assert from "node:assert/strict";
import * as M from "../src/math/mat4.js";
import * as C from "../src/math/camera.js";
import * as Q from "../src/math/curves.js";
import { Node } from "../src/scene/node.js";
const close = (a, b, e = 1e-5) => {
  assert.equal(a.length, b.length);
  a.forEach((v, i) =>
    assert.ok(Math.abs(v - b[i]) < e, `${v} != ${b[i]} at ${i}`),
  );
};
test("identity, column-major translation and transpose", () => {
  close(M.transform(M.identity(), [2, 3, 4]), [2, 3, 4, 1]);
  close(M.transform(M.translate(1, 2, 3), [2, 3, 4]), [3, 5, 7, 1]);
  const a = Float32Array.from({ length: 16 }, (_, i) => i);
  close(M.transpose(M.transpose(a)), a);
  assert.equal(M.transpose(a)[1], 4);
});
test("rotation axis signs", () => {
  close(M.transform(M.rotateX(Math.PI / 2), [0, 1, 0]), [0, 0, 1, 1]);
  close(M.transform(M.rotateY(Math.PI / 2), [1, 0, 0]), [0, 0, -1, 1]);
  close(M.transform(M.rotateZ(Math.PI / 2), [1, 0, 0]), [0, 1, 0, 1]);
});
test("composition order differs numerically", () => {
  const t = M.translate(3, 0, 0),
    s = M.scale(2);
  close(M.transform(M.multiply(t, s), [1, 0, 0]), [5, 0, 0, 1]);
  close(M.transform(M.multiply(s, t), [1, 0, 0]), [8, 0, 0, 1]);
});
test("rigid inverse and general inverse round trips", () => {
  for (let i = 0; i < 30; i++) {
    const a = M.compose(
      M.translate(i / 7, -2, 3),
      M.rotateY(i * 0.2),
      M.rotateX(i * 0.1),
    );
    close(M.multiply(a, M.inverseRigid(a)), M.identity());
    const b = M.multiply(a, M.scale(1.3, 2, 0.7));
    close(M.multiply(b, M.inverse(b)), M.identity());
  }
});
test("lookAt maps eye to origin and target to negative z", () => {
  const v = C.lookAt([3, 2, 5], [0, 0, 0]);
  close(M.transform(v, [3, 2, 5]), [0, 0, 0, 1]);
  const t = M.transform(v, [0, 0, 0]);
  close(t.slice(0, 2), [0, 0]);
  assert.ok(t[2] < 0);
});
test("parallel up handled; coincident eye rejected", () => {
  const v = C.lookAt([0, 3, 0], [0, 0, 0]);
  assert.ok([...v].every(Number.isFinite));
  close(M.multiply(v, M.inverseRigid(v)), M.identity());
  assert.throws(() => C.lookAt([0, 0, 0], [0, 0, 0]));
});
test("both projections map near to zero and far to one", () => {
  for (const p of [
    C.perspective(1, 1.5, 0.1, 30),
    C.orthographic(5, 1.5, 0.1, 30),
  ]) {
    for (const [z, want] of [
      [-0.1, 0],
      [-30, 1],
    ]) {
      const v = M.transform(p, [0, 0, z]);
      assert.ok(Math.abs(v[2] / v[3] - want) < 1e-6);
    }
  }
  assert.throws(() => C.perspective(1, 1, 2, 1));
});
test("scene hierarchy world transform and cycle prevention", () => {
  const a = new Node("a", M.translate(1, 0, 0)),
    b = a.add(new Node("b", M.translate(0, 2, 0))),
    c = b.add(new Node("c", M.translate(0, 0, 3)));
  a.update();
  close(M.transform(c.world, [0, 0, 0]), [1, 2, 3, 1]);
  assert.throws(() => c.add(a));
});
test("Bezier endpoints, de Casteljau agreement and derivative", () => {
  const p = [
    [0, 0],
    [0.2, 0.8],
    [0.8, 0.7],
    [1, 0],
  ];
  close(Q.bezier(p, 0), p[0]);
  close(Q.bezier(p, 1), p[3]);
  for (const t of [0.1, 0.4, 0.8]) {
    close(Q.bezier(p, t), Q.casteljau(p, t).at(-1)[0]);
    const e = 1e-5;
    close(
      Q.bezierTangent(p, t),
      Q.bezier(p, t + e).map((v, i) => (v - Q.bezier(p, t - e)[i]) / (2 * e)),
      1e-5,
    );
  }
});
test("initial and edited multi-segment curve retains C1", () => {
  const p = Q.initialPoints();
  const check = () => {
    for (let k = 3; k < p.length - 1; k += 3)
      close(
        Q.bezierTangent(p.slice(k - 3, k + 1), 1),
        Q.bezierTangent(p.slice(k, k + 4), 0),
      );
  };
  check();
  Q.movePoint(p, 2, [0.4, 0.95]);
  check();
  Q.movePoint(p, 3, [0.55, 0.8]);
  check();
  Q.movePoint(p, 7, [0.87, 0.62]);
  check();
  close(Q.evaluate(p, 0), p[0]);
  close(Q.evaluate(p, 1), p.at(-1));
});
test("Catmull-Rom interpolates all knots and analytic tangent agrees", () => {
  const p = Q.initialPoints(),
    knots = p.filter((_, i) => i % 3 === 0);
  knots.forEach((k, i) =>
    close(Q.evaluate(p, i / (knots.length - 1), "catmull-rom"), k),
  );
  const t = 0.47,
    e = 1e-5;
  close(
    Q.evaluate(p, t, "catmull-rom", true),
    Q.evaluate(p, t + e, "catmull-rom").map(
      (v, i) => (v - Q.evaluate(p, t - e, "catmull-rom")[i]) / (2 * e),
    ),
    1e-5,
  );
});
test("frustum corners project to clip boundaries", () => {
  const eye = [3, 2, 6],
    target = [0, 0, 0],
    vp = M.multiply(C.perspective(1, 1.6, 0.3, 12), C.lookAt(eye, target));
  C.frustum(eye, target, 1, 1.6, 0.3, 12).forEach((p, i) => {
    const v = M.transform(vp, p),
      ndc = v.slice(0, 3).map((x) => x / v[3]);
    assert.ok(Math.abs(Math.abs(ndc[0]) - 1) < 1e-5);
    assert.ok(Math.abs(Math.abs(ndc[1]) - 1) < 1e-5);
    assert.ok(Math.abs(ndc[2] - (i < 4 ? 0 : 1)) < 1e-5);
  });
});
