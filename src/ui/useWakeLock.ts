import { useEffect } from 'preact/hooks';
import { isNative, loadNative } from '../platform';

/** Garde l'écran allumé pendant une séance : plugin natif dans l'app, API Wake Lock dans le navigateur. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (isNative) {
      void loadNative().then((native) => native.keepAwake(true));
      return () => void loadNative().then((native) => native.keepAwake(false));
    }
    if (!('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const request = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (released) void l.release();
          else lock = l;
        })
        .catch(() => undefined);
    };
    // Le verrou est perdu quand l'app passe en arrière-plan : on le redemande au retour.
    document.addEventListener('visibilitychange', request);
    request();
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', request);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}
