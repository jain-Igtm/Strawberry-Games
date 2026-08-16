shader_type canvas_item;

uniform sampler2D screen_texture : hint_screen_texture, filter_linear;
uniform float intensity : hint_range(0.0, 1.0) = 0.0;
uniform float phase = 0.0;

float line_field(vec2 p, float offset) {
	float r = length(p);
	float a = atan(p.y, p.x);
	float warped = a * (5.0 + offset * 2.0) + r * (33.0 + offset * 9.0) + sin(a * 3.0 - r * 17.0 + phase * 2.1 + offset * 7.0) * 2.4;
	float line = abs(sin(warped));
	return smoothstep(0.91, 0.995, line);
}

void fragment() {
	vec2 uv = SCREEN_UV;
	vec2 p = uv - vec2(0.5);
	float r = length(p);
	float a = atan(p.y, p.x);

	float swirl = intensity * (0.14 + 0.34 * smoothstep(0.05, 0.72, r));
	float turn = sin(phase * 1.9 + r * 14.0) * swirl + cos(a * 4.0 - phase) * swirl * 0.32;
	float c = cos(turn);
	float s = sin(turn);
	vec2 warped = mat2(vec2(c, -s), vec2(s, c)) * p;
	warped *= 1.0 - intensity * 0.09 * sin(a * 6.0 + phase * 2.7);
	vec2 sample_uv = clamp(warped + vec2(0.5), vec2(0.002), vec2(0.998));

	vec2 split = vec2(SCREEN_PIXEL_SIZE.x * 5.0, SCREEN_PIXEL_SIZE.y * 3.0) * intensity;
	vec3 scene;
	scene.r = texture(screen_texture, clamp(sample_uv + split, vec2(0.0), vec2(1.0))).r;
	scene.g = texture(screen_texture, sample_uv).g;
	scene.b = texture(screen_texture, clamp(sample_uv - split, vec2(0.0), vec2(1.0))).b;

	vec3 near_x = texture(screen_texture, clamp(sample_uv + vec2(SCREEN_PIXEL_SIZE.x * 2.0, 0.0), vec2(0.0), vec2(1.0))).rgb;
	vec3 near_y = texture(screen_texture, clamp(sample_uv + vec2(0.0, SCREEN_PIXEL_SIZE.y * 2.0), vec2(0.0), vec2(1.0))).rgb;
	float screen_edge = length(scene - near_x) + length(scene - near_y);
	float impossible_edges = max(line_field(p, 0.0), max(line_field(p * vec2(1.17, 0.83), 0.37), line_field(p.yx * vec2(-0.91, 1.23), 0.71)));
	impossible_edges *= intensity * smoothstep(0.08, 0.85, r + intensity * 0.18);

	vec3 cold_edge = vec3(0.18, 0.22, 0.24) * impossible_edges * (0.45 + screen_edge * 1.8);
	vec3 crushed = mix(scene, scene * vec3(0.58, 0.61, 0.64), intensity * 0.36);
	crushed += cold_edge;
	crushed -= vec3(impossible_edges * intensity * 0.08);
	COLOR = vec4(crushed, 1.0);
}
