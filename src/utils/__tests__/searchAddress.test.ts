import { searchAddress } from '../searchAddress';

describe('searchAddress', () => {
  afterEach(() => { jest.resetAllMocks(); });

  it('returns [] for a query under 3 characters without calling fetch', async () => {
    global.fetch = jest.fn() as jest.Mock;

    const result = await searchAddress('ab');

    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('parses a BAN response and flips [lon, lat] to {latitude, longitude}', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: { label: '12 Rue de Rivoli 75001 Paris' },
            geometry: { coordinates: [2.3522, 48.8566] },
          },
        ],
      }),
    }) as jest.Mock;

    const result = await searchAddress('12 rue de rivoli');

    expect(result).toEqual([
      { label: '12 Rue de Rivoli 75001 Paris', latitude: 48.8566, longitude: 2.3522 },
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api-adresse.data.gouv.fr/search/?q='),
    );
  });

  it('returns [] on HTTP error', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false }) as jest.Mock;

    expect(await searchAddress('rue de rivoli')).toEqual([]);
  });

  it('returns [] on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error')) as jest.Mock;

    expect(await searchAddress('rue de rivoli')).toEqual([]);
  });

  it('filters out malformed features (missing label or coordinates)', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          { properties: {}, geometry: { coordinates: [2.35, 48.85] } },
          { properties: { label: 'Valid Address' }, geometry: {} },
          { properties: { label: 'Good Address' }, geometry: { coordinates: [2.35, 48.85] } },
        ],
      }),
    }) as jest.Mock;

    const result = await searchAddress('test query');

    expect(result).toEqual([
      { label: 'Good Address', latitude: 48.85, longitude: 2.35 },
    ]);
  });

  it('returns [] when features is missing entirely', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    }) as jest.Mock;

    expect(await searchAddress('test query')).toEqual([]);
  });
});
