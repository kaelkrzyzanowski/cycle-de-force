import type { Repository } from '../data/repository';
import { mergeSteps } from '../domain/steps';
import { Tracker } from '../platform/tracker';

const SYNC_EVERY_MS = 60_000;

/** Recopie les comptes du podomètre Android dans la base (sauvegardes, stats). Vrai si quelque chose a changé. */
export async function syncSteps(repo: Repository): Promise<boolean> {
  const { days } = await Tracker.getSteps();
  const dates = Object.keys(days).sort();
  const first = dates[0];
  const last = dates.at(-1);
  if (!first || !last) return false;
  const changes = mergeSteps(await repo.listStepsBetween(first, last), days);
  if (changes.length > 0) await repo.saveSteps(changes);
  return changes.length > 0;
}

/**
 * App Android : relance le service du podomètre s'il était activé, puis synchronise au lancement,
 * à chaque retour au premier plan et toutes les minutes app ouverte.
 */
export function installStepsSync(repo: Repository, onChange: () => void, onAppStateChange: (fn: (active: boolean) => void) => void): void {
  const sync = () => void syncSteps(repo).then((changed) => changed && onChange(), () => undefined);
  void Tracker.ensureSteps().catch(() => undefined);
  sync();
  let timer = window.setInterval(sync, SYNC_EVERY_MS);
  onAppStateChange((active) => {
    window.clearInterval(timer);
    if (active) {
      sync();
      timer = window.setInterval(sync, SYNC_EVERY_MS);
    }
  });
}
