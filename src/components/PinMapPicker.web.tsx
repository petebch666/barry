import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapErrorBoundary } from './MapErrorBoundary';

interface Props {
  initialLocation: { latitude: number; longitude: number };
  onLocationChange: (loc: { latitude: number; longitude: number }) => void;
}

function buildHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html,body,#map{height:100%;margin:0;padding:0;background:#0a0a0a}
    .leaflet-control-attribution{font-size:9px}
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map=L.map('map').setView([${lat},${lng}],15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'\\u00a9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom:19
  }).addTo(map);
  var marker=L.marker([${lat},${lng}],{draggable:true}).addTo(map);
  marker.on('dragend',function(){
    var ll=marker.getLatLng();
    window.parent.postMessage(JSON.stringify({latitude:ll.lat,longitude:ll.lng}),'*');
  });
</script>
</body>
</html>`;
}

export default function PinMapPicker({ initialLocation, onLocationChange }: Props) {
  // Use a ref so the event listener doesn't need to be re-registered when the
  // callback identity changes across renders.
  const onChangeRef = useRef(onLocationChange);
  onChangeRef.current = onLocationChange;

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
          srcDoc: buildHtml(initialLocation.latitude, initialLocation.longitude),
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
