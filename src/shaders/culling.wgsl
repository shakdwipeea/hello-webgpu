struct ModelMatrix {
    row_0: vec4<f32>,
    row_1: vec4<f32>,
    row_2: vec4<f32>,
    row_3: vec4<f32>
}

struct Vertices {
    numInstance: vec4<f32>,
    position: vec4<f32>,
    model_matrix: array<mat4x4<f32>, 10>,
}

@group(0) @binding(0)
var<storage, read> vertices: array<Vertices>;
@group(0) @binding(1)
var<storage, read_write> data: array<atomic<u32>>;
@group(0) @binding(2)
var<storage, read> view_proj: mat4x4<f32>;

// Check if any corner of the bounding box is visible
fn isPointInFrustum(clipPos: vec4<f32>) -> bool {
    let w = clipPos.w;
    
    // Check if point is behind near plane
    if (w <= 0.0) {
        return false;
    }
    
    // Convert to NDC space [-1, 1]
    let ndc = clipPos.xyz / w;
    
    // Add epsilon to handle floating point precision
    let epsilon = 0.001;
    
    // Early out if outside screen bounds
    if (abs(ndc.x) > 1.0 + epsilon) {
        return false;
    }
    
    if (abs(ndc.y) > 1.0 + epsilon) {
        return false;
    }
    
    // Check Z bounds last (often less important for culling)
    if (ndc.z < -1.0 - epsilon || ndc.z > 1.0 + epsilon) {
        return false;
    }
    
    return true;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
    let vertexIndex = id.x / 10u;  // 10 is number of instances
    let instanceIndex = id.x % 10u;
    
    // Early exit if beyond data bounds
    if (vertexIndex >= arrayLength(&vertices)) {
        return;
    }
    
    // Clear visibility state at the start of each instance
    if (vertexIndex == 0u) {
        let visibilityWord = instanceIndex / 32u;
        let bitPosition = instanceIndex % 32u;
        atomicAnd(&data[visibilityWord], ~(1u << bitPosition));
    }
    
    let vertex = vertices[vertexIndex];
    
    // Transform vertex to world space using instance transform
    let worldPos = vertex.model_matrix[instanceIndex] * vec4<f32>(vertex.position.xyz, 1.0);
    
    // Transform to clip space
    let clipPos = view_proj * worldPos;
    
    // Check visibility
    let isVisible = isPointInFrustum(clipPos);
    
    // Set visibility if point is visible
    if (isVisible) {
        let visibilityWord = instanceIndex / 32u;
        let bitPosition = instanceIndex % 32u;
        atomicOr(&data[visibilityWord], 1u << bitPosition);
    }
}