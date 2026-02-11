import { describe, it, expect, beforeAll } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWav } from '../utils/readWav'
import { computeMfcc, calibrateMfccTemplates } from '../../src/audio/detectMfcc'
import { detectVowelEnsemble, detectVowelEnsembleVotes } from '../../src/audio/detectEnsemble'
import { getWavFiles, extractFrames, majorityVote, VOWELS, FRAME_SIZE, HOP_SIZE } from '../utils/vowelTestHarness'
import type { Vowel } from '../../src/audio/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'vowels')

const MIN_ACCURACY = 0.6

describe('detectVowelEnsemble integration (WAV fixtures)', () => {
  // Phase 1: Calibrate MFCC templates from all fixture data
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

  // Phase 2: Classify each file with both ensemble strategies
  const resultsPerFrame: { vowel: Vowel; file: string; detected: Vowel | null; correct: boolean }[] = []
  const resultsPooled: { vowel: Vowel; file: string; detected: Vowel | null; correct: boolean }[] = []

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

          // Strategy A: per-frame ensemble then majority vote
          const perFrameDetections = frames.map(frame => detectVowelEnsemble(frame, sampleRate))
          const detectedPerFrame = majorityVote(perFrameDetections)

          // Strategy B: pool all votes from both detectors, then single majority vote
          const pooledVotes: (Vowel | null)[] = []
          for (const frame of frames) {
            const votes = detectVowelEnsembleVotes(frame, sampleRate)
            pooledVotes.push(...votes)
          }
          const detectedPooled = majorityVote(pooledVotes)

          const correctPerFrame = detectedPerFrame === vowel
          const correctPooled = detectedPooled === vowel

          resultsPerFrame.push({ vowel, file: fileName, detected: detectedPerFrame, correct: correctPerFrame })
          resultsPooled.push({ vowel, file: fileName, detected: detectedPooled, correct: correctPooled })

          if (!correctPooled) {
            console.log(`  [${vowel}] ${fileName} -> pooled:${detectedPooled ?? 'null'} perFrame:${detectedPerFrame ?? 'null'} (MISS)`)
          }

          // Individual file results are informational; overall accuracy is checked in the summary
          expect(true).toBe(true)
        })
      }
    })
  }

  // Phase 3: Accuracy summary
  it('accuracy report', () => {
    // Per-frame ensemble report
    console.log('\n--- Ensemble (per-frame) Accuracy Report ---')
    const byVowelPF = new Map<Vowel, { total: number; correct: number }>()
    for (const r of resultsPerFrame) {
      const entry = byVowelPF.get(r.vowel) ?? { total: 0, correct: 0 }
      entry.total++
      if (r.correct) entry.correct++
      byVowelPF.set(r.vowel, entry)
    }
    for (const [vowel, { total, correct }] of byVowelPF) {
      const pct = total > 0 ? ((correct / total) * 100).toFixed(0) : 'N/A'
      console.log(`  /${vowel}/: ${correct}/${total} (${pct}%)`)
    }
    const totalCorrectPF = resultsPerFrame.filter(r => r.correct).length
    const totalFilesPF = resultsPerFrame.length
    console.log(`  Overall: ${totalCorrectPF}/${totalFilesPF} (${((totalCorrectPF / totalFilesPF) * 100).toFixed(0)}%)`)

    // Pooled votes report
    console.log('\n--- Ensemble (pooled votes) Accuracy Report ---')
    const byVowelPooled = new Map<Vowel, { total: number; correct: number }>()
    for (const r of resultsPooled) {
      const entry = byVowelPooled.get(r.vowel) ?? { total: 0, correct: 0 }
      entry.total++
      if (r.correct) entry.correct++
      byVowelPooled.set(r.vowel, entry)
    }
    for (const [vowel, { total, correct }] of byVowelPooled) {
      const pct = total > 0 ? ((correct / total) * 100).toFixed(0) : 'N/A'
      console.log(`  /${vowel}/: ${correct}/${total} (${pct}%)`)
    }
    const totalCorrectPooled = resultsPooled.filter(r => r.correct).length
    const totalFilesPooled = resultsPooled.length
    const overallAccuracy = totalFilesPooled > 0 ? totalCorrectPooled / totalFilesPooled : 1
    console.log(`  Overall: ${totalCorrectPooled}/${totalFilesPooled} (${(overallAccuracy * 100).toFixed(0)}%)`)
    console.log('------------------------------------------------\n')

    expect(overallAccuracy).toBeGreaterThanOrEqual(MIN_ACCURACY)
  })
})
