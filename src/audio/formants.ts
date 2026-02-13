import { findPeakInRange, findPeaksByDerivative } from './peaks'

// Extract F1, F2, F3 formant frequencies from an LPC spectral envelope
// Returns only genuinely strong peaks; nulls for missing formants
export const extractFormants = (
  envelope: Float32Array,
  sampleRate: number,
): { f1: number | null; f2: number | null; f3: number | null } => {
  const peaks = findPeaksByDerivative(envelope, sampleRate, 100, 4000)

  const maxMag = peaks.length > 0 ? Math.max(...peaks.map(p => p.mag)) : 0
  const strong = peaks
    .filter(p => p.mag >= 0.2 * maxMag)
    .sort((a, b) => a.freq - b.freq)

  // F1: derivative peak in 200-1200 Hz, fallback to strongest bin in range
  // (F1 is often a broad LPC lobe without a sharp derivative zero-crossing)
  const f1Peak = strong.find(p => p.freq >= 200 && p.freq <= 1200)
  const f1 = f1Peak
    ? f1Peak.freq
    : findPeakInRange(envelope, sampleRate, 200, 1200)

  // F2: derivative peak preferred, fallback to strongest bin in range
  // (back vowels /o/, /u/ merge F1+F2 into one broad lobe — no derivative peak for F2)
  const f2Min = f1 + 200
  const f2Peak = strong.find(p => p.freq >= f2Min && p.freq <= 3500)
  const f2 = f2Peak
    ? f2Peak.freq
    : findPeakInRange(envelope, sampleRate, f2Min, 3500)

  // F3: derivative peaks only (LPC F3 is unreliable — honest null > fabricated)
  const f3Peak = strong.find(p => p.freq >= f2 + 200 && p.freq <= 4000)
  const f3 = f3Peak?.freq ?? null

  return { f1, f2, f3 }
}
