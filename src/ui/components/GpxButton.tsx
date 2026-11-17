import { useState } from 'preact/hooks';
import type { Activity } from '../../domain/types';
import { shareGpx } from '../backupIO';
import { useApp } from '../context';
import { S } from '../strings';

/** Exporte le tracé GPS de l'activité en fichier GPX (Strava, Garmin Connect, Komoot…). */
export function GpxButton({ activity }: { activity: Pick<Activity, 'type' | 'date' | 'track'> }) {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      if ((await shareGpx(activity)) === 'downloaded') toast(S.track.gpxDownloaded);
    } catch (err) {
      console.error(err);
      toast(S.track.gpxError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" class="btn" disabled={busy} onClick={() => void run()}>
      {S.track.exportGpx}
    </button>
  );
}
