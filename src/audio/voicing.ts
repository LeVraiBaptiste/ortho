import type { AudioProcessor, PipelineFrame } from './pipe'
import type { VoiceFeatures } from './types'

// Hysteresis parameters
const ONSET_FRAMES = 3   // ~50ms at 60fps — frames above threshold before voicing starts
const OFFSET_FRAMES = 5  // ~83ms at 60fps — frames below threshold before voicing stops

export type VoicingState = {
  readonly isVoicing: boolean
  readonly framesAbove: number
  readonly framesBelow: number
}

export const initialVoicingState: VoicingState = {
  isVoicing: false,
  framesAbove: 0,
  framesBelow: 0,
}

// Determine raw voicing: volume above threshold AND pitch detected
export const isRawVoicing = (volume: number, pitch: number | null, threshold: number): boolean =>
  volume > threshold && pitch !== null

// Apply hysteresis to smooth voicing transitions
// When not voicing: need ONSET_FRAMES consecutive raw-voicing frames to start
// When voicing: need OFFSET_FRAMES consecutive non-voicing frames to stop
export const updateVoicing = (
  rawVoicing: boolean,
  state: VoicingState,
): VoicingState => {
  if (state.isVoicing) {
    if (!rawVoicing) {
      const framesBelow = state.framesBelow + 1
      return framesBelow >= OFFSET_FRAMES
        ? { isVoicing: false, framesAbove: 0, framesBelow: 0 }
        : { isVoicing: true, framesAbove: 0, framesBelow }
    }
    return { isVoicing: true, framesAbove: 0, framesBelow: 0 }
  }

  if (rawVoicing) {
    const framesAbove = state.framesAbove + 1
    return framesAbove >= ONSET_FRAMES
      ? { isVoicing: true, framesAbove: 0, framesBelow: 0 }
      : { isVoicing: false, framesAbove, framesBelow: 0 }
  }
  return { isVoicing: false, framesAbove: 0, framesBelow: 0 }
}


// Volume threshold below which we consider the user is not voicing
const VOICING_THRESHOLD = 0.01

// Pipeline-compatible processor: closes over VoicingState
export const createVoicingProcessor = (): AudioProcessor => {
  let state: VoicingState = initialVoicingState

  return (_frame: PipelineFrame, features: Partial<VoiceFeatures>) => {
    const raw = isRawVoicing(features.volume ?? 0, features.pitch ?? null, VOICING_THRESHOLD)
    state = updateVoicing(raw, state)
    return { isVoicing: state.isVoicing }
  }
}
