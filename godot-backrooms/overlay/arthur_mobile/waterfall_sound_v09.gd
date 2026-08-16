extends AudioStreamPlayer3D

var _playback: AudioStreamGeneratorPlayback
var _state: int = 0x53A91F
var _low := 0.0
var _wash_phase := 0.0

func _ready() -> void:
	var generator := AudioStreamGenerator.new()
	generator.mix_rate = 22050.0
	generator.buffer_length = 0.32
	stream = generator
	volume_db = -13.0
	max_distance = 34.0
	unit_size = 7.0
	play()
	_playback = get_stream_playback() as AudioStreamGeneratorPlayback

func _process(delta: float) -> void:
	_wash_phase += delta
	if _playback == null:
		return
	var frames: int = mini(_playback.get_frames_available(), 640)
	for _i in range(frames):
		_state = int((_state * 1103515245 + 12345) & 0x7fffffff)
		var white: float = (float(_state) / 1073741824.0) - 1.0
		_low = lerpf(_low, white, 0.055)
		var wash: float = 0.72 + sin(_wash_phase * 1.7) * 0.08 + sin(_wash_phase * 4.1) * 0.035
		var sample: float = clampf((_low * 0.72 + white * 0.16) * wash, -0.72, 0.72)
		_playback.push_frame(Vector2(sample, sample * 0.96))
