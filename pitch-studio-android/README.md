# Strawberry Pitch Studio

Native Android pitch monitor and editable vocal piano roll. The app records mono 48 kHz PCM,
tracks sung pitch with a YIN detector, keeps the complete pitch history, segments voiced audio
into large touch targets, and lets the singer drag each detected note vertically by semitone.

## Working in version 0.1

- live note, cents, frequency-confidence, and pitch trace while recording
- retained two-axis scroll, pinch zoom, fit-to-take, and tap-to-scrub timeline
- readable F2–F5-style keyboard rows with octave labels
- non-destructive note selection, vertical dragging, and undo
- corrected preview using offline granular pitch rendering
- active Depth, Tune Time, Volume, and MIDI Tempo controls
- corrected 48 kHz WAV export
- edited Standard MIDI File export
- MP3 export when the Android device exposes a native `audio/mpeg` encoder
- automatic restoration of the current audio take and edit session after relaunch

## Honest DSP boundary

The version 0.1 renderer is intended for audible proofing of pitch edits. It is not yet a
phase-coherent, formant-preserving vocal processor. The Formant tile is intentionally marked as
the second DSP pass rather than presented as a control that does nothing. Building that stage
requires LPC/spectral-envelope processing and more device testing.

## Build

The GitHub Actions workflow at `.github/workflows/build-pitch-studio-apk.yml` runs the pitch
detector unit test and builds a debug APK. Locally, with Android SDK 35 and Gradle 8.10.2:

```sh
cd pitch-studio-android
gradle :app:testDebugUnitTest :app:assembleDebug
```
