import type { VoiceFeatures } from './types'

export type PipelineFrame = {
  readonly buffer: Float32Array
  readonly sampleRate: number
  readonly timestamp: number
  readonly dt: number
}

export type AudioProcessor = (
  frame: PipelineFrame,
  features: Partial<VoiceFeatures>,
) => Partial<VoiceFeatures>

export const pipe = (...processors: AudioProcessor[]): AudioProcessor =>
  (frame, initial) =>
    processors.reduce<Partial<VoiceFeatures>>(
      (features, processor) => ({ ...features, ...processor(frame, features) }),
      initial,
    )
