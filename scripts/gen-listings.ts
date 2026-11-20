/* Generates SYNTHETIC ("Example") Ann Arbor listings: data/listings.json, data/landlords.json.
 *   npm run gen:data
 * Seed 42. 120 units in ~75 buildings across 12 neighbourhoods, several fictional landlords
 * plus Hackberry Lane (launch partner) units. Hedonic pricing shared with the engine.
 *
 * Commute: TheRide GTFS was not fetched for the hackathon build. Bus times use a documented
 * synthetic timetable stand-in (see BUS_CORRIDORS below) and every commute number is labelled
 * "Estimated" in the UI. Walk = 12.5 min/km × 1.3 detour (the 1.3 is inside km()).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { mulberry32, HOODS, STREETS, KINDS, distances, hedonicPerBed, travel, WALK_MIN_PER_KM, type Campus } from '../lib/engine';
import type { Listing, Landlord, BusLeg, CommuteFacts, Laundry, Fee } from '../lib/types';

const SEED = 42;
const rng = mulberry32(SEED);
const r = () => rng();
const pickArr = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
const round5 = (x: number) => Math.round(x / 5) * 5;

export const LANDLORDS: Landlord[] = [
  { id: 'hackberry', name: 'Hackberry Lane', kind: 'operator', verifiedCadenceDays: 3, contact: 'leasing@example-hackberry.test', launchPartner: true },
  { id: 'maizeblue', name: 'Maize & Blue Rentals', kind: 'operator', verifiedCadenceDays: 5, contact: 'hello@example-maizeblue.test' },
  { id: 'arborprop', name: 'Arbor Property Co.', kind: 'operator', verifiedCadenceDays: 6, contact: 'leasing@example-arborprop.test' },
  { id: 'huronview', name: 'Huron View Living', kind: 'operator', verifiedCadenceDays: 4, contact: 'team@example-huronview.test' },
  { id: 'kerrylane', name: 'Kerry Lane Homes', kind: 'small', verifiedCadenceDays: 10, contact: 'kerrylane@example.test' },
  { id: 'packardpm', name: 'Packard PM', kind: 'small', verifiedCadenceDays: 14, contact: 'office@example-packardpm.test' },
  { id: 'northwoodre', name: 'Northwood Residential', kind: 'operator', verifiedCadenceDays: 5, contact: 'rent@example-northwood.test' },
  { id: 'owner_jlee', name: 'J. Lee (house owner)', kind: 'house_owner', verifiedCadenceDays: 21, contact: 'jlee@example.test' },
  { id: 'owner_mpatel', name: 'M. Patel (house owner)', kind: 'house_owner', verifiedCadenceDays: 21, contact: 'mpatel@example.test' },
];
// which landlords operate in which neighbourhood index (HOODS order)
const HOOD_LANDLORDS: string[][] = [
  ['maizeblue', 'arborprop', 'owner_jlee'],          // South U
  ['kerrylane', 'arborprop'],                        // Kerrytown
  ['huronview', 'arborprop'],                        // Downtown
  ['kerrylane', 'owner_mpatel'],                     // Old West Side
  ['owner_jlee', 'maizeblue'],                       // Burns Park
  ['hackberry', 'maizeblue'],                        // Geddes / Oxford
  ['huronview', 'northwoodre'],                      // Lower Town
  ['northwoodre', 'hackberry'],                      // Northwood / North Campus
  ['northwoodre', 'huronview'],                      // Plymouth Rd
  ['packardpm', 'owner_mpatel'],                     // Packard / Stadium
  ['kerrylane', 'owner_mpatel'],                     // Water Hill
  ['arborprop', 'maizeblue'],                        // Medical / Fuller
];

/* Synthetic timetable stand-in (Estimated). One corridor per neighbourhood:
 * route name, walk to stop (min), daytime headway, after-10-PM headway, ride speed (km/h),
 * and transfers needed to reach each campus. Headway → expected wait = headway / 2. */
const BUS_CORRIDORS: { route: string; stopWalk: number; day: number; night: number; kmh: number; xfer: Record<Campus, number>; lit: number; lastBus: string }[] = [
  { route: 'Blue Bus Commuter', stopWalk: 3, day: 8, night: 20, kmh: 16, xfer: { Central: 0, North: 0, Medical: 0 }, lit: 0.9, lastBus: '12:40 AM' },
  { route: 'Route 23', stopWalk: 4, day: 15, night: 30, kmh: 17, xfer: { Central: 0, North: 0, Medical: 1 }, lit: 0.85, lastBus: '11:50 PM' },
  { route: 'Route 4', stopWalk: 2, day: 10, night: 30, kmh: 15, xfer: { Central: 0, North: 0, Medical: 0 }, lit: 0.95, lastBus: '12:10 AM' },
  { route: 'Route 3', stopWalk: 5, day: 20, night: 40, kmh: 17, xfer: { Central: 0, North: 1, Medical: 1 }, lit: 0.7, lastBus: '11:15 PM' },
  { route: 'Route 5', stopWalk: 5, day: 15, night: 30, kmh: 17, xfer: { Central: 0, North: 1, Medical: 1 }, lit: 0.75, lastBus: '11:30 PM' },
  { route: 'Route 4 / Geddes', stopWalk: 3, day: 10, night: 30, kmh: 16, xfer: { Central: 0, North: 0, Medical: 0 }, lit: 0.85, lastBus: '12:05 AM' },
  { route: 'Route 22 / Blue Bus', stopWalk: 3, day: 10, night: 30, kmh: 18, xfer: { Central: 0, North: 0, Medical: 0 }, lit: 0.8, lastBus: '12:20 AM' },
  { route: 'Bursley-Baits', stopWalk: 2, day: 6, night: 15, kmh: 18, xfer: { Central: 0, North: 0, Medical: 0 }, lit: 0.9, lastBus: '2:00 AM' },
  { route: 'Route 2', stopWalk: 4, day: 15, night: 30, kmh: 20, xfer: { Central: 0, North: 0, Medical: 1 }, lit: 0.75, lastBus: '11:40 PM' },
  { route: 'Route 5 / 6', stopWalk: 6, day: 20, night: 30, kmh: 18, xfer: { Central: 0, North: 1, Medical: 1 }, lit: 0.55, lastBus: '11:00 PM' },
  { route: 'Route 3 / 9', stopWalk: 5, day: 20, night: 40, kmh: 16, xfer: { Central: 0, North: 1, Medical: 1 }, lit: 0.7, lastBus: '11:10 PM' },
  { route: 'Route 4 / MedExpress', stopWalk: 2, day: 8, night: 20, kmh: 16, xfer: { Central: 0, North: 0, Medical: 0 }, lit: 0.9, lastBus: '12:30 AM' },
];
const HOOD_POI = [ // groceryMin, lateFood, busStopMin(override by corridor)
  { g: 6, f: 5 }, { g: 4, f: 3 }, { g: 7, f: 6 }, { g: 11, f: 1 }, { g: 12, f: 1 }, { g: 8, f: 3 },
  { g: 9, f: 2 }, { g: 12, f: 2 }, { g: 7, f: 1 }, { g: 6, f: 1 }, { g: 10, f: 1 }, { g: 8, f: 2 },
];

function busLeg(distKm: number, hi: number, campus: Campus): BusLeg {
  const c = BUS_CORRIDORS[hi];
  const wait = c.day / 2;
  const ride = Math.round((distKm / c.kmh) * 60 + 2); // + dwell
  const walkFromStop = 3;
  const transfers = c.xfer[campus];
  const total = Math.round(c.stopWalk + wait + ride + walkFromStop + transfers * 8);
  return { route: c.route, walkToStop: c.stopWalk, wait, ride, walkFromStop, transfers, headwayDay: c.day, headwayNight: c.night, total };
}
function commuteFacts(dist: Record<Campus, number>, hi: number): Record<Campus, CommuteFacts> {
  const out = {} as Record<Campus, CommuteFacts>;
  for (const campus of ['Central', 'North', 'Medical'] as Campus[]) {
    const walk = Math.round(WALK_MIN_PER_KM * dist[campus]);
    const bike = Math.round(travel(dist[campus], 'bike', campus));
    const drive = Math.round(travel(dist[campus], 'drive', campus));
    const bus = busLeg(dist[campus], hi, campus);
    const opts: [CommuteFacts['fastest']['mode'], number][] = [['walk', walk], ['bike', bike], ['bus', bus.total]];
    opts.sort((a, b) => a[1] - b[1]);
    out[campus] = { walk, bike, drive, bus, fastest: { mode: opts[0][0], minutes: opts[0][1] }, provenance: 'Estimated' };
  }
  return out;
}

const PHOTOS = ['#B7F3F7', '#EEEDFE', '#F5F2EB', '#F2EFE8', '#E3F7CF', '#FDEBD3', '#E8F0FB', '#F7E6EE'];
const isoDaysAgo = (d: number) => new Date(Date.UTC(2026, 10, 20) - d * 86400000).toISOString().slice(0, 10);

function build() {
  // buildings first, then 120 units (≤3 per building)
  const nBuildings = 76;
  const buildings = Array.from({ length: nBuildings }, (_, b) => {
    const hi = b % HOODS.length; const h = HOODS[hi];
    const coord: [number, number] = [h.c[0] + (r() - 0.5) * 0.006, h.c[1] + (r() - 0.5) * 0.007];
    const landlord = pickArr(HOOD_LANDLORDS[hi]);
    const number = 100 + Math.floor(r() * 1800), street = pickArr(STREETS), kind = pickArr(KINDS);
    return { id: 'B' + (b + 1), hi, coord, landlord, name: `${number} ${street} ${kind}`, address: `${number} ${street} St, Ann Arbor, MI (Example)`, units: 0, gym: r() < 0.3 };
  });
  // Hackberry flagship (Example data styled after a Geddes Ave building; not real pricing)
  buildings[5].name = 'Haven on Geddes (Example)'; buildings[5].landlord = 'hackberry'; buildings[5].address = 'Geddes Ave, Ann Arbor, MI (Example)'; buildings[5].gym = true;

  const assign: number[] = buildings.map((_, i) => i);
  while (assign.length < 120) { const b = Math.floor(r() * nBuildings); if (assign.filter(x => x === b).length < 3) assign.push(b); }

  const listings: Listing[] = assign.map((bi, i) => {
    const B = buildings[bi]; const h = HOODS[B.hi]; const LL = LANDLORDS.find(l => l.id === B.landlord)!;
    const beds = [1, 1, 2, 2, 2, 3, 3, 4, 4, 5][Math.floor(r() * 10)];
    const coord: [number, number] = [B.coord[0] + (r() - 0.5) * 0.0006, B.coord[1] + (r() - 0.5) * 0.0006];
    const dist = distances(coord);
    const laundryRoll = r();
    const laundry: Laundry = laundryRoll < (beds >= 4 ? 0.65 : 0.5) ? 'in_unit' : laundryRoll < 0.8 ? 'in_building' : laundryRoll < 0.93 ? 'basement' : 'none';
    const inUnit = laundry === 'in_unit';
    const parking = r() < (dist.Central > 2.2 ? 0.8 : 0.3);
    const ac = r() < 0.6, pets = r() < 0.35, leaseAny = r() < 0.3;
    const quality = Math.round(r() * 100) / 100;
    const furnished = r() < 0.35, privateBath = beds === 1 || r() < (LL.kind === 'operator' ? 0.6 : 0.2);
    const perBed = hedonicPerBed(dist, beds, quality, inUnit, parking, ac, h.quiet, 0.95 + r() * 0.1);
    const unitTotal = round5(perBed * beds);
    const perBedBasis = LL.kind === 'operator' ? r() < 0.75 : r() < 0.1;
    const priceBasis: Listing['price_basis'] = LL.kind === 'house_owner' && r() < 0.25 ? null : perBedBasis ? 'per_bed' : 'per_unit';
    const priceAmount = priceBasis === 'per_bed' ? round5(unitTotal / beds) : unitTotal;
    const leaseType: Listing['lease_type'] = priceBasis === 'per_bed' ? (r() < 0.8 ? 'individual' : 'both') : priceBasis === 'per_unit' ? 'joint' : null;
    const roommateMatching = priceBasis === 'per_bed' && LL.kind === 'operator' && r() < 0.8;
    // required fees: since Aug 1 2026 they should be inside base rent; some feeds still list them, some owners don't say
    let required: Fee[] | null = [];
    const feeRoll = r();
    if (LL.kind === 'house_owner' && feeRoll < 0.4) required = null; // not stated → Unknown
    else if (feeRoll < 0.25) required = [{ name: 'Amenity / tech fee', amount: pickArr([15, 25, 35]), monthly: true }];
    const utilsIncluded = r() < 0.35 ? ['water', 'trash', 'internet'] : r() < 0.5 ? ['water', 'trash'] : [];
    const utilListed = LL.kind === 'operator' && r() < 0.5 ? round5(40 + (beds <= 2 ? 30 : 15) - utilsIncluded.length * 10) : null;
    const parkingFee = parking ? (dist.Central < 1.2 ? pickArr([75, 90, 110]) : pickArr([0, 0, 40, 60])) : null;
    const quietScore = Math.min(1, Math.max(0, h.quiet + (r() - 0.5) * 0.3));
    const quietLabel = LL.kind === 'house_owner' && r() < 0.35 ? null
      : quietScore >= 0.7 ? 'Quiet street' : quietScore >= 0.45 ? 'Mixed — some parties' : 'Busy weekends';
    const corridor = BUS_CORRIDORS[B.hi];
    const verifiedDays = Math.floor(r() * LL.verifiedCadenceDays * 1.5);
    const leaseStart = leaseAny ? pickArr(['2027-01-01', '2027-05-01', '2027-08-15']) : '2027-08-15';
    const appOpen = new Date(Date.parse(leaseStart) - 150 * 86400000).toISOString().slice(0, 10);
    const campusCommute = commuteFacts(dist, B.hi);
    const commute = {} as NonNullable<Listing['commute']>;
    for (const c of ['Central', 'North', 'Medical'] as Campus[]) {
      const f = campusCommute[c];
      commute[c] = { walk: f.walk, bike: f.bike, bus: Math.min(f.walk, f.bus.total), drive: f.drive };
    }
    const hoodShort = h.name.split(' / ')[0];
    return {
      id: 'L' + (i + 1), name: B.name, short: `${hoodShort} ${beds}BR`, hood: h.name, beds, rent: unitTotal, quality, inUnit, parking, ac, pets, leaseAny,
      quiet: quietScore, dist, coord, commute,
      landlord_id: LL.id, building_id: B.id, source: LL.kind === 'operator' ? 'feed' : 'direct',
      verified_at: verifiedDays <= 14 ? isoDaysAgo(verifiedDays) : null,
      address: B.address, lat: coord[0], lng: coord[1], baths: Math.max(1, Math.round(beds * (privateBath ? 1 : 0.6))), sqft: round5(380 + beds * 310 + quality * 150),
      price_basis: priceBasis, price_amount: priceAmount, unit_total: unitTotal,
      required_fees: required, optional_fees: parking && parkingFee ? [{ name: 'Parking spot', amount: parkingFee, monthly: true }] : [],
      utilities_included: utilsIncluded, utilities_listed: utilListed,
      lease_type: leaseType, roommate_matching: roommateMatching,
      lease_start: leaseStart, lease_months: leaseAny ? [8, 12] : [12], applications_open_on: appOpen,
      amenities: { laundry, ac, furnished, private_bath: privateBath, pets, parking, parking_fee: parkingFee, gym_onsite: B.gym },
      application_fee: pickArr([0, 25, 35, 45, 50]), application_fee_refundable: true, deposit: Math.floor(priceAmount * pickArr([1, 1, 1.25, 1.5]) / 5) * 5, // never over the 1.5× cap
      screening_criteria_url: `https://example.test/${LL.id}/screening`, asks_criminal_history: false,
      photos: [0, 1, 2, 3, 4].map(k => PHOTOS[(i + k) % PHOTOS.length]), landlord_contact: LL.contact,
      night: { walkMin: Math.round(WALK_MIN_PER_KM * dist.Central), litShare: Math.round(Math.min(0.98, corridor.lit + (r() - 0.5) * 0.15) * 100) / 100, lastBus: corridor.lastBus },
      owlZone: dist.Central <= 2.6 || dist.North <= 1.6,
      translocCovered: dist.Central <= 1.9 || dist.North <= 1.1,
      quietLabel,
      poi: { groceryMin: HOOD_POI[B.hi].g + Math.floor(r() * 4), gymMin: B.gym ? 0 : 6 + Math.floor(r() * 15), lateFood: HOOD_POI[B.hi].f, busStopMin: corridor.stopWalk },
      campusCommute, example: true,
    };
  });
  return listings;
}

const listings = build();
const dir = join(process.cwd(), 'data');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'listings.json'), JSON.stringify(listings));
writeFileSync(join(dir, 'landlords.json'), JSON.stringify(LANDLORDS, null, 2));
writeFileSync(join(dir, 'commute.json'), JSON.stringify(Object.fromEntries(listings.map(l => [l.id, l.campusCommute]))));
const byLL: Record<string, number> = {}; listings.forEach(l => byLL[l.landlord_id] = (byLL[l.landlord_id] || 0) + 1);
console.log(`Wrote ${listings.length} Example listings (seed ${SEED}).`, byLL);
