# Application Android « Cycle de force »

L'application Android est la même app que la version web, emballée avec **Capacitor 8** (dossier `android/`).
L'APK est construit et signé par GitHub Actions (`.github/workflows/android.yml`) et publié dans les
**Releases** du dépôt.

## Installer l'APK sur le téléphone

1. Sur le téléphone, ouvrir la page **Releases** du dépôt et télécharger `cycle-de-force-X.Y.Z.apk`.
2. Ouvrir le fichier téléchargé. Android demande d'autoriser l'installation depuis le navigateur ou
   l'app Fichiers : l'autoriser (on peut retirer l'autorisation ensuite).
3. Installer, puis ouvrir **Cycle de force**.

**Mises à jour** : installer le nouvel APK par-dessus. Les données sont conservées, à condition que l'APK soit
signé avec la même clé (c'est le cas de tous les APK publiés par le dépôt).

## Ne pas perdre ses données

L'app garde tout sur le téléphone. Trois protections, de la plus automatique à la plus sûre :

| Protection | Quand | Protège contre |
|---|---|---|
| **Copie automatique** dans `Documents/CycleDeForce/` | Au lancement et à chaque passage en arrière-plan (au plus toutes les 2 min) ; un fichier par jour, 14 jours gardés | Effacement des données de l'app, désinstallation, bug |
| **Export manuel** (Réglages → Sauvegarde → Exporter) | Quand tu veux ; rappel au bout de 7 jours | **Changement ou perte du téléphone** : envoyer le fichier vers Google Drive, Gmail… |
| Sauvegarde Google d'Android (`allowBackup`) | Automatique si activée sur le téléphone | Bonus : non garanti pour une app installée hors Play Store |

Tous ces fichiers ont le même format (`cycle-de-force-AAAA-MM-JJ.json`) et se restaurent de la même façon :
Réglages → Sauvegarde → **Restaurer une sauvegarde…** → choisir le fichier → vérifier l'aperçu →
**Remplacer toutes mes données**.

### Changer de téléphone

1. Ancien téléphone : Réglages → Sauvegarde → **Exporter une sauvegarde** → Google Drive.
2. Nouveau téléphone : installer l'APK (voir plus haut), ouvrir l'app, répondre **Plus tard** au Bloc 0.
3. Réglages → Sauvegarde → **Restaurer une sauvegarde…** → le fichier sur Drive → **Remplacer toutes mes données**.

### Passer de la version web (navigateur) à l'app

Même procédure : exporter depuis la version web, restaurer dans l'app. Les deux ont des stockages séparés ;
rien n'est copié automatiquement de l'une à l'autre.

## Clé de signature

- Créée une seule fois, **hors du dépôt**, dans `C:\Outil Claude\cycle-de-force-signature\`
  (`cycle-de-force.p12` + `MOT-DE-PASSE.txt`). À copier en lieu sûr (clé USB, gestionnaire de mots de passe).
- Une copie est stockée dans les **secrets GitHub** du dépôt : `ANDROID_KEYSTORE_BASE64` (le fichier `.p12` en
  base64) et `ANDROID_KEYSTORE_PASSWORD`.
- **Si la clé est perdue**, les APK suivants ne pourront plus mettre à jour l'app installée : il faudra exporter
  ses données, désinstaller, installer le nouvel APK et restaurer.

## Publier une nouvelle version

```bash
npm version 1.1.0 --no-git-tag-version
git commit -am "Version 1.1.0"
git tag v1.1.0
git push origin main --tags
```

GitHub Actions lance alors les tests, construit l'APK signé (numéro de version = `package.json`,
`versionCode` = numéro de build) et crée la release `v1.1.0` avec l'APK en pièce jointe.
Le workflow peut aussi être lancé à la main (onglet Actions) : l'APK est alors dans les « artifacts » du build.

## Développer en local (facultatif)

Construire l'APK en local demande **Android Studio** (SDK Android) et un **JDK 21**, qui ne sont pas installés sur
ce PC : la CI s'en charge. Si besoin :

```bash
npm run build
npx cap sync android
npx cap open android
```

Après toute modification du code web : `npm run build` puis `npx cap sync android`.
Les icônes et l'écran de démarrage viennent de `assets/` (générés par `npm run icons`) :
`npx capacitor-assets generate --android`.

## Ce qui diffère de la version web

Tout le code propre à Android est dans `src/platform/native.ts`, chargé seulement dans l'app :

- pas de service worker (les fichiers sont déjà sur le téléphone) ;
- export : feuille de partage Android (plugins Filesystem + Share) ;
- copie automatique dans `Documents/CycleDeForce/` ;
- bouton retour : ferme la feuille ouverte, sinon revient en arrière, sinon quitte ;
- écran maintenu allumé pendant une séance (plugin keep-awake) ;
- icônes de la barre d'état adaptées au thème ; zones sûres gérées par Capacitor (`env(safe-area-inset-*)`).
