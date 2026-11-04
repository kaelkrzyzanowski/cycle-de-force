import type { ComponentChildren } from 'preact';
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

/** Tuile chiffrée : libellé, valeur (chiffres proportionnels). */
export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div class="stat-tile">
      <span class="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
