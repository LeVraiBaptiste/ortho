# Ortho

Application pour aider les enfants non-verbaux à vocaliser par le jeu. L'enfant parle dans le micro, l'application réagit visuellement en temps réel. Tout se passe dans le navigateur, rien n'est envoyé sur internet.

## Utiliser l'application

**En ligne** : [Démo live](https://levraibaptiste.github.io/ortho/)

**Hors ligne** :
1. Allez sur [la page du projet](https://github.com/LeVraiBaptiste/ortho)
2. Trouvez [le fichier `dist/index.html`](https://github.com/LeVraiBaptiste/ortho/blob/main/dist/index.html)
3. Cliquez sur le bouton pour télécharger le fichier (en haut à droite)
4. Ouvrez le fichier téléchargé avec Chrome ou Edge ou simplement double-cliquez dessus

C'est tout. Pas besoin d'installer quoi que ce soit. Fonctionne sans connexion internet une fois le fichier téléchargé.                                                                             

Dans les deux cas, autorisez le micro quand le navigateur le demande.

## Vie privée

Aucune donnée ne quitte l'ordinateur. Pas de compte, pas de serveur, pas de cookies.

## Développement

Pour modifier l'application, il faut [Node.js](https://nodejs.org/) (v18+).

```bash
npm install       # installer les dépendances
npm run dev       # lancer en mode développement
npm run build     # générer dist/index.html
npm run check     # vérifier le code
```
