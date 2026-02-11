import type { Vowel } from './types'
import { applyPreEmphasis, applyHammingWindow, computeFFTMagnitude } from './dsp'

// --- Mel filterbank ---

const hzToMel = (hz: number): number => 2595 * Math.log10(1 + hz / 700)
const melToHz = (mel: number): number => 700 * (10 ** (mel / 2595) - 1)

// Create triangular mel filterbank matrix
const createMelFilterbank = (
  numFilters: number,
  fftSize: number,
  sampleRate: number,
  minHz: number = 0,
  maxHz?: number,
): Float32Array[] => {
  const nyquist = maxHz ?? sampleRate / 2
  const numBins = fftSize / 2 + 1

  // Mel-spaced center frequencies
  const minMel = hzToMel(minHz)
  const maxMel = hzToMel(nyquist)
  const melPoints: number[] = []
  for (let i = 0; i <= numFilters + 1; i++) {
    melPoints.push(melToHz(minMel + (i * (maxMel - minMel)) / (numFilters + 1)))
  }

  // Convert to FFT bin indices
  const binPoints = melPoints.map(hz => Math.round((hz * fftSize) / sampleRate))

  const filters: Float32Array[] = []
  for (let i = 0; i < numFilters; i++) {
    const filter = new Float32Array(numBins)
    const start = binPoints[i]
    const center = binPoints[i + 1]
    const end = binPoints[i + 2]

    for (let j = start; j < center; j++) {
      if (j >= 0 && j < numBins && center !== start) {
        filter[j] = (j - start) / (center - start)
      }
    }
    for (let j = center; j <= end; j++) {
      if (j >= 0 && j < numBins && end !== center) {
        filter[j] = (end - j) / (end - center)
      }
    }
    filters.push(filter)
  }

  return filters
}

// --- DCT-II (Type 2 Discrete Cosine Transform) ---

const dctII = (input: Float32Array, numCoeffs: number): Float32Array => {
  const n = input.length
  const output = new Float32Array(numCoeffs)

  for (let k = 0; k < numCoeffs; k++) {
    let sum = 0
    for (let i = 0; i < n; i++) {
      sum += input[i] * Math.cos((Math.PI * k * (2 * i + 1)) / (2 * n))
    }
    output[k] = sum
  }

  return output
}

// --- MFCC computation ---

const NUM_MEL_FILTERS = 26
const NUM_MFCC = 13 // number of cepstral coefficients to keep
const ENERGY_THRESHOLD = 0.01

// Cached filterbank (lazily initialized)
let cachedFilterbank: Float32Array[] | null = null
let cachedFftSize = 0
let cachedSampleRate = 0

const getFilterbank = (fftSize: number, sampleRate: number): Float32Array[] => {
  if (cachedFilterbank && cachedFftSize === fftSize && cachedSampleRate === sampleRate) {
    return cachedFilterbank
  }
  cachedFilterbank = createMelFilterbank(NUM_MEL_FILTERS, fftSize, sampleRate, 100, 4000)
  cachedFftSize = fftSize
  cachedSampleRate = sampleRate
  return cachedFilterbank
}

export const computeMfcc = (buffer: Float32Array, sampleRate: number): Float32Array | null => {
  // Energy check
  let rms = 0
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i]
  rms = Math.sqrt(rms / buffer.length)
  if (rms < ENERGY_THRESHOLD) return null

  const preEmphasized = applyPreEmphasis(buffer)
  const windowed = applyHammingWindow(preEmphasized)
  const magnitudes = computeFFTMagnitude(windowed)
  const fftSize = (magnitudes.length - 1) * 2

  const filterbank = getFilterbank(fftSize, sampleRate)

  // Apply mel filterbank and take log
  const melEnergies = new Float32Array(NUM_MEL_FILTERS)
  for (let i = 0; i < NUM_MEL_FILTERS; i++) {
    let energy = 0
    const filter = filterbank[i]
    for (let j = 0; j < magnitudes.length && j < filter.length; j++) {
      energy += magnitudes[j] * magnitudes[j] * filter[j] // power spectrum * filter
    }
    melEnergies[i] = Math.log(Math.max(energy, 1e-10))
  }

  // DCT to get MFCCs
  return dctII(melEnergies, NUM_MFCC)
}

// --- Pre-defined MFCC centroids per vowel ---

type MfccTemplate = { readonly vowel: Vowel; readonly mfcc: readonly number[] }

// Pre-computed MFCC centroids (will be populated by calibration)
let mfccTemplates: MfccTemplate[] = []

// Calibrate MFCC templates from labeled data
export const calibrateMfccTemplates = (
  templates: { vowel: Vowel; mfccs: Float32Array[] }[]
): void => {
  mfccTemplates = templates.map(({ vowel, mfccs }) => {
    // Compute mean MFCC vector
    const mean = new Array(NUM_MFCC).fill(0) as number[]
    for (const m of mfccs) {
      for (let i = 0; i < NUM_MFCC; i++) mean[i] += m[i]
    }
    for (let i = 0; i < NUM_MFCC; i++) mean[i] /= mfccs.length
    return { vowel, mfcc: mean }
  })
}

export const detectVowelMfcc = (buffer: Float32Array, sampleRate: number): Vowel | null => {
  const mfcc = computeMfcc(buffer, sampleRate)
  if (!mfcc) return null

  return classifyByMfccDistance(mfcc)
}

const classifyByMfccDistance = (mfcc: Float32Array): Vowel | null => {
  if (mfccTemplates.length === 0) return null

  let bestVowel: Vowel | null = null
  let bestDist = Infinity

  for (const template of mfccTemplates) {
    let dist = 0
    // Skip c0 (energy), weight higher coefficients less
    for (let i = 1; i < NUM_MFCC && i < template.mfcc.length; i++) {
      const d = mfcc[i] - template.mfcc[i]
      const weight = i <= 4 ? 1.0 : 0.5 // first 4 coefficients are most important
      dist += weight * d * d
    }
    if (dist < bestDist) {
      bestDist = dist
      bestVowel = template.vowel
    }
  }

  return bestVowel
}
