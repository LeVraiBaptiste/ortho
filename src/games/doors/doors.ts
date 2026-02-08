import type { Game } from '../types'
import type { VoiceFeatures } from '../../audio/types'
import type { Vowel } from '../../audio/types'
import { createCanvas, clearCanvas, resizeCanvas } from '../../ui/canvas'
import { vowelColors, colors, withAlpha } from '../../ui/colors'
import { createElement } from '../../ui/dom'

// --- Types ---

type DoorVowel = 'a' | 'e' | 'i' | 'o' | 'u'

type DoorState = {
  readonly vowel: DoorVowel
  readonly color: string
  readonly openAmount: number   // 0 = closed, 1 = fully open
  readonly isOpening: boolean
  readonly surpriseTime: number // seconds remaining for surprise animation
  readonly surpriseFrame: number // frame counter for surprise animation
}

type Particle = {
  readonly x: number
  readonly y: number
  readonly vx: number
  readonly vy: number
  readonly color: string
  readonly alpha: number
  readonly size: number
  readonly life: number
}

// --- Constants ---

const DOOR_VOWELS: readonly DoorVowel[] = ['a', 'e', 'i', 'o', 'u']
const DOOR_COUNT = 5
const DOOR_GAP_RATIO = 0.04
const DOOR_AREA_TOP = 0.18
const DOOR_AREA_BOTTOM = 0.88
const DOOR_ARCH_RATIO = 0.15
const KNOB_RADIUS_RATIO = 0.04
const OPEN_SPEED = 0.06
const CLOSE_SPEED = 0.03
const SURPRISE_DURATION = 2.0 // seconds
const SURPRISE_DURATION_FRAMES = Math.round(SURPRISE_DURATION * 60)
const LABEL_FONT_RATIO = 0.35
const BORDER_WIDTH = 3

const FIREWORK_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#f97316']
const BUTTERFLY_COLORS = ['#f472b6', '#c084fc', '#67e8f9', '#fbbf24', '#a78bfa']
const STAR_COLORS = ['#fbbf24', '#fde047', '#f59e0b', '#fcd34d', '#facc15']
const BUBBLE_COLORS = ['#93c5fd', '#a5b4fc', '#c4b5fd', '#67e8f9', '#7dd3fc']

// --- Pure helper functions ---

const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min)

const createInitialDoors = (): readonly DoorState[] =>
  DOOR_VOWELS.map((vowel) => ({
    vowel,
    color: vowelColors[vowel] ?? colors.primary,
    openAmount: 0,
    isOpening: false,
    surpriseTime: 0,
    surpriseFrame: 0,
  }))

const computeDoorLayout = (
  index: number,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } => {
  const gap = width * DOOR_GAP_RATIO
  const totalGap = gap * (DOOR_COUNT + 1)
  const doorW = (width - totalGap) / DOOR_COUNT
  const doorX = gap + index * (doorW + gap)
  const doorY = height * DOOR_AREA_TOP
  const doorH = height * (DOOR_AREA_BOTTOM - DOOR_AREA_TOP)
  return { x: doorX, y: doorY, w: doorW, h: doorH }
}

// --- Surprise particle generators ---

const createFireworkParticles = (cx: number, cy: number): Particle[] => {
  const particles: Particle[] = []
  const count = 18
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + randomBetween(-0.2, 0.2)
    const speed = randomBetween(1.5, 4)
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
      alpha: 1,
      size: randomBetween(3, 7),
      life: 1,
    })
  }
  return particles
}

const createButterflyParticles = (cx: number, cy: number, h: number): Particle[] => {
  const particles: Particle[] = []
  const count = 8
  for (let i = 0; i < count; i++) {
    particles.push({
      x: cx + randomBetween(-20, 20),
      y: cy + randomBetween(0, h * 0.5),
      vx: randomBetween(-0.8, 0.8),
      vy: randomBetween(-2, -0.8),
      color: BUTTERFLY_COLORS[Math.floor(Math.random() * BUTTERFLY_COLORS.length)],
      alpha: 1,
      size: randomBetween(6, 12),
      life: 1,
    })
  }
  return particles
}

const createStarParticles = (cx: number, cy: number, w: number): Particle[] => {
  const particles: Particle[] = []
  const count = 15
  for (let i = 0; i < count; i++) {
    particles.push({
      x: cx + randomBetween(-w * 0.4, w * 0.4),
      y: cy - randomBetween(10, 40),
      vx: randomBetween(-0.5, 0.5),
      vy: randomBetween(1, 3),
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      alpha: 1,
      size: randomBetween(4, 8),
      life: 1,
    })
  }
  return particles
}

const createBubbleParticles = (cx: number, cy: number, h: number): Particle[] => {
  const particles: Particle[] = []
  const count = 10
  for (let i = 0; i < count; i++) {
    particles.push({
      x: cx + randomBetween(-15, 15),
      y: cy + randomBetween(0, h * 0.5),
      vx: randomBetween(-0.3, 0.3),
      vy: randomBetween(-2.5, -1),
      color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)],
      alpha: 0.85,
      size: randomBetween(5, 14),
      life: 1,
    })
  }
  return particles
}

const updateParticle = (p: Particle): Particle => ({
  ...p,
  x: p.x + p.vx,
  y: p.y + p.vy,
  alpha: Math.max(0, p.alpha - 0.008),
  life: Math.max(0, p.life - 0.008),
})

const isParticleAlive = (p: Particle): boolean => p.life > 0 && p.alpha > 0

// --- Drawing functions ---

const drawDoorShape = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  archH: number,
  fillColor: string,
  strokeColor: string,
): void => {
  ctx.beginPath()
  ctx.moveTo(x, y + h)
  ctx.lineTo(x, y + archH)
  ctx.arcTo(x, y, x + w / 2, y, archH)
  ctx.arcTo(x + w, y, x + w, y + archH, archH)
  ctx.lineTo(x + w, y + h)
  ctx.closePath()

  ctx.fillStyle = fillColor
  ctx.fill()
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = BORDER_WIDTH
  ctx.stroke()
}

const drawDoorKnob = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  knobR: number,
): void => {
  const knobX = x + w * 0.75
  const knobY = y + h * 0.52
  ctx.beginPath()
  ctx.arc(knobX, knobY, knobR, 0, Math.PI * 2)
  ctx.fillStyle = '#d4af37'
  ctx.fill()
  ctx.strokeStyle = '#b8960c'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Knob highlight
  ctx.beginPath()
  ctx.arc(knobX - knobR * 0.25, knobY - knobR * 0.25, knobR * 0.35, 0, Math.PI * 2)
  ctx.fillStyle = withAlpha('#ffffff', 0.5)
  ctx.fill()
}

const drawVowelLabel = (
  ctx: CanvasRenderingContext2D,
  vowel: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize: number,
): void => {
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = withAlpha('#ffffff', 0.9)
  ctx.fillText(vowel.toUpperCase(), x + w / 2, y + h * 0.45)
}

const drawClosedDoor = (
  ctx: CanvasRenderingContext2D,
  door: DoorState,
  index: number,
  width: number,
  height: number,
): void => {
  const { x, y, w, h } = computeDoorLayout(index, width, height)
  const archH = h * DOOR_ARCH_RATIO
  const knobR = w * KNOB_RADIUS_RATIO

  drawDoorShape(ctx, x, y, w, h, archH, door.color, withAlpha(door.color, 0.7))
  drawDoorKnob(ctx, x, y, w, h, knobR)
  drawVowelLabel(ctx, door.vowel, x, y, w, h, w * LABEL_FONT_RATIO)
}

const drawSurpriseBackground = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  archH: number,
  color: string,
): void => {
  // Draw the opening behind the door as a lighter rectangle
  ctx.beginPath()
  ctx.moveTo(x, y + h)
  ctx.lineTo(x, y + archH)
  ctx.arcTo(x, y, x + w / 2, y, archH)
  ctx.arcTo(x + w, y, x + w, y + archH, archH)
  ctx.lineTo(x + w, y + h)
  ctx.closePath()

  ctx.fillStyle = withAlpha(color, 0.12)
  ctx.fill()
  ctx.strokeStyle = withAlpha(color, 0.4)
  ctx.lineWidth = BORDER_WIDTH
  ctx.stroke()
}

const drawOpeningDoor = (
  ctx: CanvasRenderingContext2D,
  door: DoorState,
  index: number,
  width: number,
  height: number,
): void => {
  const { x, y, w, h } = computeDoorLayout(index, width, height)
  const archH = h * DOOR_ARCH_RATIO
  const openAmount = door.openAmount

  // Draw the surprise background behind the door
  drawSurpriseBackground(ctx, x, y, w, h, archH, door.color)

  // Draw the door panel, shrinking horizontally to simulate opening
  const shrunkW = w * (1 - openAmount * 0.8)
  const doorX = x + (w - shrunkW) // door hinges on left, opens right
  const knobR = shrunkW * KNOB_RADIUS_RATIO

  // Slightly darken the door as it opens for a 3D feel
  const darken = withAlpha('#000000', openAmount * 0.15)

  ctx.save()
  drawDoorShape(ctx, doorX, y, shrunkW, h, archH * (1 - openAmount * 0.3), door.color, withAlpha(door.color, 0.7))

  // Darken overlay
  ctx.beginPath()
  ctx.moveTo(doorX, y + h)
  ctx.lineTo(doorX, y + archH)
  ctx.arcTo(doorX, y, doorX + shrunkW / 2, y, archH * (1 - openAmount * 0.3))
  ctx.arcTo(doorX + shrunkW, y, doorX + shrunkW, y + archH, archH * (1 - openAmount * 0.3))
  ctx.lineTo(doorX + shrunkW, y + h)
  ctx.closePath()
  ctx.fillStyle = darken
  ctx.fill()

  if (openAmount < 0.6) {
    drawDoorKnob(ctx, doorX, y, shrunkW, h, knobR)
    drawVowelLabel(ctx, door.vowel, doorX, y, shrunkW, h, shrunkW * LABEL_FONT_RATIO)
  }
  ctx.restore()
}

const drawFireworkParticle = (ctx: CanvasRenderingContext2D, p: Particle): void => {
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
  ctx.fillStyle = withAlpha(p.color, p.alpha)
  ctx.fill()
}

const drawButterflyParticle = (ctx: CanvasRenderingContext2D, p: Particle, frame: number): void => {
  const wingFlap = Math.sin(frame * 0.15 + p.x) * 4
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.fillStyle = withAlpha(p.color, p.alpha)

  // Left wing
  ctx.beginPath()
  ctx.ellipse(-p.size * 0.4, 0, p.size * 0.5, p.size * 0.3 + wingFlap * 0.3, -0.3, 0, Math.PI * 2)
  ctx.fill()

  // Right wing
  ctx.beginPath()
  ctx.ellipse(p.size * 0.4, 0, p.size * 0.5, p.size * 0.3 + wingFlap * 0.3, 0.3, 0, Math.PI * 2)
  ctx.fill()

  // Body
  ctx.beginPath()
  ctx.ellipse(0, 0, p.size * 0.12, p.size * 0.4, 0, 0, Math.PI * 2)
  ctx.fillStyle = withAlpha('#4a3728', p.alpha)
  ctx.fill()
  ctx.restore()
}

const drawStarParticle = (ctx: CanvasRenderingContext2D, p: Particle, frame: number): void => {
  const rotation = frame * 0.03 + p.x * 0.01
  const points = 5
  const outerR = p.size
  const innerR = p.size * 0.45

  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(rotation)
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI * i) / points - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    if (i === 0) {
      ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r)
    } else {
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r)
    }
  }
  ctx.closePath()
  ctx.fillStyle = withAlpha(p.color, p.alpha)
  ctx.fill()
  ctx.restore()
}

const drawRainbow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  progress: number,
): void => {
  const rainbowColors = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#3b82f6', '#8b5cf6', '#a855f7']
  const cx = x + w / 2
  const cy = y + h * 0.8
  const maxRadius = w * 0.45
  const bandWidth = maxRadius / (rainbowColors.length + 2)
  const drawAngle = Math.PI * Math.min(progress, 1)

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()

  for (let i = 0; i < rainbowColors.length; i++) {
    const radius = maxRadius - i * bandWidth
    ctx.beginPath()
    ctx.arc(cx, cy, radius, Math.PI, Math.PI + drawAngle, false)
    ctx.strokeStyle = withAlpha(rainbowColors[i], 0.8)
    ctx.lineWidth = bandWidth * 0.9
    ctx.lineCap = 'round'
    ctx.stroke()
  }
  ctx.restore()
}

const drawBubbleParticle = (ctx: CanvasRenderingContext2D, p: Particle): void => {
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
  ctx.fillStyle = withAlpha(p.color, p.alpha * 0.4)
  ctx.fill()
  ctx.strokeStyle = withAlpha(p.color, p.alpha * 0.7)
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Highlight
  ctx.beginPath()
  ctx.arc(p.x - p.size * 0.25, p.y - p.size * 0.25, p.size * 0.25, 0, Math.PI * 2)
  ctx.fillStyle = withAlpha('#ffffff', p.alpha * 0.6)
  ctx.fill()
}

// --- Styling functions ---

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

// --- Main game factory ---

export const createDoors = (): Game => {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let animationId: number | null = null
  let resizeHandler: (() => void) | null = null

  let doors: DoorState[] = [...createInitialDoors()]
  // Per-door particle arrays for surprises
  let doorParticles: Particle[][] = DOOR_VOWELS.map(() => [])
  // Track whether we already spawned particles for the current opening
  let particlesSpawned: boolean[] = DOOR_VOWELS.map(() => false)

  const triggerDoorOpen = (index: number): void => {
    const door = doors[index]
    if (door.isOpening) return // already opening

    doors[index] = {
      ...door,
      isOpening: true,
      surpriseTime: SURPRISE_DURATION_FRAMES,
      surpriseFrame: 0,
    }
    particlesSpawned[index] = false
  }

  const updateDoors = (): void => {
    doors = doors.map((door, i) => {
      if (door.isOpening) {
        const newOpen = Math.min(1, door.openAmount + OPEN_SPEED)
        const newSurpriseTime = door.surpriseTime - 1
        const newSurpriseFrame = door.surpriseFrame + 1

        // Spawn particles once the door is sufficiently open
        if (newOpen > 0.4 && !particlesSpawned[i]) {
          const layout = computeDoorLayout(i, width, height)
          const cx = layout.x + layout.w / 2
          const cy = layout.y + layout.h / 2

          switch (door.vowel) {
            case 'a':
              doorParticles[i] = createFireworkParticles(cx, cy)
              break
            case 'e':
              doorParticles[i] = createButterflyParticles(cx, cy, layout.h)
              break
            case 'i':
              doorParticles[i] = createStarParticles(cx, layout.y, layout.w)
              break
            case 'o':
              // Rainbow doesn't use particles, handled in draw
              doorParticles[i] = []
              break
            case 'u':
              doorParticles[i] = createBubbleParticles(cx, cy, layout.h)
              break
          }
          particlesSpawned[i] = true
        }

        if (newSurpriseTime <= 0) {
          // Start closing
          return {
            ...door,
            openAmount: newOpen,
            isOpening: false,
            surpriseTime: 0,
            surpriseFrame: newSurpriseFrame,
          }
        }

        return {
          ...door,
          openAmount: newOpen,
          surpriseTime: newSurpriseTime,
          surpriseFrame: newSurpriseFrame,
        }
      }

      // Door is closing
      if (door.openAmount > 0) {
        const newOpen = Math.max(0, door.openAmount - CLOSE_SPEED)
        if (newOpen === 0) {
          doorParticles[i] = []
          particlesSpawned[i] = false
        }
        return {
          ...door,
          openAmount: newOpen,
          surpriseFrame: door.surpriseFrame + 1,
        }
      }

      return door
    })

    // Update all particles
    doorParticles = doorParticles.map((particles) =>
      particles.map(updateParticle).filter(isParticleAlive),
    )
  }

  const drawSurprises = (): void => {
    if (!ctx) return

    for (let i = 0; i < DOOR_COUNT; i++) {
      const door = doors[i]
      if (door.openAmount < 0.3) continue

      const layout = computeDoorLayout(i, width, height)

      // Clip surprise rendering to the door area
      ctx.save()
      const archH = layout.h * DOOR_ARCH_RATIO
      ctx.beginPath()
      ctx.moveTo(layout.x, layout.y + layout.h)
      ctx.lineTo(layout.x, layout.y + archH)
      ctx.arcTo(layout.x, layout.y, layout.x + layout.w / 2, layout.y, archH)
      ctx.arcTo(layout.x + layout.w, layout.y, layout.x + layout.w, layout.y + archH, archH)
      ctx.lineTo(layout.x + layout.w, layout.y + layout.h)
      ctx.closePath()
      ctx.clip()

      switch (door.vowel) {
        case 'a':
          for (const p of doorParticles[i]) {
            drawFireworkParticle(ctx, p)
          }
          break
        case 'e':
          for (const p of doorParticles[i]) {
            drawButterflyParticle(ctx, p, door.surpriseFrame)
          }
          break
        case 'i':
          for (const p of doorParticles[i]) {
            drawStarParticle(ctx, p, door.surpriseFrame)
          }
          break
        case 'o': {
          const progress = Math.min(1, door.surpriseFrame / 40)
          drawRainbow(ctx, layout.x, layout.y, layout.w, layout.h, progress)
          break
        }
        case 'u':
          for (const p of doorParticles[i]) {
            drawBubbleParticle(ctx, p)
          }
          break
      }

      ctx.restore()
    }
  }

  const drawFloor = (): void => {
    if (!ctx) return
    const floorY = height * DOOR_AREA_BOTTOM
    ctx.fillStyle = withAlpha(colors.muted, 0.15)
    ctx.fillRect(0, floorY, width, height - floorY)
    ctx.strokeStyle = withAlpha(colors.muted, 0.25)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, floorY)
    ctx.lineTo(width, floorY)
    ctx.stroke()
  }

  const animate = (): void => {
    if (!ctx) return

    clearCanvas(ctx, width, height)

    // Draw floor
    drawFloor()

    // Update door states and particles
    updateDoors()

    // Draw surprises behind doors (before the door panels)
    drawSurprises()

    // Draw each door
    for (let i = 0; i < DOOR_COUNT; i++) {
      const door = doors[i]
      if (door.openAmount > 0) {
        drawOpeningDoor(ctx, door, i, width, height)
      } else {
        drawClosedDoor(ctx, door, i, width, height)
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

    const title = createElement('p', {}, 'Portes Magiques')
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

    resizeHandler = handleResize
    window.addEventListener('resize', resizeHandler)

    doors = [...createInitialDoors()]
    doorParticles = DOOR_VOWELS.map(() => [])
    particlesSpawned = DOOR_VOWELS.map(() => false)

    animate()
  }

  const update = (features: VoiceFeatures): void => {
    if (!features.isVoicing || features.vowel === null) return

    const vowel = features.vowel as string
    const doorIndex = DOOR_VOWELS.indexOf(vowel as DoorVowel)
    if (doorIndex === -1) return

    // Only trigger if volume is above a minimum threshold
    if (features.volume < 0.05) return

    triggerDoorOpen(doorIndex)
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
    width = 0
    height = 0
    doors = [...createInitialDoors()]
    doorParticles = DOOR_VOWELS.map(() => [])
    particlesSpawned = DOOR_VOWELS.map(() => false)
  }

  return {
    id: 'doors',
    name: 'Portes Magiques',
    description: 'Ouvre les portes magiques avec ta voix !',
    mount,
    unmount,
    update,
  }
}
