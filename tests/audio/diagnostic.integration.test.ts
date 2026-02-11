import { describe, it } from 'vitest'
import { readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeFormants } from '../../src/audio/detectLpc'
import { readWav } from '../utils/readWav'
import type { Vowel } from '../../src/audio/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'vowels')

const VOWELS: Vowel[] = ['a', 'e', 'ɛ', 'i', 'o', 'u', 'y']

const FRAME_SIZE = 1024
const HOP_SIZE = 512

const getWavFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.wav'))
    .map(f => join(dir, f))
}

// Extract overlapping frames from the stable middle portion of the signal
const extractFrames = (samples: Float32Array, frameSize: number, hopSize: number): Float32Array[] => {
  const frames: Float32Array[] = []
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

// Build a distribution string showing how many frames classified as each vowel
const buildDistribution = (detections: (Vowel | null)[]): string => {
  const counts = new Map<string, number>()
  for (const v of detections) {
    const key = v ?? 'null'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return sorted.map(([v, c]) => `${v}:${c}`).join('  ')
}

describe('Formant Diagnostic (all vowels)', () => {
  for (const vowel of VOWELS) {
    const vowelDir = join(FIXTURES_DIR, vowel)
    const wavFiles = getWavFiles(vowelDir)

    describe.skipIf(wavFiles.length === 0)(`vowel /${vowel}/`, () => {
      for (const wavFile of wavFiles) {
        const fileName = wavFile.split('/').pop()!

        it(`diagnostic for /${vowel}/ — ${fileName}`, () => {
          const { samples, sampleRate } = readWav(wavFile)
          const frames = extractFrames(samples, FRAME_SIZE, HOP_SIZE)

          console.log(`\n===== /${vowel}/ — ${fileName} (${frames.length} frames, sr=${sampleRate}) =====`)
          console.log('Frame | F1 (Hz) | F2 (Hz) | F3 (Hz) | Classified')
          console.log('------|---------|---------|---------|----------')

          const detections: (Vowel | null)[] = []

          for (let i = 0; i < frames.length; i++) {
            const result = analyzeFormants(frames[i], sampleRate)
            const f1 = result.formants?.f1 ?? NaN
            const f2 = result.formants?.f2 ?? NaN
            const f3 = result.formants?.f3 ?? NaN
            const classified = result.vowel

            detections.push(classified)

            const marker = classified === vowel ? '  OK' : classified === null ? '  --' : ' MISS'
            console.log(
              `  ${String(i).padStart(3)} | ` +
              `${f1.toFixed(0).padStart(7)} | ` +
              `${f2.toFixed(0).padStart(7)} | ` +
              `${f3.toFixed(0).padStart(7)} | ` +
              `${String(classified).padStart(4)}${marker}`
            )
          }

          const majority = majorityVote(detections)
          const correct = majority === vowel
          const distribution = buildDistribution(detections)

          console.log('------')
          console.log(`Distribution: ${distribution}`)
          console.log(`Majority vote: ${majority} (expected: ${vowel}) ${correct ? 'PASS' : 'FAIL'}`)
          console.log('')
        })
      }
    })
  }
})
