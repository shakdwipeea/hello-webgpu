struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
};

struct CameraUniform {
    view_proj: mat4x4<f32>
}

@group(1) @binding(0) var<uniform> camera: CameraUniform;  

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>
}

@vertex fn vs(model: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.uv = model.uv;
    out.clip_position = camera.view_proj * vec4<f32>(model.position, 1.0);
    return out;
}

@group(0) @binding(0) var tex: texture_2d<f32>;
@group(0) @binding(1) var tex_sampler: sampler;

@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
    return textureSample(tex, tex_sampler, in.uv);
}
