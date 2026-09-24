import { useEffect } from 'preact/hooks';

/** Garde l'écran allumé pendant une séance, si l'API existe ; silencieux sinon. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
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
