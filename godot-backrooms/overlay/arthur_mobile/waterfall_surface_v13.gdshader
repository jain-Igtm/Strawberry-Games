shader_type spatial;
render_mode blend_mix, depth_prepass_alpha, cull_disabled;

uniform sampler2D screen_texture : hint_screen_texture, repeat_disable, filter_linear_mipmap;
uniform vec4 water_color : source_color = vec4(0.42, 0.88, 0.92, 1.0);
uniform vec4 foam_color : source_color = vec4(0.90, 1.0, 0.98, 1.0);
uniform float distortion_strength = 0.010;

varying vec3 flow_world;

void vertex() {
	flow_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float streak_a = sin(flow_world.x * 5.2 + flow_world.y * 1.4 - TIME * 5.8);
	float streak_b = sin(flow_world.x * 9.4 - flow_world.y * 2.0 - TIME * 8.2);
	float streak = clamp(0.50 + streak_a * 0.24 + streak_b * 0.15, 0.0, 1.0);
	float foam = smoothstep(0.68, 0.96, streak);
	vec2 distort = vec2(streak_a, streak_b) * distortion_strength;
	vec3 behind = texture(screen_texture, clamp(SCREEN_UV + distort, vec2(0.002), vec2(0.998))).rgb;
	vec3 base = mix(behind * vec3(0.83, 1.02, 1.05), water_color.rgb, 0.46);
	ALBEDO = mix(base, foam_color.rgb, foam * 0.52);
	EMISSION = foam_color.rgb * foam * 0.10;
	ROUGHNESS = 0.045;
	SPECULAR = 0.90;
	ALPHA = 0.60 + foam * 0.16;
}
