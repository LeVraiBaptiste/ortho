import type { Game } from '../types'
import type { VoiceFeatures } from '../../audio/types'
import { createCanvas, clearCanvas, resizeCanvas } from '../../ui/canvas'
import { colors, withAlpha } from '../../ui/colors'
import { createElement } from '../../ui/dom'

// --- Types ---

type Star = {
  readonly x: number // 0..1 normalized
  readonly y: number // 0..1 normalized
  readonly size: number
  readonly twinkleSpeed: number
  readonly twinkleOffset: number
}

type Planet = {
  readonly x: number // 0..1 normalized
  readonly y: number // 0..1 normalized (0 = top, 1 = bottom)
  readonly radius: number
  readonly color: string
  readonly label: string
  readonly ringColor: string | null
}

type FlameParticle = {
  readonly x: number
  readonly y: number
  readonly vx: number
  readonly vy: number
  readonly life: number // 0..1 remaining
  readonly size: number
  readonly color: string
}

// --- Constants ---

const STAR_COUNT = 120
const LERP_SPEED = 0.08
const ROCKET_WIDTH = 36
const ROCKET_HEIGHT = 56
const FLAME_SPAWN_RATE = 3 // particles per frame when voicing
const FLAME_DECAY = 0.03
const FLAME_SPREAD_X = 3
const FLAME_SPEED_Y = 2.5
const FLAME_MIN_SIZE = 3
const FLAME_MAX_SIZE = 8
const GROUND_HEIGHT_RATIO = 0.08
const ROCKET_BOTTOM_MARGIN = 0.12 // where rocket sits at rest (ratio from bottom)
const ROCKET_TOP_MARGIN = 0.08 // highest the rocket can go (ratio from top)
const SPACE_BG = '#0f0e2e'
const GROUND_COLOR = '#1a3a2a'
const GROUND_HIGHLIGHT = '#2d5a3a'
const FLAME_COLORS = ['#ff6b35', '#ffa500', '#ffcc00', '#ff4444', '#ffee88']

const PLANETS: ReadonlyArray<Omit<Planet, 'x'> & { readonly x: number }> = [
  { x: 0.78, y: 0.7, radius: 18, color: '#66bb6a', label: '', ringColor: null },
  { x: 0.2, y: 0.5, radius: 24, color: '#ffa726', label: '', ringColor: '#ffcc80' },
  { x: 0.82, y: 0.32, radius: 20, color: '#ab47bc', label: '', ringColor: null },
  { x: 0.35, y: 0.15, radius: 30, color: '#42a5f5', label: '', ringColor: '#90caf9' },
]

// --- Pure helpers ---

const lerp = (current: number, target: number, factor: number): number =>
  current + (target - current) * factor

const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min)

const generateStars = (count: number): ReadonlyArray<Star> =>
  Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: randomBetween(0.5, 2.5),
    twinkleSpeed: randomBetween(0.01, 0.04),
    twinkleOffset: Math.random() * Math.PI * 2,
  }))

const spawnFlameParticle = (rocketX: number, rocketBottomY: number, volume: number): FlameParticle => ({
  x: rocketX + randomBetween(-ROCKET_WIDTH * 0.3, ROCKET_WIDTH * 0.3),
  y: rocketBottomY + randomBetween(0, 4),
  vx: randomBetween(-FLAME_SPREAD_X, FLAME_SPREAD_X),
  vy: randomBetween(FLAME_SPEED_Y * 0.5, FLAME_SPEED_Y) * (0.5 + volume * 0.5),
  life: 1.0,
  size: randomBetween(FLAME_MIN_SIZE, FLAME_MAX_SIZE) * (0.6 + volume * 0.8),
  color: FLAME_COLORS[Math.floor(Math.random() * FLAME_COLORS.length)],
})

const updateFlameParticle = (p: FlameParticle): FlameParticle => ({
  ...p,
  x: p.x + p.vx,
  y: p.y + p.vy,
  life: p.life - FLAME_DECAY,
  size: p.size * 0.97,
})

const isParticleAlive = (p: FlameParticle): boolean => p.life > 0 && p.size > 0.5

// --- Drawing functions ---

const drawStarfield = (
  ctx: CanvasRenderingContext2D,
  stars: ReadonlyArray<Star>,
  width: number,
  height: number,
  time: number,
): void => {
  for (const star of stars) {
    const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(time * star.twinkleSpeed + star.twinkleOffset))
    ctx.beginPath()
    ctx.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha('#ffffff', twinkle)
    ctx.fill()
  }
}

const drawPlanet = (
  ctx: CanvasRenderingContext2D,
  planet: Planet,
  width: number,
  height: number,
): void => {
  const px = planet.x * width
  const py = planet.y * height

  // Glow
  const gradient = ctx.createRadialGradient(px, py, planet.radius * 0.5, px, py, planet.radius * 2)
  gradient.addColorStop(0, withAlpha(planet.color, 0.2))
  gradient.addColorStop(1, withAlpha(planet.color, 0))
  ctx.beginPath()
  ctx.arc(px, py, planet.radius * 2, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.fill()

  // Planet body
  ctx.beginPath()
  ctx.arc(px, py, planet.radius, 0, Math.PI * 2)
  ctx.fillStyle = planet.color
  ctx.fill()

  // Ring if present
  if (planet.ringColor) {
    ctx.beginPath()
    ctx.ellipse(px, py, planet.radius * 1.8, planet.radius * 0.35, -0.3, 0, Math.PI * 2)
    ctx.strokeStyle = withAlpha(planet.ringColor, 0.6)
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

const drawGround = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void => {
  const groundY = height * (1 - GROUND_HEIGHT_RATIO)

  // Ground fill
  ctx.fillStyle = GROUND_COLOR
  ctx.fillRect(0, groundY, width, height * GROUND_HEIGHT_RATIO)

  // Ground top highlight
  ctx.fillStyle = GROUND_HIGHLIGHT
  ctx.fillRect(0, groundY, width, 3)
}

const drawRocket = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void => {
  const halfW = ROCKET_WIDTH / 2
  const h = ROCKET_HEIGHT

  ctx.save()
  ctx.translate(x, y)

  // Nose cone (top triangle)
  ctx.beginPath()
  ctx.moveTo(0, -h)
  ctx.lineTo(-halfW * 0.5, -h * 0.55)
  ctx.lineTo(halfW * 0.5, -h * 0.55)
  ctx.closePath()
  ctx.fillStyle = '#ef4444'
  ctx.fill()

  // Body
  ctx.beginPath()
  ctx.moveTo(-halfW * 0.5, -h * 0.55)
  ctx.lineTo(-halfW * 0.5, 0)
  ctx.lineTo(halfW * 0.5, 0)
  ctx.lineTo(halfW * 0.5, -h * 0.55)
  ctx.closePath()
  ctx.fillStyle = '#e0e0e0'
  ctx.fill()

  // Body stripe
  ctx.fillStyle = colors.primary
  ctx.fillRect(-halfW * 0.5, -h * 0.4, ROCKET_WIDTH * 0.5, h * 0.12)

  // Window
  ctx.beginPath()
  ctx.arc(0, -h * 0.42, halfW * 0.28, 0, Math.PI * 2)
  ctx.fillStyle = '#81d4fa'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, -h * 0.42, halfW * 0.28, 0, Math.PI * 2)
  ctx.strokeStyle = '#4fc3f7'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Left fin
  ctx.beginPath()
  ctx.moveTo(-halfW * 0.5, -h * 0.08)
  ctx.lineTo(-halfW, h * 0.08)
  ctx.lineTo(-halfW * 0.5, 0)
  ctx.closePath()
  ctx.fillStyle = '#ef4444'
  ctx.fill()

  // Right fin
  ctx.beginPath()
  ctx.moveTo(halfW * 0.5, -h * 0.08)
  ctx.lineTo(halfW, h * 0.08)
  ctx.lineTo(halfW * 0.5, 0)
  ctx.closePath()
  ctx.fillStyle = '#ef4444'
  ctx.fill()

  // Nozzle
  ctx.beginPath()
  ctx.moveTo(-halfW * 0.3, 0)
  ctx.lineTo(-halfW * 0.2, h * 0.08)
  ctx.lineTo(halfW * 0.2, h * 0.08)
  ctx.lineTo(halfW * 0.3, 0)
  ctx.closePath()
  ctx.fillStyle = '#78909c'
  ctx.fill()

  ctx.restore()
}

const drawFlameParticles = (
  ctx: CanvasRenderingContext2D,
  particles: ReadonlyArray<FlameParticle>,
): void => {
  for (const p of particles) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(p.color, p.life * 0.8)
    ctx.fill()
  }
}

const drawAltitudeIndicator = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rocketY: number,
  minY: number,
  maxY: number,
): void => {
  const progress = 1 - (rocketY - minY) / (maxY - minY)
  const barX = width - 24
  const barTop = height * 0.08
  const barHeight = height * 0.84
  const barWidth = 8

  // Background bar
  ctx.fillStyle = withAlpha('#ffffff', 0.1)
  ctx.beginPath()
  ctx.roundRect(barX - barWidth / 2, barTop, barWidth, barHeight, 4)
  ctx.fill()

  // Fill bar
  const fillHeight = barHeight * Math.max(0, Math.min(1, progress))
  const fillGradient = ctx.createLinearGradient(0, barTop + barHeight, 0, barTop)
  fillGradient.addColorStop(0, '#34d399')
  fillGradient.addColorStop(0.5, '#fbbf24')
  fillGradient.addColorStop(1, '#ef4444')
  ctx.fillStyle = fillGradient
  ctx.beginPath()
  ctx.roundRect(barX - barWidth / 2, barTop + barHeight - fillHeight, barWidth, fillHeight, 4)
  ctx.fill()
}

// --- Styling ---

const styleWrapper = (el: HTMLElement): void => {
  Object.assign(el.style, {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: SPACE_BG,
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
    color: withAlpha('#a5b4fc', 0.6),
    margin: '0',
    padding: '8px 16px',
    fontFamily: 'inherit',
    pointerEvents: 'none',
  })
}

// --- Game factory ---

export const createRocket = (): Game => {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let animationId: number | null = null
  let resizeHandler: (() => void) | null = null

  // State
  let stars: ReadonlyArray<Star> = []
  let currentRocketY = 0 // pixel position, lerped
  let targetRocketY = 0
  let flameParticles: FlameParticle[] = []
  let currentVolume = 0
  let isCurrentlyVoicing = false
  let time = 0

  const getRocketRestY = (): number => height * (1 - ROCKET_BOTTOM_MARGIN)
  const getRocketTopY = (): number => height * ROCKET_TOP_MARGIN + ROCKET_HEIGHT
  const getRocketX = (): number => width / 2

  const animate = (): void => {
    if (!ctx) return
    time += 1

    // Lerp rocket position
    currentRocketY = lerp(currentRocketY, targetRocketY, LERP_SPEED)

    // Update flame particles
    flameParticles = flameParticles.map(updateFlameParticle).filter(isParticleAlive)

    // Spawn new flame particles when voicing
    if (isCurrentlyVoicing && currentVolume > 0.01) {
      const spawnCount = Math.ceil(FLAME_SPAWN_RATE * (0.5 + currentVolume * 1.5))
      for (let i = 0; i < spawnCount; i++) {
        flameParticles.push(
          spawnFlameParticle(getRocketX(), currentRocketY, currentVolume),
        )
      }
    }

    // Draw
    clearCanvas(ctx, width, height)

    // Background
    ctx.fillStyle = SPACE_BG
    ctx.fillRect(0, 0, width, height)

    // Stars
    drawStarfield(ctx, stars, width, height, time)

    // Planets
    for (const planet of PLANETS) {
      drawPlanet(ctx, planet, width, height)
    }

    // Ground
    drawGround(ctx, width, height)

    // Flame particles (draw behind rocket)
    drawFlameParticles(ctx, flameParticles)

    // Rocket
    drawRocket(ctx, getRocketX(), currentRocketY)

    // Altitude indicator
    drawAltitudeIndicator(ctx, width, height, currentRocketY, getRocketTopY(), getRocketRestY())

    animationId = requestAnimationFrame(animate)
  }

  const handleResize = (): void => {
    if (!canvas || !ctx) return
    const oldRestY = getRocketRestY()
    const oldTopY = getRocketTopY()
    const oldRatio = oldRestY > oldTopY
      ? (currentRocketY - oldTopY) / (oldRestY - oldTopY)
      : 1

    const size = resizeCanvas(canvas, ctx)
    width = size.width
    height = size.height

    // Recompute rocket position maintaining ratio
    const newRestY = getRocketRestY()
    const newTopY = getRocketTopY()
    currentRocketY = newTopY + oldRatio * (newRestY - newTopY)
    targetRocketY = currentRocketY

    stars = generateStars(STAR_COUNT)
  }

  const mount = (container: HTMLElement): void => {
    const wrapper = createElement('div', {})
    styleWrapper(wrapper)

    const backButton = createElement('button', {}, '\u2190 Accueil')
    styleBackButton(backButton)
    backButton.addEventListener('click', () => {
      window.location.hash = '#menu'
    })

    const title = createElement('p', {}, 'Fus\u00e9e')
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

    // Initialize state
    stars = generateStars(STAR_COUNT)
    currentRocketY = getRocketRestY()
    targetRocketY = currentRocketY
    flameParticles = []
    currentVolume = 0
    isCurrentlyVoicing = false
    time = 0

    resizeHandler = handleResize
    window.addEventListener('resize', resizeHandler)

    animate()
  }

  const update = (features: VoiceFeatures): void => {
    currentVolume = features.volume
    isCurrentlyVoicing = features.isVoicing

    const restY = getRocketRestY()
    const topY = getRocketTopY()

    if (features.isVoicing && features.volume > 0.01) {
      // Apply sqrt curve to amplify low volumes — makes rocket more responsive
      const boosted = Math.pow(features.volume, 0.3)
      targetRocketY = restY - boosted * (restY - topY)
    } else {
      // Descend back to ground
      targetRocketY = restY
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
    stars = []
    flameParticles = []
    currentVolume = 0
    isCurrentlyVoicing = false
    time = 0
    width = 0
    height = 0
  }

  return {
    id: 'rocket',
    name: 'Fus\u00e9e',
    description: 'Fais d\u00e9coller la fus\u00e9e avec ta voix !',
    mount,
    unmount,
    update,
  }
}
