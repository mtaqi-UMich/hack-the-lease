/* Service areas used by the must-have rows.
 * LYFT_ZONE: the U-M Lyft Pass coverage area ("both pickup and drop-off must be inside"), traced from the
 * Coverage Area map in the Lyft app on 2026-11-20 and georeferenced to OpenStreetMap highway interchanges
 * (M-14/US-23, US-23/I-94). Accurate to roughly 100–200 m at the edges — treat places near the line as "check in the app". */
export type LatLng = [number, number];

export const LYFT_ZONE: LatLng[] = [
  [42.3140, -83.7355], [42.3175, -83.7169], [42.3184, -83.7051], [42.3187, -83.6915], [42.3190, -83.6873],
  [42.3199, -83.6603], [42.3068, -83.6594], [42.2927, -83.6653], [42.2922, -83.6811], [42.2825, -83.6811],
  [42.2821, -83.7022], [42.2768, -83.7000], [42.2687, -83.6975], [42.2625, -83.6958], [42.2574, -83.6915],
  [42.2550, -83.6919], [42.2500, -83.6966], [42.2456, -83.6991], [42.2387, -83.6991], [42.2377, -83.7194],
  [42.2306, -83.7194], [42.2303, -83.7389], [42.2306, -83.7481], [42.2318, -83.7549], [42.2391, -83.7634],
  [42.2500, -83.7498], [42.2506, -83.7608], [42.2550, -83.7583], [42.2625, -83.7591], [42.2799, -83.7588],
  [42.2927, -83.7583], [42.2950, -83.7507], [42.2993, -83.7448], [42.3043, -83.7431], [42.3110, -83.7402],
];

/** Ray-casting point-in-polygon on lat/lng (fine at city scale). */
export function inPolygon([lat, lng]: LatLng, poly: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export const inLyftZone = (c: LatLng) => inPolygon(c, LYFT_ZONE);
