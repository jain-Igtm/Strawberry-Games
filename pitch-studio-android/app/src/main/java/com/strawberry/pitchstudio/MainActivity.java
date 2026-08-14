package com.strawberry.pitchstudio;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.OutputStream;
import java.util.Locale;

public final class MainActivity extends Activity implements AudioEngine.Listener, PitchEditorView.Listener {
    private static final int REQUEST_MIC = 73;
    private static final int EXPORT_WAV = 301;
    private static final int EXPORT_MIDI = 302;
    private static final int EXPORT_MP3 = 303;
    private static final int INK = Color.rgb(7, 14, 18);
    private static final int SURFACE = Color.rgb(16, 27, 33);
    private static final int PANEL = Color.rgb(21, 35, 42);
    private static final int TEXT = Color.rgb(239, 247, 247);
    private static final int MUTED = Color.rgb(137, 158, 166);
    private static final int ACCENT = Color.rgb(124, 244, 202);
    private static final int PINK = Color.rgb(255, 85, 117);

    private final Handler ui = new Handler(Looper.getMainLooper());
    private StudioSession session;
    private AudioEngine audio;
    private PitchEditorView editor;
    private TextView liveNote;
    private TextView status;
    private Button recordButton;
    private Button playButton;
    private File pendingPcm;
    private boolean pendingRecordAfterPermission;
    private Runnable pendingSave;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(INK);
        getWindow().setNavigationBarColor(INK);
        session = StudioSession.load(new File(getFilesDir(), "current-session.json"));
        audio = new AudioEngine(this, session, this);
        buildInterface();
        editor.setSession(session);
        if (session.durationSec > 0) {
            status.setText(session.noteSnapshot().size() + " editable notes restored • pinch to zoom");
            editor.post(editor::focusAll);
        }
    }

    private void buildInterface() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(INK);
        root.setPadding(0, 0, 0, 0);

        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(16), dp(7), dp(14), dp(7));
        header.setBackgroundColor(INK);
        LinearLayout heading = new LinearLayout(this);
        heading.setOrientation(LinearLayout.VERTICAL);
        TextView title = label("PITCH STUDIO", 16, TEXT, Typeface.BOLD);
        title.setLetterSpacing(0.13f);
        status = label("Record a take • your complete pitch trace stays here", 11, MUTED, Typeface.NORMAL);
        status.setSingleLine(true);
        heading.addView(title);
        heading.addView(status);
        header.addView(heading, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        liveNote = label("—", 22, ACCENT, Typeface.BOLD);
        liveNote.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        header.addView(liveNote, new LinearLayout.LayoutParams(dp(116), dp(48)));
        root.addView(header, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(62)));

        editor = new PitchEditorView(this);
        editor.setListener(this);
        root.addView(editor, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        LinearLayout transport = new LinearLayout(this);
        transport.setGravity(Gravity.CENTER);
        transport.setPadding(dp(9), dp(7), dp(9), dp(7));
        transport.setBackgroundColor(INK);
        recordButton = actionButton("●  RECORD", PINK);
        playButton = actionButton("▶  PLAY", ACCENT);
        Button undoButton = actionButton("↶  UNDO", MUTED);
        Button fitButton = actionButton("↔  FIT", MUTED);
        Button exportButton = actionButton("EXPORT", Color.rgb(255, 215, 109));
        transport.addView(recordButton, weightedButton());
        transport.addView(playButton, weightedButton());
        transport.addView(undoButton, weightedButton());
        transport.addView(fitButton, weightedButton());
        transport.addView(exportButton, weightedButton());
        root.addView(transport, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(62)));

        recordButton.setOnClickListener(v -> recordPressed());
        playButton.setOnClickListener(v -> {
            if (audio.isRecording()) return;
            audio.togglePlayback(editor.cursorSeconds());
        });
        undoButton.setOnClickListener(v -> {
            if (session.undo()) {
                editor.invalidate();
                scheduleSave();
                status.setText("Last note move undone");
            }
        });
        fitButton.setOnClickListener(v -> editor.focusAll());
        exportButton.setOnClickListener(v -> showExportMenu());

        HorizontalScrollView scroller = new HorizontalScrollView(this);
        scroller.setHorizontalScrollBarEnabled(false);
        scroller.setFillViewport(false);
        scroller.setBackgroundColor(SURFACE);
        LinearLayout controls = new LinearLayout(this);
        controls.setPadding(dp(9), dp(8), dp(9), dp(9));
        controls.setGravity(Gravity.CENTER_VERTICAL);
        controls.addView(parameter("DEPTH", 0, 100, session.depthPercent,
                value -> value + "%", value -> {
                    session.depthPercent = value; session.markChanged(); scheduleSave();
                }));
        controls.addView(parameter("TUNE TIME", 0, 500, session.tuneTimeMs,
                value -> value + " ms", value -> {
                    session.tuneTimeMs = value; session.markChanged(); scheduleSave();
                }));
        controls.addView(toggleParameter("FORMANT LOCK", "Preserve vocal identity while retuning",
                session.formantPreserve, enabled -> {
                    session.formantPreserve = enabled; session.markChanged(); scheduleSave();
                    status.setText(enabled ? "Formant lock on • vocal color stays put while notes move"
                            : "Formant lock off • pitch shifts also move vocal color");
                }));
        controls.addView(parameter("FORMANT SHIFT", -1200, 1200, session.formantCents,
                value -> String.format(Locale.US, "%+.1f st", value / 100f), value -> {
                    session.formantCents = value; session.markChanged(); scheduleSave();
                }));
        controls.addView(parameter("VOLUME", 0, 24, Math.round(session.gainDb) + 12,
                value -> String.format(Locale.US, "%+.0f dB", (float) value - 12), value -> {
                    session.gainDb = value - 12; session.markChanged(); scheduleSave();
                }));
        controls.addView(parameter("MIDI TEMPO", 40, 220, session.bpm,
                value -> value + " BPM", value -> { session.bpm = value; scheduleSave(); }));
        scroller.addView(controls);
        root.addView(scroller, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(108)));
        setContentView(root);
    }

    private void recordPressed() {
        if (audio.isRecording()) {
            audio.stopRecording();
            return;
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingRecordAfterPermission = true;
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_MIC);
            return;
        }
        if (session.durationSec > 0) {
            new AlertDialog.Builder(this)
                    .setTitle("Record a new take?")
                    .setMessage("This replaces the working take. Export the current WAV or MIDI first if you want to keep it.")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("New take", (dialog, which) -> audio.startRecording())
                    .show();
        } else audio.startRecording();
    }

    private void showExportMenu() {
        if (!audio.pcmFile().exists() || audio.pcmFile().length() == 0) {
            toast("Record something first.");
            return;
        }
        String mp3 = Exporters.canEncodeMp3() ? "MP3 • corrected audio" : "MP3 • unavailable on this phone's codec";
        String[] choices = {"WAV • corrected 48 kHz audio", mp3, "MIDI • edited notes"};
        new AlertDialog.Builder(this).setTitle("Export take").setItems(choices, (dialog, which) -> {
            if (which == 2) {
                launchDocument(EXPORT_MIDI, "audio/midi", "strawberry-pitch.mid");
            } else if (which == 1 && !Exporters.canEncodeMp3()) {
                new AlertDialog.Builder(this)
                        .setTitle("No native MP3 encoder")
                        .setMessage("This Android build cannot encode MP3 without bundling a much larger codec. WAV export is lossless and works everywhere in the app.")
                        .setPositiveButton("Export WAV", (d, w) -> prepareAudioExport(EXPORT_WAV))
                        .setNegativeButton("Cancel", null).show();
            } else prepareAudioExport(which == 0 ? EXPORT_WAV : EXPORT_MP3);
        }).show();
    }

    private void prepareAudioExport(int requestCode) {
        audio.renderForExport(new AudioEngine.RenderCallback() {
            @Override public void onReady(File correctedPcm) {
                pendingPcm = correctedPcm;
                if (requestCode == EXPORT_WAV) launchDocument(requestCode, "audio/wav", "strawberry-pitch-corrected.wav");
                else launchDocument(requestCode, "audio/mpeg", "strawberry-pitch-corrected.mp3");
            }

            @Override public void onFailure(String message) {
                toast(message);
                status.setText(message);
            }
        });
    }

    private void launchDocument(int requestCode, String mime, String name) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(intent, requestCode);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null) return;
        Uri destination = data.getData();
        status.setText("Writing export…");
        new Thread(() -> {
            try {
                OutputStream out = getContentResolver().openOutputStream(destination, "w");
                if (out == null) throw new IllegalStateException("The selected file could not be opened");
                if (requestCode == EXPORT_MIDI) Exporters.writeMidi(session, out);
                else if (requestCode == EXPORT_WAV) Exporters.writeWav(pendingPcm, out);
                else if (requestCode == EXPORT_MP3) Exporters.writeMp3(pendingPcm, out);
                ui.post(() -> {
                    status.setText("Export saved • " + destination.getLastPathSegment());
                    toast("Export saved.");
                });
            } catch (Exception error) {
                ui.post(() -> {
                    status.setText("Export failed");
                    toast("Export failed: " + (error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage()));
                });
            }
        }, "pitch-file-export").start();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_MIC) return;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (granted && pendingRecordAfterPermission) audio.startRecording();
        else if (!granted) {
            new AlertDialog.Builder(this)
                    .setTitle("Microphone access is required")
                    .setMessage("Pitch Studio analyzes and records only while you press Record. Audio stays on your phone.")
                    .setPositiveButton("Settings", (dialog, which) -> {
                        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                Uri.parse("package:" + getPackageName()));
                        startActivity(intent);
                    }).setNegativeButton("Cancel", null).show();
        }
        pendingRecordAfterPermission = false;
    }

    @Override public void onPitch(StudioSession.PitchFrame frame) {
        int nearest = (int) Math.round(frame.midi);
        int cents = (int) Math.round((frame.midi - nearest) * 100);
        liveNote.setText(PitchEditorView.noteName(nearest) + "  " + (cents >= 0 ? "+" : "") + cents + "¢");
        liveNote.setTextColor(Math.abs(cents) <= 10 ? ACCENT : Color.rgb(255, 215, 109));
        editor.setLiveFrame(frame);
    }

    @Override public void onState(String state) { status.setText(state); }

    @Override public void onRecordingChanged(boolean recording) {
        recordButton.setText(recording ? "■  STOP" : "●  RECORD");
        editor.setRecording(recording);
        if (!recording) liveNote.setText("—");
    }

    @Override public void onPlaybackChanged(boolean playing) {
        playButton.setText(playing ? "■  STOP" : "▶  PLAY");
    }

    @Override public void onPlayhead(double seconds) { editor.setPlayhead(seconds); }

    @Override public void onSessionReady() {
        editor.setSession(session);
        editor.focusAll();
    }

    @Override public void onError(String message) { toast(message); }

    @Override public void onCursorChanged(double seconds) {
        status.setText("Cursor • " + formatTime(seconds) + " • Play starts here");
    }

    @Override public void onNoteSelected(StudioSession.NoteBlock note) {
        int cents = (int) Math.round((note.sourceMidi - Math.round(note.sourceMidi)) * 100);
        status.setText("Selected " + PitchEditorView.noteName(note.targetMidi) + " • sung "
                + (cents >= 0 ? "+" : "") + cents + "¢ • drag vertically");
    }

    @Override public void onNoteMoved(StudioSession.NoteBlock note) {
        status.setText("Moved to " + PitchEditorView.noteName(note.targetMidi) + " • release to commit");
        scheduleSave();
    }

    @Override protected void onPause() {
        super.onPause();
        if (audio.isRecording()) audio.stopRecording();
        if (audio.isPlaying()) audio.stopPlayback();
        audio.persist();
    }

    private void scheduleSave() {
        if (pendingSave != null) ui.removeCallbacks(pendingSave);
        pendingSave = audio::persist;
        ui.postDelayed(pendingSave, 400);
    }

    private LinearLayout parameter(String name, int min, int max, int initial,
                                   ValueText valueText, ValueChanged changed) {
        LinearLayout tile = tileBase();
        TextView title = label(name, 10, MUTED, Typeface.BOLD);
        title.setLetterSpacing(0.1f);
        TextView value = label(valueText.text(initial), 15, TEXT, Typeface.BOLD);
        SeekBar seek = new SeekBar(this);
        seek.setMax(max - min);
        seek.setProgress(Math.max(0, Math.min(max - min, initial - min)));
        seek.setProgressTintList(android.content.res.ColorStateList.valueOf(ACCENT));
        seek.setThumbTintList(android.content.res.ColorStateList.valueOf(ACCENT));
        seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                int actual = min + progress;
                value.setText(valueText.text(actual));
                if (fromUser) changed.changed(actual);
            }
            @Override public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override public void onStopTrackingTouch(SeekBar seekBar) {}
        });
        tile.addView(title);
        tile.addView(value);
        tile.addView(seek, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(36)));
        return tile;
    }

    private LinearLayout toggleParameter(String name, String detail, boolean initial,
                                         BooleanChanged changed) {
        LinearLayout tile = tileBase();
        TextView title = label(name, 10, MUTED, Typeface.BOLD);
        title.setLetterSpacing(0.1f);
        TextView body = label(detail, 10, MUTED, Typeface.NORMAL);
        body.setMaxLines(2);
        Switch toggle = new Switch(this);
        toggle.setText(initial ? "ON" : "OFF");
        toggle.setTextColor(TEXT);
        toggle.setTextSize(14);
        toggle.setChecked(initial);
        toggle.setButtonTintList(android.content.res.ColorStateList.valueOf(ACCENT));
        toggle.setOnCheckedChangeListener((button, enabled) -> {
            toggle.setText(enabled ? "ON" : "OFF");
            changed.changed(enabled);
        });
        tile.addView(title);
        tile.addView(toggle, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(38)));
        tile.addView(body);
        return tile;
    }

    private LinearLayout infoTile(String name, String value, String detail) {
        LinearLayout tile = tileBase();
        TextView title = label(name, 10, MUTED, Typeface.BOLD);
        title.setLetterSpacing(0.1f);
        tile.addView(title);
        tile.addView(label(value, 15, Color.rgb(255, 215, 109), Typeface.BOLD));
        TextView body = label(detail, 10, MUTED, Typeface.NORMAL);
        body.setMaxLines(2);
        tile.addView(body);
        return tile;
    }

    private LinearLayout tileBase() {
        LinearLayout tile = new LinearLayout(this);
        tile.setOrientation(LinearLayout.VERTICAL);
        tile.setPadding(dp(10), dp(6), dp(10), dp(4));
        GradientDrawable background = new GradientDrawable();
        background.setColor(PANEL);
        background.setCornerRadius(dp(11));
        background.setStroke(dp(1), Color.rgb(45, 63, 71));
        tile.setBackground(background);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(154), dp(91));
        params.setMargins(0, 0, dp(7), 0);
        tile.setLayoutParams(params);
        return tile;
    }

    private Button actionButton(String text, int color) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextSize(10);
        button.setTextColor(TEXT);
        button.setTypeface(Typeface.create("sans", Typeface.BOLD));
        button.setPadding(dp(3), 0, dp(3), 0);
        button.setMinWidth(0);
        button.setMinimumWidth(0);
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.rgb(20, 32, 39));
        background.setCornerRadius(dp(10));
        background.setStroke(dp(1), color);
        button.setBackground(background);
        return button;
    }

    private LinearLayout.LayoutParams weightedButton() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1);
        params.setMargins(dp(3), 0, dp(3), 0);
        return params;
    }

    private TextView label(String text, int sp, int color, int style) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(sp);
        view.setTextColor(color);
        view.setTypeface(Typeface.create("sans", style));
        view.setIncludeFontPadding(false);
        return view;
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_LONG).show(); }

    private static String formatTime(double seconds) {
        int total = Math.max(0, (int) seconds);
        return String.format(Locale.US, "%d:%02d.%d", total / 60, total % 60,
                (int) ((seconds - Math.floor(seconds)) * 10));
    }

    private interface ValueText { String text(int value); }
    private interface ValueChanged { void changed(int value); }
    private interface BooleanChanged { void changed(boolean value); }
}
