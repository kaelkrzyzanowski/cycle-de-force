import type { Changes } from '../data/repository';
import { renameTemplateSessions } from '../domain/templates';
import type { SessionTemplate } from '../domain/types';
import type { AppContextValue, ToastAction } from './context';
import { S } from './strings';

export function templatesById(list: readonly SessionTemplate[]): Map<string, SessionTemplate> {
  return new Map(list.map((t) => [t.id, t]));
}

const ALL_DATES = ['0000-01-01', '9999-12-31'] as const;

/**
 * Enregistre un modèle ; s'il a changé de nom, renomme aussi ses séances qui portaient l'ancien nom.
 * Renvoie le nombre de séances renommées.
 */
export async function saveTemplateWithRename(app: AppContextValue, template: SessionTemplate, oldName: string): Promise<number> {
  const renamed =
    oldName === template.name
      ? []
      : renameTemplateSessions(await app.repo.listSessionsBetween(ALL_DATES[0], ALL_DATES[1]), template.id, oldName, template.name);
  await app.repo.saveTemplate(template);
  if (renamed.length > 0) await app.repo.applyChanges({ saveSessions: renamed });
  return renamed.length;
}

/** Écrit un lot de changements, rafraîchit l'affichage et confirme par un toast. */
export async function commit(app: AppContextValue, changes: Changes, message: string, action?: ToastAction): Promise<boolean> {
  try {
    await app.repo.applyChanges(changes);
    app.refresh();
    app.toast(message, action);
    navigator.vibrate?.(15);
    return true;
  } catch (err) {
    console.error(err);
    app.toast(S.saveError);
    return false;
  }
}
