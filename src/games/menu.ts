import type { Game } from './types'
import type { VoiceFeatures } from '../audio/types'
import { createElement, clearChildren } from '../ui/dom'
import { colors } from '../ui/colors'

const cardPalette = ['#818cf8', '#f472b6', '#34d399', '#fbbf24', '#60a5fa'] as const

const pickCardColor = (index: number): string =>
  cardPalette[index % cardPalette.length]

const styleContainer = (el: HTMLElement): void => {
  Object.assign(el.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: '100%',
    padding: '32px 16px',
    backgroundColor: colors.bg,
    fontFamily: 'inherit',
    overflowY: 'auto',
  })
}

const styleTitle = (el: HTMLElement): void => {
  Object.assign(el.style, {
    fontSize: '3rem',
    fontWeight: '800',
    color: colors.primary,
    margin: '0 0 8px 0',
    letterSpacing: '-0.02em',
  })
}

const styleSubtitle = (el: HTMLElement): void => {
  Object.assign(el.style, {
    fontSize: '1.5rem',
    fontWeight: '500',
    color: colors.muted,
    margin: '0 0 40px 0',
  })
}

const styleGrid = (el: HTMLElement): void => {
  Object.assign(el.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '24px',
    width: '100%',
    maxWidth: '800px',
  })
}

const styleCard = (el: HTMLElement, bgColor: string): void => {
  Object.assign(el.style, {
    backgroundColor: bgColor,
    borderRadius: '16px',
    padding: '32px 24px',
    cursor: 'pointer',
    border: 'none',
    textAlign: 'left',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  })

  el.addEventListener('mouseenter', () => {
    el.style.transform = 'scale(1.04)'
    el.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)'
  })

  el.addEventListener('mouseleave', () => {
    el.style.transform = 'scale(1)'
    el.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
  })
}

const styleCardName = (el: HTMLElement): void => {
  Object.assign(el.style, {
    fontSize: '1.6rem',
    fontWeight: '700',
    color: '#ffffff',
    margin: '0 0 8px 0',
  })
}

const styleCardDescription = (el: HTMLElement): void => {
  Object.assign(el.style, {
    fontSize: '1.1rem',
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.9)',
    margin: '0',
    lineHeight: '1.4',
  })
}

const buildCard = (
  game: { id: string; name: string; description: string },
  index: number,
): HTMLElement => {
  const name = createElement('p', {}, game.name)
  styleCardName(name)

  const description = createElement('p', {}, game.description)
  styleCardDescription(description)

  const card = createElement('button', {}, name, description)
  styleCard(card, pickCardColor(index))

  card.addEventListener('click', () => {
    window.location.hash = '#' + game.id
  })

  return card
}

export const createMenu = (
  games: ReadonlyArray<{ id: string; name: string; description: string }>,
): Game => {
  const mount = (container: HTMLElement): void => {
    clearChildren(container)

    const wrapper = createElement('div', {})
    styleContainer(wrapper)

    const title = createElement('h1', {}, 'Ortho')
    styleTitle(title)

    const subtitle = createElement('p', {}, 'Choisis un jeu !')
    styleSubtitle(subtitle)

    const grid = createElement('div', {})
    styleGrid(grid)

    games.forEach((game, index) => {
      grid.appendChild(buildCard(game, index))
    })

    wrapper.appendChild(title)
    wrapper.appendChild(subtitle)
    wrapper.appendChild(grid)
    container.appendChild(wrapper)
  }

  const unmount = (): void => {
    // Nothing to clean up
  }

  const update = (_features: VoiceFeatures): void => {
    // Menu does not react to voice input
  }

  return {
    id: 'menu',
    name: 'Accueil',
    description: 'Choisis un jeu !',
    mount,
    unmount,
    update,
  }
}
