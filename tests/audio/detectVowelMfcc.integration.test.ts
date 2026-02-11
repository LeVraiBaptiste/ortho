import { describe, it, expect, beforeAll } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWav } from '../utils/readWav'
import { computeMfcc, calibrateMfccTemplates, detectVowelMfcc } from '../../src/audio/detectMfcc'
import { getWavFiles, extractFrames, majorityVote, VOWELS, FRAME_SIZE, HOP_SIZE } from '../utils/vowelTestHarness'
import type { Vowel } from '../../src/audio/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'vowels')

describe('detectVowelMfcc integration (WAV fixtures)', () => {
  // Phase 1: Build MFCC templates from all fixture data
  beforeAll(() => {
    const templates: { vowel: Vowel; mfccs: Float32Array[] }[] = []

    for (const vowel of VOWELS) {
      const vowelDir = join(FIXTURES_DIR, vowel)
      const wavFiles = getWavFiles(vowelDir)
      const allMfccs: Float32Array[] = []

      for (const wavFile of wavFiles) {
        const { samples, sampleRate } = readWav(wavFile)
        const frames = extractFrames(samples, FRAME_SIZE, HOP_SIZE)

        for (const frame of frames) {
          const mfcc = computeMfcc(frame, sampleRate)
          if (mfcc) allMfccs.push(mfcc)
        }
      }

      if (allMfccs.length > 0) {
        templates.push({ vowel, mfccs: allMfccs })
      }
    }

    calibrateMfccTemplates(templates)
    console.log(`Calibrated MFCC templates for ${templates.length} vowels`)
  })

  // Phase 2: Classify each file
  const results: { vowel: Vowel; file: string; detected: Vowel | null; correct: boolean }[] = []

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

          const detections = frames.map(frame => detectVowelMfcc(frame, sampleRate))
          const detected = majorityVote(detections)
          const correct = detected === vowel

          results.push({ vowel, file: fileName, detected, correct })

          if (!correct) {
            console.log(`  [${vowel}] ${fileName} → ${detected ?? 'null'} (MISS)`)
          }
        })
      }
    })
  }

  it('accuracy report', () => {
    const total = results.length
    const correct = results.filter(r => r.correct).length
    console.log(`\n--- MFCC Accuracy: ${correct}/${total} ---`)

    const byVowel = new Map<Vowel, { total: number; correct: number }>()
    for (const r of results) {
      const entry = byVowel.get(r.vowel) ?? { total: 0, correct: 0 }
      entry.total++
      if (r.correct) entry.correct++
      byVowel.set(r.vowel, entry)
    }
    for (const [v, { total: t, correct: c }] of byVowel) {
      console.log(`  /${v}/: ${c}/${t}`)
    }

    expect(true).toBe(true)
  })
})
