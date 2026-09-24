import { useRef } from 'preact/hooks';

const MOVE_TOLERANCE = 10;

/** Tap court → onTap ; appui long (500 ms) → onLongPress avec retour haptique. */
export function useLongPress(onTap: () => void, onLongPress: () => void, delay = 500) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };

  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(30);
        onLongPress();
      }, delay);
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_TOLERANCE) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClick: (e: MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        fired.current = false;
        return;
      }
      onTap();
    },
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  };
}
