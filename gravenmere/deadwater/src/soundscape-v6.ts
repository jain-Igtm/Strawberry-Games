import { DeadwaterSoundscapeV5 } from './soundscape-v5'

export class DeadwaterSoundscapeV6 extends DeadwaterSoundscapeV5 {
  private nextOrganicVoiceAt = 0
  private eerieSirenTimer = 10 + Math.random() * 12

  private sirenTone(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    volume: number,
    delay = 0,
  ): void {
    const context = this.ensure()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const filter = context.createBiquadFilter()
    const start = context.currentTime + delay
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(startFrequency, start)
    oscillator.frequency.linearRampToValueAtTime(endFrequency, start + duration)
    filter.type = 'lowpass'
    filter.frequency.value = 1200
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.7, duration * 0.22))
    gain.gain.linearRampToValueAtTime(volume * 0.78, start + duration * 0.72)
    gain.gain.linearRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(filter).connect(gain).connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.03)
  }

  override zombieMoan(distance: number): void {
    const context = this.ensure()
    if (distance > 48 || context.currentTime < this.nextOrganicVoiceAt) return
    this.nextOrganicVoiceAt = context.currentTime + 0.52 + Math.random() * 1.15
    const volume = Math.max(0.003, Math.min(0.048, 0.052 * (1 - distance / 52)))
    const voice = Math.random()

    if (voice < 0.42) {
      this.noiseBurst(0.52, volume, 310, 'bandpass', 1.15)
      this.noiseBurst(0.34, volume * 0.7, 125, 'lowpass', 0.65, 0.05)
      this.noiseBurst(0.12, volume * 0.28, 1180, 'bandpass', 2.0, 0.18)
    } else if (voice < 0.78) {
      this.noiseBurst(0.72, volume * 0.92, 235, 'bandpass', 0.82)
      this.noiseBurst(0.46, volume * 0.62, 95, 'lowpass', 0.55, 0.08)
      this.noiseBurst(0.2, volume * 0.25, 760, 'bandpass', 1.7, 0.32)
    } else {
      this.noiseBurst(0.3, volume * 0.95, 480, 'bandpass', 1.35)
      this.noiseBurst(0.54, volume * 0.75, 155, 'lowpass', 0.7, 0.06)
      this.noiseBurst(0.09, volume * 0.34, 1700, 'highpass', 0.8, 0.13)
    }
  }

  override zombieAttack(): void {
    this.noiseBurst(0.2, 0.065, 430, 'bandpass', 1.0)
    this.noiseBurst(0.17, 0.048, 145, 'lowpass', 0.65, 0.025)
    this.noiseBurst(0.07, 0.022, 1500, 'highpass', 0.75, 0.04)
  }

  override zombieDeath(): void {
    this.noiseBurst(0.58, 0.052, 245, 'bandpass', 0.82)
    this.noiseBurst(0.7, 0.043, 92, 'lowpass', 0.58, 0.05)
    this.noiseBurst(0.18, 0.022, 820, 'bandpass', 1.45, 0.2)
  }

  override update(dt: number): void {
    super.update(dt)
    this.eerieSirenTimer -= dt
    if (this.eerieSirenTimer > 0) return
    this.eerieSirenTimer = 18 + Math.random() * 28
    const base = 205 + Math.random() * 38
    this.sirenTone(base, base * 1.72, 2.7, 0.011)
    this.sirenTone(base * 1.72, base * 0.93, 3.0, 0.0095, 2.62)
    if (Math.random() < 0.48) {
      this.sirenTone(base * 0.51, base * 0.82, 4.1, 0.0048, 0.34)
    }
  }
}
