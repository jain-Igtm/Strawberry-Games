# Strawberry Pitch Studio

Native Android pitch monitor and editable vocal piano roll. The app records mono 48 kHz PCM,
tracks sung pitch with a YIN detector, keeps the complete pitch history, segments voiced audio
into large touch targets, and lets the singer drag each detected note vertically by semitone.

## Working in version 0.3

- live note, cents, frequency-confidence, and pitch trace while recording
- retained two-axis scroll, pinch zoom, fit-to-take, and tap-to-scrub timeline
- frame-smoothed recording follow instead of detector-frame scroll jumps
- readable F2–F5-style keyboard rows with octave labels
- finger-sized note grab targets, vertical dragging, and undo
- optional, subdued yellow pitch curve showing the exact sung contour beneath note blocks
- corrected preview using native formant-aware spectral pitch rendering
- Formant Lock for preserving vocal identity while notes move
- independent ±12-semitone Formant Shift for changing vocal color without changing note pitch
- active Depth, Tune Time, Formant, Volume, and MIDI Tempo controls
- corrected 48 kHz WAV export
- edited Standard MIDI File export
- MP3 export when the Android device exposes a native `audio/mpeg` encoder
- automatic restoration of the current audio take and edit session after relaunch

## DSP engine

Version 0.2 replaces the original granular proof renderer with a native C++ spectral processor
based on Signalsmith Stretch. Corrected playback and WAV/MP3 exports now use phase-coherent pitch
shifting, spectral formant compensation, and independent formant shifting. Formant analysis is
seeded from each detected vocal note and can fall back to automatic fundamental estimation.

This is real formant DSP, but it is not represented as a drop-in replacement for Melodyne's
multi-pass monophonic analysis or Auto-Tune's production-tuned real-time engine. Extreme edits,
breathy consonants, room echo, and polyphonic input can still produce artifacts.

Signalsmith Stretch and Signalsmith Linear are vendored under their MIT licenses in
`app/src/main/cpp/third_party/`.

## Build

The GitHub Actions workflow at `.github/workflows/build-pitch-studio-apk.yml` runs the pitch
detector unit test and builds a debug APK. Locally, with Android SDK 35 and Gradle 8.10.2:

```sh
cd pitch-studio-android
gradle :app:testDebugUnitTest :app:assembleDebug
```
