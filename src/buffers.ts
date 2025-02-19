import { vec2, vec3 } from "wgpu-matrix";
import cube from "/cube.gltf?url";
import { load } from "@loaders.gl/core";
import { GLTFLoader } from "@loaders.gl/gltf";

export const Vertices = [
  {
    pos: vec3.fromValues(-0.0868241, 0.49240386, 0.0),
    uv: vec2.fromValues(0.4131759, 0.99240386), // A
  },
  {
    pos: vec3.fromValues(-0.49513406, 0.06958647, 0.0),
    uv: vec2.fromValues(0.0048659444, 0.56958647), // B
  },
  {
    pos: vec3.fromValues(-0.21918549, -0.44939706, 0.0),
    uv: vec2.fromValues(0.28081453, 0.05060294), // C
  },
  {
    pos: vec3.fromValues(0.35966998, -0.3473291, 0.0),
    uv: vec2.fromValues(0.85967, 0.1526709), // D
  },
  {
    pos: vec3.fromValues(0.44147372, 0.2347359, 0.0),
    uv: vec2.fromValues(0.9414737, 0.7347359), // E
  },
];

export const Indices: number[] = [0, 1, 4, 1, 2, 4, 2, 3, 4];

export interface GltfModelData {
  vertexData: Float32Array;
  indexData: Uint16Array;
  positions: Float32Array;
  vertexCount: number;
}

export interface Model {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  drawCount: number;
  vertexLayout: GPUVertexBufferLayout;
  modelData: GltfModelData;
}

export interface ResourceBinding {
  buffer: GPUBuffer;
  layout: GPUBindGroupLayout;
  bindGroup: GPUBindGroup;
}

async function readModel(): Promise<GltfModelData[]> {
  let gltfModels: GltfModelData[] = [];

  const glbData = await load(cube, GLTFLoader);
  console.log("loaded model is", glbData);

  const gltfData = glbData.json;
  if (!gltfData.meshes || !gltfData.bufferViews || !gltfData.accessors) {
    return gltfModels;
  }

  const bufferViews = gltfData.bufferViews;
  const accessors = gltfData.accessors;

  const arrBuffer = glbData.buffers[0];

  const dataBuffer = arrBuffer.arrayBuffer.slice(
    arrBuffer.byteOffset,
    arrBuffer.byteOffset + arrBuffer.byteLength
  );

  for (let mesh of gltfData.meshes) {
    for (let primitive of mesh.primitives) {
      const attributeOrder = ["POSITION", "NORMAL", "TEXCOORD_0"];

      let attrsData: Float32Array[] = [];
      let totalDataLength = 0;

      for (let attr of attributeOrder) {
        const accessorIndex = primitive.attributes[attr];
        console.log("buffer index is", accessorIndex);

        const accessor = accessors[accessorIndex];
        const bufferIndex = accessor.bufferView;

        if (bufferIndex === undefined) {
          console.warn(
            `no buffer index found for accessor ${accessorIndex} in 
            accessor`,
            accessor
          );
          continue;
        }

        const bufferView = bufferViews[bufferIndex];
        const offset = bufferView.byteOffset ?? 0;

        const length = accessor.count * (attr === "TEXCOORD_0" ? 2 : 3);

        // Create a properly sized view into the buffer
        const data = new Float32Array(
          dataBuffer,
          offset,
          length // Explicitly set the length based on accessor count and components
        );

        attrsData.push(data);
        totalDataLength += length;
      }

      if (primitive.indices == undefined) break;

      const accessor = accessors[primitive.indices];
      const bufferIndex = accessor.bufferView;

      if (bufferIndex === undefined) {
        console.warn(`no buffer index found for indices`, accessor);
        break;
      }

      const offset = bufferViews[bufferIndex].byteOffset;
      if (offset === undefined) {
        console.warn(`no offset found for indices`, accessor);
        break;
      }

      // Create interleaved vertex data
      const vertexCount = attrsData[0].length / 3; // Number of vertices (POSITION length / 3)
      const stride = 8; // position(3) + normal(3) + uv(2) = 8 floats per vertex
      const vertexData = new Float32Array(vertexCount * stride);
      const positions = new Float32Array(vertexCount * 3);

      for (let i = 0; i < vertexCount; i++) {
        // Position (3 floats)

        positions[i * 3] = attrsData[0][i * 3 + 0];
        positions[i * 3 + 1] = attrsData[0][i * 3 + 1];
        positions[i * 3 + 2] = attrsData[0][i * 3 + 2];

        // todo use a local variable of sth..smh
        vertexData[i * stride + 0] = attrsData[0][i * 3 + 0];
        vertexData[i * stride + 1] = attrsData[0][i * 3 + 1];
        vertexData[i * stride + 2] = attrsData[0][i * 3 + 2];

        // Normal (3 floats)
        vertexData[i * stride + 3] = attrsData[1][i * 3 + 0];
        vertexData[i * stride + 4] = attrsData[1][i * 3 + 1];
        vertexData[i * stride + 5] = attrsData[1][i * 3 + 2];

        // UV (2 floats)
        vertexData[i * stride + 6] = attrsData[2][i * 2 + 0];
        vertexData[i * stride + 7] = attrsData[2][i * 2 + 1];
      }

      // Create the index buffer directly from the arraybuffer
      const indexData = new Uint16Array(dataBuffer, offset, accessor.count);

      gltfModels.push({
        vertexData,
        indexData,
        positions,
        vertexCount,
      });
    }
  }
  return gltfModels;
}

export function createVertexBuffer(
  device: GPUDevice,
  data: Float32Array
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
    size: indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(indexBuffer, 0, indices);

  return indexBuffer;
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
    const vertexData = model.vertexData;
    const indexData = model.indexData;

    const vertexBuffer = createVertexBuffer(device, vertexData);
    const indexBuffer = createIndexBuffer(device, indexData);

    return {
      vertexBuffer,
      indexBuffer,
      vertexLayout: layout,
      drawCount: model.indexData.length,
      modelData: model,
    };
  }
}
