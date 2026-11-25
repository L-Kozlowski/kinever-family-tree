import type { GeoLocation, Person } from '../types';

export function validLocation(location?: GeoLocation): location is GeoLocation {
  return (
    !!location &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lon) &&
    Math.abs(location.lat) <= 90 &&
    Math.abs(location.lon) <= 180
  );
}
export type BirthCluster = {
  lat: number;
  lon: number;
  people: Person[];
  key: string;
};
/** Screen-sized Web Mercator grid: nearby births separate as the user zooms in. */
export function birthClusters(people: Person[], zoom: number): BirthCluster[] {
  const cells = new Map<string, BirthCluster>();
  const scale = 256 * 2 ** zoom;
  for (const person of people) {
    if (!validLocation(person.birthLocation)) continue;
    const { lat, lon } = person.birthLocation;
    const sine = Math.sin(
      (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180,
    );
    const x = ((lon + 180) / 360) * scale;
    const y = (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale;
    const key = `${Math.floor(x / 64)}:${Math.floor(y / 64)}`;
    const cluster = cells.get(key) || { lat: 0, lon: 0, people: [], key };
    cluster.lat += lat;
    cluster.lon += lon;
    cluster.people.push(person);
    cells.set(key, cluster);
  }
  return [...cells.values()].map((c) => ({
    ...c,
    lat: c.lat / c.people.length,
    lon: c.lon / c.people.length,
  }));
}
