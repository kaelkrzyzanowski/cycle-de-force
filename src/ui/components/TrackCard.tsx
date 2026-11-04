import { formatClock, formatKg } from '../format';
import { href } from '../router';
import { S } from '../strings';
import { recording, useRecording } from '../trackStore';

/** Accès à l'enregistrement GPS, ou état de l'activité en cours. */
export function TrackCard() {
  const rec = useRecording();
  if (!rec) {
    return (
      <a class="btn" href={href.track()}>
        {S.track.record}
      </a>
    );
  }
  return (
    <a class="card link-card track-banner" href={href.track()}>
      <strong>{S.track.inProgress}</strong>
      <span class="num">
        {S.activityTypes[rec.type]} · {formatClock(recording.elapsedMs())} · {formatKg(Math.floor(recording.distanceKm() * 100) / 100)} km
        {rec.clock.runningSince === null && !rec.finished ? ` · ${S.track.paused}` : ''}
      </span>
      <span class="muted">{S.track.open} ›</span>
    </a>
  );
}
