import { vec3, Vec3, vec4, Vec4 } from "wgpu-matrix";
import lightShader from "./shaders/light.wgsl?raw";
import { Model, ResourceBinding } from "./model/types";

interface LightUniform {
  position: Vec4;
  color: Vec4;
}

interface LightData {
  resource: ResourceBinding;
  pipeline: GPURenderPipeline;
}

function createLight(device: GPUDevice): ResourceBinding {
  const { position, color }: LightUniform = {
    position: vec4.fromValues(-2.0, 3.0, -7.0),
    color: vec4.fromValues(1.0, 1.0, 1.0),
  };

  const dataArray = new Float32Array(position.length + color.length);
  dataArray.set(position);
  dataArray.set(color, position.length);

  const buffer = device.createBuffer({
    label: "light buffer",
    size: dataArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(buffer, 0, dataArray);

  const layout = device.createBindGroupLayout({
    label: "light bind group layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: {
          type: "uniform",
          hasDynamicOffset: false,
        },
      },
    ],
  });

  const bindGroup = device.createBindGroup({
    label: "light bind group",
    layout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer,
        },
      },
    ],
  });

  return { buffer, bindGroup, layout };
}

export function createLightRenderPipeline(
  device: GPUDevice,
  model: Model,
  camera: ResourceBinding
): LightData {
  const lightResource = createLight(device);

  const pipelineLayout = device.createPipelineLayout({
    label: "light pipeline layout",
    bindGroupLayouts: [lightResource.layout, camera.layout],
  });

  const module = device.createShaderModule({
    label: "light shader",
    code: lightShader,
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
          format: navigator.gpu.getPreferredCanvasFormat(),
        },
      ],
    },
    depthStencil: {
      format: "depth32float",
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });

  return { pipeline, resource: lightResource };
}
