import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { S } from '../strings';

/** Carte de graphique : titre, sous-titre, légende, graphique, puis les données en tableau. */
export function ChartCard({
  title,
  subtitle,
  legend,
  children,
  table,
}: {
  title: string;
  subtitle?: string;
  legend?: ComponentChildren;
  children: ComponentChildren;
  table?: { head: string[]; rows: (string | number)[][] };
}) {
  return (
    <section class="card stack tight chart-card">
      <h2 class="card-title">{title}</h2>
      {subtitle && <p class="muted chart-subtitle">{subtitle}</p>}
      {legend}
      {children}
      {table && table.rows.length > 0 && (
        <details class="chart-table">
          <summary>{S.stats.showData}</summary>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  {table.head.map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j} class="num">{cell}</td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

/** Légende : pastille ou trait de couleur à côté d'un texte à l'encre normale. */
export function Legend({ items }: { items: { label: string; color: string; glyph?: string; line?: boolean }[] }) {
  return (
    <ul class="legend">
      {items.map((it) => (
        <li key={it.label}>
          <span class={it.line ? 'key-line' : 'key-swatch'} style={{ background: `var(${it.color})` }}>
            {it.glyph && <span aria-hidden="true">{it.glyph}</span>}
          </span>
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export interface StackRow {
  key: string;
  label: string;
  segments: { key: string; label: string; glyph: string; color: string; value: number }[];
  note?: string;
}

/** Barres empilées à 100 %, espacées de 2 px ; libellé dans le segment seulement s'il y tient. */
export function StackedBars({ rows }: { rows: readonly StackRow[] }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <ul class="stack-rows">
      {rows.map((row) => {
        const total = row.segments.reduce((t, s) => t + s.value, 0);
        const shown = row.segments.filter((s) => s.value > 0);
        const tip = shown.find((s) => `${row.key}|${s.key}` === active);
        return (
          <li key={row.key}>
            <div class="stack-head">
              <span>{row.label}</span>
              <span class="muted">{row.note}</span>
            </div>
            <div class="stack-bar">
              {shown.map((s) => {
                const pct = total ? (s.value / total) * 100 : 0;
                const id = `${row.key}|${s.key}`;
                return (
                  <button
                    key={s.key}
                    type="button"
                    class={`stack-seg${active === id ? ' is-active' : ''}`}
                    style={{ flexGrow: s.value, background: `var(${s.color})` }}
                    aria-label={`${row.label} · ${s.label} : ${s.value} (${Math.round(pct)} %)`}
                    onClick={() => setActive(active === id ? null : id)}
                    onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(id)}
                    onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
                  >
                    {pct >= 12 && (
                      <span class="seg-label">
                        {s.glyph} {Math.round(pct)} %
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {tip && (
              <p class="stack-tip num" role="status">
                {tip.glyph} {tip.label} : {tip.value} ({Math.round((tip.value / total) * 100)} %)
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Barres horizontales triées ; le nom (avec sa pastille) et la valeur sont en texte. */
export function HBars({
  rows,
  formatValue,
}: {
  rows: readonly { key: string; label: string; swatch: string; value: number; detail: string }[];
  formatValue: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul class="hbars">
      {rows.map((r) => (
        <li key={r.key}>
          <div class="hbar-head">
            <span>
              <span class="dot-swatch" style={{ background: r.swatch }} /> {r.label} <span class="muted">· {r.detail}</span>
            </span>
            <strong class="num">{formatValue(r.value)}</strong>
          </div>
          <div class="hbar-track">
            <div class="hbar" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tuile chiffrée : libellé, valeur (chiffres proportionnels). */
export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div class="stat-tile">
      <span class="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
