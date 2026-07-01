import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/**
 * Builds a navigation deep-link URL for the given coordinates.
 * Platform is an explicit parameter so the function is pure and testable.
 *
 * iOS  → opens Apple Maps via the maps: scheme
 * Android → opens the OS default navigation app via the geo: scheme
 *           (works with OsmAnd, Maps.me, and any other geo: handler)
 */
export function buildDirectionsUrl(
  lat: number,
  lng: number,
  name: string,
  platform: string = Platform.OS,
): string {
  const label = encodeURIComponent(name);
  return platform === 'ios'
    ? `maps:?q=${label}&ll=${lat},${lng}`
    : `geo:${lat},${lng}?q=${label}`;
}

export async function openDirections(lat: number, lng: number, name: string): Promise<void> {
  await Linking.openURL(buildDirectionsUrl(lat, lng, name));
}
