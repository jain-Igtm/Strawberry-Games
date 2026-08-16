shader_type spatial;
render_mode cull_disabled, unshaded;

uniform vec4 edge_color : source_color = vec4(0.018, 0.025, 0.032, 1.0);
uniform vec4 inner_color : source_color = vec4(0.16, 0.19, 0.20, 1.0);
uniform float seed = 0.0;
uniform float agitation : hint_range(0.0, 2.0) = 0.75;

float hash31(vec3 p) {
	p = fract(p * 0.1031);
	p += dot(p, p.yzx + 33.33);
	return fract((p.x + p.y) * p.z);
}

float value_noise(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
	float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
	float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
	float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
	float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
	float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
	float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
	float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
	float nx00 = mix(n000, n100, f.x);
	float nx10 = mix(n010, n110, f.x);
	float nx01 = mix(n001, n101, f.x);
	float nx11 = mix(n011, n111, f.x);
	float nxy0 = mix(nx00, nx10, f.y);
	float nxy1 = mix(nx01, nx11, f.y);
	return mix(nxy0, nxy1, f.z);
}

void vertex() {
	vec3 p = VERTEX * 3.2 + vec3(seed * 7.1, TIME * 0.58, seed * 13.7);
	float n = value_noise(p) - 0.5;
	float ridge = sin(VERTEX.y * 8.0 + TIME * 1.7 + seed * 19.0) * 0.5;
	VERTEX += NORMAL * (n * 0.09 + ridge * 0.022) * agitation;
}

void fragment() {
	float grain = value_noise(vec3(UV * 10.0, TIME * 0.35 + seed * 9.0));
	float striation = 0.5 + 0.5 * sin(UV.y * 92.0 + grain * 11.0 + TIME * 2.3 + seed * 37.0);
	float pulse = 0.72 + 0.28 * sin(TIME * 4.1 + seed * 11.0 + grain * 2.0);
	vec3 base = mix(edge_color.rgb, inner_color.rgb, smoothstep(0.3, 0.9, grain));
	ALBEDO = base * (0.60 + striation * 0.40);
	EMISSION = base * (0.08 + pulse * 0.14) + vec3(0.025, 0.032, 0.04) * striation;
	ROUGHNESS = 0.38 + grain * 0.45;
}
