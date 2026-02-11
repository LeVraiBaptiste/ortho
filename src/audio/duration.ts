import type { DurationState, VoiceFeatures } from './types'
import type { AudioProcessor, PipelineFrame } from './pipe'

export const initialDurationState: DurationState = {
  isVoicing: false,
  currentDuration: 0,
}

// Pure function: given current voicing status, time delta, and previous state,
// returns a new DurationState.
// If isVoicing is true, accumulate duration.
// If isVoicing transitions to false, reset duration to 0.
export const trackDuration = (
  isVoicing: boolean,
  dt: number,
  state: DurationState,
): DurationState => {
  if (isVoicing) {
    return {
      isVoicing: true,
      currentDuration: state.currentDuration + dt,
    }
  }

  return {
    isVoicing: false,
    currentDuration: 0,
  }
}

// Pipeline-compatible processor: closes over DurationState
export const createDurationProcessor = (): AudioProcessor => {
  let state: DurationState = initialDurationState

  return (frame: PipelineFrame, features: Partial<VoiceFeatures>) => {
    state = trackDuration(features.isVoicing ?? false, frame.dt, state)
    return { duration: state.currentDuration }
  }
}
