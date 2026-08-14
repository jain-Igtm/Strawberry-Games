package com.strawberry.pitchstudio;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.view.GestureDetector;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;

import java.util.List;
import java.util.Locale;

final class PitchEditorView extends View {
    interface Listener {
        void onCursorChanged(double seconds);
        void onNoteSelected(StudioSession.NoteBlock note);
        void onNoteMoved(StudioSession.NoteBlock note);
    }

    private static final int INK = Color.rgb(7, 14, 18);
    private static final int SURFACE = Color.rgb(15, 25, 31);
    private static final int ROW_A = Color.rgb(20, 32, 39);
    private static final int ROW_B = Color.rgb(17, 28, 34);
    private static final int GRID = Color.rgb(43, 59, 68);
    private static final int TEXT = Color.rgb(226, 237, 238);
    private static final int MUTED = Color.rgb(126, 148, 157);
    private static final int ACCENT = Color.rgb(124, 244, 202);
    private static final int ACCENT_DARK = Color.rgb(33, 123, 103);
    private static final int PINK = Color.rgb(255, 85, 117);
    private static final int TRACE = Color.rgb(255, 215, 109);

    private final float density;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint linePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path trace = new Path();
    private final ScaleGestureDetector scaleDetector;
    private final GestureDetector gestureDetector;
    private StudioSession session;
    private Listener listener;
    private float keyboardWidth;
    private float rowHeight;
    private float pixelsPerSecond;
    private float scrollPixels;
    private double topMidi = 78;
    private double playhead;
    private double cursor;
    private StudioSession.PitchFrame liveFrame;
    private int selectedNoteId = -1;
    private int dragStartTarget;
    private float downX;
    private float downY;
    private float lastX;
    private float lastY;
    private boolean draggingNote;
    private boolean panning;
    private boolean recording;

    PitchEditorView(Context context) {
        super(context);
        density = getResources().getDisplayMetrics().density;
        keyboardWidth = 70 * density;
        rowHeight = 30 * density;
        pixelsPerSecond = 78 * density;
        setBackgroundColor(SURFACE);
        setFocusable(true);
        scaleDetector = new ScaleGestureDetector(context, new ScaleGestureDetector.SimpleOnScaleGestureListener() {
            @Override public boolean onScaleBegin(ScaleGestureDetector detector) { return true; }

            @Override public boolean onScale(ScaleGestureDetector detector) {
                float focus = detector.getFocusX();
                double anchorTime = xToTime(focus);
                float before = pixelsPerSecond;
                pixelsPerSecond = clamp(pixelsPerSecond * detector.getScaleFactor(), 32 * density, 330 * density);
                scrollPixels += (float) (anchorTime * pixelsPerSecond - (focus - keyboardWidth))
                        - (float) (anchorTime * before - (focus - keyboardWidth));
                clampScroll();
                invalidate();
                return true;
            }
        });
        gestureDetector = new GestureDetector(context, new GestureDetector.SimpleOnGestureListener() {
            @Override public boolean onDoubleTap(MotionEvent event) {
                if (event.getX() > keyboardWidth) {
                    pixelsPerSecond = 78 * density;
                    scrollPixels = Math.max(0, (float) (cursor * pixelsPerSecond - getWidth() * 0.35));
                    invalidate();
                    return true;
                }
                return false;
            }
        });
    }

    void setSession(StudioSession session) {
        this.session = session;
        invalidate();
    }

    void setListener(Listener listener) { this.listener = listener; }

    void setRecording(boolean recording) {
        this.recording = recording;
        invalidate();
    }

    void setLiveFrame(StudioSession.PitchFrame frame) {
        liveFrame = frame;
        if (recording) {
            cursor = frame.timeSec;
            playhead = frame.timeSec;
            float desired = (float) (frame.timeSec * pixelsPerSecond - (getWidth() - keyboardWidth) * 0.72);
            if (desired > scrollPixels) scrollPixels = desired;
            double wantedTop = Math.round(frame.midi) + Math.max(6, getHeight() / rowHeight * 0.38);
            topMidi += (wantedTop - topMidi) * 0.08;
            clampScroll();
        }
        invalidate();
    }

    void setPlayhead(double seconds) {
        playhead = seconds;
        cursor = seconds;
        float rightEdge = (float) (seconds * pixelsPerSecond - scrollPixels + keyboardWidth);
        if (rightEdge > getWidth() * 0.88f) {
            scrollPixels = Math.max(0, (float) (seconds * pixelsPerSecond - (getWidth() - keyboardWidth) * 0.72));
        }
        invalidate();
    }

    double cursorSeconds() { return cursor; }

    void focusAll() {
        if (session == null || session.durationSec <= 0) return;
        pixelsPerSecond = clamp((float) ((getWidth() - keyboardWidth - 24 * density) / session.durationSec),
                32 * density, 180 * density);
        scrollPixels = 0;
        List<StudioSession.NoteBlock> notes = session.noteSnapshot();
        if (!notes.isEmpty()) {
            double min = 127, max = 0;
            for (StudioSession.NoteBlock note : notes) {
                min = Math.min(min, Math.min(note.sourceMidi, note.targetMidi));
                max = Math.max(max, Math.max(note.sourceMidi, note.targetMidi));
            }
            topMidi = Math.min(96, max + Math.max(2, (getHeight() / rowHeight - (max - min)) * 0.5));
        }
        invalidate();
    }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        drawRows(canvas);
        drawTimeGrid(canvas);
        if (session != null) {
            drawNotes(canvas, session.noteSnapshot());
            drawPitchTrace(canvas, session.frameSnapshot());
        }
        drawPlayhead(canvas);
        drawKeyboard(canvas);
        drawLiveBadge(canvas);
    }

    private void drawRows(Canvas canvas) {
        int visible = (int) Math.ceil(getHeight() / rowHeight) + 2;
        int first = (int) Math.ceil(topMidi);
        paint.setStyle(Paint.Style.FILL);
        for (int i = 0; i < visible; i++) {
            int midi = first - i;
            float y = midiToY(midi) - rowHeight * 0.5f;
            paint.setColor(isBlackKey(midi) ? ROW_B : ROW_A);
            canvas.drawRect(keyboardWidth, y, getWidth(), y + rowHeight, paint);
            linePaint.setColor(GRID);
            linePaint.setStrokeWidth(1);
            canvas.drawLine(keyboardWidth, y + rowHeight, getWidth(), y + rowHeight, linePaint);
            if (midi % 12 == 0) {
                linePaint.setColor(Color.rgb(71, 91, 100));
                linePaint.setStrokeWidth(1.5f * density);
                canvas.drawLine(keyboardWidth, y + rowHeight, getWidth(), y + rowHeight, linePaint);
            }
        }
    }

    private void drawTimeGrid(Canvas canvas) {
        double start = Math.max(0, scrollPixels / pixelsPerSecond);
        double end = start + (getWidth() - keyboardWidth) / pixelsPerSecond;
        double step = pixelsPerSecond < 48 * density ? 2 : pixelsPerSecond > 180 * density ? 0.25 : 1;
        double first = Math.floor(start / step) * step;
        paint.setTextSize(10 * density);
        paint.setColor(MUTED);
        paint.setTypeface(android.graphics.Typeface.create("sans", android.graphics.Typeface.NORMAL));
        linePaint.setStrokeWidth(1);
        for (double time = first; time <= end + step; time += step) {
            float x = timeToX(time);
            linePaint.setColor(time == Math.floor(time) ? GRID : Color.rgb(31, 45, 52));
            canvas.drawLine(x, 0, x, getHeight(), linePaint);
            if (time >= 0) canvas.drawText(formatTime(time), x + 4 * density, 13 * density, paint);
        }
    }

    private void drawNotes(Canvas canvas, List<StudioSession.NoteBlock> notes) {
        RectF rect = new RectF();
        paint.setStyle(Paint.Style.FILL);
        for (StudioSession.NoteBlock note : notes) {
            float left = timeToX(note.startSec);
            float right = timeToX(note.endSec);
            if (right < keyboardWidth || left > getWidth()) continue;
            float centerY = midiToY(note.targetMidi);
            rect.set(left, centerY - rowHeight * 0.37f, Math.max(left + 8 * density, right), centerY + rowHeight * 0.37f);
            boolean selected = note.id == selectedNoteId;
            paint.setColor(selected ? PINK : ACCENT_DARK);
            canvas.drawRoundRect(rect, 7 * density, 7 * density, paint);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(selected ? 2.5f * density : 1.25f * density);
            paint.setColor(selected ? Color.WHITE : ACCENT);
            canvas.drawRoundRect(rect, 7 * density, 7 * density, paint);
            paint.setStyle(Paint.Style.FILL);
            if (right - left > 45 * density) {
                paint.setTextSize(10 * density);
                paint.setColor(selected ? Color.WHITE : TEXT);
                canvas.drawText(noteName(note.targetMidi), left + 7 * density, centerY + 3.5f * density, paint);
            }
        }
    }

    private void drawPitchTrace(Canvas canvas, List<StudioSession.PitchFrame> frames) {
        trace.reset();
        boolean started = false;
        double previousTime = -10;
        for (StudioSession.PitchFrame frame : frames) {
            float x = timeToX(frame.timeSec);
            if (x < keyboardWidth - 10 || x > getWidth() + 10 || frame.confidence < 0.48) {
                started = false;
                continue;
            }
            float y = midiToY(frame.midi);
            if (y < -10 || y > getHeight() + 10) {
                started = false;
                continue;
            }
            if (!started || frame.timeSec - previousTime > 0.075) {
                trace.moveTo(x, y);
                started = true;
            } else trace.lineTo(x, y);
            previousTime = frame.timeSec;
        }
        linePaint.setStyle(Paint.Style.STROKE);
        linePaint.setStrokeWidth(2.1f * density);
        linePaint.setStrokeCap(Paint.Cap.ROUND);
        linePaint.setStrokeJoin(Paint.Join.ROUND);
        linePaint.setColor(TRACE);
        canvas.drawPath(trace, linePaint);
    }

    private void drawPlayhead(Canvas canvas) {
        float x = timeToX(playhead);
        if (x >= keyboardWidth && x <= getWidth()) {
            linePaint.setColor(recording ? PINK : Color.WHITE);
            linePaint.setStrokeWidth(1.5f * density);
            canvas.drawLine(x, 0, x, getHeight(), linePaint);
            paint.setColor(recording ? PINK : Color.WHITE);
            Path marker = new Path();
            marker.moveTo(x - 6 * density, 0);
            marker.lineTo(x + 6 * density, 0);
            marker.lineTo(x, 8 * density);
            marker.close();
            canvas.drawPath(marker, paint);
        }
    }

    private void drawKeyboard(Canvas canvas) {
        paint.setColor(INK);
        canvas.drawRect(0, 0, keyboardWidth, getHeight(), paint);
        int visible = (int) Math.ceil(getHeight() / rowHeight) + 2;
        int first = (int) Math.ceil(topMidi);
        paint.setTextSize(13 * density);
        paint.setTypeface(android.graphics.Typeface.create("sans", android.graphics.Typeface.BOLD));
        for (int i = 0; i < visible; i++) {
            int midi = first - i;
            float y = midiToY(midi) - rowHeight * 0.5f;
            if (isBlackKey(midi)) {
                paint.setColor(Color.rgb(28, 38, 44));
                canvas.drawRect(0, y, keyboardWidth * 0.68f, y + rowHeight, paint);
            } else {
                paint.setColor(Color.rgb(205, 218, 221));
                canvas.drawRect(0, y, keyboardWidth, y + rowHeight, paint);
            }
            linePaint.setColor(Color.rgb(7, 14, 18));
            linePaint.setStrokeWidth(1);
            canvas.drawLine(0, y + rowHeight, keyboardWidth, y + rowHeight, linePaint);
            paint.setColor(isBlackKey(midi) ? MUTED : Color.rgb(20, 31, 37));
            paint.setTextAlign(Paint.Align.CENTER);
            canvas.drawText(noteName(midi), keyboardWidth * (isBlackKey(midi) ? 0.34f : 0.5f),
                    y + rowHeight * 0.68f, paint);
        }
        paint.setTextAlign(Paint.Align.LEFT);
        linePaint.setColor(Color.rgb(73, 92, 100));
        canvas.drawLine(keyboardWidth, 0, keyboardWidth, getHeight(), linePaint);
    }

    private void drawLiveBadge(Canvas canvas) {
        if (liveFrame == null || !recording) return;
        int nearest = (int) Math.round(liveFrame.midi);
        int cents = (int) Math.round((liveFrame.midi - nearest) * 100);
        String text = noteName(nearest) + "  " + (cents >= 0 ? "+" : "") + cents + "c";
        paint.setTextSize(14 * density);
        paint.setTypeface(android.graphics.Typeface.create("sans", android.graphics.Typeface.BOLD));
        float width = paint.measureText(text) + 24 * density;
        RectF badge = new RectF(getWidth() - width - 10 * density, 10 * density,
                getWidth() - 10 * density, 43 * density);
        paint.setColor(Color.argb(230, 7, 14, 18));
        canvas.drawRoundRect(badge, 16 * density, 16 * density, paint);
        paint.setColor(Math.abs(cents) <= 10 ? ACCENT : TRACE);
        canvas.drawText(text, badge.left + 12 * density, badge.centerY() + 5 * density, paint);
    }

    @Override public boolean onTouchEvent(MotionEvent event) {
        scaleDetector.onTouchEvent(event);
        gestureDetector.onTouchEvent(event);
        if (event.getPointerCount() > 1 || scaleDetector.isInProgress()) {
            draggingNote = false;
            panning = false;
            return true;
        }
        float x = event.getX();
        float y = event.getY();
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN -> {
                downX = lastX = x;
                downY = lastY = y;
                StudioSession.NoteBlock hit = x > keyboardWidth ? hitNote(x, y) : null;
                if (hit != null) {
                    selectedNoteId = hit.id;
                    dragStartTarget = hit.targetMidi;
                    draggingNote = true;
                    panning = false;
                    if (listener != null) listener.onNoteSelected(hit);
                } else {
                    draggingNote = false;
                    panning = true;
                }
                invalidate();
                return true;
            }
            case MotionEvent.ACTION_MOVE -> {
                float dx = x - lastX;
                float dy = y - lastY;
                if (draggingNote && session != null) {
                    int delta = Math.round((downY - y) / rowHeight);
                    session.moveNote(selectedNoteId, dragStartTarget + delta, false);
                    StudioSession.NoteBlock note = session.noteById(selectedNoteId);
                    if (listener != null && note != null) listener.onNoteMoved(note);
                } else if (panning) {
                    if (x <= keyboardWidth && Math.abs(dy) > Math.abs(dx)) {
                        topMidi += dy / rowHeight;
                    } else {
                        scrollPixels -= dx;
                        topMidi += dy / rowHeight;
                    }
                    clampScroll();
                }
                lastX = x;
                lastY = y;
                invalidate();
                return true;
            }
            case MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (draggingNote && session != null) {
                    StudioSession.NoteBlock note = session.noteById(selectedNoteId);
                    if (note != null) {
                        session.commitMove(note.id, dragStartTarget, note.targetMidi);
                        if (listener != null) listener.onNoteMoved(note);
                    }
                } else if (event.getActionMasked() == MotionEvent.ACTION_UP
                        && Math.hypot(x - downX, y - downY) < 9 * density && x > keyboardWidth) {
                    cursor = Math.max(0, xToTime(x));
                    playhead = cursor;
                    if (listener != null) listener.onCursorChanged(cursor);
                }
                draggingNote = false;
                panning = false;
                invalidate();
                return true;
            }
        }
        return super.onTouchEvent(event);
    }

    private StudioSession.NoteBlock hitNote(float x, float y) {
        if (session == null) return null;
        List<StudioSession.NoteBlock> notes = session.noteSnapshot();
        for (int i = notes.size() - 1; i >= 0; i--) {
            StudioSession.NoteBlock note = notes.get(i);
            float left = timeToX(note.startSec) - 5 * density;
            float right = timeToX(note.endSec) + 5 * density;
            float centerY = midiToY(note.targetMidi);
            if (x >= left && x <= right && Math.abs(y - centerY) <= rowHeight * 0.52f) return note;
        }
        return null;
    }

    private float timeToX(double seconds) {
        return keyboardWidth + (float) (seconds * pixelsPerSecond) - scrollPixels;
    }

    private double xToTime(float x) {
        return (x - keyboardWidth + scrollPixels) / pixelsPerSecond;
    }

    private float midiToY(double midi) {
        return (float) ((topMidi - midi) * rowHeight);
    }

    private void clampScroll() {
        float max = session == null ? 0 : Math.max(0,
                (float) (session.durationSec * pixelsPerSecond - (getWidth() - keyboardWidth) * 0.25));
        scrollPixels = clamp(scrollPixels, 0, max);
        topMidi = Math.max(36, Math.min(102, topMidi));
    }

    static String noteName(int midi) {
        String[] names = {"C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"};
        int pitch = Math.floorMod(midi, 12);
        int octave = Math.floorDiv(midi, 12) - 1;
        return names[pitch] + octave;
    }

    private static boolean isBlackKey(int midi) {
        int pc = Math.floorMod(midi, 12);
        return pc == 1 || pc == 3 || pc == 6 || pc == 8 || pc == 10;
    }

    private static String formatTime(double seconds) {
        int whole = Math.max(0, (int) Math.floor(seconds));
        if (seconds != Math.floor(seconds)) return String.format(Locale.US, "%d.%02d", whole, (int) Math.round((seconds - whole) * 100));
        return String.format(Locale.US, "%d:%02d", whole / 60, whole % 60);
    }

    private static float clamp(float value, float min, float max) {
        return Math.max(min, Math.min(max, value));
    }
}
