extends "res://arthur_mobile/waterslide_v11.gd"

const SPLASH_ENTRY: AudioStream = preload("res://arthur_mobile/audio/splash_01.ogg")

var entry_splash: AudioStreamPlayer3D

func _add_water_audio() -> void:
	if ride_points.is_empty():
		return

	# Several quieter 3D sources along the trough make the rushing water move
	# around the listener as the first-person ride moves through the curve.
	var sample_indices := [0, int(ride_points.size() / 2), ride_points.size() - 1]
	for i in range(sample_indices.size()):
		var stream := WATER_LOOP.duplicate() as AudioStream
		if stream is AudioStreamOggVorbis:
			(stream as AudioStreamOggVorbis).loop = true
		var sound := AudioStreamPlayer3D.new()
		sound.stream = stream
		sound.autoplay = true
		sound.volume_db = -15.5 if i == 1 else -18.0
		sound.max_distance = 18.0
		sound.unit_size = 3.5
		sound.position = ride_points[int(sample_indices[i])]
		add_child(sound)

	entry_splash = AudioStreamPlayer3D.new()
	entry_splash.stream = SPLASH_ENTRY
	entry_splash.volume_db = -7.5
	entry_splash.max_distance = 19.0
	entry_splash.unit_size = 4.0
	entry_splash.position = ride_points[0]
	add_child(entry_splash)

func _on_body_entered(body: Node3D) -> void:
	if not armed or body == null or not body.has_method("begin_waterslide"):
		return
	if entry_splash != null:
		entry_splash.play()
	super._on_body_entered(body)
