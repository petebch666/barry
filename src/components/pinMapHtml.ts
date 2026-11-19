// Map page shared by the native (WebView) and web (iframe) pickers.
//
// The pin stays fixed in the middle and the user moves the map under it, or
// taps a spot to jump there. A draggable Leaflet marker was nearly impossible
// to grab on iPhone: it is a small target, and the drag competes with the
// WebView and the modal sheet for the same touch.
export function buildPinMapHtml(lat: number, lng: number, postMessage: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html,body,#map{height:100%;margin:0;padding:0;background:#0a0a0a}
    .leaflet-control-attribution{font-size:9px}
    #pin{position:absolute;left:50%;top:50%;z-index:1000;pointer-events:none;
         width:30px;height:42px;margin-left:-15px;margin-top:-42px}
    #hint{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);z-index:1000;
          pointer-events:none;background:rgba(10,10,10,.78);color:#fff;font:13px -apple-system,system-ui,sans-serif;
          padding:7px 12px;border-radius:999px;white-space:nowrap}
  </style>
</head>
<body>
<div id="map"></div>
<svg id="pin" viewBox="0 0 30 42" aria-hidden="true">
  <path d="M15 41C15 41 28 25.5 28 15A13 13 0 0 0 2 15C2 25.5 15 41 15 41Z" fill="#7C3AED" stroke="#fff" stroke-width="2"/>
  <circle cx="15" cy="15" r="5" fill="#fff"/>
</svg>
<div id="hint">Move the map or tap to place the pin</div>
<script>
  var map=L.map('map',{zoomControl:false}).setView([${lat},${lng}],16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'\\u00a9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom:19
  }).addTo(map);
  map.on('click',function(e){ map.panTo(e.latlng); });
  map.on('movestart',function(){ document.getElementById('hint').style.display='none'; });
  map.on('moveend',function(){
    var c=map.getCenter();
    ${postMessage}(JSON.stringify({latitude:c.lat,longitude:c.lng}));
  });
</script>
</body>
</html>`;
}
