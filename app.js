/* ============================================
   ATLAS ARQUEOLÓGICO · LA RIOJA MEDIEVAL
   app.js — Main application logic (VERSIÓN PULIDA)
   ============================================ */

'use strict';

// ─── GLOBALS ─────────────────────────────────────────────────────────────────
let MAP, MUNI_LAYER, LARIOJA_LAYER, LABELS_LAYER;
let ALL_ARTICLES = [];
let ALL_MUNICIPALITIES = []; 
let MUNI_GEOJSON = null;
let CCAA_GEOJSON = null; // Guardará el contorno oficial
let LABELS_DATA = []; 
let CODINE_ARTICLE_MAP = {};   
let ACTIVE_FILTERS = { epocas: new Set(), tipos: new Set(), yearMin: 2010, yearMax: 2026 };
let SELECTED_CODINE = null;
let PANEL_OPEN = true;

const QGIS_MUNI_FILL    = '#f7f7f7';
const QGIS_MUNI_BORDER  = '#525252';
const CHORO_COLORS = ['#252e42', '#3d4f6e', '#5b7a8c', '#8aac7a', '#c9a84c', '#d45f4f'];

function getChoroColor(count) {
  if (count === 0) return CHORO_COLORS[0];
  if (count === 1) return CHORO_COLORS[1];
  if (count <= 3)  return CHORO_COLORS[2];
  if (count <= 6)  return CHORO_COLORS[3];
  if (count <= 9)  return CHORO_COLORS[4];
  return CHORO_COLORS[5];
}

// ─── ALGORITMO MATEMÁTICO PARA CENTROIDES ────────────────────────────────────
function getPolygonCenter(feature) {
  let lats = [], lngs = [];
  function extract(arr) {
    if (arr.length === 2 && typeof arr[0] === 'number' && typeof arr[1] === 'number') {
      lngs.push(arr[0]);
      lats.push(arr[1]);
    } else if (Array.isArray(arr)) {
      arr.forEach(extract);
    }
  }
  if (feature.geometry && feature.geometry.coordinates) {
    extract(feature.geometry.coordinates);
  }
  if (lats.length === 0) return null;
  let minLat = Math.min(...lats), maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  return [(minLat + maxLat) / 2, (minLng + maxLng) / 2]; 
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
async function init() {
  initMap();
  try {
    const [muniGeo, articles, ccaaGeo] = await Promise.all([
      fetch('municipios.geojson').then(r => r.json()),
      fetch('articles_clean.json').then(r => r.json()),
      // Cargamos el borde oficial de La Rioja exportado por Iker
      fetch('ccaa.geojson').then(r => r.ok ? r.json() : null).catch(() => null) 
    ]);

    MUNI_GEOJSON = muniGeo; 
    ALL_ARTICLES = articles;
    CCAA_GEOJSON = ccaaGeo;
    ALL_MUNICIPALITIES = muniGeo.features;

    buildCodeMap();
    buildFilters();
    renderLaRiojaBoundary();
    renderMap(); 
    updateStats();
    initSearch();
    bindControls(); 
    
  } catch (err) {
    console.error("Error en inicialización:", err);
  }
}

// ─── MAP SETUP ────────────────────────────────────────────────────────────────
function initMap() {
  MAP = L.map('map', {
    center: [42.35, -2.45],
    zoom: 9,
    zoomControl: true,
    preferCanvas: true,
    attributionControl: false
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 18
  }).addTo(MAP);

  L.control.scale({ metric: true, imperial: false, position: 'bottomright' }).addTo(MAP);

  MAP.on('mousemove', e => {
    const tt = document.getElementById('map-tooltip');
    if (tt && !tt.classList.contains('hidden')) {
      tt.style.left = (e.originalEvent.clientX + 16) + 'px';
      tt.style.top  = (e.originalEvent.clientY - 10) + 'px';
    }
  });
}

// ─── DATA PROCESSING ──────────────────────────────────────────────────────────
function buildCodeMap() {
  CODINE_ARTICLE_MAP = {};
  ALL_ARTICLES.forEach(a => {
    (a.codines || []).forEach(c => {
      if (!CODINE_ARTICLE_MAP[c]) CODINE_ARTICLE_MAP[c] = [];
      CODINE_ARTICLE_MAP[c].push(a);
    });
  });
}

function getFilteredCount(codine) {
  const arts = (CODINE_ARTICLE_MAP[codine] || []).filter(matchesFilter);
  return arts.length;
}

function matchesFilter(a) {
  if (ACTIVE_FILTERS.epocas.size > 0 && !ACTIVE_FILTERS.epocas.has(a.epoca)) return false;
  if (ACTIVE_FILTERS.tipos.size > 0 && !ACTIVE_FILTERS.tipos.has(a.tipo_yacimiento)) return false;
  if (a.fecha && (a.fecha < ACTIVE_FILTERS.yearMin || a.fecha > ACTIVE_FILTERS.yearMax)) return false;
  return true;
}

// ─── MAP RENDER ───────────────────────────────────────────────────────────────
function getFeatureStyle(feature) {
  const codine = feature.properties.CODINE || feature.properties.codine;
  const count = getFilteredCount(codine);
  const isSelected = codine === SELECTED_CODINE;
  return {
    fillColor: count > 0 ? getChoroColor(count) : QGIS_MUNI_FILL,
    fillOpacity: count > 0 ? (isSelected ? 0.95 : 0.82) : (isSelected ? 0.4 : 0.22),
    color: isSelected ? '#c9a84c' : QGIS_MUNI_BORDER,
    weight: isSelected ? 2.5 : (count > 0 ? 1.2 : 0.7),
    opacity: 1
  };
}

function renderMap() {
  if (!MUNI_GEOJSON) return;

  if (MUNI_LAYER) MAP.removeLayer(MUNI_LAYER);

  MUNI_LAYER = L.geoJSON(MUNI_GEOJSON, {
    style: feature => getFeatureStyle(feature),
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.on({
        mouseover: e => handleMuniHover(e, p),
        mouseout: handleMuniOut,
        click: e => handleMuniClick(e, p)
      });
    }
  });

  // Solo lo añadimos si la casilla está marcada al arrancar
  if (document.getElementById('layer-municipios')?.checked) {
      MUNI_LAYER.addTo(MAP);
  }

  LABELS_DATA = [];
  MUNI_GEOJSON.features.forEach(f => {
    const center = getPolygonCenter(f);
    if (center) {
      LABELS_DATA.push({ feature: f, center: center });
    }
  });

  renderLabels();
}

function renderLabels() {
  if (LABELS_LAYER) MAP.removeLayer(LABELS_LAYER);
  LABELS_LAYER = L.layerGroup();
  
  LABELS_DATA.forEach(data => {
    const p = data.feature.properties;
    const codine = p.CODINE || p.codine;
    const count = getFilteredCount(codine);
    
    if (count > 0) {
      const nombre = p.Nombre || p.nombre || "Desconocido";
      const icon = L.divIcon({
        className: 'muni-label',
        html: `<span>${nombre.split(' ')[0]}</span>`,
        iconSize: [80, 14],
        iconAnchor: [40, 7]
      });
      L.marker(data.center, { icon }).addTo(LABELS_LAYER);
    }
  });

  if (document.getElementById('layer-labels')?.checked) {
      LABELS_LAYER.addTo(MAP);
  }
}

function renderLaRiojaBoundary() {
  if (LARIOJA_LAYER) MAP.removeLayer(LARIOJA_LAYER);
  
  const styleOpt = { 
      className: 'larioja-boundary', 
      fillColor: '#c9a84c', 
      fillOpacity: 0.04, 
      color: '#c9a84c', 
      weight: 2, 
      opacity: 0.5, 
      dashArray: '6,4',
      interactive: false // Para que no bloquee los clics en los pueblos
  };

  if (CCAA_GEOJSON) {
      // Si Iker ha exportado ccaa.geojson, usamos las fronteras exactas
      LARIOJA_LAYER = L.geoJSON(CCAA_GEOJSON, { style: styleOpt }).addTo(MAP);
  } else {
      // Si no existe, usamos un bounding box calculado a partir de los municipios
      // Así al menos es perfecto a nivel de extremos
      const bounds = L.geoJSON(MUNI_GEOJSON).getBounds();
      LARIOJA_LAYER = L.rectangle(bounds, styleOpt).addTo(MAP);
  }
  
  // Por defecto, lo ocultamos si la casilla está desmarcada
  if (!document.getElementById('layer-larioja')?.checked) {
      MAP.removeLayer(LARIOJA_LAYER);
  }
}

function refreshMap() {
  const layerChecked = document.getElementById('layer-municipios')?.checked;
  const labelChecked = document.getElementById('layer-labels')?.checked;

  if (MUNI_LAYER) {
      if (layerChecked) {
          if (!MAP.hasLayer(MUNI_LAYER)) MUNI_LAYER.addTo(MAP);
          // Actualizamos estilos sin re-crear
          MUNI_LAYER.eachLayer(layer => layer.setStyle(getFeatureStyle(layer.feature)));
      } else {
          MAP.removeLayer(MUNI_LAYER);
      }
  }

  // Las etiquetas siempre se regeneran rápido porque dependen del filtro
  renderLabels();
  updateStats();
}

// ─── HOVER / CLICK ────────────────────────────────────────────────────────────
function handleMuniHover(e, p) {
  const codine = p.CODINE || p.codine;
  const count = getFilteredCount(codine);
  const nombre = p.Nombre || p.nombre || "Desconocido";
  const tt = document.getElementById('map-tooltip');
  tt.innerHTML = `
    <div class="tooltip-name">${nombre}</div>
    <div class="tooltip-codine">CODINE · ${codine}</div>
    <div class="tooltip-count">
      <span class="count-num">${count}</span>
      artículo${count !== 1 ? 's' : ''} asociado${count !== 1 ? 's' : ''}
    </div>
    ${count > 0 ? '<div class="tooltip-hint">Clic para ver detalles →</div>' : ''}
  `;
  tt.classList.remove('hidden');

  e.target.setStyle({ fillOpacity: count > 0 ? 0.95 : 0.35, weight: 2, color: '#c9a84c' });
  e.target.bringToFront();
}

function handleMuniOut(e) {
  document.getElementById('map-tooltip').classList.add('hidden');
  e.target.setStyle(getFeatureStyle(e.target.feature));
}

function handleMuniClick(e, p) {
  SELECTED_CODINE = p.CODINE || p.codine;
  showArticlePanel(p);
  refreshMap();
}

// ─── ARTICLE PANEL ────────────────────────────────────────────────────────────
function showArticlePanel(p) {
  const panel = document.getElementById('article-panel');
  const title = document.getElementById('article-panel-title');
  const body  = document.getElementById('article-panel-body');

  title.textContent = p.Nombre || p.nombre || "Desconocido";
  panel.className = 'article-panel-open';

  const codine = p.CODINE || p.codine;
  const articles = (CODINE_ARTICLE_MAP[codine] || []).filter(matchesFilter);

  document.getElementById('map-container').style.right = '380px';
  let html = '';

  if (articles.length === 0) {
    html = `<div class="no-articles"><span class="icon">📚</span>Sin artículos asociados con los filtros actuales.</div>`;
  } else {
    const epocas = [...new Set(articles.map(a => a.epoca).filter(Boolean))];
    const badgesHtml = epocas.map(e => `<span class="meta-badge green">${e}</span>`).join('');
    html += `<div class="panel-meta-bar"><span class="meta-badge">${articles.length} art.</span>${badgesHtml}</div><div class="articles-list">`;

    articles.forEach((a, i) => {
      html += `<div class="article-card" id="card-${i}" onclick="toggleCard(${i})">
        <div class="card-header">
          <div class="card-title">${escHtml(a.titulo || 'Sin título')}</div>
          <div class="card-meta-row">
            <span class="card-year">${a.fecha || '—'}</span>
            <span class="card-autor">${escHtml(a.autor || 'Desconocido')}</span>
          </div>
        </div>
        <div class="card-expand-btn"><span class="arrow">▼</span> Detalles bibliográficos</div>
        <div class="card-detail">
          ${a.revista ? detailRow('Revista', a.revista) : ''}
          ${a.yacimiento ? detailRow('Yacimiento', a.yacimiento) : ''}
          ${a.descripcion ? detailRow('Descripción', a.descripcion) : ''}
        </div>
      </div>`;
    });
    html += '</div>';
  }
  body.innerHTML = html;
}

function detailRow(label, value) {
  return `<div class="detail-row"><span class="detail-label">${escHtml(label)}</span><span class="detail-value">${escHtml(value)}</span></div>`;
}

function toggleCard(i) { document.getElementById(`card-${i}`).classList.toggle('expanded'); }

function closeArticlePanel() {
  SELECTED_CODINE = null;
  document.getElementById('article-panel').className = 'article-panel-closed';
  document.getElementById('map-container').style.right = '0';
  refreshMap();
}

// ─── FILTERS ──────────────────────────────────────────────────────────────────
function buildFilters() {
  const epocas = [...new Set(ALL_ARTICLES.map(a => a.epoca).filter(Boolean))].sort();
  const epocaEl = document.getElementById('filter-epoca');
  epocas.forEach(e => {
    const pill = document.createElement('div'); pill.className = 'pill'; pill.textContent = e;
    pill.onclick = () => toggleFilter('epocas', e, pill);
    epocaEl.appendChild(pill);
  });

  const tipos = [...new Set(ALL_ARTICLES.map(a => a.tipo_yacimiento).filter(Boolean))].sort();
  const tipoEl = document.getElementById('filter-tipo');
  tipos.forEach(t => {
    const pill = document.createElement('div'); pill.className = 'pill'; pill.textContent = t;
    pill.onclick = () => toggleFilter('tipos', t, pill);
    tipoEl.appendChild(pill);
  });
}

function toggleFilter(key, value, pill) {
  if (ACTIVE_FILTERS[key].has(value)) {
    ACTIVE_FILTERS[key].delete(value); pill.classList.remove('active');
  } else {
    ACTIVE_FILTERS[key].add(value); pill.classList.add('active');
  }
  applyFilters();
}

function applyFilters() {
  refreshMap();
  if (SELECTED_CODINE) {
    const f = ALL_MUNICIPALITIES.find(m => (m.properties.CODINE || m.properties.codine) === SELECTED_CODINE);
    if (f) showArticlePanel(f.properties);
  }
}

// ─── SEARCH & CONTROLS ────────────────────────────────────────────────────────
function initSearch() {
  const input = document.getElementById('search-input');
  const dropdown = document.getElementById('search-dropdown');

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    dropdown.innerHTML = '';
    if (!q) { dropdown.classList.add('hidden'); return; }

    const matches = ALL_MUNICIPALITIES.filter(f => {
      const p = f.properties;
      const n = (p.Nombre || p.nombre || '').toLowerCase();
      const c = String(p.CODINE || p.codine || '');
      return n.includes(q) || c.includes(q);
    }).slice(0, 12);

    if (matches.length === 0) { dropdown.classList.add('hidden'); return; }

    matches.forEach(f => {
      const p = f.properties;
      const codine = p.CODINE || p.codine;
      const nombre = p.Nombre || p.nombre || "Desconocido";
      const count = getFilteredCount(codine);
      const center = getPolygonCenter(f);

      const item = document.createElement('div');
      item.className = 'search-item';
      item.innerHTML = `<span>${escHtml(nombre)}</span>${count > 0 ? `<span class="muni-count">${count}</span>` : ''}`;
      
      item.onclick = () => {
        input.value = nombre;
        dropdown.classList.add('hidden');
        if (center) MAP.setView(center, 12);
        SELECTED_CODINE = codine;
        showArticlePanel(p);
        refreshMap();
      };
      dropdown.appendChild(item);
    });
    dropdown.classList.remove('hidden');
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#search-section')) dropdown.classList.add('hidden');
  });
}

function bindControls() {
  document.getElementById('panel-toggle').onclick = () => {
    PANEL_OPEN = !PANEL_OPEN;
    document.getElementById('side-panel').className = PANEL_OPEN ? 'panel-open' : 'panel-closed';
    document.getElementById('map-container').className = PANEL_OPEN ? '' : 'panel-collapsed';
    setTimeout(() => MAP.invalidateSize(), 320);
  };

  document.getElementById('article-panel-close').onclick = closeArticlePanel;

  const minEl = document.getElementById('year-min'), maxEl = document.getElementById('year-max');
  const minLb = document.getElementById('year-min-label'), maxLb = document.getElementById('year-max-label');

  function syncRanges() {
    let v1 = parseInt(minEl.value), v2 = parseInt(maxEl.value);
    if (v1 > v2) { [v1, v2] = [v2, v1]; minEl.value = v1; maxEl.value = v2; }
    minLb.textContent = v1; maxLb.textContent = v2;
    ACTIVE_FILTERS.yearMin = v1; ACTIVE_FILTERS.yearMax = v2;
    applyFilters();
  }
  minEl.oninput = syncRanges; maxEl.oninput = syncRanges;

  document.getElementById('layer-municipios').onchange = refreshMap;
  
  document.getElementById('layer-larioja').onchange = e => {
      if (!LARIOJA_LAYER) return;
      if (e.target.checked) {
          LARIOJA_LAYER.addTo(MAP);
      } else {
          MAP.removeLayer(LARIOJA_LAYER);
      }
  };
  
  document.getElementById('layer-labels').onchange = refreshMap;

  document.getElementById('btn-reset').onclick = () => {
    ACTIVE_FILTERS.epocas.clear(); ACTIVE_FILTERS.tipos.clear();
    ACTIVE_FILTERS.yearMin = 2010; ACTIVE_FILTERS.yearMax = 2026;
    minEl.value = 2010; maxEl.value = 2026;
    minLb.textContent = '2010'; maxLb.textContent = '2026';
    document.querySelectorAll('.pill.active').forEach(p => p.classList.remove('active'));
    applyFilters();
  };
}

function updateStats() {
  const filtered = ALL_ARTICLES.filter(matchesFilter);
  const munisWithArticles = new Set(filtered.flatMap(a => a.codines));
  document.getElementById('stat-total').textContent = ALL_ARTICLES.length;
  document.getElementById('stat-muni').textContent = munisWithArticles.size;
  document.getElementById('stat-filtered').textContent = filtered.length;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', init);