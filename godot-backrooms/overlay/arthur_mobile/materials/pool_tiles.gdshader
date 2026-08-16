shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform vec3 tile_color : source_color = vec3(0.62, 0.84, 0.82);
uniform vec3 grout_color : source_color = vec3(0.30, 0.43, 0.43);
uniform float tiles_per_uv = 18.0;

void fragment() {
	vec2 tiled = UV * tiles_per_uv;
	vec2 cell = floor(tiled);
	vec2 local_uv = abs(fract(tiled) - vec2(0.5));
	float edge = max(local_uv.x, local_uv.y);
	float grout = smoothstep(0.445, 0.49, edge);
	float speckle = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
	vec3 ceramic = tile_color * (0.965 + speckle * 0.06);
	ALBEDO = mix(ceramic, grout_color, grout);
	ROUGHNESS = mix(0.22, 0.74, grout);
	SPECULAR = 0.62;
}
