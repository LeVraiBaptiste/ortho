import type { Game } from '../types'
import type { VoiceFeatures } from '../../audio/types'
import type { Vowel } from '../../audio/types'
import { createCanvas, clearCanvas, resizeCanvas } from '../../ui/canvas'
import { vowelColors, colors, withAlpha } from '../../ui/colors'
import { createElement } from '../../ui/dom'

// --- Types ---

type Particle = {
  readonly x: number
  readonly y: number
  readonly vx: number
  readonly vy: number
  readonly alpha: number
  readonly size: number
  readonly kind: 'heart' | 'star'
  readonly color: string
}

type AnimalDef = {
  readonly name: string
  readonly vowel: Vowel
  readonly label: string
  readonly draw: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
  ) => void
}

type AnimalState = {
  scale: number
  targetScale: number
  glowAlpha: number
  feedCount: number
  particles: Particle[]
}

// --- Constants ---

const BOUNCE_SCALE = 1.3
const SCALE_DECAY = 0.06
const GLOW_DECAY = 0.03
const GLOW_INTENSITY = 0.6
const PARTICLE_COUNT = 6
const PARTICLE_SPEED = 2.5
const PARTICLE_FADE = 0.015
const PARTICLE_SIZE = 10
const ANIMAL_SIZE = 50
const VOICING_FRAMES_THRESHOLD = 4

// --- Drawing helpers ---

const drawTriangle = (
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  color: string,
): void => {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x3, y3)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

const drawEllipse = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
): void => {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

const drawFilledCircle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void => {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

// --- Animal drawing functions ---

const drawCat = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void => {
  // Head
  drawFilledCircle(ctx, x, y, size, color)

  // Ears (triangles)
  drawTriangle(
    ctx,
    x - size * 0.7, y - size * 0.4,
    x - size * 0.35, y - size * 1.15,
    x - size * 0.05, y - size * 0.55,
    color,
  )
  drawTriangle(
    ctx,
    x + size * 0.05, y - size * 0.55,
    x + size * 0.35, y - size * 1.15,
    x + size * 0.7, y - size * 0.4,
    color,
  )

  // Inner ears
  const innerColor = withAlpha('#fca5a5', 0.8)
  drawTriangle(
    ctx,
    x - size * 0.58, y - size * 0.48,
    x - size * 0.38, y - size * 0.95,
    x - size * 0.15, y - size * 0.58,
    innerColor,
  )
  drawTriangle(
    ctx,
    x + size * 0.15, y - size * 0.58,
    x + size * 0.38, y - size * 0.95,
    x + size * 0.58, y - size * 0.48,
    innerColor,
  )

  // Eyes
  drawFilledCircle(ctx, x - size * 0.3, y - size * 0.15, size * 0.13, '#2d3748')
  drawFilledCircle(ctx, x + size * 0.3, y - size * 0.15, size * 0.13, '#2d3748')

  // Eye shine
  drawFilledCircle(ctx, x - size * 0.26, y - size * 0.2, size * 0.045, '#ffffff')
  drawFilledCircle(ctx, x + size * 0.34, y - size * 0.2, size * 0.045, '#ffffff')

  // Nose
  drawTriangle(
    ctx,
    x, y + size * 0.05,
    x - size * 0.08, y + size * 0.15,
    x + size * 0.08, y + size * 0.15,
    '#f472b6',
  )

  // Mouth
  ctx.beginPath()
  ctx.moveTo(x, y + size * 0.15)
  ctx.lineTo(x - size * 0.12, y + size * 0.3)
  ctx.moveTo(x, y + size * 0.15)
  ctx.lineTo(x + size * 0.12, y + size * 0.3)
  ctx.strokeStyle = '#2d3748'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Whiskers
  ctx.beginPath()
  ctx.moveTo(x - size * 0.3, y + size * 0.1)
  ctx.lineTo(x - size * 0.85, y + size * 0.0)
  ctx.moveTo(x - size * 0.3, y + size * 0.2)
  ctx.lineTo(x - size * 0.85, y + size * 0.25)
  ctx.moveTo(x + size * 0.3, y + size * 0.1)
  ctx.lineTo(x + size * 0.85, y + size * 0.0)
  ctx.moveTo(x + size * 0.3, y + size * 0.2)
  ctx.lineTo(x + size * 0.85, y + size * 0.25)
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 1.2
  ctx.stroke()
}

const drawOwl = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void => {
  // Body
  drawFilledCircle(ctx, x, y, size, color)

  // Belly
  drawFilledCircle(ctx, x, y + size * 0.2, size * 0.6, withAlpha('#fef3c7', 0.9))

  // Big eyes (white ring + dark pupil)
  const eyeRadius = size * 0.3
  drawFilledCircle(ctx, x - size * 0.32, y - size * 0.15, eyeRadius, '#ffffff')
  drawFilledCircle(ctx, x + size * 0.32, y - size * 0.15, eyeRadius, '#ffffff')

  // Pupils
  drawFilledCircle(ctx, x - size * 0.32, y - size * 0.15, eyeRadius * 0.55, '#2d3748')
  drawFilledCircle(ctx, x + size * 0.32, y - size * 0.15, eyeRadius * 0.55, '#2d3748')

  // Eye shine
  drawFilledCircle(ctx, x - size * 0.26, y - size * 0.22, eyeRadius * 0.2, '#ffffff')
  drawFilledCircle(ctx, x + size * 0.38, y - size * 0.22, eyeRadius * 0.2, '#ffffff')

  // Eye ring outline
  ctx.beginPath()
  ctx.arc(x - size * 0.32, y - size * 0.15, eyeRadius, 0, Math.PI * 2)
  ctx.strokeStyle = withAlpha('#2d3748', 0.3)
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + size * 0.32, y - size * 0.15, eyeRadius, 0, Math.PI * 2)
  ctx.stroke()

  // Beak (small triangle)
  drawTriangle(
    ctx,
    x, y + size * 0.05,
    x - size * 0.1, y + size * 0.2,
    x + size * 0.1, y + size * 0.2,
    '#f59e0b',
  )

  // Ear tufts
  drawTriangle(
    ctx,
    x - size * 0.55, y - size * 0.65,
    x - size * 0.35, y - size * 1.1,
    x - size * 0.15, y - size * 0.65,
    color,
  )
  drawTriangle(
    ctx,
    x + size * 0.15, y - size * 0.65,
    x + size * 0.35, y - size * 1.1,
    x + size * 0.55, y - size * 0.65,
    color,
  )
}

const drawMouse = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void => {
  // Body (small circle)
  drawFilledCircle(ctx, x, y, size * 0.85, color)

  // Big round ears
  drawFilledCircle(ctx, x - size * 0.6, y - size * 0.7, size * 0.5, color)
  drawFilledCircle(ctx, x + size * 0.6, y - size * 0.7, size * 0.5, color)

  // Inner ears
  drawFilledCircle(ctx, x - size * 0.6, y - size * 0.7, size * 0.32, withAlpha('#fca5a5', 0.7))
  drawFilledCircle(ctx, x + size * 0.6, y - size * 0.7, size * 0.32, withAlpha('#fca5a5', 0.7))

  // Eyes
  drawFilledCircle(ctx, x - size * 0.25, y - size * 0.15, size * 0.12, '#2d3748')
  drawFilledCircle(ctx, x + size * 0.25, y - size * 0.15, size * 0.12, '#2d3748')

  // Eye shine
  drawFilledCircle(ctx, x - size * 0.21, y - size * 0.2, size * 0.04, '#ffffff')
  drawFilledCircle(ctx, x + size * 0.29, y - size * 0.2, size * 0.04, '#ffffff')

  // Nose
  drawFilledCircle(ctx, x, y + size * 0.15, size * 0.1, '#f472b6')

  // Whiskers
  ctx.beginPath()
  ctx.moveTo(x - size * 0.2, y + size * 0.15)
  ctx.lineTo(x - size * 0.75, y + size * 0.05)
  ctx.moveTo(x - size * 0.2, y + size * 0.22)
  ctx.lineTo(x - size * 0.75, y + size * 0.28)
  ctx.moveTo(x + size * 0.2, y + size * 0.15)
  ctx.lineTo(x + size * 0.75, y + size * 0.05)
  ctx.moveTo(x + size * 0.2, y + size * 0.22)
  ctx.lineTo(x + size * 0.75, y + size * 0.28)
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 1
  ctx.stroke()

  // Long tail (curved)
  ctx.beginPath()
  ctx.moveTo(x + size * 0.5, y + size * 0.6)
  ctx.quadraticCurveTo(
    x + size * 1.5, y + size * 0.2,
    x + size * 1.3, y - size * 0.3,
  )
  ctx.strokeStyle = color
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.stroke()
}

const drawBear = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void => {
  // Small round ears
  drawFilledCircle(ctx, x - size * 0.65, y - size * 0.65, size * 0.32, color)
  drawFilledCircle(ctx, x + size * 0.65, y - size * 0.65, size * 0.32, color)

  // Inner ears
  drawFilledCircle(ctx, x - size * 0.65, y - size * 0.65, size * 0.18, withAlpha('#d4a574', 0.8))
  drawFilledCircle(ctx, x + size * 0.65, y - size * 0.65, size * 0.18, withAlpha('#d4a574', 0.8))

  // Head
  drawFilledCircle(ctx, x, y, size, color)

  // Muzzle
  drawEllipse(ctx, x, y + size * 0.15, size * 0.4, size * 0.3, withAlpha('#d4a574', 0.7))

  // Eyes
  drawFilledCircle(ctx, x - size * 0.3, y - size * 0.15, size * 0.11, '#2d3748')
  drawFilledCircle(ctx, x + size * 0.3, y - size * 0.15, size * 0.11, '#2d3748')

  // Eye shine
  drawFilledCircle(ctx, x - size * 0.27, y - size * 0.2, size * 0.04, '#ffffff')
  drawFilledCircle(ctx, x + size * 0.33, y - size * 0.2, size * 0.04, '#ffffff')

  // Nose
  drawEllipse(ctx, x, y + size * 0.05, size * 0.11, size * 0.08, '#2d3748')

  // Mouth
  ctx.beginPath()
  ctx.moveTo(x, y + size * 0.13)
  ctx.lineTo(x - size * 0.08, y + size * 0.25)
  ctx.moveTo(x, y + size * 0.13)
  ctx.lineTo(x + size * 0.08, y + size * 0.25)
  ctx.strokeStyle = '#2d3748'
  ctx.lineWidth = 1.2
  ctx.stroke()
}

const drawBird = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void => {
  // Body (oval)
  drawEllipse(ctx, x, y, size * 0.9, size, color)

  // Belly
  drawEllipse(ctx, x, y + size * 0.2, size * 0.55, size * 0.55, withAlpha('#fef3c7', 0.8))

  // Wing (on the left side)
  ctx.beginPath()
  ctx.ellipse(x - size * 0.55, y - size * 0.05, size * 0.5, size * 0.28, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = withAlpha(color, 0.7)
  ctx.fill()

  // Eye
  drawFilledCircle(ctx, x + size * 0.15, y - size * 0.25, size * 0.12, '#2d3748')

  // Eye shine
  drawFilledCircle(ctx, x + size * 0.19, y - size * 0.3, size * 0.04, '#ffffff')

  // Beak (triangle pointing right)
  drawTriangle(
    ctx,
    x + size * 0.55, y - size * 0.15,
    x + size * 0.55, y + size * 0.05,
    x + size * 0.95, y - size * 0.05,
    '#f59e0b',
  )

  // Small tail feathers
  drawTriangle(
    ctx,
    x - size * 0.7, y - size * 0.3,
    x - size * 1.15, y - size * 0.65,
    x - size * 0.5, y - size * 0.6,
    color,
  )
  drawTriangle(
    ctx,
    x - size * 0.75, y - size * 0.15,
    x - size * 1.25, y - size * 0.35,
    x - size * 0.6, y - size * 0.45,
    withAlpha(color, 0.8),
  )
}

// --- Animal definitions ---

const animalDefs: readonly AnimalDef[] = [
  { name: 'Chat', vowel: 'a', label: 'AAA', draw: drawCat },
  { name: 'Hibou', vowel: 'o', label: 'OOO', draw: drawOwl },
  { name: 'Souris', vowel: 'i', label: 'III', draw: drawMouse },
  { name: 'Ours', vowel: 'u', label: 'UUU', draw: drawBear },
  { name: 'Oiseau', vowel: 'e', label: 'EEE', draw: drawBird },
]

// --- Particle helpers ---

const spawnParticles = (x: number, y: number, color: string): Particle[] => {
  const particles: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.5
    particles.push({
      x,
      y: y - ANIMAL_SIZE, // spawn above the animal
      vx: Math.cos(angle) * PARTICLE_SPEED * (0.7 + Math.random() * 0.6),
      vy: Math.sin(angle) * PARTICLE_SPEED * (0.7 + Math.random() * 0.6) - 1.5,
      alpha: 1,
      size: PARTICLE_SIZE * (0.7 + Math.random() * 0.6),
      kind: Math.random() > 0.5 ? 'heart' : 'star',
      color,
    })
  }
  return particles
}

const updateParticle = (p: Particle): Particle => ({
  ...p,
  x: p.x + p.vx,
  y: p.y + p.vy,
  vy: p.vy + 0.04, // slight gravity
  alpha: p.alpha - PARTICLE_FADE,
})

const isParticleVisible = (p: Particle): boolean => p.alpha > 0

const drawHeart = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
): void => {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  const s = size * 0.5
  ctx.moveTo(x, y + s * 0.3)
  ctx.bezierCurveTo(x, y - s * 0.2, x - s, y - s * 0.5, x - s, y + s * 0.1)
  ctx.bezierCurveTo(x - s, y + s * 0.6, x, y + s * 0.9, x, y + s * 1.1)
  ctx.bezierCurveTo(x, y + s * 0.9, x + s, y + s * 0.6, x + s, y + s * 0.1)
  ctx.bezierCurveTo(x + s, y - s * 0.5, x, y - s * 0.2, x, y + s * 0.3)
  ctx.fill()
  ctx.restore()
}

const drawStar = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
): void => {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  const spikes = 5
  const outerR = size * 0.5
  const innerR = outerR * 0.4
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const angle = (Math.PI * i) / spikes - Math.PI / 2
    const px = x + Math.cos(angle) * r
    const py = y + Math.sin(angle) * r
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

const drawParticle = (ctx: CanvasRenderingContext2D, p: Particle): void => {
  if (p.kind === 'heart') {
    drawHeart(ctx, p.x, p.y, p.size, p.color, p.alpha)
  } else {
    drawStar(ctx, p.x, p.y, p.size, p.color, p.alpha)
  }
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
    color: colors.text,
    margin: '0',
    padding: '8px 16px',
    fontFamily: 'inherit',
    pointerEvents: 'none',
  })
}

// --- Compute animal layout positions ---

const computeAnimalPositions = (
  width: number,
  height: number,
  count: number,
): readonly { x: number; y: number }[] => {
  const spacing = width / (count + 1)
  const centerY = height * 0.42
  const positions: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    positions.push({ x: spacing * (i + 1), y: centerY })
  }
  return positions
}

// --- Main game factory ---

export const createAnimals = (): Game => {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let animationId: number | null = null
  let resizeHandler: (() => void) | null = null

  let animalStates: AnimalState[] = animalDefs.map(() => ({
    scale: 1,
    targetScale: 1,
    glowAlpha: 0,
    feedCount: 0,
    particles: [],
  }))

  let voicingFrames = 0
  let lastFedVowel: Vowel | null = null

  const resetStates = (): void => {
    animalStates = animalDefs.map(() => ({
      scale: 1,
      targetScale: 1,
      glowAlpha: 0,
      feedCount: 0,
      particles: [],
    }))
    voicingFrames = 0
    lastFedVowel = null
  }

  const computeAnimalSize = (): number => {
    const maxByWidth = width / (animalDefs.length * 2.5)
    const maxByHeight = height * 0.15
    return Math.max(25, Math.min(ANIMAL_SIZE, maxByWidth, maxByHeight))
  }

  const drawScene = (): void => {
    if (!ctx) return

    clearCanvas(ctx, width, height)

    // Fill background
    ctx.fillStyle = colors.bg
    ctx.fillRect(0, 0, width, height)

    const positions = computeAnimalPositions(width, height, animalDefs.length)
    const size = computeAnimalSize()

    for (let i = 0; i < animalDefs.length; i++) {
      const def = animalDefs[i]
      const state = animalStates[i]
      const pos = positions[i]
      const animalColor = vowelColors[def.vowel] ?? colors.primary

      ctx.save()

      // Glow effect behind the animal
      if (state.glowAlpha > 0) {
        const glowRadius = size * 1.6 * state.scale
        const gradient = ctx.createRadialGradient(
          pos.x, pos.y, size * 0.3,
          pos.x, pos.y, glowRadius,
        )
        gradient.addColorStop(0, withAlpha(animalColor, state.glowAlpha * 0.5))
        gradient.addColorStop(1, withAlpha(animalColor, 0))
        ctx.fillStyle = gradient
        ctx.fillRect(
          pos.x - glowRadius,
          pos.y - glowRadius,
          glowRadius * 2,
          glowRadius * 2,
        )
      }

      // Apply scale transform for bounce
      ctx.translate(pos.x, pos.y)
      ctx.scale(state.scale, state.scale)
      ctx.translate(-pos.x, -pos.y)

      // Draw the animal
      def.draw(ctx, pos.x, pos.y, size, animalColor)

      ctx.restore()

      // Draw particles
      for (const p of state.particles) {
        drawParticle(ctx, p)
      }

      // Vowel label below animal
      const labelY = pos.y + size * 1.6
      ctx.font = `bold ${Math.round(size * 0.55)}px system-ui, -apple-system, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = animalColor
      ctx.fillText(def.label, pos.x, labelY)

      // Animal name above
      const nameY = pos.y - size * 1.5
      ctx.font = `600 ${Math.round(size * 0.38)}px system-ui, -apple-system, sans-serif`
      ctx.fillStyle = colors.text
      ctx.fillText(def.name, pos.x, nameY)

      // Feed counter at bottom
      const counterY = pos.y + size * 1.6 + size * 0.65
      ctx.font = `600 ${Math.round(size * 0.32)}px system-ui, -apple-system, sans-serif`
      ctx.fillStyle = colors.muted
      ctx.fillText(`${state.feedCount}`, pos.x, counterY)
    }
  }

  const animate = (): void => {
    // Update animal states (scale lerp, glow decay, particles)
    animalStates = animalStates.map((state) => {
      const newScale = state.scale + (state.targetScale - state.scale) * SCALE_DECAY * 3
      const newGlow = Math.max(0, state.glowAlpha - GLOW_DECAY)
      const newParticles = state.particles
        .map(updateParticle)
        .filter(isParticleVisible)

      // Reset target scale back to 1 once close enough
      const newTarget = Math.abs(state.scale - 1) < 0.01 && state.targetScale > 1
        ? 1
        : state.targetScale > 1 && newScale > state.targetScale * 0.95
          ? 1
          : state.targetScale

      return {
        ...state,
        scale: newScale,
        targetScale: newTarget,
        glowAlpha: newGlow,
        particles: newParticles,
      }
    })

    drawScene()
    animationId = requestAnimationFrame(animate)
  }

  const handleResize = (): void => {
    if (!canvas || !ctx) return
    const size = resizeCanvas(canvas, ctx)
    width = size.width
    height = size.height
  }

  const feedAnimal = (index: number): void => {
    const def = animalDefs[index]
    const pos = computeAnimalPositions(width, height, animalDefs.length)[index]
    const animalColor = vowelColors[def.vowel] ?? colors.primary

    animalStates = animalStates.map((state, i) => {
      if (i !== index) return state
      return {
        ...state,
        targetScale: BOUNCE_SCALE,
        glowAlpha: GLOW_INTENSITY,
        feedCount: state.feedCount + 1,
        particles: [
          ...state.particles,
          ...spawnParticles(pos.x, pos.y, animalColor),
        ],
      }
    })
  }

  const mount = (container: HTMLElement): void => {
    const wrapper = createElement('div', {})
    styleWrapper(wrapper)

    const backButton = createElement('button', {}, '\u2190 Accueil')
    styleBackButton(backButton)
    backButton.addEventListener('click', () => {
      window.location.hash = '#menu'
    })

    const title = createElement('p', {}, 'Nourrir les Animaux')
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

    resetStates()
    animate()
  }

  const update = (features: VoiceFeatures): void => {
    if (!features.isVoicing || features.vowel === null) {
      voicingFrames = 0
      lastFedVowel = null
      return
    }

    voicingFrames += 1

    // Only trigger a feed after sustained voicing, and only once per vowel utterance
    if (voicingFrames >= VOICING_FRAMES_THRESHOLD && features.vowel !== lastFedVowel) {
      const index = animalDefs.findIndex((def) => def.vowel === features.vowel)
      if (index !== -1) {
        feedAnimal(index)
        lastFedVowel = features.vowel
      }
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
    width = 0
    height = 0
    resetStates()
  }

  return {
    id: 'animals',
    name: 'Nourrir les Animaux',
    description: 'Nourris les animaux en pronon\u00e7ant la bonne voyelle !',
    mount,
    unmount,
    update,
  }
}
