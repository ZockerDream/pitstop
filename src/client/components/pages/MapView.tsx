// Karte in Spielkoordinaten (svg-y = −Spiel-Y): Mausrad/zwei Finger zoomen, ziehen verschiebt, Klick wählt einen Ort.
import { useEffect, useRef, useState } from 'react';
import type { MapBounds } from '../../../shared/types';
import { Icon } from '../../lib/icons';
import { ALAMO, AREAS, COAST, HILLS, PLACES, pts, RIVER, ROADS } from '../../lib/mapdata';

export interface Pin {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string;
}
type Box = [number, number, number, number];
export const MAP_BASE: Record<'ls' | 'full', Box> = { ls: [-2600, -900, 5400, 4600], full: [-3900, -7500, 8200, 11200] };

export function MapView({ pins, base, imageUrl, bounds, onPin, onPick }: { pins: Pin[]; base: 'ls' | 'full'; imageUrl: string | null; bounds: MapBounds; onPin?: (id: string) => void; onPick?: (x: number, y: number) => void }) {
  const B = MAP_BASE[base];
  const [v, setV] = useState<Box>(B);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; v: Box; moved: boolean } | null>(null);
  useEffect(() => setV(MAP_BASE[base]), [base]);

  const clamp = (n: Box): Box => {
    const w = Math.min(Math.max(n[2], B[2] / 40), B[2]);
    const h = (w * B[3]) / B[2];
    const cx = Math.min(Math.max(n[0] + n[2] / 2, B[0] + w / 2), B[0] + B[2] - w / 2);
    const cy = Math.min(Math.max(n[1] + n[3] / 2, B[1] + h / 2), B[1] + B[3] - h / 2);
    return [cx - w / 2, cy - h / 2, w, h];
  };
  const zoomAt = (f: number, cx?: number, cy?: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const fx = cx === undefined ? 0.5 : (cx - r.left) / r.width;
    const fy = cy === undefined ? 0.5 : (cy - r.top) / r.height;
    setV((o) => {
      const px = o[0] + fx * o[2], py = o[1] + fy * o[3], w = o[2] * f, h = o[3] * f;
      return clamp([px - fx * w, py - fy * h, w, h]);
    });
  };
  useEffect(() => {
    const el = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(Math.exp(Math.max(-300, Math.min(300, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY)) * 0.0022), e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const s = v[2] / 5400; // Marker behalten ihre Bildschirmgröße
  const toGame = (cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return [v[0] + ((cx - r.left) / r.width) * v[2], -(v[1] + ((cy - r.top) / r.height) * v[3])];
  };
  const ns = { vectorEffect: 'non-scaling-stroke' as const };

  return (
    <div className="map" style={{ cursor: onPick ? 'crosshair' : 'grab', touchAction: v[2] < B[2] ? 'none' : 'pan-y' }}>
      <svg
        ref={svgRef}
        viewBox={v.join(' ')}
        style={{ aspectRatio: `${B[2]}/${B[3]}` }}
        role="img"
        aria-label="Karte mit Einsätzen, mit Mausrad zoomen"
        onPointerDown={(e) => { if (e.button === 0) drag.current = { x: e.clientX, y: e.clientY, v, moved: false }; }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          if (!d.moved && Math.hypot(dx, dy) < 5) return;
          d.moved = true;
          const k = d.v[2] / svgRef.current!.getBoundingClientRect().width;
          setV(clamp([d.v[0] - dx * k, d.v[1] - dy * k, d.v[2], d.v[3]]));
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved && onPick && !(e.target as Element).closest('[data-pin]')) {
            const [x, y] = toGame(e.clientX, e.clientY);
            onPick(Math.round(x), Math.round(y));
          }
        }}
      >
        <rect x={-9000} y={-12000} width={18000} height={20000} fill="var(--map-water)" />
        {imageUrl ? (
          <image href={imageUrl} x={bounds.x0} y={-bounds.y1} width={bounds.x1 - bounds.x0} height={bounds.y1 - bounds.y0} preserveAspectRatio="none" />
        ) : (
          <>
            <polygon points={pts(COAST)} fill="var(--map-land)" stroke="var(--line-2)" strokeWidth={1.5} {...ns} />
            {HILLS.map((h, i) => <polygon key={i} points={pts(h)} fill="var(--map-hill)" />)}
            {AREAS.map((h, i) => <polygon key={i} points={pts(h)} fill="var(--map-hill)" stroke="var(--line-2)" strokeWidth={1} {...ns} />)}
            <polygon points={pts(ALAMO)} fill="var(--map-water)" stroke="var(--line-2)" strokeWidth={1.2} {...ns} />
            <polyline points={pts(RIVER)} fill="none" stroke="var(--map-water)" strokeWidth={7} strokeLinecap="round" {...ns} />
            <g fill="none" stroke="var(--map-road)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
              {ROADS.map((r, i) => <polyline key={i} points={pts(r)} {...ns} />)}
            </g>
            {PLACES.map(([n, x, y, t]) => (
              <g key={n} transform={`translate(${x} ${-y}) scale(${s})`}>
                <text textAnchor="middle" fontSize={t === 's' ? 95 : 85} fill={t === 'w' ? 'var(--info)' : 'var(--map-text)'} fontWeight={t === 's' ? 600 : 500} opacity={t === 'r' ? 0.75 : 1} fontStyle={t === 'w' ? 'italic' : undefined}>
                  {n.toUpperCase()}
                </text>
              </g>
            ))}
          </>
        )}
        {pins.map((p) => {
          const w = p.label.length * 82 * 0.62 + 90;
          return (
            <g key={p.id} data-pin transform={`translate(${p.x} ${-p.y}) scale(${s})`} style={{ cursor: 'pointer' }} onClick={() => onPin?.(p.id)}>
              <circle r={125} fill={p.color} opacity={0.22} />
              <circle r={52} fill={p.color} stroke="var(--bg)" strokeWidth={13} />
              <rect x={73} y={-70} width={w} height={140} rx={33} fill="var(--panel)" stroke="var(--line-2)" strokeWidth={5} />
              <text x={118} y={30} fontSize={82} fill="var(--fg)" fontFamily="var(--font-data)" fontWeight={700}>{p.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="mapui">
        <button className="ibtn" onClick={() => zoomAt(0.6)} aria-label="Hineinzoomen"><Icon name="plus" size={15} /></button>
        <button className="ibtn" onClick={() => zoomAt(1 / 0.6)} aria-label="Herauszoomen"><Icon name="minus" size={15} /></button>
        <button className="ibtn" onClick={() => setV(B)} aria-label="Ganzen Ausschnitt zeigen"><Icon name="refresh" size={15} /></button>
      </div>
    </div>
  );
}
