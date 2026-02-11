import type { Vowel } from './types'
import type { AudioProcessor, PipelineFrame } from './pipe'
import type { VoiceFeatures } from './types'

const WINDOW_SIZE = 7

// Exponential decay weights: most recent = 1.0, then 0.85^n
// Buffer stores newest last, so weights are reversed (index 0 = oldest)
const WEIGHTS = [0.37, 0.44, 0.52, 0.61, 0.72, 0.85, 1.0] as const

// Minimum weighted sum to emit a vowel (replaces uniform MIN_CONSENSUS=3)
const MIN_WEIGHTED_CONSENSUS = 1.5

export type VowelSmoothingState = {
  readonly buffer: ReadonlyArray<Vowel | null>
}

export const initialVowelSmoothingState: VowelSmoothingState = {
  buffer: [],
}

// Add a new raw vowel detection to the window and return the smoothed result
export const smoothVowel = (
  rawVowel: Vowel | null,
  state: VowelSmoothingState,
): { readonly vowel: Vowel | null; readonly state: VowelSmoothingState } => {
  const buffer = state.buffer.length >= WINDOW_SIZE
    ? [...state.buffer.slice(1), rawVowel]
    : [...state.buffer, rawVowel]

  // Compute recency-weighted sum per vowel
  // Buffer has newest at the end; WEIGHTS[i] corresponds to position i in a full buffer
  const weightedCounts = new Map<Vowel, number>()
  const offset = WINDOW_SIZE - buffer.length  // offset for partial buffers

  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i]
    if (v !== null) {
      const w = WEIGHTS[i + offset]
      weightedCounts.set(v, (weightedCounts.get(v) ?? 0) + w)
    }
  }

  if (weightedCounts.size === 0) {
    return { vowel: null, state: { buffer } }
  }

  // Find the vowel with the highest weighted sum
  let bestVowel: Vowel = weightedCounts.keys().next().value!
  let bestScore = 0
  for (const [vowel, score] of weightedCounts) {
    if (score > bestScore) {
      bestScore = score
      bestVowel = vowel
    }
  }

  return {
    vowel: bestScore >= MIN_WEIGHTED_CONSENSUS ? bestVowel : null,
    state: { buffer },
  }
}

// Pipeline-compatible processor: closes over VowelSmoothingState
export const createSmoothingProcessor = (): AudioProcessor => {
  let state: VowelSmoothingState = initialVowelSmoothingState

  return (_frame: PipelineFrame, features: Partial<VoiceFeatures>) => {
    const rawVowel = features.isVoicing ? (features.vowel ?? null) : null
    const smoothed = smoothVowel(rawVowel, state)
    state = smoothed.state
    return { vowel: features.isVoicing ? smoothed.vowel : null }
  }
}
