import { DurationState } from './types.ts'

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
