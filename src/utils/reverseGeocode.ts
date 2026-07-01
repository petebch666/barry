export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Barry App (barry.app)' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { display_name?: unknown };
    return typeof json.display_name === 'string' ? json.display_name : null;
  } catch {
    return null;
  }
}
