import { useState } from 'preact/hooks';
import { formatTick, linear, niceTicks } from './scale';
import { useWidth } from './useWidth';

export interface LinePoint {
  /** Date ISO « AAAA-MM-JJ ». */
  date: string;
  value: number;
  /** Point de prolongement (courbe en marches) : tracé, mais sans marqueur ni infobulle. */
  carried?: boolean;
}

export interface LineSeries {
  id: string;
  label: string;
  /** Variable CSS de la couleur, ex. « --series-1 ». */
  color: string;
  points: readonly LinePoint[];
}

interface Props {
  series: readonly LineSeries[];
  ariaLabel: string;
  formatValue: (v: number) => string;
  formatDate: (iso: string) => string;
  /** Marches d'escalier (valeur constante jusqu'au changement suivant). */
  step?: boolean;
  height?: number;
}

const M = { top: 14, right: 64, bottom: 24, left: 40 };
const DAY = 86_400_000;
const time = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

/** Courbes sur un seul axe (même unité), réticule + infobulle, étiquettes en bout de ligne. */
export function LineChart({ series, ariaLabel, formatValue, formatDate, step = false, height = 210 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<string | null>(null);
  const all = series.flatMap((s) => s.points);
  const dates = [...new Set(all.map((p) => p.date))].sort();
  const values = all.map((p) => p.value);
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const first = dates[0];
  const last = dates.at(-1);
  if (!first || !last) return null;

  const t0 = time(first);
  const t1 = Math.max(time(last), t0 + DAY);
  const x = linear([t0, t1], [M.left, M.left + plotW]);
  const ticks = niceTicks(Math.min(...values), Math.max(...values), 3);
  const y = linear([ticks[0] ?? 0, ticks.at(-1) ?? 1], [M.top + plotH, M.top]);

  const path = (pts: readonly LinePoint[]) =>
    pts
      .map((p, i) => {
        const px = x(time(p.date));
        const py = y(p.value);
        if (i === 0) return `M${px},${py}`;
        return step ? `H${px}V${py}` : `L${px},${py}`;
      })
      .join('');

  // Étiquettes de fin : seulement si elles ne se chevauchent pas (sinon la légende suffit).
  const ends = series
    .map((s) => ({ s, p: s.points.at(-1) }))
    .filter((e): e is { s: LineSeries; p: LinePoint } => e.p !== undefined)
    .map((e) => ({ ...e, py: y(e.p.value) }))
    .sort((a, b) => a.py - b.py);
  const endLabelsFit = ends.every((e, i) => i === 0 || e.py - (ends[i - 1]?.py ?? 0) >= 14);

  const pick = (e: PointerEvent) => {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best: string | null = null;
    let dist = Infinity;
    for (const d of dates) {
      const dd = Math.abs(x(time(d)) - px);
      if (dd < dist) {
        dist = dd;
        best = d;
      }
    }
    setActive(best);
  };
  const index = active ? dates.indexOf(active) : -1;
  const tipX = active ? x(time(active)) : 0;
  const xLabels = dates.length <= 2 ? dates : [first, dates[Math.floor(dates.length / 2)] ?? first, last];

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
            if (e.key === 'ArrowRight') setActive(dates[Math.min(dates.length - 1, index + 1)] ?? null);
            if (e.key === 'ArrowLeft') setActive(dates[Math.max(0, (index === -1 ? dates.length : index) - 1)] ?? null);
            if (e.key === 'Escape') setActive(null);
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line class="grid" x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} />
              <text class="tick" x={M.left - 6} y={y(t)} text-anchor="end" dominant-baseline="middle">
                {formatTick(t)}
              </text>
            </g>
          ))}
          {[...new Set(xLabels)].map((d, i, arr) => (
            <text
              key={d}
              class="tick"
              x={x(time(d))}
              y={height - 6}
              text-anchor={arr.length > 1 && i === 0 ? 'start' : i === arr.length - 1 && arr.length > 1 ? 'end' : 'middle'}
            >
              {formatDate(d)}
            </text>
          ))}
          {active && <line class="crosshair" x1={tipX} x2={tipX} y1={M.top} y2={M.top + plotH} />}
          {series.map((s) => (
            <g key={s.id} style={{ '--c': `var(${s.color})` }}>
              <path class="line" d={path(s.points)} />
              {s.points.length <= 40 &&
                s.points
                  .filter((p) => !p.carried)
                  .map((p) => (
                  <circle
                    key={p.date}
                    class={`marker${p.date === active ? ' is-active' : ''}`}
                    cx={x(time(p.date))}
                    cy={y(p.value)}
                    r={p.date === active ? 5 : 4}
                  />
                ))}
            </g>
          ))}
          {endLabelsFit &&
            ends.map(({ s, p, py }) => (
              <text key={s.id} class="end-label" x={x(time(p.date)) + 8} y={py} dominant-baseline="middle">
                {formatTick(p.value)}
              </text>
            ))}
        </svg>
      )}
      {active && (
        <div class="chart-tip" style={{ left: `${Math.min(Math.max(tipX, 80), width - 80)}px` }} role="status">
          <span>{formatDate(active)}</span>
          {series.map((s) => {
            const p = s.points.find((q) => q.date === active && !q.carried);
            return (
              p && (
                <span key={s.id} class="tip-row">
                  <span class="key-line" style={{ background: `var(${s.color})` }} />
                  {s.label} <strong class="num">{formatValue(p.value)}</strong>
                </span>
              )
            );
          })}
        </div>
      )}
    </div>
  );
}
