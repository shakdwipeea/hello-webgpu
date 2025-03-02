import cube from "/cube.gltf?url";
import { load } from "@loaders.gl/core";
import {
  GLTFAccessor,
  GLTFBufferView,
  GLTFLoader,
  GLTFMesh,
} from "@loaders.gl/gltf";
import { createEmptyModel, ModelData } from "./types";
import { readVec2, readVec3 } from "../data";

// redefining because looks like it is not exported
type GLTFExternalBuffer = {
  arrayBuffer: ArrayBuffer;
  byteOffset: number;
  byteLength: number;
};

function getStrideForAccessor(type: string): number {
  switch (type) {
    case "SCALAR":
      return 1;
    case "VEC2":
      return 2;
    case "VEC3":
      return 3;
    case "VEC4":
      return 4;
    default:
      console.warn("unknown accessor type", type);
      return 0;
  }
}

function readMesh(
  mesh: GLTFMesh,
  accessors: GLTFAccessor[],
  bufferViews: GLTFBufferView[],
  buffers: GLTFExternalBuffer[]
): ModelData | undefined {
  if (!mesh.primitives) return;

  if (mesh.primitives.length !== 1) {
    console.error("mesh with multiple primitives not supported", mesh);
    return;
  }

  const primitive = mesh.primitives[0];

  let modelData = createEmptyModel();

  for (const attr in primitive.attributes) {
    const accessorIndex = primitive.attributes[attr];

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

    const stride = getStrideForAccessor(accessor.type);
    const length = accessor.count * stride;

    const arrBuffer = buffers[bufferView.buffer];

    const dataBuffer = arrBuffer.arrayBuffer.slice(
      arrBuffer.byteOffset,
      arrBuffer.byteOffset + arrBuffer.byteLength
    );

    const data = new Float32Array(dataBuffer, offset, length);

    switch (attr) {
      case "POSITION":
        modelData.positions.push(...readVec3(data));
        break;
      case "NORMAL":
        modelData.normals.push(...readVec3(data));
        break;
      case "TEXCOORD_0":
        modelData.uv.push(...readVec2(data));
        break;
      default:
        console.warn(`unknown attribute ${attr} in accessor`, accessor);
        break;
    }
  }

  if (!primitive.indices) {
    console.warn("no indices found");
    return modelData;
  }

  // todo use common code to read this stuff
  const accessor = accessors[primitive.indices];
  const bufferIndex = accessor.bufferView;

  if (!bufferIndex) {
    console.warn("no buffer for indices fouind");
    return modelData;
  }

  const offset = bufferViews[bufferIndex].byteOffset;
  if (offset === undefined) {
    console.warn(`no offset found for indices`, accessor);
    return modelData;
  }

  const arrBuffer = buffers[bufferViews[bufferIndex].buffer];

  const dataBuffer = arrBuffer.arrayBuffer.slice(
    arrBuffer.byteOffset,
    arrBuffer.byteOffset + arrBuffer.byteLength
  );

  // todo really need UInt16Array?
  const indexData = new Uint16Array(dataBuffer, offset, accessor.count);
  modelData.indices.push(...indexData);

  modelData.count = modelData.indices.length;

  return modelData;
}

export async function readModel(): Promise<ModelData[]> {
  let gltfModels: ModelData[] = [];

  const glbData = await load(cube, GLTFLoader);
  console.log("loaded model is", glbData);

  const gltfData = glbData.json;
  if (
    !gltfData.meshes ||
    !gltfData.bufferViews ||
    !gltfData.accessors ||
    !gltfData.scenes
  ) {
    return gltfModels;
  }

  const bufferViews = gltfData.bufferViews;
  const accessors = gltfData.accessors;

  // const arrBuffer = glbData.buffers[0];

  // const dataBuffer = arrBuffer.arrayBuffer.slice(
  //   arrBuffer.byteOffset,
  //   arrBuffer.byteOffset + arrBuffer.byteLength
  // );

  for (let scene of gltfData.scenes) {
    if (!scene.nodes) continue;

    for (let node of scene.nodes) {
      const mesh = gltfData.meshes[node];

      const modelData = readMesh(mesh, accessors, bufferViews, glbData.buffers);
      if (!modelData) {
        console.warn("could not read model data", mesh);
        continue;
      }

      gltfModels.push(modelData);
    }
  }

  return gltfModels;
}
