export function formatEta(durationSeconds: number): string {
  const minutes = Math.round(durationSeconds / 60);
  return minutes < 1 ? "Arriving in under a minute" : `Arriving in ~${minutes} min`;
}

export function formatRiderSpeed(speedKmh: number): string {
  return `Rider speed: ~${Math.round(speedKmh)} km/h`;
}
