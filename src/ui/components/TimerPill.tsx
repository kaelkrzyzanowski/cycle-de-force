import { Icon } from '../Icon';
import { formatCountdown } from '../format';
import { href } from '../router';
import { S } from '../strings';
import { useTimer } from '../timer';
import { useWakeLock } from '../useWakeLock';

/**
 * Temps restant du minuteur dans la barre du haut, sur tous les écrans (sauf Chrono) : un tap y ramène.
 * Garde aussi l'écran allumé pendant le décompte, pour que la fin sonne.
 */
export function TimerPill({ hidden }: { hidden: boolean }) {
  const { state, remainingMs } = useTimer();
  useWakeLock(state.phase === 'running');
  if (hidden || state.phase === 'idle') return null;
  const done = state.phase === 'done';
  const text = done ? S.chrono.timeUp : formatCountdown(remainingMs);
  return (
    <a class={`timer-pill num${done ? ' is-done' : ''}`} href={href.chrono()} aria-label={done ? S.chrono.pillDone : S.chrono.pill(text)}>
      <Icon name="chrono" size={18} />
      {text}
    </a>
  );
}
