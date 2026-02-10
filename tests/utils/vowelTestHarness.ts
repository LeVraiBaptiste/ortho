import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Vowel } from '../../src/audio/types'

export const VOWELS: Vowel[] = ['a', 'e', 'ɛ', 'i', 'o', 'u', 'y']

// Frame size for analysis (~23ms at 44100Hz)
export const FRAME_SIZE = 1024
// Overlap between frames (50%)
export const HOP_SIZE = 512

export type DetectFn = (buffer: Float32Array, sampleRate: number) => Vowel | null

export const getWavFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.wav'))
    .map(f => join(dir, f))
}

// Extract overlapping frames from the stable middle portion of the signal
export const extractFrames = (samples: Float32Array, frameSize: number, hopSize: number): Float32Array[] => {
  const frames: Float32Array[] = []
  // Use middle 60% of the signal to avoid onset/offset transients
  const start = Math.floor(samples.length * 0.2)
  const end = Math.floor(samples.length * 0.8)

  for (let i = start; i + frameSize <= end; i += hopSize) {
    frames.push(samples.slice(i, i + frameSize))
  }
  return frames
}

// Majority vote: which vowel was detected most often?
export const majorityVote = (detections: (Vowel | null)[]): Vowel | null => {
  const counts = new Map<Vowel, number>()
  for (const v of detections) {
    if (v !== null) {
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
  }
  if (counts.size === 0) return null
  let best: Vowel | null = null
  let bestCount = 0
  for (const [vowel, count] of counts) {
    if (count > bestCount) {
      best = vowel
      bestCount = count
    }
  }
  return best
}
