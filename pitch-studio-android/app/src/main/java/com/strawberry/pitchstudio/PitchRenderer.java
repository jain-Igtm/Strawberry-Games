package com.strawberry.pitchstudio;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.EOFException;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;

/**
 * A deliberately conservative, offline granular renderer. It keeps the recording length fixed,
 * smooths each note transition using Tune Time, and blends the requested correction using Depth.
 * It is useful for proofing edits without pretending to be a phase-coherent commercial vocal DSP.
 */
final class PitchRenderer {
    interface Progress {
        void onProgress(int percent);
    }

    private static final int GRAIN = 1024;
    private static final int HOP = 256;

    static void render(File inputPcm, File outputPcm, StudioSession session, Progress progress)
            throws Exception {
        long sampleCountLong = inputPcm.length() / 2;
        if (sampleCountLong > Integer.MAX_VALUE - 8) throw new IllegalArgumentException("Recording is too long to render");
        int sampleCount = (int) sampleCountLong;
        short[] input = new short[sampleCount];
        try (BufferedInputStream in = new BufferedInputStream(new FileInputStream(inputPcm), 64 * 1024)) {
            for (int i = 0; i < sampleCount; i++) {
                int lo = in.read();
                int hi = in.read();
                if (hi < 0) throw new EOFException();
                input[i] = (short) ((hi << 8) | lo);
            }
        }

        float[] output = new float[sampleCount];
        double ratio = 1.0;
        double tuneSeconds = Math.max(0.001, session.tuneTimeMs / 1000.0);
        double alpha = session.tuneTimeMs == 0 ? 1.0
                : 1.0 - Math.exp(-(HOP / (double) StudioSession.SAMPLE_RATE) / tuneSeconds);
        double depth = session.depthPercent / 100.0;
        java.util.List<StudioSession.NoteBlock> notes = session.noteSnapshot();
        int noteIndex = 0;
        StudioSession.NoteBlock active = notes.isEmpty() ? null : notes.get(0);
        double gain = Math.pow(10.0, session.gainDb / 20.0);

        int lastProgress = -1;
        for (int center = 0; center < sampleCount + GRAIN / 2; center += HOP) {
            double time = center / (double) StudioSession.SAMPLE_RATE;
            while (active != null && time > active.endSec && noteIndex + 1 < notes.size()) {
                active = notes.get(++noteIndex);
            }
            double wanted = 1.0;
            if (active != null && time >= active.startSec && time <= active.endSec) {
                double semitones = (active.targetMidi - active.sourceMidi) * depth;
                wanted = Math.pow(2.0, semitones / 12.0);
            }
            ratio += (wanted - ratio) * alpha;
            ratio = Math.max(0.55, Math.min(1.85, ratio));

            for (int n = 0; n < GRAIN; n++) {
                int outIndex = center + n - GRAIN / 2;
                if (outIndex < 0 || outIndex >= sampleCount) continue;
                double relative = n - GRAIN / 2.0;
                double sourcePosition = center + relative * ratio;
                int sourceIndex = (int) Math.floor(sourcePosition);
                if (sourceIndex < 0 || sourceIndex + 1 >= sampleCount) continue;
                double fraction = sourcePosition - sourceIndex;
                double sample = input[sourceIndex] * (1.0 - fraction) + input[sourceIndex + 1] * fraction;
                double window = 0.5 - 0.5 * Math.cos(2.0 * Math.PI * n / (GRAIN - 1.0));
                output[outIndex] += (float) (sample * window * 0.5 * gain);
            }
            int now = sampleCount == 0 ? 100 : Math.min(99, center * 100 / sampleCount);
            if (now != lastProgress && progress != null) {
                lastProgress = now;
                progress.onProgress(now);
            }
        }

        try (BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(outputPcm), 64 * 1024)) {
            for (float value : output) {
                int clipped = Math.max(Short.MIN_VALUE, Math.min(Short.MAX_VALUE, Math.round(value)));
                out.write(clipped & 0xff);
                out.write((clipped >>> 8) & 0xff);
            }
        }
        if (progress != null) progress.onProgress(100);
    }

    private PitchRenderer() {}
}
