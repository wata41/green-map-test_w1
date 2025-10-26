const HTTP_PM      = `./tiles/solar_buildings_roofonly_shinagawa.pmtiles`;
const PMTILES_URL  = "pmtiles://" + HTTP_PM;
const SOURCE_ID    = "solar";
const SOURCE_LAYER = "solar_buildings";
const PROP_IRR     = "global_roof_mean";
const PROP_H       = "height";
const PROP_ID      = "id";

// カラースケール（必要ならオレンジ系に差し替え可）
const COLOR_SCALE = [
  "interpolate", ["linear"],
  ["coalesce", ["to-number", ["get", PROP_IRR]], 0],
  0,        "#0d0d0d",
  300000,   "#4b0082",
  800000,   "#800080",
  1000000,  "#ff8c00",
  1400000,  "#ffe066"
];

// ====== 初期化 ======
const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const map = new maplibregl.Map({
  container: 'map',
  style: { "version":8, "sources":{}, "layers":[
    { "id":"bg", "type":"background", "paint":{ "background-color":"#eef2f7" } }
  ]},
  center:[139.73,35.62], zoom:12, hash:true, pitch:0
});

map.on('load', async () => {
  // 背景OSM
  map.addSource("osm", {
    type: "raster",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    tileSize: 256,
    attribution: "© OpenStreetMap contributors",
    maxzoom: 19
  });
  map.addLayer({ id:"osm", type:"raster", source:"osm", paint:{ "raster-opacity":0.55 } });

  // PMTiles ソース
  map.addSource(SOURCE_ID, { type:"vector", url: PMTILES_URL });

  // 2D
  map.addLayer({
    id:"solar-2d-fill", type:"fill",
    source:SOURCE_ID, "source-layer":SOURCE_LAYER,
    paint:{ "fill-color": COLOR_SCALE, "fill-opacity":0.75 }
  });

  // 3D
  map.addLayer({
    id:"solar-3d-extrusion", type:"fill-extrusion",
    source:SOURCE_ID, "source-layer":SOURCE_LAYER,
    layout:{ "visibility":"none" },
    paint:{
      "fill-extrusion-color": COLOR_SCALE,
      "fill-extrusion-opacity": 0.95,
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
