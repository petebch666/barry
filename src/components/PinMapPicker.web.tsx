import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapErrorBoundary } from './MapErrorBoundary';
import { buildPinMapHtml } from './pinMapHtml';

interface Props {
  initialLocation: { latitude: number; longitude: number };
  onLocationChange: (loc: { latitude: number; longitude: number }) => void;
}

export default function PinMapPicker({ initialLocation, onLocationChange }: Props) {
  // Use a ref so the event listener doesn't need to be re-registered when the
  // callback identity changes across renders.
  const onChangeRef = useRef(onLocationChange);
  onChangeRef.current = onLocationChange;

  // Lazy initializer: srcDoc is built once from the location we're mounted
  // with, not recomputed on every render. Setting srcDoc on an already-
  // mounted iframe forces a full reload — if it tracked initialLocation
  // directly, moving the map (which reports its centre back via postMessage and
  // updates the parent's state, which flows back down as a new
  // initialLocation prop) would reload the map and wipe out the very pan
  // the user just made. The map's own moveend handler already keeps the parent
  // in sync without needing React to re-render the iframe.
  const [html] = useState(() =>
    buildPinMapHtml(initialLocation.latitude, initialLocation.longitude, "(function(m){window.parent.postMessage(m,'*')})"),
  );

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      try {
        const data = JSON.parse(event.data as string) as { latitude?: unknown; longitude?: unknown };
        if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          onChangeRef.current({ latitude: data.latitude, longitude: data.longitude });
        }
      } catch {}
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <MapErrorBoundary>
      <View style={styles.container}>
        {React.createElement('iframe', {
          srcDoc: html,
          style: { width: '100%', height: '100%', border: 'none' },
          title: 'Map',
        })}
      </View>
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { height: 240, borderRadius: 14, overflow: 'hidden' },
});
