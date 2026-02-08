import type { Game } from '../types'
import type { VoiceFeatures } from '../../audio/types'
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

// --- Dashboard factory ---

export const createDashboard = (): Game => {
  let volumeBar: HTMLElement | null = null
  let pitchDisplay: HTMLElement | null = null
  let vowelCircle: HTMLElement | null = null
  let vowelLetter: HTMLElement | null = null
  let durationDisplay: HTMLElement | null = null
  let vowelHistory: HTMLElement | null = null

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

    // 5. Vowel history card (full width, below the grid)
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
  }

  const unmount = (): void => {
    volumeBar = null
    pitchDisplay = null
    vowelCircle = null
    vowelLetter = null
    durationDisplay = null
    vowelHistory = null
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
