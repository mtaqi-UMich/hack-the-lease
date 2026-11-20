'use client';
import { LYFT_ZONE } from '@/lib/zones';
// Leaflet + OpenStreetMap tiles; falls back to the stylised map from design/Map.dc.html if tiles fail.
import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { C } from './ui';

export interface Pin { id: string; lat: number; lng: number; label: string; on: boolean }
const CENTRAL: [number, number] = [42.2768, -83.7382];
const NORTH: [number, number] = [42.2914, -83.7174];

function Stylised({ pins, onPick }: { pins: Pin[]; onPick: (id: string) => void }) {
  // project lat/lng into the design's 1000×700 box
  const box = { latMin: 42.252, latMax: 42.305, lngMin: -83.77, lngMax: -83.695 };
  const xy = (lat: number, lng: number) => [((lng - box.lngMin) / (box.lngMax - box.lngMin)) * 100, ((box.latMax - lat) / (box.latMax - box.latMin)) * 100];
  const [cx, cy] = xy(...CENTRAL), [nx, ny] = xy(...NORTH);
  return (
    <div className="absolute inset-0">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label="Stylised map of Ann Arbor with campus areas and the Lyft Pass coverage area">
        <rect width="100" height="100" fill="#EDEAE3" />
        <path d="M0 52 C 20 48, 35 40, 55 30 S 85 15, 100 12" stroke="#B7F3F7" strokeWidth="2.2" fill="none" />
        <ellipse cx={cx} cy={cy} rx="9" ry="8" fill={C.lime} opacity="0.55" />
        <ellipse cx={nx} cy={ny} rx="10" ry="8" fill={C.lime} opacity="0.55" />
        <polygon points={LYFT_ZONE.map(([la, ln]) => xy(la, ln).join(',')).join(' ')} fill={C.indigo} fillOpacity="0.05" stroke={C.indigo} strokeDasharray="1.5 1.2" strokeWidth="0.4" />
      </svg>
      <span className="absolute text-[13px] font-semibold" style={{ left: `${cx}%`, top: `${cy}%`, transform: 'translate(-50%,-50%)', color: C.forest }}>Central Campus</span>
      <span className="absolute text-[13px] font-semibold" style={{ left: `${nx}%`, top: `${ny}%`, transform: 'translate(-50%,-50%)', color: C.forest }}>North Campus</span>
      {pins.map(p => { const [x, y] = xy(p.lat, p.lng); return (
        <button key={p.id} onClick={() => onPick(p.id)} aria-label={`Show ${p.label}`} aria-pressed={p.on} className="absolute flex cursor-pointer flex-col items-center gap-1 border-0 bg-transparent p-0" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-100%)' }}>
          <span className="flex items-center justify-center rounded-full px-3 text-[15px] font-bold" style={{ height: p.on ? 40 : 34, minWidth: p.on ? 40 : 34, background: p.on ? C.indigo : '#FFFFFF', color: p.on ? '#FFFFFF' : C.ink, boxShadow: '0 1px 2px rgba(29,31,26,.2), 0 6px 16px rgba(29,31,26,.18)' }}>{p.label}</span>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.on ? C.indigo : '#FFFFFF', border: '2px solid #FFFFFF' }} />
        </button>
      ); })}
    </div>
  );
}

export default function MapView({ pins, onPick }: { pins: Pin[]; onPick: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import('leaflet').Map | null>(null);
  const layer = useRef<import('leaflet').LayerGroup | null>(null);
  const [fallback, setFallback] = useState(false);
  const pickRef = useRef(onPick); pickRef.current = onPick;
  const [pinsTick, setPinsTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([42.281, -83.735], 13);
      let errors = 0;
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' });
      tiles.on('tileerror', () => { errors++; if (errors >= 4) setFallback(true); });
      tiles.addTo(m);
      L.circle(CENTRAL, { radius: 550, color: C.forest, weight: 0, fillColor: C.lime, fillOpacity: 0.45 }).addTo(m).bindTooltip('Central Campus');
      L.circle(NORTH, { radius: 650, color: C.forest, weight: 0, fillColor: C.lime, fillOpacity: 0.45 }).addTo(m).bindTooltip('North Campus');
      L.polygon(LYFT_ZONE, { color: C.indigo, weight: 2, dashArray: '6 6', fillColor: C.indigo, fillOpacity: 0.06 }).addTo(m).bindTooltip('Lyft Pass coverage area — pickup and drop-off must both be inside');
      layer.current = L.layerGroup().addTo(m);
      map.current = m;
      setTimeout(() => m.invalidateSize(), 50);
    })().catch(() => setFallback(true));
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    (async () => {
      if (!map.current || !layer.current) { setTimeout(() => setPinsTick(t => t + 1), 120); return; }
      const L = (await import('leaflet')).default;
      layer.current.clearLayers();
      const bounds: [number, number][] = [];
      for (const p of pins) {
        const html = `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translate(-50%,-100%);width:max-content"><span style="height:${p.on ? 40 : 34}px;min-width:${p.on ? 40 : 34}px;padding:0 12px;box-sizing:border-box;border-radius:999px;background:${p.on ? C.indigo : '#FFFFFF'};color:${p.on ? '#FFFFFF' : C.ink};font:700 15px -apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(29,31,26,.2),0 6px 16px rgba(29,31,26,.18);white-space:nowrap">${p.label}</span><span style="width:10px;height:10px;border-radius:999px;background:${p.on ? C.indigo : '#FFFFFF'};border:2px solid #FFFFFF"></span></div>`;
        const mk = L.marker([p.lat, p.lng], { icon: L.divIcon({ html, className: '', iconSize: [0, 0] }), zIndexOffset: p.on ? 1000 : 0, keyboard: true, title: `Show ${p.label}` });
        mk.on('click', () => pickRef.current(p.id));
        mk.addTo(layer.current);
        bounds.push([p.lat, p.lng]);
      }
      if (bounds.length) map.current.fitBounds([...bounds, CENTRAL, NORTH], { padding: [60, 60], maxZoom: 15 });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins.map(p => p.id + p.on + p.label).join(), pinsTick]);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-[18px]" style={{ background: '#EDEAE3' }}>
      {fallback ? <Stylised pins={pins} onPick={onPick} /> : <div ref={el} className="absolute inset-0 z-0" />}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex max-w-[calc(100%-24px)] flex-wrap gap-2">
        <span className="flex h-[30px] items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-medium"><span className="w-3.5" style={{ borderTop: `2px dashed ${C.indigo}` }} />Lyft Pass zone</span>
        <span className="flex h-[30px] items-center rounded-full bg-white px-3 text-[13px] font-medium" style={{ color: C.muted }}>{fallback ? 'Map preview' : 'OpenStreetMap'} · Example listings</span>
      </div>
    </div>
  );
}
