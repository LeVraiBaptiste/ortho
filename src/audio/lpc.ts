// LPC analysis order (number of poles)
export const LPC_ORDER = 12

// Downsample by averaging groups of consecutive samples (acts as low-pass + decimation)
export const decimateSignal = (buffer: Float32Array, factor: number): Float32Array => {
  const len = Math.floor(buffer.length / factor)
  const result = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let sum = 0
    const offset = i * factor
    for (let j = 0; j < factor; j++) {
      sum += buffer[offset + j]
    }
    result[i] = sum / factor
  }
  return result
}

// Autocorrelation R[0..order]
export const computeAutocorrelation = (signal: Float32Array, order: number): Float32Array => {
  const n = signal.length
  const R = new Float32Array(order + 1)
  for (let k = 0; k <= order; k++) {
    let sum = 0
    for (let i = 0; i < n - k; i++) {
      sum += signal[i] * signal[i + k]
    }
    R[k] = sum
  }
  return R
}

// Levinson-Durbin recursion: autocorrelation -> LPC coefficients + gain
export const levinsonDurbin = (R: Float32Array, order: number): { coeffs: Float32Array; gain: number } => {
  if (R[0] === 0) {
    return { coeffs: new Float32Array(order), gain: 1 }
  }

  const a = new Float32Array(order)
  let E = R[0]

  for (let i = 0; i < order; i++) {
    let lambda = R[i + 1]
    for (let j = 0; j < i; j++) {
      lambda -= a[j] * R[i - j]
    }
    const ki = lambda / E

    const prev = new Float32Array(i)
    for (let j = 0; j < i; j++) {
      prev[j] = a[j]
    }

    a[i] = ki
    for (let j = 0; j < i; j++) {
      a[j] = prev[j] - ki * prev[i - 1 - j]
    }

    E *= (1 - ki * ki)
    if (E <= 0) {
      E = 1e-10
    }
  }

  return { coeffs: a, gain: Math.sqrt(E) }
}

// Evaluate LPC spectral envelope |H(f)| = gain / |A(e^{jω})| at each FFT bin frequency
export const evaluateLpcEnvelope = (
  coeffs: Float32Array,
  gain: number,
  numBins: number,
  decimatedSampleRate: number,
  originalSampleRate: number,
  originalFftSize: number,
): Float32Array => {
  const envelope = new Float32Array(numBins)
  const nyquist = decimatedSampleRate / 2
  const order = coeffs.length

  for (let i = 0; i < numBins; i++) {
    const freq = i * originalSampleRate / originalFftSize

    if (freq > nyquist) {
      envelope[i] = 0
      continue
    }

    const omega = (2 * Math.PI * freq) / decimatedSampleRate
    let aReal = 1
    let aImag = 0
    for (let k = 0; k < order; k++) {
      const angle = (k + 1) * omega
      aReal -= coeffs[k] * Math.cos(angle)
      aImag += coeffs[k] * Math.sin(angle)
    }

    const magSq = aReal * aReal + aImag * aImag
    envelope[i] = gain / Math.sqrt(magSq)
  }

  return envelope
}

// Normalize LPC envelope (min → 1.0) then raise to power to amplify formant peaks
export const enhanceLpcEnvelope = (envelope: Float32Array, power: number = 2): Float32Array => {
  const result = new Float32Array(envelope.length)
  const eps = 1e-10
  let minVal = Infinity
  for (let i = 0; i < envelope.length; i++) {
    if (envelope[i] > eps && envelope[i] < minVal) {
      minVal = envelope[i]
    }
  }
  if (minVal === Infinity) minVal = 1

  for (let i = 0; i < envelope.length; i++) {
    const normalized = envelope[i] / minVal
    result[i] = Math.pow(normalized, power)
  }
  return result
}
