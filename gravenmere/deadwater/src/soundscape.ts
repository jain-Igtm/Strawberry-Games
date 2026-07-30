import type { WeaponId } from './weapons'

export class DeadwaterSoundscape {
  private context: AudioContext | null = null
  private noiseBuffer: AudioBuffer | null = null
  private ambientStarted = false
  private nextZombieVoiceAt = 0
  private accentTimer = 5
  private ambientNodes: AudioNode[] = []

  ensure(): AudioContext {
    if (!this.context) this.context = new AudioContext()
    if (this.context.state === 'suspended') void this.context.resume()
    return this.context
  }

  private getNoiseBuffer(): AudioBuffer {
    const context = this.ensure()
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === context.sampleRate) return this.noiseBuffer
    const frames = Math.floor(context.sampleRate * 1.8)
    const buffer = context.createBuffer(1, frames, context.sampleRate)
    const data = buffer.getChannelData(0)
    let brown = 0
    for (let index = 0; index < frames; index += 1) {
      const white = Math.random() * 2 - 1
      brown = brown * 0.975 + white * 0.025
      data[index] = white * 0.62 + brown * 2.1
    }
    this.noiseBuffer = buffer
    return buffer
  }

  start(): void {
    const context = this.ensure()
    if (this.ambientStarted) return
    this.ambientStarted = true

    const wind = context.createBufferSource()
    const windFilter = context.createBiquadFilter()
    const windGain = context.createGain()
    const windLfo = context.createOscillator()
    const windLfoDepth = context.createGain()
    wind.buffer = this.getNoiseBuffer()
    wind.loop = true
    windFilter.type = 'bandpass'
    windFilter.frequency.value = 310
    windFilter.Q.value = 0.42
    windGain.gain.value = 0.012
    windLfo.frequency.value = 0.075
    windLfoDepth.gain.value = 0.006
    windLfo.connect(windLfoDepth).connect(windGain.gain)
    wind.connect(windFilter).connect(windGain).connect(context.destination)
    wind.start()
    windLfo.start()

    const fire = context.createBufferSource()
    const fireHigh = context.createBiquadFilter()
    const fireLow = context.createBiquadFilter()
    const fireGain = context.createGain()
    const fireLfo = context.createOscillator()
    const fireDepth = context.createGain()
    fire.buffer = this.getNoiseBuffer()
    fire.loop = true
    fireHigh.type = 'highpass'
    fireHigh.frequency.value = 740
    fireLow.type = 'lowpass'
    fireLow.frequency.value = 4200
    fireGain.gain.value = 0.0085
    fireLfo.type = 'triangle'
    fireLfo.frequency.value = 8.4
    fireDepth.gain.value = 0.0048
    fireLfo.connect(fireDepth).connect(fireGain.gain)
    fire.connect(fireHigh).connect(fireLow).connect(fireGain).connect(context.destination)
    fire.start(0, 0.41)
    fireLfo.start()

    const humFilter = context.createBiquadFilter()
    const humGain = context.createGain()
    humFilter.type = 'lowpass'
    humFilter.frequency.value = 180
    humGain.gain.value = 0.012
    humFilter.connect(humGain).connect(context.destination)
    for (const frequency of [43, 58]) {
      const oscillator = context.createOscillator()
      oscillator.type = frequency === 43 ? 'sine' : 'triangle'
      oscillator.frequency.value = frequency
      oscillator.connect(humFilter)
      oscillator.start()
      this.ambientNodes.push(oscillator)
    }

    this.ambientNodes.push(
      wind,
      windFilter,
      windGain,
      windLfo,
      windLfoDepth,
      fire,
      fireHigh,
      fireLow,
      fireGain,
      fireLfo,
      fireDepth,
      humFilter,
      humGain,
    )
  }

  update(dt: number): void {
    if (!this.ambientStarted) return
    this.accentTimer -= dt
    if (this.accentTimer > 0) return
    this.accentTimer = 7 + Math.random() * 11
    if (Math.random() < 0.6) this.playMetalGroan()
    else this.playDistantSiren()
  }

  noiseBurst(
    duration: number,
    volume: number,
    frequency: number,
    filterType: BiquadFilterType = 'lowpass',
    q = 0.7,
    delay = 0,
  ): void {
    const context = this.ensure()
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    const start = context.currentTime + delay
    source.buffer = this.getNoiseBuffer()
    filter.type = filterType
    filter.frequency.value = frequency
    filter.Q.value = q
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + Math.min(0.006, duration * 0.25))
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    source.connect(filter).connect(gain).connect(context.destination)
    source.start(start, Math.random() * 0.8, duration)
    source.stop(start + duration + 0.02)
  }

  private tone(
    type: OscillatorType,
    startFrequency: number,
    endFrequency: number,
    duration: number,
    volume: number,
    delay = 0,
  ): void {
    const context = this.ensure()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const start = context.currentTime + delay
    oscillator.type = type
    oscillator.frequency.setValueAtTime(startFrequency, start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  }

  gunshot(weaponId: WeaponId): void {
    if (weaponId === 'shotgun') {
      this.noiseBurst(0.035, 0.18, 1850, 'highpass', 0.5)
      this.noiseBurst(0.18, 0.15, 650, 'bandpass', 0.9)
      this.noiseBurst(0.28, 0.055, 330, 'lowpass', 0.7, 0.02)
      this.tone('sine', 118, 42, 0.16, 0.15)
      return
    }
    if (weaponId === 'marksman') {
      this.noiseBurst(0.022, 0.17, 2600, 'highpass', 0.45)
      this.noiseBurst(0.12, 0.11, 760, 'bandpass', 0.85)
      this.tone('sine', 165, 48, 0.11, 0.12)
      this.tone('triangle', 1200, 340, 0.035, 0.028, 0.035)
      return
    }
    const smg = weaponId === 'smg'
    this.noiseBurst(0.016, smg ? 0.085 : 0.12, smg ? 2450 : 2200, 'highpass', 0.45)
    this.noiseBurst(0.075, smg ? 0.074 : 0.105, smg ? 1050 : 880, 'bandpass', 0.8)
    this.noiseBurst(0.13, smg ? 0.018 : 0.028, 430, 'lowpass', 0.6, 0.014)
    this.tone('sine', smg ? 178 : 145, smg ? 76 : 58, smg ? 0.055 : 0.08, smg ? 0.065 : 0.1)
    this.tone('triangle', 920, 310, 0.028, 0.022, 0.03)
  }

  emptyClick(): void {
    this.tone('square', 660, 360, 0.026, 0.024)
  }

  reload(): void {
    this.tone('triangle', 540, 240, 0.045, 0.025)
    this.tone('square', 260, 180, 0.032, 0.018, 0.22)
    this.noiseBurst(0.04, 0.025, 1500, 'highpass', 0.7, 0.42)
  }

  pickup(): void {
    this.tone('triangle', 320, 720, 0.12, 0.035)
    this.tone('sine', 540, 880, 0.15, 0.018, 0.08)
  }

  zombieMoan(distance: number): void {
    if (!this.context || distance > 38 || this.context.currentTime < this.nextZombieVoiceAt) return
    const context = this.ensure()
    this.nextZombieVoiceAt = context.currentTime + 0.38 + Math.random() * 0.78
    const volume = Math.max(0.003, Math.min(0.042, 0.045 * (1 - distance / 42)))
    const voice = Math.random()
    if (voice < 0.55) {
      this.tone('sawtooth', 62 + Math.random() * 22, 34, 0.48, volume)
      this.noiseBurst(0.32, volume * 0.55, 390, 'lowpass', 1.1, 0.04)
    } else if (voice < 0.82) {
      this.tone('triangle', 170 + Math.random() * 70, 72, 0.32, volume * 0.72)
      this.noiseBurst(0.18, volume * 0.45, 1200, 'bandpass', 1.8)
    } else {
      this.noiseBurst(0.55, volume * 0.9, 520, 'bandpass', 0.75)
      this.tone('sine', 48, 31, 0.58, volume * 0.55)
    }
  }

  zombieAttack(): void {
    this.noiseBurst(0.15, 0.055, 760, 'bandpass', 1.2)
    this.tone('sawtooth', 115, 48, 0.2, 0.045)
  }

  zombieDeath(): void {
    this.tone('sawtooth', 94, 28, 0.42, 0.04)
    this.noiseBurst(0.26, 0.036, 460, 'lowpass', 0.85)
  }

  gameOver(): void {
    this.noiseBurst(0.6, 0.09, 260, 'lowpass', 0.7)
    this.tone('sine', 82, 24, 0.72, 0.08)
  }

  private playMetalGroan(): void {
    const delay = Math.random() * 0.25
    this.tone('sawtooth', 118 + Math.random() * 30, 38, 1.5 + Math.random() * 0.9, 0.012, delay)
    this.noiseBurst(0.9, 0.012, 420, 'bandpass', 3.2, delay + 0.08)
  }

  private playDistantSiren(): void {
    this.tone('sine', 290, 520, 1.15, 0.008)
    this.tone('sine', 520, 270, 1.2, 0.007, 1.12)
  }
}
