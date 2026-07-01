import { reverseGeocode } from '../reverseGeocode';

describe('reverseGeocode', () => {
  afterEach(() => { jest.resetAllMocks(); });

  it('returns display_name on success', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ display_name: '12 rue de Rivoli, Paris' }),
    }) as jest.Mock;

    const result = await reverseGeocode(48.8566, 2.3522);

    expect(result).toBe('12 rue de Rivoli, Paris');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://nominatim.openstreetmap.org/reverse?lat=48.8566&lon=2.3522&format=json',
      expect.objectContaining({ headers: expect.objectContaining({ 'User-Agent': expect.any(String) }) }),
    );
  });

  it('returns null when display_name is absent', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: 'Unable to geocode' }),
    }) as jest.Mock;

    expect(await reverseGeocode(0, 0)).toBeNull();
  });

  it('returns null on HTTP error', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false }) as jest.Mock;

    expect(await reverseGeocode(48.8566, 2.3522)).toBeNull();
  });

  it('returns null on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error')) as jest.Mock;

    expect(await reverseGeocode(48.8566, 2.3522)).toBeNull();
  });
});
