// Fonctions propres à l'application Android. Chargé uniquement quand isNative est vrai.
import { App } from '@capacitor/app';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { AUTO_BACKUP_DIR, AUTO_BACKUP_KEEP, backupsToPrune, fallbackBackupName } from '../domain/autoBackup';
import { backupFileName } from '../domain/backup';
import { todayIso } from '../domain/dates';

/** Partage du fichier de sauvegarde (Drive, Gmail, Fichiers…) via la feuille de partage Android. */
export async function shareBackupFile(json: string, fileName: string, dialogTitle: string): Promise<'shared' | 'cancelled'> {
  const { uri } = await Filesystem.writeFile({ path: fileName, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
  try {
    await Share.share({ title: fileName, files: [uri], dialogTitle });
    return 'shared';
  } catch (err) {
    if (/cancel/i.test(String(err))) return 'cancelled';
    throw err;
  }
}

/**
 * Copie datée dans Documents/CycleDeForce (visible dans l'app Fichiers, conservée après désinstallation),
 * puis suppression des copies au-delà de 14 jours. Renvoie le chemin écrit.
 */
export async function writeAutoBackup(json: string, now: Date = new Date()): Promise<string> {
  // Android 10 et moins : permission de stockage nécessaire ; accordée d'office à partir d'Android 11.
  const permission = await Filesystem.checkPermissions();
  if (permission.publicStorage !== 'granted') {
    const asked = await Filesystem.requestPermissions();
    if (asked.publicStorage !== 'granted') throw new Error('Permission de stockage refusée');
  }
  const date = todayIso(now);
  let path = `${AUTO_BACKUP_DIR}/${backupFileName(date)}`;
  const write = (p: string) =>
    Filesystem.writeFile({ path: p, data: json, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
  try {
    await write(path);
  } catch {
    // Après une réinstallation, le fichier du jour appartient à l'ancienne installation : on en crée un autre.
    path = `${AUTO_BACKUP_DIR}/${fallbackBackupName(date, now)}`;
    await write(path);
  }
  try {
    const { files } = await Filesystem.readdir({ path: AUTO_BACKUP_DIR, directory: Directory.Documents });
    for (const name of backupsToPrune(
      files.map((f) => f.name),
      AUTO_BACKUP_KEEP,
    )) {
      await Filesystem.deleteFile({ path: `${AUTO_BACKUP_DIR}/${name}`, directory: Directory.Documents }).catch(() => undefined);
    }
  } catch {
    // Le ménage est secondaire : la copie du jour est écrite.
  }
  return `Documents/${path}`;
}

/** Bouton retour Android : ferme la feuille ouverte, sinon revient en arrière, sinon quitte. */
export function installBackButton(): void {
  void App.addListener('backButton', ({ canGoBack }) => {
    if (document.querySelector('.sheet')) {
      dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    } else if (canGoBack) {
      history.back();
    } else {
      void App.exitApp();
    }
  });
}

/** Garde l'écran allumé pendant une séance. */
export function keepAwake(on: boolean): void {
  void (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep()).catch(() => undefined);
}

/** Icônes de la barre d'état lisibles sur le thème courant. */
export function setSystemBarsTheme(theme: 'dark' | 'light'): void {
  void SystemBars.setStyle({ style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined);
}

/** Appelé à chaque retour au premier plan / passage en arrière-plan de l'app. */
export function onAppStateChange(listener: (active: boolean) => void): void {
  void App.addListener('appStateChange', ({ isActive }) => listener(isActive));
}
