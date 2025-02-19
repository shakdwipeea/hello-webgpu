import { mat4, vec3 } from "wgpu-matrix";

export function createInstanceLayout() {
  const layout: GPUVertexBufferLayout = {
    arrayStride: 16 * Float32Array.BYTES_PER_ELEMENT,
    stepMode: "instance",
    attributes: [
      {
        offset: 0,
        shaderLocation: 3,
        format: "float32x4",
      },
      {
        offset: 4 * Float32Array.BYTES_PER_ELEMENT,
        shaderLocation: 4,
        format: "float32x4",
      },
      {
        offset: 8 * Float32Array.BYTES_PER_ELEMENT,
        shaderLocation: 5,
        format: "float32x4",
      },
      {
        offset: 12 * Float32Array.BYTES_PER_ELEMENT,
        shaderLocation: 6,
        format: "float32x4",
      },
    ],
  };

  return { layout };
}

export function createInstanceBuffer(device: GPUDevice, numInstance: number) {
  const data = new Float32Array(numInstance * 16);
  for (let i = 0; i < numInstance; i++) {
    const model = mat4.identity();
    mat4.translate(model, vec3.create(i * 4, 0, 0), model);
    data.set(model, i * model.length);
  }

  const instanceBuffer = device.createBuffer({
    label: "Vertices Buffer",
    size: data.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(instanceBuffer, 0, data);
  return { buffer: instanceBuffer, data };
}
