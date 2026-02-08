import type { Game } from '../types'
import type { VoiceFeatures } from '../../audio/types'
import type { Vowel } from '../../audio/types'
import { createCanvas, clearCanvas, resizeCanvas } from '../../ui/canvas'
import { colors, withAlpha } from '../../ui/colors'
import { createElement } from '../../ui/dom'

// --- Types ---

type Season = 'summer' | 'autumn' | 'winter' | 'spring'

type SeasonTheme = {
  readonly skyTop: string
  readonly skyBottom: string
  readonly groundTop: string
  readonly groundBottom: string
  readonly treeCrown: string
  readonly treeHighlight: string
  readonly label: string
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  rotationSpeed: number
  alpha: number
  color: string
  life: number
  maxLife: number
}

type SceneColors = {
  skyTop: string
  skyBottom: string
  groundTop: string
  groundBottom: string
  treeCrown: string
  treeHighlight: string
}

// --- Constants ---

const GROUND_RATIO = 0.3
const TRUNK_WIDTH_RATIO = 0.035
const TRUNK_HEIGHT_RATIO = 0.3
const CROWN_RADIUS_RATIO = 0.18
const MAX_PARTICLES = 120
const PARTICLE_SPAWN_RATE_BASE = 0.3
const TRANSITION_SPEED = 0.03
const SUN_RADIUS = 40
const SUN_RAY_COUNT = 12

const SEASON_THEMES: Record<Season, SeasonTheme> = {
  summer: {
    skyTop: '#1E90FF',
    skyBottom: '#87CEEB',
    groundTop: '#4CAF50',
    groundBottom: '#2E7D32',
    treeCrown: '#2E8B57',
    treeHighlight: '#3CB371',
    label: 'Été',
  },
  autumn: {
    skyTop: '#E8843C',
    skyBottom: '#F4A460',
    groundTop: '#8B6914',
    groundBottom: '#6B4E0A',
    treeCrown: '#D2691E',
    treeHighlight: '#E25822',
    label: 'Automne',
  },
  winter: {
    skyTop: '#B0B8C8',
    skyBottom: '#D9DEE8',
    groundTop: '#E8E8F0',
    groundBottom: '#CFCFDF',
    treeCrown: '#8B7355',
    treeHighlight: '#A08060',
    label: 'Hiver',
  },
  spring: {
    skyTop: '#89CFF0',
    skyBottom: '#B0E2FF',
    groundTop: '#5DBB63',
    groundBottom: '#3E9142',
    treeCrown: '#FFB7C5',
    treeHighlight: '#FFC0CB',
    label: 'Printemps',
  },
}

const VOWEL_TO_SEASON: Partial<Record<Vowel, Season>> = {
  'a': 'summer',
  'o': 'autumn',
  'i': 'winter',
  'u': 'spring',
}

// --- Pure helpers ---

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min)

const hexToRgb = (hex: string): { r: number; g: number; b: number } => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
})

const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number): string => {
    const clamped = clamp(Math.round(n), 0, 255)
    return clamped.toString(16).padStart(2, '0')
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const lerpColor = (from: string, to: string, t: number): string => {
  const f = hexToRgb(from)
  const c = hexToRgb(to)
  return rgbToHex(
    lerp(f.r, c.r, t),
    lerp(f.g, c.g, t),
    lerp(f.b, c.b, t),
  )
}

const lerpSceneColors = (from: SceneColors, to: SceneColors, t: number): SceneColors => ({
  skyTop: lerpColor(from.skyTop, to.skyTop, t),
  skyBottom: lerpColor(from.skyBottom, to.skyBottom, t),
  groundTop: lerpColor(from.groundTop, to.groundTop, t),
  groundBottom: lerpColor(from.groundBottom, to.groundBottom, t),
  treeCrown: lerpColor(from.treeCrown, to.treeCrown, t),
  treeHighlight: lerpColor(from.treeHighlight, to.treeHighlight, t),
})

const themeToSceneColors = (theme: SeasonTheme): SceneColors => ({
  skyTop: theme.skyTop,
  skyBottom: theme.skyBottom,
  groundTop: theme.groundTop,
  groundBottom: theme.groundBottom,
  treeCrown: theme.treeCrown,
  treeHighlight: theme.treeHighlight,
})

// Neutral scene: a muted, slightly blue scene (between seasons)
const NEUTRAL_COLORS: SceneColors = {
  skyTop: '#7CA8D0',
  skyBottom: '#A8C8E8',
  groundTop: '#6B8E6B',
  groundBottom: '#4A6B4A',
  treeCrown: '#5A8A5A',
  treeHighlight: '#6B9B6B',
}

// --- Particle factories ---

const createLeafParticle = (width: number, height: number, volume: number): Particle => {
  const groundY = height * (1 - GROUND_RATIO)
  const treeTop = groundY - height * TRUNK_HEIGHT_RATIO - height * CROWN_RADIUS_RATIO
  const leafColors = ['#D2691E', '#CD853F', '#B22222', '#DAA520', '#CC5500']
  return {
    x: width * 0.5 + randomBetween(-width * 0.15, width * 0.15),
    y: treeTop + randomBetween(0, height * CROWN_RADIUS_RATIO),
    vx: randomBetween(-1.5, 1.5) * (1 + volume),
    vy: randomBetween(0.3, 1.5),
    size: randomBetween(5, 10),
    rotation: randomBetween(0, Math.PI * 2),
    rotationSpeed: randomBetween(-0.05, 0.05),
    alpha: 1,
    color: leafColors[Math.floor(Math.random() * leafColors.length)],
    life: 0,
    maxLife: randomBetween(120, 250),
  }
}

const createSnowParticle = (width: number, _height: number, volume: number): Particle => {
  const intensity = 0.3 + volume * 0.7
  return {
    x: randomBetween(-20, width + 20),
    y: randomBetween(-30, -5),
    vx: randomBetween(-0.8, 0.8) * intensity,
    vy: randomBetween(0.5, 2.5) * intensity,
    size: randomBetween(2, 6),
    rotation: 0,
    rotationSpeed: 0,
    alpha: randomBetween(0.6, 1),
    color: '#FFFFFF',
    life: 0,
    maxLife: randomBetween(200, 400),
  }
}

const createPetalParticle = (width: number, height: number, volume: number): Particle => {
  const groundY = height * (1 - GROUND_RATIO)
  const treeTop = groundY - height * TRUNK_HEIGHT_RATIO - height * CROWN_RADIUS_RATIO
  const petalColors = ['#FFB7C5', '#FF69B4', '#FFC0CB', '#FFD1DC', '#FADADD']
  return {
    x: width * 0.5 + randomBetween(-width * 0.15, width * 0.15),
    y: treeTop + randomBetween(0, height * CROWN_RADIUS_RATIO * 0.7),
    vx: randomBetween(-1, 2) * (0.5 + volume * 0.5),
    vy: randomBetween(-0.5, 1.2),
    size: randomBetween(4, 8),
    rotation: randomBetween(0, Math.PI * 2),
    rotationSpeed: randomBetween(-0.04, 0.04),
    alpha: 1,
    color: petalColors[Math.floor(Math.random() * petalColors.length)],
    life: 0,
    maxLife: randomBetween(150, 300),
  }
}

const createSummerParticle = (width: number, height: number, volume: number): Particle => {
  // Heat shimmer / light rays
  const shimmerY = randomBetween(height * 0.1, height * 0.6)
  return {
    x: randomBetween(0, width),
    y: shimmerY,
    vx: randomBetween(-0.2, 0.2),
    vy: randomBetween(-1, -0.3) * (0.5 + volume),
    size: randomBetween(2, 5),
    rotation: 0,
    rotationSpeed: 0,
    alpha: randomBetween(0.15, 0.4) * volume,
    color: '#FFD700',
    life: 0,
    maxLife: randomBetween(60, 120),
  }
}

const createButterflyParticle = (width: number, height: number, _volume: number): Particle => {
  const groundY = height * (1 - GROUND_RATIO)
  const butterflyColors = ['#FF6B9D', '#C084FC', '#60A5FA', '#FBBF24', '#FB923C']
  return {
    x: randomBetween(width * 0.1, width * 0.9),
    y: groundY - randomBetween(20, 120),
    vx: randomBetween(-1, 1),
    vy: randomBetween(-1, 0.5),
    size: randomBetween(6, 10),
    rotation: 0,
    rotationSpeed: 0.1,
    alpha: 1,
    color: butterflyColors[Math.floor(Math.random() * butterflyColors.length)],
    life: 0,
    maxLife: randomBetween(200, 400),
  }
}

const createFlowerDecoration = (width: number, height: number): Particle => {
  const groundY = height * (1 - GROUND_RATIO)
  const flowerColors = ['#FF6B9D', '#FBBF24', '#A78BFA', '#F87171', '#34D399']
  return {
    x: randomBetween(width * 0.05, width * 0.95),
    y: groundY + randomBetween(5, height * GROUND_RATIO * 0.5),
    vx: 0,
    vy: 0,
    size: randomBetween(4, 8),
    rotation: randomBetween(0, Math.PI * 2),
    rotationSpeed: 0,
    alpha: 1,
    color: flowerColors[Math.floor(Math.random() * flowerColors.length)],
    life: 0,
    maxLife: 9999, // persistent until season changes
  }
}

// --- Particle update ---

const updateParticle = (p: Particle, season: Season): Particle => {
  const newLife = p.life + 1
  const lifeRatio = newLife / p.maxLife
  const fadeStart = 0.7

  // Butterflies have a unique movement pattern (fluttering)
  const isButterfly = season === 'spring' && p.vy <= 0.5 && p.size >= 6
  const newVx = isButterfly
    ? p.vx + Math.sin(newLife * 0.1) * 0.15
    : p.vx + randomBetween(-0.05, 0.05)
  const newVy = isButterfly
    ? p.vy + Math.cos(newLife * 0.08) * 0.1
    : p.vy

  return {
    ...p,
    x: p.x + newVx,
    y: p.y + newVy,
    vx: newVx * 0.99,
    vy: newVy,
    rotation: p.rotation + p.rotationSpeed,
    alpha: lifeRatio > fadeStart
      ? p.alpha * (1 - (lifeRatio - fadeStart) / (1 - fadeStart))
      : p.alpha,
    life: newLife,
  }
}

const isParticleAlive = (p: Particle): boolean => p.life < p.maxLife && p.alpha > 0.01

// --- Drawing functions ---

const drawSky = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sceneColors: SceneColors,
): void => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height * (1 - GROUND_RATIO))
  gradient.addColorStop(0, sceneColors.skyTop)
  gradient.addColorStop(1, sceneColors.skyBottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height * (1 - GROUND_RATIO) + 2)
}

const drawGround = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sceneColors: SceneColors,
  time: number,
): void => {
  const groundY = height * (1 - GROUND_RATIO)

  const gradient = ctx.createLinearGradient(0, groundY, 0, height)
  gradient.addColorStop(0, sceneColors.groundTop)
  gradient.addColorStop(1, sceneColors.groundBottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, groundY, width, height * GROUND_RATIO)

  // Gentle wavy top edge for the ground
  ctx.beginPath()
  ctx.moveTo(0, groundY)
  for (let x = 0; x <= width; x += 15) {
    const wave = Math.sin(x * 0.03 + time * 0.0005) * 3
    ctx.lineTo(x, groundY + wave)
  }
  ctx.lineTo(width, groundY + 8)
  ctx.lineTo(0, groundY + 8)
  ctx.closePath()
  ctx.fillStyle = sceneColors.groundTop
  ctx.fill()
}

const drawSun = (
  ctx: CanvasRenderingContext2D,
  width: number,
  time: number,
  season: Season,
  volume: number,
): void => {
  const sunX = width - 80
  const sunY = 70
  const pulse = 1 + Math.sin(time * 0.001) * 0.04

  // Sun visibility/appearance by season
  const sunAlpha = season === 'winter' ? 0.3 : season === 'autumn' ? 0.7 : 1
  const sunColor = season === 'autumn' ? '#FF8C42' : '#FFD700'
  const rayIntensity = season === 'summer' ? 0.5 + volume * 0.5 : 0.3

  ctx.save()
  ctx.globalAlpha = sunAlpha

  // Glow
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, SUN_RADIUS * 2.5)
  glow.addColorStop(0, withAlpha(sunColor, 0.3))
  glow.addColorStop(1, withAlpha(sunColor, 0))
  ctx.fillStyle = glow
  ctx.fillRect(sunX - SUN_RADIUS * 3, sunY - SUN_RADIUS * 3, SUN_RADIUS * 6, SUN_RADIUS * 6)

  // Rays
  ctx.save()
  ctx.translate(sunX, sunY)
  ctx.rotate(time * 0.0003)
  const rayLength = 15 + volume * 15
  for (let i = 0; i < SUN_RAY_COUNT; i++) {
    const angle = (i / SUN_RAY_COUNT) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(
      Math.cos(angle) * SUN_RADIUS * pulse,
      Math.sin(angle) * SUN_RADIUS * pulse,
    )
    ctx.lineTo(
      Math.cos(angle) * (SUN_RADIUS + rayLength) * pulse,
      Math.sin(angle) * (SUN_RADIUS + rayLength) * pulse,
    )
    ctx.strokeStyle = withAlpha(sunColor, rayIntensity)
    ctx.lineWidth = 3
    ctx.stroke()
  }
  ctx.restore()

  // Sun body
  ctx.beginPath()
  ctx.arc(sunX, sunY, SUN_RADIUS * pulse, 0, Math.PI * 2)
  ctx.fillStyle = sunColor
  ctx.fill()

  ctx.restore()
}

const drawTree = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sceneColors: SceneColors,
  season: Season,
  time: number,
  volume: number,
): void => {
  const groundY = height * (1 - GROUND_RATIO)
  const treeX = width * 0.5
  const trunkW = width * TRUNK_WIDTH_RATIO
  const trunkH = height * TRUNK_HEIGHT_RATIO
  const trunkTop = groundY - trunkH
  const crownRadius = height * CROWN_RADIUS_RATIO

  // Gentle sway
  const sway = Math.sin(time * 0.0015) * (2 + volume * 4)

  // Trunk
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(treeX - trunkW / 2, groundY)
  ctx.lineTo(treeX - trunkW / 3 + sway * 0.3, trunkTop + crownRadius * 0.3)
  ctx.lineTo(treeX + trunkW / 3 + sway * 0.3, trunkTop + crownRadius * 0.3)
  ctx.lineTo(treeX + trunkW / 2, groundY)
  ctx.closePath()

  const trunkGradient = ctx.createLinearGradient(treeX - trunkW / 2, groundY, treeX + trunkW / 2, groundY)
  trunkGradient.addColorStop(0, '#5D4037')
  trunkGradient.addColorStop(0.5, '#795548')
  trunkGradient.addColorStop(1, '#5D4037')
  ctx.fillStyle = trunkGradient
  ctx.fill()

  // Branches for winter (bare tree)
  if (season === 'winter') {
    const branchColor = '#6D4C41'
    ctx.strokeStyle = branchColor
    ctx.lineWidth = 3
    ctx.lineCap = 'round'

    // Left branch
    ctx.beginPath()
    ctx.moveTo(treeX + sway * 0.4, trunkTop + crownRadius * 0.5)
    ctx.quadraticCurveTo(
      treeX - crownRadius * 0.4 + sway * 0.5,
      trunkTop + crownRadius * 0.1,
      treeX - crownRadius * 0.7 + sway * 0.6,
      trunkTop - crownRadius * 0.2,
    )
    ctx.stroke()

    // Right branch
    ctx.beginPath()
    ctx.moveTo(treeX + sway * 0.4, trunkTop + crownRadius * 0.4)
    ctx.quadraticCurveTo(
      treeX + crownRadius * 0.3 + sway * 0.5,
      trunkTop + crownRadius * 0.05,
      treeX + crownRadius * 0.65 + sway * 0.6,
      trunkTop - crownRadius * 0.15,
    )
    ctx.stroke()

    // Upper branch
    ctx.beginPath()
    ctx.moveTo(treeX + sway * 0.5, trunkTop + crownRadius * 0.2)
    ctx.quadraticCurveTo(
      treeX + crownRadius * 0.1 + sway * 0.6,
      trunkTop - crownRadius * 0.3,
      treeX - crownRadius * 0.1 + sway * 0.7,
      trunkTop - crownRadius * 0.6,
    )
    ctx.stroke()

    // Small twigs
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(treeX - crownRadius * 0.5 + sway * 0.55, trunkTop - crownRadius * 0.05)
    ctx.lineTo(treeX - crownRadius * 0.65 + sway * 0.6, trunkTop - crownRadius * 0.35)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(treeX + crownRadius * 0.45 + sway * 0.55, trunkTop)
    ctx.lineTo(treeX + crownRadius * 0.55 + sway * 0.6, trunkTop - crownRadius * 0.3)
    ctx.stroke()
  }

  // Crown (not for winter -- bare tree)
  if (season !== 'winter') {
    const crownCenterY = trunkTop - crownRadius * 0.2
    const crownCenterX = treeX + sway * 0.5

    // Shadow underneath
    ctx.beginPath()
    ctx.ellipse(crownCenterX + 3, crownCenterY + 5, crownRadius * 1.05, crownRadius * 0.85, 0, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha('#000000', 0.08)
    ctx.fill()

    // Main crown shape (multiple overlapping ellipses for organic look)
    const drawCrownBlob = (cx: number, cy: number, rx: number, ry: number, color: string): void => {
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    }

    // Base crown
    drawCrownBlob(crownCenterX, crownCenterY, crownRadius, crownRadius * 0.8, sceneColors.treeCrown)
    // Left bump
    drawCrownBlob(crownCenterX - crownRadius * 0.5, crownCenterY + crownRadius * 0.1, crownRadius * 0.6, crownRadius * 0.55, sceneColors.treeCrown)
    // Right bump
    drawCrownBlob(crownCenterX + crownRadius * 0.5, crownCenterY + crownRadius * 0.15, crownRadius * 0.55, crownRadius * 0.5, sceneColors.treeCrown)
    // Top bump
    drawCrownBlob(crownCenterX + crownRadius * 0.1, crownCenterY - crownRadius * 0.4, crownRadius * 0.55, crownRadius * 0.5, sceneColors.treeHighlight)
    // Highlight
    drawCrownBlob(crownCenterX - crownRadius * 0.2, crownCenterY - crownRadius * 0.15, crownRadius * 0.45, crownRadius * 0.4, withAlpha(sceneColors.treeHighlight, 0.5))
  }

  ctx.restore()
}

const drawParticleShape = (
  ctx: CanvasRenderingContext2D,
  p: Particle,
  season: Season,
): void => {
  ctx.save()
  ctx.globalAlpha = clamp(p.alpha, 0, 1)
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rotation)

  if (season === 'autumn') {
    // Leaf shape
    ctx.beginPath()
    ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.fill()
    // Leaf vein
    ctx.beginPath()
    ctx.moveTo(-p.size * 0.7, 0)
    ctx.lineTo(p.size * 0.7, 0)
    ctx.strokeStyle = withAlpha('#000000', 0.2)
    ctx.lineWidth = 0.5
    ctx.stroke()
  } else if (season === 'winter') {
    // Snowflake (simple circle with glow)
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size)
    glow.addColorStop(0, withAlpha('#FFFFFF', 0.9))
    glow.addColorStop(1, withAlpha('#FFFFFF', 0))
    ctx.fillStyle = glow
    ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2)
    ctx.beginPath()
    ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
  } else if (season === 'spring' && p.size >= 6 && p.maxLife >= 200) {
    // Butterfly
    const wingPhase = Math.sin(p.life * 0.15) * 0.4
    ctx.fillStyle = p.color
    // Left wing
    ctx.save()
    ctx.scale(1, 1 + wingPhase)
    ctx.beginPath()
    ctx.ellipse(-p.size * 0.4, 0, p.size * 0.5, p.size * 0.8, -0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    // Right wing
    ctx.save()
    ctx.scale(1, 1 - wingPhase)
    ctx.beginPath()
    ctx.ellipse(p.size * 0.4, 0, p.size * 0.5, p.size * 0.8, 0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    // Body
    ctx.beginPath()
    ctx.ellipse(0, 0, p.size * 0.12, p.size * 0.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#333333'
    ctx.fill()
  } else if (season === 'spring' && p.vx === 0 && p.vy === 0) {
    // Ground flower (static decoration)
    const petalCount = 5
    ctx.fillStyle = p.color
    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2
      ctx.beginPath()
      ctx.ellipse(
        Math.cos(angle) * p.size * 0.4,
        Math.sin(angle) * p.size * 0.4,
        p.size * 0.35,
        p.size * 0.2,
        angle,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
    // Center
    ctx.beginPath()
    ctx.arc(0, 0, p.size * 0.2, 0, Math.PI * 2)
    ctx.fillStyle = '#FBBF24'
    ctx.fill()
  } else if (season === 'spring') {
    // Petal
    ctx.beginPath()
    ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.fill()
  } else if (season === 'summer') {
    // Heat shimmer / sparkle
    ctx.beginPath()
    ctx.arc(0, 0, p.size, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(p.color, clamp(p.alpha, 0, 0.4))
    ctx.fill()
  }

  ctx.restore()
}

const drawSeasonLabel = (
  ctx: CanvasRenderingContext2D,
  label: string,
  width: number,
  height: number,
): void => {
  ctx.save()
  ctx.font = 'bold 20px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = withAlpha(colors.text, 0.5)
  ctx.fillText(label, width - 20, height - 16)
  ctx.restore()
}

const drawSnowGround = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  volume: number,
  time: number,
): void => {
  // Snow accumulation on the ground surface
  const groundY = height * (1 - GROUND_RATIO)
  const snowDepth = 8 + volume * 6

  ctx.beginPath()
  ctx.moveTo(0, groundY)
  for (let x = 0; x <= width; x += 20) {
    const wave = Math.sin(x * 0.02 + time * 0.0003) * 3
    ctx.lineTo(x, groundY - snowDepth + wave)
  }
  ctx.lineTo(width, groundY + 2)
  ctx.lineTo(0, groundY + 2)
  ctx.closePath()
  ctx.fillStyle = withAlpha('#FFFFFF', 0.7)
  ctx.fill()
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

const styleSeasonLabel = (el: HTMLElement): void => {
  Object.assign(el.style, {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    zIndex: '10',
    fontSize: '1.3rem',
    fontWeight: '700',
    color: withAlpha(colors.text, 0.6),
    margin: '0',
    padding: '8px 16px',
    fontFamily: 'inherit',
    pointerEvents: 'none',
    backgroundColor: withAlpha(colors.surface, 0.6),
    borderRadius: '12px',
    backdropFilter: 'blur(4px)',
  })
}

// --- Game factory ---

export const createSeasons = (): Game => {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let animationId: number | null = null
  let resizeHandler: (() => void) | null = null
  let startTime = 0

  // Scene state
  let currentSeason: Season | null = null
  let targetSeason: Season | null = null
  let currentColors: SceneColors = { ...NEUTRAL_COLORS }
  let targetColors: SceneColors = { ...NEUTRAL_COLORS }
  let transitionProgress = 1 // 1 = fully arrived at target
  let particles: Particle[] = []
  let springFlowers: Particle[] = [] // persistent ground flowers for spring
  let currentVolume = 0
  let currentDuration = 0
  let seasonLabelEl: HTMLElement | null = null

  const spawnParticlesForSeason = (season: Season, volume: number, count: number): void => {
    const spawnCount = Math.min(count, MAX_PARTICLES - particles.length)
    for (let i = 0; i < spawnCount; i++) {
      switch (season) {
        case 'summer':
          particles.push(createSummerParticle(width, height, volume))
          break
        case 'autumn':
          particles.push(createLeafParticle(width, height, volume))
          break
        case 'winter':
          particles.push(createSnowParticle(width, height, volume))
          break
        case 'spring':
          particles.push(createPetalParticle(width, height, volume))
          // Also spawn butterflies occasionally at high volume
          if (volume > 0.4 && Math.random() < 0.15) {
            particles.push(createButterflyParticle(width, height, volume))
          }
          break
      }
    }
  }

  const updateSpringFlowers = (season: Season): void => {
    if (season === 'spring' && springFlowers.length < 12) {
      if (Math.random() < 0.02) {
        springFlowers.push(createFlowerDecoration(width, height))
      }
    } else if (season !== 'spring' && springFlowers.length > 0) {
      // Fade out spring flowers when leaving spring
      springFlowers = springFlowers
        .map(f => ({ ...f, alpha: f.alpha - 0.01 }))
        .filter(f => f.alpha > 0.01)
    }
  }

  const animate = (): void => {
    if (!ctx) return

    const time = performance.now() - startTime

    clearCanvas(ctx, width, height)

    // Advance transition
    if (transitionProgress < 1) {
      transitionProgress = Math.min(1, transitionProgress + TRANSITION_SPEED)
      currentColors = lerpSceneColors(currentColors, targetColors, TRANSITION_SPEED)
    }

    const activeSeason = currentSeason ?? 'summer'

    // Draw scene
    drawSky(ctx, width, height, currentColors)
    drawSun(ctx, width, time, activeSeason, currentVolume)
    drawGround(ctx, width, height, currentColors, time)

    // Snow accumulation in winter
    if (activeSeason === 'winter') {
      drawSnowGround(ctx, width, height, currentVolume, time)
    }

    // Draw spring ground flowers
    for (const flower of springFlowers) {
      drawParticleShape(ctx, flower, 'spring')
    }

    // Draw tree
    drawTree(ctx, width, height, currentColors, activeSeason, time, currentVolume)

    // Spawn particles based on volume
    if (currentSeason !== null) {
      const spawnRate = PARTICLE_SPAWN_RATE_BASE + currentVolume * 2
      if (Math.random() < spawnRate) {
        const count = Math.ceil(1 + currentVolume * 3)
        spawnParticlesForSeason(currentSeason, currentVolume, count)
      }
    }

    // Update and draw particles
    particles = particles
      .map(p => updateParticle(p, activeSeason))
      .filter(isParticleAlive)

    for (const p of particles) {
      drawParticleShape(ctx, p, activeSeason)
    }

    // Update spring flowers
    updateSpringFlowers(activeSeason)

    // Draw season label on canvas (for the bottom-right overlay)
    if (currentSeason !== null) {
      const theme = SEASON_THEMES[currentSeason]
      drawSeasonLabel(ctx, theme.label, width, height)
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

    const title = createElement('p', {}, 'Saisons')
    styleTitle(title)

    seasonLabelEl = createElement('p', {}, '')
    styleSeasonLabel(seasonLabelEl)

    wrapper.appendChild(backButton)
    wrapper.appendChild(title)
    wrapper.appendChild(seasonLabelEl)
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
    currentSeason = null
    targetSeason = null
    currentColors = { ...NEUTRAL_COLORS }
    targetColors = { ...NEUTRAL_COLORS }
    transitionProgress = 1
    particles = []
    springFlowers = []
    currentVolume = 0
    currentDuration = 0
    startTime = performance.now()

    animate()
  }

  const update = (features: VoiceFeatures): void => {
    currentVolume = features.volume
    currentDuration = features.duration

    // Determine target season from vowel
    const vowel = features.vowel
    const newSeason: Season | null = vowel !== null
      ? VOWEL_TO_SEASON[vowel] ?? null
      : null

    if (newSeason !== null && newSeason !== targetSeason) {
      // Start transitioning to new season
      targetSeason = newSeason

      // If we're already at a season, start from current interpolated colors
      // Otherwise start from neutral
      if (transitionProgress < 1) {
        // Already mid-transition, continue from where we are
      }

      targetColors = themeToSceneColors(SEASON_THEMES[newSeason])
      transitionProgress = 0
      currentSeason = newSeason

      // Clear particles from previous season (they'll naturally expire)
      // but keep the existing ones so the transition feels organic

      // Clear spring flowers if we're leaving spring
      if (newSeason !== 'spring') {
        // springFlowers will fade out via updateSpringFlowers
      }

      // Update the DOM label
      if (seasonLabelEl) {
        seasonLabelEl.textContent = SEASON_THEMES[newSeason].label
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
    seasonLabelEl = null
    width = 0
    height = 0
    particles = []
    springFlowers = []
    currentSeason = null
    targetSeason = null
    transitionProgress = 1
    currentVolume = 0
    currentDuration = 0
  }

  return {
    id: 'seasons',
    name: 'Saisons',
    description: 'Change les saisons avec ta voix',
    mount,
    unmount,
    update,
  }
}
