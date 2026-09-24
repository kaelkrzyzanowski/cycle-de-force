import type { Changes } from '../data/repository';
import type { SessionTemplate } from '../domain/types';
import type { AppContextValue } from './context';
import { S } from './strings';

export function templatesById(list: readonly SessionTemplate[]): Map<string, SessionTemplate> {
  return new Map(list.map((t) => [t.id, t]));
}

/** Écrit un lot de changements, rafraîchit l'affichage et confirme par un toast. */
export async function commit(app: AppContextValue, changes: Changes, message: string): Promise<boolean> {
  try {
    await app.repo.applyChanges(changes);
    app.refresh();
    app.toast(message);
    navigator.vibrate?.(15);
    return true;
  } catch (err) {
    console.error(err);
    app.toast(S.saveError);
    return false;
  }
}
