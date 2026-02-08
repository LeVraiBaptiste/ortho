# CLAUDE.md — Instructions pour l'agent

## Projet

**Ortho** est une webapp pour enfants autistes qui les aide à vocaliser via des jeux interactifs.
Le micro du navigateur capture la voix en temps réel, un pipeline d'analyse extrait des features
(voyelles françaises, volume, pitch, durée) et les jeux réagissent visuellement.

Voir `plan.md` pour l'architecture détaillée et les choix techniques.

## Stack

- Vanilla TypeScript, zéro framework UI
- Vite comme bundler
- Programmation fonctionnelle : fonctions pures, composition, pas de classes
- Web Audio API pour la capture et l'analyse
- Tout côté client, aucun backend

## Architecture

```
src/audio/      → Pipeline analyse (capture, volume, pitch, voyelles, durée)
src/games/      → Jeux indépendants (chacun implémente l'interface Game)
src/router/     → Navigation SPA minimaliste
src/state/      → Store publish/subscribe
src/ui/         → Helpers DOM, canvas, couleurs
src/styles/     → CSS
```

Chaque jeu est un module autonome qui reçoit des `VoiceFeatures` et gère son propre rendu.

## Conventions de code

- Fonctions pures autant que possible, effets de bord isolés et explicites
- Nommage : `camelCase` pour fonctions/variables, `PascalCase` pour types
- Un fichier = une responsabilité claire
- Pas de classes, pas de `this`, pas d'héritage
- Typage strict : `strict: true` dans tsconfig
- Exports nommés uniquement, pas de `export default`
- Commentaires uniquement quand la logique n'est pas évidente

## Mode de travail — IMPORTANT

**L'agent principal agit comme chef d'orchestre, pas comme implémentateur.**

- Utiliser les agents (Task tool) de manière agressive et systématique
- Dès qu'une tâche peut être déléguée à un agent, elle DOIT l'être
- Paralléliser les agents autant que possible : si 3 fichiers indépendants doivent être créés, lancer 3 agents en parallèle
- L'agent principal se concentre sur : planifier, découper, déléguer, vérifier, assembler
- L'agent principal ne devrait écrire du code directement que pour des corrections mineures ou du glue code

### Quand lancer un agent

- Création ou modification de fichier(s) → agent
- Recherche dans le codebase → agent Explore
- Écriture de tests → agent
- Debugging → agent
- Toute tâche qui prend plus de 2-3 lignes de code → agent

### Comment structurer les prompts aux agents

- Donner le contexte complet : quel fichier, quel rôle, quelles fonctions attendues
- Spécifier les types/interfaces à respecter
- Mentionner les conventions (fonctionnel, pas de classes, exports nommés)
- Indiquer les dépendances avec d'autres modules

## Commandes

| Commande          | Action                            |
|-------------------|-----------------------------------|
| `npm run dev`     | Dev server Vite                   |
| `npm run build`   | Build production                  |
| `npm run preview` | Preview build                     |
| `npm run check`   | Vérification types `tsc --noEmit` |
