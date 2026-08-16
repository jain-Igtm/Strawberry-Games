shader_type spatial;
render_mode blend_mix, depth_prepass_alpha, cull_back;

uniform vec3 shallow_color : source_color = vec3(0.18, 0.62, 0.68);
uniform vec3 deep_color : source_color = vec3(0.04, 0.29, 0.39);
uniform float opacity = 0.66;

void fragment() {
	float wave_a = sin(UV.x * 72.0 + TIME * 1.35) * 0.5 + 0.5;
	float wave_b = sin(UV.y * 91.0 - TIME * 1.05 + UV.x * 17.0) * 0.5 + 0.5;
	float ripples = wave_a * wave_b;
	ALBEDO = mix(deep_color, shallow_color, 0.46 + ripples * 0.22);
	ROUGHNESS = 0.08 + ripples * 0.06;
	METALLIC = 0.03;
	SPECULAR = 0.9;
	ALPHA = opacity;
}
