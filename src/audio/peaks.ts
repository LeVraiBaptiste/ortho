export type SpectralPeak = { readonly freq: number; readonly mag: number }

// Find the frequency of the highest magnitude peak in a given Hz range
export const findPeakInRange = (
  magnitudes: Float32Array,
  sampleRate: number,
  minHz: number,
  maxHz: number,
): number => {
  const n = (magnitudes.length - 1) * 2
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

// Find peaks using first-derivative zero-crossings (positive-to-negative = peak)
export const findPeaksByDerivative = (
  envelope: Float32Array,
  sampleRate: number,
  minHz: number,
  maxHz: number,
): SpectralPeak[] => {
  const n = (envelope.length - 1) * 2
  const binToHz = sampleRate / n
  const minBin = Math.max(1, Math.ceil(minHz / binToHz))
  const maxBin = Math.min(envelope.length - 3, Math.floor(maxHz / binToHz))
  const peaks: SpectralPeak[] = []

  for (let i = minBin; i <= maxBin; i++) {
    const d0 = envelope[i] - envelope[i - 1]
    const d1 = envelope[i + 1] - envelope[i]
    if (d0 > 0 && d1 <= 0) {
      const alpha = envelope[i - 1]
      const beta = envelope[i]
      const gamma = envelope[i + 1]
      const denom = alpha - 2 * beta + gamma
      let freq = i * binToHz
      if (denom !== 0) {
        const correction = 0.5 * (alpha - gamma) / denom
        freq = (i + correction) * binToHz
      }
      peaks.push({ freq, mag: beta })
    }
  }

  return peaks
}

