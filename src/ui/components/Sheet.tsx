import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { S } from '../strings';

let sheetCount = 0;

/** Panneau bas modal : actions à portée du pouce. Échap ou tap sur le fond pour fermer. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useRef(`sheet-title-${++sheetCount}`).current;
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, []);

  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={panel}>
        <div class="sheet-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" class="icon-btn" aria-label={S.common.close} onClick={onClose}>
            ✕
          </button>
        </div>
        <div class="sheet-body">{children}</div>
      </div>
    </div>
  );
}
