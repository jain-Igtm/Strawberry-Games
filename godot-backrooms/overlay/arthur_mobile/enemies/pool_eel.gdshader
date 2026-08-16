shader_type spatial;
render_mode cull_back, unshaded;

uniform vec4 deep_color : source_color = vec4(0.055, 0.095, 0.085, 1.0);
uniform vec4 scale_color : source_color = vec4(0.23, 0.30, 0.25, 1.0);
uniform float seed = 0.0;

void vertex() {
	float along = VERTEX.y;
	float wave = sin(along * 4.8 + TIME * 3.0 + seed * 5.0);
	float wave2 = sin(along * 7.4 - TIME * 1.65 + seed * 2.0);
	VERTEX.x += wave * 0.10 + wave2 * 0.022;
	VERTEX.z += cos(along * 3.3 + TIME * 2.2 + seed) * 0.035;
}

void fragment() {
	float scales = 0.5 + 0.5 * sin(UV.y * 74.0 + sin(UV.x * 22.0 + seed) * 2.2);
	float back = smoothstep(0.18, 0.80, abs(UV.x - 0.5) * 2.0);
	vec3 color = mix(deep_color.rgb, scale_color.rgb, scales * 0.22 + back * 0.12);
	ALBEDO = color;
	EMISSION = scale_color.rgb * smoothstep(0.94, 1.0, scales) * 0.025;
	ROUGHNESS = 0.58;
}
