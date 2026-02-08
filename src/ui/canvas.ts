// Canvas helper functions

// Create a canvas that fills its container, with proper DPI scaling
export const createCanvas = (
  container: HTMLElement,
): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  width: number
  height: number
} => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get 2D rendering context')
  }

  container.appendChild(canvas)

  const { width, height } = resizeCanvas(canvas, ctx)

  return { canvas, ctx, width, height }
}

// Clear the canvas
export const clearCanvas = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void => {
  ctx.clearRect(0, 0, width, height)
}

// Draw a circle
export const drawCircle = (
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

// Handle canvas resize (call on window resize)
export const resizeCanvas = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): { width: number; height: number } => {
  const parent = canvas.parentElement
  if (!parent) {
    throw new Error('Canvas must be mounted in a parent element')
  }

  const dpr = window.devicePixelRatio || 1
  const width = parent.clientWidth
  const height = parent.clientHeight

  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  return { width, height }
}
