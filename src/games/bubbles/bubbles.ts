import type { Game } from '../types'
import type { VoiceFeatures } from '../../audio/types'
import { createCanvas, clearCanvas, resizeCanvas } from '../../ui/canvas'
import { vowelColors, colors, withAlpha } from '../../ui/colors'
import { createElement } from '../../ui/dom'

type Bubble = {
  x: number
  y: number
  radius: number
  color: string
  alpha: number
  vy: number // vertical velocity (negative = going up)
  vx: number // slight horizontal drift
}

const SPAWN_THRESHOLD = 6 // frames of voicing before spawning a bubble
const FADE_RATE = 0.003
const GROWTH_RATE = 0.05
const MIN_RADIUS = 10
const VOLUME_RADIUS_SCALE = 50
const BASE_SPEED = -1
const VOLUME_SPEED_SCALE = -3
const DRIFT_RANGE = 0.5
const SPAWN_X_MIN = 0.3
const SPAWN_X_MAX = 0.7
const INITIAL_ALPHA = 0.8

const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min)

const spawnBubble = (
  width: number,
  height: number,
  volume: number,
  vowel: string | null,
): Bubble => ({
  x: randomBetween(width * SPAWN_X_MIN, width * SPAWN_X_MAX),
  y: height,
  radius: MIN_RADIUS + volume * VOLUME_RADIUS_SCALE,
  color: vowel && vowelColors[vowel] ? vowelColors[vowel] : colors.primary,
  alpha: INITIAL_ALPHA,
  vy: BASE_SPEED + volume * VOLUME_SPEED_SCALE,
  vx: randomBetween(-DRIFT_RANGE, DRIFT_RANGE),
})

const updateBubble = (bubble: Bubble): Bubble => ({
  ...bubble,
  y: bubble.y + bubble.vy,
  x: bubble.x + bubble.vx,
  alpha: bubble.alpha - FADE_RATE,
  radius: bubble.radius + GROWTH_RATE,
})

const isBubbleVisible = (bubble: Bubble): boolean =>
  bubble.alpha > 0 && bubble.y + bubble.radius > 0

const drawBubble = (ctx: CanvasRenderingContext2D, bubble: Bubble): void => {
  ctx.beginPath()
  ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2)
  ctx.fillStyle = withAlpha(bubble.color, bubble.alpha)
  ctx.fill()
}

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

export const createBubbles = (): Game => {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let bubbles: Bubble[] = []
  let animationId: number | null = null
  let backButton: HTMLElement | null = null
  let spawnCounter = 0
  let resizeHandler: (() => void) | null = null

  const animate = (): void => {
    if (!ctx) return

    clearCanvas(ctx, width, height)

    bubbles = bubbles.map(updateBubble).filter(isBubbleVisible)

    for (const bubble of bubbles) {
      drawBubble(ctx, bubble)
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

    backButton = createElement('button', {}, '\u2190 Accueil')
    styleBackButton(backButton)
    backButton.addEventListener('click', () => {
      window.location.hash = '#menu'
    })

    const title = createElement('p', {}, 'Bulles')
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

    bubbles = []
    spawnCounter = 0
    animate()
  }

  const update = (features: VoiceFeatures): void => {
    if (!features.isVoicing) {
      spawnCounter = 0
      return
    }

    spawnCounter += 1

    if (spawnCounter >= SPAWN_THRESHOLD) {
      spawnCounter = 0
      bubbles.push(
        spawnBubble(width, height, features.volume, features.vowel),
      )
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
    backButton = null
    bubbles = []
    spawnCounter = 0
    width = 0
    height = 0
  }

  return {
    id: 'bubbles',
    name: 'Bulles',
    description: 'Fais monter des bulles avec ta voix !',
    mount,
    unmount,
    update,
  }
}
