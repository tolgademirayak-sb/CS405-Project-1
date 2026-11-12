import * as M from "./math/mat4.js";
import * as C from "./math/camera.js";
import * as Q from "./math/curves.js";
import { Node } from "./scene/node.js";
import * as G from "./render/geometry.js";
import { createRenderer } from "./render/gpu.js";
import * as UI from "./ui/controls.js";
const $ = (id) => document.getElementById(id),
  canvas = $("scene");
const defaults = {
  tx: -1.65,
  ty: -1.13,
  tz: 1,
  rx: 0,
  ry: 25,
  rz: 0,
  sx: 0.45,
  sy: 0.45,
  sz: 0.45,
  order: "TRS",
  fov: 48,
  near: 0.1,
  far: 30,
  height: 4.8,
  yaw: 0.12,
  pitch: 0.12,
  distance: 7,
  axes: false,
  animate: true,
  curveAnimate: true,
  cast: true,
  handles: true,
  t: 0.35,
  type: "bezier",
  view: "main",
  projection: "perspective",
};
const s = { ...defaults };
let points = Q.initialPoints(),
  clock = 0,
  renderer,
  views = [],
  last = 0,
  frames = [],
  cpuFrames = [],
  measuring = null,
  latestVertices = 0;
const W = 4.8,
  H = (W * 502) / 720,
  plane = 0.025,
  rad = (d) => (d * Math.PI) / 180;
const toWorld = (p) => [(p[0] - 0.5) * W, (p[1] - 0.5) * H, plane];
const root = new Node("root"),
  base = root.add(new Node("lamp base")),
  lower = base.add(new Node("lower pivot")),
  upper = lower.add(new Node("upper pivot")),
  head = upper.add(new Node("lamp head"));
base.mesh = { shape: M.scale(0.48, 0.14, 0.48), color: [0.14, 0.22, 0.24] };
lower.mesh = {
  shape: M.compose(M.translate(0, 0.36, 0), M.scale(0.09, 0.72, 0.09)),
  color: [0.14, 0.35, 0.38],
};
upper.mesh = {
  shape: M.compose(M.translate(0, 0.32, 0), M.scale(0.08, 0.64, 0.08)),
  color: [0.35, 0.54, 0.52],
};
head.mesh = { shape: M.scale(0.38, 0.2, 0.3), color: [0.85, 0.46, 0.12] };
function setupUI() {
  const a = UI.group(
    "A / Object transformations",
    "Gold cube · column vectors · operations act right to left",
  );
  for (const [label, key, min, max, step] of [
    ["Move X", "tx", -2.5, 2.5, 0.01],
    ["Move Y", "ty", -1.5, 1.8, 0.01],
    ["Move Z", "tz", 0.1, 2.5, 0.01],
    ["Rotate X", "rx", -180, 180, 1],
    ["Rotate Y", "ry", -180, 180, 1],
    ["Rotate Z", "rz", -180, 180, 1],
    ["Scale X", "sx", 0.1, 1.5, 0.01],
    ["Scale Y", "sy", 0.1, 1.5, 0.01],
    ["Scale Z", "sz", 0.1, 1.5, 0.01],
  ])
    UI.slider(a, label, key, min, max, step, s);
  UI.select(a, "Composition", "order", ["TRS", "SRT"], s);
  const b = UI.group("B / Hierarchy");
  UI.check(b, "Animate lamp", "animate", s);
  UI.check(b, "Local axes", "axes", s);
  UI.button(b, "Verification pose", "verify-pose", () => {
    s.animate = false;
    clock = 0;
    $("animate").checked = false;
  });
  const c = UI.group("C / Camera");
  for (const args of [
    ["Vertical FOV", "fov", 20, 90, 1],
    ["Near plane", "near", 0.05, 2, 0.05],
    ["Far plane", "far", 8, 50, 1],
    ["Ortho height", "height", 2, 9, 0.1],
  ])
    UI.slider(c, ...args, s);
  const d = UI.group(
    "D / Painting curves",
    "Trace view isolates the painting. Drag round knots or square handles; Shift-click adds a C¹ segment. UV origin: bottom-left.",
  );
  UI.select(d, "Curve family", "type", ["bezier", "catmull-rom"], s);
  UI.slider(d, "Parameter t", "t", 0, 1, 0.001, s);
  UI.check(d, "Travel along curve", "curveAnimate", s);
  UI.check(d, "de Casteljau", "cast", s);
  UI.check(d, "Control polygon", "handles", s);
  UI.button(d, "Export JSON", "export", () =>
    UI.download(
      "curve.json",
      JSON.stringify(Q.exportCurve(points, s.type), null, 2),
    ),
  );
  UI.button(
    d,
    "Reset curve",
    "reset-curve",
    () => (points = Q.initialPoints()),
  );
  const e = UI.group(
    "E / Evidence & performance",
    "Frame interval is requestAnimationFrame wall time, not GPU execution time. Measure on your own computer for the report.",
  );
  UI.button(e, "Measure 5 seconds", "measure", () => {
    measuring = { start: performance.now(), values: [], cpu: [] };
    $("measure").textContent = "Measuring…";
  });
  UI.button(e, "Export measurements", "export-metrics", () =>
    UI.download(
      "performance.json",
      JSON.stringify(
        window.lab.measurement ?? { status: "No measurement yet" },
        null,
        2,
      ),
    ),
  );
}
setupUI();
$("view").onchange = (e) => (s.view = e.target.value);
$("projection").onchange = (e) => (s.projection = e.target.value);
$("reset").onclick = () => {
  Object.assign(s, defaults);
  points = Q.initialPoints();
  clock = 0;
  document.querySelector("#controls").replaceChildren();
  setupUI();
  $("view").value = s.view;
  $("projection").value = s.projection;
};
let capture = false;
$("capture").onclick = () => (capture = true);
function error(msg) {
  $("error").hidden = false;
  $("error").textContent = msg;
  console.error(msg);
}
function modelMatrices() {
  const t = M.translate(s.tx, s.ty, s.tz),
    r = M.compose(
      M.rotateZ(rad(s.rz)),
      M.rotateY(rad(s.ry)),
      M.rotateX(rad(s.rx)),
    ),
    z = M.scale(s.sx, s.sy, s.sz);
  return { trs: M.compose(t, r, z), srt: M.compose(z, r, t) };
}
function cameraState() {
  const target = [0, 0, 0.3],
    eye = C.add(target, [
      s.distance * Math.cos(s.pitch) * Math.sin(s.yaw),
      s.distance * Math.sin(s.pitch),
      s.distance * Math.cos(s.pitch) * Math.cos(s.yaw),
    ]);
  return { eye, target };
}
function viewMatrices() {
  const split = s.view === "split",
    aspect = canvas.clientWidth / (split ? 2 : 1) / canvas.clientHeight;
  const { eye, target } = cameraState();
  const p =
    s.projection === "perspective"
      ? C.perspective(rad(s.fov), aspect, s.near, s.far)
      : C.orthographic(s.height, aspect, s.near, s.far);
  let main = M.multiply(p, C.lookAt(eye, target));
  if (s.view === "trace")
    main = M.multiply(
      C.orthographic(Math.max(H + 0.7, (W + 0.7) / aspect), aspect, 0.1, 20),
      C.lookAt([0, 0, 7], [0, 0, 0]),
    );
  return {
    aspect,
    eye,
    target,
    list: split
      ? [
          main,
          M.multiply(
            C.perspective(rad(55), aspect, 0.1, 80),
            C.lookAt([10, 7, 13], [0, 0, 0]),
          ),
        ]
      : [main],
  };
}
function geometry() {
  const triangles = [],
    lines = [],
    mats = modelMatrices(),
    trace = s.view === "trace";
  G.quad(triangles, W, H, 0);
  if (!trace) {
    G.cube(
      triangles,
      M.compose(M.translate(0, -H / 2 - 0.08, 0.65), M.scale(5.5, 0.13, 2)),
      [0.14, 0.12, 0.085],
    );
    // Four frame bars, kept behind the curve plane.
    for (const x of [-W / 2 - 0.05, W / 2 + 0.05])
      G.cube(
        triangles,
        M.compose(M.translate(x, 0, -0.04), M.scale(0.1, H + 0.2, 0.12)),
        [0.3, 0.2, 0.08],
      );
    for (const y of [-H / 2 - 0.05, H / 2 + 0.05])
      G.cube(
        triangles,
        M.compose(M.translate(0, y, -0.04), M.scale(W, 0.1, 0.12)),
        [0.3, 0.2, 0.08],
      );
    G.cube(
      triangles,
      s.order === "TRS" ? mats.trs : mats.srt,
      [0.75, 0.38, 0.09],
    );
    G.cube(
      triangles,
      M.compose(
        M.translate(-0.55, -1.38, 0.9),
        M.rotateY(0.35),
        M.scale(0.65, 0.25, 0.45),
      ),
      [0.12, 0.3, 0.35],
    );
    G.cube(
      triangles,
      M.compose(
        M.translate(0.25, -1.27, 1.15),
        M.rotateZ(0.15),
        M.scale(0.3, 0.45, 0.3),
      ),
      [0.44, 0.17, 0.12],
    );
    base.local = M.translate(1.65, -1.52, 0.7);
    lower.local = M.compose(
      M.translate(0, 0.07, 0),
      M.rotateZ(s.animate ? 0.28 * Math.sin(clock) : 0),
    );
    upper.local = M.compose(
      M.translate(0, 0.72, 0),
      M.rotateZ(s.animate ? -0.45 + 0.35 * Math.sin(clock * 0.7) : 0),
    );
    head.local = M.translate(0, 0.64, 0);
    root.update();
    root.visit((n) => {
      if (n.mesh)
        G.cube(triangles, M.multiply(n.world, n.mesh.shape), n.mesh.color);
      if (s.axes) G.axes(lines, n.world);
    });
    if (s.axes) G.axes(lines, s.order === "TRS" ? mats.trs : mats.srt, 0.8);
  }
  const samples = 180;
  for (let k = 0; k < samples; k++)
    G.line(
      lines,
      toWorld(Q.evaluate(points, k / samples, s.type)),
      toWorld(Q.evaluate(points, (k + 1) / samples, s.type)),
      [1, 0.68, 0.07],
    );
  if (s.handles) {
    if (s.type === "bezier")
      for (let i = 0; i < points.length - 1; i++)
        G.line(
          lines,
          toWorld(points[i]),
          toWorld(points[i + 1]),
          [0.45, 0.55, 0.65],
        );
    points.forEach((p, i) => {
      if (s.type !== "bezier" && i % 3 !== 0) return;
      const v = toWorld(p);
      v[2] += 0.012;
      if (i % 3 === 0) {
        for (let j = 0; j < 18; j++) {
          const a = (j / 18) * Math.PI * 2,
            b = ((j + 1) / 18) * Math.PI * 2;
          G.line(
            lines,
            [v[0] + 0.042 * Math.cos(a), v[1] + 0.042 * Math.sin(a), v[2]],
            [v[0] + 0.042 * Math.cos(b), v[1] + 0.042 * Math.sin(b), v[2]],
            [1, 0.3, 0.12],
          );
        }
      } else
        G.cube(
          triangles,
          M.compose(M.translate(...v), M.scale(0.048, 0.048, 0.015)),
          [0.9, 0.9, 0.85],
        );
    });
  }
  if (s.cast && s.type === "bezier") {
    const { p, u } = Q.segment(points, s.t);
    Q.casteljau(p, u)
      .slice(1)
      .forEach((level, j) => {
        const col = [
          [0.1, 0.6, 1],
          [0.2, 1, 0.45],
          [1, 0.2, 0.5],
        ][j];
        for (let i = 0; i < level.length - 1; i++)
          G.line(
            lines,
            toWorld(level[i]).map((v, d) => (d === 2 ? v + 0.02 : v)),
            toWorld(level[i + 1]).map((v, d) => (d === 2 ? v + 0.02 : v)),
            col,
          );
        for (const p of level) {
          const w = toWorld(p);
          w[2] += 0.025;
          G.cube(triangles, M.compose(M.translate(...w), M.scale(0.025)), col);
        }
      });
  }
  const pos = toWorld(Q.evaluate(points, s.t, s.type)),
    tan = Q.evaluate(points, s.t, s.type, true),
    angle = Math.atan2(tan[1] * H, tan[0] * W),
    marker = M.compose(
      M.translate(pos[0], pos[1], plane + 0.05),
      M.rotateZ(angle),
    );
  for (const p of [
    [0.105, 0, 0],
    [-0.06, 0.045, 0],
    [-0.06, -0.045, 0],
  ])
    G.vertex(triangles, G.world(marker, p), [1, 0.8, 0.18]);
  if (s.view === "split") {
    const c = viewMatrices(),
      f = C.frustum(
        c.eye,
        c.target,
        rad(s.fov),
        c.aspect,
        s.near,
        s.far,
        s.projection === "orthographic",
        s.height,
      );
    for (let i = 0; i < 4; i++) {
      G.line(lines, f[i], f[(i + 1) % 4], [0.25, 0.65, 1]);
      G.line(lines, f[i + 4], f[4 + ((i + 1) % 4)], [0.25, 0.65, 1]);
      G.line(lines, f[i], f[i + 4], [0.25, 0.65, 1]);
    }
    G.axes(lines, M.inverseRigid(C.lookAt(c.eye, c.target)), 0.4);
  }
  return { triangles, lines, mats };
}
let drag = null;
function pointerNDC(e) {
  const r = canvas.getBoundingClientRect();
  let x = (e.clientX - r.left) / r.width;
  if (s.view === "split") {
    if (x > 0.5) return null;
    x *= 2;
  }
  return [2 * x - 1, 1 - (2 * (e.clientY - r.top)) / r.height];
}
function hitPlane(e) {
  const ndc = pointerNDC(e);
  if (!ndc) return null;
  const inv = M.inverse(viewMatrices().list[0]);
  const a = M.transform(inv, [...ndc, 0, 1]),
    b = M.transform(inv, [...ndc, 1, 1]);
  const p = a.slice(0, 3).map((v) => v / a[3]),
    q = b.slice(0, 3).map((v) => v / b[3]),
    d = C.sub(q, p);
  if (Math.abs(d[2]) < 1e-8) return null;
  const t = (plane - p[2]) / d[2];
  if (t < 0) return null;
  const w = C.add(p, C.mul(d, t));
  return [w[0] / W + 0.5, w[1] / H + 0.5];
}
canvas.onpointerdown = (e) => {
  canvas.setPointerCapture(e.pointerId);
  if (s.view === "trace") {
    const uv = hitPlane(e);
    if (!uv) return;
    if (e.shiftKey && s.type === "bezier") {
      const k = points.at(-1),
        before = points.at(-2),
        next = k.map((v, d) => 2 * v - before[d]),
        end = uv.map((v) => Math.min(1, Math.max(0, v)));
      points.push(next, Q.lerp(next, end, 0.65), end);
      return;
    }
    let best = -1,
      dist = 0.08;
    points.forEach((p, i) => {
      if (s.type !== "bezier" && i % 3 !== 0) return;
      const d = Math.hypot((p[0] - uv[0]) * W, (p[1] - uv[1]) * H);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    drag = { i: best, x: e.clientX, y: e.clientY };
  } else drag = { i: -1, x: e.clientX, y: e.clientY };
};
canvas.onpointermove = (e) => {
  if (!drag) return;
  if (s.view === "trace") {
    if (drag.i >= 0) {
      const p = hitPlane(e);
      if (p)
        Q.movePoint(
          points,
          drag.i,
          p.map((v) => Math.max(0, Math.min(1, v))),
        );
    }
  } else {
    s.yaw -= (e.clientX - drag.x) * 0.006;
    s.pitch = Math.max(
      -1.45,
      Math.min(1.45, s.pitch + (e.clientY - drag.y) * 0.006),
    );
  }
  drag.x = e.clientX;
  drag.y = e.clientY;
};
canvas.onpointerup = canvas.onpointercancel = () => (drag = null);
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    s.distance = Math.max(
      2,
      Math.min(20, s.distance * Math.exp(e.deltaY * 0.001)),
    );
  },
  { passive: false },
);
function frame(now) {
  try {
    const start = performance.now(),
      dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    if (last) {
      frames.push(now - last);
      if (frames.length > 120) frames.shift();
      if (measuring) {
        measuring.values.push(now - last);
        measuring.cpu.push(cpuFrames.at(-1) ?? 0);
      }
    }
    last = now;
    if (s.animate) clock += dt;
    if (s.curveAnimate) {
      s.t = (s.t + dt * 0.09) % 1;
      $("t").value = s.t;
      $("t").nextElementSibling.value = s.t.toFixed(3);
    }
    const g = geometry(),
      c = viewMatrices();
    views = c.list;
    latestVertices = renderer.draw(g.triangles, g.lines, views);
    cpuFrames.push(performance.now() - start);
    if (cpuFrames.length > 120) cpuFrames.shift();
    $("trs").textContent = M.fmt(g.mats.trs);
    $("srt").textContent = M.fmt(g.mats.srt);
    $("view-label").textContent =
      s.view === "split"
        ? "MAIN CAMERA / INSPECTION CAMERA"
        : s.view === "trace"
          ? "TRACE / PAINTING PLANE"
          : "MAIN CAMERA";
    $("camera-info").textContent =
      `eye: ${c.eye.map((v) => v.toFixed(3))}\ntarget: ${c.target}\nFOV: ${s.fov}° | near: ${s.near} | far: ${s.far}\n${s.view === "trace" ? "Trace uses a fixed front orthographic camera.\n" : ""}V:\n${M.fmt(C.lookAt(c.eye, c.target))}`;
    $("tree").textContent =
      "root → lamp base → lower pivot → upper pivot → lamp head\n5 nodes / 5 levels. Mesh shape transforms do not propagate to children.";
    $("leaf").textContent = M.fmt(head.world);
    const avg = frames.reduce((a, b) => a + b, 0) / (frames.length || 1);
    $("timing").textContent =
      `${avg.toFixed(2)} ms / frame · ${(1000 / avg).toFixed(0)} FPS`;
    $("vertices").textContent = `${latestVertices} vertices / frame`;
    if (measuring && now - measuring.start >= 5000) {
      const sorted = [...measuring.values].sort((a, b) => a - b);
      window.lab.measurement = {
        measuredAt: new Date().toISOString(),
        environment: "This browser and machine",
        adapter: renderer.adapter,
        userAgent: navigator.userAgent,
        view: s.view,
        projection: s.projection,
        canvas: [canvas.width, canvas.height],
        frames: sorted.length,
        meanFrameMs: sorted.reduce((a, b) => a + b, 0) / sorted.length,
        p95FrameMs: sorted[Math.floor((sorted.length - 1) * 0.95)],
        meanCpuBuildSubmitMs:
          measuring.cpu.reduce((a, b) => a + b, 0) / measuring.cpu.length,
        verticesPerFrame: latestVertices,
        note: "rAF interval includes scheduling; CPU time excludes GPU completion; not GPU timestamp profiling.",
      };
      measuring = null;
      $("measure").textContent = "Measured ✓";
    }
    if (capture) {
      capture = false;
      awaitCapture();
    }
    window.lab.ready = true;
    requestAnimationFrame(frame);
  } catch (e) {
    error(e.stack);
  }
}
function awaitCapture() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `scene-${s.view}-${s.order}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
window.lab = {
  state: s,
  get points() {
    return points;
  },
  modelMatrices,
  viewMatrices,
  geometry,
  get head() {
    return head;
  },
  ready: false,
  measurement: null,
};
try {
  renderer = await createRenderer(canvas, error);
  $("gpu").textContent =
    [
      renderer.adapter.vendor,
      renderer.adapter.architecture,
      renderer.adapter.description,
    ]
      .filter(Boolean)
      .join(" / ") || "WebGPU adapter";
  requestAnimationFrame(frame);
} catch (e) {
  error(e.message);
}
