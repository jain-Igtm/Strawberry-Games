shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx, cull_back;

varying vec3 world_pos;
varying vec3 world_normal;

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float value_noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void vertex() {
    world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
    world_normal = normalize(MODEL_NORMAL_MATRIX * NORMAL);
}

void fragment() {
    float slope = 1.0 - clamp(dot(normalize(world_normal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
    float macro = value_noise(world_pos.xz * 0.055);
    float micro = value_noise(world_pos.xz * 0.72);
    float grit = value_noise(world_pos.xz * 2.8);

    vec3 moss = vec3(0.105, 0.175, 0.075);
    vec3 fern = vec3(0.19, 0.255, 0.11);
    vec3 soil = vec3(0.19, 0.135, 0.085);
    vec3 stone = vec3(0.27, 0.29, 0.27);
    vec3 wet = vec3(0.075, 0.105, 0.065);

    vec3 ground = mix(moss, fern, macro * 0.42);
    ground = mix(ground, soil, COLOR.r);
    ground = mix(ground, wet, COLOR.g * 0.55);
    ground = mix(ground, stone, smoothstep(0.28, 0.72, slope));
    ground *= 0.82 + micro * 0.24 + grit * 0.055;

    ALBEDO = ground;
    ROUGHNESS = mix(0.98, 0.78, COLOR.g * 0.45);
    SPECULAR = 0.18;
}
