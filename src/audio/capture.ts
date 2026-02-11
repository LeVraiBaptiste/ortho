import type { VoiceFeatures } from './types'
import type { PipelineFrame } from './pipe'
import { pipe } from './pipe'
import { computeRMS } from './volume'
import { detectPitch } from './pitch'
import { detectVowelEnsemble } from './detectEnsemble'
import { analyzeFormants } from './detectLpc'
import { createVoicingProcessor } from './voicing'
import { createSmoothingProcessor } from './smoothing'
import { createDurationProcessor } from './duration'

const FFT_SIZE = 2048

type AudioPipeline = {
  readonly start: () => Promise<void>
  readonly stop: () => void
  readonly subscribe: (callback: (features: VoiceFeatures) => void) => () => void
}

export const createAudioPipeline = (): AudioPipeline => {
  let audioContext: AudioContext | null = null
  let analyserNode: AnalyserNode | null = null
  let mediaStream: MediaStream | null = null
  let animationFrameId: number | null = null
  let lastTimestamp = 0
  const subscribers = new Set<(features: VoiceFeatures) => void>()

  // Build the composable analysis pipeline
  let analyze = buildPipeline()

  const notifySubscribers = (features: VoiceFeatures): void => {
    for (const callback of subscribers) {
      callback(features)
    }
  }

  const analysisLoop = (timestamp: number): void => {
    if (analyserNode === null || audioContext === null) return

    const dt = lastTimestamp === 0 ? 0 : (timestamp - lastTimestamp) / 1000
    lastTimestamp = timestamp

    const buffer = new Float32Array(analyserNode.fftSize)
    analyserNode.getFloatTimeDomainData(buffer)

    const frame: PipelineFrame = {
      buffer,
      sampleRate: audioContext.sampleRate,
      timestamp,
      dt,
    }

    const features = analyze(frame, {}) as VoiceFeatures

    notifySubscribers(features)

    animationFrameId = requestAnimationFrame(analysisLoop)
  }

  const start = async (): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaStream = stream

    const context = new AudioContext()
    audioContext = context

    const analyser = context.createAnalyser()
    analyser.fftSize = FFT_SIZE
    analyserNode = analyser

    const sourceNode = context.createMediaStreamSource(stream)
    sourceNode.connect(analyser)

    lastTimestamp = 0
    analyze = buildPipeline()

    animationFrameId = requestAnimationFrame(analysisLoop)
  }

  const stop = (): void => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }

    if (mediaStream !== null) {
      for (const track of mediaStream.getTracks()) {
        track.stop()
      }
      mediaStream = null
    }

    if (audioContext !== null) {
      audioContext.close()
      audioContext = null
    }

    analyserNode = null
    lastTimestamp = 0
  }

  const subscribe = (callback: (features: VoiceFeatures) => void): (() => void) => {
    subscribers.add(callback)
    return () => {
      subscribers.delete(callback)
    }
  }

  return { start, stop, subscribe }
}

// Build a fresh pipeline with reset stateful processors
const buildPipeline = () =>
  pipe(
    // Pure processors: read buffer, write features
    (frame) => ({ volume: computeRMS(frame.buffer) }),
    (frame) => ({ pitch: detectPitch(frame.buffer, frame.sampleRate) }),
    (frame) => {
      const vowel = detectVowelEnsemble(frame.buffer, frame.sampleRate)
      const { formants } = analyzeFormants(frame.buffer, frame.sampleRate)
      return { vowel, formants }
    },
    // Stateful processors: close over their own state
    createVoicingProcessor(),
    createSmoothingProcessor(),
    createDurationProcessor(),
  )
