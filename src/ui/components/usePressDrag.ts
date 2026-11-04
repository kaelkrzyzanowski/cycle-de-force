import { useEffect, useRef } from 'preact/hooks';

const MOVE_TOLERANCE = 10;
const DRAG_THRESHOLD = 6;

export interface DragHandlers {
  start(x: number, y: number): void;
  move(x: number, y: number): void;
  end(x: number, y: number): void;
  cancel(): void;
}

type Phase = 'idle' | 'pending' | 'armed' | 'dragging';

/**
 * Tap court → onTap. Appui long : si on relâche sans bouger → onLongPress ;
 * si on glisse ensuite → glisser-déposer (drag). Sans `drag`, l'appui long agit tout de suite.
 * Un glissement avant l'appui long reste un défilement normal de la page.
 */
export function usePressDrag(onTap: () => void, onLongPress: () => void, drag?: DragHandlers, delay = 450) {
  const phase = useRef<Phase>('idle');
  const origin = useRef({ x: 0, y: 0 });
  const timer = useRef<number | undefined>(undefined);
  const suppressClick = useRef(false);
  const handlers = useRef({ onTap, onLongPress, drag });
  handlers.current = { onTap, onLongPress, drag };

  // Une fois la carte « saisie », on bloque le défilement de la page pour suivre le doigt.
  const blockScroll = (e: TouchEvent) => {
    if (phase.current === 'armed' || phase.current === 'dragging') e.preventDefault();
  };
  const reset = () => {
    window.clearTimeout(timer.current);
    phase.current = 'idle';
    removeEventListener('touchmove', blockScroll);
  };
  useEffect(() => reset, []);

  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return;
      reset();
      phase.current = 'pending';
      suppressClick.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      addEventListener('touchmove', blockScroll, { passive: false });
      timer.current = window.setTimeout(() => {
        navigator.vibrate?.(30);
        suppressClick.current = true;
        if (handlers.current.drag) {
          phase.current = 'armed';
        } else {
          reset();
          handlers.current.onLongPress();
        }
      }, delay);
    },
    onPointerMove: (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y);
      if (phase.current === 'pending' && dist > MOVE_TOLERANCE) reset();
      else if (phase.current === 'armed' && dist > DRAG_THRESHOLD && handlers.current.drag) {
        phase.current = 'dragging';
        try {
          // Le doigt peut quitter la carte : elle continue de recevoir les mouvements.
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
        } catch {
          // pointeur déjà relâché ou non capturable : le suivi continue tant qu'il reste sur la carte
        }
        handlers.current.drag.start(e.clientX, e.clientY);
      } else if (phase.current === 'dragging') {
        handlers.current.drag?.move(e.clientX, e.clientY);
      }
    },
    onPointerUp: (e: PointerEvent) => {
      const was = phase.current;
      reset();
      if (was === 'armed') handlers.current.onLongPress();
      else if (was === 'dragging') handlers.current.drag?.end(e.clientX, e.clientY);
    },
    onPointerCancel: () => {
      const was = phase.current;
      reset();
      if (was === 'dragging') handlers.current.drag?.cancel();
    },
    onClick: (e: MouseEvent) => {
      if (suppressClick.current) {
        e.preventDefault();
        suppressClick.current = false;
        return;
      }
      handlers.current.onTap();
    },
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  };
}
