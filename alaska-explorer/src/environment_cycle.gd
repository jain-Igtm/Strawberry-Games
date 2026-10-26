extends Node

@export var day_length_seconds := 840.0

const WEATHER := [
	{"name": "CLEAR", "snow": 0.0, "fog": 0.0028, "wind": 0.25, "air": -16.0, "chill": -20.0},
	{"name": "FLURRIES", "snow": 0.34, "fog": 0.0046, "wind": 0.42, "air": -18.0, "chill": -24.0},
	{"name": "STEADY SNOW", "snow": 0.68, "fog": 0.0075, "wind": 0.58, "air": -20.0, "chill": -27.0},
	{"name": "SQUALL", "snow": 1.0, "fog": 0.0130, "wind": 1.0, "air": -23.0, "chill": -33.0},
	{"name": "OVERCAST", "snow": 0.10, "fog": 0.0056, "wind": 0.50, "air": -19.0, "chill": -25.0},
]

var world_environment: WorldEnvironment
var environment: Environment
var sky_material: ProceduralSkyMaterial
var sun: DirectionalLight3D
var moon: DirectionalLight3D
var snowfall: GPUParticles3D

var time_of_day := 10.25
var weather_index := 1
var weather_elapsed := 0.0
var weather_duration := 92.0
var daylight := 0.55
var rng := RandomNumberGenerator.new()

func _ready() -> void:
	rng.seed = 904221

func configure(next_environment: WorldEnvironment, next_sun: DirectionalLight3D, next_snowfall: GPUParticles3D) -> void:
	world_environment = next_environment
	sun = next_sun
	snowfall = next_snowfall
	environment = world_environment.environment if world_environment != null else null
	if environment != null and environment.sky != null:
		sky_material = environment.sky.sky_material as ProceduralSkyMaterial
	if sun != null and sun.get_parent() != null:
		moon = DirectionalLight3D.new()
		moon.name = "WinterMoon"
		moon.light_color = Color(0.48, 0.60, 0.82)
		moon.light_energy = 0.0
		moon.shadow_enabled = true
		moon.directional_shadow_max_distance = 130.0
		sun.get_parent().add_child(moon)
	_apply_environment()

func _process(delta: float) -> void:
	time_of_day = fmod(time_of_day + delta * 24.0 / maxf(day_length_seconds, 1.0), 24.0)
	weather_elapsed += delta
	if weather_elapsed >= weather_duration:
		weather_elapsed = 0.0
		var step := rng.randi_range(1, WEATHER.size() - 1)
		weather_index = (weather_index + step) % WEATHER.size()
		weather_duration = rng.randf_range(78.0, 132.0)
	_apply_environment()

func _apply_environment() -> void:
	var sunrise := 7.75
	var sunset := 15.75
	var progress := clampf((time_of_day - sunrise) / (sunset - sunrise), 0.0, 1.0)
	var in_day := time_of_day >= sunrise and time_of_day <= sunset
	daylight = sin(progress * PI) if in_day else 0.0
	var twilight_morning := clampf(1.0 - absf(time_of_day - sunrise) / 1.2, 0.0, 1.0)
	var twilight_evening := clampf(1.0 - absf(time_of_day - sunset) / 1.2, 0.0, 1.0)
	var twilight := maxf(twilight_morning, twilight_evening)
	var state: Dictionary = WEATHER[weather_index]
	var snow_strength := float(state["snow"])
	var storm_dim := snow_strength * 0.30

	if sun != null:
		var elevation := 3.0 + sin(progress * PI) * 21.0 if in_day else -14.0
		var azimuth := -72.0 + progress * 144.0
		sun.rotation_degrees = Vector3(-elevation, azimuth, 0.0)
		sun.light_energy = maxf(0.0, (0.16 + daylight * 0.98) * (1.0 - storm_dim)) if in_day else 0.0
		sun.light_color = Color(1.0, 0.71 + daylight * 0.13, 0.54 + daylight * 0.20)
		sun.visible = in_day

	if moon != null:
		moon.rotation_degrees = Vector3(-38.0, 118.0, 0.0)
		moon.light_energy = (0.20 + storm_dim * 0.05) * (1.0 - daylight)
		moon.visible = not in_day or daylight < 0.12

	if environment != null:
		environment.ambient_light_energy = lerpf(0.16, 0.72, daylight) * (1.0 - storm_dim * 0.55) + twilight * 0.07
		environment.fog_density = float(state["fog"]) + (1.0 - daylight) * 0.0012
		environment.fog_light_energy = lerpf(0.26, 0.76, daylight)
		environment.fog_light_color = Color(0.23, 0.30, 0.40).lerp(Color(0.58, 0.64, 0.68), daylight)

	if sky_material != null:
		var night_top := Color(0.012, 0.025, 0.060)
		var day_top := Color(0.085, 0.13, 0.20)
		var night_horizon := Color(0.10, 0.14, 0.22)
		var day_horizon := Color(0.50, 0.56, 0.61)
		var dawn_horizon := Color(0.68, 0.35, 0.25)
		sky_material.sky_top_color = night_top.lerp(day_top, daylight)
		sky_material.sky_horizon_color = night_horizon.lerp(day_horizon, daylight).lerp(dawn_horizon, twilight * 0.34)
		sky_material.ground_bottom_color = Color(0.018, 0.028, 0.045).lerp(Color(0.075, 0.10, 0.13), daylight)
		sky_material.ground_horizon_color = Color(0.09, 0.12, 0.17).lerp(Color(0.46, 0.51, 0.54), daylight)

	if snowfall != null:
		snowfall.emitting = snow_strength > 0.04
		snowfall.amount = maxi(120, roundi(1250.0 * maxf(snow_strength, 0.10)))
		var process_material := snowfall.process_material as ParticleProcessMaterial
		if process_material != null:
			var wind := float(state["wind"])
			process_material.direction = Vector3(0.12 + wind * 0.58, -1.0, 0.05 + wind * 0.20).normalized()
			process_material.initial_velocity_min = 2.2 + wind * 2.2
			process_material.initial_velocity_max = 4.0 + wind * 4.1
			process_material.gravity = Vector3(0.45 + wind * 1.7, -0.62, 0.18 + wind * 0.55)

func get_weather_name() -> String:
	return str(WEATHER[weather_index]["name"])

func get_time_string() -> String:
	var hour := int(floor(time_of_day))
	var minute := int(floor((time_of_day - float(hour)) * 60.0))
	return "%02d:%02d" % [hour, minute]

func get_air_temperature() -> float:
	var state: Dictionary = WEATHER[weather_index]
	return float(state["air"]) - (1.0 - daylight) * 2.5

func get_wind_chill() -> float:
	var state: Dictionary = WEATHER[weather_index]
	return float(state["chill"]) - (1.0 - daylight) * 2.0

func get_wind_volume_db(sheltered: bool) -> float:
	var state: Dictionary = WEATHER[weather_index]
	var outside := lerpf(4.0, 11.0, float(state["wind"]))
	return outside - 10.0 if sheltered else outside
