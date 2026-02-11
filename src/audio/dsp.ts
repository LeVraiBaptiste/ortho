// Minimum RMS energy to consider the signal voiced
export const ENERGY_THRESHOLD = 0.01

// Minimum magnitude for a spectral peak to be considered valid
export const PEAK_MAGNITUDE_THRESHOLD = 0.001

export const applyHammingWindow = (buffer: Float32Array): Float32Array => {
  const n = buffer.length
  const windowed = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1))
    windowed[i] = buffer[i] * w
  }
  return windowed
}

export const applyPreEmphasis = (buffer: Float32Array, coeff: number = 0.97): Float32Array => {
  const result = new Float32Array(buffer.length)
  result[0] = buffer[0]
  for (let i = 1; i < buffer.length; i++) {
    result[i] = buffer[i] - coeff * buffer[i - 1]
  }
  return result
}

const nextPowerOfTwo = (n: number): number => {
  let p = 1
  while (p < n) {
    p *= 2
  }
  return p
}

const reverseBits = (x: number, bits: number): number => {
  let result = 0
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (x & 1)
    x >>= 1
  }
  return result
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
      const tmpR = real[i]
      real[i] = real[j]
      real[j] = tmpR
      const tmpI = imag[i]
      imag[i] = imag[j]
      imag[j] = tmpI
    }
  }
}

// Radix-2 Cooley-Tukey FFT (in-place, iterative)
// Returns magnitude spectrum (first N/2 + 1 bins)
export const computeFFTMagnitude = (buffer: Float32Array): Float32Array => {
  const n = nextPowerOfTwo(buffer.length)

  const real = new Float32Array(n)
  const imag = new Float32Array(n)
  real.set(buffer.subarray(0, Math.min(buffer.length, n)))

  bitReversalPermute(real, imag, n)

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

  const numBins = n / 2 + 1
  const magnitudes = new Float32Array(numBins)
  for (let i = 0; i < numBins; i++) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i])
  }
  return magnitudes
}

export const computeRMS = (buffer: Float32Array): number => {
  let sum = 0
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i]
  }
  return Math.sqrt(sum / buffer.length)
}

export const peakMagnitudeAt = (
  magnitudes: Float32Array,
  sampleRate: number,
  freqHz: number,
): number => {
  const n = (magnitudes.length - 1) * 2
  const bin = Math.round((freqHz * n) / sampleRate)
  const clampedBin = Math.max(0, Math.min(magnitudes.length - 1, bin))
  return magnitudes[clampedBin]
}
