import type { Vowel, VowelTarget } from './types'

export const VOWEL_TARGETS: readonly VowelTarget[] = [
  { vowel: 'a', f1: 700, f2: 1300, f3: 2550 },
  { vowel: 'e', f1: 380, f2: 2100, f3: 2700 },
  { vowel: 'ɛ', f1: 550, f2: 1800, f3: 2600 },
  { vowel: 'i', f1: 270, f2: 2300, f3: 3100 },
  { vowel: 'o', f1: 380, f2: 700, f3: 2500 },
  { vowel: 'u', f1: 310, f2: 700, f3: 2200 },
  { vowel: 'y', f1: 260, f2: 1800, f3: 2100 },
] as const

export const VOWEL_RATIO_TARGETS: readonly { vowel: Vowel; logR1: number; logR2: number }[] =
  VOWEL_TARGETS.map(t => ({
    vowel: t.vowel,
    logR1: Math.log(t.f2 / t.f1),
    logR2: Math.log(t.f3 / t.f2),
  }))

export const hzToBark = (hz: number): number =>
  13 * Math.atan(0.00076 * hz) + 3.5 * Math.atan((hz / 7500) ** 2)

export const classifyVowelByRatios = (f1: number, f2: number, f3: number): Vowel => {
  const logR1 = Math.log(f2 / f1)
  const logR2 = Math.log(f3 / f2)

  let bestVowel: Vowel = VOWEL_RATIO_TARGETS[0].vowel
  let bestDist = Infinity

  for (const target of VOWEL_RATIO_TARGETS) {
    const dr1 = logR1 - target.logR1
    const dr2 = logR2 - target.logR2
    const dist = 2 * dr1 * dr1 + dr2 * dr2
    if (dist < bestDist) {
      bestDist = dist
      bestVowel = target.vowel
    }
  }

  return bestVowel
}

export const classifyVowel = (f1: number, f2: number | null, f3: number | null): Vowel => {
  const b1 = hzToBark(f1)

  // If any formant is null or non-positive, Bark-only distance using available formants
  if (f2 === null || f3 === null || f1 <= 0 || f2 <= 0 || f3 <= 0) {
    let bestVowel: Vowel = VOWEL_TARGETS[0].vowel
    let bestDist = Infinity

    for (const target of VOWEL_TARGETS) {
      let dist = (b1 - hzToBark(target.f1)) ** 2
      if (f2 !== null && f2 > 0) dist += (hzToBark(f2) - hzToBark(target.f2)) ** 2
      if (f3 !== null && f3 > 0) dist += 0.8 * (hzToBark(f3) - hzToBark(target.f3)) ** 2
      if (dist < bestDist) {
        bestDist = dist
        bestVowel = target.vowel
      }
    }

    return bestVowel
  }

  // Blended classification: 50% Bark distance + 50% log-ratio distance
  const b2 = hzToBark(f2)
  const b3 = hzToBark(f3)
  const logR1 = Math.log(f2 / f1)
  const logR2 = Math.log(f3 / f2)

  let bestVowel: Vowel = VOWEL_TARGETS[0].vowel
  let bestScore = -Infinity

  for (let idx = 0; idx < VOWEL_TARGETS.length; idx++) {
    const target = VOWEL_TARGETS[idx]
    const ratioTarget = VOWEL_RATIO_TARGETS[idx]

    // Bark distance
    const d1 = b1 - hzToBark(target.f1)
    const d2 = b2 - hzToBark(target.f2)
    const d3 = b3 - hzToBark(target.f3)
    const barkDist = d1 * d1 + d2 * d2 + 0.8 * d3 * d3
    const barkScore = 1 / (1 + barkDist)

    // Ratio distance
    const dr1 = logR1 - ratioTarget.logR1
    const dr2 = logR2 - ratioTarget.logR2
    const ratioDist = 2 * dr1 * dr1 + dr2 * dr2
    const ratioScore = 1 / (1 + ratioDist)

    const blendedScore = 0.5 * barkScore + 0.5 * ratioScore
    if (blendedScore > bestScore) {
      bestScore = blendedScore
      bestVowel = target.vowel
    }
  }

  return bestVowel
}
