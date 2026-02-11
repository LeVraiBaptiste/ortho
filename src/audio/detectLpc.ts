import type { Vowel, FormantData } from './types'
import { applyPreEmphasis, applyHammingWindow, computeFFTMagnitude, computeRMS, peakMagnitudeAt, ENERGY_THRESHOLD, PEAK_MAGNITUDE_THRESHOLD } from './dsp'
import { LPC_ORDER, decimateSignal, computeAutocorrelation, levinsonDurbin, evaluateLpcEnvelope, enhanceLpcEnvelope } from './lpc'
import { findPeakInRange, findPeaksByDerivative } from './peaks'
import { VOWEL_TARGETS, hzToBark, classifyVowel } from './vowelTargets'
import { scoreByBandEnergy, scoreByPeakProximity } from './scoring'
import { extractFormants } from './formants'
import type { VowelScore } from './scoring'

export type FormantAnalysis = {
  readonly vowel: Vowel | null
  readonly formants: FormantData | null
}

export const detectVowel = (
  buffer: Float32Array,
  sampleRate: number,
): Vowel | null => {
  if (computeRMS(buffer) < ENERGY_THRESHOLD) {
    return null
  }

  const preEmphasized = applyPreEmphasis(buffer)
  const windowed = applyHammingWindow(preEmphasized)

  // Decimate to ~8.8kHz for LPC (focuses all poles on the 0-4.4kHz formant region)
  const decimationFactor = Math.max(1, Math.floor(sampleRate / 8500))
  const decimated = decimateSignal(windowed, decimationFactor)
  const decimatedRate = sampleRate / decimationFactor

  const R = computeAutocorrelation(decimated, LPC_ORDER)
  const { coeffs, gain } = levinsonDurbin(R, LPC_ORDER)

  const magnitudes = computeFFTMagnitude(windowed)
  const fftSize = (magnitudes.length - 1) * 2
  const lpcEnvelope = evaluateLpcEnvelope(coeffs, gain, magnitudes.length, decimatedRate, sampleRate, fftSize)

  // Step 1: Find real spectral peaks for strict gating
  const peaks = findPeaksByDerivative(lpcEnvelope, sampleRate, 100, 4000)

  // Step 2: Determine which vowels have real peaks near their targets
  const MAX_BARK_F1 = 1.5
  const MAX_BARK_F2 = 2.0
  const eligible = new Set<Vowel>()

  // Compute band energy ratios for fallback gating
  const n = (lpcEnvelope.length - 1) * 2
  const binToHz = sampleRate / n
  const bandWidthHz = 200
  const halfBandBins = Math.ceil(bandWidthHz / (2 * binToHz))
  let totalEnergy = 0
  for (let i = 0; i < lpcEnvelope.length; i++) totalEnergy += lpcEnvelope[i]
  if (totalEnergy === 0) totalEnergy = 1

  const bandEnergyRatio = (centerHz: number): number => {
    const centerBin = Math.round(centerHz / binToHz)
    const lo = Math.max(0, centerBin - halfBandBins)
    const hi = Math.min(lpcEnvelope.length - 1, centerBin + halfBandBins)
    let sum = 0
    for (let i = lo; i <= hi; i++) sum += lpcEnvelope[i]
    return sum / totalEnergy
  }

  for (const target of VOWEL_TARGETS) {
    const targetB1 = hzToBark(target.f1)
    const targetB2 = hzToBark(target.f2)

    let nearestF1Dist = Infinity
    let nearestF2Dist = Infinity

    for (const peak of peaks) {
      const b = hzToBark(peak.freq)
      const d1 = Math.abs(b - targetB1)
      const d2 = Math.abs(b - targetB2)
      if (d1 < nearestF1Dist) nearestF1Dist = d1
      if (d2 < nearestF2Dist) nearestF2Dist = d2
    }

    const peakGate = nearestF1Dist <= MAX_BARK_F1 && nearestF2Dist <= MAX_BARK_F2
    const f1Energy = bandEnergyRatio(target.f1)
    const f2Energy = bandEnergyRatio(target.f2)
    const energyGate = f1Energy > 0.08 && f2Energy > 0.04

    if (peakGate || energyGate) {
      eligible.add(target.vowel)
    }
  }

  if (eligible.size === 0) return null

  // Step 3: Rank fusion among eligible vowels only
  const bandScores = scoreByBandEnergy(lpcEnvelope, sampleRate)
  const proximityScores = scoreByPeakProximity(lpcEnvelope, sampleRate)
  // Guided template matching
  const templateScores: VowelScore[] = []
  for (const target of VOWEL_TARGETS) {
    const f1 = findPeakInRange(lpcEnvelope, sampleRate,
      Math.max(100, target.f1 - 200), target.f1 + 200)
    const f2 = findPeakInRange(lpcEnvelope, sampleRate,
      Math.max(target.f1 + 100, target.f2 - 300), target.f2 + 300)
    const f3 = findPeakInRange(lpcEnvelope, sampleRate,
      Math.max(target.f2 + 100, target.f3 - 400), target.f3 + 400)

    const f1Mag = peakMagnitudeAt(lpcEnvelope, sampleRate, f1)
    const f2Mag = peakMagnitudeAt(lpcEnvelope, sampleRate, f2)

    const d1 = hzToBark(f1) - hzToBark(target.f1)
    const d2 = hzToBark(f2) - hzToBark(target.f2)
    const d3 = hzToBark(f3) - hzToBark(target.f3)
    const dist = 2 * d1 * d1 + d2 * d2 + 0.5 * d3 * d3

    const ampScore = f1Mag + f2Mag
    const score = ampScore / (1 + dist)
    templateScores.push({ vowel: target.vowel, score })
  }
  templateScores.sort((a, b) => b.score - a.score)

  // Reciprocal rank fusion with 3 scorers
  const k = 10
  const fusedScores = new Map<Vowel, number>()
  for (const rankedScores of [bandScores, templateScores, proximityScores]) {
    for (let rank = 0; rank < rankedScores.length; rank++) {
      const v = rankedScores[rank].vowel
      if (!eligible.has(v)) continue
      fusedScores.set(v, (fusedScores.get(v) ?? 0) + 1 / (k + rank))
    }
  }

  let bestVowel: Vowel | null = null
  let bestFused = -Infinity
  for (const [vowel, score] of fusedScores) {
    if (score > bestFused) {
      bestFused = score
      bestVowel = vowel
    }
  }

  return bestVowel
}

export const analyzeFormants = (
  buffer: Float32Array,
  sampleRate: number,
): FormantAnalysis => {
  if (computeRMS(buffer) < ENERGY_THRESHOLD) {
    return { vowel: null, formants: null }
  }

  const preEmphasized = applyPreEmphasis(buffer)
  const windowed = applyHammingWindow(preEmphasized)
  const magnitudes = computeFFTMagnitude(windowed)

  const decimationFactor = Math.max(1, Math.floor(sampleRate / 11000))
  const decimated = decimateSignal(windowed, decimationFactor)
  const decimatedRate = sampleRate / decimationFactor

  const R = computeAutocorrelation(decimated, LPC_ORDER)
  const { coeffs, gain } = levinsonDurbin(R, LPC_ORDER)

  const fftSize = (magnitudes.length - 1) * 2
  const lpcEnvelope = evaluateLpcEnvelope(coeffs, gain, magnitudes.length, decimatedRate, sampleRate, fftSize)

  const enhanced = enhanceLpcEnvelope(lpcEnvelope, 2)

  const { f1, f2, f3 } = extractFormants(enhanced, sampleRate)

  const f1Mag = peakMagnitudeAt(enhanced, sampleRate, f1)
  const f2Mag = peakMagnitudeAt(enhanced, sampleRate, f2)
  const f3Mag = peakMagnitudeAt(enhanced, sampleRate, f3)

  const formants: FormantData = { magnitudes, lpcEnvelope: enhanced, sampleRate, fftSize, f1, f2, f3 }

  if (f1Mag < PEAK_MAGNITUDE_THRESHOLD || f2Mag < PEAK_MAGNITUDE_THRESHOLD || f3Mag < PEAK_MAGNITUDE_THRESHOLD) {
    return { vowel: null, formants }
  }

  return { vowel: classifyVowel(f1, f2, f3), formants }
}
