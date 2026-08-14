package com.strawberry.pitchstudio;

import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class PitchDetectorTest {
    @Test public void detectsA3FromSineWave() {
        PitchDetector detector = new PitchDetector(StudioSession.SAMPLE_RATE);
        List<Double> midi = new ArrayList<>();
        short[] chunk = new short[960];
        int total = StudioSession.SAMPLE_RATE * 2;
        for (int offset = 0; offset < total; offset += chunk.length) {
            int count = Math.min(chunk.length, total - offset);
            for (int i = 0; i < count; i++) {
                double phase = 2.0 * Math.PI * 220.0 * (offset + i) / StudioSession.SAMPLE_RATE;
                chunk[i] = (short) Math.round(Math.sin(phase) * 18_000);
            }
            detector.process(chunk, count, frame -> {
                if (frame.confidence > 0.8) midi.add(frame.midi);
            });
        }
        assertTrue("Expected stable voiced frames", midi.size() > 30);
        Collections.sort(midi);
        double median = midi.get(midi.size() / 2);
        assertTrue("A3 should be MIDI 57, got " + median, Math.abs(median - 57.0) < 0.18);
    }
}
