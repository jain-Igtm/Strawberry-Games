import { DeadwaterSoundscapeV5 } from './soundscape-v5'

type SampleSet = {
  zombies: AudioBuffer[]
  stormSiren: AudioBuffer | null
  warningSiren: AudioBuffer | null
}

const EMPTY_SAMPLES: SampleSet = {
  zombies: [],
  stormSiren: null,
  warningSiren: null,
}

export class DeadwaterSoundscapeV7 extends DeadwaterSoundscapeV5 {
  private samples: SampleSet = EMPTY_SAMPLES
  private sampleLoad: Promise<void> | null = null
  private nextZombieSampleAt = 0
  private sirenTimer = 18 + Math.random() * 22

  override start(): void {
    super.start()
    void this.loadSamples()
  }

  private async decode(path: string): Promise<AudioBuffer | null> {
    try {
      const response = await fetch(path)
      if (!response.ok) return null
      const bytes = await response.arrayBuffer()
      return await this.ensure().decodeAudioData(bytes.slice(0))
    } catch {
      return null
    }
  }

  private loadSamples(): Promise<void> {
    if (this.sampleLoad) return this.sampleLoad
    this.sampleLoad = (async () => {
      const [zombieOne, zombieTwo, zombieThree, stormSiren, warningSiren] = await Promise.all([
        this.decode('/audio-v7/zombie-groan-1.ogg'),
        this.decode('/audio-v7/zombie-groan-2.ogg'),
        this.decode('/audio-v7/zombie-groan-3.ogg'),
        this.decode('/audio-v7/storm-siren.ogg'),
        this.decode('/audio-v7/warning-siren.mp3'),
      ])
      this.samples = {
        zombies: [zombieOne, zombieTwo, zombieThree].filter((entry): entry is AudioBuffer => Boolean(entry)),
        stormSiren,
        warningSiren,
      }
    })()
    return this.sampleLoad
  }

  private playBuffer(
    buffer: AudioBuffer,
    volume: number,
    playbackRate = 1,
    offset = 0,
    duration?: number,
    lowpass = 5200,
  ): void {
    const context = this.ensure()
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    source.buffer = buffer
    source.playbackRate.value = playbackRate
    filter.type = 'lowpass'
    filter.frequency.value = lowpass
    filter.Q.value = 0.45
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.linearRampToValueAtTime(volume, context.currentTime + 0.035)
    const available = Math.max(0.08, buffer.duration - offset)
    const playDuration = Math.min(duration ?? available, available)
    gain.gain.setValueAtTime(volume, context.currentTime + Math.max(0.04, playDuration - 0.12))
    gain.gain.linearRampToValueAtTime(0.0001, context.currentTime + playDuration)
    source.connect(filter).connect(gain).connect(context.destination)
    source.start(context.currentTime, Math.min(offset, Math.max(0, buffer.duration - 0.08)), playDuration)
    source.stop(context.currentTime + playDuration + 0.04)
  }

  private randomZombie(): AudioBuffer | null {
    const buffers = this.samples.zombies
    if (buffers.length === 0) {
      void this.loadSamples()
      return null
    }
    return buffers[Math.floor(Math.random() * buffers.length)]
  }

  override zombieMoan(distance: number): void {
    const context = this.ensure()
    if (distance > 52 || context.currentTime < this.nextZombieSampleAt) return
    const sample = this.randomZombie()
    if (!sample) return
    this.nextZombieSampleAt = context.currentTime + 0.72 + Math.random() * 1.35
    const distanceVolume = Math.max(0.004, Math.min(0.052, 0.058 * (1 - distance / 58)))
    const rate = 0.8 + Math.random() * 0.24
    const offset = sample.duration > 2.2 ? Math.random() * Math.max(0, sample.duration - 1.7) : 0
    const duration = Math.min(sample.duration - offset, 0.85 + Math.random() * 1.15)
    this.playBuffer(sample, distanceVolume, rate, offset, duration, 2600)
  }

  override zombieAttack(): void {
    const sample = this.randomZombie()
    if (!sample) return
    const offset = sample.duration > 1.2 ? Math.random() * Math.max(0, sample.duration - 0.75) : 0
    this.playBuffer(sample, 0.062, 1.08 + Math.random() * 0.18, offset, Math.min(0.72, sample.duration - offset), 3400)
  }

  override zombieDeath(): void {
    const sample = this.randomZombie()
    if (!sample) return
    const offset = sample.duration > 1.8 ? Math.random() * Math.max(0, sample.duration - 1.35) : 0
    this.playBuffer(sample, 0.06, 0.68 + Math.random() * 0.16, offset, Math.min(1.3, sample.duration - offset), 2100)
  }

  override update(dt: number): void {
    this.sirenTimer -= dt
    if (this.sirenTimer > 0) return
    this.sirenTimer = 28 + Math.random() * 42
    void this.loadSamples()

    const useStorm = Math.random() < 0.72
    const sample = useStorm ? this.samples.stormSiren : this.samples.warningSiren
    if (!sample) return

    if (useStorm) {
      const duration = Math.min(sample.duration, 8 + Math.random() * 6)
      const maximumOffset = Math.max(0, sample.duration - duration)
      const offset = maximumOffset > 0 ? Math.random() * maximumOffset : 0
      this.playBuffer(sample, 0.023, 0.94 + Math.random() * 0.08, offset, duration, 1800)
    } else {
      const duration = Math.min(sample.duration, 5.5 + Math.random() * 3)
      this.playBuffer(sample, 0.018, 0.88 + Math.random() * 0.08, 0, duration, 2100)
    }
  }
}
