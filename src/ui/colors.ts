// Color utilities — soft palette suitable for autistic children
// High contrast but not harsh

// The main color palette (matches CSS custom properties)
export const colors = {
  bg: '#f0f4ff',
  text: '#2d3748',
  primary: '#6366f1',
  secondary: '#f472b6',
  pink: '#f472b6',
  green: '#34d399',
  surface: '#ffffff',
  muted: '#94a3b8',
} as const

// Vowel colors — each French vowel gets a distinct, soft color
export const vowelColors: Record<string, string> = {
  'a': '#ef4444', // red
  'e': '#f59e0b', // amber
  '\u025B': '#f97316', // orange
  'i': '#22c55e', // green
  'o': '#3b82f6', // blue
  'u': '#8b5cf6', // purple
  'y': '#ec4899', // pink
}

// Get a color with alpha — convert hex to rgba string
export const withAlpha = (hex: string, alpha: number): string => {
  const clampedAlpha = Math.max(0, Math.min(1, alpha))
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`
}
