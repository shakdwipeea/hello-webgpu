import { ResourceBinding } from "./model/model";

interface DrawPass {
  pipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  bindGroups: GPUBindGroup[];
  drawCount: number;
}

export interface Entity {
  resource: ResourceBinding;
  pipeline: GPURenderPipeline;
  runInLoop(): void;
  getDrawPass(): DrawPass;
}
