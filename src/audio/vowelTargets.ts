import type { Vowel, VowelTarget } from './types'

export const VOWEL_TARGETS: readonly VowelTarget[] = [
  { vowel: 'a', f1: 700, f2: 1300, f3: 2550 },
  { vowel: 'e', f1: 380, f2: 2100, f3: 2700 },
  { vowel: 'ɛ', f1: 550, f2: 1800, f3: 2600 },
  { vowel: 'i', f1: 270, f2: 2300, f3: 3100 },
  { vowel: 'o', f1: 380, f2: 700, f3: 2500 },
  { vowel: 'u', f1: 310, f2: 700, f3: 2200 },
  // { vowel: 'y', f1: 260, f2: 1800, f3: 2100 },
] as const

export const hzToBark = (hz: number): number =>
  13 * Math.atan(0.00076 * hz) + 3.5 * Math.atan((hz / 7500) ** 2)

export const classifyVowel = (f1: number, f2: number, f3: number): Vowel => {
  const b1 = hzToBark(f1)
  const b2 = hzToBark(f2)
  const b3 = hzToBark(f3)

  let bestVowel: Vowel = VOWEL_TARGETS[0].vowel
  let bestDist = Infinity

  for (const target of VOWEL_TARGETS) {
    const d1 = b1 - hzToBark(target.f1)
    const d2 = b2 - hzToBark(target.f2)
    const d3 = b3 - hzToBark(target.f3)
    const dist = d1 * d1 + d2 * d2 + 0.8 * d3 * d3
    if (dist < bestDist) {
      bestDist = dist
      bestVowel = target.vowel
    }
  }

  return bestVowel
}
