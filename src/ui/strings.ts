/** Tous les textes de l'interface (français uniquement). */
export const S = {
  appName: 'Cycle de force',
  loading: 'Chargement…',
  loadError: 'Impossible d’ouvrir la base de données locale.',

  nav: {
    label: 'Navigation principale',
    calendar: 'Calendrier',
    today: 'Aujourd’hui',
    templates: 'Modèles',
    stats: 'Stats',
  },
  menu: {
    open: 'Ouvrir le menu',
    settings: 'Réglages',
    back: 'Retour',
  },

  calendar: {
    title: 'Calendrier',
    comingSoon: 'Vues mois et semaine, cycles et duplication : phase 2.',
  },
  today: {
    title: 'Aujourd’hui',
    noSession: 'Aucune séance prévue.',
    comingSoon: 'Saisie des séries, max et sauvegarde : phase 3.',
  },
  templates: {
    title: 'Modèles de séance',
    native: 'Natif',
    custom: 'Perso',
    weeks: (n: number) => `${n} semaine${n > 1 ? 's' : ''}`,
    exercisesWeek1: (n: number) => `${n} exercice${n > 1 ? 's' : ''} en S1`,
    comingSoon: 'Éditeur de modèles : phase 4.',
  },
  stats: {
    title: 'Stats',
    comingSoon: 'Tonnage, e1RM et évolution des max : phase 5.',
  },
  settings: {
    title: 'Réglages',
    theme: 'Thème',
    themes: { dark: 'Sombre', light: 'Clair', system: 'Système' },
    rounding: 'Arrondi des charges',
    roundingNone: 'Aucun',
    roundingValue: (kg: string) => `${kg} kg`,
    storage: 'Stockage',
    storagePersisted: 'Stockage persistant accordé par le navigateur.',
    storageNotPersisted: 'Stockage non garanti : le navigateur peut effacer les données. Pense à sauvegarder.',
    storageUnknown: 'Statut du stockage inconnu.',
    version: (v: string) => `Version ${v}`,
  },

  status: {
    PLANNED: 'Prévue',
    VALIDATED: 'Validé',
    FAILED: 'Échec',
    NOT_DONE: 'Non réalisé',
    CLUSTER: 'Cluster',
  },
} as const;
