package com.strawberry.pitchstudio;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

final class StudioSession {
    static final int SAMPLE_RATE = 48_000;

    static final class PitchFrame {
        final double timeSec;
        final double frequency;
        final double midi;
        final double confidence;
        final double rms;

        PitchFrame(double timeSec, double frequency, double midi, double confidence, double rms) {
            this.timeSec = timeSec;
            this.frequency = frequency;
            this.midi = midi;
            this.confidence = confidence;
            this.rms = rms;
        }
    }

    static final class NoteBlock {
        final int id;
        double startSec;
        double endSec;
        double sourceMidi;
        int targetMidi;
        double confidence;
        double rms;

        NoteBlock(int id, double startSec, double endSec, double sourceMidi,
                  int targetMidi, double confidence, double rms) {
            this.id = id;
            this.startSec = startSec;
            this.endSec = endSec;
            this.sourceMidi = sourceMidi;
            this.targetMidi = targetMidi;
            this.confidence = confidence;
            this.rms = rms;
        }
    }

    private static final class Edit {
        final int noteId;
        final int before;
        final int after;

        Edit(int noteId, int before, int after) {
            this.noteId = noteId;
            this.before = before;
            this.after = after;
        }
    }

    private final List<PitchFrame> frames = Collections.synchronizedList(new ArrayList<>());
    private final List<NoteBlock> notes = Collections.synchronizedList(new ArrayList<>());
    private final ArrayDeque<Edit> undo = new ArrayDeque<>();
    double durationSec;
    int depthPercent = 100;
    int tuneTimeMs = 80;
    int formantCents = 0;
    float gainDb = 0f;
    int bpm = 120;
    private long revision;

    void clear() {
        frames.clear();
        notes.clear();
        undo.clear();
        durationSec = 0;
        revision++;
    }

    void addFrame(PitchFrame frame) {
        frames.add(frame);
        durationSec = Math.max(durationSec, frame.timeSec);
    }

    List<PitchFrame> frameSnapshot() {
        synchronized (frames) {
            return new ArrayList<>(frames);
        }
    }

    List<NoteBlock> noteSnapshot() {
        synchronized (notes) {
            return new ArrayList<>(notes);
        }
    }

    NoteBlock noteById(int id) {
        synchronized (notes) {
            for (NoteBlock note : notes) if (note.id == id) return note;
        }
        return null;
    }

    void buildNotes() {
        List<PitchFrame> source = frameSnapshot();
        ArrayList<NoteBlock> built = new ArrayList<>();
        ArrayList<PitchFrame> run = new ArrayList<>();
        int nextId = 1;
        PitchFrame previous = null;

        for (PitchFrame frame : source) {
            boolean voiced = frame.confidence >= 0.56 && frame.rms >= 0.008
                    && frame.midi >= 24 && frame.midi <= 96;
            boolean continues = voiced && previous != null
                    && frame.timeSec - previous.timeSec < 0.085
                    && Math.abs(frame.midi - medianMidi(run)) < 1.35;
            if (!continues && !run.isEmpty()) {
                nextId = finishRun(run, built, nextId);
                run.clear();
            }
            if (voiced) run.add(frame);
            previous = voiced ? frame : null;
        }
        if (!run.isEmpty()) finishRun(run, built, nextId);

        // Very short gaps between the same sung note should remain one large, editable block.
        for (int i = built.size() - 2; i >= 0; i--) {
            NoteBlock a = built.get(i);
            NoteBlock b = built.get(i + 1);
            if (b.startSec - a.endSec < 0.09 && Math.abs(a.sourceMidi - b.sourceMidi) < 0.65) {
                double wa = Math.max(0.01, a.endSec - a.startSec);
                double wb = Math.max(0.01, b.endSec - b.startSec);
                a.sourceMidi = (a.sourceMidi * wa + b.sourceMidi * wb) / (wa + wb);
                a.targetMidi = (int) Math.round(a.sourceMidi);
                a.endSec = b.endSec;
                a.confidence = Math.max(a.confidence, b.confidence);
                a.rms = Math.max(a.rms, b.rms);
                built.remove(i + 1);
            }
        }
        notes.clear();
        notes.addAll(built);
        undo.clear();
        revision++;
    }

    private static int finishRun(List<PitchFrame> run, List<NoteBlock> out, int id) {
        PitchFrame first = run.get(0);
        PitchFrame last = run.get(run.size() - 1);
        double length = last.timeSec - first.timeSec;
        if (length < 0.055 || run.size() < 3) return id;
        double median = medianMidi(run);
        double confidence = 0;
        double rms = 0;
        for (PitchFrame frame : run) {
            confidence += frame.confidence;
            rms += frame.rms;
        }
        confidence /= run.size();
        rms /= run.size();
        out.add(new NoteBlock(id, Math.max(0, first.timeSec - 0.01), last.timeSec + 0.025,
                median, (int) Math.round(median), confidence, rms));
        return id + 1;
    }

    private static double medianMidi(List<PitchFrame> list) {
        if (list == null || list.isEmpty()) return -999;
        double[] values = new double[list.size()];
        for (int i = 0; i < list.size(); i++) values[i] = list.get(i).midi;
        java.util.Arrays.sort(values);
        int middle = values.length / 2;
        return values.length % 2 == 0 ? (values[middle - 1] + values[middle]) * 0.5 : values[middle];
    }

    void moveNote(int id, int target, boolean commit) {
        NoteBlock note = noteById(id);
        if (note == null) return;
        int bounded = Math.max(24, Math.min(96, target));
        int old = note.targetMidi;
        note.targetMidi = bounded;
        if (old != bounded) revision++;
        if (commit && old != bounded) undo.push(new Edit(id, old, bounded));
    }

    void commitMove(int id, int before, int after) {
        if (before != after) undo.push(new Edit(id, before, after));
    }

    boolean undo() {
        Edit edit = undo.pollFirst();
        if (edit == null) return false;
        NoteBlock note = noteById(edit.noteId);
        if (note == null) return false;
        note.targetMidi = edit.before;
        revision++;
        return true;
    }

    void markChanged() {
        revision++;
    }

    long revision() {
        return revision;
    }

    double targetMidiAt(double timeSec, double sungMidi) {
        synchronized (notes) {
            for (NoteBlock note : notes) {
                if (timeSec >= note.startSec && timeSec <= note.endSec) {
                    return sungMidi + (note.targetMidi - note.sourceMidi) * (depthPercent / 100.0);
                }
            }
        }
        return sungMidi;
    }

    void save(File file) throws Exception {
        JSONObject root = new JSONObject();
        root.put("duration", durationSec);
        root.put("depth", depthPercent);
        root.put("tuneTime", tuneTimeMs);
        root.put("formant", formantCents);
        root.put("gain", gainDb);
        root.put("bpm", bpm);
        JSONArray frameArray = new JSONArray();
        for (PitchFrame frame : frameSnapshot()) {
            frameArray.put(new JSONArray()
                    .put(frame.timeSec).put(frame.frequency).put(frame.midi)
                    .put(frame.confidence).put(frame.rms));
        }
        root.put("frames", frameArray);
        JSONArray noteArray = new JSONArray();
        for (NoteBlock note : noteSnapshot()) {
            noteArray.put(new JSONArray().put(note.id).put(note.startSec).put(note.endSec)
                    .put(note.sourceMidi).put(note.targetMidi).put(note.confidence).put(note.rms));
        }
        root.put("notes", noteArray);
        Files.writeString(file.toPath(), root.toString(), StandardCharsets.UTF_8);
    }

    static StudioSession load(File file) {
        StudioSession session = new StudioSession();
        if (!file.exists()) return session;
        try {
            JSONObject root = new JSONObject(Files.readString(file.toPath(), StandardCharsets.UTF_8));
            session.durationSec = root.optDouble("duration", 0);
            session.depthPercent = root.optInt("depth", 100);
            session.tuneTimeMs = root.optInt("tuneTime", 80);
            session.formantCents = root.optInt("formant", 0);
            session.gainDb = (float) root.optDouble("gain", 0);
            session.bpm = root.optInt("bpm", 120);
            JSONArray frameArray = root.optJSONArray("frames");
            if (frameArray != null) for (int i = 0; i < frameArray.length(); i++) {
                JSONArray f = frameArray.getJSONArray(i);
                session.frames.add(new PitchFrame(f.getDouble(0), f.getDouble(1), f.getDouble(2),
                        f.getDouble(3), f.getDouble(4)));
            }
            JSONArray noteArray = root.optJSONArray("notes");
            if (noteArray != null) for (int i = 0; i < noteArray.length(); i++) {
                JSONArray n = noteArray.getJSONArray(i);
                session.notes.add(new NoteBlock(n.getInt(0), n.getDouble(1), n.getDouble(2),
                        n.getDouble(3), n.getInt(4), n.getDouble(5), n.getDouble(6)));
            }
        } catch (Exception ignored) {
            session.clear();
        }
        return session;
    }
}
