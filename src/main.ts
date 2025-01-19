import triangleShader from "./shaders/triangle.wgsl?raw";
import {
  createIndexBuffer,
  createVertexBuffer,
  Indices,
  loadModel,
} from "./buffers";
import { createDepthTexture, createTexture } from "./texture";
import { Camera } from "./camera";

interface RenderState {
  // Define the state of your render loop here
  descriptor: GPURenderPassDescriptor;
  device: GPUDevice;
  pipeline: GPURenderPipeline;
  context: GPUCanvasContext;
  model: Model;
  bindGroups: GPUBindGroup[];
}

function render(state: RenderState) {
  // get the current texture from the canvas and use it as the texture for the render pass
  for (let attachment of state.descriptor.colorAttachments) {
    if (attachment == null || attachment == undefined) continue;

    attachment.view = state.context.getCurrentTexture().createView();
    break;
  }

  const encoder = state.device.createCommandEncoder({
    label: "renderEncoder",
  });

  const pass = encoder.beginRenderPass(state.descriptor);

  // Draw your triangle here
  pass.setPipeline(state.pipeline);

  for (let [i, bindGroup] of state.bindGroups.entries()) {
    pass.setBindGroup(i, bindGroup);
  }

  pass.setVertexBuffer(0, state.model.vertexBuffer);
  pass.setIndexBuffer(state.model.indexBuffer, "uint16");
  pass.drawIndexed(state.model.drawCount, 1); // Assuming you have a triangle with 3 vertices
  pass.end();

  const commandBuffer = encoder.finish();
  state.device.queue.submit([commandBuffer]);

  requestAnimationFrame(() => {
    render(state);
  });
}

async function main() {
  console.log("Starting the application...");

  const gpu = navigator.gpu;
  if (!gpu) {
    console.log("No GPU available.");
    return;
  }

  const adapter = await gpu.requestAdapter({
    powerPreference: "high-performance",
  });
  if (!adapter) {
    throw new Error("No suitable GPU adapter found.");
  }

  const device = await adapter?.requestDevice();
  if (!device) {
    throw new Error("Failed to create a device.");
  }

  const canvas = document.querySelector("canvas") as HTMLCanvasElement;
  const context = canvas.getContext("webgpu");
  if (!context) {
    throw new Error("Failed to get the webgpu context.");
  }

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const canvas = entry.target as HTMLCanvasElement;
      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;

      // Set the canvas resolution to match the display size
      canvas.width = Math.max(1, Math.floor(width * window.devicePixelRatio));
      canvas.height = Math.max(1, Math.floor(height * window.devicePixelRatio));
    }
  });

  observer.observe(canvas);

  const presentationFormat = gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format: presentationFormat,
  });

  const model = await loadModel(device);
  const { texture, sampler } = await createTexture(device);

  const depthTexture = createDepthTexture(device, {
    width: canvas.width,
    height: canvas.height,
  });

  const camera = new Camera();
  const { layout, bindGroup } = camera.createBindGroup(device);

  const module = device.createShaderModule({
    label: "triangle",
    code: triangleShader,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    label: "triangleBindGroupLayout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
          multisampled: false,
          viewDimension: "2d",
          sampleType: "float",
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {
          type: "filtering",
        },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    label: "pipeline tlayout",
    bindGroupLayouts: [bindGroupLayout, layout],
  });

  const pipeline = device.createRenderPipeline({
    label: "trianglePipeline",
    layout: pipelineLayout,
    vertex: {
      module,
      buffers: [model.vertexLayout],
    },
    fragment: {
      module,
      targets: [
        {
          format: presentationFormat,
        },
      ],
    },
    depthStencil: {
      format: "depth32float",
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });

  const textureBindGroup = device.createBindGroup({
    label: "triangleBindGroup",
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: texture.createView(),
      },
      {
        binding: 1,
        resource: sampler,
      },
    ],
  });

  const renderPassDescriptor: GPURenderPassDescriptor = {
    label: "renderPass",
    colorAttachments: [
      {
        clearValue: [0.0, 0.0, 0.0, 1.0],
        loadOp: "clear",
        storeOp: "store",
        view: context.getCurrentTexture().createView(),
      },
    ],
    depthStencilAttachment: {
      view: depthTexture.texture.createView(),
      depthLoadOp: "clear",
      depthStoreOp: "store",
      depthClearValue: 1.0,
    },
  };

  requestAnimationFrame(() => {
    render({
      descriptor: renderPassDescriptor,
      device,
      pipeline,
      context,
      model,
      bindGroups: [textureBindGroup, bindGroup],
    });
  });

  console.log("Application started successfully.");
}

main();
