package com.strawberry.pitchstudio;

import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

final class Exporters {
    static void writeWav(File pcmFile, OutputStream target) throws Exception {
        long pcmBytes = pcmFile.length();
        try (BufferedOutputStream out = new BufferedOutputStream(target, 64 * 1024);
             BufferedInputStream in = new BufferedInputStream(new FileInputStream(pcmFile), 64 * 1024)) {
            writeAscii(out, "RIFF");
            writeLe32(out, 36 + pcmBytes);
            writeAscii(out, "WAVEfmt ");
            writeLe32(out, 16);
            writeLe16(out, 1);
            writeLe16(out, 1);
            writeLe32(out, StudioSession.SAMPLE_RATE);
            writeLe32(out, StudioSession.SAMPLE_RATE * 2L);
            writeLe16(out, 2);
            writeLe16(out, 16);
            writeAscii(out, "data");
            writeLe32(out, pcmBytes);
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) >= 0) out.write(buffer, 0, read);
        }
    }

    static void writeMidi(StudioSession session, OutputStream target) throws Exception {
        final int ticksPerQuarter = 960;
        final double ticksPerSecond = ticksPerQuarter * session.bpm / 60.0;
        final class Event {
            final long tick;
            final boolean on;
            final int note;
            final int velocity;
            Event(long tick, boolean on, int note, int velocity) {
                this.tick = tick; this.on = on; this.note = note; this.velocity = velocity;
            }
        }
        List<Event> events = new ArrayList<>();
        for (StudioSession.NoteBlock note : session.noteSnapshot()) {
            long start = Math.max(0, Math.round(note.startSec * ticksPerSecond));
            long end = Math.max(start + 1, Math.round(note.endSec * ticksPerSecond));
            int velocity = Math.max(24, Math.min(127, (int) Math.round(28 + note.rms * 700)));
            events.add(new Event(start, true, note.targetMidi, velocity));
            events.add(new Event(end, false, note.targetMidi, 0));
        }
        events.sort(Comparator.comparingLong((Event e) -> e.tick).thenComparing(e -> e.on));

        ByteArrayOutputStream trackBytes = new ByteArrayOutputStream();
        DataOutputStream track = new DataOutputStream(trackBytes);
        writeVlq(track, 0);
        track.write(new byte[]{(byte) 0xff, 0x03, 0x17});
        track.write("Strawberry Pitch Studio".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        writeVlq(track, 0);
        int micros = 60_000_000 / Math.max(1, session.bpm);
        track.write(new byte[]{(byte) 0xff, 0x51, 0x03,
                (byte) (micros >>> 16), (byte) (micros >>> 8), (byte) micros});
        long previous = 0;
        for (Event event : events) {
            writeVlq(track, event.tick - previous);
            track.writeByte(event.on ? 0x90 : 0x80);
            track.writeByte(event.note & 0x7f);
            track.writeByte(event.velocity & 0x7f);
            previous = event.tick;
        }
        writeVlq(track, 0);
        track.write(new byte[]{(byte) 0xff, 0x2f, 0x00});
        track.flush();

        DataOutputStream out = new DataOutputStream(new BufferedOutputStream(target));
        out.writeBytes("MThd");
        out.writeInt(6);
        out.writeShort(0);
        out.writeShort(1);
        out.writeShort(ticksPerQuarter);
        out.writeBytes("MTrk");
        out.writeInt(trackBytes.size());
        trackBytes.writeTo(out);
        out.flush();
        out.close();
    }

    static boolean canEncodeMp3() {
        try {
            MediaCodec codec = MediaCodec.createEncoderByType("audio/mpeg");
            codec.release();
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    static void writeMp3(File pcmFile, OutputStream target) throws Exception {
        MediaCodec codec = MediaCodec.createEncoderByType("audio/mpeg");
        MediaFormat format = MediaFormat.createAudioFormat("audio/mpeg", StudioSession.SAMPLE_RATE, 1);
        format.setInteger(MediaFormat.KEY_BIT_RATE, 192_000);
        format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16_384);
        format.setInteger(MediaFormat.KEY_PCM_ENCODING, android.media.AudioFormat.ENCODING_PCM_16BIT);
        codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
        codec.start();
        try (BufferedInputStream input = new BufferedInputStream(new FileInputStream(pcmFile), 64 * 1024);
             BufferedOutputStream output = new BufferedOutputStream(target, 64 * 1024)) {
            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
            boolean inputEnded = false;
            boolean outputEnded = false;
            long submittedBytes = 0;
            while (!outputEnded) {
                if (!inputEnded) {
                    int index = codec.dequeueInputBuffer(10_000);
                    if (index >= 0) {
                        ByteBuffer buffer = codec.getInputBuffer(index);
                        if (buffer == null) continue;
                        buffer.clear();
                        byte[] bytes = new byte[Math.min(buffer.remaining(), 16_384)];
                        int read = input.read(bytes);
                        long presentationUs = submittedBytes * 1_000_000L / (StudioSession.SAMPLE_RATE * 2L);
                        if (read < 0) {
                            codec.queueInputBuffer(index, 0, 0, presentationUs, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                            inputEnded = true;
                        } else {
                            buffer.put(bytes, 0, read);
                            codec.queueInputBuffer(index, 0, read, presentationUs, 0);
                            submittedBytes += read;
                        }
                    }
                }
                int outIndex = codec.dequeueOutputBuffer(info, 10_000);
                if (outIndex >= 0) {
                    ByteBuffer buffer = codec.getOutputBuffer(outIndex);
                    if (buffer != null && info.size > 0 && (info.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
                        byte[] encoded = new byte[info.size];
                        buffer.position(info.offset);
                        buffer.limit(info.offset + info.size);
                        buffer.get(encoded);
                        output.write(encoded);
                    }
                    outputEnded = (info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0;
                    codec.releaseOutputBuffer(outIndex, false);
                }
            }
        } finally {
            codec.stop();
            codec.release();
        }
    }

    private static void writeAscii(OutputStream out, String value) throws Exception {
        out.write(value.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
    }

    private static void writeLe16(OutputStream out, long value) throws Exception {
        out.write((int) value & 0xff);
        out.write((int) (value >>> 8) & 0xff);
    }

    private static void writeLe32(OutputStream out, long value) throws Exception {
        out.write((int) value & 0xff);
        out.write((int) (value >>> 8) & 0xff);
        out.write((int) (value >>> 16) & 0xff);
        out.write((int) (value >>> 24) & 0xff);
    }

    private static void writeVlq(DataOutputStream out, long value) throws Exception {
        long buffer = value & 0x7f;
        while ((value >>>= 7) != 0) buffer = (buffer << 8) | ((value & 0x7f) | 0x80);
        while (true) {
            out.writeByte((int) buffer & 0xff);
            if ((buffer & 0x80) == 0) break;
            buffer >>>= 8;
        }
    }

    private Exporters() {}
}
