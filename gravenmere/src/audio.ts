export class SchoolAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private ambience: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private enabled = true
  private started = false

  async start(): Promise<void> {
    if (this.started) {
      await this.context?.resume()
      return
    }
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    this.context = new AudioContextClass()
    this.master = this.context.createGain()
    this.master.gain.value = this.enabled ? 0.34 : 0
    this.master.connect(this.context.destination)
    this.ambience = this.context.createGain()
    this.ambience.gain.value = 0.28
    this.ambience.connect(this.master)
    this.noiseBuffer = this.makeNoiseBuffer(2.5)
    this.createDrone(46.25, 'sine', 0.16, -7)
    this.createDrone(69.3, 'triangle', 0.055, 6)
    this.createDrone(92.5, 'sine', 0.035, 2)
    this.createAir()
    this.started = true
    await this.context.resume()
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!this.master || !this.context) return
    this.master.gain.cancelScheduledValues(this.context.currentTime)
    this.master.gain.linearRampToValueAtTime(enabled ? 0.34 : 0, this.context.currentTime + 0.16)
  }

  footstep(strength = 1): void {
    if (!this.canPlay() || !this.noiseBuffer || !this.context || !this.master) return
    const source = this.context.createBufferSource()
    source.buffer = this.noiseBuffer
    const filter = this.context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 125 + Math.random() * 70
    filter.Q.value = 1.2
    const gain = this.context.createGain()
    const now = this.context.currentTime
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.085 * strength, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.115)
    source.playbackRate.value = 0.72 + Math.random() * 0.2
    source.connect(filter).connect(gain).connect(this.master)
    source.start(now, Math.random() * 1.5, 0.16)
    source.stop(now + 0.18)
  }

  cast(): void {
    this.chime([246.94, 369.99, 554.37], 0.7, 0.095)
    this.noiseSweep(260, 1600, 0.58, 0.035)
  }

  collect(): void {
    this.chime([196, 293.66, 440, 659.25], 1.3, 0.12)
  }

  gateOpen(): void {
    this.chime([73.42, 110, 164.81], 2.4, 0.12)
    this.noiseSweep(90, 45, 1.7, 0.1)
  }

  revealLore(): void {
    this.chime([130.81, 196], 0.5, 0.045)
  }

  private canPlay(): boolean {
    return Boolean(this.enabled && this.context && this.master && this.context.state === 'running')
  }

  private makeNoiseBuffer(seconds: number): AudioBuffer | null {
    if (!this.context) return null
    const length = Math.floor(this.context.sampleRate * seconds)
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate)
    const channel = buffer.getChannelData(0)
    let previous = 0
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1
      previous = previous * 0.86 + white * 0.14
      channel[index] = previous
    }
    return buffer
  }

  private createDrone(
    frequency: number,
    type: OscillatorType,
    volume: number,
    detune: number,
  ): void {
    if (!this.context || !this.ambience) return
    const oscillator = this.context.createOscillator()
    oscillator.type = type
    oscillator.frequency.value = frequency
    oscillator.detune.value = detune
    const filter = this.context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 480
    filter.Q.value = 0.65
    const gain = this.context.createGain()
    gain.gain.value = volume
    oscillator.connect(filter).connect(gain).connect(this.ambience)
    oscillator.start()

    const lfo = this.context.createOscillator()
    const lfoGain = this.context.createGain()
    lfo.frequency.value = 0.025 + Math.random() * 0.035
    lfoGain.gain.value = volume * 0.45
    lfo.connect(lfoGain).connect(gain.gain)
    lfo.start()
  }

  private createAir(): void {
    if (!this.context || !this.ambience || !this.noiseBuffer) return
    const source = this.context.createBufferSource()
    source.buffer = this.noiseBuffer
    source.loop = true
    const filter = this.context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 410
    filter.Q.value = 0.34
    const gain = this.context.createGain()
    gain.gain.value = 0.06
    source.connect(filter).connect(gain).connect(this.ambience)
    source.start()
  }

  private chime(frequencies: number[], duration: number, volume: number): void {
    if (!this.canPlay() || !this.context || !this.master) return
    const now = this.context.currentTime
    frequencies.forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator()
      const gain = this.context!.createGain()
      oscillator.type = index % 2 ? 'sine' : 'triangle'
      oscillator.frequency.value = frequency
      oscillator.detune.value = index * 3 - 4
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(volume / (1 + index * 0.25), now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + index * 0.09)
      oscillator.connect(gain).connect(this.master!)
      oscillator.start(now + index * 0.035)
      oscillator.stop(now + duration + index * 0.09 + 0.04)
    })
  }

  private noiseSweep(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    volume: number,
  ): void {
    if (!this.canPlay() || !this.context || !this.master || !this.noiseBuffer) return
    const now = this.context.currentTime
    const source = this.context.createBufferSource()
    source.buffer = this.noiseBuffer
    const filter = this.context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(startFrequency, now)
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration)
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    source.connect(filter).connect(gain).connect(this.master)
    source.start(now, 0, duration + 0.05)
  }
}
