import type { Game } from '../types'
import type { VoiceFeatures } from '../../audio/types'
import { createCanvas, clearCanvas, resizeCanvas } from '../../ui/canvas'
import { colors, withAlpha } from '../../ui/colors'
import { createElement } from '../../ui/dom'

// --- Creature types and shapes ---

type CreatureKind = 'star' | 'heart' | 'butterfly' | 'flower'

type Creature = {
  readonly x: number
  readonly y: number
  readonly kind: CreatureKind
  readonly color: string
  readonly size: number
  readonly discovered: boolean
  readonly glowPhase: number // animation phase for pulsing
}

// Soft pastel palette for creatures
const CREATURE_COLORS = [
  '#f9a8d4', // pink
  '#a5b4fc', // lavender
  '#86efac', // mint
  '#fcd34d', // gold
  '#fca5a5', // salmon
  '#c4b5fd', // violet
  '#67e8f9', // cyan
  '#fdba74', // peach
  '#d8b4fe', // lilac
  '#6ee7b7', // sea green
] as const

const CREATURE_KINDS: readonly CreatureKind[] = ['star', 'heart', 'butterfly', 'flower']

const CREATURE_COUNT = 9
const DISCOVERY_DISTANCE = 15 // extra pixels beyond creature size for discovery
const MIN_LIGHT_RADIUS = 20
const MAX_LIGHT_RADIUS_FACTOR = 0.45 // fraction of smallest canvas dimension
const GLOW_SPEED = 0.06
const GLOW_AMPLITUDE = 0.25
const DARK_BG = '#0a0e1a'
const LIGHT_CENTER_COLOR = '#1e2a4a'
const AMBIENT_ALPHA = 0.04 // faint ambient so screen isn't pitch black

// --- Pure helper functions ---

const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min)

const distance = (x1: number, y1: number, x2: number, y2: number): number =>
  Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const generateCreatures = (width: number, height: number): Creature[] => {
  const margin = 60
  const creatures: Creature[] = []

  for (let i = 0; i < CREATURE_COUNT; i++) {
    creatures.push({
      x: randomBetween(margin, width - margin),
      y: randomBetween(margin + 50, height - margin),
      kind: CREATURE_KINDS[i % CREATURE_KINDS.length],
      color: CREATURE_COLORS[i % CREATURE_COLORS.length],
      size: randomBetween(18, 30),
      discovered: false,
      glowPhase: randomBetween(0, Math.PI * 2),
    })
  }

  return creatures
}

// --- Drawing functions for each creature kind ---

const drawStar = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
): void => {
  const spikes = 5
  const outerRadius = size
  const innerRadius = size * 0.45

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()

  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    const angle = (Math.PI * i) / spikes - Math.PI / 2
    const px = x + Math.cos(angle) * radius
    const py = y + Math.sin(angle) * radius

    if (i === 0) {
      ctx.moveTo(px, py)
    } else {
      ctx.lineTo(px, py)
    }
  }

  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

const drawHeart = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
): void => {
  const s = size * 0.6

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.3)
  ctx.bezierCurveTo(x, y - s * 0.3, x - s, y - s * 0.3, x - s, y + s * 0.1)
  ctx.bezierCurveTo(x - s, y + s * 0.6, x, y + s * 0.9, x, y + s * 1.1)
  ctx.bezierCurveTo(x, y + s * 0.9, x + s, y + s * 0.6, x + s, y + s * 0.1)
  ctx.bezierCurveTo(x + s, y - s * 0.3, x, y - s * 0.3, x, y + s * 0.3)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

const drawButterfly = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
): void => {
  const s = size * 0.7

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color

  // Left upper wing
  ctx.beginPath()
  ctx.ellipse(x - s * 0.45, y - s * 0.25, s * 0.5, s * 0.35, -Math.PI / 6, 0, Math.PI * 2)
  ctx.fill()

  // Right upper wing
  ctx.beginPath()
  ctx.ellipse(x + s * 0.45, y - s * 0.25, s * 0.5, s * 0.35, Math.PI / 6, 0, Math.PI * 2)
  ctx.fill()

  // Left lower wing
  ctx.beginPath()
  ctx.ellipse(x - s * 0.35, y + s * 0.25, s * 0.35, s * 0.25, Math.PI / 6, 0, Math.PI * 2)
  ctx.fill()

  // Right lower wing
  ctx.beginPath()
  ctx.ellipse(x + s * 0.35, y + s * 0.25, s * 0.35, s * 0.25, -Math.PI / 6, 0, Math.PI * 2)
  ctx.fill()

  // Body
  ctx.fillStyle = withAlpha(color, alpha * 0.8)
  ctx.beginPath()
  ctx.ellipse(x, y, s * 0.08, s * 0.45, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

const drawFlower = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
): void => {
  const petalCount = 6
  const petalRadius = size * 0.35
  const centerRadius = size * 0.2
  const petalDistance = size * 0.35

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color

  // Petals
  for (let i = 0; i < petalCount; i++) {
    const angle = (Math.PI * 2 * i) / petalCount
    const px = x + Math.cos(angle) * petalDistance
    const py = y + Math.sin(angle) * petalDistance

    ctx.beginPath()
    ctx.arc(px, py, petalRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  // Center
  ctx.fillStyle = withAlpha('#fef08a', alpha)
  ctx.beginPath()
  ctx.arc(x, y, centerRadius, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

const drawCreature = (
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  alpha: number,
  glowScale: number,
): void => {
  const drawSize = creature.size * glowScale
  const drawFns: Record<CreatureKind, () => void> = {
    star: () => drawStar(ctx, creature.x, creature.y, drawSize, creature.color, alpha),
    heart: () => drawHeart(ctx, creature.x, creature.y, drawSize, creature.color, alpha),
    butterfly: () => drawButterfly(ctx, creature.x, creature.y, drawSize, creature.color, alpha),
    flower: () => drawFlower(ctx, creature.x, creature.y, drawSize, creature.color, alpha),
  }

  drawFns[creature.kind]()
}

// --- Styling functions ---

const styleWrapper = (el: HTMLElement): void => {
  Object.assign(el.style, {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: DARK_BG,
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
    color: '#a5b4fc',
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
    color: withAlpha('#c7d2fe', 0.6),
    margin: '0',
    padding: '8px 16px',
    fontFamily: 'inherit',
    pointerEvents: 'none',
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
    color: '#fcd34d',
    margin: '0',
    padding: '8px 16px',
    fontFamily: 'inherit',
    pointerEvents: 'none',
    backgroundColor: withAlpha('#1e1b4b', 0.7),
    borderRadius: '8px',
  })
}

// --- Main game factory ---

export const createLamp = (): Game => {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let creatures: Creature[] = []
  let animationId: number | null = null
  let resizeHandler: (() => void) | null = null
  let counterEl: HTMLElement | null = null

  // Current light state (smoothed)
  let currentRadius = 0
  let targetRadius = 0
  let lightX = 0
  let lightY = 0

  const computeLightRadius = (volume: number): number => {
    const maxRadius = Math.min(width, height) * MAX_LIGHT_RADIUS_FACTOR
    const boosted = Math.pow(volume, 0.3)
    return MIN_LIGHT_RADIUS + boosted * maxRadius
  }

  const updateDiscoveries = (radius: number): void => {
    creatures = creatures.map((c) => {
      if (c.discovered) return c

      const dist = distance(lightX, lightY, c.x, c.y)
      const reachDistance = radius - c.size - DISCOVERY_DISTANCE

      if (dist < reachDistance) {
        return { ...c, discovered: true }
      }

      return c
    })
  }

  const updateCounterDisplay = (): void => {
    if (!counterEl) return
    const found = creatures.filter((c) => c.discovered).length
    counterEl.textContent = `${found} / ${creatures.length}`
  }

  const drawDarkBackground = (drawCtx: CanvasRenderingContext2D): void => {
    drawCtx.fillStyle = DARK_BG
    drawCtx.fillRect(0, 0, width, height)
  }

  const drawLightCircle = (drawCtx: CanvasRenderingContext2D, radius: number): void => {
    if (radius <= MIN_LIGHT_RADIUS) return

    const gradient = drawCtx.createRadialGradient(
      lightX, lightY, 0,
      lightX, lightY, radius,
    )

    gradient.addColorStop(0, withAlpha('#2a3a6a', 0.9))
    gradient.addColorStop(0.3, withAlpha('#1a2550', 0.7))
    gradient.addColorStop(0.7, withAlpha('#101830', 0.4))
    gradient.addColorStop(1, withAlpha(DARK_BG, 0))

    drawCtx.save()
    drawCtx.globalCompositeOperation = 'lighter'
    drawCtx.fillStyle = gradient
    drawCtx.beginPath()
    drawCtx.arc(lightX, lightY, radius, 0, Math.PI * 2)
    drawCtx.fill()
    drawCtx.restore()
  }

  const drawCreatures = (drawCtx: CanvasRenderingContext2D, radius: number, time: number): void => {
    for (const creature of creatures) {
      const dist = distance(lightX, lightY, creature.x, creature.y)

      // Creature visibility based on distance from light center
      let alpha: number

      if (creature.discovered && radius <= MIN_LIGHT_RADIUS) {
        // Discovered creatures stay faintly visible even without light
        alpha = AMBIENT_ALPHA * 3
      } else if (dist > radius + creature.size) {
        // Outside light range entirely: show ambient hint for discovered creatures only
        alpha = creature.discovered ? AMBIENT_ALPHA * 2 : 0
      } else if (dist > radius - creature.size) {
        // At the edge of the light: partial reveal
        const overlap = (radius + creature.size - dist) / (creature.size * 2)
        alpha = clamp(overlap, 0, 1) * 0.9
      } else {
        // Fully inside light: strong visibility
        const centerFactor = 1 - (dist / radius) * 0.3
        alpha = clamp(centerFactor, 0.5, 0.95)
      }

      if (alpha <= 0) continue

      // Glow pulsing for discovered creatures
      let glowScale = 1
      if (creature.discovered) {
        const pulse = Math.sin(time * GLOW_SPEED + creature.glowPhase)
        glowScale = 1 + pulse * GLOW_AMPLITUDE
        alpha = Math.min(alpha + 0.15, 1)
      }

      drawCreature(drawCtx, creature, alpha, glowScale)
    }
  }

  const drawInstructionHint = (drawCtx: CanvasRenderingContext2D, time: number): void => {
    const found = creatures.filter((c) => c.discovered).length
    if (found > 0) return

    const pulseAlpha = 0.25 + Math.sin(time * 0.03) * 0.1
    drawCtx.save()
    drawCtx.fillStyle = withAlpha('#c7d2fe', pulseAlpha)
    drawCtx.font = '1.1rem system-ui, sans-serif'
    drawCtx.textAlign = 'center'
    drawCtx.fillText('Parle pour allumer la lampe !', width / 2, height / 2 + 60)
    drawCtx.restore()
  }

  let frameCount = 0

  const animate = (): void => {
    if (!ctx) return

    frameCount += 1
    clearCanvas(ctx, width, height)

    // Smooth radius transition
    currentRadius += (targetRadius - currentRadius) * 0.12

    drawDarkBackground(ctx)
    drawLightCircle(ctx, currentRadius)
    drawCreatures(ctx, currentRadius, frameCount)
    drawInstructionHint(ctx, frameCount)

    updateDiscoveries(currentRadius)
    updateCounterDisplay()

    animationId = requestAnimationFrame(animate)
  }

  const handleResize = (): void => {
    if (!canvas || !ctx) return
    const size = resizeCanvas(canvas, ctx)
    width = size.width
    height = size.height
    lightX = width / 2
    lightY = height / 2
  }

  const mount = (container: HTMLElement): void => {
    const wrapper = createElement('div', {})
    styleWrapper(wrapper)

    const backButton = createElement('button', {}, '\u2190 Accueil')
    styleBackButton(backButton)
    backButton.addEventListener('click', () => {
      window.location.hash = '#menu'
    })

    const title = createElement('p', {}, 'Lampe Magique')
    styleTitle(title)

    counterEl = createElement('p', {}, '0 / 0')
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

    lightX = width / 2
    lightY = height / 2

    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
    })

    creatures = generateCreatures(width, height)
    currentRadius = 0
    targetRadius = 0
    frameCount = 0

    resizeHandler = handleResize
    window.addEventListener('resize', resizeHandler)

    updateCounterDisplay()
    animate()
  }

  const update = (features: VoiceFeatures): void => {
    if (features.isVoicing) {
      targetRadius = computeLightRadius(features.volume)
    } else {
      targetRadius = 0
    }
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
    creatures = []
    currentRadius = 0
    targetRadius = 0
    frameCount = 0
    width = 0
    height = 0
  }

  return {
    id: 'lamp',
    name: 'Lampe Magique',
    description: 'Illumine l\u2019obscurit\u00e9 avec ta voix pour d\u00e9couvrir des cr\u00e9atures cach\u00e9es !',
    mount,
    unmount,
    update,
  }
}
