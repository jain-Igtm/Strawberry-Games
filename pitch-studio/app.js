import {
  NOTE_NAMES,
  buildNoteSegments,
  centsFromNearest,
  clamp,
  concatenateChunks,
  detectPitchYin,
  encodeMidi,
  encodeWav,
  hzToMidi,
  midiToName,
} from "./pitch-engine.js";

const $ = (selector) => document.querySelector(selector);
const ui = {
  currentNote: $("#currentNote"), currentOctave: $("#currentOctave"), cents: $("#centsReadout"),
  hz: $("#hzReadout"), clarity: $("#clarityReadout"), centNeedle: $("#centNeedle"),
  monitor: $("#monitorButton"), record: $("#recordButton"), stop: $("#stopButton"),
  play: $("#playButton"), rewind: $("#rewindButton"), export: $("#exportButton"),
  takeStatus: $("#takeStatus"), time: $("#timeReadout"), empty: $("#emptyState"),
  rollScroller: $("#rollScroller"), roll: $("#rollCanvas"), rail: $("#railCanvas"), timeline: $("#timelineCanvas"),
  timelineViewport: $("#timelineViewport"), noteRail: $("#noteRail"), playhead: $("#playhead"),
  zoom: $("#zoomSlider"), snap: $("#snapButton"), undo: $("#undoButton"), redo: $("#redoButton"),
  importButton: $("#importButton"), audioInput: $("#audioInput"), newTake: $("#newTakeButton"),
  inspector: $("#noteInspector"), selectedName: $("#selectedNoteName"), closeInspector: $("#closeInspector"),
  pitchControl: $("#pitchControl"), pitchOutput: $("#pitchOutput"),
  tuneTimeControl: $("#tuneTimeControl"), tuneTimeOutput: $("#tuneTimeOutput"),
  depthControl: $("#depthControl"), depthOutput: $("#depthOutput"),
  formantControl: $("#formantControl"), formantOutput: $("#formantOutput"),
  gainControl: $("#gainControl"), gainOutput: $("#gainOutput"),
  driftControl: $("#driftControl"), driftOutput: $("#driftOutput"),
  split: $("#splitButton"), deleteNote: $("#deleteNoteButton"), exportDialog: $("#exportDialog"),
  wavExport: $("#wavExport"), mp3Export: $("#mp3Export"), midiExport: $("#midiExport"),
  sessionExport: $("#sessionExport"), tempo: $("#tempoInput"), toast: $("#toast"),
};

const MIN_MIDI = 36;
const MAX_MIDI = 84;
const LANE_HEIGHT = 44;
const MIN_ROLL_SECONDS = 8;
const ANALYSIS_FRAME = 2048;
const ANALYSIS_HOP = 1152;
const state = {
  audioContext: null,
  stream: null,
  sourceNode: null,
  analyser: null,
  captureNode: null,
  silentGain: null,
  isMonitoring: false,
  isRecording: false,
  isAnalyzing: false,
  recordingStartedAt: 0,
  chunks: [],
  samples: null,
  sampleRate: 48000,
  points: [],
  notes: [],
  duration: MIN_ROLL_SECONDS,
  pxPerSecond: Number(ui.zoom.value),
  tuning: 440,
  selectedId: null,
  snap: true,
  undo: [],
  redo: [],
  takeNumber: 1,
  takeName: "No take",
  playPosition: 0,
  playSource: null,
  playStartedAt: 0,
  playOffset: 0,
  playAnimation: 0,
  monitorAnimation: 0,
  lastPitchAt: 0,
  lastLiveSegmentAt: 0,
  drag: null,
  toastTimer: 0,
  wakeLock: null,
};

function showToast(message, duration = 2600) {
  clearTimeout(state.toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  state.toastTimer = setTimeout(() => ui.toast.classList.remove("show"), duration);
}

function formatTime(seconds) {
  const safe = Math.max(0, seconds || 0);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const remainder = (safe % 60).toFixed(1).padStart(4, "0");
  return `${minutes}:${remainder}`;
}

function safeFileName(extension) {
  const base = state.takeName === "No take" ? "strawberry-pitch" : state.takeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "strawberry-pitch"}.${extension}`;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function setCanvasSize(canvas, width, height) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return context;
}

function rollDimensions() {
  const viewportWidth = Math.max(280, ui.rollScroller.clientWidth || window.innerWidth - 66);
  const seconds = Math.max(MIN_ROLL_SECONDS, state.duration + 1.25);
  return {
    width: Math.ceil(Math.max(viewportWidth * 1.3, seconds * state.pxPerSecond)),
    height: (MAX_MIDI - MIN_MIDI + 1) * LANE_HEIGHT,
  };
}

function midiToY(midi) {
  return (MAX_MIDI - midi) * LANE_HEIGHT + LANE_HEIGHT / 2;
}

function yToMidi(y) {
  return MAX_MIDI - (y - LANE_HEIGHT / 2) / LANE_HEIGHT;
}

function timeToX(time) {
  return time * state.pxPerSecond;
}

function drawRail(height) {
  const ctx = setCanvasSize(ui.rail, 66, height);
  ctx.fillStyle = "#11151b";
  ctx.fillRect(0, 0, 66, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let midi = MAX_MIDI; midi >= MIN_MIDI; midi -= 1) {
    const top = (MAX_MIDI - midi) * LANE_HEIGHT;
    const chroma = ((midi % 12) + 12) % 12;
    const isBlack = [1, 3, 6, 8, 10].includes(chroma);
    ctx.fillStyle = isBlack ? "#0c0f13" : chroma === 0 ? "#e7edf2" : "#c5cdd6";
    const keyWidth = isBlack ? 49 : 66;
    ctx.fillRect(0, top + 1, keyWidth, LANE_HEIGHT - 2);
    ctx.fillStyle = "#161b21";
    ctx.font = `${chroma === 0 ? 800 : 680} 13px ui-sans-serif, system-ui`;
    ctx.fillText(midiToName(midi), isBlack ? 25 : 33, top + LANE_HEIGHT / 2);
    ctx.strokeStyle = "rgba(15,19,24,.65)";
    ctx.beginPath();
    ctx.moveTo(0, top + LANE_HEIGHT);
    ctx.lineTo(66, top + LANE_HEIGHT);
    ctx.stroke();
  }
}

function drawTimeline(width) {
  const ctx = setCanvasSize(ui.timeline, width, 30);
  ctx.fillStyle = "#151a21";
  ctx.fillRect(0, 0, width, 30);
  const minor = state.pxPerSecond >= 150 ? 0.25 : state.pxPerSecond >= 85 ? 0.5 : 1;
  for (let time = 0; time <= width / state.pxPerSecond; time += minor) {
    const x = timeToX(time);
    const whole = Math.abs(time - Math.round(time)) < 0.001;
    ctx.strokeStyle = whole ? "#76808d" : "#3b434e";
    ctx.beginPath();
    ctx.moveTo(x + .5, whole ? 12 : 20);
    ctx.lineTo(x + .5, 30);
    ctx.stroke();
    if (whole) {
      ctx.fillStyle = "#9ca6b2";
      ctx.font = "700 9px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.fillText(formatTime(time).replace(/^00:/, ""), x + 4, 10);
    }
  }
}

function drawRoll() {
  const { width, height } = rollDimensions();
  const ctx = setCanvasSize(ui.roll, width, height);
  const blackKeys = new Set([1, 3, 6, 8, 10]);
  for (let midi = MAX_MIDI; midi >= MIN_MIDI; midi -= 1) {
    const top = (MAX_MIDI - midi) * LANE_HEIGHT;
    const chroma = ((midi % 12) + 12) % 12;
    ctx.fillStyle = blackKeys.has(chroma) ? "#0c1014" : chroma === 0 ? "#181e25" : "#141920";
    ctx.fillRect(0, top, width, LANE_HEIGHT);
    ctx.strokeStyle = chroma === 0 ? "#39424e" : "#252c35";
    ctx.beginPath();
    ctx.moveTo(0, top + .5);
    ctx.lineTo(width, top + .5);
    ctx.stroke();
  }

  const minor = state.pxPerSecond >= 160 ? .25 : .5;
  for (let time = 0; time <= width / state.pxPerSecond; time += minor) {
    const x = timeToX(time);
    const whole = Math.abs(time - Math.round(time)) < .001;
    ctx.strokeStyle = whole ? "rgba(112,124,139,.34)" : "rgba(73,83,95,.18)";
    ctx.lineWidth = whole ? 1.2 : 1;
    ctx.beginPath();
    ctx.moveTo(x + .5, 0);
    ctx.lineTo(x + .5, height);
    ctx.stroke();
  }

  if (state.points.length > 1) {
    ctx.strokeStyle = "rgba(255,134,106,.72)";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    let drawing = false;
    let priorTime = -1;
    for (const point of state.points) {
      if (!Number.isFinite(point.midi) || point.clarity < .48 || point.time - priorTime > .18) drawing = false;
      const x = timeToX(point.time);
      const y = midiToY(point.midi);
      if (!drawing) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      drawing = Number.isFinite(point.midi) && point.clarity >= .48;
      priorTime = point.time;
    }
    ctx.stroke();
  }

  for (const note of state.notes) {
    const midi = note.targetMidi + (note.shift || 0);
    const x = timeToX(note.start);
    const y = midiToY(midi) - 14;
    const noteWidth = Math.max(12, timeToX(note.end - note.start));
    const selected = note.id === state.selectedId;
    const gradient = ctx.createLinearGradient(x, y, x, y + 28);
    gradient.addColorStop(0, selected ? "#7eeee6" : "#ff806d");
    gradient.addColorStop(1, selected ? "#3eb9b4" : "#d74a50");
    ctx.fillStyle = gradient;
    ctx.globalAlpha = .93;
    ctx.beginPath();
    ctx.roundRect(x + 1, y, noteWidth - 2, 28, Math.min(8, noteWidth / 3));
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = selected ? "rgba(220,255,253,.9)" : "rgba(255,190,170,.45)";
    ctx.lineWidth = selected ? 1.7 : 1;
    ctx.stroke();
    if (noteWidth > 45) {
      ctx.fillStyle = selected ? "#082120" : "#351116";
      ctx.font = "800 9px ui-sans-serif, system-ui";
      ctx.textBaseline = "middle";
      ctx.fillText(midiToName(midi), x + 8, y + 14);
    }
  }
  drawRail(height);
  drawTimeline(width);
  syncCanvasTransforms();
  ui.empty.hidden = Boolean(state.samples || state.isRecording || state.points.length);
}

function syncCanvasTransforms() {
  const { scrollLeft, scrollTop } = ui.rollScroller;
  ui.rail.style.transform = `translateY(${-scrollTop}px)`;
  ui.timeline.style.transform = `translateX(${-scrollLeft}px)`;
  updatePlayhead(state.playPosition);
}

function updatePlayhead(time) {
  state.playPosition = clamp(time || 0, 0, state.duration || 0);
  ui.time.textContent = formatTime(state.playPosition);
  const left = 66 + timeToX(state.playPosition) - ui.rollScroller.scrollLeft;
  const workspaceWidth = $("#workspace").clientWidth;
  ui.playhead.style.left = `${left}px`;
  ui.playhead.style.display = state.samples && left >= 66 && left <= workspaceWidth ? "block" : "none";
}

function noteAtPoint(x, y) {
  for (let i = state.notes.length - 1; i >= 0; i -= 1) {
    const note = state.notes[i];
    const top = midiToY(note.targetMidi + (note.shift || 0)) - 18;
    if (x >= timeToX(note.start) - 5 && x <= timeToX(note.end) + 5 && y >= top && y <= top + 36) return note;
  }
  return null;
}

function snapshotNotes() {
  return JSON.stringify(state.notes);
}

function pushUndo() {
  state.undo.push(snapshotNotes());
  if (state.undo.length > 60) state.undo.shift();
  state.redo.length = 0;
  updateUndoButtons();
}

function restoreSnapshot(serialized) {
  state.notes = JSON.parse(serialized);
  if (!state.notes.some((note) => note.id === state.selectedId)) closeInspector();
  drawRoll();
  saveLatestTake();
}

function updateUndoButtons() {
  ui.undo.disabled = !state.undo.length;
  ui.redo.disabled = !state.redo.length;
}

function undo() {
  if (!state.undo.length) return;
  state.redo.push(snapshotNotes());
  restoreSnapshot(state.undo.pop());
  updateUndoButtons();
}

function redo() {
  if (!state.redo.length) return;
  state.undo.push(snapshotNotes());
  restoreSnapshot(state.redo.pop());
  updateUndoButtons();
}

function selectedNote() {
  return state.notes.find((note) => note.id === state.selectedId) || null;
}

function selectNote(note) {
  state.selectedId = note?.id || null;
  if (!note) {
    closeInspector();
    return;
  }
  ui.inspector.classList.add("open");
  ui.inspector.setAttribute("aria-hidden", "false");
  syncInspector(note);
  drawRoll();
}

function closeInspector() {
  state.selectedId = null;
  ui.inspector.classList.remove("open");
  ui.inspector.setAttribute("aria-hidden", "true");
  drawRoll();
}

function syncInspector(note = selectedNote()) {
  if (!note) return;
  const cents = Math.round((note.shift || 0) * 100);
  ui.selectedName.textContent = midiToName(note.targetMidi + (note.shift || 0));
  ui.pitchControl.value = cents;
  ui.pitchOutput.value = `${cents > 0 ? "+" : ""}${cents} ct`;
  ui.tuneTimeControl.value = note.tuneTime ?? 90;
  ui.tuneTimeOutput.value = `${note.tuneTime ?? 90} ms`;
  ui.depthControl.value = note.depth ?? 100;
  ui.depthOutput.value = `${note.depth ?? 100}%`;
  ui.formantControl.value = note.formant ?? 0;
  ui.formantOutput.value = Number(note.formant ?? 0).toFixed(1);
  ui.gainControl.value = note.gain ?? 0;
  ui.gainOutput.value = `${note.gain > 0 ? "+" : ""}${note.gain ?? 0} dB`;
  ui.driftControl.value = note.drift ?? 0;
  ui.driftOutput.value = `${note.drift ?? 0}%`;
}

function updateMeter(result) {
  if (!result) {
    if (performance.now() - state.lastPitchAt > 220) {
      ui.currentNote.textContent = "—";
      ui.currentOctave.textContent = "";
      ui.cents.textContent = state.isMonitoring ? "LISTENING" : "READY";
      ui.hz.textContent = state.isMonitoring ? "Sing a steady note" : "Tap Monitor";
      ui.clarity.textContent = `A4 = ${state.tuning} Hz`;
      ui.centNeedle.style.opacity = ".3";
    }
    return;
  }
  state.lastPitchAt = performance.now();
  const midi = hzToMidi(result.hz, state.tuning);
  const fullName = midiToName(midi);
  const match = fullName.match(/^(.+?)(-?\d+)$/);
  const cents = centsFromNearest(midi);
  ui.currentNote.textContent = match?.[1] || fullName;
  ui.currentOctave.textContent = match?.[2] || "";
  ui.cents.textContent = `${cents >= 0 ? "+" : ""}${Math.round(cents)} CENTS`;
  ui.hz.textContent = `${result.hz.toFixed(1)} Hz`;
  ui.clarity.textContent = `${Math.round(result.clarity * 100)}% clear`;
  ui.centNeedle.style.left = `${clamp(cents + 50, 0, 100)}%`;
  ui.centNeedle.style.opacity = "1";
  return { ...result, midi };
}

async function ensureAudio() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot open a microphone.");
  if (!state.audioContext) state.audioContext = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
  if (state.audioContext.state === "suspended") await state.audioContext.resume();
  if (state.stream?.active) return;
  state.stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: { ideal: 48000 } },
  });
  state.sampleRate = state.audioContext.sampleRate;
  state.sourceNode = state.audioContext.createMediaStreamSource(state.stream);
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = ANALYSIS_FRAME;
  state.analyser.smoothingTimeConstant = 0;
  state.captureNode = state.audioContext.createScriptProcessor(4096, 1, 1);
  state.silentGain = state.audioContext.createGain();
  state.silentGain.gain.value = 0;
  state.captureNode.onaudioprocess = (event) => {
    if (!state.isRecording) return;
    state.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };
  state.sourceNode.connect(state.analyser);
  state.sourceNode.connect(state.captureNode);
  state.captureNode.connect(state.silentGain);
  state.silentGain.connect(state.audioContext.destination);
}

function stopMicNodes() {
  cancelAnimationFrame(state.monitorAnimation);
  state.stream?.getTracks().forEach((track) => track.stop());
  for (const node of [state.sourceNode, state.analyser, state.captureNode, state.silentGain]) {
    try { node?.disconnect(); } catch { /* already disconnected */ }
  }
  state.stream = null;
  state.sourceNode = null;
  state.analyser = null;
  state.captureNode = null;
  state.silentGain = null;
}

function monitorLoop() {
  if (!state.isMonitoring || !state.analyser) return;
  const buffer = new Float32Array(state.analyser.fftSize);
  state.analyser.getFloatTimeDomainData(buffer);
  const detected = detectPitchYin(buffer, state.sampleRate, { minHz: 65, maxHz: 1100, threshold: .14 });
  const measured = updateMeter(detected);
  if (state.isRecording && measured) {
    const time = (performance.now() - state.recordingStartedAt) / 1000;
    const lastPoint = state.points.at(-1);
    if (!lastPoint || time - lastPoint.time >= .028) state.points.push({ time, midi: measured.midi, hz: measured.hz, clarity: measured.clarity, rms: measured.rms });
    state.duration = Math.max(MIN_ROLL_SECONDS, time + .7);
    if (performance.now() - state.lastLiveSegmentAt > 230) {
      state.notes = buildNoteSegments(state.points);
      state.lastLiveSegmentAt = performance.now();
      drawRoll();
      ui.rollScroller.scrollLeft = Math.max(0, timeToX(time) - ui.rollScroller.clientWidth * .68);
      updatePlayhead(time);
    }
  }
  state.monitorAnimation = requestAnimationFrame(monitorLoop);
}

async function toggleMonitor(force) {
  const next = typeof force === "boolean" ? force : !state.isMonitoring;
  if (next === state.isMonitoring) return;
  if (next) {
    try {
      await ensureAudio();
      state.isMonitoring = true;
      ui.monitor.classList.add("active");
      ui.monitor.setAttribute("aria-pressed", "true");
      ui.monitor.querySelector("span:last-child").textContent = "Listening";
      monitorLoop();
    } catch (error) {
      showToast(error.name === "NotAllowedError" ? "Microphone permission was blocked. Allow it in your browser settings." : error.message, 4200);
    }
  } else if (!state.isRecording) {
    state.isMonitoring = false;
    ui.monitor.classList.remove("active");
    ui.monitor.setAttribute("aria-pressed", "false");
    ui.monitor.querySelector("span:last-child").textContent = "Monitor";
    stopMicNodes();
    updateMeter(null);
  }
}

async function requestWakeLock() {
  try { if ("wakeLock" in navigator) state.wakeLock = await navigator.wakeLock.request("screen"); } catch { /* optional */ }
}

async function startRecording() {
  if (state.isRecording || state.isAnalyzing) return;
  stopPlayback();
  try {
    await ensureAudio();
    state.isMonitoring = true;
    ui.monitor.classList.add("active");
    ui.monitor.setAttribute("aria-pressed", "true");
    ui.monitor.querySelector("span:last-child").textContent = "Listening";
    cancelAnimationFrame(state.monitorAnimation);
    state.chunks = [];
    state.samples = null;
    state.points = [];
    state.notes = [];
    state.selectedId = null;
    state.undo = [];
    state.redo = [];
    state.duration = MIN_ROLL_SECONDS;
    state.playPosition = 0;
    state.takeName = `Take ${state.takeNumber}`;
    state.takeNumber += 1;
    state.recordingStartedAt = performance.now();
    state.isRecording = true;
    ui.record.classList.add("recording");
    ui.record.setAttribute("aria-label", "Stop recording");
    ui.stop.disabled = false;
    ui.play.disabled = true;
    ui.rewind.disabled = true;
    ui.export.disabled = true;
    ui.takeStatus.textContent = `Recording ${state.takeName}`;
    ui.empty.hidden = true;
    drawRoll();
    await requestWakeLock();
    monitorLoop();
  } catch (error) {
    showToast(error.name === "NotAllowedError" ? "Allow microphone access to record." : error.message, 4000);
  }
}

async function stopRecording() {
  if (!state.isRecording) return;
  state.isRecording = false;
  ui.record.classList.remove("recording");
  ui.record.setAttribute("aria-label", "Start recording");
  ui.stop.disabled = true;
  state.wakeLock?.release?.();
  state.wakeLock = null;
  const samples = concatenateChunks(state.chunks);
  state.chunks = [];
  if (!samples.length) {
    state.takeStatus.textContent = "No audio captured";
    showToast("No audio reached the recorder.");
    return;
  }
  state.samples = samples;
  state.duration = samples.length / state.sampleRate;
  updatePlayhead(0);
  await analyzeSamples(samples, state.sampleRate);
  ui.play.disabled = false;
  ui.rewind.disabled = false;
  ui.export.disabled = false;
  ui.takeStatus.textContent = `${state.takeName} · ${state.notes.length} notes`;
  await saveLatestTake();
  showToast("Take saved on this device.");
}

async function analyzeSamples(samples, sampleRate) {
  state.isAnalyzing = true;
  ui.takeStatus.textContent = "Analyzing pitch…";
  const points = [];
  const totalFrames = Math.max(1, Math.floor((samples.length - ANALYSIS_FRAME) / ANALYSIS_HOP));
  for (let offset = 0, frame = 0; offset + ANALYSIS_FRAME <= samples.length; offset += ANALYSIS_HOP, frame += 1) {
    const slice = samples.subarray(offset, offset + ANALYSIS_FRAME);
    const result = detectPitchYin(slice, sampleRate, { minHz: 65, maxHz: 1100, threshold: .14 });
    if (result) points.push({ time: (offset + ANALYSIS_FRAME / 2) / sampleRate, midi: hzToMidi(result.hz, state.tuning), hz: result.hz, clarity: result.clarity, rms: result.rms });
    if (frame % 34 === 0) {
      ui.takeStatus.textContent = `Analyzing ${Math.min(99, Math.round((frame / totalFrames) * 100))}%`;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }
  state.points = points;
  state.notes = buildNoteSegments(points, { frameStep: ANALYSIS_HOP / sampleRate });
  state.isAnalyzing = false;
  drawRoll();
  centerPitchRange();
}

function centerPitchRange() {
  const pitches = state.points.filter((point) => Number.isFinite(point.midi)).map((point) => point.midi);
  const center = pitches.length ? pitches.sort((a, b) => a - b)[Math.floor(pitches.length / 2)] : 60;
  ui.rollScroller.scrollTop = clamp(midiToY(center) - ui.rollScroller.clientHeight / 2, 0, rollDimensions().height - ui.rollScroller.clientHeight);
  ui.rollScroller.scrollLeft = 0;
  syncCanvasTransforms();
}

async function importAudio(file) {
  if (!file) return;
  stopPlayback();
  ui.takeStatus.textContent = "Opening audio…";
  try {
    if (!state.audioContext) state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer.slice(0));
    const mono = new Float32Array(audioBuffer.length);
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const data = audioBuffer.getChannelData(channel);
      for (let i = 0; i < data.length; i += 1) mono[i] += data[i] / audioBuffer.numberOfChannels;
    }
    state.samples = mono;
    state.sampleRate = audioBuffer.sampleRate;
    state.duration = audioBuffer.duration;
    state.takeName = file.name.replace(/\.[^.]+$/, "") || `Take ${state.takeNumber++}`;
    state.undo = [];
    state.redo = [];
    state.playPosition = 0;
    await analyzeSamples(mono, audioBuffer.sampleRate);
    ui.takeStatus.textContent = `${state.takeName} · ${state.notes.length} notes`;
    ui.play.disabled = false;
    ui.rewind.disabled = false;
    ui.export.disabled = false;
    await saveLatestTake();
  } catch (error) {
    ui.takeStatus.textContent = "Import failed";
    showToast(`I couldn't decode that audio file: ${error.message}`, 4200);
  } finally {
    ui.audioInput.value = "";
  }
}

function makeAudioBuffer() {
  const context = state.audioContext;
  const buffer = context.createBuffer(1, state.samples.length, state.sampleRate);
  buffer.copyToChannel(state.samples, 0);
  return buffer;
}

async function play() {
  if (!state.samples || state.isRecording) return;
  if (state.playSource) {
    pausePlayback();
    return;
  }
  if (!state.audioContext) state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  await state.audioContext.resume();
  if (state.playPosition >= state.duration - .02) updatePlayhead(0);
  const source = state.audioContext.createBufferSource();
  source.buffer = makeAudioBuffer();
  source.connect(state.audioContext.destination);
  state.playSource = source;
  state.playOffset = state.playPosition;
  state.playStartedAt = state.audioContext.currentTime;
  source.start(0, state.playOffset);
  source.onended = () => {
    if (state.playSource !== source) return;
    state.playSource = null;
    ui.play.textContent = "▶";
    if (state.playPosition >= state.duration - .04) updatePlayhead(0);
    cancelAnimationFrame(state.playAnimation);
  };
  ui.play.textContent = "Ⅱ";
  playbackLoop();
}

function playbackLoop() {
  if (!state.playSource) return;
  const elapsed = state.audioContext.currentTime - state.playStartedAt;
  const time = clamp(state.playOffset + elapsed, 0, state.duration);
  updatePlayhead(time);
  const x = timeToX(time);
  if (x - ui.rollScroller.scrollLeft > ui.rollScroller.clientWidth * .82) ui.rollScroller.scrollLeft = Math.max(0, x - ui.rollScroller.clientWidth * .25);
  state.playAnimation = requestAnimationFrame(playbackLoop);
}

function pausePlayback() {
  if (!state.playSource) return;
  const elapsed = state.audioContext.currentTime - state.playStartedAt;
  state.playPosition = clamp(state.playOffset + elapsed, 0, state.duration);
  const source = state.playSource;
  state.playSource = null;
  source.stop();
  cancelAnimationFrame(state.playAnimation);
  ui.play.textContent = "▶";
  updatePlayhead(state.playPosition);
}

function stopPlayback(reset = false) {
  if (state.playSource) {
    const source = state.playSource;
    state.playSource = null;
    try { source.stop(); } catch { /* already ended */ }
  }
  cancelAnimationFrame(state.playAnimation);
  ui.play.textContent = "▶";
  if (reset) updatePlayhead(0);
}

function clearTake() {
  if (state.samples && !window.confirm("Clear this take and its pitch edits? Your exported files will not be affected.")) return;
  stopPlayback(true);
  state.samples = null;
  state.points = [];
  state.notes = [];
  state.duration = MIN_ROLL_SECONDS;
  state.selectedId = null;
  state.takeName = "No take";
  state.undo = [];
  state.redo = [];
  ui.play.disabled = true;
  ui.rewind.disabled = true;
  ui.export.disabled = true;
  ui.takeStatus.textContent = "No take";
  closeInspector();
  updateUndoButtons();
  drawRoll();
  deleteLatestTake();
}

function splitSelectedNote() {
  const note = selectedNote();
  if (!note) return;
  const splitAt = state.playPosition;
  if (splitAt <= note.start + .04 || splitAt >= note.end - .04) {
    showToast("Move the playhead inside this note before splitting it.");
    return;
  }
  pushUndo();
  const index = state.notes.indexOf(note);
  const left = { ...note, id: `${note.id}-a-${Date.now()}`, end: splitAt };
  const right = { ...note, id: `${note.id}-b-${Date.now()}`, start: splitAt };
  state.notes.splice(index, 1, left, right);
  selectNote(right);
  saveLatestTake();
}

function deleteSelectedNote() {
  const note = selectedNote();
  if (!note) return;
  pushUndo();
  state.notes = state.notes.filter((item) => item.id !== note.id);
  closeInspector();
  saveLatestTake();
}

function exportWav() {
  if (!state.samples) return;
  download(encodeWav(state.samples, state.sampleRate), safeFileName("wav"));
  showToast("WAV exported.");
}

async function exportMp3() {
  if (!state.samples) return;
  if (!globalThis.lamejs?.Mp3Encoder) {
    showToast("The MP3 encoder didn't load. WAV export still works offline.", 4200);
    return;
  }
  ui.mp3Export.disabled = true;
  const previous = ui.mp3Export.querySelector("span").textContent;
  ui.mp3Export.querySelector("span").textContent = "Encoding…";
  try {
    const encoder = new globalThis.lamejs.Mp3Encoder(1, state.sampleRate, 192);
    const chunks = [];
    const blockSize = 1152;
    for (let offset = 0; offset < state.samples.length; offset += blockSize) {
      const end = Math.min(offset + blockSize, state.samples.length);
      const pcm = new Int16Array(end - offset);
      for (let i = offset; i < end; i += 1) {
        const sample = clamp(state.samples[i], -1, 1);
        pcm[i - offset] = sample < 0 ? sample * 32768 : sample * 32767;
      }
      const encoded = encoder.encodeBuffer(pcm);
      if (encoded.length) chunks.push(new Uint8Array(encoded));
      if ((offset / blockSize) % 90 === 0) await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const tail = encoder.flush();
    if (tail.length) chunks.push(new Uint8Array(tail));
    download(new Blob(chunks, { type: "audio/mpeg" }), safeFileName("mp3"));
    showToast("MP3 exported.");
  } catch (error) {
    showToast(`MP3 export failed: ${error.message}`, 4200);
  } finally {
    ui.mp3Export.disabled = false;
    ui.mp3Export.querySelector("span").textContent = previous;
  }
}

function exportMidiFile() {
  if (!state.notes.length) {
    showToast("There are no detected notes to export.");
    return;
  }
  const bpm = clamp(Number(ui.tempo.value) || 125, 20, 300);
  download(encodeMidi(state.notes, bpm), safeFileName("mid"));
  showToast("Edited notes exported as MIDI.");
}

function exportSession() {
  const session = {
    app: "Strawberry Pitch",
    version: 1,
    name: state.takeName,
    savedAt: new Date().toISOString(),
    sampleRate: state.sampleRate,
    duration: state.duration,
    tuning: state.tuning,
    points: state.points,
    notes: state.notes,
  };
  download(new Blob([JSON.stringify(session, null, 2)], { type: "application/json" }), safeFileName("pitch.json"));
  showToast("Pitch session exported.");
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("strawberry-pitch", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("takes", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveLatestTake() {
  if (!state.samples) return;
  try {
    const database = await openDatabase();
    const transaction = database.transaction("takes", "readwrite");
    transaction.objectStore("takes").put({
      id: "latest", name: state.takeName, sampleRate: state.sampleRate, duration: state.duration,
      samples: state.samples.buffer.slice(state.samples.byteOffset, state.samples.byteOffset + state.samples.byteLength),
      points: state.points, notes: state.notes, savedAt: Date.now(),
    });
    await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
    database.close();
  } catch { /* private mode and storage pressure should not break a take */ }
}

async function loadLatestTake() {
  try {
    const database = await openDatabase();
    const transaction = database.transaction("takes", "readonly");
    const request = transaction.objectStore("takes").get("latest");
    const saved = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    database.close();
    if (!saved?.samples) return;
    state.samples = new Float32Array(saved.samples);
    state.sampleRate = saved.sampleRate;
    state.duration = saved.duration;
    state.points = saved.points || [];
    state.notes = saved.notes || [];
    state.takeName = saved.name || "Recovered take";
    ui.takeStatus.textContent = `${state.takeName} · ${state.notes.length} notes`;
    ui.play.disabled = false;
    ui.rewind.disabled = false;
    ui.export.disabled = false;
    drawRoll();
    centerPitchRange();
    showToast("Restored your last take.");
  } catch { /* no saved take */ }
}

async function deleteLatestTake() {
  try {
    const database = await openDatabase();
    database.transaction("takes", "readwrite").objectStore("takes").delete("latest");
    database.close();
  } catch { /* no-op */ }
}

ui.rollScroller.addEventListener("scroll", syncCanvasTransforms, { passive: true });
ui.roll.addEventListener("pointerdown", (event) => {
  const rect = ui.roll.getBoundingClientRect();
  const scaleX = Number.parseFloat(ui.roll.style.width) / rect.width;
  const scaleY = Number.parseFloat(ui.roll.style.height) / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const note = noteAtPoint(x, y);
  if (!note) {
    const time = clamp(x / state.pxPerSecond, 0, state.duration);
    updatePlayhead(time);
    selectNote(null);
    return;
  }
  event.preventDefault();
  selectNote(note);
  pushUndo();
  state.drag = { pointerId: event.pointerId, noteId: note.id, startY: y, initialShift: note.shift || 0 };
  ui.roll.setPointerCapture(event.pointerId);
  ui.roll.style.touchAction = "none";
});

ui.roll.addEventListener("pointermove", (event) => {
  if (!state.drag || event.pointerId !== state.drag.pointerId) return;
  const note = state.notes.find((item) => item.id === state.drag.noteId);
  if (!note) return;
  const rect = ui.roll.getBoundingClientRect();
  const scaleY = Number.parseFloat(ui.roll.style.height) / rect.height;
  const y = (event.clientY - rect.top) * scaleY;
  const rawShift = state.drag.initialShift - (y - state.drag.startY) / LANE_HEIGHT;
  note.shift = state.snap ? Math.round(rawShift) : Math.round(rawShift * 100) / 100;
  syncInspector(note);
  drawRoll();
});

function finishDrag(event) {
  if (!state.drag || event.pointerId !== state.drag.pointerId) return;
  state.drag = null;
  ui.roll.style.touchAction = "pan-x pan-y";
  saveLatestTake();
}
ui.roll.addEventListener("pointerup", finishDrag);
ui.roll.addEventListener("pointercancel", finishDrag);

for (const [control, property, output, formatter, scale = 1] of [
  [ui.pitchControl, "shift", ui.pitchOutput, (value) => `${value > 0 ? "+" : ""}${value} ct`, 100],
  [ui.tuneTimeControl, "tuneTime", ui.tuneTimeOutput, (value) => `${value} ms`],
  [ui.depthControl, "depth", ui.depthOutput, (value) => `${value}%`],
  [ui.formantControl, "formant", ui.formantOutput, (value) => Number(value).toFixed(1)],
  [ui.gainControl, "gain", ui.gainOutput, (value) => `${value > 0 ? "+" : ""}${value} dB`],
  [ui.driftControl, "drift", ui.driftOutput, (value) => `${value}%`],
]) {
  control.addEventListener("pointerdown", pushUndo);
  control.addEventListener("input", () => {
    const note = selectedNote();
    if (!note) return;
    const numeric = Number(control.value);
    note[property] = numeric / scale;
    output.value = formatter(numeric);
    ui.selectedName.textContent = midiToName(note.targetMidi + (note.shift || 0));
    drawRoll();
  });
  control.addEventListener("change", saveLatestTake);
}

ui.monitor.addEventListener("click", () => toggleMonitor());
ui.record.addEventListener("click", () => state.isRecording ? stopRecording() : startRecording());
ui.stop.addEventListener("click", () => state.isRecording ? stopRecording() : stopPlayback(true));
ui.play.addEventListener("click", play);
ui.rewind.addEventListener("click", () => { stopPlayback(true); ui.rollScroller.scrollLeft = 0; });
ui.export.addEventListener("click", () => ui.exportDialog.showModal());
ui.importButton.addEventListener("click", () => ui.audioInput.click());
ui.audioInput.addEventListener("change", () => importAudio(ui.audioInput.files?.[0]));
ui.newTake.addEventListener("click", clearTake);
ui.snap.addEventListener("click", () => {
  state.snap = !state.snap;
  ui.snap.classList.toggle("active", state.snap);
  ui.snap.setAttribute("aria-pressed", String(state.snap));
  showToast(state.snap ? "Pitch drag snaps to semitones." : "Fine pitch drag uses cents.");
});
ui.zoom.addEventListener("input", () => {
  const centerTime = (ui.rollScroller.scrollLeft + ui.rollScroller.clientWidth / 2) / state.pxPerSecond;
  state.pxPerSecond = Number(ui.zoom.value);
  drawRoll();
  ui.rollScroller.scrollLeft = Math.max(0, timeToX(centerTime) - ui.rollScroller.clientWidth / 2);
});
ui.undo.addEventListener("click", undo);
ui.redo.addEventListener("click", redo);
ui.closeInspector.addEventListener("click", closeInspector);
ui.split.addEventListener("click", splitSelectedNote);
ui.deleteNote.addEventListener("click", deleteSelectedNote);
ui.wavExport.addEventListener("click", exportWav);
ui.mp3Export.addEventListener("click", exportMp3);
ui.midiExport.addEventListener("click", exportMidiFile);
ui.sessionExport.addEventListener("click", exportSession);

window.addEventListener("resize", () => drawRoll());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.isRecording) requestWakeLock();
});
window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
  if (event.code === "Space" && !["INPUT", "BUTTON"].includes(document.activeElement?.tagName)) { event.preventDefault(); play(); }
});

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));

drawRoll();
updateUndoButtons();
requestAnimationFrame(() => {
  ui.rollScroller.scrollTop = clamp(midiToY(60) - ui.rollScroller.clientHeight / 2, 0, rollDimensions().height - ui.rollScroller.clientHeight);
  syncCanvasTransforms();
  loadLatestTake();
});
