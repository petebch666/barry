import { buildPinMapHtml } from '@/components/pinMapHtml';

describe('buildPinMapHtml', () => {
  const html = buildPinMapHtml(48.86, 2.33, 'window.ReactNativeWebView.postMessage');

  it('centres the map on the starting point', () => {
    expect(html).toContain('setView([48.86,2.33],16)');
  });

  it('reports the map centre whenever the map stops moving', () => {
    expect(html).toContain("map.on('moveend'");
    expect(html).toContain('window.ReactNativeWebView.postMessage(JSON.stringify({latitude:c.lat,longitude:c.lng}))');
  });

  it('uses a fixed centre pin and tap-to-place, not a draggable marker', () => {
    expect(html).toContain('id="pin"');
    expect(html).toContain("map.on('click'");
    expect(html).not.toContain('draggable');
  });
});
