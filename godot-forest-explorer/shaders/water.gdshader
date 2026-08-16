shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_disabled, diffuse_burley, specular_schlick_ggx;

uniform vec3 shallow_color : source_color = vec3(0.07, 0.24, 0.24);
uniform vec3 deep_color : source_color = vec3(0.025, 0.105, 0.13);
uniform float opacity = 0.72;

varying vec3 world_pos;

void vertex() {
    world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
    float wave = sin(world_pos.x * 0.19 + TIME * 0.75) * 0.035;
    wave += sin(world_pos.z * 0.27 - TIME * 0.54) * 0.025;
    VERTEX.y += wave;
}

void fragment() {
    float ripple = sin(world_pos.x * 0.38 + TIME) * sin(world_pos.z * 0.31 - TIME * 0.6);
    ALBEDO = mix(deep_color, shallow_color, 0.58 + ripple * 0.08);
    METALLIC = 0.0;
    ROUGHNESS = 0.17;
    SPECULAR = 0.82;
    ALPHA = opacity;
}
