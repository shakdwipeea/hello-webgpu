import { Mat4, Vec3, vec4, Vec4 } from "wgpu-matrix";
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

  let input = [];

  for (let i = 0; i < data.modelData.positions.length / 3; i++) {
    const verticeData = [];

    verticeData.push(...[data.numInstances, 0, 0, 0]);
    verticeData.push(
      data.modelData.positions[i * 3],
      data.modelData.positions[i * 3 + 1],
      data.modelData.positions[i * 3 + 2],
      1.0
    );

    input.push(...verticeData);
  }

  const inputArr = Float32Array.from(input);

  const dataBuffer = device.createBuffer({
    label: "work buffer",
    size: inputArr.byteLength,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(dataBuffer, 0, inputArr);

  const visibilityBufferSize = Math.ceil(data.numInstances);
  const resultStorageBuffer = device.createBuffer({
    label: "res buffer",
    size: visibilityBufferSize * Uint32Array.BYTES_PER_ELEMENT,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });

  // Initialize with zeros
  const zeros = new Uint32Array(visibilityBufferSize).fill(0);
  device.queue.writeBuffer(resultStorageBuffer, 0, zeros);

  const resultBuffer = device.createBuffer({
    label: "result buffer",
    size: visibilityBufferSize * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  const debugBufferSize = Math.ceil(
    data.numInstances * data.modelData.vertexCount * 4
  );

  const debugGpuBuffer = device.createBuffer({
    label: "debug buffer",
    size: debugBufferSize * Float32Array.BYTES_PER_ELEMENT,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });

  const debugBuffer = device.createBuffer({
    label: "debug buffer",
    size: debugBufferSize * Float32Array.BYTES_PER_ELEMENT,
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

  device.queue.writeBuffer(camBuff, 0, data.camBuffer);

  const instanceArr = [];
  for (let j = 0; j < data.numInstances; j++) {
    for (let k = 0; k < 16; k++) {
      instanceArr.push(data.modelMatrices[j * 16 + k]);
    }
  }
  const instance = Float32Array.from(instanceArr);

  const instanceBuffer = device.createBuffer({
    label: "instance buffer",
    size: instance.byteLength,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(instanceBuffer, 0, instance);

  const drawIndirectBuffer = device.createBuffer({
    label: "draw buffer",
    size: 5 * Uint32Array.BYTES_PER_ELEMENT,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST |
      GPUBufferUsage.INDIRECT,
  });

  const z = new Uint32Array(5).fill(0);
  device.queue.writeBuffer(drawIndirectBuffer, 0, z);

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
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: "storage",
        },
      },
      {
        binding: 4,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: "read-only-storage",
        },
      },
      {
        binding: 5,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: "storage",
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
      entryPoint: "main",
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
      {
        binding: 3,
        resource: {
          buffer: debugGpuBuffer,
        },
      },
      {
        binding: 4,
        resource: {
          buffer: instanceBuffer,
        },
      },
      {
        binding: 5,
        resource: {
          buffer: drawIndirectBuffer,
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
  pass.dispatchWorkgroups(4);
  pass.end();

  encoder.copyBufferToBuffer(
    resultStorageBuffer,
    0,
    resultBuffer,
    0,
    resultBuffer.size
  );

  encoder.copyBufferToBuffer(
    debugGpuBuffer,
    0,
    debugBuffer,
    0,
    debugBuffer.size
  );

  // Finish encoding and submit the commands
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);

  // Read the results
  await resultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Uint32Array(resultBuffer.getMappedRange().slice(0));
  resultBuffer.unmap();

  console.log("result", result);

  return drawIndirectBuffer;
}

export function doCulling(
  positions: Vec3[],
  view_proj: Mat4,
  modelMatrices: Mat4[]
) {
  const visibility = [];

  const v = [];

  for (
    let instanceIndex = 0;
    instanceIndex < modelMatrices.length;
    instanceIndex++
  ) {
    const t = [];
    let isInsideFrustum = false;
    for (let vertexIndex = 0; vertexIndex < positions.length; vertexIndex++) {
      const worldPos = vec4.transformMat4(
        vec4.fromValues(...positions[vertexIndex], 1.0),
        modelMatrices[instanceIndex]
      );
      const clipPos = vec4.transformMat4(worldPos, view_proj) as Vec4;

      const ndc = vec4.scale(clipPos, 1.0 / clipPos[3]);
      // visibility[vertexIndex + instanceIndex] = clipPos;
      t.push(ndc);
      if (
        ndc[0] >= -1 &&
        ndc[0] <= 1 &&
        ndc[1] >= -1 &&
        ndc[1] <= 1 &&
        ndc[2] >= -1 &&
        ndc[2] <= 1
      ) {
        isInsideFrustum = true; // Found a vertex inside!
        break; // Can stop checking other vertices
      }
    }
    v[instanceIndex] = isInsideFrustum;
    visibility.push(t);
  }

  console.log("vius", visibility);
  console.log("Res", v);
}
