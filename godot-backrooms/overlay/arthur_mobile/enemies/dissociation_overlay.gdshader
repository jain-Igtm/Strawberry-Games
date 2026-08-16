shader_type canvas_item;

uniform sampler2D screen_texture : hint_screen_texture, filter_linear;
uniform float intensity : hint_range(0.0, 1.0) = 0.0;
uniform float phase = 0.0;

void fragment() {
	vec2 p = SCREEN_UV - vec2(0.5);
	float r = length(p);
	float swirl = intensity * (0.055 + r * 0.19);
	float turn = sin(r * 15.0 + p.x * 6.0 + phase * 1.8) * swirl;
	float c = cos(turn);
	float s = sin(turn);
	vec2 warped = mat2(vec2(c, -s), vec2(s, c)) * p + vec2(0.5);
	warped = clamp(warped, vec2(0.002), vec2(0.998));

	vec2 split = SCREEN_PIXEL_SIZE * vec2(3.0, 2.0) * intensity;
	vec3 center = texture(screen_texture, warped).rgb;
	vec3 plus_sample = texture(screen_texture, clamp(warped + split, vec2(0.0), vec2(1.0))).rgb;
	vec3 minus_sample = texture(screen_texture, clamp(warped - split, vec2(0.0), vec2(1.0))).rgb;
	vec3 scene = vec3(plus_sample.r, center.g, minus_sample.b);

	float field_a = abs(sin((p.x + p.y * 0.72) * 31.0 + r * 39.0 + phase * 2.1));
	float field_b = abs(sin((p.x * 1.28 - p.y) * 24.0 - r * 27.0 - phase * 1.45));
	float impossible_edges = smoothstep(0.955, 0.998, max(field_a, field_b));
	impossible_edges *= intensity * smoothstep(0.10, 0.72, r + intensity * 0.15);

	vec3 crushed = mix(scene, scene * vec3(0.66, 0.68, 0.70), intensity * 0.28);
	crushed += vec3(0.16, 0.19, 0.20) * impossible_edges * 0.28;
	COLOR = vec4(crushed, 1.0);
}
