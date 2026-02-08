import type { Game } from '../types'
import type { VoiceFeatures } from '../../audio/types'
import type { Vowel } from '../../audio/types'
import { createCanvas, clearCanvas, resizeCanvas } from '../../ui/canvas'
import { vowelColors, withAlpha } from '../../ui/colors'
import { createElement } from '../../ui/dom'

// --- Types ---

type Bubble = {
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly alpha: number
  readonly vy: number
  readonly wobbleOffset: number
  readonly wobbleSpeed: number
}

type CreatureKind = 'fish' | 'seahorse' | 'jellyfish' | 'starfish' | 'octopus'

type Creature = {
  readonly x: number
  readonly y: number
  readonly vx: number
  readonly color: string
  readonly kind: CreatureKind
  readonly age: number
  readonly alpha: number
  readonly size: number
  readonly phaseOffset: number
}

type Seaweed = {
  readonly x: number
  readonly height: number
  readonly segments: number
  readonly phaseOffset: number
}

type Pebble = {
  readonly x: number
  readonly y: number
  readonly rx: number
  readonly ry: number
  readonly color: string
}

// --- Config ---

const ENABLE_CAUSTICS = false

// --- Constants ---

const SAND_HEIGHT_RATIO = 0.1
const SEAWEED_COUNT = 8
const MAX_CREATURES = 20
const MIN_SPAWN_INTERVAL = 500 // ms
const BUBBLE_BASE_RADIUS = 5
const BUBBLE_VOLUME_SCALE = 30
const BUBBLE_RISE_SPEED = -1.5
const BUBBLE_FADE_RATE = 0.004
const CREATURE_FADE_ALPHA = 0.02
const PEBBLE_COUNT = 20
const VOICE_PRESENCE_ATTACK = 0.08  // ~200ms to full presence
const VOICE_PRESENCE_DECAY = 0.02   // ~800ms fade out

const WATER_TOP = '#1a6b8a'
const WATER_BOTTOM = '#0a2a3a'
const SAND_COLOR = '#c2a66b'
const SAND_DARK = '#a08850'
const SEAWEED_COLOR = '#2d8a4e'
const SEAWEED_DARK = '#1d6a3e'

// --- Vowel to creature mapping ---

const vowelCreatureMap: Record<string, CreatureKind> = {
  'a': 'fish',
  'e': 'seahorse',
  'i': 'jellyfish',
  'o': 'starfish',
  'u': 'octopus',
  '\u025B': 'fish',
  'y': 'jellyfish',
}

const vowelSpeedMap: Record<string, number> = {
  'a': 1.8,      // fast swimmer
  'e': 0.5,      // slow vertical bobber
  'i': 0.3,      // drifting jellyfish
  'o': 0.0,      // sits on bottom
  'u': 0.6,      // slow octopus
  '\u025B': 1.2,
  'y': 0.4,
}

// --- Utility ---

const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min)

// --- Background rendering ---

const drawWaterBackground = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, WATER_TOP)
  gradient.addColorStop(1, WATER_BOTTOM)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

const drawCaustics = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  presence: number,
): void => {
  if (!ENABLE_CAUSTICS || presence <= 0) return
  ctx.save()
  ctx.globalAlpha = 0.06 * presence
  const cellSize = 80
  for (let cx = 0; cx < width + cellSize; cx += cellSize) {
    for (let cy = 0; cy < height * 0.6; cy += cellSize) {
      const offsetX = Math.sin(time * 0.001 + cy * 0.01) * 15
      const offsetY = Math.cos(time * 0.0012 + cx * 0.01) * 10
      const radius = 20 + Math.sin(time * 0.002 + cx * 0.02 + cy * 0.015) * 10
      ctx.beginPath()
      ctx.arc(cx + offsetX, cy + offsetY, radius, 0, Math.PI * 2)
      ctx.fillStyle = '#7dd3fc'
      ctx.fill()
    }
  }
  ctx.restore()
}

const drawSandBottom = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void => {
  const sandY = height * (1 - SAND_HEIGHT_RATIO)

  // Sand gradient
  const gradient = ctx.createLinearGradient(0, sandY, 0, height)
  gradient.addColorStop(0, SAND_COLOR)
  gradient.addColorStop(1, SAND_DARK)

  // Slightly wavy top edge
  ctx.beginPath()
  ctx.moveTo(0, height)
  for (let x = 0; x <= width; x += 10) {
    const waveY = sandY + Math.sin(x * 0.03) * 3 + Math.sin(x * 0.07) * 2
    ctx.lineTo(x, waveY)
  }
  ctx.lineTo(width, height)
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()
}

const generatePebbles = (width: number, height: number): Pebble[] => {
  const pebbles: Pebble[] = []
  const sandY = height * (1 - SAND_HEIGHT_RATIO)
  for (let i = 0; i < PEBBLE_COUNT; i++) {
    const gray = Math.floor(randomBetween(100, 170))
    pebbles.push({
      x: randomBetween(10, width - 10),
      y: randomBetween(sandY + 5, height - 5),
      rx: randomBetween(3, 7),
      ry: randomBetween(2, 4),
      color: `rgb(${gray}, ${gray - 10}, ${gray - 20})`,
    })
  }
  return pebbles
}

const drawPebbles = (ctx: CanvasRenderingContext2D, pebbles: Pebble[]): void => {
  for (const p of pebbles) {
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.fill()
  }
}

// --- Seaweed ---

const generateSeaweed = (width: number, height: number): Seaweed[] => {
  const weeds: Seaweed[] = []
  for (let i = 0; i < SEAWEED_COUNT; i++) {
    weeds.push({
      x: randomBetween(30, width - 30),
      height: randomBetween(80, 400),
      segments: Math.floor(randomBetween(6, 12)),
      phaseOffset: randomBetween(0, Math.PI * 2),
    })
  }
  return weeds
}

const drawSeaweed = (
  ctx: CanvasRenderingContext2D,
  weeds: Seaweed[],
  canvasHeight: number,
  time: number,
  presence: number,
): void => {
  const bottomY = canvasHeight * (1 - SAND_HEIGHT_RATIO)

  for (const weed of weeds) {
    const segHeight = weed.height / weed.segments

    ctx.beginPath()
    ctx.moveTo(weed.x, bottomY)

    for (let s = 1; s <= weed.segments; s++) {
      const t = s / weed.segments
      const sway = Math.sin(time * 0.002 + weed.phaseOffset + s * 0.5) * (20 * t) * presence
      const px = weed.x + sway
      const py = bottomY - s * segHeight
      ctx.lineTo(px, py)
    }

    // Draw as thick green line
    ctx.lineWidth = 4
    ctx.strokeStyle = SEAWEED_COLOR
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Draw leaves at some segments
    for (let s = 2; s < weed.segments; s += 2) {
      const t = s / weed.segments
      const sway = Math.sin(time * 0.002 + weed.phaseOffset + s * 0.5) * (20 * t) * presence
      const lx = weed.x + sway
      const ly = bottomY - s * segHeight
      const leafDir = s % 4 === 0 ? 1 : -1

      ctx.beginPath()
      ctx.ellipse(
        lx + leafDir * 8,
        ly,
        10,
        4,
        leafDir * 0.4,
        0,
        Math.PI * 2,
      )
      ctx.fillStyle = SEAWEED_DARK
      ctx.fill()
    }
  }
}

// --- Bubble helpers ---

const spawnBubble = (width: number, height: number, volume: number): Bubble => ({
  x: randomBetween(width * 0.15, width * 0.85),
  y: height * (1 - SAND_HEIGHT_RATIO) - 5,
  radius: BUBBLE_BASE_RADIUS + volume * BUBBLE_VOLUME_SCALE,
  alpha: 0.6,
  vy: BUBBLE_RISE_SPEED - volume * 1.5,
  wobbleOffset: randomBetween(0, Math.PI * 2),
  wobbleSpeed: randomBetween(0.03, 0.06),
})

const updateBubble = (bubble: Bubble, time: number): Bubble => ({
  ...bubble,
  y: bubble.y + bubble.vy,
  x: bubble.x + Math.sin(time * bubble.wobbleSpeed + bubble.wobbleOffset) * 0.5,
  alpha: bubble.alpha - BUBBLE_FADE_RATE,
})

const isBubbleAlive = (bubble: Bubble): boolean =>
  bubble.alpha > 0 && bubble.y > -bubble.radius

const drawBubble = (ctx: CanvasRenderingContext2D, bubble: Bubble, presence: number): void => {
  ctx.save()
  ctx.globalAlpha = bubble.alpha * presence

  // Bubble body
  ctx.beginPath()
  ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2)
  ctx.fillStyle = withAlpha('#a5d8ff', 0.4)
  ctx.fill()
  ctx.strokeStyle = withAlpha('#74c0fc', 0.6)
  ctx.lineWidth = 1
  ctx.stroke()

  // Highlight
  ctx.beginPath()
  ctx.arc(
    bubble.x - bubble.radius * 0.3,
    bubble.y - bubble.radius * 0.3,
    bubble.radius * 0.25,
    0,
    Math.PI * 2,
  )
  ctx.fillStyle = withAlpha('#ffffff', 0.7)
  ctx.fill()

  ctx.restore()
}

// --- Creature drawing ---

const drawFish = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  facingRight: boolean,
  time: number,
): void => {
  const dir = facingRight ? 1 : -1
  ctx.save()

  // Body (oval)
  ctx.beginPath()
  ctx.ellipse(x, y, size * 1.2, size * 0.7, 0, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  // Tail (triangle)
  ctx.beginPath()
  const tailX = x - dir * size * 1.2
  const tailWag = Math.sin(time * 0.008 + x) * 3
  ctx.moveTo(tailX, y)
  ctx.lineTo(tailX - dir * size * 0.7, y - size * 0.5 + tailWag)
  ctx.lineTo(tailX - dir * size * 0.7, y + size * 0.5 + tailWag)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()

  // Eye
  const eyeX = x + dir * size * 0.5
  const eyeY = y - size * 0.15
  ctx.beginPath()
  ctx.arc(eyeX, eyeY, size * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(eyeX + dir * size * 0.05, eyeY, size * 0.1, 0, Math.PI * 2)
  ctx.fillStyle = '#1a1a2e'
  ctx.fill()

  // Dorsal fin
  ctx.beginPath()
  ctx.moveTo(x - dir * size * 0.2, y - size * 0.7)
  ctx.lineTo(x + dir * size * 0.3, y - size * 0.7)
  ctx.lineTo(x + dir * size * 0.1, y - size * 0.35)
  ctx.closePath()
  ctx.fillStyle = withAlpha(color, 0.7)
  ctx.fill()

  ctx.restore()
}

const drawSeahorse = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  time: number,
): void => {
  ctx.save()

  // Head
  ctx.beginPath()
  ctx.arc(x, y - size * 0.8, size * 0.4, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  // Snout
  ctx.beginPath()
  ctx.ellipse(x + size * 0.5, y - size * 0.8, size * 0.25, size * 0.12, 0, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  // Body (curved column of circles)
  const sway = Math.sin(time * 0.003 + x * 0.1) * 3
  for (let i = 0; i < 6; i++) {
    const t = i / 5
    const bx = x + sway * t
    const by = y - size * 0.5 + i * size * 0.3
    const r = size * (0.35 - t * 0.08)
    ctx.beginPath()
    ctx.arc(bx, by, r, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(color, 1 - t * 0.2)
    ctx.fill()
  }

  // Curled tail
  ctx.beginPath()
  const tailBaseX = x + sway * 0.8
  const tailBaseY = y + size * 1.0
  ctx.arc(tailBaseX + size * 0.2, tailBaseY, size * 0.2, 0, Math.PI * 1.5)
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.stroke()

  // Eye
  ctx.beginPath()
  ctx.arc(x + size * 0.15, y - size * 0.9, size * 0.08, 0, Math.PI * 2)
  ctx.fillStyle = '#1a1a2e'
  ctx.fill()

  // Crown/crest
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(x - size * 0.1 + i * size * 0.15, y - size * 1.2, size * 0.06, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(color, 0.7)
    ctx.fill()
  }

  ctx.restore()
}

const drawJellyfish = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  time: number,
): void => {
  ctx.save()

  // Pulsing dome
  const pulse = 1 + Math.sin(time * 0.005 + x) * 0.1
  ctx.beginPath()
  ctx.ellipse(x, y, size * 0.8 * pulse, size * 0.5 * pulse, 0, Math.PI, 0)
  ctx.fillStyle = withAlpha(color, 0.6)
  ctx.fill()

  // Inner dome glow
  ctx.beginPath()
  ctx.ellipse(x, y + size * 0.05, size * 0.5 * pulse, size * 0.3 * pulse, 0, Math.PI, 0)
  ctx.fillStyle = withAlpha(color, 0.3)
  ctx.fill()

  // Tentacles
  const tentacleCount = 6
  for (let i = 0; i < tentacleCount; i++) {
    const tx = x - size * 0.6 + (i / (tentacleCount - 1)) * size * 1.2
    ctx.beginPath()
    ctx.moveTo(tx, y)
    const tentacleLen = size * (0.8 + Math.sin(i * 1.5) * 0.3)
    for (let s = 1; s <= 4; s++) {
      const st = s / 4
      const sx = tx + Math.sin(time * 0.004 + i * 0.8 + s * 0.7) * (size * 0.15)
      const sy = y + st * tentacleLen
      ctx.lineTo(sx, sy)
    }
    ctx.strokeStyle = withAlpha(color, 0.5)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  // Small dots on dome
  for (let i = 0; i < 3; i++) {
    const dotX = x - size * 0.3 + i * size * 0.3
    const dotY = y - size * 0.15
    ctx.beginPath()
    ctx.arc(dotX, dotY, size * 0.05, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha('#ffffff', 0.5)
    ctx.fill()
  }

  ctx.restore()
}

const drawStarfish = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void => {
  ctx.save()

  const points = 5
  const outerR = size * 0.9
  const innerR = outerR * 0.4

  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const angle = (Math.PI * i) / points - Math.PI / 2
    const px = x + Math.cos(angle) * r
    const py = y + Math.sin(angle) * r
    if (i === 0) {
      ctx.moveTo(px, py)
    } else {
      ctx.lineTo(px, py)
    }
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()

  // Center dot
  ctx.beginPath()
  ctx.arc(x, y, size * 0.15, 0, Math.PI * 2)
  ctx.fillStyle = withAlpha('#ffffff', 0.4)
  ctx.fill()

  // Dots on arms
  for (let i = 0; i < points; i++) {
    const angle = (Math.PI * 2 * i) / points - Math.PI / 2
    const dotR = outerR * 0.55
    const dx = x + Math.cos(angle) * dotR
    const dy = y + Math.sin(angle) * dotR
    ctx.beginPath()
    ctx.arc(dx, dy, size * 0.06, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha('#ffffff', 0.35)
    ctx.fill()
  }

  ctx.restore()
}

const drawOctopus = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  time: number,
): void => {
  ctx.save()

  // Head
  ctx.beginPath()
  ctx.arc(x, y - size * 0.3, size * 0.6, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  // Eyes
  ctx.beginPath()
  ctx.arc(x - size * 0.2, y - size * 0.4, size * 0.12, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + size * 0.2, y - size * 0.4, size * 0.12, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  // Pupils
  ctx.beginPath()
  ctx.arc(x - size * 0.18, y - size * 0.38, size * 0.06, 0, Math.PI * 2)
  ctx.fillStyle = '#1a1a2e'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + size * 0.22, y - size * 0.38, size * 0.06, 0, Math.PI * 2)
  ctx.fillStyle = '#1a1a2e'
  ctx.fill()

  // 4 wavy legs
  const legCount = 4
  for (let i = 0; i < legCount; i++) {
    const legStartX = x - size * 0.45 + (i / (legCount - 1)) * size * 0.9
    ctx.beginPath()
    ctx.moveTo(legStartX, y + size * 0.1)

    for (let s = 1; s <= 5; s++) {
      const st = s / 5
      const waveX = legStartX + Math.sin(time * 0.004 + i * 1.2 + s * 0.8) * (size * 0.2)
      const waveY = y + size * 0.1 + st * size * 0.9
      ctx.lineTo(waveX, waveY)
    }
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  // Smile
  ctx.beginPath()
  ctx.arc(x, y - size * 0.15, size * 0.15, 0.1, Math.PI - 0.1)
  ctx.strokeStyle = withAlpha('#1a1a2e', 0.5)
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.restore()
}

const drawCreature = (
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  time: number,
  presence: number,
): void => {
  ctx.save()
  ctx.globalAlpha = creature.alpha * presence

  switch (creature.kind) {
    case 'fish':
      drawFish(ctx, creature.x, creature.y, creature.size, creature.color, creature.vx > 0, time)
      break
    case 'seahorse':
      drawSeahorse(ctx, creature.x, creature.y, creature.size, creature.color, time)
      break
    case 'jellyfish':
      drawJellyfish(ctx, creature.x, creature.y, creature.size, creature.color, time)
      break
    case 'starfish':
      drawStarfish(ctx, creature.x, creature.y, creature.size, creature.color)
      break
    case 'octopus':
      drawOctopus(ctx, creature.x, creature.y, creature.size, creature.color, time)
      break
  }

  ctx.restore()
}

// --- Creature spawning ---

const spawnCreature = (
  vowel: Vowel,
  width: number,
  height: number,
): Creature => {
  const kind = vowelCreatureMap[vowel] ?? 'fish'
  const color = vowelColors[vowel] ?? '#6366f1'
  const speed = vowelSpeedMap[vowel] ?? 1.0
  const sandY = height * (1 - SAND_HEIGHT_RATIO)
  const size = randomBetween(14, 22)

  const direction = Math.random() > 0.5 ? 1 : -1
  const startX = direction > 0 ? -size * 2 : width + size * 2

  // Position depends on creature kind
  let startY: number
  switch (kind) {
    case 'starfish':
      startY = sandY - size * 0.5
      break
    case 'jellyfish':
      startY = randomBetween(height * 0.15, height * 0.5)
      break
    case 'seahorse':
      startY = randomBetween(height * 0.3, height * 0.6)
      break
    case 'octopus':
      startY = randomBetween(height * 0.5, sandY - size * 1.5)
      break
    default:
      startY = randomBetween(height * 0.15, sandY - size * 2)
  }

  return {
    x: kind === 'starfish' ? randomBetween(size * 2, width - size * 2) : startX,
    y: startY,
    vx: kind === 'starfish' ? 0 : speed * direction,
    color,
    kind,
    age: 0,
    alpha: kind === 'starfish' ? 0 : 1, // starfish fade in
    size,
    phaseOffset: randomBetween(0, Math.PI * 2),
  }
}

const updateCreature = (
  creature: Creature,
  time: number,
  width: number,
): Creature => {
  const newAge = creature.age + 1

  // Gentle vertical bobbing for swimming creatures
  const bob = creature.kind !== 'starfish'
    ? Math.sin(time * 0.003 + creature.phaseOffset) * 0.3
    : 0

  let newX = creature.x + creature.vx
  let newVx = creature.vx

  // Bounce off edges for non-starfish
  if (creature.kind !== 'starfish') {
    if (newX < -creature.size * 3) {
      newX = -creature.size * 3
      newVx = Math.abs(creature.vx)
    } else if (newX > width + creature.size * 3) {
      newX = width + creature.size * 3
      newVx = -Math.abs(creature.vx)
    }
  }

  // Starfish fade in
  let newAlpha = creature.alpha
  if (creature.kind === 'starfish' && creature.alpha < 1) {
    newAlpha = Math.min(1, creature.alpha + 0.02)
  }

  return {
    ...creature,
    x: newX,
    y: creature.y + bob,
    vx: newVx,
    age: newAge,
    alpha: newAlpha,
  }
}

const isCreatureOnScreen = (creature: Creature, width: number): boolean => {
  if (creature.kind === 'starfish') return true
  return creature.x > -creature.size * 4 && creature.x < width + creature.size * 4
}

// --- Fade out oldest creatures when over max ---

const fadeOldestCreatures = (creatures: Creature[], max: number): Creature[] => {
  if (creatures.length <= max) return creatures

  return creatures
    .map((c, i) => {
      if (i < creatures.length - max) {
        return { ...c, alpha: c.alpha - CREATURE_FADE_ALPHA }
      }
      return c
    })
    .filter(c => c.alpha > 0)
}

// --- Styling helpers ---

const styleWrapper = (el: HTMLElement): void => {
  Object.assign(el.style, {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: WATER_BOTTOM,
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
    color: '#7dd3fc',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '8px 12px',
    borderRadius: '8px',
    backgroundColor: withAlpha('#0a2a3a', 0.7),
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
    color: withAlpha('#7dd3fc', 0.7),
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
    color: '#7dd3fc',
    margin: '0',
    padding: '8px 12px',
    fontFamily: 'inherit',
    borderRadius: '8px',
    backgroundColor: withAlpha('#0a2a3a', 0.7),
    backdropFilter: 'blur(4px)',
    pointerEvents: 'none',
  })
}

// --- Main game factory ---

export const createAquarium = (): Game => {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let animationId: number | null = null
  let resizeHandler: (() => void) | null = null

  let bubbles: Bubble[] = []
  let creatures: Creature[] = []
  let seaweed: Seaweed[] = []
  let pebbles: Pebble[] = []
  let counterEl: HTMLElement | null = null

  let lastSpawnTime = 0
  let bubbleSpawnCounter = 0
  let time = 0
  let voicePresence = 0
  let isCurrentlyVoicing = false

  const BUBBLE_SPAWN_THRESHOLD = 4

  const handleResize = (): void => {
    if (!canvas || !ctx) return
    const size = resizeCanvas(canvas, ctx)
    width = size.width
    height = size.height
    seaweed = generateSeaweed(width, height)
    pebbles = generatePebbles(width, height)
  }

  const drawScene = (): void => {
    if (!ctx) return

    clearCanvas(ctx, width, height)

    // Water background
    drawWaterBackground(ctx, width, height)

    // Caustic light patterns
    drawCaustics(ctx, width, height, time, voicePresence)

    // Sandy bottom
    drawSandBottom(ctx, width, height)

    // Pebbles
    drawPebbles(ctx, pebbles)

    // Seaweed (behind creatures)
    drawSeaweed(ctx, seaweed, height, time, voicePresence)

    // Creatures
    for (const creature of creatures) {
      drawCreature(ctx, creature, time, voicePresence)
    }

    // Bubbles (in front of everything)
    for (const bubble of bubbles) {
      drawBubble(ctx, bubble, voicePresence)
    }
  }

  const animate = (): void => {
    time = performance.now()

    voicePresence = isCurrentlyVoicing
      ? Math.min(1, voicePresence + VOICE_PRESENCE_ATTACK)
      : Math.max(0, voicePresence - VOICE_PRESENCE_DECAY)

    // Update bubbles
    bubbles = bubbles
      .map(b => updateBubble(b, time))
      .filter(isBubbleAlive)

    // Update creatures
    creatures = creatures
      .map(c => updateCreature(c, time, width))
      .filter(c => isCreatureOnScreen(c, width))

    // Fade oldest if over limit
    creatures = fadeOldestCreatures(creatures, MAX_CREATURES)

    // Update counter display
    if (counterEl) {
      counterEl.textContent = `${creatures.length}`
    }

    drawScene()
    animationId = requestAnimationFrame(animate)
  }

  const mount = (container: HTMLElement): void => {
    const wrapper = createElement('div', {})
    styleWrapper(wrapper)

    const backButton = createElement('button', {}, '\u2190 Accueil')
    styleBackButton(backButton)
    backButton.addEventListener('click', () => {
      window.location.hash = '#menu'
    })

    const title = createElement('p', {}, 'Aquarium')
    styleTitle(title)

    counterEl = createElement('p', {}, '0')
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

    seaweed = generateSeaweed(width, height)
    pebbles = generatePebbles(width, height)

    resizeHandler = handleResize
    window.addEventListener('resize', resizeHandler)

    bubbles = []
    creatures = []
    lastSpawnTime = 0
    bubbleSpawnCounter = 0
    time = 0

    animate()
  }

  const update = (features: VoiceFeatures): void => {
    isCurrentlyVoicing = features.isVoicing
    const now = performance.now()

    // Spawn bubbles when voicing
    if (features.isVoicing) {
      bubbleSpawnCounter += 1
      if (bubbleSpawnCounter >= BUBBLE_SPAWN_THRESHOLD) {
        bubbleSpawnCounter = 0
        bubbles.push(spawnBubble(width, height, features.volume))
      }
    } else {
      bubbleSpawnCounter = 0
    }

    // Spawn creature when vowel detected, respecting cooldown
    if (
      features.isVoicing &&
      features.vowel !== null &&
      now - lastSpawnTime >= MIN_SPAWN_INTERVAL
    ) {
      creatures.push(spawnCreature(features.vowel, width, height))
      lastSpawnTime = now
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
    width = 0
    height = 0
    bubbles = []
    creatures = []
    seaweed = []
    pebbles = []
    lastSpawnTime = 0
    bubbleSpawnCounter = 0
    time = 0
    voicePresence = 0
    isCurrentlyVoicing = false
  }

  return {
    id: 'aquarium',
    name: 'Aquarium',
    description: 'Cr\u00e9e ton monde sous-marin avec ta voix',
    mount,
    unmount,
    update,
  }
}
