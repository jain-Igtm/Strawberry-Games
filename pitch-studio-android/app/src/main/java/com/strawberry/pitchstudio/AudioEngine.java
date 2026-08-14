package com.strawberry.pitchstudio;

import android.annotation.SuppressLint;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.MediaRecorder;
import android.os.Handler;
import android.os.Looper;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.concurrent.atomic.AtomicBoolean;

final class AudioEngine {
    interface Listener {
        void onPitch(StudioSession.PitchFrame frame);
        void onState(String state);
        void onRecordingChanged(boolean recording);
        void onPlaybackChanged(boolean playing);
        void onPlayhead(double seconds);
        void onSessionReady();
        void onError(String message);
    }

    interface RenderCallback {
        void onReady(File correctedPcm);
        void onFailure(String message);
    }

    private final Handler main = new Handler(Looper.getMainLooper());
    private final Listener listener;
    private final File pcmFile;
    private final File renderedFile;
    private final File sessionFile;
    private final PitchDetector detector = new PitchDetector(StudioSession.SAMPLE_RATE);
    private final AtomicBoolean recording = new AtomicBoolean(false);
    private final AtomicBoolean playing = new AtomicBoolean(false);
    private volatile AudioRecord recorder;
    private volatile AudioTrack player;
    private volatile Thread recordThread;
    private volatile Thread playThread;
    private long renderedRevision = Long.MIN_VALUE;
    private StudioSession session;

    AudioEngine(Context context, StudioSession session, Listener listener) {
        this.session = session;
        this.listener = listener;
        pcmFile = new File(context.getFilesDir(), "current-recording.pcm");
        renderedFile = new File(context.getCacheDir(), "current-render.pcm");
        sessionFile = new File(context.getFilesDir(), "current-session.json");
        if (pcmFile.exists()) {
            session.durationSec = pcmFile.length() / 2.0 / StudioSession.SAMPLE_RATE;
        }
    }

    File pcmFile() { return pcmFile; }
    File renderedFile() { return renderedFile; }
    File sessionFile() { return sessionFile; }
    boolean isRecording() { return recording.get(); }
    boolean isPlaying() { return playing.get(); }

    @SuppressLint("MissingPermission")
    void startRecording() {
        if (recording.get()) return;
        stopPlayback();
        int minimum = AudioRecord.getMinBufferSize(StudioSession.SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        int bufferBytes = Math.max(16_384, minimum * 2);
        AudioFormat format = new AudioFormat.Builder()
                .setSampleRate(StudioSession.SAMPLE_RATE)
                .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .build();
        try {
            recorder = new AudioRecord.Builder()
                    .setAudioSource(MediaRecorder.AudioSource.UNPROCESSED)
                    .setAudioFormat(format)
                    .setBufferSizeInBytes(bufferBytes)
                    .build();
            if (recorder.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException();
        } catch (Exception unavailable) {
            if (recorder != null) recorder.release();
            recorder = new AudioRecord.Builder()
                    .setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
                    .setAudioFormat(format)
                    .setBufferSizeInBytes(bufferBytes)
                    .build();
        }
        if (recorder.getState() != AudioRecord.STATE_INITIALIZED) {
            recorder.release();
            recorder = null;
            postError("The microphone could not be opened.");
            return;
        }

        session.clear();
        detector.reset();
        renderedRevision = Long.MIN_VALUE;
        recording.set(true);
        recorder.startRecording();
        post(() -> {
            listener.onRecordingChanged(true);
            listener.onState("Recording • 48 kHz WAV source");
        });
        final int sampleBufferSize = Math.max(2048, bufferBytes / 2);
        recordThread = new Thread(() -> recordLoop(sampleBufferSize), "pitch-recorder");
        recordThread.start();
    }

    private void recordLoop(int sampleBufferSize) {
        short[] samples = new short[sampleBufferSize];
        byte[] bytes = new byte[sampleBufferSize * 2];
        try (BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(pcmFile, false), 64 * 1024)) {
            while (recording.get()) {
                int count = recorder.read(samples, 0, samples.length, AudioRecord.READ_BLOCKING);
                if (count <= 0) continue;
                for (int i = 0; i < count; i++) {
                    bytes[i * 2] = (byte) (samples[i] & 0xff);
                    bytes[i * 2 + 1] = (byte) ((samples[i] >>> 8) & 0xff);
                }
                out.write(bytes, 0, count * 2);
                detector.process(samples, count, frame -> {
                    session.addFrame(frame);
                    post(() -> listener.onPitch(frame));
                });
                session.durationSec = pcmFile.length() / 2.0 / StudioSession.SAMPLE_RATE;
            }
        } catch (Exception error) {
            if (recording.get()) postError("Recording stopped: " + safeMessage(error));
        } finally {
            recording.set(false);
        }
    }

    void stopRecording() {
        if (!recording.getAndSet(false)) return;
        AudioRecord active = recorder;
        if (active != null) {
            try { active.stop(); } catch (Exception ignored) {}
        }
        Thread worker = recordThread;
        if (worker != null) {
            try { worker.join(700); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
        }
        if (active != null) active.release();
        recorder = null;
        session.durationSec = pcmFile.length() / 2.0 / StudioSession.SAMPLE_RATE;
        session.buildNotes();
        persist();
        post(() -> {
            listener.onRecordingChanged(false);
            listener.onState(session.noteSnapshot().size() + " editable notes • drag any note up or down");
            listener.onSessionReady();
        });
    }

    void togglePlayback(double startSeconds) {
        if (playing.get()) {
            stopPlayback();
            return;
        }
        if (!pcmFile.exists() || pcmFile.length() == 0) {
            postError("Record something first.");
            return;
        }
        playing.set(true);
        post(() -> listener.onPlaybackChanged(true));
        playThread = new Thread(() -> {
            try {
                File source = renderedFile;
                if (!renderedFile.exists() || renderedRevision != session.revision()) {
                    post(() -> listener.onState("Rendering correction…"));
                    PitchRenderer.render(pcmFile, renderedFile, session, percent -> {
                        if (percent % 10 == 0) post(() -> listener.onState("Rendering correction • " + percent + "%"));
                    });
                    renderedRevision = session.revision();
                }
                if (playing.get()) playLoop(source, startSeconds);
            } catch (OutOfMemoryError memory) {
                postError("This take is too long to render in memory. WAV and MIDI export still work from a shorter take.");
            } catch (Exception error) {
                postError("Playback failed: " + safeMessage(error));
            } finally {
                playing.set(false);
                post(() -> listener.onPlaybackChanged(false));
            }
        }, "pitch-render-playback");
        playThread.start();
    }

    private void playLoop(File source, double startSeconds) throws Exception {
        int minimum = AudioTrack.getMinBufferSize(StudioSession.SAMPLE_RATE,
                AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
        player = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                .setAudioFormat(new AudioFormat.Builder()
                        .setSampleRate(StudioSession.SAMPLE_RATE)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
                .setBufferSizeInBytes(Math.max(16_384, minimum * 2))
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build();
        long startByte = Math.max(0, Math.min(source.length(),
                Math.round(startSeconds * StudioSession.SAMPLE_RATE) * 2L));
        try (BufferedInputStream input = new BufferedInputStream(new FileInputStream(source), 64 * 1024)) {
            long remainingSkip = startByte;
            while (remainingSkip > 0) {
                long skipped = input.skip(remainingSkip);
                if (skipped <= 0) break;
                remainingSkip -= skipped;
            }
            byte[] data = new byte[16_384];
            long playedBytes = startByte;
            player.play();
            post(() -> listener.onState("Playing corrected preview"));
            while (playing.get()) {
                int read = input.read(data);
                if (read < 0) break;
                int offset = 0;
                while (offset < read && playing.get()) {
                    int wrote = player.write(data, offset, read - offset, AudioTrack.WRITE_BLOCKING);
                    if (wrote <= 0) break;
                    offset += wrote;
                    playedBytes += wrote;
                }
                double seconds = playedBytes / 2.0 / StudioSession.SAMPLE_RATE;
                post(() -> listener.onPlayhead(seconds));
            }
        } finally {
            if (player != null) {
                try { player.stop(); } catch (Exception ignored) {}
                player.release();
                player = null;
            }
        }
    }

    void stopPlayback() {
        if (!playing.getAndSet(false)) return;
        AudioTrack active = player;
        if (active != null) {
            try { active.pause(); active.flush(); } catch (Exception ignored) {}
        }
        post(() -> listener.onPlaybackChanged(false));
    }

    void renderForExport(RenderCallback callback) {
        if (!pcmFile.exists() || pcmFile.length() == 0) {
            callback.onFailure("Record something first.");
            return;
        }
        new Thread(() -> {
            try {
                if (!renderedFile.exists() || renderedRevision != session.revision()) {
                    post(() -> listener.onState("Rendering export…"));
                    PitchRenderer.render(pcmFile, renderedFile, session, percent -> {
                        if (percent % 10 == 0) post(() -> listener.onState("Rendering export • " + percent + "%"));
                    });
                    renderedRevision = session.revision();
                }
                post(() -> callback.onReady(renderedFile));
            } catch (OutOfMemoryError memory) {
                post(() -> callback.onFailure("This take is too long for corrected export on this phone."));
            } catch (Exception error) {
                post(() -> callback.onFailure("Render failed: " + safeMessage(error)));
            }
        }, "pitch-export-render").start();
    }

    void persist() {
        try {
            session.save(sessionFile);
        } catch (Exception error) {
            postError("Could not save the edit session: " + safeMessage(error));
        }
    }

    private void post(Runnable runnable) {
        main.post(runnable);
    }

    private void postError(String message) {
        post(() -> {
            listener.onError(message);
            listener.onState(message);
        });
    }

    private static String safeMessage(Throwable error) {
        String message = error.getMessage();
        return message == null || message.isBlank() ? error.getClass().getSimpleName() : message;
    }
}
