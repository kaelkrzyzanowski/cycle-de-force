# Emballer « Cycle de force » en application Android avec Capacitor

Ce document décrit les étapes **exactes** pour transformer la PWA en application Android.
Rien de ce qui suit n'a encore été exécuté : c'est la marche à suivre.

L'app a été construite pour ce passage :

- build statique dans `dist/`, **chemins relatifs** (`base: './'` dans `vite.config.ts`) ;
- routage par hash (`#/calendrier`…), qui fonctionne sans serveur ;
- données dans IndexedDB, derrière `src/data/repository.ts` (seul fichier à toucher pour changer de stockage) ;
- zones sûres (`env(safe-area-inset-*)`) déjà prises en compte ;
- aucune dépendance à un serveur ni à une API de bureau.

---

## 1. Prérequis (une seule fois)

1. **Node.js LTS** : déjà installé sur ce poste.
2. **Android Studio** (version stable) : <https://developer.android.com/studio>.
   Au premier lancement, laisser l'assistant installer le **SDK Android**, les **Platform-Tools** et un **émulateur**.
3. **JDK** : utiliser celui fourni par Android Studio (JBR). Capacitor 7 et suivants demandent le **JDK 21** ;
   vérifier la version exigée dans la doc Capacitor du moment.
4. Sur le téléphone : **Options pour les développeurs → Débogage USB** activé (pour installer depuis le PC).

## 2. Ajouter Capacitor au projet

Depuis la racine du dépôt :

```bash
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
npx cap init "Cycle de force" fr.cycledeforce.app --web-dir dist
```

- `fr.cycledeforce.app` est l'**identifiant d'application**. Il est **définitif** une fois l'app installée
  (changer d'identifiant = nouvelle app, données séparées). Le choisir avant la première installation.
- La commande crée `capacitor.config.ts`. Vérifier son contenu :

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.cycledeforce.app',
  appName: 'Cycle de force',
  webDir: 'dist',
  android: { backgroundColor: '#0e1013' },
};

export default config;
```

## 3. Plugins natifs à ajouter

```bash
npm install @capacitor/app @capacitor/filesystem @capacitor/share @capacitor/status-bar @capacitor/haptics
npm install @capacitor-community/keep-awake
```

| Plugin | Pourquoi |
|---|---|
| `@capacitor/app` | Bouton retour Android (fermer une feuille, revenir en arrière, quitter) |
| `@capacitor/filesystem` + `@capacitor/share` | Export de la sauvegarde : le partage de fichiers du Web Share API n'est pas fiable dans une WebView |
| `@capacitor/status-bar` | Barre d'état sombre, contenu sous la barre (bord à bord, Android 15+) |
| `@capacitor/haptics` | Retour haptique (remplace `navigator.vibrate`, qui demande une permission dans la WebView) |
| `@capacitor-community/keep-awake` | Écran allumé pendant une séance si l'API Wake Lock est absente de la WebView |

## 4. Adaptations du code (petites, localisées)

À faire dans une branche dédiée. Chaque point touche un seul fichier.

1. **Service worker** : inutile dans l'app (les fichiers sont déjà locaux). Dans `src/main.tsx`,
   n'appeler `registerSW` que si `!Capacitor.isNativePlatform()` (import depuis `@capacitor/core`).
2. **Export de la sauvegarde** (`src/ui/backupIO.ts`, fonction `exportBackup`) : en natif, écrire le JSON avec
   `Filesystem.writeFile({ path: nomDuFichier, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 })`,
   puis `Share.share({ title: nomDuFichier, files: [uri] })`. **Le nom et le contenu du fichier ne changent pas.**
3. **Restauration** : rien à changer. Le champ `<input type="file">` ouvre le sélecteur de fichiers Android
   (Drive, Téléchargements…) dans la WebView de Capacitor.
4. **Bouton retour** (`src/ui/App.tsx`) : `App.addListener('backButton', ({ canGoBack }) => …)`.
   Ordre : fermer la feuille basse ouverte s'il y en a une (émettre `Escape`), sinon `history.back()` si
   `canGoBack`, sinon `App.exitApp()`.
5. **Écran allumé** (`src/ui/useWakeLock.ts`) : si `navigator.wakeLock` est absent, appeler
   `KeepAwake.keepAwake()` / `KeepAwake.allowSleep()`.
6. **Haptique** : remplacer `navigator.vibrate?.(…)` par `Haptics.impact({ style: ImpactStyle.Light })` en natif
   (appels dans `src/ui/actions.ts`, `src/ui/components/useLongPress.ts`, `src/ui/screens/SessionScreen.tsx`).
7. **Barre d'état** : au démarrage, `StatusBar.setStyle({ style: Style.Dark })` et
   `StatusBar.setOverlaysWebView({ overlay: true })`. Les marges `safe-area` existantes font le reste.

Après ces changements : `npm test` et `npm run e2e` doivent rester verts (la version navigateur ne change pas).

## 5. Créer le projet Android

```bash
npm run build
npx cap add android
npx cap sync android
```

- `npx cap add android` crée le dossier `android/` (à committer).
- **À chaque modification du code web** : `npm run build` puis `npx cap sync android`.

## 6. Icônes et écran de démarrage

```bash
npm install -D @capacitor/assets
```

Placer dans un dossier `assets/` à la racine :

- `icon-only.png` (1024 × 1024) ;
- `icon-foreground.png` et `icon-background.png` (1024 × 1024, pour l'icône adaptative Android) ;
- `splash.png` et `splash-dark.png` (2732 × 2732, logo centré sur `#0e1013`).

`scripts/gen-icons.mjs` peut produire ces fichiers : ajouter les tailles 1024 et 2732 au script
(même dessin, fond `#0e1013`, logo réduit à ~60 % pour le premier plan adaptatif). Puis :

```bash
npx capacitor-assets generate --android
```

## 7. Lancer sur le téléphone

```bash
npx cap open android
```

Dans Android Studio : brancher le téléphone en USB, le choisir dans la liste des appareils, cliquer **Run ▶**.
Alternative sans ouvrir l'IDE : `npx cap run android`.

## 8. APK signé (installation durable, sans le PC)

1. Créer une clé de signature (**une seule fois, à sauvegarder précieusement** : sans elle, impossible de
   mettre à jour l'app installée) :

   ```bash
   keytool -genkey -v -keystore cycle-de-force.keystore -alias cycle-de-force -keyalg RSA -keysize 2048 -validity 10000
   ```

   Ne **jamais** committer le fichier `.keystore` ni ses mots de passe.
2. Android Studio → **Build → Generate Signed App Bundle / APK → APK**, choisir la clé, variante `release`.
3. Copier l'APK sur le téléphone et l'ouvrir (autoriser « Installer des applis inconnues » pour le gestionnaire
   de fichiers, uniquement le temps de l'installation).

Pour une mise à jour : incrémenter `versionCode` et `versionName` dans `android/app/build.gradle`
(et `version` dans `package.json`), rebuild, re-signer **avec la même clé**, réinstaller par-dessus :
les données sont conservées.

## 9. Transférer mes données du navigateur vers l'app

La PWA (navigateur) et l'app Android ont **des stockages séparés** : rien n'est copié automatiquement.
Le pont, c'est la **sauvegarde JSON**, dont le format est identique des deux côtés
(`{ app: "cycle-de-force", schemaVersion, exportedAt, counts, data }`).

1. **Dans la PWA** (navigateur du téléphone) : Réglages → Sauvegarde → **Exporter une sauvegarde**.
   Partager le fichier `cycle-de-force-AAAA-MM-JJ.json` vers Google Drive (ou l'enregistrer dans Téléchargements).
2. Vérifier que le fichier est bien là et n'est pas vide.
3. **Installer l'app Android** et l'ouvrir. Elle démarre avec les 5 modèles natifs. À la proposition
   « Créer le Bloc 0 », répondre **Plus tard**.
4. Dans l'app : Réglages → Sauvegarde → **Restaurer une sauvegarde…** → choisir le fichier.
5. Contrôler l'**aperçu** (date d'export, nombre de cycles, de séances, de séries réalisées), puis
   **Remplacer toutes mes données**.
6. Vérifier le calendrier, une séance réalisée et les Stats, puis **exporter une première sauvegarde depuis l'app**.
7. Continuer uniquement dans l'app. Garder la PWA quelques semaines sans l'utiliser (filet de sécurité),
   puis la désinstaller.

Cas particuliers :

- « Cette sauvegarde vient d'une version plus récente de l'app » : mettre l'app à jour, puis recommencer.
- Un fichier d'une version plus ancienne est converti automatiquement (migrations de `src/domain/backup.ts`).
- En cas d'erreur pendant la restauration, **rien n'est modifié** ; l'état d'avant restauration est de toute façon
  gardé et téléchargeable dans Réglages.

## 10. Vérifications après emballage

- [ ] Mode avion : ouvrir l'app, valider une séance entière, fermer, rouvrir : tout est là.
- [ ] Bouton retour : ferme les feuilles, revient en arrière, quitte depuis un onglet principal.
- [ ] Export : la feuille de partage Android s'ouvre avec le fichier JSON.
- [ ] Restauration depuis Drive et depuis Téléchargements.
- [ ] Écran qui reste allumé pendant une séance.
- [ ] Barre d'état et encoche : rien de masqué en haut ni en bas.
- [ ] Thèmes sombre et clair.
