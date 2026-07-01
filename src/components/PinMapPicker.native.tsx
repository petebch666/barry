import { StyleSheet } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
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
    window.ReactNativeWebView.postMessage(JSON.stringify({latitude:ll.lat,longitude:ll.lng}));
  });
</script>
</body>
</html>`;
}

export default function PinMapPicker({ initialLocation, onLocationChange }: Props) {
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
        source={{ html: buildHtml(initialLocation.latitude, initialLocation.longitude) }}
        style={styles.map}
        originWhitelist={['*']}
        onMessage={handleMessage}
      />
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  map: { height: 240, borderRadius: 14 },
});
