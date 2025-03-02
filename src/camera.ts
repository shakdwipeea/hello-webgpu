import { mat4, Mat4, utils, vec3, Vec3, vec4 } from "wgpu-matrix";
import { ResourceBinding } from "./model/model";

export class CameraRotation {
  static direction: Vec3 = vec3.create(5, 0, 10);
  static sensitivity = 0.1;

  static init(canvas: Element): void {
    this.activate(canvas);
  }

  static activate(canvas: Element): void {
    canvas.addEventListener("click", async () => {
      await canvas.requestPointerLock({
        unadjustedMovement: true,
      });
    });

    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === canvas) {
        document.addEventListener(
          "mousemove",
          this.handleLockChange.bind(this)
        );
      } else {
        console.log("removing event listener");
        document.removeEventListener(
          "mousemove",
          this.handleLockChange.bind(this)
        );
      }
    });
  }

  static handleLockChange(event: MouseEvent): void {
    if (document.pointerLockElement === null) {
      console.warn("Pointer lock lost");
      return;
    }

    const pitch = utils.degToRad(event.movementY * this.sensitivity);
    const yaw = utils.degToRad(event.movementX * this.sensitivity);

    vec3.rotateY(this.direction, vec3.create(), -yaw, this.direction);
    vec3.rotateX(this.direction, vec3.create(), -pitch, this.direction);

    const len = vec3.length(this.direction);
    vec3.normalize(this.direction, this.direction);
    vec3.scale(this.direction, len, this.direction);

    console.log("direc", this.direction);
  }
}

export class Camera {
  eye: Vec3 = vec3.create(5, 0, 10);
  target: Vec3 = vec3.create();
  up: number[] = [0, 1, 0];
  aspect: number = window.innerWidth / window.innerHeight;
  fovy: number = Math.PI / 4;
  zNear: number = 0.1;
  zFar: number = 100;

  resourceBinding: ResourceBinding;

  constructor(canvas: Element, device: GPUDevice) {
    this.resourceBinding = this.createBindGroup(device);
    CameraRotation.init(canvas);
  }

  update(device: GPUDevice) {
    this.eye = CameraRotation.direction;

    const buffer = this.createBuffer(device);
    this.resourceBinding.buffer = buffer;
    this.resourceBinding.bindGroup = device.createBindGroup({
      layout: this.resourceBinding.layout,
      entries: [
        {
          binding: 1,
          resource: {
            buffer: buffer,
            offset: 0,
            size: buffer.size,
          },
        },
      ],
    });

    return;
  }

  updateAspectRatio(device: GPUDevice) {
    this.aspect = window.innerWidth / window.innerHeight;

    const buffer = this.createBuffer(device);
    this.resourceBinding.buffer = buffer;
    this.resourceBinding.bindGroup = device.createBindGroup({
      layout: this.resourceBinding.layout,
      entries: [
        {
          binding: 1,
          resource: {
            buffer: buffer,
            offset: 0,
            size: buffer.size,
          },
        },
      ],
    });

    return this.resourceBinding;
  }

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
    const pos = vec4.create(...this.eye, 0.0);

    const buffer = device.createBuffer({
      label: "camera uniform buffer",
      size: pos.byteLength + matrix.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(buffer, 0, pos);
    device.queue.writeBuffer(buffer, pos.byteLength, matrix);

    return buffer;
  }

  createBindGroup(device: GPUDevice): ResourceBinding {
    const buffer = this.createBuffer(device);

    const layout = device.createBindGroupLayout({
      label: "camera bind group layout",
      entries: [
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
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
          binding: 1,
          resource: {
            buffer: buffer,
            offset: 0,
            size: buffer.size,
          },
        },
      ],
    });

    return { layout, bindGroup, buffer };
  }
}
