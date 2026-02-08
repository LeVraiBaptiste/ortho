import './styles/main.css'
import { createAudioPipeline } from './audio/capture.ts'
import { createStore } from './state/store.ts'
import { createRouter } from './router/router.ts'
import { createMenu } from './games/menu.ts'
import { createDashboard } from './games/dashboard/dashboard.ts'
import { createBubbles } from './games/bubbles/bubbles.ts'
import { createRocket } from './games/rocket/rocket.ts'
import { createLamp } from './games/lamp/lamp.ts'
import { createCandles } from './games/candles/candles.ts'
import { createPiano } from './games/piano/piano.ts'
import { createAnimals } from './games/animals/animals.ts'
import { createDoors } from './games/doors/doors.ts'
import { createFlower } from './games/flower/flower.ts'
import { createBalloon } from './games/balloon/balloon.ts'
import { createAquarium } from './games/aquarium/aquarium.ts'
import { createSeasons } from './games/seasons/seasons.ts'
import { VoiceFeatures } from './audio/types.ts'
import { qs } from './ui/dom.ts'

// 1. Get the #app container
const app = qs<HTMLDivElement>('#app')

// 2. Create the audio pipeline
const audioPipeline = createAudioPipeline()

// 3. Create the voice features store
const voiceStore = createStore<VoiceFeatures>({
  volume: 0,
  pitch: null,
  vowel: null,
  isVoicing: false,
  duration: 0,
})

// 4. Create game instances
const games = [
  // Volume
  createRocket(),
  createLamp(),
  createCandles(),
  // Pitch
  createPiano(),
  // Voyelles
  createAnimals(),
  createDoors(),
  // Durée
  createFlower(),
  createBalloon(),
  // Multi-features
  createAquarium(),
  createSeasons(),
  // Diagnostics
  createBubbles(),
  createDashboard(),
]
const menu = createMenu(games.map(g => ({ id: g.id, name: g.name, description: g.description })))

// 6. Create router with all games including menu
const allGames = [menu, ...games]
const router = createRouter(app, allGames)

// 7. Subscribe voice store to update the current game
voiceStore.subscribe((features) => {
  const currentGame = router.getCurrentGame()
  if (currentGame) {
    currentGame.update(features)
  }
})

// 8. Subscribe audio pipeline to update the voice store
audioPipeline.subscribe((features) => {
  voiceStore.set(features)
})

// 9. Add a start button overlay for microphone permission
// (Browsers require user gesture to start AudioContext)
const startOverlay = document.createElement('div')
startOverlay.style.cssText = `
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center; flex-direction: column;
  background: rgba(240, 244, 255, 0.95);
`

const startBtn = document.createElement('button')
startBtn.textContent = '🎤 Commencer'
startBtn.style.cssText = `
  font-size: 2rem; padding: 24px 48px;
  border: none; border-radius: 16px;
  background: #6366f1; color: white;
  cursor: pointer; font-family: inherit;
  transition: transform 0.2s;
`
startBtn.addEventListener('mouseenter', () => { startBtn.style.transform = 'scale(1.05)' })
startBtn.addEventListener('mouseleave', () => { startBtn.style.transform = 'scale(1)' })

const subtitle = document.createElement('p')
subtitle.textContent = 'Appuie pour activer le micro'
subtitle.style.cssText = 'margin-top: 16px; color: #64748b; font-size: 1.2rem;'

startOverlay.appendChild(startBtn)
startOverlay.appendChild(subtitle)
document.body.appendChild(startOverlay)

startBtn.addEventListener('click', async () => {
  try {
    await audioPipeline.start()
    startOverlay.remove()
  } catch (err) {
    subtitle.textContent = 'Erreur : impossible d\'accéder au micro'
    subtitle.style.color = '#ef4444'
    console.error('Failed to start audio pipeline:', err)
  }
})
