import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/**
 * Builds a navigation deep-link URL for the given coordinates.
 * Platform is an explicit parameter so the function is pure and testable.
 *
 * iOS     → opens Apple Maps via the maps: scheme
 * Android → opens the OS default navigation app via the geo: scheme
 *           (works with OsmAnd, Maps.me, and any other geo: handler)
 * Web     → geo:/maps: URI schemes have no browser protocol handler, so
 *           this opens the location on openstreetmap.org instead (keeps
 *           the app's no-Google-Maps-API policy on web too).
 */
export function buildDirectionsUrl(
  lat: number,
  lng: number,
  name: string,
  platform: string = Platform.OS,
): string {
  const label = encodeURIComponent(name);
  if (platform === 'ios') return `maps:?q=${label}&ll=${lat},${lng}`;
  if (platform === 'web') return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
  return `geo:${lat},${lng}?q=${label}`;
}

export async function openDirections(lat: number, lng: number, name: string): Promise<void> {
  await Linking.openURL(buildDirectionsUrl(lat, lng, name));
}
