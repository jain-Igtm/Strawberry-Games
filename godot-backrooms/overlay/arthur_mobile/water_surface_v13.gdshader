shader_type spatial;
render_mode blend_mix, depth_prepass_alpha, cull_disabled;

uniform sampler2D screen_texture : hint_screen_texture, repeat_disable, filter_linear_mipmap;
uniform sampler2D depth_texture : hint_depth_texture, repeat_disable, filter_nearest;

uniform vec4 shallow_color : source_color = vec4(0.16, 0.72, 0.76, 1.0);
uniform vec4 deep_color : source_color = vec4(0.018, 0.16, 0.22, 1.0);
uniform vec4 edge_color : source_color = vec4(0.70, 0.98, 0.94, 1.0);
uniform float refraction_strength = 0.010;
uniform float wave_height = 0.028;
uniform float depth_fade = 4.8;

varying vec3 water_world;

float linear_depth_at(vec2 uv, float depth_value) {
	vec3 ndc = vec3(uv * 2.0 - 1.0, depth_value);
	vec4 view = INV_PROJECTION_MATRIX * vec4(ndc, 1.0);
	view.xyz /= max(abs(view.w), 0.00001);
	return -view.z;
}

void vertex() {
	vec3 base_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float w1 = sin(base_world.x * 1.35 + TIME * 0.92);
	float w2 = cos(base_world.z * 1.70 - TIME * 0.71);
	float w3 = sin((base_world.x + base_world.z) * 0.72 + TIME * 0.48);
	VERTEX.y += (w1 * 0.48 + w2 * 0.34 + w3 * 0.18) * wave_height;
	water_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float p1 = sin(water_world.x * 2.05 + TIME * 1.08);
	float p2 = cos(water_world.z * 1.83 - TIME * 0.88);
	float p3 = sin((water_world.x - water_world.z) * 1.18 + TIME * 0.61);
	vec2 ripple = vec2(p2 + p3 * 0.45, p1 - p3 * 0.35) * refraction_strength;

	float scene_depth_raw = texture(depth_texture, SCREEN_UV).r;
	float scene_depth = linear_depth_at(SCREEN_UV, scene_depth_raw);
	float surface_depth = linear_depth_at(SCREEN_UV, FRAGCOORD.z);
	float thickness = max(scene_depth - surface_depth, 0.0);
	float depth_mix = smoothstep(0.18, depth_fade, thickness);

	float edge = 1.0 - smoothstep(0.06, 0.52, thickness);
	vec2 refracted_uv = clamp(SCREEN_UV + ripple * (0.45 + depth_mix * 0.65), vec2(0.002), vec2(0.998));
	vec3 behind = texture(screen_texture, refracted_uv).rgb;

	float fresnel = pow(1.0 - clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0), 3.0);
	vec3 tint = mix(shallow_color.rgb, deep_color.rgb, depth_mix);
	vec3 refracted = behind * mix(vec3(0.94, 1.04, 1.04), tint * 1.42, 0.30 + depth_mix * 0.22);

	float caustic_a = sin(water_world.x * 3.1 + sin(water_world.z * 2.4 + TIME * 1.5));
	float caustic_b = cos(water_world.z * 3.5 - sin(water_world.x * 2.1 - TIME * 1.2));
	float caustic = pow(clamp(0.5 + 0.25 * caustic_a + 0.25 * caustic_b, 0.0, 1.0), 5.0);
	caustic *= (1.0 - depth_mix) * 0.26;

	ALBEDO = mix(refracted, tint, 0.22 + depth_mix * 0.52 + fresnel * 0.16);
	ALBEDO = mix(ALBEDO, edge_color.rgb, edge * 0.42);
	EMISSION = edge_color.rgb * edge * 0.12 + shallow_color.rgb * caustic;
	ROUGHNESS = mix(0.035, 0.10, depth_mix);
	METALLIC = 0.0;
	SPECULAR = 0.92;
	ALPHA = clamp(0.68 + depth_mix * 0.20 + fresnel * 0.08, 0.0, 0.94);
}
