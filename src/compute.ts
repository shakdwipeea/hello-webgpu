import { Mat4 } from "wgpu-matrix";
import { GltfModelData } from "./buffers";
import culling from "./shaders/culling.wgsl?raw";

interface CullingData {
  modelData: GltfModelData;
  modelMatrices: Float32Array;
  numInstances: number;
  camBuffer: Mat4;
}

export async function createComputePipeline(
  device: GPUDevice,
  data: CullingData
) {
  const module = device.createShaderModule({
    label: "compute shader",
    code: culling,
  });

  const stride = 8 * 16 * 4;
  const input = new Float32Array(
    data.numInstances * data.modelData.vertexCount * stride
  );

  for (
    let vertexIndex = 0;
    vertexIndex < data.modelData.vertexCount;
    vertexIndex++
  ) {
    for (
      let instanceIndex = 0;
      instanceIndex < data.numInstances;
      instanceIndex++
    ) {
      const baseOffset =
        ((vertexIndex * data.numInstances + instanceIndex) * stride) / 4;

      // Set numInstance as vec4 (using w as padding)
      input[baseOffset + 0] = data.numInstances;
      input[baseOffset + 1] = 0; // padding
      input[baseOffset + 2] = 0; // padding
      input[baseOffset + 3] = 0; // padding

      // Set position as vec4
      input[baseOffset + 4] = data.modelData.positions[vertexIndex * 3];
      input[baseOffset + 5] = data.modelData.positions[vertexIndex * 3 + 1];
      input[baseOffset + 6] = data.modelData.positions[vertexIndex * 3 + 2];
      input[baseOffset + 7] = 1.0; // w component

      // Set model matrix (mat4x4)
      const matrixOffset = baseOffset + 8;
      const matrixStartIdx = instanceIndex * 16;
      for (let k = 0; k < 16; k++) {
        input[matrixOffset + k] = data.modelMatrices[matrixStartIdx + k];
      }
    }
  }

  const dataBuffer = device.createBuffer({
    label: "work buffer",
    size: input.byteLength,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(dataBuffer, 0, input);

  const visibilityBufferSize = Math.ceil(data.numInstances / 32);
  const resultStorageBuffer = device.createBuffer({
    label: "res buffer",
    size: visibilityBufferSize * 4,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });

  const resultBuffer = device.createBuffer({
    label: "result buffer",
    size: visibilityBufferSize * 4,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  const camBuff = device.createBuffer({
    label: "work buffer",
    size: data.camBuffer.byteLength,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: "read-only-storage",
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: "storage",
        },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: "read-only-storage",
        },
      },
    ],
  });

  const layout = device.createPipelineLayout({
    label: "pipeline layouts",
    bindGroupLayouts: [bindGroupLayout],
  });

  const pipeline = device.createComputePipeline({
    label: "compute pipeline",
    compute: {
      module,
    },
    layout,
  });

  const bindGroup = device.createBindGroup({
    label: "bing group for data",
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: dataBuffer,
        },
      },
      {
        binding: 1,
        resource: {
          buffer: resultStorageBuffer,
        },
      },
      {
        binding: 2,
        resource: {
          buffer: camBuff,
        },
      },
    ],
  });

  const encoder = device.createCommandEncoder({
    label: "compute command encoder",
  });

  const pass = encoder.beginComputePass({
    label: "data compute pass",
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(14);
  pass.end();

  encoder.copyBufferToBuffer(
    resultStorageBuffer,
    0,
    resultBuffer,
    0,
    resultBuffer.size
  );

  // Finish encoding and submit the commands
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);

  // Read the results
  await resultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Uint32Array(resultBuffer.getMappedRange().slice());
  resultBuffer.unmap();

  console.log("result", result);
}
