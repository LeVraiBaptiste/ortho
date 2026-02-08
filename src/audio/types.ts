// French vowels detected by the system
export type Vowel = 'a' | 'e' | 'ɛ' | 'i' | 'o' | 'u' | 'y'

// Raw audio frame from the analyser
export type AudioFrame = {
  readonly buffer: Float32Array
  readonly sampleRate: number
  readonly timestamp: number
}

// Formant analysis data from the FFT spectrum
export type FormantData = {
  readonly magnitudes: Float32Array  // FFT magnitude spectrum
  readonly sampleRate: number
  readonly fftSize: number           // original FFT size (magnitudes.length - 1) * 2
  readonly f1: number                // detected F1 in Hz
  readonly f2: number                // detected F2 in Hz
}

// Processed voice features — output of the full pipeline
export type VoiceFeatures = {
  readonly volume: number         // 0..1 normalized RMS
  readonly pitch: number | null   // Hz or null if unvoiced
  readonly vowel: Vowel | null    // detected vowel or null
  readonly isVoicing: boolean     // whether the user is currently speaking
  readonly duration: number       // continuous voicing duration in seconds
  readonly formants: FormantData | null
}

// Duration tracking state (used internally by duration.ts)
export type DurationState = {
  readonly isVoicing: boolean
  readonly currentDuration: number  // seconds of current continuous voicing
}

// Vowel target for classification
export type VowelTarget = {
  readonly vowel: Vowel
  readonly f1: number  // Hz
  readonly f2: number  // Hz
}
