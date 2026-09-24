import { S } from '../strings';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export function TodayScreen() {
  return (
    <div class="stack">
      <h2 style={{ margin: 0, textTransform: 'capitalize' }}>{dateFormat.format(new Date())}</h2>
      <p class="card">{S.today.noSession}</p>
      <p class="muted">{S.today.comingSoon}</p>
    </div>
  );
}
