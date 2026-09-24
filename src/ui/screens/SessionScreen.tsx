import { displayKg, displayReps } from '../../domain/load';
import { sessionTotals } from '../../domain/totals';
import type { Cycle, Maxes, Session } from '../../domain/types';
import { useApp, useData } from '../context';
import { formatDayLong, formatKg, formatRule, formatTonnage } from '../format';
import { S } from '../strings';

const NO_MAX: Maxes = { S: 0, B: 0, D: 0 };

/** Lecture seule en phase 2 ; la saisie des séries arrive en phase 3. */
export function SessionScreen({ id }: { id: string }) {
  const { settings } = useApp();
  const data = useData<{ session: Session | undefined; cycle: Cycle | undefined }>(async (repo) => {
    const session = await repo.getSession(id);
    return { session, cycle: session?.cycleId ? await repo.getCycle(session.cycleId) : undefined };
  }, [id]);
  if (!data) return <p class="muted">{S.loading}</p>;
  const { session, cycle } = data;
  if (!session) return <p class="card">{S.session.notFound}</p>;

  const max = cycle?.max ?? NO_MAX;
  const totals = sessionTotals(session, max, settings.rounding);

  return (
    <div class="stack">
      <section class="stack tight">
        <h2>{session.name}</h2>
        <p class="muted">
          {formatDayLong(session.date)} ·{' '}
          {cycle && session.cycleWeek ? S.session.inCycle(cycle.name, session.cycleWeek) : S.session.outOfCycle}
        </p>
        {totals.reps > 0 && (
          <p class="num">
            {formatTonnage(totals.tonnage)} · {totals.reps} reps · {formatKg(totals.kgPerRep)} kg/rep
          </p>
        )}
      </section>

      {session.exercises.length === 0 && <p class="card muted">{S.session.empty}</p>}

      {session.exercises.map((ex) => (
        <section key={ex.id} class="card stack tight">
          <h3>{ex.name}</h3>
          <ol class="set-row">
            {ex.sets.map((set) => {
              const kg = displayKg(set, max, settings.rounding);
              const rule = formatRule(set.load);
              return (
                <li key={set.index} class={`set-pill st-${set.status}`}>
                  <span class="set-index">S{set.index + 1}</span>
                  <span class="set-main num">
                    {displayReps(set)} × {kg === null ? S.session.toEnter : `${formatKg(kg)} kg`}
                  </span>
                  {rule && <span class="set-rule">{rule}</span>}
                </li>
              );
            })}
          </ol>
          {ex.note && <p class="muted">{ex.note}</p>}
        </section>
      ))}

      <p class="muted">{S.session.comingSoon}</p>
    </div>
  );
}
