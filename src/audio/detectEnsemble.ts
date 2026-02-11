import type { Vowel } from './types'
import { detectVowel } from './detectLpc'
import { detectVowelMfcc } from './detectMfcc'

// Ensemble vowel detection: combines LPC-based and MFCC-based detectors.
// Rather than picking one detector's output, we expose a frame-level
// function that returns both votes so callers can do majority voting
// across all frames from both detectors combined.

// Simple per-frame ensemble: when both agree it is high-confidence;
// when they disagree we prefer MFCC (higher overall accuracy: 27/40 vs 24/40).
export const detectVowelEnsemble = (
  buffer: Float32Array,
  sampleRate: number,
): Vowel | null => {
  const lpcResult = detectVowel(buffer, sampleRate)
  const mfccResult = detectVowelMfcc(buffer, sampleRate)

  // Both null -> no detection
  if (lpcResult === null && mfccResult === null) return null

  // One null -> use the other
  if (lpcResult === null) return mfccResult
  if (mfccResult === null) return lpcResult

  // Both agree -> high confidence
  if (lpcResult === mfccResult) return lpcResult

  // Disagreement -> prefer MFCC (higher overall accuracy)
  return mfccResult
}

// Returns both detector votes for a single frame.
// Callers can pool votes across many frames for majority voting,
// which naturally weights agreement (2 matching votes) over disagreement.
export const detectVowelEnsembleVotes = (
  buffer: Float32Array,
  sampleRate: number,
): (Vowel | null)[] => {
  const lpcResult = detectVowel(buffer, sampleRate)
  const mfccResult = detectVowelMfcc(buffer, sampleRate)
  return [lpcResult, mfccResult]
}
