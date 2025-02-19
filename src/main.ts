import triangleShader from "./shaders/triangle.wgsl?raw";
import {
  createIndexBuffer,
  createVertexBuffer,
  Indices,
  loadModel,
} from "./buffers";
import { createDepthTexture, createTexture, TextureResource } from "./texture";
import { Camera, CameraRotation } from "./camera";
import { createLightRenderPipeline } from "./lights";
import { createInstanceBuffer, createInstanceLayout } from "./instances";
import { createComputePipeline } from "./compute";

interface DrawPass {
  pipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer[];
  indexBuffer: GPUBuffer;
  bindGroups: GPUBindGroup[];
  drawCount: number;
}

interface RenderState {
  // Define the state of your render loop here
  device: GPUDevice;
  context: GPUCanvasContext;
  model: Model;
  drawPasses: DrawPass[];
  camera: Camera;
  depthTexture: TextureResource;
  instanceData: any;
}

var canvas, context, depthTexture;

function render(state: RenderState) {
  if (!context) return;

  state.camera.update(state.device);

  createComputePipeline(state.device, {
    modelData: state.model.modelData,
    modelMatrices: state.instanceData.data,
    numInstances: 10,
    camBuffer: state.camera.buildViewProjectionMatrix(),
  });

  // const depthTexture = createDepthTexture(state.device, {
  //   width: canvas.width,
  //   height: canvas.height,
  // });

  // todo need to think if this is really needed here
  // this is right now only updated when the depth texture gets updated
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

  // get the current texture from the canvas and use it as the texture for the render pass
  for (let attachment of renderPassDescriptor.colorAttachments) {
    if (attachment == null || attachment == undefined) continue;

    attachment.view = state.context.getCurrentTexture().createView();
    break;
  }

  const encoder = state.device.createCommandEncoder({
    label: "renderEncoder",
  });

  const pass = encoder.beginRenderPass(renderPassDescriptor);

  for (let {
    pipeline,
    bindGroups,
    vertexBuffer,
    indexBuffer,
    drawCount,
  } of state.drawPasses) {
    // Draw your triangle here
    pass.setPipeline(pipeline);

    const activeGroups = bindGroups.concat(
      state.camera.resourceBinding.bindGroup
    );

    for (let [i, bindGroup] of activeGroups.entries()) {
      pass.setBindGroup(i, bindGroup);
    }

    for (let [i, buffer] of vertexBuffer.entries()) {
      pass.setVertexBuffer(i, buffer);
    }

    pass.setIndexBuffer(indexBuffer, "uint16");
    pass.drawIndexed(drawCount, 10); // Assuming you have a triangle with 3 vertices
  }

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

  canvas = document.querySelector("canvas") as HTMLCanvasElement;
  context = canvas.getContext("webgpu");
  if (!context) {
    throw new Error("Failed to get the webgpu context.");
  }

  const camera = new Camera(canvas, device);

  depthTexture = createDepthTexture(device, {
    width: canvas.width,
    height: canvas.height,
  });

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const canvasT = entry.target as HTMLCanvasElement;
      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;

      // Set the canvas resolution to match the display size
      canvasT.width = Math.max(1, Math.floor(width * window.devicePixelRatio));
      canvasT.height = Math.max(
        1,
        Math.floor(height * window.devicePixelRatio)
      );

      canvas = canvasT;

      camera.updateAspectRatio(device);

      depthTexture = createDepthTexture(device, {
        width: canvas.width,
        height: canvas.height,
      });
    }
  });

  observer.observe(canvas);

  const presentationFormat = gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format: presentationFormat,
  });

  const model = await loadModel(device);
  if (!model) {
    console.error("Failed to load model");
    return;
  }

  const { texture, sampler } = await createTexture(device);
  const instances = createInstanceLayout(device);

  const lightData = createLightRenderPipeline(
    device,
    model,
    camera.resourceBinding
  );

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
    bindGroupLayouts: [
      bindGroupLayout,
      lightData.resource.layout,
      camera.resourceBinding.layout,
    ],
  });

  const pipeline = device.createRenderPipeline({
    label: "trianglePipeline",
    layout: pipelineLayout,
    vertex: {
      module,
      buffers: [model.vertexLayout, instances.layout],
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

  // const renderPassDescriptor: GPURenderPassDescriptor = {
  //   label: "renderPass",
  //   colorAttachments: [
  //     {
  //       clearValue: [0.0, 0.0, 0.0, 1.0],
  //       loadOp: "clear",
  //       storeOp: "store",
  //       view: context.getCurrentTexture().createView(),
  //     },
  //   ],
  //   depthStencilAttachment: {
  //     view: depthTexture.texture.createView(),
  //     depthLoadOp: "clear",
  //     depthStoreOp: "store",
  //     depthClearValue: 1.0,
  //   },
  // };

  const instanceData = createInstanceBuffer(device, 10);

  const drawPasses: DrawPass[] = [
    {
      pipeline,
      vertexBuffer: [model.vertexBuffer, instanceData.buffer],
      indexBuffer: model.indexBuffer,
      bindGroups: [textureBindGroup, lightData.resource.bindGroup],
      drawCount: model.drawCount,
    },
    {
      pipeline: lightData.pipeline,
      vertexBuffer: [model.vertexBuffer],
      indexBuffer: model.indexBuffer,
      bindGroups: [lightData.resource.bindGroup],
      drawCount: model.drawCount,
    },
  ];

  createComputePipeline(device, {
    modelData: model.modelData,
    modelMatrices: instanceData.data,
    numInstances: 10,
    camBuffer: camera.buildViewProjectionMatrix(),
  });

  requestAnimationFrame(() => {
    render({
      device,
      drawPasses,
      context,
      model,
      camera,
      depthTexture,
      instanceData,
    });
  });

  console.log("Application started successfully.");
}

main();
