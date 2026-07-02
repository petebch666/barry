import { buildDirectionsUrl } from '@/utils/openDirections';

describe('buildDirectionsUrl', () => {
  test('ios: maps: scheme with ll and q', () => {
    expect(buildDirectionsUrl(48.8566, 2.3522, 'Le Marais', 'ios'))
      .toBe('maps:?q=Le%20Marais&ll=48.8566,2.3522');
  });

  test('android: geo: scheme', () => {
    expect(buildDirectionsUrl(48.8566, 2.3522, 'Le Marais', 'android'))
      .toBe('geo:48.8566,2.3522?q=Le%20Marais');
  });

  test('special characters in name are percent-encoded', () => {
    expect(buildDirectionsUrl(51.5, -0.1, 'Café & Bar', 'ios'))
      .toBe('maps:?q=Caf%C3%A9%20%26%20Bar&ll=51.5,-0.1');
  });

  test('negative coordinates', () => {
    expect(buildDirectionsUrl(-33.8688, 151.2093, 'Opera Bar', 'android'))
      .toBe('geo:-33.8688,151.2093?q=Opera%20Bar');
  });

  test('web: openstreetmap.org URL (geo:/maps: schemes have no browser handler)', () => {
    expect(buildDirectionsUrl(48.8, 2.35, 'Spot', 'web'))
      .toBe('https://www.openstreetmap.org/?mlat=48.8&mlon=2.35#map=17/48.8/2.35');
  });

  test('unknown platform falls back to geo: scheme', () => {
    expect(buildDirectionsUrl(48.8, 2.35, 'Spot', 'windows'))
      .toBe('geo:48.8,2.35?q=Spot');
  });
});
