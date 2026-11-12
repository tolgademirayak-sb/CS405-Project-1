const shader = `
struct Camera { vp: mat4x4f };
@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var picture: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
struct Out { @builtin(position) pos: vec4f, @location(0) color: vec3f, @location(1) uv: vec2f, @location(2) tex: f32 };
@vertex fn vs(@location(0) p: vec3f,@location(1) c: vec3f,@location(2) uv: vec2f,@location(3) tex: f32)->Out {
 var o:Out; o.pos=camera.vp*vec4f(p,1);o.color=c;o.uv=uv;o.tex=tex;return o;
}
fn srgb(c:vec3f)->vec3f { return select(1.055*pow(max(c,vec3f(0)),vec3f(1.0/2.4))-.055,12.92*c,c<=vec3f(.0031308)); }
@fragment fn fs(o:Out)->@location(0) vec4f {
 let pic=textureSample(picture,samp,o.uv).rgb;
 // sRGB texture reads are linearized; canvas is unorm, so encode exactly once.
 return vec4f(srgb(mix(o.color,pic,o.tex)),1);
}`;
export async function createRenderer(canvas, onError) {
  if (!navigator.gpu)
    throw Error(
      "WebGPU unavailable. Open localhost in an updated desktop browser with hardware acceleration enabled.",
    );
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw Error("No WebGPU adapter available.");
  const device = await adapter.requestDevice();
  device.addEventListener("uncapturederror", (e) => onError(e.error.message));
  device.lost.then((i) => onError("GPU device lost: " + i.message));
  const context = canvas.getContext("webgpu"),
    format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });
  const bitmap = await createImageBitmap(
    await (await fetch("/painting.jpg")).blob(),
    { colorSpaceConversion: "none" },
  );
  const tex = device.createTexture({
    size: [bitmap.width, bitmap.height],
    format: "rgba8unorm-srgb",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture: tex },
    [bitmap.width, bitmap.height],
  );
  bitmap.close();
  const module = device.createShaderModule({ code: shader });
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter((m) => m.type === "error");
  if (errors.length) throw Error(errors.map((m) => m.message).join("\n"));
  const layout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
      },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ],
  });
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [layout],
  });
  const makePipeline = (topology) =>
    device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module,
        entryPoint: "vs",
        buffers: [
          {
            arrayStride: 36,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },
              { shaderLocation: 1, offset: 12, format: "float32x3" },
              { shaderLocation: 2, offset: 24, format: "float32x2" },
              { shaderLocation: 3, offset: 32, format: "float32" },
            ],
          },
        ],
      },
      fragment: { module, entryPoint: "fs", targets: [{ format }] },
      primitive: { topology, cullMode: "none" },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: topology === "triangle-list",
        depthCompare: "less-equal",
      },
    });
  const tri = makePipeline("triangle-list"),
    lines = makePipeline("line-list");
  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
  });
  const cameras = [0, 1].map(() => {
    const buffer = device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    return {
      buffer,
      group: device.createBindGroup({
        layout,
        entries: [
          { binding: 0, resource: { buffer } },
          { binding: 1, resource: tex.createView() },
          { binding: 2, resource: sampler },
        ],
      }),
    };
  });
  const capacity = 4 * 1024 * 1024,
    buffer = device.createBuffer({
      size: capacity,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  let depth,
    width = 0,
    height = 0;
  const adapterInfo = Object.fromEntries(
    ["vendor", "architecture", "device", "description"].map((k) => [
      k,
      adapter.info[k] ?? "",
    ]),
  );
  return {
    adapter: adapterInfo,
    device,
    draw(triangles, lineVertices, views) {
      const w = Math.max(
          1,
          Math.floor(canvas.clientWidth * Math.min(devicePixelRatio, 2)),
        ),
        h = Math.max(
          1,
          Math.floor(canvas.clientHeight * Math.min(devicePixelRatio, 2)),
        );
      if (width !== w || height !== h) {
        depth?.destroy();
        canvas.width = width = w;
        canvas.height = height = h;
        depth = device.createTexture({
          size: [w, h],
          format: "depth24plus",
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
      }
      const data = new Float32Array([...triangles, ...lineVertices]);
      if (data.byteLength > capacity)
        throw Error("Geometry exceeds vertex buffer capacity");
      device.queue.writeBuffer(buffer, 0, data);
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.033, b: 0.045, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: depth.createView(),
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      views.forEach((vp, i) => {
        device.queue.writeBuffer(cameras[i].buffer, 0, vp);
        const x = views.length === 2 ? Math.floor(w / 2) * i : 0,
          vw =
            views.length === 2
              ? i === 0
                ? Math.floor(w / 2)
                : w - Math.floor(w / 2)
              : w;
        pass.setViewport(x, 0, vw, h, 0, 1);
        pass.setScissorRect(x, 0, vw, h);
        pass.setBindGroup(0, cameras[i].group);
        pass.setVertexBuffer(0, buffer);
        pass.setPipeline(tri);
        pass.draw(triangles.length / 9);
        pass.setPipeline(lines);
        pass.draw(lineVertices.length / 9, 1, triangles.length / 9);
      });
      pass.end();
      device.queue.submit([encoder.finish()]);
      return ((triangles.length + lineVertices.length) / 9) * views.length;
    },
  };
}
