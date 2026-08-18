package com.strawberry.pitchstudio;

final class PitchDetector {
    interface Callback {
        void onPitch(StudioSession.PitchFrame frame);
    }

    private static final int FRAME_SIZE = 2048;
    private static final int HOP_SIZE = 960;
    private static final double MIN_HZ = 65.0;
    private static final double MAX_HZ = 1000.0;
    private static final double THRESHOLD = 0.17;

    private final int sampleRate;
    private final float[] frame = new float[FRAME_SIZE];
    private final double[] difference = new double[FRAME_SIZE / 2];
    private final double[] cmnd = new double[FRAME_SIZE / 2];
    private int filled;
    private long samplesSeen;

    PitchDetector(int sampleRate) {
        this.sampleRate = sampleRate;
    }

    void reset() {
        filled = 0;
        samplesSeen = 0;
        java.util.Arrays.fill(frame, 0f);
    }

    void process(short[] input, int count, Callback callback) {
        for (int i = 0; i < count; i++) {
            frame[filled++] = input[i] / 32768f;
            samplesSeen++;
            if (filled == FRAME_SIZE) {
                StudioSession.PitchFrame result = analyze();
                if (result != null) callback.onPitch(result);
                System.arraycopy(frame, HOP_SIZE, frame, 0, FRAME_SIZE - HOP_SIZE);
                filled = FRAME_SIZE - HOP_SIZE;
            }
        }
    }

    private StudioSession.PitchFrame analyze() {
        double mean = 0;
        for (float sample : frame) mean += sample;
        mean /= FRAME_SIZE;
        double energy = 0;
        for (int i = 0; i < FRAME_SIZE; i++) {
            frame[i] -= (float) mean;
            energy += frame[i] * frame[i];
        }
        double rms = Math.sqrt(energy / FRAME_SIZE);
        if (rms < 0.0065) return null;

        int minLag = Math.max(2, (int) Math.floor(sampleRate / MAX_HZ));
        int maxLag = Math.min(difference.length - 2, (int) Math.ceil(sampleRate / MIN_HZ));
        difference[0] = 0;
        for (int lag = 1; lag <= maxLag; lag++) {
            double sum = 0;
            int limit = FRAME_SIZE - lag;
            for (int i = 0; i < limit; i++) {
                double delta = frame[i] - frame[i + lag];
                sum += delta * delta;
            }
            difference[lag] = sum;
        }

        cmnd[0] = 1;
        double running = 0;
        for (int lag = 1; lag <= maxLag; lag++) {
            running += difference[lag];
            cmnd[lag] = running == 0 ? 1 : difference[lag] * lag / running;
        }

        int tau = -1;
        for (int lag = minLag; lag < maxLag; lag++) {
            if (cmnd[lag] < THRESHOLD) {
                while (lag + 1 < maxLag && cmnd[lag + 1] < cmnd[lag]) lag++;
                tau = lag;
                break;
            }
        }
        if (tau < 0) {
            double best = 0.34;
            for (int lag = minLag; lag <= maxLag; lag++) {
                if (cmnd[lag] < best) {
                    best = cmnd[lag];
                    tau = lag;
                }
            }
        }
        if (tau < 0) return null;

        double betterTau = tau;
        if (tau > 1 && tau + 1 <= maxLag) {
            double left = cmnd[tau - 1];
            double middle = cmnd[tau];
            double right = cmnd[tau + 1];
            double denominator = left - 2 * middle + right;
            if (Math.abs(denominator) > 1e-12) betterTau += 0.5 * (left - right) / denominator;
        }
        double frequency = sampleRate / betterTau;
        if (!Double.isFinite(frequency) || frequency < MIN_HZ || frequency > MAX_HZ) return null;
        double midi = 69.0 + 12.0 * Math.log(frequency / 440.0) / Math.log(2.0);
        double confidence = Math.max(0, Math.min(1, 1.0 - cmnd[tau]));
        double centerSample = samplesSeen - FRAME_SIZE * 0.5;
        return new StudioSession.PitchFrame(Math.max(0, centerSample / sampleRate), frequency,
                midi, confidence, rms);
    }
}
