# Still Life / In Motion — CS405 Project 1

Painting: **Şeker Ahmed Paşa — Kavunlu Natürmort**, supplied in the course's Project1.zip. The bundled JPEG is extracted from `Project1/assets/kavunlu.js`; no artwork ownership is claimed.

## Run

Install Node.js 22.12+ (or a compatible newer release), extract this folder, and open a terminal **inside the folder containing package.json**:

```bash
npm install
npm run dev
```

Open the localhost URL printed by Vite, normally http://127.0.0.1:5173. Use a WebGPU-capable desktop browser and enable hardware acceleration. Do not double-click index.html: WebGPU requires a secure context (localhost or HTTPS) and Vite serves the modules/assets. If no adapter is available, the application displays a diagnostic instead of silently using Canvas2D or WebGL.

```bash
npm test       # numeric correctness tests
npm run build # optional production validation
```

Only Vite is a dependency. All mathematics, scene traversal and rendering are implemented locally; shaders are WGSL. No Three.js, Babylon, gl-matrix or scene-graph library.

## Controls

| Control | Effect |
|---|---|
| Main camera | Orbit scene by dragging; wheel changes distance |
| Main + inspection | Main camera at left; fixed inspection camera at right, showing the main camera's frustum |
| Trace painting | Fixed front orthographic camera; scene props hidden for precise curve editing |
| Perspective / Orthographic | Changes the main camera projection; trace view always uses a dedicated orthographic camera |
| Reset scene | Restores object transforms, camera, animation and initial curve |
| Save PNG | Downloads current canvas for evidence |
| Move / Rotate / Scale | Controls the gold cube; rotations are degrees, converted to radians internally |
| Composition | Switches TRS/SRT; both matrices are always displayed numerically |
| Animate lamp | Moves joints of the five-node hierarchy |
| Local axes | Draws red X, green Y, blue Z for every node and the controlled cube |
| Verification pose | Stops lamp motion and sets joint angles to zero, for the hand calculation |
| FOV / near / far / ortho height | Controls projection parameters |
| Curve family | Piecewise cubic Bézier or uniform Catmull–Rom through the knots |
| Parameter t | Evaluates the full piecewise curve on [0,1]; pause travel to adjust manually |
| Travel along curve | Animates triangular marker; its direction follows the analytic tangent |
| de Casteljau | Shows interpolation levels for the active Bézier segment |
| Control polygon | Shows knots and handles; in trace view drag them to edit |
| Shift-click (trace/Bézier) | Appends a segment whose starting derivative matches the prior segment |
| Export JSON | Downloads current points in normalized painting coordinates |
| Reset curve | Restores the three-segment melon contour |
| Measure 5 seconds | Captures browser frame intervals and CPU build/submit duration |
| Export measurements | Downloads actual measurements and adapter information |

## Architecture and conventions

- `src/math/mat4.js`: column-major 4×4 matrices, multiplication, transforms, transpose, rigid inverse; general inverse for picking only.
- `src/math/camera.js`: cross-product camera basis, robust lookAt, WebGPU projections and frustum corners.
- `src/math/curves.js`: cubic Bézier and analytic tangent, de Casteljau, Catmull–Rom, C1-preserving editing, JSON schema.
- `src/scene/node.js`: parent/child links, cycle guard and world-matrix traversal.
- `src/render/`: vertex construction and WebGPU resources, WGSL pipelines and draw submission.
- `src/ui/`: DOM controls and styles.
- `src/main.js`: integration, animation, pointer picking, performance and evidence capture.
- `tests/math.test.js`: numerical invariants including projection depth endpoints, inverse round trips, curve derivatives and continuity.

Column vectors: clip = P V M object. The world is right-handed; cameras look along local -Z. World +Y is up. GPU depth after perspective division is [0,1]. R = Rz Ry Rx; default model order TRS. Shape scaling lives on a mesh and does not propagate to child joints. Object model transforms are applied to submitted vertices on CPU; WGSL applies P V, mathematically equivalent to P V M. Camera matrices are uploaded without transposition as Float32Array uniforms.

The painting has width 4.8 and aspect 720/502. Normalized curve coordinates have origin at the bottom-left; world x=(u-0.5)*4.8 and y=(v-0.5)*(4.8*502/720). Curve z is offset toward the viewer by 0.025 to avoid fighting with the texture. Ray unprojection uses NDC z=0 and 1, intersects this plane, and converts back to UV. Bézier handles can extend outside the unit square when reflected to preserve C1; normalized coordinates describe a coordinate system, not forced clipping of every handle.

Input JPEG uses an sRGB texture; sampled values are linearized by texture sampling. The fragment shader encodes linear RGB once for the unorm canvas. Geometry uses flat face shading. The dynamic vertex buffer is reused; depth texture is recreated only on resize. Frustum lines are visible in both split views, with their useful external view on the right.



## AI-use

ChatGPT/Codex was asked to interpret the handout, inspect the provided demo archive and explain. Also, it assisted with helping the understanding code, debugging, testing, report formatting, and preparing the README.


## Sources

- Course handout `CS405_Project1_2026.docx` and supplied Explorer demos, received 7 November 2026.
- W3C WebGPU specification, https://www.w3.org/TR/webgpu/ (accessed 7 November 2026): resource/pipeline API and coordinate conventions.
- Local test output, screenshots, curve.json and performance.json, collected 12 November 2026.