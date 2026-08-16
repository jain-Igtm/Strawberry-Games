shader_type spatial;
render_mode cull_disabled, unshaded;

uniform vec4 body_color : source_color = vec4(0.075, 0.082, 0.076, 1.0);
uniform vec4 edge_color : source_color = vec4(0.20, 0.22, 0.18, 1.0);
uniform float seed = 0.0;

void vertex() {
	float x = UV.x * 2.0 - 1.0;
	float y = UV.y * 2.0 - 1.0;
	float flap = sin(TIME * 3.1 + seed * 6.0) * 0.13;
	VERTEX.y += abs(x) * abs(x) * flap;
	VERTEX.y += sin((x * 2.4 + y) * 3.0 + TIME * 1.15 + seed) * 0.018;
}

void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float forward = p.y + 0.12;
	float wing_width = 0.92 - abs(forward) * 0.34 - forward * forward * 0.20;
	float body = abs(p.x) - wing_width;
	float nose = length(vec2(p.x * 0.84, (p.y + 0.52) * 1.18)) - 0.72;
	float tail_cut = p.y - (0.82 - abs(p.x) * 1.95);
	if (body > 0.0 || nose > 0.14 || tail_cut > 0.0) {
		discard;
	}
	float span = abs(p.x);
	float ribs = 0.5 + 0.5 * sin(span * 29.0 + p.y * 8.0 + seed * 13.0);
	float rim = smoothstep(0.58, 0.94, span);
	vec3 color = body_color.rgb * (0.78 + ribs * 0.16);
	color += edge_color.rgb * rim * 0.12;
	ALBEDO = color;
	EMISSION = edge_color.rgb * rim * 0.035;
	ROUGHNESS = 0.84;
}
