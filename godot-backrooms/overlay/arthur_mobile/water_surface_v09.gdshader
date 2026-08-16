shader_type spatial;
render_mode blend_mix, depth_draw_alpha_prepass, cull_back;

uniform vec4 shallow_color : source_color = vec4(0.12, 0.62, 0.70, 0.58);
uniform vec4 deep_color : source_color = vec4(0.025, 0.19, 0.28, 0.72);
uniform float ripple_scale = 1.7;
uniform float ripple_height = 0.045;

void vertex() {
	float a = sin((VERTEX.x + TIME * 0.55) * ripple_scale);
	float b = cos((VERTEX.z - TIME * 0.43) * (ripple_scale * 1.31));
	float c = sin((VERTEX.x + VERTEX.z + TIME * 0.31) * (ripple_scale * 0.73));
	VERTEX.y += (a + b * 0.65 + c * 0.45) * ripple_height;
}

void fragment() {
	float wave = sin((VERTEX.x + VERTEX.z * 0.63 + TIME * 0.35) * 0.8) * 0.5 + 0.5;
	vec3 water = mix(deep_color.rgb, shallow_color.rgb, 0.42 + wave * 0.18);
	ALBEDO = water;
	ROUGHNESS = 0.08;
	METALLIC = 0.18;
	EMISSION = water * 0.055;
	ALPHA = mix(deep_color.a, shallow_color.a, 0.48);
}
