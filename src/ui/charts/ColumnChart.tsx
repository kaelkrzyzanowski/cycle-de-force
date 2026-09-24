import { useState } from 'preact/hooks';
import { formatTick, linear, niceTicks } from './scale';
import { useWidth } from './useWidth';

export interface Column {
  key: string;
  /** Graduation de l'axe horizontal (« S1 », « 22/09 »). */
  label: string;
  value: number;
  /** Texte de l'infobulle. */
  tip: string;
}

interface Props {
  data: readonly Column[];
  ariaLabel: string;
  formatValue: (v: number) => string;
  height?: number;
}

const M = { top: 22, right: 8, bottom: 24, left: 40 };
const MAX_BAR = 24;
const RADIUS = 4;

/** Colonne à bout arrondi (4 px), carrée sur la ligne de base. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Histogramme d'une série : infobulle au survol / au tap, seule la valeur max est étiquetée. */
export function ColumnChart({ data, ariaLabel, formatValue, height = 190 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(0, max || 1, 3).filter((t) => t >= 0);
  const top = ticks.at(-1) ?? 1;
  const y = linear([0, top], [M.top + plotH, M.top]);
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.min(MAX_BAR, band * 0.64);
  const every = Math.max(1, Math.ceil(28 / Math.max(band, 1)));
  const maxIndex = data.findIndex((d) => d.value === max && max > 0);
  const current = active === null ? null : data[active];

  const pick = (e: PointerEvent) => {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left - M.left) / (band || 1));
    setActive(i >= 0 && i < data.length ? i : null);
  };

  return (
    <div class="chart" ref={ref}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setActive(Math.min(data.length - 1, (active ?? -1) + 1));
            if (e.key === 'ArrowLeft') setActive(Math.max(0, (active ?? data.length) - 1));
            if (e.key === 'Escape') setActive(null);
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line class="grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
              <text class="tick" x={M.left - 6} y={y(t)} text-anchor="end" dominant-baseline="middle">
                {formatTick(t)}
              </text>
            </g>
          ))}
          <line class="baseline" x1={M.left} x2={width - M.right} y1={y(0)} y2={y(0)} />
          {data.map((d, i) => {
            const cx = M.left + band * i + band / 2;
            const h = y(0) - y(d.value);
            return (
              <g key={d.key}>
                {i === active && <rect class="hover-band" x={M.left + band * i} y={M.top} width={band} height={plotH} />}
                {d.value > 0 && <path class="column" d={columnPath(cx - barW / 2, y(d.value), barW, h)} />}
                {i % every === 0 && (
                  <text class="tick" x={cx} y={height - 6} text-anchor="middle">
                    {d.label}
                  </text>
                )}
                {i === maxIndex && (
                  <text class="value-label" x={cx} y={y(d.value) - 6} text-anchor="middle">
                    {formatTick(d.value)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {current && active !== null && (
        <div
          class="chart-tip"
          style={{ left: `${Math.min(Math.max(M.left + band * active + band / 2, 70), width - 70)}px` }}
          role="status"
        >
          <strong class="num">{formatValue(current.value)}</strong>
          <span>{current.tip}</span>
        </div>
      )}
    </div>
  );
}
