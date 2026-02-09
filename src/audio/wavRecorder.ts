export type WavRecorder = {
  readonly start: () => Promise<void>
  readonly stop: () => void
  readonly isRecording: () => boolean
}

const writeString = (view: DataView, offset: number, str: string): void => {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

const encodeWav = (samples: Float32Array, sampleRate: number): Blob => {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = samples.length * (bitsPerSample / 8)
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')

  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, clamped * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

export const createWavRecorder = (onDone: (blob: Blob) => void): WavRecorder => {
  let recording = false
  let chunks: Float32Array[] = []
  let audioContext: AudioContext | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let scriptProcessor: ScriptProcessorNode | null = null
  let stream: MediaStream | null = null

  const start = async (): Promise<void> => {
    if (recording) return

    chunks = []
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioContext = new AudioContext()
    source = audioContext.createMediaStreamSource(stream)
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1)

    scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
      const input = event.inputBuffer.getChannelData(0)
      chunks.push(new Float32Array(input))
    }

    source.connect(scriptProcessor)
    scriptProcessor.connect(audioContext.destination)
    recording = true
  }

  const stop = (): void => {
    if (!recording) return
    recording = false

    const sampleRate = audioContext?.sampleRate ?? 44100

    stream?.getTracks().forEach((track) => track.stop())
    scriptProcessor?.disconnect()
    source?.disconnect()
    audioContext?.close()

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const samples = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      samples.set(chunk, offset)
      offset += chunk.length
    }
    const blob = encodeWav(samples, sampleRate)
    onDone(blob)

    chunks = []
    audioContext = null
    source = null
    scriptProcessor = null
    stream = null
  }

  const isRecording = (): boolean => recording

  return { start, stop, isRecording }
}

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
