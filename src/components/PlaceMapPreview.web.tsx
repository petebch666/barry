import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapErrorBoundary } from './MapErrorBoundary';

interface Props {
  latitude: number;
  longitude: number;
  name?: string;
}

function buildHtml(lat: number, lng: number, name?: string): string {
  const popup = name ? `marker.bindPopup(${JSON.stringify(name)}).openPopup();` : '';
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
  var map=L.map('map',{zoomControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,touchZoom:false}).setView([${lat},${lng}],16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'\\u00a9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom:19
  }).addTo(map);
  var marker=L.marker([${lat},${lng}]).addTo(map);
  ${popup}
</script>
</body>
</html>`;
}

export default function PlaceMapPreview({ latitude, longitude, name }: Props) {
  // Lazy initializer, same reasoning as PinMapPicker.web.tsx: avoid
  // rebuilding (and reloading) the iframe's srcDoc on every parent re-render.
  const [html] = useState(() => buildHtml(latitude, longitude, name));

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
  container: { height: 160, borderRadius: 14, overflow: 'hidden' },
});
