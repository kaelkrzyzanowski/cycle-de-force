import { useState } from 'preact/hooks';
import { newId } from '../../domain/ids';
import { emptyTemplate, TEMPLATE_COLORS } from '../../domain/templates';
import type { SessionTemplate } from '../../domain/types';
import { TEMPLATE_IDS } from '../../seed';
import { TextField } from '../components/fields';
import { NumberField } from '../components/NumberField';
import { Sheet } from '../components/Sheet';
import { useApp, useData } from '../context';
import { href, navigate } from '../router';
import { S } from '../strings';

const NATIVE_ORDER: string[] = Object.values(TEMPLATE_IDS);

function order(t: SessionTemplate): number {
  const i = NATIVE_ORDER.indexOf(t.id);
  return i === -1 ? NATIVE_ORDER.length : i;
}

export function TemplatesScreen() {
  const app = useApp();
  const templates = useData((repo) => repo.listTemplates(), []);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState(7);

  if (!templates) return <p class="muted">{S.loading}</p>;
  const sorted = [...templates].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name, 'fr'));

  const create = async () => {
    const color = TEMPLATE_COLORS[templates.filter((t) => !t.native).length % TEMPLATE_COLORS.length] ?? '#6b7280';
    const template = emptyTemplate(name.trim(), weeks, color, newId);
    await app.repo.saveTemplate(template);
    app.refresh();
    app.toast(S.templates.created(template.name));
    navigate(href.template(template.id));
  };

  return (
    <div class="stack">
      <ul class="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {sorted.map((t) => (
          <li key={t.id}>
            <a class="card template-row link-card" href={href.template(t.id)}>
              <span class="swatch" style={{ background: t.color }} />
              <div>
                <div class="name">
                  {t.name}
                  <span class="badge">{t.native ? S.templates.native : S.templates.custom}</span>
                </div>
                <div class="muted">
                  {S.templates.weeks(t.weeksCount)} · {S.templates.exercisesWeek1(t.weeks[1]?.length ?? 0)}
                </div>
              </div>
              <span aria-hidden="true" class="chevron">
                ›
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div class="button-row sticky-actions">
        <button type="button" class="btn primary" onClick={() => setCreating(true)}>
          + {S.templates.new}
        </button>
      </div>

      {creating && (
        <Sheet title={S.templates.new} onClose={() => setCreating(false)}>
          <TextField label={S.templates.newName} value={name} onChange={setName} />
          <NumberField label={S.templates.newWeeks} value={weeks} onChange={setWeeks} min={1} max={16} />
          <button type="button" class="btn primary" disabled={name.trim() === ''} onClick={() => void create()}>
            {S.templates.create}
          </button>
        </Sheet>
      )}
    </div>
  );
}
