export interface AddressSuggestion {
  label: string;
  latitude: number;
  longitude: number;
}

/**
 * Address autocomplete via Base Adresse Nationale (BAN) — France's free,
 * keyless address API. GeoJSON coordinates are [lon, lat]; flipped here,
 * once, so no other code has to remember the reversed order.
 */
export async function searchAddress(query: string): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(trimmed)}&limit=5`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const json = (await res.json()) as {
      features?: { properties?: { label?: unknown }; geometry?: { coordinates?: unknown } }[];
    };
    if (!Array.isArray(json.features)) return [];

    return json.features
      .map((f): AddressSuggestion | null => {
        const label = f.properties?.label;
        const coords = f.geometry?.coordinates;
        if (typeof label !== 'string' || !Array.isArray(coords) || coords.length < 2) return null;
        const [lon, lat] = coords;
        if (typeof lon !== 'number' || typeof lat !== 'number') return null;
        return { label, latitude: lat, longitude: lon };
      })
      .filter((s): s is AddressSuggestion => s !== null);
  } catch {
    return [];
  }
}
