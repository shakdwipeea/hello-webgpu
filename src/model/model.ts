import { Model, ModelData, ModelStride } from "./types";
import { readModel } from "./gltf";

export function createVertexBuffer(
  device: GPUDevice,
  data: Float32Array<ArrayBuffer>
): GPUBuffer {
  const buffer = device.createBuffer({
    label: "Vertices Buffer",
    size: data.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(buffer, 0, data);

  return buffer;
}

export function createIndexBuffer(
  device: GPUDevice,
  data: Uint16Array
): GPUBuffer {
  const indices = Uint16Array.from(data);

  const indexBuffer = device.createBuffer({
    label: "Index Buffer",
    size: data.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(indexBuffer, 0, data);

  return indexBuffer;
}

function readVertexData(data: ModelData): Float32Array<ArrayBuffer> {
  let verticesData = [];

  for (let index = 0; index < data.positions.length; index++) {
    // Position (xyz)
    verticesData.push(...data.positions[index]);

    // Normal (xyz)
    verticesData.push(...data.normals[index]);

    // UV (xy)
    verticesData.push(...data.uv[index]);
  }

  return Float32Array.from(verticesData);
}

export async function loadModel(device: GPUDevice): Promise<Model | undefined> {
  const gltfData = await readModel();

  const layout: GPUVertexBufferLayout = {
    arrayStride: 8 * Float32Array.BYTES_PER_ELEMENT,
    stepMode: "vertex",
    attributes: [
      {
        offset: 0,
        shaderLocation: 0,
        format: "float32x3",
      },
      {
        offset: 3 * Float32Array.BYTES_PER_ELEMENT,
        shaderLocation: 1,
        format: "float32x3",
      },
      {
        offset: 6 * Float32Array.BYTES_PER_ELEMENT,
        shaderLocation: 2,
        format: "float32x2",
      },
    ],
  };

  for (const model of gltfData) {
    const vertexData = readVertexData(model);
    const indexData = Uint16Array.from(model.indices);

    const vertexBuffer = createVertexBuffer(device, vertexData);
    const indexBuffer = createIndexBuffer(device, indexData);
    return {
      vertexBuffer,
      indexBuffer,
      vertexLayout: layout,
      drawCount: model.indices.length,
      modelData: model,
    };
  }
}
