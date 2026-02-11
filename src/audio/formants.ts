import { findPeakInRange, findPeaksByDerivative, strongestPeakInRange } from './peaks'
import { peakMagnitudeAt } from './dsp'

// Extract F1, F2, F3 formant frequencies from an LPC spectral envelope
export const extractFormants = (
  envelope: Float32Array,
  sampleRate: number,
): { f1: number; f2: number; f3: number } => {
  const peaks = findPeaksByDerivative(envelope, sampleRate, 100, 4000)

  // Sort peaks by frequency so we assign formants in order
  const sorted = [...peaks].sort((a, b) => a.freq - b.freq)

  // F1: strongest peak in 200-1200 Hz (main vocal tract resonance)
  const f1Peak = strongestPeakInRange(sorted, 200, 1200)
  const f1 = f1Peak ? f1Peak.freq : findPeakInRange(envelope, sampleRate, 200, 1200)

  // F2: lowest-frequency peak above F1 (assign formants in frequency order)
  const f2Min = f1 + 200
  const f2Peak = sorted.find(p => p.freq >= f2Min && p.freq <= 2800) ?? null
  let f2: number
  if (f2Peak) {
    f2 = f2Peak.freq
  } else {
    // No derivative peak found for F2 — back vowels often merge F1+F2 into one broad peak.
    // Tiered fallback: prefer close shoulder near F1 if it has reasonable energy.
    const closeF2 = findPeakInRange(envelope, sampleRate, f1 + 100, 1500)
    const farF2 = findPeakInRange(envelope, sampleRate, 1500, 2800)
    const f1Mag = peakMagnitudeAt(envelope, sampleRate, f1)
    const closeMag = peakMagnitudeAt(envelope, sampleRate, closeF2)
    f2 = closeMag >= 0.15 * f1Mag ? closeF2 : farF2
  }

  // F3: lowest-frequency peak above F2
  const f3Min = f2 + 200
  const f3Peak = sorted.find(p => p.freq >= f3Min && p.freq <= 3800) ?? null
  const f3 = f3Peak ? f3Peak.freq : findPeakInRange(envelope, sampleRate, f3Min, 3800)

  return { f1, f2, f3 }
}
