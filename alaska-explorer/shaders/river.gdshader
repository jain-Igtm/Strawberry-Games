shader_type spatial;
render_mode blend_mix, depth_draw_always, cull_back, diffuse_burley, specular_schlick_ggx;

uniform vec3 deep_color : source_color = vec3(0.055, 0.16, 0.22);
uniform vec3 crest_color : source_color = vec3(0.34, 0.52, 0.60);
uniform float flow_speed = 0.42;

void vertex() {
	float broad = sin(VERTEX.z * 0.16 + TIME * flow_speed * 2.0);
	float fine = sin(VERTEX.x * 0.82 - VERTEX.z * 0.35 + TIME * flow_speed * 5.2);
	VERTEX.y += broad * 0.055 + fine * 0.018;
}

void fragment() {
	float band = sin(UV.y * 115.0 - TIME * flow_speed * 8.0 + UV.x * 8.0) * 0.5 + 0.5;
	float ripples = smoothstep(0.72, 0.96, band);
	ALBEDO = mix(deep_color, crest_color, ripples * 0.28 + 0.1);
	ROUGHNESS = mix(0.18, 0.34, ripples);
	METALLIC = 0.08;
	ALPHA = 0.90;
}
