const HTTP_PM      = `./tiles/solar_buildings_roofonly_shinagawa.pmtiles`;
const PMTILES_URL  = "pmtiles://" + HTTP_PM;
const SOURCE_ID    = "solar";
const SOURCE_LAYER = "solar_buildings";
const PROP_IRR     = "global_roof_mean";
const PROP_H       = "height";
const PROP_ID      = "id";

const COLOR_SCALE = [
  "interpolate", ["linear"],
  ["coalesce", ["to-number", ["get", PROP_IRR]], 0],
  0,        "#0d0d0d",
  700000,   "#4b0082",
  1000000,  "#800080",
  1200000,  "#ff8c00",
  1500000,  "#ffe066"
];

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const map = new maplibregl.Map({
  container: 'map',
  style: { "version":8, "sources":{}, "layers":[
    { "id":"bg", "type":"background", "paint":{ "background-color":"#eef2f7" } }
  ]},
  center:[139.734894,35.606309], zoom:14.5, hash:true, pitch:0
});

map.on('load', async () => {
  map.addSource("osm", {
    type: "raster",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    tileSize: 256,
    attribution: "© OpenStreetMap contributors",
    maxzoom: 19
  });
  map.addLayer({
    id:"osm", 
    type:"raster", 
    source:"osm", 
    paint:{ "raster-opacity":0.55 } 
  });

  map.addSource("gsi_photo", {
    type: "raster",
    tiles: ["https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"],
    tileSize: 256,
    attribution: "国土地理院"
  });
  map.addLayer({
    id: "gsi_photo",
    type: "raster",
    source: "gsi_photo",
    layout: { "visibility": "none" },
    paint: {"raster-opacity": 1.0}
  });

  map.addSource(SOURCE_ID, { type:"vector", url: PMTILES_URL });

  // 2D
  map.addLayer({
    id:"solar-2d-fill", type:"fill",
    source:SOURCE_ID, "source-layer":SOURCE_LAYER,
    paint:{ "fill-color": COLOR_SCALE, "fill-opacity":0.35 }
  });

  // 3D
  map.addLayer({
    id:"solar-3d-extrusion", type:"fill-extrusion",
    source:SOURCE_ID, "source-layer":SOURCE_LAYER,
    layout:{ "visibility":"none" },
    paint:{
      "fill-extrusion-color": COLOR_SCALE,
      "fill-extrusion-opacity": 0.75,
      "fill-extrusion-height": ["coalesce", ["to-number", ["get", PROP_H]], 0],
      "fill-extrusion-base": 0
    }
  });

  // ポップアップ
  const showInfo = (e) => {
    const f = e.features?.[0]; if (!f) return;
    const p = f.properties || {};
    const html = `
      <div style="font:13px system-ui;line-height:1.4">
        <div><b>ID</b>: ${p[PROP_ID] ?? "-"}</div>
        <div><b>高さ [m]</b>: ${p[PROP_H] ?? "-"}</div>
        <div><b>年間累積日射量 [Wh/m²·year]</b>: ${p[PROP_IRR] ?? "-"}</div>
      </div>`;
    new maplibregl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(map);
  };
  map.on('click', 'solar-2d-fill', showInfo);
  map.on('click', 'solar-3d-extrusion', showInfo);

  // トグル
  const chk2d = document.getElementById('chk2d');
  const chk3d = document.getElementById('chk3d');
  const chkOSM = document.getElementById('chkOSM');
  const chkGSI = document.getElementById('chkGSI');

  chk2d.addEventListener('change', () => {
    map.setLayoutProperty('solar-2d-fill', 'visibility', chk2d.checked ? 'visible' : 'none');
  });
  chk3d.addEventListener('change', () => {
    map.setLayoutProperty('solar-3d-extrusion', 'visibility', chk3d.checked ? 'visible' : 'none');
    map.easeTo({ pitch: chk3d.checked ? 60 : 0, duration: 500 });
  });
  chkOSM.addEventListener('change', () => {
    map.setLayoutProperty('osm', 'visibility', chkOSM.checked ? 'visible' : 'none');
  });
  chkGSI.addEventListener('change', () => {
    map.setLayoutProperty('gsi_photo', 'visibility', chkGSI.checked ? 'visible' : 'none');
  });

  // 自動ズーム
  try {
    const p = new pmtiles.PMTiles(HTTP_PM);
    const header = await p.getHeader();
    if (header?.bounds) {
      const [w,s,e,n] = header.bounds;
      map.fitBounds([[w,s],[e,n]], { padding:24, duration:0 });
    }
    console.log('pmtiles header:', header);
  } catch(e) { console.warn('getHeader failed', e); }
});
