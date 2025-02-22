struct Vertices {
    numInstance: vec4<f32>,
    position: vec4<f32>,
}

@group(0) @binding(0)
var<storage, read> vertices: array<Vertices>;
@group(0) @binding(1)
var<storage, read_write> data: array<atomic<u32>>;
@group(0) @binding(2)
var<storage, read> view_proj: mat4x4<f32>;
@group(0) @binding(3)
var<storage, read_write> debug: array<vec4<f32>>;

@group(0) @binding(4)
var <storage, read> model_matrix: array<mat4x4<f32>, 10>;

struct IndirectDraw {
    indexCount: u32,
    instanceCount: atomic<u32>,
    firstIndex: u32,
    baseVertex: u32,
    firstInstance: u32
}

@group(0) @binding(5)
var <storage, read_write> indirect_draw: IndirectDraw;

fn isPointInFrustum(clipPos: vec4<f32>) -> bool {
    let w = clipPos.w;
    
    // Handle zero or negative w
    if w <= 0.0 {
        return false;
    }
    
    // Convert to NDC space [-1, 1]
    let ndc = clipPos.xyz / w;
    
    // Add epsilon to handle floating point precision
    let epsilon = 0.001;
    
     // Check if point is within frustum bounds
    if ndc.x < -1.0 - epsilon || ndc.x > 1.0 + epsilon {
        return false;
    }
    if ndc.y < -1.0 - epsilon || ndc.y > 1.0 + epsilon {
        return false;
    }
    if ndc.z < -1.0 - epsilon || ndc.z > 1.0 + epsilon {
        return false;
    }

    return true;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
     // Process one vertex per thread
    let vertexIndex = id.x / 10u;
    let instanceIndex = id.x % 10u;
    
    // Early exit if beyond vertex data bounds
    if vertexIndex >= arrayLength(&vertices) {
        return;
    }

    indirect_draw.indexCount = 36u;

    let vertex = vertices[vertexIndex];
        
    // Transform to world space
    let worldPos = model_matrix[instanceIndex] * vertex.position;
        
    // Transform to clip space
    let clipPos = view_proj * worldPos;
        
    // Store debug info
    if vertexIndex * 10u + instanceIndex < arrayLength(&debug) {
        debug[vertexIndex * 10u + instanceIndex] = clipPos;
    }
        
    // If any point is visible, mark the instance as visible
    if isPointInFrustum(clipPos) {

        let result = atomicExchange(&data[instanceIndex], 1u); // Try to set counter to 1 if it's currently 0
        // if its the first time its 1, then increase instance count
        if result != 1u {
            atomicAdd(&indirect_draw.instanceCount, 1u);
        }
    }
}