# Cycle de force

PWA en français, 100 % hors ligne, pour planifier et suivre des cycles de force
athlétique (Squat/Bench/Deadlift). Pas de compte ni de serveur : les données
restent sur l'appareil (IndexedDB). Empaquetée en app Android via Capacitor.

Dépôt GitHub : `kaelkrzyzanowski/cycle-de-force` (remote déjà configuré).
Racine locale : `C:\Users\kaelk\cycle-de-force`.

## Stack

- Preact + TypeScript strict + Vite (`vite-plugin-pwa`), pas de framework CSS.
- `idb` pour IndexedDB (`src/data/db.ts`), aucune autre dépendance runtime lourde.
- Vitest (unitaires) + Playwright (e2e, sur le build de prod).
- Capacitor 8 pour l'app Android (dossier `android/`), CI GitHub Actions build/signe l'APK.

## Organisation du code

- `src/domain/` — logique métier pure, sans DOM : charges (`load.ts`), statuts de
  série, cycles/vagues (`cycles.ts`, `templates.ts`), édition de séance
  (`sessionEdit.ts`), sauvegarde (`backup.ts`), stats (`stats.ts`).
- `src/data/repository.ts` — seul point d'accès aux données (interface `Repository`),
  implémentation IndexedDB dans `db.ts`. `applyChanges()` fait des écritures
  transactionnelles tout-ou-rien.
- `src/seed/` — les 5 modèles natifs (Squat, Bench, Deadlift, SBD, Joker) et le
  cycle d'exemple « Bloc 0 », dérivés du cahier Excel original de l'utilisateur.
- `src/ui/` — écrans Preact ; **tous les textes sont dans `src/ui/strings.ts`**
  (à respecter pour toute nouvelle UI).
- `e2e/` — tests Playwright par écran/scénario.
- `scripts/gen-icons.mjs` — génère les icônes (PWA + Android) depuis
  `assets/icon-source.webp` (photo personnelle de l'utilisateur) via `sharp`.

## Concepts clés du domaine

- **Session** : une séance réelle (date, exercices, séries). `cycleId`/`templateId`/
  `cycleWeek` sont `null` pour une séance libre (hors cycle).
- **SessionTemplate** : un modèle par semaine de cycle (1..N). Les 3 modèles
  « vague » (Squat/Bench/Deadlift) ont un `deloadWeek` : `waveWeek()` numérote
  S0 (deload) → S(n-1) (test au RM) en boucle depuis cette semaine.
- **Nom de séance affiché** (`sessionLabel` dans `templates.ts`) : calculé depuis
  le % le plus haut du mouvement principal ce jour-là (« Squat deload »,
  « Bench RM », « Deadlift 80 % »), **jamais un numéro de semaine**. Repli sur le
  nom brut si pas de vague ou pas de donnée en %.
- **Cycle** : `weeklyPlan` (jour de semaine → templateId) + dates → génère des
  Sessions via `generateCycleSessions`. Éditer un Session ne touche jamais son
  Template, et l'inverse : éditer un Template ne touche jamais les Sessions déjà
  générées, sauf via les mécanismes explicites de mise à jour (voir ci-dessous).
- **Mise à jour "séances futures"** : en sauvegardant un modèle modifié, l'app
  propose de mettre à jour les séances **futures et encore vierges** (aucune
  série touchée) qui l'utilisent — jamais les séances passées ou déjà réalisées.
  Éditer une séance propose séparément "cette séance uniquement" vs "aussi les
  semaines suivantes du même cycle".
- **RM par exercice** : n'importe quel exercice peut servir de base à un % (`LoadRule`
  `{ kind: 'PERCENT', of: <exerciseId>, pct }`). `Cycle.max` est un `Record<exerciseId, kg>` ;
  `Exercise.hasMax`/`short`/`defaultMax` servent à l'affichage et aux choix par défaut. Les
  anciennes données S/B/D (base IndexedDB v1, sauvegarde `schemaVersion` 1) sont migrées par
  `src/domain/legacyLifts.ts` (S→`squat`, B→`developpe-couche`, D→`souleve-de-terre`).
- **Sauvegarde/restauration** (`backup.ts`, `BackupSection.tsx`) : export/import
  JSON versionné (`schemaVersion`), validation stricte (`parseBackup`), restore =
  **remplacement total** des données (avec copie de l'état précédent gardée).

## Fonctionnalités déjà en place

- Calendrier (mois/semaine), sélection multiple + suppression groupée d'une
  séance (appui long pour entrer en sélection).
- Écran Séance : validation tap/appui long, panneau d'échec, RIR, notes, "Tout
  valider", totaux en direct.
- Modifier une séance / dupliquer une semaine ou un cycle.
- Éditeur de modèles (création, semaines, progression %, dupliquer/réinitialiser
  un modèle natif).
- Stats (tonnage, e1RM, historique des max, volume par modèle).
- Sauvegarde manuelle + copie automatique sur Android (`Documents/CycleDeForce`).
- Icône de l'app = photo personnelle (voir `assets/icon-source.webp`).

## Commandes

```
npm run dev          # serveur de dev
npm run build         # tsc --noEmit + vite build
npm test               # vitest
npm run typecheck      # tsc app + tsc e2e
npm run e2e             # build + playwright test (nécessite npx playwright install une fois)
npm run icons            # régénère les icônes depuis assets/icon-source.webp
```

## Publier une nouvelle version (déclenche le build + release APK)

```bash
npm version 1.x.y --no-git-tag-version
git add package.json package-lock.json
git commit -m "Version 1.x.y"
git tag v1.x.y
git push origin main --tags
```

Le tag `v*` déclenche `.github/workflows/android.yml` : tests → build web →
`cap sync android` → build/signature Gradle → release GitHub avec l'APK. Un
push sur `main` seul ne déclenche PAS ce workflow (seulement la publication
GitHub Pages) — il faut le tag.

Identité git locale à configurer si absente (`git config user.name`/`user.email`,
voir historique des commits pour la valeur attendue).

## Pièges connus

- `NumberField` ne resynchronise son texte que quand `value` change vraiment : l'effet
  de montage s'exécute après le premier rendu et écrasait une saisie immédiate (c'était
  l'ancien flake « Aucune série planifiée ne change » des e2e).
- Vitest sous Windows : si les workers « forks » ne démarrent pas à temps, lancer
  `npx vitest run --pool=threads`.
- `scripts/gen-icons.mjs` dépend de `sharp` (déjà en devDependency explicite) ;
  les chemins passés à `sharp` doivent être des strings (`fileURLToPath`), pas
  des `URL` (sharp ne les accepte pas).
- Avant toute manip destructive sur IndexedDB en test (navigateur/dev), bien
  vider les bases avec `indexedDB.databases()` + `deleteDatabase` — une
  connexion `idb` déjà ouverte peut faire attendre indéfiniment un second accès
  raw à la même base.

## Historique récent (pour contexte)

Le fichier Excel personnel de l'utilisateur (`Programme 2026.xlsx`, cahier
d'entraînement réel) a servi à générer un import ponctuel de 319 séances
historiques (janvier→septembre 2026) sous forme de fichier de sauvegarde à
restaurer manuellement — ce n'est **pas** une fonctionnalité d'import intégrée
à l'app (pas de code dans `src/` pour ça). Si l'utilisateur redemande un import
Excel à jour, il faudra soit refaire ce travail ponctuel (parser Python
ad hoc), soit envisager une vraie fonctionnalité d'import dans l'app — à
clarifier avec lui avant de choisir.
