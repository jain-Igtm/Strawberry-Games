export const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function hzToMidi(hz, tuning = 440) {
  return 69 + 12 * Math.log2(hz / tuning);
}

export function midiToHz(midi, tuning = 440) {
  return tuning * 2 ** ((midi - 69) / 12);
}

export function midiToName(midi) {
  const rounded = Math.round(midi);
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[((rounded % 12) + 12) % 12]}${octave}`;
}

export function centsFromNearest(midi) {
  return (midi - Math.round(midi)) * 100;
}

export function median(values) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function rmsOf(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

// YIN-style monophonic pitch detector. It returns null for silence or uncertain frames.
export function detectPitchYin(input, sampleRate, options = {}) {
  const threshold = options.threshold ?? 0.13;
  const minHz = options.minHz ?? 65;
  const maxHz = options.maxHz ?? 1200;
  const minRms = options.minRms ?? 0.008;
  const rms = rmsOf(input);
  if (rms < minRms) return null;

  const maxTau = Math.min(Math.floor(sampleRate / minHz), Math.floor(input.length / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / maxHz));
  if (maxTau <= minTau) return null;

  const difference = new Float32Array(maxTau + 1);
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    let sum = 0;
    const limit = input.length - tau;
    for (let i = 0; i < limit; i += 1) {
      const delta = input[i] - input[i + tau];
      sum += delta * delta;
    }
    difference[tau] = sum;
  }

  const cmnd = new Float32Array(maxTau + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau += 1) {
    running += difference[tau];
    cmnd[tau] = running ? (difference[tau] * tau) / running : 1;
  }

  let tau = minTau;
  while (tau <= maxTau) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) tau += 1;
      break;
    }
    tau += 1;
  }
  if (tau > maxTau) {
    let best = minTau;
    for (let i = minTau + 1; i <= maxTau; i += 1) if (cmnd[i] < cmnd[best]) best = i;
    if (cmnd[best] > 0.3) return null;
    tau = best;
  }

  let refinedTau = tau;
  if (tau > 1 && tau < maxTau) {
    const left = cmnd[tau - 1];
    const center = cmnd[tau];
    const right = cmnd[tau + 1];
    const denominator = 2 * (2 * center - right - left);
    if (Math.abs(denominator) > 1e-9) refinedTau += (right - left) / denominator;
  }

  const hz = sampleRate / refinedTau;
  if (!Number.isFinite(hz) || hz < minHz || hz > maxHz) return null;
  return { hz, clarity: clamp(1 - cmnd[tau], 0, 1), rms };
}

function smoothedMidi(points, index) {
  const values = [];
  for (let i = Math.max(0, index - 2); i <= Math.min(points.length - 1, index + 2); i += 1) {
    if (Number.isFinite(points[i].midi)) values.push(points[i].midi);
  }
  return median(values);
}

function finishSegment(segment, frameStep, id) {
  const pitches = segment.points.map((point) => point.smoothedMidi);
  const originalMidi = median(pitches);
  const start = Math.max(0, segment.points[0].time - frameStep * 0.45);
  const end = segment.points.at(-1).time + frameStep * 0.65;
  return {
    id,
    start,
    end,
    originalMidi,
    targetMidi: Math.round(originalMidi),
    shift: 0,
    gain: 0,
    formant: 0,
    tuneTime: 90,
    depth: 100,
    drift: 0,
    confidence: median(segment.points.map((point) => point.clarity ?? 0)),
  };
}

export function buildNoteSegments(rawPoints, options = {}) {
  const minClarity = options.minClarity ?? 0.56;
  const minDuration = options.minDuration ?? 0.075;
  const pitchBoundary = options.pitchBoundary ?? 0.82;
  const maxGap = options.maxGap ?? 0.16;
  const frameStep = options.frameStep ?? 0.032;
  const points = rawPoints
    .filter((point) => Number.isFinite(point.midi) && (point.clarity ?? 1) >= minClarity)
    .map((point) => ({ ...point }));
  points.forEach((point, index) => { point.smoothedMidi = smoothedMidi(points, index); });
  if (!points.length) return [];

  const provisional = [];
  let current = { points: [points[0]] };
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    const previous = points[i - 1];
    const center = median(current.points.slice(-8).map((item) => item.smoothedMidi));
    const gap = point.time - previous.time;
    const enoughHistory = point.time - current.points[0].time > minDuration;
    const isBoundary = gap > maxGap || (enoughHistory && Math.abs(point.smoothedMidi - center) > pitchBoundary);
    if (isBoundary) {
      provisional.push(current);
      current = { points: [point] };
    } else {
      current.points.push(point);
    }
  }
  provisional.push(current);

  const merged = [];
  for (const segment of provisional) {
    const duration = segment.points.at(-1).time - segment.points[0].time + frameStep;
    if (duration < minDuration && merged.length) {
      const previous = merged.at(-1);
      const priorPitch = median(previous.points.map((point) => point.smoothedMidi));
      const thisPitch = median(segment.points.map((point) => point.smoothedMidi));
      const gap = segment.points[0].time - previous.points.at(-1).time;
      if (gap < maxGap && Math.abs(priorPitch - thisPitch) < 1.35) {
        previous.points.push(...segment.points);
        continue;
      }
    }
    merged.push(segment);
  }

  return merged
    .filter((segment) => segment.points.at(-1).time - segment.points[0].time + frameStep >= minDuration)
    .map((segment, index) => finishSegment(segment, frameStep, `note-${index + 1}`));
}

export function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const writeText = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataLength, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = clamp(samples[i], -1, 1);
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function pushAscii(bytes, value) {
  for (let i = 0; i < value.length; i += 1) bytes.push(value.charCodeAt(i));
}

function pushUint32(bytes, value) {
  bytes.push((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
}

function variableLength(value) {
  const result = [value & 0x7f];
  while ((value >>= 7)) result.unshift((value & 0x7f) | 0x80);
  return result;
}

export function encodeMidi(notes, bpm = 120) {
  const ticksPerQuarter = 480;
  const ticksPerSecond = (ticksPerQuarter * bpm) / 60;
  const events = [];
  const tempo = Math.round(60000000 / bpm);
  events.push({ tick: 0, bytes: [0xff, 0x51, 0x03, (tempo >>> 16) & 255, (tempo >>> 8) & 255, tempo & 255], order: 0 });
  for (const note of notes) {
    const midi = clamp(Math.round(note.targetMidi + (note.shift ?? 0)), 0, 127);
    const startTick = Math.max(0, Math.round(note.start * ticksPerSecond));
    const endTick = Math.max(startTick + 1, Math.round(note.end * ticksPerSecond));
    const velocity = clamp(Math.round(78 + (note.gain ?? 0) * 1.5), 1, 127);
    events.push({ tick: startTick, bytes: [0x90, midi, velocity], order: 1 });
    events.push({ tick: endTick, bytes: [0x80, midi, 0], order: 0 });
  }
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const track = [];
  let lastTick = 0;
  for (const event of events) {
    track.push(...variableLength(event.tick - lastTick), ...event.bytes);
    lastTick = event.tick;
  }
  track.push(0x00, 0xff, 0x2f, 0x00);
  const bytes = [];
  pushAscii(bytes, "MThd");
  pushUint32(bytes, 6);
  bytes.push(0x00, 0x00, 0x00, 0x01, (ticksPerQuarter >>> 8) & 255, ticksPerQuarter & 255);
  pushAscii(bytes, "MTrk");
  pushUint32(bytes, track.length);
  bytes.push(...track);
  return new Blob([new Uint8Array(bytes)], { type: "audio/midi" });
}

export function concatenateChunks(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
