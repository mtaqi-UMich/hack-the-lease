import type { Profile } from './session';
import type { CardOut } from './compare';
const money = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString('en-US');

const MUST_LABEL: Record<string, string> = { night: 'Safe walk home', quiet: 'Quiet', laundry: 'In-unit laundry', ac: 'AC', pet: 'Pets OK', parking: 'Parking', leaseFlex: 'Non-August start', private_bath: 'Private bath', nofees: 'No surprise fees', furnished: 'Furnished' };

export function musts(p: Profile): string[] {
  const out = new Set<string>();
  Object.entries(p.deal ?? {}).forEach(([k, v]) => v && out.add(k));
  (p.extra ?? []).forEach(k => out.add(k));
  Object.entries(p.scorecard ?? {}).forEach(([k, v]) => v === 'must' && out.add(k));
  return [...out].map(k => MUST_LABEL[k] ?? k);
}


export function lineFor(c: CardOut) {
  const commute = `${c.commute.minutes} min ${c.commute.mode === 'bus' ? 'by bus' : c.commute.mode === 'drive' ? 'by car' : c.commute.mode === 'bike' ? 'by bike' : 'walk'}`;
  const extra = c.overBudget > 0 ? `${money(c.overBudget)} over budget` : c.cost.unknowns.length ? `${c.cost.unknowns[0].toLowerCase()} unknown` : c.mustHaves.laundry.main === 'In unit' ? 'in-unit laundry' : c.mustHaves.night.main.toLowerCase();
  return `${commute} · ${extra}`;
}

