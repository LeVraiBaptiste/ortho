import type { Vowel } from './types'

const WINDOW_SIZE = 7

// Minimum number of agreeing detections to emit a vowel
const MIN_CONSENSUS = 3

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

  // Count occurrences of each non-null vowel
  const counts = new Map<Vowel, number>()
  for (const v of buffer) {
    if (v !== null) {
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
  }

  if (counts.size === 0) {
    return { vowel: null, state: { buffer } }
  }

  // Find the vowel with the highest count
  let bestVowel: Vowel = counts.keys().next().value!
  let bestCount = 0
  for (const [vowel, count] of counts) {
    if (count > bestCount) {
      bestCount = count
      bestVowel = vowel
    }
  }

  return {
    vowel: bestCount >= MIN_CONSENSUS ? bestVowel : null,
    state: { buffer },
  }
}
