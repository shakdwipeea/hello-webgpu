import cube from "/cube-diffuse.jpg";

export interface TextureResource {
  texture: GPUTexture;
  sampler: GPUSampler;
}

async function loadImage(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const image = await createImageBitmap(blob, { colorSpaceConversion: "none" });
  return image;
}

export async function createTexture(
  device: GPUDevice
): Promise<TextureResource> {
  const imgSource = await loadImage(cube);

  const texture = device.createTexture({
    size: [imgSource.width, imgSource.height],
    format: "rgba8unorm-srgb",
    dimension: "2d",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: imgSource, flipY: true },
    { texture },
    { width: imgSource.width, height: imgSource.height }
  );

  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "nearest",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    mipmapFilter: "nearest",
  });

  return { texture, sampler };
}

export function createDepthTexture(
  device: GPUDevice,
  { width = 1024, height = 1024 }
): TextureResource {
  const depthTexture = device.createTexture({
    size: { width, height, depthOrArrayLayers: 1 },
    mipLevelCount: 1,
    sampleCount: 1,
    format: "depth32float",
    dimension: "2d",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    mipmapFilter: "nearest",
    compare: "less-equal",
    lodMinClamp: 0.0,
    lodMaxClamp: 100.0,
  });

  return { texture: depthTexture, sampler };
}
