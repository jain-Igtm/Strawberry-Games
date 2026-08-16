shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

varying vec3 local_pos;
varying vec3 world_pos;

float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

void vertex() {
    local_pos = VERTEX;
    world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
    float grooves = pow(abs(sin(local_pos.y * 5.2 + sin(local_pos.y * 0.73) * 1.6)), 9.0);
    float knots = hash21(floor(world_pos.xz * 2.1 + local_pos.yy * 0.1));
    vec3 dark_bark = vec3(0.095, 0.055, 0.032);
    vec3 light_bark = vec3(0.205, 0.125, 0.064);
    vec3 c = mix(dark_bark, light_bark, 0.38 + knots * 0.32);
    c *= 1.0 - grooves * 0.38;
    ALBEDO = c;
    ROUGHNESS = 0.98;
    SPECULAR = 0.08;
}
