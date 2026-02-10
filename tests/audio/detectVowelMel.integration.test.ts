import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWav } from '../utils/readWav'
import { detectVowelMel } from '../../src/audio/vowelsMel'
import type { Vowel } from '../../src/audio/types'
import { VOWELS, FRAME_SIZE, HOP_SIZE, getWavFiles, extractFrames, majorityVote } from '../utils/vowelTestHarness'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'vowels')

const MIN_ACCURACY = 0.3

describe('detectVowelMel integration (WAV fixtures)', () => {
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

          const detections = frames.map(frame => detectVowelMel(frame, sampleRate))
          const detected = majorityVote(detections)
          const correct = detected === vowel

          results.push({ vowel, file: fileName, expected: vowel, detected, correct })

          expect(detected).toBe(vowel)
        })
      }
    })
  }

  it.skipIf(results.length === 0)('meets minimum accuracy threshold', () => {
    console.log('\n--- Mel Vowel Detection Accuracy Report ---')

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
    console.log('-------------------------------------------\n')

    expect(overallAccuracy).toBeGreaterThanOrEqual(MIN_ACCURACY)
  })
})
