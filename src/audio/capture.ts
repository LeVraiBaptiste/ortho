import { AudioFrame, VoiceFeatures, DurationState } from './types.ts'
import { computeRMS } from './volume.ts'
import { detectPitch } from './pitch.ts'
import { analyzeFormants } from './vowels.ts'
import { trackDuration, initialDurationState } from './duration.ts'
import { isRawVoicing, updateVoicing, initialVoicingState, VoicingState } from './voicing.ts'
import { smoothVowel, initialVowelSmoothingState, VowelSmoothingState } from './vowelSmoothing.ts'

// Volume threshold below which we consider the user is not voicing
const VOICING_THRESHOLD = 0.01

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
  let durationState: DurationState = initialDurationState
  let voicingState: VoicingState = initialVoicingState
  let vowelSmoothingState: VowelSmoothingState = initialVowelSmoothingState
  let lastTimestamp = 0
  const subscribers = new Set<(features: VoiceFeatures) => void>()

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

    const frame: AudioFrame = {
      buffer,
      sampleRate: audioContext.sampleRate,
      timestamp,
    }

    const volume = computeRMS(frame.buffer)
    const pitch = detectPitch(frame.buffer, frame.sampleRate)
    const { vowel: rawVowel, formants } = analyzeFormants(frame.buffer, frame.sampleRate)

    // Point 1 + 2: pitch-gated voicing with hysteresis
    const raw = isRawVoicing(volume, pitch, VOICING_THRESHOLD)
    voicingState = updateVoicing(raw, voicingState)
    const isVoicing = voicingState.isVoicing

    // Point 3: temporal vowel smoothing
    const smoothed = smoothVowel(isVoicing ? rawVowel : null, vowelSmoothingState)
    vowelSmoothingState = smoothed.state
    const vowel = isVoicing ? smoothed.vowel : null

    durationState = trackDuration(isVoicing, dt, durationState)

    const features: VoiceFeatures = {
      volume,
      pitch,
      vowel,
      isVoicing,
      duration: durationState.currentDuration,
      formants,
    }

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
    durationState = initialDurationState
    voicingState = initialVoicingState
    vowelSmoothingState = initialVowelSmoothingState

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
    durationState = initialDurationState
    voicingState = initialVoicingState
    vowelSmoothingState = initialVowelSmoothingState
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
