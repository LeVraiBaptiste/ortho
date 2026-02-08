import type { Game } from '../types'
import type { VoiceFeatures } from '../../audio/types'
import { createCanvas, resizeCanvas } from '../../ui/canvas'
import { colors, withAlpha } from '../../ui/colors'
import { createElement } from '../../ui/dom'

// --- Constants ---

const PITCH_MIN = 80   // Hz — low voice
const PITCH_MAX = 600  // Hz — high voice
const PITCH_RANGE = PITCH_MAX - PITCH_MIN

// Cursor speed: pixels per update call
const CURSOR_SPEED = 1.5

// Shape size range (radius)
const MIN_RADIUS = 4
const MAX_RADIUS = 30

// Cursor line appearance
const CURSOR_LINE_WIDTH = 1.5
const CURSOR_LINE_ALPHA = 0.35

// Rainbow color bands (7 bands mapped across pitch range)
const RAINBOW_COLORS: ReadonlyArray<string> = [
  '#ef4444', // red      (low pitch)
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple   (high pitch)
]

// --- Pure helpers ---

// Map pitch (Hz) to a normalized value 0..1 (clamped)
const normalizePitch = (pitch: number): number =>
  Math.max(0, Math.min(1, (pitch - PITCH_MIN) / PITCH_RANGE))

// Map pitch to Y position (low = bottom, high = top)
const pitchToY = (pitch: number, height: number): number => {
  const margin = 40
  const usable = height - margin * 2
  const normalized = normalizePitch(pitch)
  // normalized 0 = low pitch = bottom, 1 = high pitch = top
  return margin + usable * (1 - normalized)
}

// Map pitch to rainbow color
const pitchToColor = (pitch: number): string => {
  const normalized = normalizePitch(pitch)
  const index = Math.min(
    RAINBOW_COLORS.length - 1,
    Math.floor(normalized * RAINBOW_COLORS.length),
  )
  return RAINBOW_COLORS[index]
}

// Map volume (0..1) to circle radius
const volumeToRadius = (volume: number): number =>
  MIN_RADIUS + volume * (MAX_RADIUS - MIN_RADIUS)

// --- Drawing functions ---

// Draw a soft circle with radial gradient (transparent edges)
const drawSoftCircle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void => {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, withAlpha(color, 0.85))
  gradient.addColorStop(0.5, withAlpha(color, 0.5))
  gradient.addColorStop(1, withAlpha(color, 0))

  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.fill()
}

// Draw a thin vertical cursor line
const drawCursorLine = (
  ctx: CanvasRenderingContext2D,
  x: number,
  height: number,
): void => {
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, height)
  ctx.strokeStyle = withAlpha(colors.text, CURSOR_LINE_ALPHA)
  ctx.lineWidth = CURSOR_LINE_WIDTH
  ctx.stroke()
}

// --- Styling helpers ---

const styleWrapper = (el: HTMLElement): void => {
  Object.assign(el.style, {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: colors.bg,
  })
}

const styleBackButton = (el: HTMLElement): void => {
  Object.assign(el.style, {
    position: 'absolute',
    top: '16px',
    left: '16px',
    zIndex: '10',
    background: 'none',
    border: 'none',
    fontSize: '1.2rem',
    fontWeight: '600',
    color: colors.primary,
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '8px 12px',
    borderRadius: '8px',
    backgroundColor: withAlpha(colors.surface, 0.8),
    backdropFilter: 'blur(4px)',
    transition: 'background-color 0.15s ease',
  })
}

const styleTitle = (el: HTMLElement): void => {
  Object.assign(el.style, {
    position: 'absolute',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '10',
    fontSize: '1.4rem',
    fontWeight: '700',
    color: withAlpha(colors.primary, 0.5),
    margin: '0',
    padding: '8px 16px',
    fontFamily: 'inherit',
    pointerEvents: 'none',
  })
}

const styleClearButton = (el: HTMLElement): void => {
  Object.assign(el.style, {
    position: 'absolute',
    top: '16px',
    right: '16px',
    zIndex: '10',
    background: 'none',
    border: 'none',
    fontSize: '1rem',
    fontWeight: '600',
    color: colors.secondary,
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '8px 12px',
    borderRadius: '8px',
    backgroundColor: withAlpha(colors.surface, 0.8),
    backdropFilter: 'blur(4px)',
    transition: 'background-color 0.15s ease',
  })
}

// --- Game factory ---

export const createPiano = (): Game => {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let animationId: number | null = null
  let resizeHandler: (() => void) | null = null

  // Painting canvas — separate offscreen canvas that accumulates strokes
  let paintCanvas: HTMLCanvasElement | null = null
  let paintCtx: CanvasRenderingContext2D | null = null

  // Cursor X position (moves left to right like a timeline)
  let cursorX = 0

  // Track whether we need to redraw the display canvas
  let needsRedraw = true

  // Create or resize the offscreen paint canvas
  const ensurePaintCanvas = (): void => {
    if (!canvas) return
    if (!paintCanvas) {
      paintCanvas = document.createElement('canvas')
      paintCtx = paintCanvas.getContext('2d')
    }
    if (!paintCanvas || !paintCtx) return

    const dpr = window.devicePixelRatio || 1
    // Only resize if dimensions changed
    if (paintCanvas.width !== canvas.width || paintCanvas.height !== canvas.height) {
      // Save existing paint content before resize
      const oldCanvas = document.createElement('canvas')
      oldCanvas.width = paintCanvas.width
      oldCanvas.height = paintCanvas.height
      const oldCtx = oldCanvas.getContext('2d')
      if (oldCtx && paintCanvas.width > 0 && paintCanvas.height > 0) {
        oldCtx.drawImage(paintCanvas, 0, 0)
      }

      paintCanvas.width = canvas.width
      paintCanvas.height = canvas.height
      paintCtx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Restore old content (stretched to new size)
      if (oldCanvas.width > 0 && oldCanvas.height > 0) {
        paintCtx.save()
        paintCtx.setTransform(1, 0, 0, 1, 0, 0)
        paintCtx.drawImage(oldCanvas, 0, 0, paintCanvas.width, paintCanvas.height)
        paintCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
        paintCtx.restore()
      }
    }
  }

  // Clear the painting surface
  const clearPainting = (): void => {
    if (!paintCtx || !paintCanvas) return
    paintCtx.save()
    paintCtx.setTransform(1, 0, 0, 1, 0, 0)
    paintCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height)
    paintCtx.restore()
    const dpr = window.devicePixelRatio || 1
    paintCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    cursorX = 0
    needsRedraw = true
  }

  // Composite: draw background + paint layer + cursor line
  const render = (): void => {
    if (!ctx || !paintCanvas) return

    // Background
    ctx.fillStyle = colors.bg
    ctx.fillRect(0, 0, width, height)

    // Paint layer
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(paintCanvas, 0, 0)
    ctx.restore()
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Cursor line
    drawCursorLine(ctx, cursorX, height)
  }

  const animate = (): void => {
    if (!ctx) return

    if (needsRedraw) {
      render()
      needsRedraw = false
    }

    animationId = requestAnimationFrame(animate)
  }

  const handleResize = (): void => {
    if (!canvas || !ctx) return
    const size = resizeCanvas(canvas, ctx)
    width = size.width
    height = size.height
    ensurePaintCanvas()
    needsRedraw = true
  }

  const mount = (container: HTMLElement): void => {
    const wrapper = createElement('div', {})
    styleWrapper(wrapper)

    const backButton = createElement('button', {}, '\u2190 Accueil')
    styleBackButton(backButton)
    backButton.addEventListener('click', () => {
      window.location.hash = '#menu'
    })

    const title = createElement('p', {}, 'Piano Visuel')
    styleTitle(title)

    const clearButton = createElement('button', {}, 'Effacer')
    styleClearButton(clearButton)
    clearButton.addEventListener('click', clearPainting)

    wrapper.appendChild(backButton)
    wrapper.appendChild(title)
    wrapper.appendChild(clearButton)
    container.appendChild(wrapper)

    const canvasResult = createCanvas(wrapper)
    canvas = canvasResult.canvas
    ctx = canvasResult.ctx
    width = canvasResult.width
    height = canvasResult.height

    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
    })

    // Initialize paint surface
    ensurePaintCanvas()

    // Reset cursor
    cursorX = 0
    needsRedraw = true

    resizeHandler = handleResize
    window.addEventListener('resize', resizeHandler)

    animate()
  }

  const update = (features: VoiceFeatures): void => {
    if (!paintCtx) return

    // Always advance cursor
    cursorX += CURSOR_SPEED
    if (cursorX > width) {
      cursorX = 0
    }

    // Paint when voicing with a detected pitch
    if (features.isVoicing && features.pitch !== null) {
      const y = pitchToY(features.pitch, height)
      const radius = volumeToRadius(features.volume)
      const color = pitchToColor(features.pitch)
      drawSoftCircle(paintCtx, cursorX, y, radius, color)
    }

    needsRedraw = true
  }

  const unmount = (): void => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId)
      animationId = null
    }

    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler)
      resizeHandler = null
    }

    canvas = null
    ctx = null
    paintCanvas = null
    paintCtx = null
    cursorX = 0
    needsRedraw = false
    width = 0
    height = 0
  }

  return {
    id: 'piano',
    name: 'Piano Visuel',
    description: 'Peins avec ta voix',
    mount,
    unmount,
    update,
  }
}
