# Cycle de force

Application web progressive (PWA), en français, pour planifier et suivre des cycles de force athlétique
(Squat, Bench, Deadlift sumo). Elle fonctionne **entièrement hors ligne**, sans compte ni serveur :
les données restent sur le téléphone (IndexedDB), avec export et restauration d'une sauvegarde JSON.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Vérification des types puis build de production dans `dist/` |
| `npm run preview` | Sert la build de production (service worker actif) |
| `npm test` | Tests unitaires (Vitest) |
| `npm run e2e` | Build puis tests de bout en bout (Playwright), dont l'audit d'accessibilité axe |
| `npm run lighthouse` | Audit Lighthouse des écrans principaux (lancer `npm run preview -- --port 4174` avant) |
| `npm run typecheck` | Vérification des types de l'app et des tests E2E |
| `npm run icons` | Régénère les icônes de `public/icons/` |

## Organisation

- `src/domain/` : logique métier en fonctions pures, sans DOM (charges, statuts, cycles, édition, sauvegarde, stats).
- `src/data/` : IndexedDB versionnée ; `repository.ts` est le seul point d'accès aux données.
- `src/seed/` : les 5 modèles natifs et le cycle d'exemple « Bloc 0 ».
- `src/ui/` : interface Preact ; tous les textes sont dans `src/ui/strings.ts`.
- `e2e/` : tests Playwright ; `scripts/` : icônes et Lighthouse.

## Mise en ligne

La build utilise des chemins relatifs : le contenu de `dist/` fonctionne tel quel à la racine d'un domaine
ou dans un sous-dossier (GitHub Pages). Le HTTPS est obligatoire pour l'installation et le hors ligne.

## Application Android

Voir [`docs/capacitor.md`](docs/capacitor.md), y compris le transfert des données du navigateur vers l'app.
