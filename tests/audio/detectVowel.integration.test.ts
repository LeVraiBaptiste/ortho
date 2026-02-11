import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWav } from '../utils/readWav'
import { detectVowel } from '../../src/audio/detectLpc'
import type { Vowel } from '../../src/audio/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'vowels')

const VOWELS: Vowel[] = ['a', 'e', 'ɛ', 'i', 'o', 'u', 'y']

// Frame size for analysis (~23ms at 44100Hz, must be reasonable for LPC)
const FRAME_SIZE = 1024
// Overlap between frames (50%)
const HOP_SIZE = 512
// Minimum accuracy to pass the suite (start low, ratchet up as pipeline improves)
const MIN_ACCURACY = 0.5

const getWavFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.wav'))
    .map(f => join(dir, f))
}

// Extract overlapping frames from the stable middle portion of the signal
const extractFrames = (samples: Float32Array, frameSize: number, hopSize: number): Float32Array[] => {
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
const majorityVote = (detections: (Vowel | null)[]): Vowel | null => {
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

describe('detectVowel integration (WAV fixtures)', () => {
  const results: { vowel: Vowel; file: string; expected: Vowel; detected: Vowel | null; correct: boolean }[] = []

  for (const vowel of VOWELS) {
    const vowelDir = join(FIXTURES_DIR, vowel)
    const wavFiles = getWavFiles(vowelDir)

    describe.skipIf(wavFiles.length === 0)(`vowel /${vowel}/`, () => {
      for (const wavFile of wavFiles) {
        const fileName = wavFile.split('/').pop()!

        it(`detects ${vowel} in ${fileName}`, () => {
          const { samples, sampleRate } = readWav(wavFile)
          const frames = extractFrames(samples, FRAME_SIZE, HOP_SIZE)

          expect(frames.length).toBeGreaterThan(0)

          const detections = frames.map(frame => detectVowel(frame, sampleRate))
          const detected = majorityVote(detections)
          const correct = detected === vowel

          results.push({ vowel, file: fileName, expected: vowel, detected, correct })

          expect(detected).toBe(vowel)
        })
      }
    })
  }

  // Print accuracy report after all tests
  it.skipIf(results.length === 0)('meets minimum accuracy threshold', () => {
    console.log('\n--- Vowel Detection Accuracy Report ---')

    const byVowel = new Map<Vowel, { total: number; correct: number }>()
    for (const r of results) {
      const entry = byVowel.get(r.expected) ?? { total: 0, correct: 0 }
      entry.total++
      if (r.correct) entry.correct++
      byVowel.set(r.expected, entry)
    }

    for (const [vowel, { total, correct }] of byVowel) {
      const pct = total > 0 ? ((correct / total) * 100).toFixed(0) : 'N/A'
      console.log(`  /${vowel}/: ${correct}/${total} (${pct}%)`)
    }

    const totalCorrect = results.filter(r => r.correct).length
    const totalFiles = results.length
    const overallAccuracy = totalFiles > 0 ? totalCorrect / totalFiles : 1
    console.log(`  Overall: ${totalCorrect}/${totalFiles} (${(overallAccuracy * 100).toFixed(0)}%)`)
    console.log('---------------------------------------\n')

    expect(overallAccuracy).toBeGreaterThanOrEqual(MIN_ACCURACY)
  })
})
