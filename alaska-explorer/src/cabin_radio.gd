extends StaticBody3D

const CHANNELS := [
	{"frequency": "OFF", "label": "RADIO OFF", "kind": "off", "stream": "", "caption": ""},
	{"frequency": "87.9", "label": "NORTHERN WALTZ", "kind": "music", "stream": "res://audio/radio_northern_waltz.ogg", "caption": "♪ NORTHERN WALTZ\nRECORDING DATE UNKNOWN ♪"},
	{"frequency": "91.7", "label": "KILO SEVEN", "kind": "message", "stream": "res://audio/radio_kilo_seven.ogg", "caption": "KILO SEVEN: Visibility is falling.\nWe have received the same distress call for six nights.\nNo vessel is registered to that call sign."},
	{"frequency": "96.6", "label": "OPEN CARRIER", "kind": "static", "stream": "res://audio/radio_open_carrier.ogg", "caption": "— OPEN CARRIER · NO IDENTIFICATION —"},
	{"frequency": "103.1", "label": "NORTHBOUND", "kind": "message", "stream": "res://audio/radio_northbound.ogg", "caption": "UNKNOWN: Any vessel northbound, keep your cabin lights low after midnight.\nSomeone has been repeating our call sign."},
	{"frequency": "107.3", "label": "RIVER WATCH", "kind": "message", "stream": "res://audio/radio_river_watch.ogg", "caption": "RIVER WATCH: The mile-three-twelve marker is loose again.\nIt was recovered upstream this morning."},
]

var channel_index := 0
var receiver: AudioStreamPlayer3D
var display: Label3D
var dial_light: OmniLight3D
var replay_at_msec := 0
var caption_until_msec := 0

func _ready() -> void:
	add_to_group("world_interactable")
	add_to_group("radio")
	receiver = get_node_or_null("ReceiverAudio") as AudioStreamPlayer3D
	display = get_node_or_null("FrequencyDisplay") as Label3D
	dial_light = get_node_or_null("DialLight") as OmniLight3D
	if receiver != null:
		receiver.finished.connect(_on_receiver_finished)
	_apply_channel(false)

func _process(_delta: float) -> void:
	if channel_index <= 0 or receiver == null or receiver.playing:
		return
	if Time.get_ticks_msec() >= replay_at_msec:
		receiver.play()
		caption_until_msec = Time.get_ticks_msec() + _caption_duration_msec()

func get_interaction_radius() -> float:
	return 2.8

func get_interaction_prompt() -> String:
	var next_index := (channel_index + 1) % CHANNELS.size()
	var next_frequency := str(CHANNELS[next_index]["frequency"])
	return "Tune radio to %s" % next_frequency

func interact(player: Node) -> void:
	set_channel((channel_index + 1) % CHANNELS.size(), player)

func set_channel(next_index: int, player: Node = null) -> void:
	channel_index = wrapi(next_index, 0, CHANNELS.size())
	_apply_channel(true)
	if player != null and player.has_method("show_status_message"):
		if channel_index == 0:
			player.call("show_status_message", "Radio off.", 1.5)
		else:
			player.call("show_status_message", "Radio %.1f FM  ·  %s" % [float(str(CHANNELS[channel_index]["frequency"])), str(CHANNELS[channel_index]["label"])], 2.6)

func get_channel_count() -> int:
	return CHANNELS.size()

func get_frequency_text() -> String:
	return str(CHANNELS[channel_index]["frequency"])

func get_station_label() -> String:
	return str(CHANNELS[channel_index]["label"])

func is_powered() -> bool:
	return channel_index > 0

func get_broadcast_caption() -> String:
	if channel_index <= 0 or Time.get_ticks_msec() > caption_until_msec:
		return ""
	return str(CHANNELS[channel_index]["caption"])

func _apply_channel(announce_caption: bool) -> void:
	if receiver != null:
		receiver.stop()
		receiver.stream = null
	if display != null:
		display.text = "OFF" if channel_index == 0 else str(CHANNELS[channel_index]["frequency"])
		display.modulate = Color(0.38, 0.22, 0.12) if channel_index == 0 else Color(1.0, 0.60, 0.24)
	if dial_light != null:
		dial_light.light_energy = 0.0 if channel_index == 0 else 0.42
	if channel_index == 0 or receiver == null:
		caption_until_msec = 0
		return
	var stream_path := str(CHANNELS[channel_index]["stream"])
	var next_stream := load(stream_path) as AudioStream
	if next_stream == null:
		push_warning("Radio stream missing: " + stream_path)
		return
	if next_stream is AudioStreamOggVorbis:
		next_stream.loop = str(CHANNELS[channel_index]["kind"]) in ["music", "static"]
	receiver.stream = next_stream
	receiver.play()
	replay_at_msec = 0
	caption_until_msec = Time.get_ticks_msec() + (_caption_duration_msec() if announce_caption else 2200)

func _on_receiver_finished() -> void:
	replay_at_msec = Time.get_ticks_msec() + 9000

func _caption_duration_msec() -> int:
	var kind := str(CHANNELS[channel_index]["kind"])
	return 9000 if kind == "message" else 4200
