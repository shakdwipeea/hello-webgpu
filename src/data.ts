import { Vec2, vec2, vec3, Vec3 } from "wgpu-matrix";

/**
 * Reads a array of Vec3 from the given flat array
 * @param data flat array containing data
 * @returns data as array of Vec3
 */
function readVec3(data: Float32Array): Vec3[] {
  let vecArr = [];
  for (let index = 0; index < data.length; index += 3) {
    vecArr.push(vec3.create(data[index], data[index + 1], data[index + 2]));
  }

  return vecArr;
}

function readVec2(data: Float32Array): Vec2[] {
  let vecArr = [];
  for (let index = 0; index < data.length; index += 2) {
    vecArr.push(vec2.create(data[index], data[index + 1]));
  }
  return vecArr;
}
export { readVec3, readVec2 };
