import { useState } from 'preact/hooks';
import { ACTIVITY_COLORS, ACTIVITY_TYPES, averageSpeedKmh, isValidActivity, paceMinPerKm } from '../../domain/activities';
import { newId } from '../../domain/ids';
import type { Activity, ActivityType, IsoDate } from '../../domain/types';
import { commit } from '../actions';
import { DateField, RadioList, TextField } from '../components/fields';
import { NumberField } from '../components/NumberField';
import { Sheet } from '../components/Sheet';
import { TrackMap } from '../components/TrackMap';
import { useApp } from '../context';
import { formatDayMedium, formatDuration, formatKg } from '../format';
import { S } from '../strings';

type Props = ({ date: IsoDate; activity?: undefined } | { activity: Activity; date?: undefined }) & { onClose: () => void };

/** Créer, modifier ou supprimer une activité cardio (vélo, course, marche…), saisie à la main. */
export function ActivitySheet({ date: dateProp, activity: existing, onClose }: Props) {
  const app = useApp();
  const editing = existing !== undefined;

  const [type, setType] = useState<ActivityType>(existing?.type ?? 'RUNNING');
  const [date, setDate] = useState<IsoDate>(existing?.date ?? dateProp!);
  const [distanceKm, setDistanceKm] = useState(existing?.distanceKm ?? 0);
  const [minutes, setMinutes] = useState(existing ? Math.floor(existing.durationSec / 60) : 0);
  const [seconds, setSeconds] = useState(existing ? existing.durationSec % 60 : 0);
  const [note, setNote] = useState(existing?.note ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const durationSec = minutes * 60 + seconds;
  const valid = isValidActivity(distanceKm, durationSec);
  const pace = paceMinPerKm(distanceKm, durationSec);
  const speed = averageSpeedKmh(distanceKm, durationSec);

  const save = async () => {
    if (!valid) return;
    const activity: Activity = {
      id: existing?.id ?? newId(),
      type,
      date,
      distanceKm,
      durationSec,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(existing?.track ? { track: existing.track } : {}),
    };
    if (await commit(app, { saveActivities: [activity] }, editing ? S.activitySheet.updated : S.activitySheet.added)) onClose();
  };

  const remove = async () => {
    if (existing && (await commit(app, { deleteActivityIds: [existing.id] }, S.activitySheet.deleted))) onClose();
  };

  return (
    <Sheet title={editing ? S.activitySheet.editTitle(formatDayMedium(date)) : S.activitySheet.addTitle(formatDayMedium(date))} onClose={onClose}>
      <div class="stack">
        {existing?.track && existing.track.length > 1 && <TrackMap points={existing.track} />}
        <RadioList<ActivityType>
          label={S.activitySheet.type}
          value={type}
          onChange={setType}
          options={ACTIVITY_TYPES.map((t) => ({
            value: t,
            label: S.activityTypes[t],
            children: <span class="swatch" style={{ background: ACTIVITY_COLORS[t] }} />,
          }))}
        />
        <DateField label={S.activitySheet.date} value={date} onChange={setDate} />
        <NumberField label={S.activitySheet.distance} value={distanceKm} onChange={setDistanceKm} step={0.1} min={0} max={999} suffix="km" buttons={false} />
        <div class="button-row start">
          <NumberField label={S.activitySheet.minutes} value={minutes} onChange={setMinutes} step={1} min={0} max={999} buttons={false} />
          <NumberField label={S.activitySheet.seconds} value={seconds} onChange={setSeconds} step={1} min={0} max={59} buttons={false} />
        </div>
        {pace !== null && speed !== null && (
          <p class="muted num">
            {S.activitySheet.pace(formatKg(pace))} · {S.activitySheet.speed(formatKg(speed))} · {formatDuration(durationSec)}
          </p>
        )}
        <TextField label={S.activitySheet.note} value={note} onChange={setNote} />
        <div class="button-row">
          {editing && !confirmingDelete && (
            <button type="button" class="btn danger" onClick={() => setConfirmingDelete(true)}>
              {S.activitySheet.delete}
            </button>
          )}
          <button type="button" class="btn primary" disabled={!valid} onClick={save}>
            {S.activitySheet.save}
          </button>
        </div>
        {confirmingDelete && (
          <div class="stack">
            <p>{S.activitySheet.confirmDelete}</p>
            <div class="button-row">
              <button type="button" class="btn" onClick={() => setConfirmingDelete(false)}>
                {S.common.cancel}
              </button>
              <button type="button" class="btn danger" onClick={remove}>
                {S.activitySheet.confirmDeleteButton}
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
