shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx, cull_disabled;

uniform vec3 leaf_color : source_color = vec3(0.10, 0.22, 0.085);
uniform float wind_strength = 0.13;
uniform float wind_speed = 0.85;
uniform float translucency = 0.16;

varying float shade_variation;

void vertex() {
    vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
    float height_mask = smoothstep(0.0, 5.5, VERTEX.y + 1.2);
    float gust = sin(TIME * wind_speed + wp.x * 0.17 + wp.z * 0.11);
    gust += sin(TIME * wind_speed * 0.43 + wp.z * 0.29) * 0.45;
    VERTEX.xz += vec2(gust, gust * 0.57) * wind_strength * height_mask;
    shade_variation = fract(sin(dot(wp.xz, vec2(12.9898, 78.233))) * 43758.5453);
}

void fragment() {
    vec3 c = leaf_color * mix(0.72, 1.2, shade_variation);
    float up = clamp(NORMAL.y * 0.5 + 0.5, 0.0, 1.0);
    c *= mix(0.72, 1.08, up);
    ALBEDO = c;
    ROUGHNESS = 0.94;
    SPECULAR = 0.12;
    BACKLIGHT = c * translucency;
}
