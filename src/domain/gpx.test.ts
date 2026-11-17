import { describe, expect, it } from 'vitest';
import { gpxFileName, toGpx } from './gpx';
import type { TrackPoint } from './types';

const T0 = Date.UTC(2026, 10, 17, 8, 0, 0);
const track: TrackPoint[] = [
  { lat: 48.853, lon: 2.3499, t: T0, seg: 0, alt: 35.2 },
  { lat: 48.854, lon: 2.3501, t: T0 + 5000, seg: 0, alt: 36 },
  { lat: 48.856, lon: 2.3505, t: T0 + 60_000, seg: 1 },
];

describe('export GPX', () => {
  const gpx = toGpx({ type: 'RUNNING', track }, 'Course <matin> & co');

  it('GPX 1.1 : métadonnées, type reconnu, nom échappé', () => {
    expect(gpx).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<gpx version="1.1"/);
    expect(gpx).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
    expect(gpx).toContain('<type>running</type>');
    expect(gpx).toContain('<name>Course &lt;matin&gt; &amp; co</name>');
    expect(gpx).toContain('<time>2026-11-17T08:00:00.000Z</time></metadata>');
  });

  it('un segment par portion entre deux pauses, altitude quand elle est connue', () => {
    expect(gpx.match(/<trkseg>/g)).toHaveLength(2);
    expect(gpx).toContain('<trkpt lat="48.853" lon="2.3499"><ele>35.2</ele><time>2026-11-17T08:00:00.000Z</time></trkpt>');
    expect(gpx).toContain('<trkpt lat="48.856" lon="2.3505"><time>2026-11-17T08:01:00.000Z</time></trkpt>');
  });

  it('nom de fichier sans accents ni espaces', () => {
    expect(gpxFileName('2026-11-17', 'Course à pied')).toBe('activite-2026-11-17-course-a-pied.gpx');
    expect(gpxFileName('2026-11-17', 'Vélo')).toBe('activite-2026-11-17-velo.gpx');
  });
});
