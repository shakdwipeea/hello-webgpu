struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
};

struct CameraUniform {
    pos: vec4<f32>,
    view_proj: mat4x4<f32>
}

@group(2) @binding(1) var<uniform> camera: CameraUniform;  

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) position: vec3<f32>
}

struct Light {
    position: vec4<f32>,
    color: vec4<f32>
}


@vertex fn vs(model: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.uv = model.uv;
    out.clip_position = camera.view_proj * vec4<f32>(model.position, 1.0);
    out.normal = model.normal;
    out.position = model.position;
    return out;
}


@group(0) @binding(0) var tex: texture_2d<f32>;
@group(0) @binding(1) var tex_sampler: sampler;
@group(1) @binding(0) var<uniform> light: Light;

@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
    let object_color: vec4<f32> = textureSample(tex, tex_sampler, in.uv);
    let light_dir = normalize(light.position.xyz - in.position);

    let diffuse_strength = max(dot(in.normal, light_dir), 0.0);
    let diffuse_color = light.color * diffuse_strength;

    let view_dir = normalize(camera.pos.xyz - in.position);
    let half_dir = normalize(view_dir + light_dir);

    let specular_strength = pow(max(dot(in.normal, half_dir), 0.0), 32.0);
    let specular_color = specular_strength * light.color;



     // We don't need (or want) much ambient light, so 0.1 is fine
    let ambient_strength = 0.1;
    let ambient_color = light.color * ambient_strength;

    let result = (ambient_color.rgb + diffuse_color.rgb + specular_color.rgb) * object_color.xyz;

    return vec4<f32>(result, object_color.a);
}
