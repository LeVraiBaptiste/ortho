import type { Game } from '../games/types'

type Router = {
  readonly navigate: (gameId: string) => void
  readonly getCurrentGame: () => Game | null
}

export const getGameIdFromHash = (): string => {
  const hash = window.location.hash.replace(/^#/, '')
  return hash || 'menu'
}

export const createRouter = (container: HTMLElement, games: Game[]): Router => {
  let currentGame: Game | null = null

  const findGame = (gameId: string): Game | undefined =>
    games.find((g) => g.id === gameId)

  const navigate = (gameId: string): void => {
    if (currentGame) {
      currentGame.unmount()
    }

    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    const game = findGame(gameId) ?? findGame('menu') ?? null

    currentGame = game

    if (game) {
      game.mount(container)
    }

    window.location.hash = `#${game?.id ?? gameId}`
  }

  const getCurrentGame = (): Game | null => currentGame

  const onHashChange = (): void => {
    navigate(getGameIdFromHash())
  }

  window.addEventListener('hashchange', onHashChange)

  navigate(getGameIdFromHash())

  return { navigate, getCurrentGame }
}
