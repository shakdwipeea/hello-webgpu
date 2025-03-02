import { Vec2, Vec3 } from "wgpu-matrix";

export interface RawModelData {
  vertexData: Float32Array;
  indexData: Uint16Array;
  positions: Float32Array;
  vertexCount: number;
}

export interface ModelData {
  positions: Vec3[];
  normals: Vec3[];
  uv: Vec2[];
  indices: number[];
  count: number;
}

export const ModelStride = 8;

export const createEmptyModel = (
  positions: Vec3[] = [],
  normals: Vec3[] = [],
  uv: Vec2[] = [],
  indices: number[] = [],
  count: number = indices.length
): ModelData => ({
  positions,
  normals,
  uv,
  indices,
  count,
});

export interface Model {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  drawCount: number;
  vertexLayout: GPUVertexBufferLayout;
  modelData: ModelData;
}

export interface ResourceBinding {
  buffer: GPUBuffer;
  layout: GPUBindGroupLayout;
  bindGroup: GPUBindGroup;
}
