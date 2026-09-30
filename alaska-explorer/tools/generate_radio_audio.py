#!/usr/bin/env python3
"""Generate deterministic original audio beds used by Alaska Explorer."""

from __future__ import annotations

import math
import random
import struct
import sys
import wave
from pathlib import Path


SAMPLE_RATE = 22_050


def write_wave(path: Path, samples: list[float]) -> None:
    peak = max(1.0, max(abs(value) for value in samples) * 1.04)
    pcm = bytearray()
    for value in samples:
        pcm.extend(struct.pack("<h", int(max(-1.0, min(1.0, value / peak)) * 32767)))
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(pcm)


def frequency(midi_note: int) -> float:
    return 440.0 * (2.0 ** ((midi_note - 69) / 12.0))


def add_note(samples: list[float], start: float, duration: float, note: int, gain: float, color: float = 0.0) -> None:
    start_index = int(start * SAMPLE_RATE)
    count = min(int(duration * SAMPLE_RATE), len(samples) - start_index)
    base = frequency(note)
    for offset in range(max(0, count)):
        age = offset / SAMPLE_RATE
        attack = min(1.0, age / 0.018)
        release = min(1.0, max(0.0, duration - age) / 0.11)
        envelope = attack * release * math.exp(-age * (1.7 + color))
        phase = math.tau * base * age
        tone = math.sin(phase) + 0.31 * math.sin(phase * 2.01) + 0.12 * math.sin(phase * 3.98)
        samples[start_index + offset] += tone * gain * envelope


def make_waltz(path: Path) -> None:
    duration = 24.0
    samples = [0.0] * int(duration * SAMPLE_RATE)
    beat = 60.0 / 84.0
    chords = [
        (45, (57, 60, 64)),
        (40, (56, 59, 64)),
        (41, (57, 60, 65)),
        (40, (56, 59, 64)),
        (45, (57, 60, 64)),
        (43, (55, 59, 62)),
        (41, (53, 57, 60)),
        (40, (56, 59, 64)),
        (45, (57, 60, 64)),
        (48, (60, 64, 67)),
        (47, (59, 62, 67)),
    ]
    melody = [69, 72, 71, 69, 76, 74, 72, 71, 69, 67, 64, 68, 71, 74, 72, 69, 71, 68, 64, 69, 72, 76]
    bars = int(duration / (beat * 3.0))
    for bar in range(bars):
        start = bar * beat * 3.0
        bass, chord = chords[bar % len(chords)]
        add_note(samples, start, beat * 0.82, bass, 0.22, 0.4)
        for pulse in (1, 2):
            for note in chord:
                add_note(samples, start + beat * pulse, beat * 0.62, note, 0.072, 0.8)
        first = melody[(bar * 2) % len(melody)]
        second = melody[(bar * 2 + 1) % len(melody)]
        add_note(samples, start + beat * 0.10, beat * 1.26, first, 0.20, 0.15)
        add_note(samples, start + beat * 1.55, beat * 1.20, second, 0.18, 0.2)

    rng = random.Random(1948)
    previous = 0.0
    for index in range(len(samples)):
        hiss = rng.uniform(-1.0, 1.0)
        previous = previous * 0.72 + hiss * 0.28
        crackle = rng.uniform(-0.22, 0.22) if rng.random() < 0.00065 else 0.0
        flutter = 0.94 + math.sin(index / SAMPLE_RATE * math.tau * 0.83) * 0.025
        samples[index] = samples[index] * flutter + previous * 0.018 + crackle
    fade = int(SAMPLE_RATE * 0.7)
    for index in range(fade):
        samples[index] *= index / fade
        samples[-index - 1] *= index / fade
    write_wave(path, samples)


def make_open_carrier(path: Path) -> None:
    duration = 11.0
    samples = [0.0] * int(duration * SAMPLE_RATE)
    rng = random.Random(966)
    filtered = 0.0
    message_pattern = "...---...--.-.."
    pulse_length = 0.17
    for index in range(len(samples)):
        time = index / SAMPLE_RATE
        raw = rng.uniform(-1.0, 1.0)
        filtered = filtered * 0.90 + raw * 0.10
        slot = int(time / pulse_length)
        pulse = 0.0
        if slot < len(message_pattern) and message_pattern[slot] != "-":
            local = (time % pulse_length) / pulse_length
            pulse = math.sin(math.tau * 790.0 * time) * (1.0 if 0.10 < local < 0.66 else 0.0)
        elif slot < len(message_pattern):
            local = (time % pulse_length) / pulse_length
            pulse = math.sin(math.tau * 790.0 * time) * (1.0 if 0.08 < local < 0.92 else 0.0)
        fading_carrier = math.sin(math.tau * 1560.0 * time) * max(0.0, math.sin(time * 0.43)) * 0.025
        samples[index] = filtered * 0.24 + pulse * 0.11 + fading_carrier
    write_wave(path, samples)


def make_sword(path: Path) -> None:
    duration = 0.56
    samples = [0.0] * int(duration * SAMPLE_RATE)
    rng = random.Random(1307)
    filtered = 0.0
    for index in range(len(samples)):
        time = index / SAMPLE_RATE
        phase = time / duration
        noise = rng.uniform(-1.0, 1.0)
        smoothing = 0.78 - 0.35 * math.sin(phase * math.pi)
        filtered = filtered * smoothing + noise * (1.0 - smoothing)
        envelope = math.sin(phase * math.pi) ** 2.2
        blade_ring = math.sin(math.tau * (640.0 - phase * 170.0) * time) * math.exp(-time * 7.0)
        samples[index] = filtered * envelope * 0.62 + blade_ring * 0.12
    write_wave(path, samples)


def main() -> None:
    output = Path(sys.argv[1] if len(sys.argv) > 1 else "audio")
    output.mkdir(parents=True, exist_ok=True)
    make_waltz(output / "radio_northern_waltz.wav")
    make_open_carrier(output / "radio_open_carrier.wav")
    make_sword(output / "sword_swing.wav")


if __name__ == "__main__":
    main()
