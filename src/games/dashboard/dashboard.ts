import type { Game } from '../types'
import type { VoiceFeatures, FormantData } from '../../audio/types'
import { createElement, clearChildren } from '../../ui/dom'
import { vowelColors, colors, withAlpha } from '../../ui/colors'

// --- Styles ---

const cardStyle = [
  'background: ' + colors.surface,
  'border-radius: 16px',
  'padding: 24px',
  'box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08)',
  'display: flex',
  'flex-direction: column',
  'gap: 12px',
].join('; ')

const labelStyle = [
  'font-size: 14px',
  'font-weight: 600',
  'color: ' + colors.muted,
  'text-transform: uppercase',
  'letter-spacing: 1px',
].join('; ')

const valueStyle = [
  'font-size: 32px',
  'font-weight: 700',
  'color: ' + colors.text,
].join('; ')

const containerStyle = [
  'display: grid',
  'grid-template-columns: 1fr 1fr',
  'gap: 20px',
  'padding: 24px',
  'max-width: 720px',
  'margin: 0 auto',
  'font-family: system-ui, -apple-system, sans-serif',
].join('; ')

const headerStyle = [
  'display: flex',
  'align-items: center',
  'justify-content: center',
  'position: relative',
  'padding: 20px 24px 4px',
  'max-width: 720px',
  'margin: 0 auto',
].join('; ')

const backButtonStyle = [
  'position: absolute',
  'left: 24px',
  'top: 20px',
  'background: none',
  'border: none',
  'font-size: 16px',
  'color: ' + colors.primary,
  'cursor: pointer',
  'padding: 8px 12px',
  'border-radius: 8px',
  'font-weight: 600',
  'transition: background 0.15s',
].join('; ')

const titleStyle = [
  'font-size: 24px',
  'font-weight: 700',
  'color: ' + colors.text,
  'margin: 0',
].join('; ')

const volumeTrackStyle = [
  'width: 100%',
  'height: 24px',
  'background: ' + colors.bg,
  'border-radius: 12px',
  'overflow: hidden',
].join('; ')

const volumeBarBaseStyle = [
  'height: 100%',
  'border-radius: 12px',
  'transition: width 0.05s linear, background 0.15s',
  'width: 0%',
].join('; ')

const vowelCircleStyle = [
  'width: 120px',
  'height: 120px',
  'border-radius: 50%',
  'display: flex',
  'align-items: center',
  'justify-content: center',
  'font-size: 48px',
  'font-weight: 700',
  'color: white',
  'margin: 0 auto',
  'transition: background-color 0.15s',
  'background: ' + colors.bg,
].join('; ')

const historyRowStyle = [
  'display: flex',
  'flex-wrap: wrap',
  'gap: 6px',
  'min-height: 32px',
  'align-items: center',
].join('; ')

const historyDotBaseStyle = [
  'width: 28px',
  'height: 28px',
  'border-radius: 50%',
  'display: flex',
  'align-items: center',
  'justify-content: center',
  'font-size: 13px',
  'font-weight: 700',
  'color: white',
].join('; ')

// --- Helpers ---

const volumeToColor = (volume: number): string => {
  const green = Math.round(255 * (1 - volume))
  const red = Math.round(255 * volume)
  return `rgb(${red}, ${green}, 80)`
}

const MAX_HISTORY = 20

const VOWEL_FORMANT_TARGETS: Record<string, { f1: number; f2: number }> = {
  'a': { f1: 1000, f2: 1600 },
  'e': { f1: 500, f2: 2600 },
  'ɛ': { f1: 700, f2: 2300 },
  'i': { f1: 350, f2: 2800 },
  'o': { f1: 600, f2: 1100 },
  'u': { f1: 400, f2: 1100 },
  'y': { f1: 350, f2: 2200 },
}

// --- Spectrum drawing ---

const drawSpectrum = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  formants: FormantData,
  vowel: string | null,
): void => {
  const dpr = window.devicePixelRatio || 1
  const w = canvas.width / dpr
  const h = canvas.height / dpr

  ctx.clearRect(0, 0, w, h)

  const { magnitudes, sampleRate, fftSize } = formants
  const maxFreq = 3500
  const binToHz = sampleRate / fftSize
  const maxBin = Math.min(magnitudes.length - 1, Math.ceil(maxFreq / binToHz))

  // Find max magnitude for normalization (in display range)
  let maxMag = 0
  for (let i = 0; i <= maxBin; i++) {
    const logMag = Math.log10(1 + magnitudes[i] * 500)
    if (logMag > maxMag) maxMag = logMag
  }
  if (maxMag === 0) maxMag = 1

  // Draw spectrum as filled area
  const gradient = ctx.createLinearGradient(0, 0, 0, h)
  gradient.addColorStop(0, withAlpha(colors.primary, 0.8))
  gradient.addColorStop(1, withAlpha(colors.primary, 0.05))

  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let i = 0; i <= maxBin; i++) {
    const freq = i * binToHz
    const x = (freq / maxFreq) * w
    const logMag = Math.log10(1 + magnitudes[i] * 500)
    const y = h - (logMag / maxMag) * (h - 20)
    ctx.lineTo(x, y)
  }
  ctx.lineTo((maxBin * binToHz / maxFreq) * w, h)
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()

  // Draw spectrum line on top
  ctx.beginPath()
  for (let i = 0; i <= maxBin; i++) {
    const freq = i * binToHz
    const x = (freq / maxFreq) * w
    const logMag = Math.log10(1 + magnitudes[i] * 500)
    const y = h - (logMag / maxMag) * (h - 20)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = colors.primary
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Draw vowel target F1/F2 bands if vowel detected
  if (vowel && VOWEL_FORMANT_TARGETS[vowel]) {
    const target = VOWEL_FORMANT_TARGETS[vowel]
    const vowelColor = vowelColors[vowel] ?? colors.primary
    const bandWidth = 100 // ±100 Hz

    // F1 target band
    const f1Left = ((target.f1 - bandWidth) / maxFreq) * w
    const f1Right = ((target.f1 + bandWidth) / maxFreq) * w
    ctx.fillStyle = withAlpha(vowelColor, 0.18)
    ctx.fillRect(f1Left, 0, f1Right - f1Left, h)

    // F2 target band
    const f2Left = ((target.f2 - bandWidth) / maxFreq) * w
    const f2Right = ((target.f2 + bandWidth) / maxFreq) * w
    ctx.fillStyle = withAlpha(vowelColor, 0.18)
    ctx.fillRect(f2Left, 0, f2Right - f2Left, h)

    // Band labels
    ctx.fillStyle = withAlpha(vowelColor, 0.7)
    ctx.font = '11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('F1 cible', (f1Left + f1Right) / 2, 14)
    ctx.fillText('F2 cible', (f2Left + f2Right) / 2, 14)
  }

  // Draw actual detected F1/F2 markers
  const { f1, f2 } = formants
  const markerColor = (vowel && vowelColors[vowel]) ? vowelColors[vowel] : colors.primary

  // F1 marker
  const f1x = (f1 / maxFreq) * w
  ctx.beginPath()
  ctx.moveTo(f1x, 0)
  ctx.lineTo(f1x, h)
  ctx.strokeStyle = markerColor
  ctx.lineWidth = 2
  ctx.stroke()

  // F1 label
  ctx.fillStyle = markerColor
  ctx.font = 'bold 11px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('F1: ' + Math.round(f1) + ' Hz', f1x + 4, 30)

  // F2 marker
  const f2x = (f2 / maxFreq) * w
  ctx.beginPath()
  ctx.moveTo(f2x, 0)
  ctx.lineTo(f2x, h)
  ctx.strokeStyle = markerColor
  ctx.lineWidth = 2
  ctx.stroke()

  // F2 label
  ctx.fillStyle = markerColor
  ctx.font = 'bold 11px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('F2: ' + Math.round(f2) + ' Hz', f2x - 4, 30)

  // Frequency axis labels
  ctx.fillStyle = colors.muted
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  for (let freq = 500; freq <= 3000; freq += 500) {
    const x = (freq / maxFreq) * w
    ctx.fillText(freq + '', x, h - 4)
  }
}

// --- Dashboard factory ---

export const createDashboard = (): Game => {
  let volumeBar: HTMLElement | null = null
  let pitchDisplay: HTMLElement | null = null
  let vowelCircle: HTMLElement | null = null
  let vowelLetter: HTMLElement | null = null
  let durationDisplay: HTMLElement | null = null
  let vowelHistory: HTMLElement | null = null
  let spectrumCanvas: HTMLCanvasElement | null = null
  let spectrumCtx: CanvasRenderingContext2D | null = null
  let resizeObs: ResizeObserver | null = null

  const mount = (container: HTMLElement): void => {
    const wrapper = createElement('div', {
      style: 'background: ' + colors.bg + '; min-height: 100vh;',
    })

    // Header
    const header = createElement('div', { style: headerStyle })

    const backBtn = createElement('button', { style: backButtonStyle }, '\u2190 Accueil')
    backBtn.addEventListener('click', () => { window.location.hash = '#menu' })
    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.background = withAlpha(colors.primary, 0.1)
    })
    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.background = 'none'
    })

    const title = createElement('h1', { style: titleStyle }, 'Dashboard')

    header.appendChild(backBtn)
    header.appendChild(title)
    wrapper.appendChild(header)

    // Grid container
    const grid = createElement('div', { style: containerStyle })

    // 1. Volume card
    const volumeCard = createElement('div', { style: cardStyle })
    const volumeLabel = createElement('span', { style: labelStyle }, 'Volume')
    const volumeTrack = createElement('div', { style: volumeTrackStyle })
    volumeBar = createElement('div', { style: volumeBarBaseStyle })
    volumeTrack.appendChild(volumeBar)
    volumeCard.appendChild(volumeLabel)
    volumeCard.appendChild(volumeTrack)

    // 2. Pitch card
    const pitchCard = createElement('div', { style: cardStyle })
    const pitchLabel = createElement('span', { style: labelStyle }, 'Pitch')
    pitchDisplay = createElement('span', { style: valueStyle }, '\u2014')
    pitchCard.appendChild(pitchLabel)
    pitchCard.appendChild(pitchDisplay)

    // 3. Vowel card
    const vowelCard = createElement('div', { style: cardStyle })
    const vowelLabel = createElement('span', { style: labelStyle }, 'Voyelle')
    vowelCircle = createElement('div', { style: vowelCircleStyle })
    vowelLetter = createElement('span', {}, '\u2014')
    vowelCircle.appendChild(vowelLetter)
    vowelCard.appendChild(vowelLabel)
    vowelCard.appendChild(vowelCircle)

    // 4. Duration card
    const durationCard = createElement('div', { style: cardStyle })
    const durationLabel = createElement('span', { style: labelStyle }, 'Dur\u00e9e')
    durationDisplay = createElement('span', { style: valueStyle }, '0.0 s')
    durationCard.appendChild(durationLabel)
    durationCard.appendChild(durationDisplay)

    grid.appendChild(volumeCard)
    grid.appendChild(pitchCard)
    grid.appendChild(vowelCard)
    grid.appendChild(durationCard)
    wrapper.appendChild(grid)

    // 5. Spectrum card (full width)
    const spectrumWrapper = createElement('div', {
      style: 'padding: 0 24px 20px; max-width: 720px; margin: 0 auto;',
    })
    const spectrumCard = createElement('div', { style: cardStyle })
    const spectrumLabel = createElement('span', { style: labelStyle }, 'Spectre')
    spectrumCanvas = document.createElement('canvas')
    spectrumCanvas.style.cssText = 'width: 100%; height: 180px; border-radius: 8px; background: ' + colors.bg
    // Set actual canvas resolution for DPI
    const dpr = window.devicePixelRatio || 1
    spectrumCanvas.width = 672 * dpr
    spectrumCanvas.height = 180 * dpr
    const sCtx = spectrumCanvas.getContext('2d')
    if (sCtx) sCtx.scale(dpr, dpr)
    spectrumCtx = sCtx
    spectrumCard.appendChild(spectrumLabel)
    spectrumCard.appendChild(spectrumCanvas)
    spectrumWrapper.appendChild(spectrumCard)
    wrapper.appendChild(spectrumWrapper)

    // Handle canvas resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.contentRect
        if (spectrumCanvas && spectrumCtx) {
          const d = window.devicePixelRatio || 1
          spectrumCanvas.width = rect.width * d
          spectrumCanvas.height = 180 * d
          spectrumCtx.scale(d, d)
        }
      }
    })
    resizeObserver.observe(spectrumCard)
    resizeObs = resizeObserver

    // 6. Vowel history card (full width, below the grid)
    const historyWrapper = createElement('div', {
      style: 'padding: 0 24px 24px; max-width: 720px; margin: 0 auto;',
    })
    const historyCard = createElement('div', { style: cardStyle })
    const historyLabel = createElement('span', { style: labelStyle }, 'Historique voyelles')
    vowelHistory = createElement('div', { style: historyRowStyle })
    historyCard.appendChild(historyLabel)
    historyCard.appendChild(vowelHistory)
    historyWrapper.appendChild(historyCard)
    wrapper.appendChild(historyWrapper)

    clearChildren(container)
    container.appendChild(wrapper)
  }

  const update = (features: VoiceFeatures): void => {
    // Volume
    if (volumeBar) {
      const pct = Math.round(features.volume * 100)
      volumeBar.style.width = pct + '%'
      volumeBar.style.background = volumeToColor(features.volume)
    }

    // Pitch
    if (pitchDisplay) {
      pitchDisplay.textContent = features.pitch !== null
        ? Math.round(features.pitch) + ' Hz'
        : '\u2014'
    }

    // Vowel
    if (vowelCircle && vowelLetter) {
      if (features.vowel !== null) {
        const color = vowelColors[features.vowel] ?? colors.muted
        vowelCircle.style.background = color
        vowelLetter.textContent = features.vowel
        vowelLetter.style.color = 'white'
      } else {
        vowelCircle.style.background = colors.bg
        vowelLetter.textContent = '\u2014'
        vowelLetter.style.color = colors.muted
      }
    }

    // Duration
    if (durationDisplay) {
      durationDisplay.textContent = features.duration.toFixed(1) + ' s'
    }

    // Vowel history
    if (vowelHistory && features.vowel !== null) {
      const color = vowelColors[features.vowel] ?? colors.muted
      const dot = createElement('div', {
        style: historyDotBaseStyle + '; background: ' + color,
      }, features.vowel)

      vowelHistory.insertBefore(dot, vowelHistory.firstChild)

      // Trim to MAX_HISTORY
      while (vowelHistory.children.length > MAX_HISTORY) {
        vowelHistory.removeChild(vowelHistory.lastChild!)
      }
    }

    // Spectrum
    if (spectrumCtx && spectrumCanvas && features.formants) {
      drawSpectrum(spectrumCtx, spectrumCanvas, features.formants, features.vowel)
    }
  }

  const unmount = (): void => {
    if (resizeObs) {
      resizeObs.disconnect()
      resizeObs = null
    }
    volumeBar = null
    pitchDisplay = null
    vowelCircle = null
    vowelLetter = null
    durationDisplay = null
    vowelHistory = null
    spectrumCanvas = null
    spectrumCtx = null
  }

  return {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Tableau de bord diagnostique — visualise le pipeline audio en temps r\u00e9el',
    mount,
    update,
    unmount,
  }
}
