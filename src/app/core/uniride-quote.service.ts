import { Injectable } from "@angular/core";
import { CAMPUSES, Campus, GeoPoint, Quote } from "./uniride.models";

const BASE_FARE = 4.0; // S/; editable demo tariff, not an institutional rate.
const PER_KM = 1.6;
const PER_MIN = 0.3;
const MIN_FARE = 7.0;
const round = (value: number, digits = 2): number =>
  Number(value.toFixed(digits));

/** Transparent tariff formula; pure and testable. */
export function buildQuote(
  pickup: string,
  campus: Campus,
  distanceKm: number,
  durationMin: number,
  source: Quote["source"],
): Quote {
  if (
    ![distanceKm, durationMin].every(Number.isFinite) ||
    distanceKm <= 0 ||
    durationMin <= 0
  )
    throw new Error("Invalid route");
  const distanceFare = round(distanceKm * PER_KM);
  const timeFare = round(durationMin * PER_MIN);
  const fare = round(Math.max(MIN_FARE, BASE_FARE + distanceFare + timeFare));
  return {
    pickup,
    campus,
    distanceKm: round(distanceKm, 1),
    durationMin: Math.ceil(durationMin),
    fare,
    baseFare: BASE_FARE,
    distanceFare,
    timeFare,
    source,
    generatedAt: new Date().toISOString(),
  };
}
function kmBetween(a: GeoPoint, b: GeoPoint): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const deltaLat = rad(b.lat - a.lat);
  const deltaLon = rad(b.lon - a.lon);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(h, 1)));
}
async function jsonWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}
interface NominatimResult {
  lat: string;
  lon: string;
}
interface OsrmResult {
  routes?: Array<{ distance: number; duration: number }>;
}
@Injectable({ providedIn: "root" })
export class UniRideQuoteService {
  /** Nominatim + public OSRM demo services; network and rate limits apply. */
  async calculate(
    pickup: string,
    campus: Campus,
    pickupPosition?: GeoPoint,
  ): Promise<Quote> {
    const selected = CAMPUSES.find((c) => c.id === campus);
    if (!selected) throw new Error("Invalid campus");
    if (!pickupPosition && pickup.trim().length < 8)
      throw new Error("PICKUP_REQUIRED");
    const destination = await this.resolveCampus(campus, selected.search);
    const start =
      pickupPosition ?? (await this.geocode(`${pickup.trim()}, Lima, Perú`));
    try {
      const data = (await jsonWithTimeout(
        `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${destination.point.lon},${destination.point.lat}?overview=false&steps=false`,
      )) as OsrmResult;
      const route = data.routes?.[0];
      if (!route?.distance || !route.duration)
        throw new Error("Route unavailable");
      return buildQuote(
        pickup,
        campus,
        route.distance / 1000,
        route.duration / 60,
        destination.approximate ? "reference" : "route",
      );
    } catch {
      // Clearly labeled rough estimate, never sold as verified road distance.
      const roadProxyKm = Math.max(
        0.2,
        kmBetween(start, destination.point) * 1.3,
      );
      const estimatedMinutes = Math.max(2, (roadProxyKm / 24) * 60);
      return buildQuote(
        pickup,
        campus,
        roadProxyKm,
        estimatedMinutes,
        "approx",
      );
    }
  }
  private async resolveCampus(
    campus: Campus,
    query: string,
  ): Promise<{ point: GeoPoint; approximate: boolean }> {
    try {
      return { point: await this.geocode(query), approximate: false };
    } catch {
      // Municipality reference point, NOT an exact campus gate; label the quote accordingly.
      const fallback =
        campus === "norte"
          ? "Puente Piedra, Lima, Peru"
          : "Villa El Salvador, Lima, Peru";
      return { point: await this.geocode(fallback), approximate: true };
    }
  }
  private async geocode(query: string): Promise<GeoPoint> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pe&q=${encodeURIComponent(query)}`;
      const result = (await jsonWithTimeout(url)) as NominatimResult[];
      const point = result?.[0];
      if (!point) throw new Error("Not found");
      const lat = Number(point.lat),
        lon = Number(point.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon))
        throw new Error("Invalid result");
      return { lat, lon };
    } catch {
      throw new Error("LOCATION_NOT_FOUND");
    }
  }
}
