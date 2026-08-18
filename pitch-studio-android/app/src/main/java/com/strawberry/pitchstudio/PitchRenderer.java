package com.strawberry.pitchstudio;

import java.io.File;
import java.util.List;

/**
 * Offline formant-aware spectral renderer. Pitch automation follows the editable note blocks,
 * while Signalsmith Stretch supplies phase-coherent pitch shifting, formant compensation, and
 * independent spectral-envelope shifting.
 */
final class PitchRenderer {
    interface Progress {
        void onProgress(int percent);
    }

    static {
        System.loadLibrary("pitchstudio_dsp");
    }

    static void render(File inputPcm, File outputPcm, StudioSession session, Progress progress)
            throws Exception {
        long sampleCount = inputPcm.length() / 2;
        if (sampleCount > Integer.MAX_VALUE / 2L) {
            throw new IllegalArgumentException("Recording is too long to render on this phone");
        }
        List<StudioSession.NoteBlock> notes = session.noteSnapshot();
        double[] starts = new double[notes.size()];
        double[] ends = new double[notes.size()];
        double[] sources = new double[notes.size()];
        int[] targets = new int[notes.size()];
        for (int i = 0; i < notes.size(); i++) {
            StudioSession.NoteBlock note = notes.get(i);
            starts[i] = note.startSec;
            ends[i] = note.endSec;
            sources[i] = note.sourceMidi;
            targets[i] = note.targetMidi;
        }
        if (progress != null) progress.onProgress(0);
        renderNative(inputPcm.getAbsolutePath(), outputPcm.getAbsolutePath(),
                StudioSession.SAMPLE_RATE, starts, ends, sources, targets,
                session.depthPercent / 100.0, session.tuneTimeMs,
                session.formantCents / 100.0, session.formantPreserve, session.gainDb);
        if (progress != null) progress.onProgress(100);
    }

    private static native void renderNative(String inputPath, String outputPath, int sampleRate,
                                            double[] starts, double[] ends, double[] sources,
                                            int[] targets, double depth, double tuneTimeMs,
                                            double formantSemitones, boolean preserveFormants,
                                            double gainDb);

    private PitchRenderer() {}
}
