import { StyleSheet, View, Text } from 'react-native';
import WebView from 'react-native-webview';

interface PingMapProps {
  barycenter: { latitude: number; longitude: number };
  memberLocations: Array<{ id: string; latitude: number; longitude: number }>;
  places: Array<{ id: string; latitude: number; longitude: number; name: string }>;
}

// Replace < and > so embedded JSON can't break out of a <script> tag.
const safeJson = (val: unknown): string =>
  JSON.stringify(val).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

function buildHtml(
  barycenter: { latitude: number; longitude: number },
  memberLocations: PingMapProps['memberLocations'],
  places: PingMapProps['places'],
): string {
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
  var map=L.map('map',{zoomControl:false}).setView([${barycenter.latitude},${barycenter.longitude}],14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'\\u00a9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom:19
  }).addTo(map);
  L.circle([${barycenter.latitude},${barycenter.longitude}],{
    radius:800,color:'#7C3AED',fillColor:'#7C3AED',fillOpacity:0.08,opacity:0.3,weight:1
  }).addTo(map);
  L.circleMarker([${barycenter.latitude},${barycenter.longitude}],{
    radius:10,color:'#7C3AED',fillColor:'#7C3AED',fillOpacity:1
  }).bindPopup('Meeting point').addTo(map);
  ${safeJson(memberLocations)}.forEach(function(m){
    L.circleMarker([m.latitude,m.longitude],{
      radius:7,color:'#94A3B8',fillColor:'#94A3B8',fillOpacity:0.85
    }).addTo(map);
  });
  ${safeJson(places)}.forEach(function(p){
    L.circleMarker([p.latitude,p.longitude],{
      radius:8,color:'#F59E0B',fillColor:'#F59E0B',fillOpacity:0.9
    }).bindPopup(p.name).addTo(map);
  });
</script>
</body>
</html>`;
}

export default function PingMap({ barycenter, memberLocations, places }: PingMapProps) {
  return (
    <View style={styles.wrapper}>
      <WebView
        source={{ html: buildHtml(barycenter, memberLocations, places) }}
        style={styles.map}
        scrollEnabled={false}
        originWhitelist={['*']}
      />
      <View style={styles.label}>
        <Text style={styles.labelText}>⭐ Meeting point</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: 18, overflow: 'hidden', height: 200, position: 'relative' },
  map: { flex: 1, backgroundColor: '#0a0a0a' },
  label: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  labelText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
});
