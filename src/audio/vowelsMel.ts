import type { Vowel } from './types'
import { computeRMS } from './volume'
import { applyHammingWindow, computeFFTMagnitude, classifyVowel } from './vowels'

// --- Mel scale conversions (O'Shaughnessy) ---

export const hzToMel = (hz: number): number =>
  2595 * Math.log10(1 + hz / 700)

export const melToHz = (mel: number): number =>
  700 * (10 ** (mel / 2595) - 1)

// --- Types ---

export type MelFilterBank = {
  readonly filters: Float32Array[]
  readonly centerFreqs: number[]
  readonly numFilters: number
  readonly fftSize: number
  readonly sampleRate: number
}

export type MelPeak = {
  readonly melBin: number
  readonly magnitude: number
  readonly freqHz: number
}

// --- Mel filter bank creation with simple memoization ---

let cachedFilterBank: MelFilterBank | null = null
let cachedParams: { numFilters: number; fftSize: number; sampleRate: number; minHz: number; maxHz: number } | null = null

export const createMelFilterBank = (
  numFilters: number,
  fftSize: number,
  sampleRate: number,
  minHz: number,
  maxHz: number,
): MelFilterBank => {
  // Return cached result if params match
  if (
    cachedFilterBank !== null &&
    cachedParams !== null &&
    cachedParams.numFilters === numFilters &&
    cachedParams.fftSize === fftSize &&
    cachedParams.sampleRate === sampleRate &&
    cachedParams.minHz === minHz &&
    cachedParams.maxHz === maxHz
  ) {
    return cachedFilterBank
  }

  const minMel = hzToMel(minHz)
  const maxMel = hzToMel(maxHz)

  // numFilters + 2 points evenly spaced in mel scale (includes 2 boundary points)
  const numPoints = numFilters + 2
  const melPoints = new Float32Array(numPoints)
  const melStep = (maxMel - minMel) / (numPoints - 1)
  for (let i = 0; i < numPoints; i++) {
    melPoints[i] = minMel + i * melStep
  }

  // Convert back to Hz
  const hzPoints = new Float32Array(numPoints)
  for (let i = 0; i < numPoints; i++) {
    hzPoints[i] = melToHz(melPoints[i])
  }

  // Convert Hz to FFT bin indices
  const binPoints = new Int32Array(numPoints)
  for (let i = 0; i < numPoints; i++) {
    binPoints[i] = Math.floor(hzPoints[i] * fftSize / sampleRate)
  }

  const numBins = fftSize / 2 + 1
  const filters: Float32Array[] = []
  const centerFreqs: number[] = []

  for (let i = 0; i < numFilters; i++) {
    const filter = new Float32Array(numBins)
    const startBin = binPoints[i]
    const centerBin = binPoints[i + 1]
    const endBin = binPoints[i + 2]

    // Rising slope: from point[i] to point[i+1]
    for (let b = startBin; b <= centerBin; b++) {
      if (b >= 0 && b < numBins && centerBin !== startBin) {
        filter[b] = (b - startBin) / (centerBin - startBin)
      }
    }

    // Falling slope: from point[i+1] to point[i+2]
    for (let b = centerBin + 1; b <= endBin; b++) {
      if (b >= 0 && b < numBins && endBin !== centerBin) {
        filter[b] = (endBin - b) / (endBin - centerBin)
      }
    }

    filters.push(filter)
    centerFreqs.push(hzPoints[i + 1])
  }

  const filterBank: MelFilterBank = {
    filters,
    centerFreqs,
    numFilters,
    fftSize,
    sampleRate,
  }

  // Cache the result
  cachedParams = { numFilters, fftSize, sampleRate, minHz, maxHz }
  cachedFilterBank = filterBank

  return filterBank
}

// --- Apply mel filter bank to power spectrum ---

export const applyMelFilterBank = (
  powerSpectrum: Float32Array,
  filterBank: MelFilterBank,
): Float32Array => {
  const melEnergies = new Float32Array(filterBank.numFilters)

  for (let i = 0; i < filterBank.numFilters; i++) {
    const filter = filterBank.filters[i]
    let energy = 0
    for (let j = 0; j < powerSpectrum.length; j++) {
      energy += powerSpectrum[j] * filter[j]
    }
    melEnergies[i] = Math.log(energy + 1e-10)
  }

  return melEnergies
}

// --- Peak finding in mel energy array ---

export const findMelPeaks = (
  melEnergies: Float32Array,
  filterBank: MelFilterBank,
  confirmBins: number = 3,
): MelPeak[] => {
  const peaks: MelPeak[] = []

  for (let i = confirmBins; i < melEnergies.length - confirmBins; i++) {
    let isPeak = true
    for (let d = 1; d <= confirmBins; d++) {
      if (melEnergies[i] <= melEnergies[i - d] || melEnergies[i] <= melEnergies[i + d]) {
        isPeak = false
        break
      }
    }
    if (isPeak) {
      peaks.push({
        melBin: i,
        magnitude: melEnergies[i],
        freqHz: filterBank.centerFreqs[i],
      })
    }
  }

  // Sort by frequency ascending
  peaks.sort((a, b) => a.freqHz - b.freqHz)

  return peaks
}

// --- Extract formants from mel peaks ---

export const extractFormantsFromMelPeaks = (
  peaks: MelPeak[],
): { f1: number; f2: number; f3: number } | null => {
  if (peaks.length < 2) return null

  // Sort peaks by frequency
  const sorted = [...peaks].sort((a, b) => a.freqHz - b.freqHz)

  // F1: first peak with freqHz >= 150 and <= 1200
  const f1Peak = sorted.find(p => p.freqHz >= 150 && p.freqHz <= 1200)
  if (!f1Peak) return null

  // F2: first peak with freqHz > F1 + 200 and <= 3000
  const f2Peak = sorted.find(p => p.freqHz > f1Peak.freqHz + 200 && p.freqHz <= 3000)
  if (!f2Peak) return null

  // F3: first peak with freqHz > F2 + 200 and <= 4000
  const f3Peak = sorted.find(p => p.freqHz > f2Peak.freqHz + 200 && p.freqHz <= 4000)
  const f3 = f3Peak ? f3Peak.freqHz : 2500

  return { f1: f1Peak.freqHz, f2: f2Peak.freqHz, f3 }
}

// --- Main entry point ---

export const detectVowelMel = (
  buffer: Float32Array,
  sampleRate: number,
): Vowel | null => {
  if (computeRMS(buffer) < 0.01) return null

  const windowed = applyHammingWindow(buffer)
  const magnitudes = computeFFTMagnitude(windowed)

  // Compute power spectrum
  const power = new Float32Array(magnitudes.length)
  for (let i = 0; i < magnitudes.length; i++) {
    power[i] = magnitudes[i] * magnitudes[i]
  }

  const filterBank = createMelFilterBank(128, (magnitudes.length - 1) * 2, sampleRate, 50, 4000)
  const melEnergies = applyMelFilterBank(power, filterBank)
  const peaks = findMelPeaks(melEnergies, filterBank, 3)
  const formants = extractFormantsFromMelPeaks(peaks)

  if (formants === null) return null

  return classifyVowel(formants.f1, formants.f2, formants.f3)
}
