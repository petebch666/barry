import { useState } from 'react';
import { StyleSheet } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { MapErrorBoundary } from './MapErrorBoundary';
import { buildPinMapHtml } from './pinMapHtml';

interface Props {
  initialLocation: { latitude: number; longitude: number };
  onLocationChange: (loc: { latitude: number; longitude: number }) => void;
}

export default function PinMapPicker({ initialLocation, onLocationChange }: Props) {
  // Built once: a new html source would reload the map and lose the user's pan.
  const [html] = useState(() =>
    buildPinMapHtml(initialLocation.latitude, initialLocation.longitude, 'window.ReactNativeWebView.postMessage'),
  );

  function handleMessage(event: WebViewMessageEvent) {
    const { latitude, longitude } = JSON.parse(event.nativeEvent.data) as {
      latitude: number;
      longitude: number;
    };
    onLocationChange({ latitude, longitude });
  }

  return (
    <MapErrorBoundary>
      <WebView
        source={{ html }}
        style={styles.map}
        originWhitelist={['*']}
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
      />
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  // Fills a full-screen modal; keeps 240 inside a ScrollView, where flex has no height to share.
  map: { flex: 1, minHeight: 240, borderRadius: 14 },
});
