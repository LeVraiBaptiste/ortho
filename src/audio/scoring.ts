import type { Vowel } from './types'
import { VOWEL_TARGETS, VOWEL_RATIO_TARGETS, hzToBark } from './vowelTargets'
import { findPeaksByDerivative } from './peaks'
import { extractFormants } from './formants'

export type VowelScore = { readonly vowel: Vowel; readonly score: number }
export type VowelScorer = (envelope: Float32Array, sampleRate: number) => VowelScore[]

// Scorer: sum envelope energy in ~100Hz bands around each formant
export const scoreByBandEnergy: VowelScorer = (envelope, sampleRate) => {
  const n = (envelope.length - 1) * 2
  const binToHz = sampleRate / n
  const bandWidthHz = 100
  const halfBandBins = Math.ceil(bandWidthHz / (2 * binToHz))

  let totalEnergy = 0
  for (let i = 0; i < envelope.length; i++) {
    totalEnergy += envelope[i]
  }
  if (totalEnergy === 0) totalEnergy = 1

  const scores: VowelScore[] = []

  for (const target of VOWEL_TARGETS) {
    const sumBand = (centerHz: number, weight: number): number => {
      const centerBin = Math.round(centerHz / binToHz)
      const lo = Math.max(0, centerBin - halfBandBins)
      const hi = Math.min(envelope.length - 1, centerBin + halfBandBins)
      let sum = 0
      for (let i = lo; i <= hi; i++) {
        sum += envelope[i]
      }
      return sum * weight / totalEnergy
    }

    const score = sumBand(target.f1, 2.0) + sumBand(target.f2, 1.0) + sumBand(target.f3, 0.5)
    scores.push({ vowel: target.vowel, score })
  }

  return scores.sort((a, b) => b.score - a.score)
}

// Scorer: strict peak proximity — find real spectral peaks, reject vowels
// where no real peak exists near the target F1 or F2
export const scoreByPeakProximity: VowelScorer = (envelope, sampleRate) => {
  const peaks = findPeaksByDerivative(envelope, sampleRate, 100, 4000)
  if (peaks.length < 2) return VOWEL_TARGETS.map(t => ({ vowel: t.vowel, score: 0 }))

  const MAX_BARK_F1 = 1.5
  const MAX_BARK_F2 = 2.0

  const scores: VowelScore[] = []

  for (const target of VOWEL_TARGETS) {
    const targetB1 = hzToBark(target.f1)
    const targetB2 = hzToBark(target.f2)
    const targetB3 = hzToBark(target.f3)

    let nearestF1Dist = Infinity
    let nearestF2Dist = Infinity
    let nearestF3Dist = Infinity

    for (const peak of peaks) {
      const b = hzToBark(peak.freq)
      const d1 = Math.abs(b - targetB1)
      const d2 = Math.abs(b - targetB2)
      const d3 = Math.abs(b - targetB3)
      if (d1 < nearestF1Dist) nearestF1Dist = d1
      if (d2 < nearestF2Dist) nearestF2Dist = d2
      if (d3 < nearestF3Dist) nearestF3Dist = d3
    }

    if (nearestF1Dist > MAX_BARK_F1 || nearestF2Dist > MAX_BARK_F2) {
      scores.push({ vowel: target.vowel, score: 0 })
      continue
    }

    const dist = 2 * nearestF1Dist * nearestF1Dist + nearestF2Dist * nearestF2Dist + 0.5 * nearestF3Dist * nearestF3Dist
    scores.push({ vowel: target.vowel, score: 1 / (1 + dist) })
  }

  return scores.sort((a, b) => b.score - a.score)
}

// Scorer: formant ratio distance — speaker-invariant via log(F2/F1) and log(F3/F2)
export const scoreByFormantRatios: VowelScorer = (envelope, sampleRate) => {
  const { f1, f2, f3 } = extractFormants(envelope, sampleRate)

  if (f1 === null || f2 === null || f3 === null || f1 <= 0 || f2 <= 0 || f3 <= 0 || f2 <= f1 || f3 <= f2) {
    return VOWEL_TARGETS.map(t => ({ vowel: t.vowel, score: 0 }))
  }

  const logR1 = Math.log(f2 / f1)
  const logR2 = Math.log(f3 / f2)

  const scores: VowelScore[] = []

  for (const target of VOWEL_RATIO_TARGETS) {
    const dist = 2 * (logR1 - target.logR1) ** 2 + (logR2 - target.logR2) ** 2
    scores.push({ vowel: target.vowel, score: 1 / (1 + dist) })
  }

  return scores.sort((a, b) => b.score - a.score)
}

export const pickBestVowel = (scores: VowelScore[]): Vowel | null => {
  if (scores.length === 0) return null
  return scores[0].vowel
}
