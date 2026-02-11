import { describe, it, expect } from 'vitest'
import { applyHammingWindow, applyPreEmphasis, computeFFTMagnitude } from '../../src/audio/dsp'
import { findPeakInRange } from '../../src/audio/peaks'
import { classifyVowel, hzToBark } from '../../src/audio/vowelTargets'
import { detectVowel } from '../../src/audio/detectLpc'

// --- 1. classifyVowel ---

describe('classifyVowel', () => {
  const vowelTargets = [
    { vowel: 'a', f1: 750, f2: 1450, f3: 2600 },
    { vowel: 'e', f1: 400, f2: 2050, f3: 2650 },
    { vowel: 'ɛ', f1: 600, f2: 1750, f3: 2600 },
    { vowel: 'i', f1: 250, f2: 2250, f3: 3000 },
    { vowel: 'o', f1: 350, f2: 750, f3: 2550 },
    { vowel: 'u', f1: 300, f2: 750, f3: 2300 },
    { vowel: 'y', f1: 250, f2: 1750, f3: 2150 },
  ] as const

  describe('exact target frequencies', () => {
    for (const { vowel, f1, f2, f3 } of vowelTargets) {
      it(`classifies exact target for '${vowel}' (${f1}, ${f2}, ${f3})`, () => {
        expect(classifyVowel(f1, f2, f3)).toBe(vowel)
      })
    }
  })

  describe('perturbation +-50Hz on F1/F2', () => {
    // 'o' and 'u' are very close (same F2, F1 differs by 50Hz) so F1-50
    // on 'o' crosses into 'u' territory and vice versa. Exclude those
    // specific combos and test the remaining cases.
    const stableVowels = vowelTargets.filter(v =>
      !['o', 'u'].includes(v.vowel),
    )
    for (const { vowel, f1, f2, f3 } of stableVowels) {
      it(`classifies '${vowel}' with F1+50, F2+50`, () => {
        expect(classifyVowel(f1 + 50, f2 + 50, f3)).toBe(vowel)
      })
      it(`classifies '${vowel}' with F1-50, F2-50`, () => {
        expect(classifyVowel(f1 - 50, f2 - 50, f3)).toBe(vowel)
      })
      it(`classifies '${vowel}' with F1+50, F2-50`, () => {
        expect(classifyVowel(f1 + 50, f2 - 50, f3)).toBe(vowel)
      })
      it(`classifies '${vowel}' with F1-50, F2+50`, () => {
        expect(classifyVowel(f1 - 50, f2 + 50, f3)).toBe(vowel)
      })
    }

    // 'o' and 'u' are stable under perturbations that move F1 away from
    // the other vowel (F1+50 for 'o' moves away from 'u', F1-50 for 'u'
    // moves away from 'o')
    it("classifies 'o' with F1+50, F2+50", () => {
      expect(classifyVowel(400, 800, 2550)).toBe('o')
    })
    it("classifies 'o' with F1+50, F2-50", () => {
      expect(classifyVowel(400, 700, 2550)).toBe('o')
    })
    it("classifies 'u' with F1-50, F2-50", () => {
      expect(classifyVowel(250, 700, 2300)).toBe('u')
    })
    it("classifies 'u' with F1-50, F2+50", () => {
      expect(classifyVowel(250, 800, 2300)).toBe('u')
    })
  })

  describe('perturbation +-100Hz on F1/F2 for well-separated vowels', () => {
    // 'a' is the most isolated vowel (highest F1, mid F2): all 4 combos pass
    it("classifies 'a' with F1+100, F2+100", () => {
      expect(classifyVowel(850, 1550, 2600)).toBe('a')
    })
    it("classifies 'a' with F1-100, F2-100", () => {
      expect(classifyVowel(650, 1350, 2600)).toBe('a')
    })
    it("classifies 'a' with F1+100, F2-100", () => {
      expect(classifyVowel(850, 1350, 2600)).toBe('a')
    })
    it("classifies 'a' with F1-100, F2+100", () => {
      expect(classifyVowel(650, 1550, 2600)).toBe('a')
    })

    // 'i' has the highest F2 (2250) — stable except F1+100,F2-100 which
    // moves toward 'e'. Test the 3 stable directions.
    it("classifies 'i' with F1+100, F2+100", () => {
      expect(classifyVowel(350, 2350, 3000)).toBe('i')
    })
    it("classifies 'i' with F1-100, F2-100", () => {
      expect(classifyVowel(150, 2150, 3000)).toBe('i')
    })
    it("classifies 'i' with F1-100, F2+100", () => {
      expect(classifyVowel(150, 2350, 3000)).toBe('i')
    })

    // 'o' with F1+100 moves away from 'u': both F2 directions pass
    it("classifies 'o' with F1+100, F2+100", () => {
      expect(classifyVowel(450, 850, 2550)).toBe('o')
    })
    it("classifies 'o' with F1+100, F2-100", () => {
      expect(classifyVowel(450, 650, 2550)).toBe('o')
    })
  })
})

// --- 2. applyHammingWindow ---

describe('applyHammingWindow', () => {
  it('output has same length as input', () => {
    const input = new Float32Array([1, 2, 3, 4, 5])
    const result = applyHammingWindow(input)
    expect(result.length).toBe(input.length)
  })

  it('edge values are attenuated (close to 0.08 * original)', () => {
    const n = 256
    const input = new Float32Array(n).fill(1.0)
    const result = applyHammingWindow(input)
    // Hamming window at i=0: 0.54 - 0.46 * cos(0) = 0.08
    expect(result[0]).toBeCloseTo(0.08, 2)
    // Hamming window at i=n-1: 0.54 - 0.46 * cos(2*PI*(n-1)/(n-1)) = 0.54 - 0.46 = 0.08
    expect(result[n - 1]).toBeCloseTo(0.08, 2)
  })

  it('center value is close to 1.0 * original', () => {
    const n = 256
    const input = new Float32Array(n).fill(1.0)
    const result = applyHammingWindow(input)
    const mid = Math.floor(n / 2)
    // Hamming window at center: 0.54 - 0.46 * cos(PI) = 0.54 + 0.46 = 1.0
    expect(result[mid]).toBeCloseTo(1.0, 1)
  })

  it('does not mutate the original buffer', () => {
    const input = new Float32Array([1, 2, 3, 4, 5])
    const inputCopy = new Float32Array(input)
    applyHammingWindow(input)
    expect(input).toEqual(inputCopy)
  })
})

// --- 3. applyPreEmphasis ---

describe('applyPreEmphasis', () => {
  it('first sample is unchanged', () => {
    const input = new Float32Array([0.5, 0.3, 0.7, 0.1])
    const result = applyPreEmphasis(input)
    expect(result[0]).toBe(0.5)
  })

  it('with default coeff (0.97): result[1] = buffer[1] - 0.97 * buffer[0]', () => {
    const input = new Float32Array([0.5, 0.3, 0.7, 0.1])
    const result = applyPreEmphasis(input)
    const expected = 0.3 - 0.97 * 0.5
    // Float32 precision: ~7 significant digits
    expect(result[1]).toBeCloseTo(expected, 5)
  })

  it('with custom coeff (0.5): result[1] = buffer[1] - 0.5 * buffer[0]', () => {
    const input = new Float32Array([0.5, 0.3, 0.7, 0.1])
    const result = applyPreEmphasis(input, 0.5)
    const expected = 0.3 - 0.5 * 0.5
    // Float32 precision: ~7 significant digits
    expect(result[1]).toBeCloseTo(expected, 5)
  })

  it('output length matches input length', () => {
    const input = new Float32Array([1, 2, 3, 4, 5, 6])
    const result = applyPreEmphasis(input)
    expect(result.length).toBe(input.length)
  })

  it('does not mutate the original buffer', () => {
    const input = new Float32Array([0.5, 0.3, 0.7, 0.1])
    const inputCopy = new Float32Array(input)
    applyPreEmphasis(input)
    expect(input).toEqual(inputCopy)
  })
})

// --- 4. computeFFTMagnitude ---

describe('computeFFTMagnitude', () => {
  it('output size is N/2+1 where N is next power of 2 of input length', () => {
    // Input of 1000 samples => next power of 2 is 1024 => output is 513
    const input = new Float32Array(1000)
    const result = computeFFTMagnitude(input)
    expect(result.length).toBe(513) // 1024/2 + 1

    // Input already a power of 2
    const input2 = new Float32Array(512)
    const result2 = computeFFTMagnitude(input2)
    expect(result2.length).toBe(257) // 512/2 + 1
  })

  it('known sine wave at 440Hz: peak near the correct bin', () => {
    const sampleRate = 44100
    const freq = 440
    const n = 4096
    const input = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      input[i] = Math.sin(2 * Math.PI * freq * i / sampleRate)
    }
    const magnitudes = computeFFTMagnitude(input)

    // Find peak bin
    let peakBin = 0
    let peakVal = 0
    for (let i = 1; i < magnitudes.length; i++) {
      if (magnitudes[i] > peakVal) {
        peakVal = magnitudes[i]
        peakBin = i
      }
    }

    // Expected bin for 440Hz: 440 * N / sampleRate
    const expectedBin = Math.round(freq * n / sampleRate)
    // Peak should be within +-2 bins of expected
    expect(Math.abs(peakBin - expectedBin)).toBeLessThanOrEqual(2)
  })

  it('silent input (all zeros): all magnitudes should be 0', () => {
    const input = new Float32Array(512)
    const result = computeFFTMagnitude(input)
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBe(0)
    }
  })
})

// --- 5. findPeakInRange ---

describe('findPeakInRange', () => {
  it('finds peak when it is in range', () => {
    const sampleRate = 44100
    const fftSize = 4096
    const numBins = fftSize / 2 + 1
    const magnitudes = new Float32Array(numBins)

    // Place a peak at bin corresponding to ~1000Hz
    const targetHz = 1000
    const targetBin = Math.round(targetHz * fftSize / sampleRate)
    magnitudes[targetBin] = 10.0

    const result = findPeakInRange(magnitudes, sampleRate, 500, 1500)
    // Result should be close to 1000Hz
    expect(result).toBeCloseTo(targetHz, -1) // within ~10Hz
  })

  it('ignores peaks outside range', () => {
    const sampleRate = 44100
    const fftSize = 4096
    const numBins = fftSize / 2 + 1
    const magnitudes = new Float32Array(numBins)

    // Place a large peak outside range (at ~500Hz)
    const outsideBin = Math.round(500 * fftSize / sampleRate)
    magnitudes[outsideBin] = 100.0

    // Place a smaller peak inside range (at ~2000Hz)
    const insideBin = Math.round(2000 * fftSize / sampleRate)
    magnitudes[insideBin] = 5.0

    const result = findPeakInRange(magnitudes, sampleRate, 1500, 2500)
    // Should find the 2000Hz peak, not the 500Hz one
    expect(result).toBeCloseTo(2000, -1)
  })

  it('returns a value within the specified range', () => {
    const sampleRate = 44100
    const fftSize = 4096
    const numBins = fftSize / 2 + 1
    const magnitudes = new Float32Array(numBins)

    // Fill with random-ish values
    for (let i = 0; i < numBins; i++) {
      magnitudes[i] = Math.abs(Math.sin(i * 0.1))
    }

    const minHz = 800
    const maxHz = 1200
    const result = findPeakInRange(magnitudes, sampleRate, minHz, maxHz)
    // Due to parabolic interpolation, allow a small margin beyond exact bin boundaries
    const binToHz = sampleRate / fftSize
    expect(result).toBeGreaterThanOrEqual(minHz - binToHz)
    expect(result).toBeLessThanOrEqual(maxHz + binToHz)
  })
})

// --- 6. detectVowel ---

describe('detectVowel', () => {
  it('returns null for silent buffer (all zeros)', () => {
    const buffer = new Float32Array(2048)
    const result = detectVowel(buffer, 44100)
    expect(result).toBeNull()
  })

  it('returns null for very low energy signal (near ENERGY_THRESHOLD)', () => {
    const buffer = new Float32Array(2048)
    // Fill with values that produce RMS just below 0.01
    // RMS = sqrt(sum(x^2)/N). For constant value v: RMS = |v|
    // Use 0.005 which is well below threshold of 0.01
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = 0.005
    }
    const result = detectVowel(buffer, 44100)
    expect(result).toBeNull()
  })
})

// --- 7. hzToBark ---

describe('hzToBark', () => {
  it('hzToBark(0) should be 0', () => {
    expect(hzToBark(0)).toBe(0)
  })

  it('should be monotonically increasing', () => {
    const frequencies = [0, 50, 100, 200, 500, 1000, 2000, 3000, 5000, 8000]
    for (let i = 1; i < frequencies.length; i++) {
      expect(hzToBark(frequencies[i])).toBeGreaterThan(hzToBark(frequencies[i - 1]))
    }
  })

  it('~1 Bark around 100Hz', () => {
    const bark100 = hzToBark(100)
    expect(bark100).toBeCloseTo(1.0, 0) // within 0.5
  })

  it('~5 Bark around 500Hz', () => {
    const bark500 = hzToBark(500)
    expect(bark500).toBeCloseTo(4.74, 0) // within 0.5
  })
})
