import { mat4, Mat4 } from "wgpu-matrix";

export class Camera {
  eye: Vec3Arg = [5, 5, 10];
  target: Vec3Arg = [0, 0, 0];
  up: Vec3Arg = [0, 1, 0];
  aspect: number = window.innerWidth / window.innerHeight;
  fovy: number = Math.PI / 4;
  zNear: number = 0.1;
  zFar: number = 100;

  buildViewProjectionMatrix(): Mat4 {
    const view = mat4.lookAt(this.eye, this.target, this.up);
    const projection = mat4.perspective(
      this.fovy,
      this.aspect,
      this.zNear,
      this.zFar
    );

    return mat4.multiply(projection, view);
  }

  createBuffer(device: GPUDevice): GPUBuffer {
    const matrix = this.buildViewProjectionMatrix();

    const buffer = device.createBuffer({
      label: "camera uniform buffer",
      size: matrix.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(buffer, 0, matrix);

    return buffer;
  }

  createBindGroup(device: GPUDevice) {
    const buffer = this.createBuffer(device);

    const layout = device.createBindGroupLayout({
      label: "camera bind group layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: "uniform",
          },
        },
      ],
    });

    const bindGroup = device.createBindGroup({
      layout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.createBuffer(device),
            offset: 0,
            size: buffer.size,
          },
        },
      ],
    });

    return { layout, bindGroup, buffer };
  }
}
