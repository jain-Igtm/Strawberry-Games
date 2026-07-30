import * as THREE from 'three'
import type { WeaponId } from './weapons'
import { DeadwaterSoundscapeV5 } from './soundscape-v5'

type SampleSet = {
  zombies: AudioBuffer[]
}

const EMPTY_SAMPLES: SampleSet = {
  zombies: [],
}

export class DeadwaterSoundscapeV7 extends DeadwaterSoundscapeV5 {
  private samples: SampleSet = EMPTY_SAMPLES
  private sampleLoad: Promise<void> | null = null
  private nextZombieSampleAt = 0
  private sirenTimer = 76 + Math.random() * 54
  private openingSirenPlayed = false
  private active = false

  preload(): void {
    void this.loadSamples()
  }

  override start(): void {
    const context = this.ensure()
    if (context.state === 'suspended') void context.resume()
    super.start()
    this.active = true
    if (!this.openingSirenPlayed) {
      this.openingSirenPlayed = true
      this.playCivilDefenseSiren(true)
    }
  }

  override gunshot(weaponId: WeaponId): void {
    super.gunshot(weaponId)
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    const duration = weaponId === 'shotgun'
      ? 12
      : weaponId === 'marksman' || weaponId === 'harpoon'
        ? 8
        : 5
    navigator.vibrate(duration)
  }

  private playCivilDefenseSiren(opening = false): void {
    const context = this.ensure()
    const filter = context.createBiquadFilter()
    const master = context.createGain()
    const sweep = context.createOscillator()
    const sweepDepth = context.createGain()
    const panner = context.createStereoPanner()
    const start = context.currentTime
    const duration = opening ? 8.5 : 7.6

    filter.type = 'lowpass'
    filter.frequency.value = opening ? 1850 : 1650
    filter.Q.value = 0.72
    panner.pan.value = opening ? -0.08 : -0.24
    master.gain.setValueAtTime(0.0001, start)
    master.gain.exponentialRampToValueAtTime(opening ? 0.052 : 0.031, start + 0.42)
    master.gain.setValueAtTime(opening ? 0.052 : 0.031, start + duration - 1.15)
    master.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    filter.connect(panner).connect(master).connect(context.destination)

    sweep.type = 'sine'
    sweep.frequency.value = 0.135
    sweepDepth.gain.value = 250
    sweep.connect(sweepDepth)
    for (const [frequency, detune, volume] of [
      [515, -7, 0.62],
      [515, 8, 0.46],
    ] as Array<[number, number, number]>) {
      const oscillator = context.createOscillator()
      const voice = context.createGain()
      oscillator.type = 'sawtooth'
      oscillator.frequency.value = frequency
      oscillator.detune.value = detune
      voice.gain.value = volume
      sweepDepth.connect(oscillator.frequency)
      oscillator.connect(voice).connect(filter)
      oscillator.start(start)
      oscillator.stop(start + duration + 0.04)
    }
    sweep.start(start)
    sweep.stop(start + duration + 0.04)
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
      const [zombieOne, zombieTwo, zombieThree] = await Promise.all([
        this.decode('/audio-v7/zombie-groan-1.ogg'),
        this.decode('/audio-v7/zombie-groan-2.ogg'),
        this.decode('/audio-v7/zombie-groan-3.ogg'),
      ])
      this.samples = {
        zombies: [zombieOne, zombieTwo, zombieThree].filter((entry): entry is AudioBuffer => Boolean(entry)),
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
    pan = 0,
    fadeSeconds = 0.035,
  ): void {
    const context = this.ensure()
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const panner = context.createStereoPanner()
    const gain = context.createGain()
    source.buffer = buffer
    source.playbackRate.value = playbackRate
    filter.type = 'lowpass'
    filter.frequency.value = lowpass
    filter.Q.value = 0.45
    panner.pan.value = THREE.MathUtils.clamp(pan, -1, 1)
    const available = Math.max(0.08, buffer.duration - offset)
    const playDuration = Math.min(duration ?? available, available)
    const fade = Math.min(fadeSeconds, playDuration * 0.22)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.linearRampToValueAtTime(volume, context.currentTime + fade)
    gain.gain.setValueAtTime(volume, context.currentTime + Math.max(fade + 0.01, playDuration - fade * 1.7))
    gain.gain.linearRampToValueAtTime(0.0001, context.currentTime + playDuration)
    source.connect(filter).connect(panner).connect(gain).connect(context.destination)
    source.start(context.currentTime, Math.min(offset, Math.max(0, buffer.duration - 0.08)), playDuration)
    source.stop(context.currentTime + playDuration + 0.08)
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
    if (distance > 68 || context.currentTime < this.nextZombieSampleAt) return
    const sample = this.randomZombie()
    if (!sample) return
    this.nextZombieSampleAt = context.currentTime + 0.4 + Math.random() * 0.72
    const distanceVolume = Math.max(0.008, Math.min(0.105, 0.115 * (1 - distance / 74)))
    const rate = 0.82 + Math.random() * 0.27
    const offset = sample.duration > 2.2 ? Math.random() * Math.max(0, sample.duration - 1.7) : 0
    const duration = Math.min(sample.duration - offset, 0.85 + Math.random() * 1.15)
    this.playBuffer(sample, distanceVolume, rate, offset, duration, 2600)
  }

  override zombieAttack(): void {
    const sample = this.randomZombie()
    if (!sample) return
    const offset = sample.duration > 1.2 ? Math.random() * Math.max(0, sample.duration - 0.75) : 0
    this.playBuffer(sample, 0.12, 1.08 + Math.random() * 0.18, offset, Math.min(0.72, sample.duration - offset), 3800)
  }

  override zombieDeath(): void {
    const sample = this.randomZombie()
    if (!sample) return
    const offset = sample.duration > 1.8 ? Math.random() * Math.max(0, sample.duration - 1.35) : 0
    this.playBuffer(sample, 0.09, 0.68 + Math.random() * 0.16, offset, Math.min(1.3, sample.duration - offset), 2300)
  }

  override update(dt: number): void {
    if (!this.active) return
    this.sirenTimer -= dt
    if (this.sirenTimer > 0) return
    this.playCivilDefenseSiren(false)
    this.sirenTimer = 72 + Math.random() * 78
  }
}
