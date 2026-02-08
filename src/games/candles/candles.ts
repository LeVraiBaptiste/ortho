import type { Game } from '../types'
import type { VoiceFeatures } from '../../audio/types'
import { createCanvas, clearCanvas, resizeCanvas } from '../../ui/canvas'
import { colors, withAlpha } from '../../ui/colors'
import { createElement } from '../../ui/dom'

// --- Types ---

type Candle = {
  readonly x: number
  readonly bodyColor: string
  readonly flameScale: number // 1 = full flame, 0 = extinguished
  readonly extinguished: boolean
  readonly blowAccumulator: number // accumulated blow time in frames (~60fps)
}

type SmokeParticle = {
  readonly x: number
  readonly y: number
  readonly vx: number
  readonly vy: number
  readonly alpha: number
  readonly size: number
}

type ConfettiParticle = {
  readonly x: number
  readonly y: number
  readonly vx: number
  readonly vy: number
  readonly rotation: number
  readonly rotationSpeed: number
  readonly color: string
  readonly alpha: number
  readonly width: number
  readonly height: number
}

// --- Constants ---

const CANDLE_COUNT = 7
const BLOW_THRESHOLD = 0.15
const EXTINGUISH_FRAMES = 60 // ~1 second at 60fps
const FLAME_SHRINK_RATE = 1 / EXTINGUISH_FRAMES
const FLAME_RESTORE_RATE = 0.03
const RELIGHT_DELAY_FRAMES = 180 // 3 seconds at 60fps
const CONFETTI_COUNT = 80
const CONFETTI_GRAVITY = 0.08
const CONFETTI_FADE_RATE = 0.006
const SMOKE_SPAWN_RATE = 0.3
const SMOKE_FADE_RATE = 0.008
const SMOKE_MAX_PER_CANDLE = 8
const FLICKER_SPEED = 0.08
const FLICKER_AMPLITUDE = 0.12

const CANDLE_BODY_COLORS = [
  '#fca5a5', // salmon
  '#a5b4fc', // lavender
  '#86efac', // mint
  '#fcd34d', // gold
  '#f9a8d4', // pink
  '#67e8f9', // cyan
  '#fdba74', // peach
] as const

const CONFETTI_COLORS = [
  '#f472b6', '#a78bfa', '#34d399', '#fbbf24',
  '#60a5fa', '#f87171', '#2dd4bf', '#fb923c',
] as const

// Warm gradient background colors
const BG_TOP = '#2d1b33'
const BG_BOTTOM = '#4a2c2a'
const TABLE_COLOR = '#5c3a2e'
const TABLE_HIGHLIGHT = '#7a5040'

// --- Pure helper functions ---

const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min)

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const generateCandles = (count: number): Candle[] =>
  Array.from({ length: count }, (_, i) => ({
    x: 0, // positioned dynamically based on canvas width
    bodyColor: CANDLE_BODY_COLORS[i % CANDLE_BODY_COLORS.length],
    flameScale: 1,
    extinguished: false,
    blowAccumulator: 0,
  }))

const positionCandles = (candles: Candle[], width: number): Candle[] => {
  const margin = width * 0.12
  const spacing = (width - margin * 2) / (candles.length - 1)

  return candles.map((c, i) => ({
    ...c,
    x: margin + i * spacing,
  }))
}

const findNextCandleIndex = (candles: Candle[]): number | null => {
  // Find the first un-extinguished candle (left to right)
  const idx = candles.findIndex((c) => !c.extinguished)
  return idx === -1 ? null : idx
}

const spawnSmokeParticle = (x: number, candleTopY: number): SmokeParticle => ({
  x: x + randomBetween(-3, 3),
  y: candleTopY - randomBetween(2, 8),
  vx: randomBetween(-0.3, 0.3),
  vy: randomBetween(-0.8, -0.3),
  alpha: randomBetween(0.3, 0.6),
  size: randomBetween(3, 6),
})

const updateSmokeParticle = (p: SmokeParticle): SmokeParticle => ({
  ...p,
  x: p.x + p.vx,
  y: p.y + p.vy,
  alpha: p.alpha - SMOKE_FADE_RATE,
  size: p.size + 0.03,
})

const isSmokeVisible = (p: SmokeParticle): boolean => p.alpha > 0

const spawnConfetti = (width: number, height: number): ConfettiParticle[] =>
  Array.from({ length: CONFETTI_COUNT }, () => ({
    x: randomBetween(0, width),
    y: randomBetween(-height * 0.3, height * 0.1),
    vx: randomBetween(-2, 2),
    vy: randomBetween(1, 3),
    rotation: randomBetween(0, Math.PI * 2),
    rotationSpeed: randomBetween(-0.1, 0.1),
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    alpha: 1,
    width: randomBetween(6, 12),
    height: randomBetween(3, 6),
  }))

const updateConfettiParticle = (p: ConfettiParticle): ConfettiParticle => ({
  ...p,
  x: p.x + p.vx,
  y: p.y + p.vy,
  vy: p.vy + CONFETTI_GRAVITY,
  rotation: p.rotation + p.rotationSpeed,
  alpha: p.alpha - CONFETTI_FADE_RATE,
})

const isConfettiVisible = (p: ConfettiParticle): boolean => p.alpha > 0

// --- Drawing functions ---

const drawBackground = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, BG_TOP)
  gradient.addColorStop(1, BG_BOTTOM)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

const drawTable = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tableY: number,
): void => {
  // Table surface
  const tableGradient = ctx.createLinearGradient(0, tableY, 0, height)
  tableGradient.addColorStop(0, TABLE_HIGHLIGHT)
  tableGradient.addColorStop(0.15, TABLE_COLOR)
  tableGradient.addColorStop(1, '#3d2518')
  ctx.fillStyle = tableGradient
  ctx.beginPath()
  ctx.roundRect(0, tableY, width, height - tableY, [8, 8, 0, 0])
  ctx.fill()

  // Subtle table edge highlight
  ctx.strokeStyle = withAlpha('#a07050', 0.4)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, tableY)
  ctx.lineTo(width, tableY)
  ctx.stroke()
}

const drawCandleBody = (
  ctx: CanvasRenderingContext2D,
  x: number,
  tableY: number,
  bodyWidth: number,
  bodyHeight: number,
  color: string,
): void => {
  const bodyX = x - bodyWidth / 2
  const bodyY = tableY - bodyHeight

  // Body with rounded top
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(bodyX, bodyY, bodyWidth, bodyHeight, [4, 4, 0, 0])
  ctx.fill()

  // Subtle highlight stripe on the left side
  ctx.fillStyle = withAlpha('#ffffff', 0.15)
  ctx.beginPath()
  ctx.roundRect(bodyX + 2, bodyY, bodyWidth * 0.25, bodyHeight, [3, 0, 0, 0])
  ctx.fill()

  // Wick
  ctx.strokeStyle = '#4a3728'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, bodyY)
  ctx.lineTo(x, bodyY - 8)
  ctx.stroke()
}

const drawFlame = (
  ctx: CanvasRenderingContext2D,
  x: number,
  flameBaseY: number,
  scale: number,
  flickerOffset: number,
): void => {
  if (scale <= 0.01) return

  const flameHeight = 22 * scale
  const flameWidth = 9 * scale
  const tipY = flameBaseY - flameHeight
  const swayX = flickerOffset * 3 * scale

  ctx.save()

  // Outer glow
  const glowRadius = 20 * scale
  const glowGradient = ctx.createRadialGradient(
    x + swayX, flameBaseY - flameHeight * 0.5, 0,
    x + swayX, flameBaseY - flameHeight * 0.5, glowRadius,
  )
  glowGradient.addColorStop(0, withAlpha('#fef08a', 0.25 * scale))
  glowGradient.addColorStop(1, withAlpha('#fef08a', 0))
  ctx.fillStyle = glowGradient
  ctx.beginPath()
  ctx.arc(x + swayX, flameBaseY - flameHeight * 0.5, glowRadius, 0, Math.PI * 2)
  ctx.fill()

  // Outer flame (orange)
  ctx.fillStyle = withAlpha('#fb923c', 0.85)
  ctx.beginPath()
  ctx.moveTo(x - flameWidth * 0.6 + swayX * 0.5, flameBaseY)
  ctx.quadraticCurveTo(
    x - flameWidth + swayX * 0.8,
    flameBaseY - flameHeight * 0.5,
    x + swayX,
    tipY,
  )
  ctx.quadraticCurveTo(
    x + flameWidth + swayX * 0.8,
    flameBaseY - flameHeight * 0.5,
    x + flameWidth * 0.6 + swayX * 0.5,
    flameBaseY,
  )
  ctx.closePath()
  ctx.fill()

  // Inner flame (yellow)
  const innerScale = 0.65
  ctx.fillStyle = withAlpha('#fef08a', 0.9)
  ctx.beginPath()
  ctx.moveTo(x - flameWidth * 0.35 + swayX * 0.3, flameBaseY)
  ctx.quadraticCurveTo(
    x - flameWidth * innerScale + swayX * 0.5,
    flameBaseY - flameHeight * 0.45,
    x + swayX * 0.7,
    tipY + flameHeight * 0.2,
  )
  ctx.quadraticCurveTo(
    x + flameWidth * innerScale + swayX * 0.5,
    flameBaseY - flameHeight * 0.45,
    x + flameWidth * 0.35 + swayX * 0.3,
    flameBaseY,
  )
  ctx.closePath()
  ctx.fill()

  // Bright core
  const coreGradient = ctx.createRadialGradient(
    x + swayX * 0.5, flameBaseY - flameHeight * 0.2, 0,
    x + swayX * 0.5, flameBaseY - flameHeight * 0.2, flameWidth * 0.4,
  )
  coreGradient.addColorStop(0, withAlpha('#ffffff', 0.6 * scale))
  coreGradient.addColorStop(1, withAlpha('#fef9c3', 0))
  ctx.fillStyle = coreGradient
  ctx.beginPath()
  ctx.arc(x + swayX * 0.5, flameBaseY - flameHeight * 0.2, flameWidth * 0.4, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

const drawSmokeParticles = (
  ctx: CanvasRenderingContext2D,
  particles: SmokeParticle[],
): void => {
  for (const p of particles) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha('#9ca3af', p.alpha)
    ctx.fill()
  }
}

const drawConfettiParticles = (
  ctx: CanvasRenderingContext2D,
  particles: ConfettiParticle[],
): void => {
  for (const p of particles) {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)
    ctx.fillStyle = withAlpha(p.color, p.alpha)
    ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height)
    ctx.restore()
  }
}

const drawRoundCounter = (
  ctx: CanvasRenderingContext2D,
  rounds: number,
  width: number,
): void => {
  if (rounds <= 0) return

  const text = rounds === 1 ? '1 fois' : `${rounds} fois`
  ctx.save()
  ctx.font = '600 1rem system-ui, sans-serif'
  ctx.textAlign = 'center'

  const textWidth = ctx.measureText(text).width
  const boxPadding = 12
  const boxX = width / 2 - textWidth / 2 - boxPadding
  const boxY = 50

  ctx.fillStyle = withAlpha('#1e1b4b', 0.6)
  ctx.beginPath()
  ctx.roundRect(boxX, boxY, textWidth + boxPadding * 2, 32, 8)
  ctx.fill()

  ctx.fillStyle = withAlpha('#fcd34d', 0.85)
  ctx.fillText(text, width / 2, boxY + 22)
  ctx.restore()
}

const drawInstruction = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  allExtinguished: boolean,
): void => {
  if (allExtinguished) return

  const pulseAlpha = 0.3 + Math.sin(time * 0.04) * 0.1
  ctx.save()
  ctx.fillStyle = withAlpha('#fef9c3', pulseAlpha)
  ctx.font = '1.1rem system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Souffle pour \u00e9teindre les bougies !', width / 2, height * 0.15)
  ctx.restore()
}

// --- Styling functions ---

const styleWrapper = (el: HTMLElement): void => {
  Object.assign(el.style, {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: BG_TOP,
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
    color: '#fcd34d',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '8px 12px',
    borderRadius: '8px',
    backgroundColor: withAlpha('#1e1b4b', 0.7),
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
    color: withAlpha('#fef9c3', 0.6),
    margin: '0',
    padding: '8px 16px',
    fontFamily: 'inherit',
    pointerEvents: 'none',
  })
}

// --- Main game factory ---

export const createCandles = (): Game => {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let animationId: number | null = null
  let resizeHandler: (() => void) | null = null

  let candles: Candle[] = []
  let smokeParticles: Map<number, SmokeParticle[]> = new Map()
  let confetti: ConfettiParticle[] = []
  let roundsCompleted = 0
  let frameCount = 0
  let allExtinguished = false
  let relightTimer = 0
  let celebrating = false
  let currentVolume = 0

  const getTableY = (): number => height * 0.7
  const getCandleBodyWidth = (): number => clamp(width / (CANDLE_COUNT * 2.5), 16, 36)
  const getCandleBodyHeight = (): number => clamp(height * 0.18, 50, 120)

  const relightAllCandles = (): void => {
    candles = candles.map((c) => ({
      ...c,
      flameScale: 1,
      extinguished: false,
      blowAccumulator: 0,
    }))
    smokeParticles = new Map()
    allExtinguished = false
    celebrating = false
    relightTimer = 0
  }

  const startCelebration = (): void => {
    celebrating = true
    allExtinguished = true
    relightTimer = 0
    roundsCompleted += 1
    confetti = spawnConfetti(width, height)
  }

  const animate = (): void => {
    if (!ctx) return

    frameCount += 1
    clearCanvas(ctx, width, height)

    const tableY = getTableY()
    const bodyWidth = getCandleBodyWidth()
    const bodyHeight = getCandleBodyHeight()
    const flameBaseY = tableY - bodyHeight - 8

    // Draw background and table
    drawBackground(ctx, width, height)
    drawTable(ctx, width, height, tableY)

    // Update and draw smoke particles per candle
    for (const [candleIdx, particles] of smokeParticles.entries()) {
      const updated = particles.map(updateSmokeParticle).filter(isSmokeVisible)
      if (updated.length === 0) {
        smokeParticles.delete(candleIdx)
      } else {
        smokeParticles.set(candleIdx, updated)
      }
    }

    // Spawn smoke for extinguished candles
    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i]
      if (candle.extinguished && Math.random() < SMOKE_SPAWN_RATE) {
        const existing = smokeParticles.get(i) ?? []
        if (existing.length < SMOKE_MAX_PER_CANDLE) {
          smokeParticles.set(i, [
            ...existing,
            spawnSmokeParticle(candle.x, flameBaseY),
          ])
        }
      }
    }

    // Draw each candle
    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i]

      drawCandleBody(ctx, candle.x, tableY, bodyWidth, bodyHeight, candle.bodyColor)

      if (!candle.extinguished) {
        // Flicker animation: two sine waves at different frequencies for natural look
        const flicker1 = Math.sin(frameCount * FLICKER_SPEED + i * 1.7)
        const flicker2 = Math.sin(frameCount * FLICKER_SPEED * 1.6 + i * 2.3) * 0.5
        const flickerOffset = (flicker1 + flicker2) * FLICKER_AMPLITUDE

        drawFlame(ctx, candle.x, flameBaseY, candle.flameScale, flickerOffset)
      }

      // Draw smoke for this candle
      const candleSmoke = smokeParticles.get(i)
      if (candleSmoke) {
        drawSmokeParticles(ctx, candleSmoke)
      }
    }

    // Update flame scales (restore flames that are not being blown on)
    candles = candles.map((candle, i) => {
      if (candle.extinguished) return candle

      const targetIndex = findNextCandleIndex(candles)
      const isTarget = targetIndex === i
      const isBlowing = isTarget && currentVolume > BLOW_THRESHOLD

      if (isBlowing) {
        const newAccumulator = candle.blowAccumulator + 1
        const newScale = clamp(1 - newAccumulator * FLAME_SHRINK_RATE, 0, 1)

        if (newScale <= 0) {
          return {
            ...candle,
            flameScale: 0,
            extinguished: true,
            blowAccumulator: 0,
          }
        }

        return {
          ...candle,
          flameScale: newScale,
          blowAccumulator: newAccumulator,
        }
      }

      // Not being blown on: flame slowly restores, accumulator decays
      const restoredScale = clamp(candle.flameScale + FLAME_RESTORE_RATE, 0, 1)
      const decayedAccumulator = Math.max(0, candle.blowAccumulator - 0.5)

      return {
        ...candle,
        flameScale: restoredScale,
        blowAccumulator: decayedAccumulator,
      }
    })

    // Check if all candles are extinguished
    if (!allExtinguished && candles.every((c) => c.extinguished)) {
      startCelebration()
    }

    // Celebration: confetti
    if (celebrating) {
      confetti = confetti.map(updateConfettiParticle).filter(isConfettiVisible)
      drawConfettiParticles(ctx, confetti)

      relightTimer += 1
      if (relightTimer >= RELIGHT_DELAY_FRAMES) {
        relightAllCandles()
      }
    }

    // UI overlays
    drawInstruction(ctx, width, height, frameCount, allExtinguished)
    drawRoundCounter(ctx, roundsCompleted, width)

    animationId = requestAnimationFrame(animate)
  }

  const handleResize = (): void => {
    if (!canvas || !ctx) return
    const size = resizeCanvas(canvas, ctx)
    width = size.width
    height = size.height
    candles = positionCandles(candles, width)
  }

  const mount = (container: HTMLElement): void => {
    const wrapper = createElement('div', {})
    styleWrapper(wrapper)

    const backButton = createElement('button', {}, '\u2190 Accueil')
    styleBackButton(backButton)
    backButton.addEventListener('click', () => {
      window.location.hash = '#menu'
    })

    const title = createElement('p', {}, 'Bougies')
    styleTitle(title)

    wrapper.appendChild(backButton)
    wrapper.appendChild(title)
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

    // Initialize game state
    candles = positionCandles(generateCandles(CANDLE_COUNT), width)
    smokeParticles = new Map()
    confetti = []
    roundsCompleted = 0
    frameCount = 0
    allExtinguished = false
    relightTimer = 0
    celebrating = false
    currentVolume = 0

    resizeHandler = handleResize
    window.addEventListener('resize', resizeHandler)

    animate()
  }

  const update = (features: VoiceFeatures): void => {
    currentVolume = features.volume
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
    candles = []
    smokeParticles = new Map()
    confetti = []
    roundsCompleted = 0
    frameCount = 0
    allExtinguished = false
    relightTimer = 0
    celebrating = false
    currentVolume = 0
    width = 0
    height = 0
  }

  return {
    id: 'candles',
    name: 'Bougies',
    description: 'Souffle pour \u00e9teindre les bougies',
    mount,
    unmount,
    update,
  }
}
