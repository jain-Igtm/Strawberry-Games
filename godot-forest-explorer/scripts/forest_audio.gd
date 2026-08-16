extends AudioStreamPlayer

# Lightweight procedural soundscape. It deliberately uses no bundled audio assets,
# so the base forest still works as a self-contained seeded build.

const MIX_RATE: float = 22050.0
const BUFFER_LENGTH: float = 0.42
const TAU_F: float = PI * 2.0

@onready var player: CharacterBody3D = get_node("../Player")

var playback: AudioStreamGeneratorPlayback
var rng: RandomNumberGenerator = RandomNumberGenerator.new()
var sample_time: float = 0.0
var wind_state: float = 0.0
var wind_state_slow: float = 0.0
var step_clock: float = 0.18
var step_envelope: float = 0.0
var bird_wait: float = 3.0
var bird_age: float = 0.0
var bird_length: float = 0.0
var bird_frequency: float = 1800.0
var bird_pan: float = 0.0
var bird_phase: float = 0.0

func _ready() -> void:
    rng.seed = 824771 + 551
    var generator: AudioStreamGenerator = AudioStreamGenerator.new()
    generator.mix_rate = MIX_RATE
    generator.buffer_length = BUFFER_LENGTH
    stream = generator
    volume_db = -7.0
    play()
    playback = get_stream_playback() as AudioStreamGeneratorPlayback

func _process(_delta: float) -> void:
    if playback == null:
        return

    var planar_speed: float = Vector2(player.velocity.x, player.velocity.z).length()
    var grounded: bool = player.is_on_floor()
    var available: int = playback.get_frames_available()
    var dt: float = 1.0 / MIX_RATE

    for _i in range(available):
        sample_time += dt

        # Layered low-passed noise makes broad wind rather than hiss. The two
        # filters drift at different rates, producing slow gusts and close foliage.
        var white: float = rng.randf_range(-1.0, 1.0)
        wind_state = lerpf(wind_state, white, 0.018)
        wind_state_slow = lerpf(wind_state_slow, white, 0.0026)
        var gust: float = 0.58 + sin(sample_time * 0.17) * 0.18 + sin(sample_time * 0.047 + 1.7) * 0.20
        gust = clampf(gust, 0.12, 1.0)
        var wind: float = (wind_state * 0.25 + wind_state_slow * 0.72) * gust * 0.22

        # Soft, noise-based footfalls are mixed into the same stream. Their pace
        # follows actual movement speed and disappears immediately in the air.
        if grounded and planar_speed > 0.65:
            step_clock -= dt
            if step_clock <= 0.0:
                step_envelope = 1.0
                var cadence: float = lerpf(0.48, 0.30, clampf((planar_speed - 4.0) / 7.0, 0.0, 1.0))
                step_clock += cadence
        else:
            step_clock = minf(step_clock, 0.16)

        var foot: float = 0.0
        if step_envelope > 0.0008:
            var thump: float = sin(sample_time * TAU_F * 72.0) * 0.34
            var grit: float = white * 0.18
            foot = (thump + grit) * step_envelope * 0.24
            step_envelope *= 0.9945
        else:
            step_envelope = 0.0

        # Sparse distant calls keep the forest from sounding looped. Frequency,
        # length, pause and stereo position are seeded but varied each call.
        bird_wait -= dt
        if bird_wait <= 0.0 and bird_length <= 0.0:
            bird_age = 0.0
            bird_length = rng.randf_range(0.16, 0.42)
            bird_frequency = rng.randf_range(1450.0, 2600.0)
            bird_pan = rng.randf_range(-0.78, 0.78)
            bird_wait = rng.randf_range(5.5, 17.0)

        var bird: float = 0.0
        if bird_length > 0.0:
            bird_age += dt
            var progress: float = bird_age / bird_length
            var envelope: float = sin(clampf(progress, 0.0, 1.0) * PI)
            var glide: float = bird_frequency * (1.0 + sin(progress * PI) * 0.22)
            bird_phase = fmod(bird_phase + TAU_F * glide * dt, TAU_F)
            bird = (sin(bird_phase) + sin(bird_phase * 2.01) * 0.22) * envelope * 0.055
            if bird_age >= bird_length:
                bird_length = 0.0
                bird_age = 0.0

        var common: float = wind + foot
        var left_gain: float = sqrt(0.5 * (1.0 - bird_pan))
        var right_gain: float = sqrt(0.5 * (1.0 + bird_pan))
        var left: float = clampf(common + bird * left_gain, -0.9, 0.9)
        var right: float = clampf(common + bird * right_gain, -0.9, 0.9)
        playback.push_frame(Vector2(left, right))
