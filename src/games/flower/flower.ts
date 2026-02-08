import type { Game } from '../types'
import type { VoiceFeatures } from '../../audio/types'
import { createCanvas, clearCanvas, resizeCanvas } from '../../ui/canvas'
import { vowelColors, colors, withAlpha } from '../../ui/colors'
import { createElement } from '../../ui/dom'

// --- Types ---

type Flower = {
  readonly x: number
  readonly stemHeight: number
  readonly maxDuration: number
  readonly color: string
  readonly petalCount: number
  readonly hasLeaves: boolean
  readonly hasBud: boolean
  readonly isOpen: boolean
  readonly isFullBloom: boolean
  readonly hasSparkles: boolean
}

type Sparkle = {
  x: number
  y: number
  size: number
  alpha: number
  vx: number
  vy: number
  life: number
}

// --- Constants ---

const GRASS_HEIGHT_RATIO = 0.15
const STEM_WIDTH = 4
const MAX_STEM_HEIGHT_RATIO = 0.55
const LEAF_WIDTH = 18
const LEAF_HEIGHT = 10
const BUD_RADIUS = 8
const PETAL_RADIUS_SMALL = 14
const PETAL_RADIUS_LARGE = 20
const PETAL_WIDTH_RATIO = 0.5
const CENTER_RADIUS = 8
const FLOWER_SPACING = 60
const SUN_RADIUS = 40
const SUN_RAY_COUNT = 12
const SUN_RAY_LENGTH = 20
const SWAY_AMPLITUDE = 3
const SWAY_SPEED = 0.002
const SPARKLE_SPAWN_RATE = 0.3
const SPARKLE_LIFE = 60
const MAX_SPARKLES_PER_FLOWER = 8
const DEFAULT_FLOWER_COLOR = '#f472b6'

// --- Pure helpers ---

const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min)

const durationToStemHeight = (duration: number, maxHeight: number): number => {
  // Stem grows from 0 to max over 0-2 seconds
  const progress = Math.min(duration / 2, 1)
  return progress * maxHeight
}

const durationToFlower = (
  x: number,
  duration: number,
  vowelColor: string,
): Flower => ({
  x,
  stemHeight: 0, // computed during draw based on canvas height
  maxDuration: duration,
  color: vowelColor,
  petalCount: duration >= 4 ? 8 : 5,
  hasLeaves: duration >= 1,
  hasBud: duration >= 2,
  isOpen: duration >= 3,
  isFullBloom: duration >= 4,
  hasSparkles: duration >= 5,
})

const spawnSparkle = (cx: number, cy: number): Sparkle => ({
  x: cx + randomBetween(-30, 30),
  y: cy + randomBetween(-30, 10),
  size: randomBetween(2, 5),
  alpha: 1,
  vx: randomBetween(-0.5, 0.5),
  vy: randomBetween(-1.5, -0.3),
  life: SPARKLE_LIFE,
})

const updateSparkle = (sparkle: Sparkle): Sparkle => ({
  ...sparkle,
  x: sparkle.x + sparkle.vx,
  y: sparkle.y + sparkle.vy,
  alpha: sparkle.life / SPARKLE_LIFE,
  life: sparkle.life - 1,
})

const isSparkleAlive = (sparkle: Sparkle): boolean => sparkle.life > 0

// --- Drawing functions ---

const drawSkyGradient = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#87CEEB')
  gradient.addColorStop(0.6, '#B0E0F0')
  gradient.addColorStop(0.85, '#d4f0d4')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

const drawGrass = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void => {
  const grassTop = height * (1 - GRASS_HEIGHT_RATIO)

  // Main grass body
  const gradient = ctx.createLinearGradient(0, grassTop, 0, height)
  gradient.addColorStop(0, '#5cb85c')
  gradient.addColorStop(1, '#3a8a3a')
  ctx.fillStyle = gradient
  ctx.fillRect(0, grassTop, width, height * GRASS_HEIGHT_RATIO)

  // Wavy grass top edge
  ctx.beginPath()
  ctx.moveTo(0, grassTop)
  for (let x = 0; x <= width; x += 20) {
    const waveY = grassTop + Math.sin(x * 0.05) * 4
    ctx.lineTo(x, waveY)
  }
  ctx.lineTo(width, grassTop + 10)
  ctx.lineTo(0, grassTop + 10)
  ctx.closePath()
  ctx.fillStyle = '#5cb85c'
  ctx.fill()
}

const drawSun = (
  ctx: CanvasRenderingContext2D,
  width: number,
  time: number,
): void => {
  const sunX = width - 70
  const sunY = 70
  const pulse = 1 + Math.sin(time * 0.001) * 0.05

  // Glow
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, SUN_RADIUS * 2)
  glow.addColorStop(0, withAlpha('#FFD700', 0.3))
  glow.addColorStop(1, withAlpha('#FFD700', 0))
  ctx.fillStyle = glow
  ctx.fillRect(sunX - SUN_RADIUS * 2, sunY - SUN_RADIUS * 2, SUN_RADIUS * 4, SUN_RADIUS * 4)

  // Rays
  ctx.save()
  ctx.translate(sunX, sunY)
  ctx.rotate(time * 0.0003)
  for (let i = 0; i < SUN_RAY_COUNT; i++) {
    const angle = (i / SUN_RAY_COUNT) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(
      Math.cos(angle) * SUN_RADIUS * pulse,
      Math.sin(angle) * SUN_RADIUS * pulse,
    )
    ctx.lineTo(
      Math.cos(angle) * (SUN_RADIUS + SUN_RAY_LENGTH) * pulse,
      Math.sin(angle) * (SUN_RADIUS + SUN_RAY_LENGTH) * pulse,
    )
    ctx.strokeStyle = withAlpha('#FFD700', 0.6)
    ctx.lineWidth = 3
    ctx.stroke()
  }
  ctx.restore()

  // Sun body
  ctx.beginPath()
  ctx.arc(sunX, sunY, SUN_RADIUS * pulse, 0, Math.PI * 2)
  ctx.fillStyle = '#FFD700'
  ctx.fill()

  // Face (simple smile for children)
  ctx.fillStyle = '#E6A800'
  // Eyes
  ctx.beginPath()
  ctx.arc(sunX - 12, sunY - 8, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sunX + 12, sunY - 8, 4, 0, Math.PI * 2)
  ctx.fill()
  // Smile
  ctx.beginPath()
  ctx.arc(sunX, sunY + 2, 14, 0.15 * Math.PI, 0.85 * Math.PI)
  ctx.strokeStyle = '#E6A800'
  ctx.lineWidth = 2.5
  ctx.stroke()
}

const drawStem = (
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  stemHeight: number,
  time: number,
  swayOffset: number,
): void => {
  const topY = baseY - stemHeight
  const sway = Math.sin(time * SWAY_SPEED + swayOffset) * SWAY_AMPLITUDE
  const controlX = baseX + sway
  const controlY = baseY - stemHeight * 0.5

  ctx.beginPath()
  ctx.moveTo(baseX, baseY)
  ctx.quadraticCurveTo(controlX, controlY, baseX + sway, topY)
  ctx.strokeStyle = '#2d8a4e'
  ctx.lineWidth = STEM_WIDTH
  ctx.lineCap = 'round'
  ctx.stroke()
}

const drawLeaves = (
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  stemHeight: number,
  time: number,
  swayOffset: number,
): void => {
  const sway = Math.sin(time * SWAY_SPEED + swayOffset) * SWAY_AMPLITUDE

  // Left leaf at 40% height
  const leftLeafY = baseY - stemHeight * 0.4
  const leftLeafX = baseX + sway * 0.4 - 2
  ctx.save()
  ctx.translate(leftLeafX, leftLeafY)
  ctx.rotate(-0.6)
  ctx.beginPath()
  ctx.ellipse(0, 0, LEAF_WIDTH, LEAF_HEIGHT, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#34d399'
  ctx.fill()
  ctx.restore()

  // Right leaf at 60% height
  const rightLeafY = baseY - stemHeight * 0.65
  const rightLeafX = baseX + sway * 0.65 + 2
  ctx.save()
  ctx.translate(rightLeafX, rightLeafY)
  ctx.rotate(0.6)
  ctx.beginPath()
  ctx.ellipse(0, 0, LEAF_WIDTH, LEAF_HEIGHT, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#34d399'
  ctx.fill()
  ctx.restore()
}

const drawBud = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  flowerColor: string,
): void => {
  // Green bud shape (teardrop-ish)
  ctx.save()
  ctx.translate(cx, cy)

  // Green outer
  ctx.beginPath()
  ctx.ellipse(0, 0, BUD_RADIUS * 0.8, BUD_RADIUS * 1.2, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#2d8a4e'
  ctx.fill()

  // Color hint at top
  ctx.beginPath()
  ctx.ellipse(0, -BUD_RADIUS * 0.3, BUD_RADIUS * 0.5, BUD_RADIUS * 0.5, 0, 0, Math.PI * 2)
  ctx.fillStyle = withAlpha(flowerColor, 0.6)
  ctx.fill()

  ctx.restore()
}

const drawOpenFlower = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  flowerColor: string,
  petalCount: number,
  isFullBloom: boolean,
  time: number,
): void => {
  const petalRadius = isFullBloom ? PETAL_RADIUS_LARGE : PETAL_RADIUS_SMALL
  const petalWidth = petalRadius * PETAL_WIDTH_RATIO
  const breathe = 1 + Math.sin(time * 0.003) * 0.03

  ctx.save()
  ctx.translate(cx, cy)

  // Draw petals
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2
    ctx.save()
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.ellipse(
      0,
      -petalRadius * 0.7 * breathe,
      petalWidth * breathe,
      petalRadius * breathe,
      0,
      0,
      Math.PI * 2,
    )
    ctx.fillStyle = withAlpha(flowerColor, 0.85)
    ctx.fill()

    // Petal highlight
    ctx.beginPath()
    ctx.ellipse(
      0,
      -petalRadius * 0.55 * breathe,
      petalWidth * 0.5 * breathe,
      petalRadius * 0.5 * breathe,
      0,
      0,
      Math.PI * 2,
    )
    ctx.fillStyle = withAlpha('#ffffff', 0.25)
    ctx.fill()

    ctx.restore()
  }

  // Center circle
  ctx.beginPath()
  ctx.arc(0, 0, CENTER_RADIUS * breathe, 0, Math.PI * 2)
  ctx.fillStyle = '#FFD700'
  ctx.fill()

  // Center highlight
  ctx.beginPath()
  ctx.arc(-2, -2, CENTER_RADIUS * 0.5 * breathe, 0, Math.PI * 2)
  ctx.fillStyle = withAlpha('#ffffff', 0.4)
  ctx.fill()

  ctx.restore()
}

const drawSparkle = (
  ctx: CanvasRenderingContext2D,
  sparkle: Sparkle,
): void => {
  ctx.save()
  ctx.globalAlpha = sparkle.alpha

  // Four-pointed star
  const s = sparkle.size
  ctx.fillStyle = '#FFD700'
  ctx.beginPath()
  ctx.moveTo(sparkle.x, sparkle.y - s)
  ctx.lineTo(sparkle.x + s * 0.3, sparkle.y - s * 0.3)
  ctx.lineTo(sparkle.x + s, sparkle.y)
  ctx.lineTo(sparkle.x + s * 0.3, sparkle.y + s * 0.3)
  ctx.lineTo(sparkle.x, sparkle.y + s)
  ctx.lineTo(sparkle.x - s * 0.3, sparkle.y + s * 0.3)
  ctx.lineTo(sparkle.x - s, sparkle.y)
  ctx.lineTo(sparkle.x - s * 0.3, sparkle.y - s * 0.3)
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

const drawSingleFlower = (
  ctx: CanvasRenderingContext2D,
  flower: Flower,
  height: number,
  time: number,
  sparkles: ReadonlyArray<Sparkle>,
): void => {
  const grassTop = height * (1 - GRASS_HEIGHT_RATIO)
  const baseY = grassTop + 5
  const maxStemHeight = height * MAX_STEM_HEIGHT_RATIO
  const stemHeight = durationToStemHeight(flower.maxDuration, maxStemHeight)
  const swayOffset = flower.x * 0.1

  const sway = Math.sin(time * SWAY_SPEED + swayOffset) * SWAY_AMPLITUDE
  const topX = flower.x + sway
  const topY = baseY - stemHeight

  // Always draw stem if any duration
  if (flower.maxDuration > 0) {
    drawStem(ctx, flower.x, baseY, stemHeight, time, swayOffset)
  }

  // Leaves at 1-2s
  if (flower.hasLeaves) {
    drawLeaves(ctx, flower.x, baseY, stemHeight, time, swayOffset)
  }

  // Bud at 2-3s (only if not yet open)
  if (flower.hasBud && !flower.isOpen) {
    drawBud(ctx, topX, topY, flower.color)
  }

  // Open flower at 3s+
  if (flower.isOpen) {
    drawOpenFlower(
      ctx,
      topX,
      topY,
      flower.color,
      flower.petalCount,
      flower.isFullBloom,
      time,
    )
  }

  // Sparkles at 5s+
  for (const sparkle of sparkles) {
    drawSparkle(ctx, sparkle)
  }
}

// --- Styling helpers ---

const styleWrapper = (el: HTMLElement): void => {
  Object.assign(el.style, {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
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
    color: withAlpha(colors.text, 0.7),
    margin: '0',
    padding: '8px 16px',
    fontFamily: 'inherit',
    pointerEvents: 'none',
    backgroundColor: withAlpha(colors.surface, 0.6),
    borderRadius: '12px',
    backdropFilter: 'blur(4px)',
  })
}

const styleCounter = (el: HTMLElement): void => {
  Object.assign(el.style, {
    position: 'absolute',
    top: '16px',
    right: '16px',
    zIndex: '10',
    fontSize: '1.1rem',
    fontWeight: '600',
    color: colors.text,
    margin: '0',
    padding: '8px 16px',
    fontFamily: 'inherit',
    pointerEvents: 'none',
    backgroundColor: withAlpha(colors.surface, 0.8),
    borderRadius: '12px',
    backdropFilter: 'blur(4px)',
  })
}

// --- Compute next flower X position ---

const computeNextFlowerX = (
  gardenFlowers: ReadonlyArray<Flower>,
  width: number,
): number => {
  if (gardenFlowers.length === 0) {
    return width / 2
  }

  // Place flowers from center outward, alternating left and right
  const centerX = width / 2
  const index = gardenFlowers.length
  const side = index % 2 === 0 ? 1 : -1
  const offset = Math.ceil(index / 2) * FLOWER_SPACING
  const x = centerX + side * offset

  // Clamp within canvas with margin
  const margin = 40
  return Math.max(margin, Math.min(width - margin, x))
}

// --- Game factory ---

export const createFlower = (): Game => {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let animationId: number | null = null
  let resizeHandler: (() => void) | null = null

  // Garden state
  let gardenFlowers: Flower[] = []
  let currentFlowerX = 0
  let currentDuration = 0
  let currentColor = DEFAULT_FLOWER_COLOR
  let wasVoicing = false
  let hasActiveFlower = false
  let sparklesMap: Map<number, Sparkle[]> = new Map()
  let counterEl: HTMLElement | null = null
  let startTime = 0

  const updateCounter = (): void => {
    if (!counterEl) return
    const count = gardenFlowers.length
    counterEl.textContent = count === 0
      ? 'Jardin: 0 fleur'
      : count === 1
        ? 'Jardin: 1 fleur'
        : `Jardin: ${count} fleurs`
  }

  const animate = (): void => {
    if (!ctx) return

    const time = performance.now() - startTime

    clearCanvas(ctx, width, height)

    // Background
    drawSkyGradient(ctx, width, height)
    drawSun(ctx, width, time)
    drawGrass(ctx, width, height)

    // Draw completed garden flowers
    for (let i = 0; i < gardenFlowers.length; i++) {
      const flower = gardenFlowers[i]
      const flowerSparkles = sparklesMap.get(i) ?? []

      // Update sparkles
      if (flower.hasSparkles && flowerSparkles.length < MAX_SPARKLES_PER_FLOWER) {
        if (Math.random() < SPARKLE_SPAWN_RATE) {
          const grassTop = height * (1 - GRASS_HEIGHT_RATIO)
          const maxStemH = height * MAX_STEM_HEIGHT_RATIO
          const stemH = durationToStemHeight(flower.maxDuration, maxStemH)
          const topY = grassTop + 5 - stemH
          flowerSparkles.push(spawnSparkle(flower.x, topY))
        }
      }

      const updated = flowerSparkles.map(updateSparkle).filter(isSparkleAlive)
      sparklesMap.set(i, updated)

      drawSingleFlower(ctx, flower, height, time, updated)
    }

    // Draw the currently growing flower
    if (hasActiveFlower && currentDuration > 0) {
      const activeFlower = durationToFlower(currentFlowerX, currentDuration, currentColor)
      const activeSparkles = sparklesMap.get(-1) ?? []

      if (activeFlower.hasSparkles && activeSparkles.length < MAX_SPARKLES_PER_FLOWER) {
        if (Math.random() < SPARKLE_SPAWN_RATE) {
          const grassTop = height * (1 - GRASS_HEIGHT_RATIO)
          const maxStemH = height * MAX_STEM_HEIGHT_RATIO
          const stemH = durationToStemHeight(activeFlower.maxDuration, maxStemH)
          const topY = grassTop + 5 - stemH
          activeSparkles.push(spawnSparkle(currentFlowerX, topY))
        }
      }

      const updatedActive = activeSparkles.map(updateSparkle).filter(isSparkleAlive)
      sparklesMap.set(-1, updatedActive)

      drawSingleFlower(ctx, activeFlower, height, time, updatedActive)
    }

    animationId = requestAnimationFrame(animate)
  }

  const handleResize = (): void => {
    if (!canvas || !ctx) return
    const size = resizeCanvas(canvas, ctx)
    width = size.width
    height = size.height
  }

  const mount = (container: HTMLElement): void => {
    const wrapper = createElement('div', {})
    styleWrapper(wrapper)

    const backButton = createElement('button', {}, '\u2190 Accueil')
    styleBackButton(backButton)
    backButton.addEventListener('click', () => {
      window.location.hash = '#menu'
    })

    const title = createElement('p', {}, 'Faire Pousser')
    styleTitle(title)

    counterEl = createElement('p', {}, 'Jardin: 0 fleur')
    styleCounter(counterEl)

    wrapper.appendChild(backButton)
    wrapper.appendChild(title)
    wrapper.appendChild(counterEl)
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

    resizeHandler = handleResize
    window.addEventListener('resize', resizeHandler)

    // Reset state
    gardenFlowers = []
    sparklesMap = new Map()
    currentDuration = 0
    currentColor = DEFAULT_FLOWER_COLOR
    wasVoicing = false
    hasActiveFlower = false
    currentFlowerX = width / 2
    startTime = performance.now()

    updateCounter()
    animate()
  }

  const update = (features: VoiceFeatures): void => {
    const isVoicing = features.isVoicing

    if (isVoicing) {
      if (!wasVoicing) {
        // New voicing session: start a new flower
        hasActiveFlower = true
        currentFlowerX = computeNextFlowerX(gardenFlowers, width)
        currentDuration = 0
        currentColor = DEFAULT_FLOWER_COLOR
        sparklesMap.delete(-1)
      }

      // Update the growing flower
      currentDuration = features.duration
      if (features.vowel !== null && vowelColors[features.vowel]) {
        currentColor = vowelColors[features.vowel]
      }
    } else if (wasVoicing && hasActiveFlower && currentDuration > 0.1) {
      // Voice stopped: freeze current flower into the garden
      const finishedFlower = durationToFlower(currentFlowerX, currentDuration, currentColor)
      gardenFlowers.push(finishedFlower)

      // Transfer active sparkles to the garden flower index
      const activeSparkles = sparklesMap.get(-1) ?? []
      sparklesMap.set(gardenFlowers.length - 1, activeSparkles)
      sparklesMap.delete(-1)

      hasActiveFlower = false
      currentDuration = 0
      updateCounter()
    } else if (!isVoicing) {
      // Too short voicing, discard
      hasActiveFlower = false
      currentDuration = 0
      sparklesMap.delete(-1)
    }

    wasVoicing = isVoicing
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
    counterEl = null
    gardenFlowers = []
    sparklesMap = new Map()
    currentDuration = 0
    wasVoicing = false
    hasActiveFlower = false
    width = 0
    height = 0
  }

  return {
    id: 'flower',
    name: 'Faire Pousser',
    description: 'Fais pousser des fleurs avec ta voix !',
    mount,
    unmount,
    update,
  }
}
