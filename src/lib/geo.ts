import { IMPLAUSIBLE_SPEED_KMH } from "./config";

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const r = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Speed-based plausibility check rather than a flat distance jump: tolerates
// genuinely fast movement in traffic while still catching teleporting GPS
// spoofs. This is a soft flag (speed_implausible), never a hard block --
// full spoof-prevention isn't solvable in a browser without a native app.
export function computeSpeedKmh(
  prevLat: number,
  prevLng: number,
  prevAt: Date,
  lat: number,
  lng: number,
  at: Date
): number {
  const meters = haversineMeters(prevLat, prevLng, lat, lng);
  const seconds = (at.getTime() - prevAt.getTime()) / 1000;
  if (seconds <= 0) return Infinity;
  return (meters / seconds) * 3.6;
}

export function isSpeedImplausible(speedKmh: number): boolean {
  return speedKmh > IMPLAUSIBLE_SPEED_KMH;
}
