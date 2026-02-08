import type { VoiceFeatures } from '../audio/types'

export type Game = {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly mount: (container: HTMLElement) => void
  readonly unmount: () => void
  readonly update: (features: VoiceFeatures) => void
}
