import { ACTIVITY_COLORS, ACTIVITY_GLYPH, averageSpeedKmh, paceMinPerKm } from '../../domain/activities';
import type { Activity } from '../../domain/types';
import { formatDuration, formatKg } from '../format';
import { S } from '../strings';

/** Pastille du calendrier pour une activité cardio, même contrat visuel que SessionDot. */
export function ActivityDot({ activity }: { activity: Activity }) {
  const label = S.activityTypes[activity.type];
  return (
    <span class="dot" style={{ '--tpl': ACTIVITY_COLORS[activity.type] }} title={label}>
      {ACTIVITY_GLYPH[activity.type]}
    </span>
  );
}

export function ActivityCard({ activity, onOpen }: { activity: Activity; onOpen: () => void }) {
  const pace = paceMinPerKm(activity.distanceKm, activity.durationSec);
  const speed = averageSpeedKmh(activity.distanceKm, activity.durationSec);
  const label = S.activityTypes[activity.type];

  return (
    <article class="session-card" style={{ '--tpl': ACTIVITY_COLORS[activity.type] }}>
      <button type="button" class="session-card-main" aria-label={S.activityCard.actions(label)} onClick={onOpen}>
        <span class="session-card-title">
          <span class="session-name">{label}</span>
        </span>
        <span class="session-exercises muted">
          {formatKg(activity.distanceKm)}{' '}km · {formatDuration(activity.durationSec)}
          {pace !== null && speed !== null && ` · ${S.activitySheet.pace(formatKg(pace))} · ${S.activitySheet.speed(formatKg(speed))}`}
        </span>
        {activity.note && <span class="session-tonnage muted">{activity.note}</span>}
      </button>
    </article>
  );
}
