shader_type spatial;
render_mode cull_disabled, unshaded;

uniform vec4 edge_color : source_color = vec4(0.015, 0.018, 0.022, 1.0);
uniform vec4 inner_color : source_color = vec4(0.105, 0.125, 0.13, 1.0);
uniform vec4 seam_color : source_color = vec4(0.32, 0.36, 0.35, 1.0);
uniform float seed = 0.0;
uniform float agitation : hint_range(0.0, 1.2) = 0.55;

void vertex() {
	float long_wave = sin(VERTEX.y * 5.2 + TIME * 1.15 + seed * 8.7);
	float cross_wave = sin((VERTEX.x + VERTEX.z) * 8.0 - TIME * 0.72 + seed * 4.1);
	VERTEX += NORMAL * (long_wave * 0.026 + cross_wave * 0.011) * agitation;
}

void fragment() {
	float length_band = 0.5 + 0.5 * sin(UV.y * 48.0 + seed * 17.0 + TIME * 0.62);
	float fine_band = 0.5 + 0.5 * sin(UV.y * 117.0 - UV.x * 14.0 + seed * 31.0);
	float mottled = clamp(length_band * 0.62 + fine_band * 0.38, 0.0, 1.0);
	float rim = pow(1.0 - clamp(abs(dot(normalize(NORMAL), normalize(VIEW))), 0.0, 1.0), 2.6);
	float seam = smoothstep(0.89, 0.985, fine_band) * (0.32 + rim * 0.68);
	vec3 base = mix(edge_color.rgb, inner_color.rgb, mottled * 0.72);
	ALBEDO = base;
	EMISSION = base * 0.045 + seam_color.rgb * seam * 0.18 + seam_color.rgb * rim * 0.055;
	ROUGHNESS = 0.56;
}
