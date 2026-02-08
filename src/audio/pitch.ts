// Pitch detection using a simplified YIN algorithm
// Returns frequency in Hz or null if no voiced pitch is detected

const YIN_THRESHOLD = 0.15
const MIN_FREQUENCY = 80   // Hz — lower bound for children's voice
const MAX_FREQUENCY = 600  // Hz — upper bound for children's voice

// Compute the difference function d(tau) for each lag
const computeDifference = (buffer: Float32Array, maxLag: number): Float32Array => {
  const halfLen = Math.min(Math.floor(buffer.length / 2), maxLag)
  const diff = new Float32Array(halfLen)

  for (let tau = 0; tau < halfLen; tau++) {
    let sum = 0
    for (let i = 0; i < halfLen; i++) {
      const delta = buffer[i] - buffer[i + tau]
      sum += delta * delta
    }
    diff[tau] = sum
  }

  return diff
}

// Compute the cumulative mean normalized difference d'(tau)
// d'(0) = 1, d'(tau) = d(tau) / ((1/tau) * sum(d(j), j=1..tau))
const cumulativeMeanNormalize = (diff: Float32Array): Float32Array => {
  const normalized = new Float32Array(diff.length)
  normalized[0] = 1

  let runningSum = 0
  for (let tau = 1; tau < diff.length; tau++) {
    runningSum += diff[tau]
    normalized[tau] = runningSum === 0 ? 0 : diff[tau] * tau / runningSum
  }

  return normalized
}

// Find the first lag where the CMNDF dips below the threshold
const findThresholdLag = (cmndf: Float32Array, minLag: number, threshold: number): number => {
  for (let tau = minLag; tau < cmndf.length - 1; tau++) {
    if (cmndf[tau] < threshold) {
      // Walk forward to find the local minimum in this dip
      while (tau + 1 < cmndf.length && cmndf[tau + 1] < cmndf[tau]) {
        tau++
      }
      return tau
    }
  }
  return -1
}

// Parabolic interpolation around the estimated lag for sub-sample accuracy
const parabolicInterpolation = (cmndf: Float32Array, lag: number): number => {
  if (lag <= 0 || lag >= cmndf.length - 1) return lag

  const alpha = cmndf[lag - 1]
  const beta = cmndf[lag]
  const gamma = cmndf[lag + 1]

  const peak = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma)

  // Guard against degenerate cases where denominator is near zero
  if (!Number.isFinite(peak)) return lag

  return lag + peak
}

// Detect pitch from an audio buffer using the YIN algorithm
// Returns frequency in Hz or null if unvoiced
export const detectPitch = (buffer: Float32Array, sampleRate: number): number | null => {
  if (buffer.length < 2) return null

  const maxLag = Math.floor(sampleRate / MIN_FREQUENCY)
  const minLag = Math.floor(sampleRate / MAX_FREQUENCY)

  // Need at least 2 * maxLag samples for reliable detection
  if (buffer.length < 2 * maxLag) return null

  const diff = computeDifference(buffer, maxLag)
  const cmndf = cumulativeMeanNormalize(diff)

  const lag = findThresholdLag(cmndf, minLag, YIN_THRESHOLD)
  if (lag === -1) return null

  const refinedLag = parabolicInterpolation(cmndf, lag)
  if (refinedLag <= 0) return null

  const frequency = sampleRate / refinedLag

  // Final range check after interpolation
  if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) return null

  return frequency
}
