import { useEffect, useState } from 'preact/hooks';
import type { SessionTemplate } from '../../domain/types';
import { TEMPLATE_IDS } from '../../seed';
import { useApp } from '../context';
import { S } from '../strings';

const NATIVE_ORDER: string[] = Object.values(TEMPLATE_IDS);

function order(t: SessionTemplate): number {
  const i = NATIVE_ORDER.indexOf(t.id);
  return i === -1 ? NATIVE_ORDER.length : i;
}

export function TemplatesScreen() {
  const { repo } = useApp();
  const [templates, setTemplates] = useState<SessionTemplate[] | null>(null);

  useEffect(() => {
    repo.listTemplates().then((list) => {
      setTemplates(list.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name, 'fr')));
    });
  }, [repo]);

  if (!templates) return <p class="muted">{S.loading}</p>;

  return (
    <div class="stack">
      <ul class="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {templates.map((t) => (
          <li key={t.id} class="card template-row">
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
          </li>
        ))}
      </ul>
      <p class="muted">{S.templates.comingSoon}</p>
    </div>
  );
}
