import type { Vowel, VowelTarget } from './types'

// French vowel formant targets (F1, F2 in Hz)
const VOWEL_TARGETS: readonly VowelTarget[] = [
  { vowel: 'a', f1: 750, f2: 1400 },
  { vowel: 'e', f1: 400, f2: 2200 },
  { vowel: 'ɛ', f1: 550, f2: 1900 },
  { vowel: 'i', f1: 280, f2: 2300 },
  { vowel: 'o', f1: 450, f2: 800 },
  { vowel: 'u', f1: 310, f2: 800 },
  { vowel: 'y', f1: 280, f2: 1800 },
] as const

// Minimum RMS energy to consider the signal voiced
const ENERGY_THRESHOLD = 0.01

// Minimum magnitude for a spectral peak to be considered valid
const PEAK_MAGNITUDE_THRESHOLD = 0.001

// --- Helper functions ---

export const applyHammingWindow = (buffer: Float32Array): Float32Array => {
  const n = buffer.length
  const windowed = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1))
    windowed[i] = buffer[i] * w
  }
  return windowed
}

// Radix-2 Cooley-Tukey FFT (in-place, iterative)
// Returns magnitude spectrum (first N/2 + 1 bins)
export const computeFFTMagnitude = (buffer: Float32Array): Float32Array => {
  const n = nextPowerOfTwo(buffer.length)

  // Zero-pad if needed and create real/imag arrays
  const real = new Float32Array(n)
  const imag = new Float32Array(n)
  real.set(buffer.subarray(0, Math.min(buffer.length, n)))

  // Bit-reversal permutation
  bitReversalPermute(real, imag, n)

  // Cooley-Tukey butterfly stages
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2
    const angleStep = (-2 * Math.PI) / size

    for (let i = 0; i < n; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const angle = angleStep * j
        const twiddleReal = Math.cos(angle)
        const twiddleImag = Math.sin(angle)

        const evenIdx = i + j
        const oddIdx = i + j + halfSize

        const tReal = twiddleReal * real[oddIdx] - twiddleImag * imag[oddIdx]
        const tImag = twiddleReal * imag[oddIdx] + twiddleImag * real[oddIdx]

        real[oddIdx] = real[evenIdx] - tReal
        imag[oddIdx] = imag[evenIdx] - tImag
        real[evenIdx] = real[evenIdx] + tReal
        imag[evenIdx] = imag[evenIdx] + tImag
      }
    }
  }

  // Compute magnitude for the first half of the spectrum
  const numBins = n / 2 + 1
  const magnitudes = new Float32Array(numBins)
  for (let i = 0; i < numBins; i++) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i])
  }
  return magnitudes
}

// Find the frequency of the highest magnitude peak in a given Hz range
export const findPeakInRange = (
  magnitudes: Float32Array,
  sampleRate: number,
  minHz: number,
  maxHz: number,
): number => {
  const n = (magnitudes.length - 1) * 2 // original FFT size
  const binToHz = sampleRate / n

  const minBin = Math.max(1, Math.ceil(minHz / binToHz))
  const maxBin = Math.min(magnitudes.length - 1, Math.floor(maxHz / binToHz))

  let peakBin = minBin
  let peakMag = magnitudes[minBin]

  for (let i = minBin + 1; i <= maxBin; i++) {
    if (magnitudes[i] > peakMag) {
      peakMag = magnitudes[i]
      peakBin = i
    }
  }

  // Parabolic interpolation around the peak for sub-bin accuracy
  if (peakBin > minBin && peakBin < maxBin) {
    const alpha = magnitudes[peakBin - 1]
    const beta = magnitudes[peakBin]
    const gamma = magnitudes[peakBin + 1]
    const denom = alpha - 2 * beta + gamma
    if (denom !== 0) {
      const correction = 0.5 * (alpha - gamma) / denom
      return (peakBin + correction) * binToHz
    }
  }

  return peakBin * binToHz
}

// Classify a vowel from F1/F2 using nearest Euclidean distance
export const classifyVowel = (f1: number, f2: number): Vowel => {
  let bestVowel: Vowel = VOWEL_TARGETS[0].vowel
  let bestDist = Infinity

  for (const target of VOWEL_TARGETS) {
    const d1 = f1 - target.f1
    const d2 = f2 - target.f2
    const dist = d1 * d1 + d2 * d2
    if (dist < bestDist) {
      bestDist = dist
      bestVowel = target.vowel
    }
  }

  return bestVowel
}

// --- Main detection ---

export const detectVowel = (
  buffer: Float32Array,
  sampleRate: number,
): Vowel | null => {
  // Check signal energy
  if (computeRMS(buffer) < ENERGY_THRESHOLD) {
    return null
  }

  const windowed = applyHammingWindow(buffer)
  const magnitudes = computeFFTMagnitude(windowed)

  // Find formant peaks
  const f1 = findPeakInRange(magnitudes, sampleRate, 200, 900)
  const f2 = findPeakInRange(magnitudes, sampleRate, 700, 2500)

  // Validate peaks have sufficient magnitude
  const f1Mag = peakMagnitudeAt(magnitudes, sampleRate, f1)
  const f2Mag = peakMagnitudeAt(magnitudes, sampleRate, f2)

  if (f1Mag < PEAK_MAGNITUDE_THRESHOLD || f2Mag < PEAK_MAGNITUDE_THRESHOLD) {
    return null
  }

  // F2 should be higher than F1 for a valid vowel formant structure
  if (f2 <= f1) {
    return null
  }

  return classifyVowel(f1, f2)
}

// --- Internal utilities ---

const computeRMS = (buffer: Float32Array): number => {
  let sum = 0
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i]
  }
  return Math.sqrt(sum / buffer.length)
}

const nextPowerOfTwo = (n: number): number => {
  let p = 1
  while (p < n) {
    p *= 2
  }
  return p
}

const bitReversalPermute = (
  real: Float32Array,
  imag: Float32Array,
  n: number,
): void => {
  const bits = Math.log2(n)
  for (let i = 0; i < n; i++) {
    const j = reverseBits(i, bits)
    if (j > i) {
      // Swap real
      const tmpR = real[i]
      real[i] = real[j]
      real[j] = tmpR
      // Swap imag
      const tmpI = imag[i]
      imag[i] = imag[j]
      imag[j] = tmpI
    }
  }
}

const reverseBits = (x: number, bits: number): number => {
  let result = 0
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (x & 1)
    x >>= 1
  }
  return result
}

const peakMagnitudeAt = (
  magnitudes: Float32Array,
  sampleRate: number,
  freqHz: number,
): number => {
  const n = (magnitudes.length - 1) * 2
  const bin = Math.round((freqHz * n) / sampleRate)
  const clampedBin = Math.max(0, Math.min(magnitudes.length - 1, bin))
  return magnitudes[clampedBin]
}
