import { DeadwaterSoundscape } from './soundscape'
import type { WeaponId } from './weapons'
import type { VehicleKind } from './world-objects-v5'

export class DeadwaterSoundscapeV5 extends DeadwaterSoundscape {
  private vehicleOscillator: OscillatorNode | null = null
  private vehicleGain: GainNode | null = null

  private v5Tone(
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

  override gunshot(weaponId: WeaponId): void {
    if (weaponId === 'lmg') {
      this.noiseBurst(0.02, 0.135, 2050, 'highpass', 0.5)
      this.noiseBurst(0.095, 0.12, 720, 'bandpass', 0.9)
      this.v5Tone('sine', 132, 49, 0.095, 0.11)
      return
    }
    if (weaponId === 'harpoon') {
      this.noiseBurst(0.055, 0.16, 1450, 'highpass', 0.55)
      this.noiseBurst(0.24, 0.12, 410, 'bandpass', 1.1)
      this.v5Tone('triangle', 108, 30, 0.34, 0.13)
      this.v5Tone('square', 680, 170, 0.08, 0.035, 0.02)
      return
    }
    if (weaponId === 'arc') {
      this.noiseBurst(0.04, 0.09, 3300, 'highpass', 1.2)
      this.v5Tone('sawtooth', 940, 118, 0.19, 0.065)
      this.v5Tone('sine', 260, 74, 0.26, 0.075, 0.015)
      return
    }
    super.gunshot(weaponId)
  }

  switchWeapon(): void {
    this.v5Tone('triangle', 470, 260, 0.055, 0.026)
    this.noiseBurst(0.035, 0.018, 1300, 'highpass', 0.7, 0.08)
  }

  questPickup(): void {
    this.v5Tone('triangle', 240, 620, 0.16, 0.04)
    this.v5Tone('sine', 410, 920, 0.2, 0.022, 0.08)
  }

  upgrade(): void {
    this.noiseBurst(0.42, 0.035, 520, 'bandpass', 2.4)
    this.v5Tone('sawtooth', 120, 360, 0.55, 0.045)
    this.v5Tone('sine', 310, 820, 0.42, 0.035, 0.2)
  }

  repairBoat(): void {
    this.noiseBurst(0.12, 0.035, 1600, 'highpass', 0.7)
    this.v5Tone('square', 210, 150, 0.06, 0.026, 0.18)
    this.v5Tone('triangle', 190, 420, 0.28, 0.04, 0.35)
  }

  enterVehicle(kind: VehicleKind): void {
    this.stopVehicle()
    const context = this.ensure()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = kind === 'boat' ? 'sine' : 'sawtooth'
    oscillator.frequency.value = kind === 'boat' ? 52 : kind === 'buggy' ? 76 : 61
    gain.gain.value = kind === 'boat' ? 0.017 : 0.012
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    this.vehicleOscillator = oscillator
    this.vehicleGain = gain
    this.v5Tone('triangle', kind === 'boat' ? 130 : 180, kind === 'boat' ? 62 : 90, 0.35, 0.035)
  }

  updateVehicle(kind: VehicleKind, speedRatio: number): void {
    if (!this.vehicleOscillator || !this.vehicleGain) return
    const context = this.ensure()
    const base = kind === 'boat' ? 52 : kind === 'buggy' ? 76 : 61
    this.vehicleOscillator.frequency.setTargetAtTime(base + Math.abs(speedRatio) * (kind === 'boat' ? 46 : 78), context.currentTime, 0.08)
    this.vehicleGain.gain.setTargetAtTime(0.008 + Math.abs(speedRatio) * 0.015, context.currentTime, 0.12)
  }

  stopVehicle(): void {
    if (this.vehicleGain) {
      const context = this.ensure()
      this.vehicleGain.gain.setTargetAtTime(0.0001, context.currentTime, 0.05)
    }
    if (this.vehicleOscillator) {
      try {
        this.vehicleOscillator.stop(this.ensure().currentTime + 0.18)
      } catch {
        // already stopped
      }
    }
    this.vehicleOscillator = null
    this.vehicleGain = null
  }
}
