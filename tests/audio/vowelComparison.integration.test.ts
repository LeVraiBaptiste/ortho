import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWav } from '../utils/readWav'
import { detectVowel } from '../../src/audio/vowels'
import { detectVowelMel } from '../../src/audio/vowelsMel'
import type { Vowel } from '../../src/audio/types'
import { VOWELS, FRAME_SIZE, HOP_SIZE, getWavFiles, extractFrames, majorityVote } from '../utils/vowelTestHarness'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'vowels')

type ComparisonResult = {
  vowel: Vowel
  file: string
  lpcDetected: Vowel | null
  melDetected: Vowel | null
  lpcCorrect: boolean
  melCorrect: boolean
}

describe('LPC vs Mel vowel detection comparison', () => {
  const results: ComparisonResult[] = []

  for (const vowel of VOWELS) {
    const vowelDir = join(FIXTURES_DIR, vowel)
    const wavFiles = getWavFiles(vowelDir)

    describe.skipIf(wavFiles.length === 0)(`vowel /${vowel}/`, () => {
      for (const wavFile of wavFiles) {
        const fileName = wavFile.split('/').pop()!

        it(`compares detection of ${vowel} in ${fileName}`, () => {
          const { samples, sampleRate } = readWav(wavFile)
          const frames = extractFrames(samples, FRAME_SIZE, HOP_SIZE)

          expect(frames.length).toBeGreaterThan(0)

          const lpcDetections = frames.map(frame => detectVowel(frame, sampleRate))
          const melDetections = frames.map(frame => detectVowelMel(frame, sampleRate))

          const lpcDetected = majorityVote(lpcDetections)
          const melDetected = majorityVote(melDetections)

          results.push({
            vowel,
            file: fileName,
            lpcDetected,
            melDetected,
            lpcCorrect: lpcDetected === vowel,
            melCorrect: melDetected === vowel,
          })

          // This test always passes — it's for comparison reporting only
          expect(true).toBe(true)
        })
      }
    })
  }

  it.skipIf(results.length === 0)('prints comparison report', () => {
    console.log('\n--- LPC vs Mel Comparison ---')

    for (const r of results) {
      const lpcStatus = r.lpcCorrect ? 'OK' : 'MISS'
      const melStatus = r.melCorrect ? 'OK' : 'MISS'
      const lpcLabel = r.lpcDetected ?? 'null'
      const melLabel = r.melDetected ?? 'null'
      console.log(`  /${r.vowel}/ ${r.file.padEnd(30)} | LPC: ${String(lpcLabel).padEnd(4)} (${lpcStatus.padEnd(4)}) | Mel: ${String(melLabel).padEnd(4)} (${melStatus})`)
    }

    const lpcCorrect = results.filter(r => r.lpcCorrect).length
    const melCorrect = results.filter(r => r.melCorrect).length
    const total = results.length

    console.log(`\n  Overall: LPC ${lpcCorrect}/${total}, Mel ${melCorrect}/${total}`)

    // Count where they agree, where only one is right, etc.
    const bothCorrect = results.filter(r => r.lpcCorrect && r.melCorrect).length
    const onlyLpc = results.filter(r => r.lpcCorrect && !r.melCorrect).length
    const onlyMel = results.filter(r => !r.lpcCorrect && r.melCorrect).length
    const bothWrong = results.filter(r => !r.lpcCorrect && !r.melCorrect).length

    console.log(`  Both correct: ${bothCorrect}, Only LPC: ${onlyLpc}, Only Mel: ${onlyMel}, Both wrong: ${bothWrong}`)
    console.log('-----------------------------\n')

    // This is informational — always passes
    expect(true).toBe(true)
  })
})
