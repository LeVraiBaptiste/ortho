import { readFileSync } from 'node:fs'

type WavData = {
  readonly samples: Float32Array
  readonly sampleRate: number
}

const findChunk = (view: DataView, id: string, start: number): number => {
  let offset = start
  while (offset < view.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset), view.getUint8(offset + 1),
      view.getUint8(offset + 2), view.getUint8(offset + 3),
    )
    if (chunkId === id) return offset
    const chunkSize = view.getUint32(offset + 4, true)
    offset += 8 + chunkSize
  }
  throw new Error(`Chunk "${id}" not found`)
}

const readSample = (view: DataView, offset: number, bits: number): number => {
  if (bits === 8) return (view.getUint8(offset) - 128) / 128
  if (bits === 16) return view.getInt16(offset, true) / 32768
  if (bits === 24) {
    const lo = view.getUint8(offset) | (view.getUint8(offset + 1) << 8)
    const hi = view.getInt8(offset + 2)
    return ((hi << 16) | lo) / 8388608
  }
  if (bits === 32) return view.getInt32(offset, true) / 2147483648
  throw new Error(`Unsupported bit depth: ${bits}`)
}

export const readWav = (filePath: string): WavData => {
  const fileBuffer = readFileSync(filePath)
  const view = new DataView(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength)

  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))
  if (riff !== 'RIFF' || wave !== 'WAVE') throw new Error('Not a valid WAV file')

  const fmtOffset = findChunk(view, 'fmt ', 12)
  const audioFormat = view.getUint16(fmtOffset + 8, true)
  if (audioFormat !== 1) throw new Error(`Unsupported audio format: ${audioFormat} (only PCM supported)`)
  const numChannels = view.getUint16(fmtOffset + 10, true)
  const sampleRate = view.getUint32(fmtOffset + 12, true)
  const bitsPerSample = view.getUint16(fmtOffset + 22, true)
  const bytesPerSample = bitsPerSample / 8

  const dataOffset = findChunk(view, 'data', 12)
  const dataSize = view.getUint32(dataOffset + 4, true)
  const dataStart = dataOffset + 8
  const frameCount = dataSize / (bytesPerSample * numChannels)
  const bytesPerFrame = bytesPerSample * numChannels

  const samples = new Float32Array(frameCount)
  for (let i = 0; i < frameCount; i++) {
    samples[i] = readSample(view, dataStart + i * bytesPerFrame, bitsPerSample)
  }

  return { samples, sampleRate }
}
