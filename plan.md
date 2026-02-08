# Ortho — Plan Projet

## Contexte

Application web destinée aux enfants autistes pour les aider à vocaliser.
L'enfant est accompagné d'un adulte (parent, orthophoniste, éducateur).

Le principe : le micro du navigateur capture la voix de l'enfant en temps réel,
l'application analyse le signal (voyelles, volume, hauteur, durée) et restitue
un feedback visuel ludique à travers différents jeux interactifs.

L'objectif thérapeutique est d'encourager la production vocale par le jeu :
l'enfant voit une réaction immédiate à sa voix, ce qui crée une boucle de
renforcement positif.

### Public

- Enfants autistes de différents âges (les jeux s'adapteront)
- Toujours accompagné d'un adulte
- Français uniquement

### Principes directeurs

- Tout fonctionne côté client (pas de backend, pas de données envoyées)
- Vanilla TypeScript, zéro framework UI
- Programmation fonctionnelle : fonctions pures, composition, pas de classes
- Feedback temps réel (latence < 100ms entre le son et le visuel)

---

## Architecture fichiers

```
ortho/
├── index.html                  # Point d'entrée unique (SPA)
├── plan.md
├── package.json
├── tsconfig.json
├── vite.config.ts              # Bundler (Vite)
│
├── src/
│   ├── main.ts                 # Bootstrap : init micro, montage router
│   │
│   ├── audio/                  # Capture et analyse audio
│   │   ├── capture.ts          # Accès micro, AudioContext, AnalyserNode
│   │   ├── volume.ts           # Calcul RMS / dB en temps réel
│   │   ├── pitch.ts            # Détection de hauteur (autocorrelation / YIN)
│   │   ├── vowels.ts           # Détection de voyelles via formants (F1/F2)
│   │   ├── duration.ts         # Mesure de durée de vocalisation
│   │   └── types.ts            # Types partagés : AudioFrame, VoiceFeatures, Vowel...
│   │
│   ├── router/                 # Navigation simple entre pages
│   │   └── router.ts           # Monte/démonte les jeux dans le DOM
│   │
│   ├── ui/                     # Utilitaires UI partagés
│   │   ├── dom.ts              # Helpers création d'éléments DOM
│   │   ├── canvas.ts           # Helpers pour dessiner sur canvas
│   │   └── colors.ts           # Palette adaptée (contrastes, couleurs douces)
│   │
│   ├── state/                  # État applicatif minimal
│   │   └── store.ts            # Store réactif simple (subscribe/publish)
│   │
│   ├── games/                  # Chaque jeu = un module autonome
│   │   ├── types.ts            # Interface Game (mount, unmount, update)
│   │   ├── menu.ts             # Page d'accueil : sélection du jeu
│   │   ├── dashboard/          # Dashboard traitement du signal
│   │   │   └── dashboard.ts    # Spectrogramme, volume meter, voyelle détectée
│   │   ├── bubbles/            # Exemple : bulles qui réagissent à la voix
│   │   │   └── bubbles.ts
│   │   └── ... /               # Futurs jeux
│   │
│   └── styles/
│       ├── reset.css
│       └── main.css
│
└── public/
    └── assets/                 # Images, sons, icônes
```

---

## Découpage fonctionnel

### Audio — Pipeline d'analyse

Le pipeline audio est une chaîne de fonctions pures qui transforment
des données brutes (buffer PCM) en features exploitables par les jeux.

```
Micro → AudioContext → AnalyserNode → Float32Array (buffer PCM)
                                            │
                                ┌───────────┼───────────┐
                                ▼           ▼           ▼
                          computeRMS()  detectPitch()  detectVowel()
                                │           │           │
                                ▼           ▼           ▼
                          VoiceFeatures { volume, pitch, vowel, duration }
```

- **`capture.ts`** : `createAudioPipeline() → { start, stop, subscribe }` — gère le cycle de vie du micro et expose un flux de `Float32Array`
- **`volume.ts`** : `computeRMS(buffer: Float32Array) → number` — fonction pure
- **`pitch.ts`** : `detectPitch(buffer: Float32Array, sampleRate: number) → number | null` — autocorrelation ou algorithme YIN
- **`vowels.ts`** : `detectVowel(buffer: Float32Array, sampleRate: number) → Vowel | null` — extraction formants F1/F2 via LPC ou pic FFT, puis classification dans l'espace vocalique français
- **`duration.ts`** : `trackDuration(isVoicing: boolean, dt: number, state) → DurationState` — accumule la durée de vocalisation continue

### Router

Navigation minimaliste sans bibliothèque externe.

- `createRouter(container: HTMLElement, games: Game[]) → { navigate }`
- Chaque jeu expose `{ id, name, mount(container), unmount(), update(features) }`
- Le router appelle `mount` / `unmount` lors des transitions

### Store

Publish/subscribe simple pour connecter le pipeline audio aux jeux.

- `createStore<T>(initial: T) → { get, set, subscribe }`
- Le pipeline audio publie les `VoiceFeatures` à chaque frame
- Le jeu actif s'abonne et met à jour son rendu

### Jeux

Chaque jeu est un module indépendant qui respecte l'interface `Game` :

```ts
type Game = {
  id: string
  name: string
  description: string
  mount: (container: HTMLElement) => void
  unmount: () => void
  update: (features: VoiceFeatures) => void
}
```

Les jeux reçoivent les `VoiceFeatures` et décident quoi en faire visuellement.
Ils sont responsables de leur propre rendu (Canvas 2D, DOM, SVG...).

---

## Scripts

| Commande        | Action                              |
|-----------------|-------------------------------------|
| `npm run dev`   | Serveur de dev Vite (hot reload)    |
| `npm run build` | Build production dans `dist/`       |
| `npm run preview` | Prévisualise le build production  |
| `npm run check` | `tsc --noEmit` — vérification types |

---

## Voyelles françaises — Espace formantique cible

La détection de voyelles repose sur les deux premiers formants (F1, F2).
Valeurs approximatives pour le français :

| Voyelle | F1 (Hz) | F2 (Hz) |
|---------|---------|---------|
| /a/     | 750     | 1400    |
| /e/     | 400     | 2200    |
| /ɛ/     | 550     | 1900    |
| /i/     | 280     | 2300    |
| /o/     | 450     | 800     |
| /u/     | 310     | 800     |
| /y/     | 280     | 1800    |

La classification se fait par distance euclidienne dans l'espace (F1, F2)
vers le centre de chaque voyelle cible.

---

## Contraintes techniques

- **Navigateur** : Chrome/Edge récents (meilleur support Web Audio API)
- **Permissions** : demande explicite d'accès au micro (`getUserMedia`)
- **Latence** : `AnalyserNode.fftSize = 2048` à 44.1kHz ≈ 46ms de buffer, acceptable
- **Pas de backend** : tout le traitement reste local, aucune donnée ne quitte le navigateur
- **Accessibilité** : couleurs contrastées, animations douces (pas de flash), sons optionnels
