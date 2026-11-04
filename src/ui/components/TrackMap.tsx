import { useEffect, useRef } from 'preact/hooks';
import type { CircleMarker, Map as LeafletMap, Polyline } from 'leaflet';
import type { TrackPoint } from '../../domain/types';
import { S } from '../strings';

type Leaflet = typeof import('leaflet');

/** Leaflet n'est chargé qu'à la première carte affichée. */
let leaflet: Promise<Leaflet> | undefined;
const loadLeaflet = () =>
  (leaflet ??= Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([m]) => (m as { default?: Leaflet }).default ?? m));

/** Un tableau de points par segment (les pauses coupent le tracé). */
function segments(points: readonly TrackPoint[]): [number, number][][] {
  const out: [number, number][][] = [];
  points.forEach((p, i) => {
    const last = out.at(-1);
    if (!last || points[i - 1]?.seg !== p.seg) out.push([[p.lat, p.lon]]);
    else last.push([p.lat, p.lon]);
  });
  return out;
}

/**
 * Carte OpenStreetMap avec le tracé (segment par segment) et la position courante.
 * `follow` recentre sur la position à chaque point ; sinon la carte cadre tout le tracé.
 * Hors ligne, le fond reste vide mais le tracé s'affiche.
 */
export function TrackMap({ points, current, follow = false }: { points: readonly TrackPoint[]; current?: TrackPoint | null; follow?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<{ L: Leaflet; map: LeafletMap; line: Polyline; dot: CircleMarker } | null>(null);
  const latest = useRef({ points, current, follow });
  latest.current = { points, current, follow };

  const draw = () => {
    const m = map.current;
    if (!m) return;
    const { points: pts, current: here, follow: track } = latest.current;
    const lines = segments(pts);
    m.line.setLatLngs(lines);
    const pos = here ?? pts.at(-1);
    if (pos) {
      m.dot.setLatLng([pos.lat, pos.lon]);
      if (!m.map.hasLayer(m.dot)) m.dot.addTo(m.map);
    }
    if (track && pos) m.map.setView([pos.lat, pos.lon], Math.max(m.map.getZoom(), 16));
    else if (pts.length > 1) m.map.fitBounds(m.line.getBounds(), { padding: [24, 24], maxZoom: 17 });
    else if (pos) m.map.setView([pos.lat, pos.lon], 16);
  };

  useEffect(() => {
    let cancelled = false;
    void loadLeaflet().then((L) => {
      if (cancelled || !el.current) return;
      const instance = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([46.6, 2.4], 5);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(instance);
      const line = L.polyline([], { color: '#e0631f', weight: 5, opacity: 0.9 }).addTo(instance);
      const dot = L.circleMarker([0, 0], { radius: 7, color: '#ffffff', weight: 3, fillColor: '#2a7de1', fillOpacity: 1 });
      map.current = { L, map: instance, line, dot };
      draw();
    });
    return () => {
      cancelled = true;
      map.current?.map.remove();
      map.current = null;
    };
  }, []);

  useEffect(draw, [points.length, current?.t, follow]);

  return <div ref={el} class="track-map" role="img" aria-label={S.track.mapLabel} />;
}
