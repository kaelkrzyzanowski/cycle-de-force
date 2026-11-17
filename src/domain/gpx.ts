import type { Activity, ActivityType, TrackPoint } from './types';

/** Type d'activité GPX reconnu par les applications courantes (Strava, Garmin Connect…). */
const GPX_TYPE: Record<ActivityType, string> = {
  RUNNING: 'running',
  CYCLING: 'cycling',
  WALKING: 'walking',
  SWIMMING: 'swimming',
  OTHER: 'other',
};

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const iso = (t: number): string => new Date(t).toISOString();

function trackPoint(p: TrackPoint): string {
  const ele = p.alt !== undefined ? `<ele>${p.alt}</ele>` : '';
  return `      <trkpt lat="${p.lat}" lon="${p.lon}">${ele}<time>${iso(p.t)}</time></trkpt>`;
}

/** Tracé au format GPX 1.1 : un segment par portion entre deux pauses, altitude et heure de chaque point. */
export function toGpx(activity: Pick<Activity, 'type' | 'track'>, name: string): string {
  const points = activity.track ?? [];
  const segments: TrackPoint[][] = [];
  for (const p of points) {
    const last = segments.at(-1);
    if (last && last.at(-1)!.seg === p.seg) last.push(p);
    else segments.push([p]);
  }
  const first = points[0];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Cycle de force" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${escapeXml(name)}</name>${first ? `<time>${iso(first.t)}</time>` : ''}</metadata>`,
    '  <trk>',
    `    <name>${escapeXml(name)}</name>`,
    `    <type>${GPX_TYPE[activity.type]}</type>`,
    ...segments.flatMap((seg) => ['    <trkseg>', ...seg.map(trackPoint), '    </trkseg>']),
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n');
}

/** « activite-2026-11-17-course-a-pied.gpx » */
export function gpxFileName(date: string, typeLabel: string): string {
  const slug = typeLabel
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `activite-${date}-${slug}.gpx`;
}
