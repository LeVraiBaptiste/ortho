import type { Game } from '../types'
import type { VoiceFeatures } from '../../audio/types'
import { createCanvas, clearCanvas, resizeCanvas } from '../../ui/canvas'
import { vowelColors, colors, withAlpha } from '../../ui/colors'
import { createElement } from '../../ui/dom'

// --- Types ---

type BalloonState = 'inflating' | 'floating' | 'popped' | 'idle'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  life: number
  gravity: number
  rotation: number
  rotationSpeed: number
  shape: 'circle' | 'rect' | 'star'
}

type FloatingBalloon = {
  x: number
  y: number
  radiusX: number
  radiusY: number
  color: string
  alpha: number
  vx: number
  vy: number
  stringAngle: number
}

type StarSparkle = {
  x: number
  y: number
  size: number
  alpha: number
  angle: number
  speed: number
}

// --- Constants ---

const MIN_BALLOON_RADIUS = 20
const MAX_BALLOON_RADIUS = 120
const POP_RADIUS = 130
const BALLOON_BASE_Y_RATIO = 0.72
const STRING_LENGTH = 100
const STRING_SWAY_AMPLITUDE = 8
const STRING_SWAY_SPEED = 0.003

const PERFECT_ZONE_START = 2
const PERFECT_ZONE_END = 3
const WOBBLE_START = 3
const POP_DURATION = 4

const PARTICLE_COUNT = 40
const PARTICLE_LIFE = 80
const PARTICLE_GRAVITY = 0.12
const PARTICLE_COLORS = [
  '#ef4444', '#f59e0b', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#f97316', '#06b6d4',
  '#FFD700', '#ff6b6b',
]

const STAR_COUNT = 5
const STAR_LIFE = 60

const RESPAWN_DELAY_MS = 2000
const FLOAT_SPEED = -1.2
const FLOAT_DRIFT = 0.3

const SKY_TOP = '#87CEEB'
const SKY_MID = '#B0E0F0'
const SKY_BOTTOM = '#d4f0d4'
const CLOUD_COLOR = '#ffffff'

// --- Pure helpers ---

const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min)

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const durationToRadius = (duration: number): number => {
  if (duration <= 0) return MIN_BALLOON_RADIUS
  const progress = clamp(duration / POP_DURATION, 0, 1)
  return MIN_BALLOON_RADIUS + progress * (POP_RADIUS - MIN_BALLOON_RADIUS)
}

const durationToColor = (
  duration: number,
  baseColor: string,
): string => {
  // Gradually blend toward red as balloon approaches popping
  if (duration < WOBBLE_START) return baseColor

  const dangerProgress = clamp((duration - WOBBLE_START) / (POP_DURATION - WOBBLE_START), 0, 1)
  // Parse base color
  const br = parseInt(baseColor.slice(1, 3), 16)
  const bg = parseInt(baseColor.slice(3, 5), 16)
  const bb = parseInt(baseColor.slice(5, 7), 16)
  // Blend toward red
  const r = Math.round(br + (240 - br) * dangerProgress)
  const g = Math.round(bg + (80 - bg) * dangerProgress)
  const b = Math.round(bb + (80 - bb) * dangerProgress)
  return `rgb(${r}, ${g}, ${b})`
}

const spawnConfettiParticle = (x: number, y: number): Particle => ({
  x,
  y,
  vx: randomBetween(-6, 6),
  vy: randomBetween(-10, -2),
  size: randomBetween(4, 10),
  color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
  life: PARTICLE_LIFE,
  gravity: PARTICLE_GRAVITY,
  rotation: randomBetween(0, Math.PI * 2),
  rotationSpeed: randomBetween(-0.15, 0.15),
  shape: (['circle', 'rect', 'star'] as const)[Math.floor(Math.random() * 3)],
})

const updateParticle = (p: Particle): Particle => ({
  ...p,
  x: p.x + p.vx,
  y: p.y + p.vy,
  vy: p.vy + p.gravity,
  vx: p.vx * 0.99,
  life: p.life - 1,
  rotation: p.rotation + p.rotationSpeed,
})

const isParticleAlive = (p: Particle): boolean => p.life > 0

const spawnStarSparkle = (cx: number, cy: number, radius: number): StarSparkle => {
  const angle = randomBetween(0, Math.PI * 2)
  const dist = randomBetween(radius * 0.6, radius * 1.2)
  return {
    x: cx + Math.cos(angle) * dist,
    y: cy + Math.sin(angle) * dist,
    size: randomBetween(3, 7),
    alpha: 1,
    angle,
    speed: randomBetween(0.3, 0.8),
  }
}

const updateStarSparkle = (s: StarSparkle): StarSparkle => ({
  ...s,
  x: s.x + Math.cos(s.angle) * s.speed,
  y: s.y + Math.sin(s.angle) * s.speed,
  alpha: s.alpha - 1 / STAR_LIFE,
})

const isStarAlive = (s: StarSparkle): boolean => s.alpha > 0

const updateFloatingBalloon = (b: FloatingBalloon): FloatingBalloon => ({
  ...b,
  x: b.x + b.vx,
  y: b.y + b.vy,
  alpha: b.alpha - 0.004,
  stringAngle: b.stringAngle + 0.02,
})

const isFloatingVisible = (b: FloatingBalloon): boolean =>
  b.alpha > 0 && b.y + b.radiusY > -50

// --- Drawing functions ---

const drawSkyGradient = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, SKY_TOP)
  gradient.addColorStop(0.6, SKY_MID)
  gradient.addColorStop(1, SKY_BOTTOM)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

const drawCloud = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
): void => {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.fillStyle = withAlpha(CLOUD_COLOR, 0.6)

  // Cloud made of overlapping circles
  const circles = [
    { cx: 0, cy: 0, r: 25 },
    { cx: -22, cy: 5, r: 20 },
    { cx: 22, cy: 5, r: 20 },
    { cx: -10, cy: -12, r: 18 },
    { cx: 12, cy: -10, r: 16 },
  ]
  for (const c of circles) {
    ctx.beginPath()
    ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

const drawClouds = (
  ctx: CanvasRenderingContext2D,
  width: number,
  time: number,
): void => {
  const drift = time * 0.01
  drawCloud(ctx, (width * 0.15 + drift) % (width + 100) - 50, 60, 1.0)
  drawCloud(ctx, (width * 0.55 + drift * 0.7) % (width + 100) - 50, 90, 0.8)
  drawCloud(ctx, (width * 0.85 + drift * 0.5) % (width + 100) - 50, 45, 1.2)
}

const drawGround = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void => {
  const groundTop = height * 0.88
  const gradient = ctx.createLinearGradient(0, groundTop, 0, height)
  gradient.addColorStop(0, '#5cb85c')
  gradient.addColorStop(1, '#3a8a3a')
  ctx.fillStyle = gradient
  ctx.fillRect(0, groundTop, width, height - groundTop)

  // Wavy grass top edge
  ctx.beginPath()
  ctx.moveTo(0, groundTop)
  for (let x = 0; x <= width; x += 20) {
    const waveY = groundTop + Math.sin(x * 0.05) * 4
    ctx.lineTo(x, waveY)
  }
  ctx.lineTo(width, groundTop + 10)
  ctx.lineTo(0, groundTop + 10)
  ctx.closePath()
  ctx.fillStyle = '#5cb85c'
  ctx.fill()
}

const drawString = (
  ctx: CanvasRenderingContext2D,
  topX: number,
  topY: number,
  bottomX: number,
  bottomY: number,
  time: number,
  swayExtra: number,
): void => {
  const midX = (topX + bottomX) / 2 + Math.sin(time * STRING_SWAY_SPEED) * STRING_SWAY_AMPLITUDE + swayExtra
  const midY = (topY + bottomY) / 2

  ctx.beginPath()
  ctx.moveTo(topX, topY)
  ctx.quadraticCurveTo(midX, midY, bottomX, bottomY)
  ctx.strokeStyle = withAlpha(colors.text, 0.5)
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.stroke()
}

const drawBalloonShape = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  balloonColor: string,
  wobbleOffset: number,
): void => {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(wobbleOffset * 0.05)

  // Balloon body (slightly taller than wide)
  ctx.beginPath()
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2)

  // Gradient fill for depth
  const gradient = ctx.createRadialGradient(
    -radiusX * 0.3, -radiusY * 0.3, radiusX * 0.1,
    0, 0, radiusY,
  )
  gradient.addColorStop(0, withAlpha('#ffffff', 0.6))
  gradient.addColorStop(0.3, balloonColor)
  gradient.addColorStop(1, withAlpha(balloonColor, 0.85))
  ctx.fillStyle = gradient
  ctx.fill()

  // Shine highlight
  ctx.beginPath()
  ctx.ellipse(-radiusX * 0.3, -radiusY * 0.35, radiusX * 0.2, radiusY * 0.15, -0.4, 0, Math.PI * 2)
  ctx.fillStyle = withAlpha('#ffffff', 0.4)
  ctx.fill()

  // Knot at the bottom
  ctx.beginPath()
  ctx.moveTo(-4, radiusY)
  ctx.lineTo(0, radiusY + 8)
  ctx.lineTo(4, radiusY)
  ctx.closePath()
  ctx.fillStyle = balloonColor
  ctx.fill()

  ctx.restore()
}

const drawPerfectGlow = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  time: number,
): void => {
  const pulse = 1 + Math.sin(time * 0.008) * 0.15
  const glowRadius = radius * 1.5 * pulse

  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, glowRadius)
  gradient.addColorStop(0, withAlpha(colors.green, 0.25))
  gradient.addColorStop(1, withAlpha(colors.green, 0))
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2)
  ctx.fill()
}

const drawStarShape = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number,
): void => {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#FFD700'
  ctx.beginPath()
  ctx.moveTo(x, y - size)
  ctx.lineTo(x + size * 0.3, y - size * 0.3)
  ctx.lineTo(x + size, y)
  ctx.lineTo(x + size * 0.3, y + size * 0.3)
  ctx.lineTo(x, y + size)
  ctx.lineTo(x - size * 0.3, y + size * 0.3)
  ctx.lineTo(x - size, y)
  ctx.lineTo(x - size * 0.3, y - size * 0.3)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

const drawConfettiParticle = (
  ctx: CanvasRenderingContext2D,
  p: Particle,
): void => {
  const alpha = clamp(p.life / PARTICLE_LIFE, 0, 1)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rotation)
  ctx.globalAlpha = alpha

  if (p.shape === 'circle') {
    ctx.beginPath()
    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.fill()
  } else if (p.shape === 'rect') {
    ctx.fillStyle = p.color
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
  } else {
    // Star shape
    ctx.fillStyle = p.color
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const outerAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2
      const innerAngle = outerAngle + Math.PI / 5
      const outerR = p.size / 2
      const innerR = p.size / 4
      if (i === 0) {
        ctx.moveTo(Math.cos(outerAngle) * outerR, Math.sin(outerAngle) * outerR)
      } else {
        ctx.lineTo(Math.cos(outerAngle) * outerR, Math.sin(outerAngle) * outerR)
      }
      ctx.lineTo(Math.cos(innerAngle) * innerR, Math.sin(innerAngle) * innerR)
    }
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}

const drawFloatingBalloon = (
  ctx: CanvasRenderingContext2D,
  b: FloatingBalloon,
  time: number,
): void => {
  ctx.save()
  ctx.globalAlpha = b.alpha

  drawBalloonShape(ctx, b.x, b.y, b.radiusX, b.radiusY, b.color, 0)

  // Dangling string
  const stringEndX = b.x + Math.sin(b.stringAngle) * 15
  const stringEndY = b.y + b.radiusY + 8 + STRING_LENGTH * 0.6
  drawString(ctx, b.x, b.y + b.radiusY + 8, stringEndX, stringEndY, time, Math.sin(b.stringAngle) * 5)

  ctx.restore()
}

const drawPopText = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  age: number,
): void => {
  const scale = 1 + age * 0.02
  const alpha = clamp(1 - age / 40, 0, 1)
  if (alpha <= 0) return

  ctx.save()
  ctx.translate(cx, cy - 20 - age * 1.5)
  ctx.scale(scale, scale)
  ctx.globalAlpha = alpha
  ctx.font = 'bold 28px inherit'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#FFD700'
  ctx.strokeStyle = withAlpha('#ffffff', 0.8)
  ctx.lineWidth = 3
  ctx.strokeText('POP!', 0, 0)
  ctx.fillText('POP!', 0, 0)
  ctx.restore()
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

// --- Game factory ---

export const createBalloon = (): Game => {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let animationId: number | null = null
  let resizeHandler: (() => void) | null = null

  // Balloon state
  let balloonState: BalloonState = 'idle'
  let currentDuration = 0
  let balloonColor: string = colors.secondary
  let wasVoicing = false
  let successCount = 0
  let counterEl: HTMLElement | null = null

  // Particles and effects
  let confettiParticles: Particle[] = []
  let starSparkles: StarSparkle[] = []
  let floatingBalloons: FloatingBalloon[] = []
  let popAge = 0
  let popX = 0
  let popY = 0
  let showPop = false

  // Respawn timer
  let respawnTimer: ReturnType<typeof setTimeout> | null = null

  // Animation time
  let time = 0

  const getBalloonCenterX = (): number => width / 2
  const getBalloonBaseY = (): number => height * BALLOON_BASE_Y_RATIO
  const getStringBottomY = (): number => height * 0.88

  const updateCounter = (): void => {
    if (!counterEl) return
    counterEl.textContent = successCount === 0
      ? 'Ballons: 0'
      : `Ballons: ${successCount}`
  }

  const scheduleRespawn = (): void => {
    if (respawnTimer !== null) {
      clearTimeout(respawnTimer)
    }
    respawnTimer = setTimeout(() => {
      balloonState = 'idle'
      currentDuration = 0
      showPop = false
      respawnTimer = null
    }, RESPAWN_DELAY_MS)
  }

  const popBalloon = (cx: number, cy: number): void => {
    balloonState = 'popped'
    popX = cx
    popY = cy
    popAge = 0
    showPop = true

    // Spawn confetti
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      confettiParticles.push(spawnConfettiParticle(cx, cy))
    }

    scheduleRespawn()
  }

  const releaseBalloon = (cx: number, cy: number, radiusX: number, radiusY: number): void => {
    balloonState = 'floating'
    successCount += 1
    updateCounter()

    floatingBalloons.push({
      x: cx,
      y: cy,
      radiusX,
      radiusY,
      color: balloonColor,
      alpha: 1,
      vx: randomBetween(-FLOAT_DRIFT, FLOAT_DRIFT),
      vy: FLOAT_SPEED,
      stringAngle: 0,
    })

    scheduleRespawn()
  }

  const animate = (): void => {
    if (!ctx) return
    time += 1

    clearCanvas(ctx, width, height)

    // Background
    drawSkyGradient(ctx, width, height)
    drawClouds(ctx, width, time)
    drawGround(ctx, width, height)

    const cx = getBalloonCenterX()
    const baseY = getBalloonBaseY()
    const stringBottomY = getStringBottomY()

    // Draw floating released balloons
    floatingBalloons = floatingBalloons.map(updateFloatingBalloon).filter(isFloatingVisible)
    for (const fb of floatingBalloons) {
      drawFloatingBalloon(ctx, fb, time)
    }

    // Draw the active balloon
    if (balloonState === 'inflating' || balloonState === 'idle') {
      const radius = durationToRadius(currentDuration)
      const radiusX = radius * 0.85
      const radiusY = radius
      const balloonCenterY = baseY - radiusY

      // Wobble when in danger zone
      let wobbleOffset = 0
      if (currentDuration >= WOBBLE_START) {
        const wobbleIntensity = clamp((currentDuration - WOBBLE_START) / (POP_DURATION - WOBBLE_START), 0, 1)
        wobbleOffset = Math.sin(time * 0.3) * wobbleIntensity * 12
      }

      const displayColor = durationToColor(currentDuration, balloonColor)

      // Perfect zone glow
      if (currentDuration >= PERFECT_ZONE_START && currentDuration < PERFECT_ZONE_END) {
        drawPerfectGlow(ctx, cx + wobbleOffset * 0.5, balloonCenterY, radius, time)
      }

      // String
      const knotY = baseY + 8
      drawString(
        ctx,
        cx + wobbleOffset * 0.3,
        knotY,
        cx,
        stringBottomY,
        time,
        wobbleOffset * 0.2,
      )

      // Balloon body
      drawBalloonShape(ctx, cx + wobbleOffset * 0.5, balloonCenterY, radiusX, radiusY, displayColor, wobbleOffset)

      // Stars in perfect zone
      if (currentDuration >= PERFECT_ZONE_START && currentDuration < PERFECT_ZONE_END) {
        if (starSparkles.length < STAR_COUNT && Math.random() < 0.15) {
          starSparkles.push(spawnStarSparkle(cx, balloonCenterY, radius))
        }
      }

      starSparkles = starSparkles.map(updateStarSparkle).filter(isStarAlive)
      for (const star of starSparkles) {
        drawStarShape(ctx, star.x, star.y, star.size, star.alpha)
      }

      // Stretchy lines when in danger zone
      if (currentDuration >= WOBBLE_START) {
        const stretchIntensity = clamp((currentDuration - WOBBLE_START) / (POP_DURATION - WOBBLE_START), 0, 1)
        ctx.save()
        ctx.globalAlpha = stretchIntensity * 0.4
        ctx.strokeStyle = withAlpha('#ffffff', 0.6)
        ctx.lineWidth = 1.5
        // Draw stretch marks
        for (let i = 0; i < 3; i++) {
          const angle = -0.5 + i * 0.5
          const markX = cx + wobbleOffset * 0.5 + Math.cos(angle) * radiusX * 0.7
          const markY = balloonCenterY + Math.sin(angle) * radiusY * 0.5
          ctx.beginPath()
          ctx.moveTo(markX - 5, markY - 3)
          ctx.lineTo(markX + 5, markY + 3)
          ctx.stroke()
        }
        ctx.restore()
      }
    }

    // Draw confetti particles
    confettiParticles = confettiParticles.map(updateParticle).filter(isParticleAlive)
    for (const p of confettiParticles) {
      drawConfettiParticle(ctx, p)
    }

    // Draw pop text
    if (showPop) {
      popAge += 1
      drawPopText(ctx, popX, popY, popAge)
      if (popAge > 50) {
        showPop = false
      }
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

    const title = createElement('p', {}, 'Ballon')
    styleTitle(title)

    counterEl = createElement('p', {}, 'Ballons: 0')
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
    balloonState = 'idle'
    currentDuration = 0
    balloonColor = colors.secondary
    wasVoicing = false
    successCount = 0
    confettiParticles = []
    starSparkles = []
    floatingBalloons = []
    showPop = false
    popAge = 0
    time = 0

    updateCounter()
    animate()
  }

  const update = (features: VoiceFeatures): void => {
    const isVoicing = features.isVoicing

    if (isVoicing) {
      if (!wasVoicing) {
        // New voicing session
        if (balloonState === 'idle') {
          balloonState = 'inflating'
          currentDuration = 0
          starSparkles = []
          balloonColor = colors.secondary
        }
      }

      if (balloonState === 'inflating') {
        currentDuration = features.duration

        // Update color based on vowel
        if (features.vowel !== null && vowelColors[features.vowel]) {
          balloonColor = vowelColors[features.vowel]
        }

        // Check for pop
        if (currentDuration >= POP_DURATION) {
          const radius = durationToRadius(currentDuration)
          const balloonCenterY = getBalloonBaseY() - radius
          popBalloon(getBalloonCenterX(), balloonCenterY)
        }
      }
    } else if (wasVoicing && balloonState === 'inflating' && currentDuration > 0.1) {
      // Voice stopped while inflating: release the balloon!
      const radius = durationToRadius(currentDuration)
      const radiusX = radius * 0.85
      const radiusY = radius
      const balloonCenterY = getBalloonBaseY() - radiusY
      releaseBalloon(getBalloonCenterX(), balloonCenterY, radiusX, radiusY)
    } else if (!isVoicing && balloonState === 'inflating') {
      // Too short, reset quietly
      balloonState = 'idle'
      currentDuration = 0
      starSparkles = []
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

    if (respawnTimer !== null) {
      clearTimeout(respawnTimer)
      respawnTimer = null
    }

    canvas = null
    ctx = null
    counterEl = null
    confettiParticles = []
    starSparkles = []
    floatingBalloons = []
    balloonState = 'idle'
    currentDuration = 0
    wasVoicing = false
    successCount = 0
    showPop = false
    time = 0
    width = 0
    height = 0
  }

  return {
    id: 'balloon',
    name: 'Ballon',
    description: 'Gonfle le ballon sans le faire \u00e9clater',
    mount,
    unmount,
    update,
  }
}
