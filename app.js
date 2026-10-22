'use strict';
// Los datos viven en sedes.js (const SEDES). Se trabaja sobre una copia para no mutar el original.
const LISTA = SEDES.map(s => ({ ...s }));

const $app = document.getElementById('app');
let ubicado = false;
let cercana = null;
let error = null;
let buscando = false;

// Quita acentos: usa el rango de marcas combinantes escrito con escapes (robusto ante cambios de codificación).
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Atributos que el helper acepta; cualquier otro se ignora.
const ATTR_OK = new Set([
  'type', 'placeholder', 'aria-label', 'tabindex', 'role',
  'href', 'target', 'rel', 'disabled'
]);
const urlSegura = u => {
  try { return ['https:', 'http:'].includes(new URL(u).protocol); }
  catch { return false; }
};

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) { if (typeof v === 'function') e.addEventListener(k.slice(2), v); }
    else if (ATTR_OK.has(k)) {
      if (k === 'href' && !urlSegura(v)) continue;
      e.setAttribute(k, v);
    }
  }
  kids.flat().forEach(c => e.append(c));
  return e;
}

const horario = s => (s.inicio && s.fin) ? `${s.inicio} – ${s.fin} h` : 'Horario por confirmar';
function distTxt(m) {
  if (m == null) return '';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

function haversine(a, b, c, d) {
  const R = 6371000, r = x => x * Math.PI / 180;
  const dLat = r(c - a), dLon = r(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function mapaUrl(s) {
  const q = [s.direccion, s.nombre].filter(Boolean).join(', ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}

function ubicar() {
  error = null;
  if (!('geolocation' in navigator)) {
    error = 'Tu navegador no permite obtener la ubicación. Elige tu sede en la lista.';
    return render();
  }
  buscando = true; render();
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: la, longitude: lo } = pos.coords;
    LISTA.forEach(s => { s.dist = haversine(la, lo, s.lat, s.lng); });
    LISTA.sort((a, b) => a.dist - b.dist);
    ubicado = true; cercana = LISTA[0]; buscando = false; render();
  }, err => {
    buscando = false;
    error = err.code === 1
      ? 'Sin permiso de ubicación. Actívalo en el navegador o elige tu sede en la lista.'
      : err.code === 3
        ? 'Tardó demasiado en obtener tu ubicación. Inténtalo de nuevo o elige tu sede en la lista.'
        : 'No se pudo obtener tu ubicación. Inténtalo de nuevo o elige tu sede en la lista.';
    render();
  }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
}

const avisoAprox = s => s.coordAprox
  ? el('p', { class: 'aprox', text: '⚠ Ubicación aproximada: confirma la dirección antes de ir.' })
  : '';

function tarjeta(s) {
  return el('div', { class: 'card' },
    el('h3', { text: s.nombre }),
    s.dist != null ? el('p', { class: 'mut', text: `A ${distTxt(s.dist)} aprox. (en línea recta)` }) : '',
    avisoAprox(s),
    el('p', { text: horario(s) }),
    s.direccion ? el('p', { text: s.direccion }) : '');
}
function fila(t, txt) { return el('div', { class: 'fila' }, el('b', { text: t }), el('span', { text: txt })); }

function vistaInicio() {
  const v = el('div', {},
    el('h1', { text: 'Noche de las Estrellas 2026' }),
    el('p', { text: 'Encuentra la sede más cercana a ti' }),
    el('p', { class: 'mut', text: `${LISTA.length} sedes en todo México.` }),
    el('button', { class: 'pri', text: buscando ? 'Buscando…' : '📍 Encontrar mi sede', onclick: ubicar, ...(buscando ? { disabled: '' } : {}) }),
    el('button', { text: 'Ver todas las sedes', onclick: () => { location.hash = '#lista'; } }));
  if (error) v.append(el('div', { class: 'card err', role: 'alert', text: error }));
  if (cercana) {
    v.append(el('h2', { text: 'Tu sede más cercana' }), tarjeta(cercana),
      el('button', { text: 'Ver actividades y detalles', onclick: () => { location.hash = '#sede/' + cercana.id; } }));
  }
  v.append(el('p', { class: 'aviso', text: 'Tu ubicación solo se usa en tu dispositivo para calcular la distancia; no se envía a ningún servidor.' }));
  v.append(el('p', { class: 'offline', text: 'Tras la primera carga, la información de las sedes funciona sin internet. El botón «Cómo llegar» sí requiere conexión.' }));
  return v;
}

function vistaLista() {
  const input = el('input', { type: 'search', placeholder: 'Buscar sede o ciudad', 'aria-label': 'Buscar sede' });
  const ul = el('ul', { class: 'lista' });
  const base = [...LISTA];
  if (!ubicado) base.sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)));
  const pintar = () => {
    ul.replaceChildren();
    const q = norm(input.value.trim());
    base.filter(s => !q || norm(s.nombre).includes(q)).forEach(s => {
      const li = el('li', { tabindex: '0', role: 'link' },
        el('div', {}, el('span', { text: s.nombre }), el('small', { text: horario(s) })),
        el('span', { class: 'dist', text: ubicado ? distTxt(s.dist) : '›' }));
      const ir = () => { location.hash = '#sede/' + s.id; };
      li.addEventListener('click', ir);
      li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(); } });
      ul.append(li);
    });
    if (!ul.children.length) ul.append(el('p', { class: 'mut', text: 'Sin resultados.' }));
  };
  input.addEventListener('input', pintar); pintar();
  return el('div', {},
    el('button', { class: 'back', text: '← Inicio', onclick: () => { location.hash = ''; } }),
    el('h1', { text: 'Todas las sedes' }), input, ul);
}

function vistaDetalle(id) {
  const s = LISTA.find(x => String(x.id) === String(id));
  if (!s) return vistaLista();
  const v = el('div', {},
    el('button', { class: 'back', text: '← Atrás', onclick: () => { history.length > 1 ? history.back() : (location.hash = ''); } }),
    el('h1', { text: s.nombre }));
  if (s.dist != null) v.append(el('p', { class: 'mut', text: `A ${distTxt(s.dist)} aprox. de ti` }));
  if (s.coordAprox) v.append(avisoAprox(s));
  v.append(fila('Horario', horario(s)));
  if (s.direccion) v.append(fila('Dirección', s.direccion));
  if (s.evento) v.append(fila('Evento magistral', s.horaEvento ? `${s.evento} (${s.horaEvento} h)` : s.evento));
  else if (s.horaEvento) v.append(fila('Evento magistral', `${s.horaEvento} h`));
  if (s.redes) v.append(fila('Redes', s.redes));
  v.append(el('h2', { text: 'Actividades' }));
  v.append(s.actividades.length
    ? el('div', { class: 'chips' }, s.actividades.map(a => el('span', { class: 'chip', text: a })))
    : el('p', { text: 'Por confirmar' }));
  v.append(el('a', { class: 'btn pri', href: mapaUrl(s), target: '_blank', rel: 'noopener noreferrer', text: '🧭 Cómo llegar' }));
  return v;
}

function render() {
  const h = location.hash;
  let v;
  if (h.startsWith('#sede/')) v = vistaDetalle(h.slice(6));
  else if (h === '#lista') v = vistaLista();
  else v = vistaInicio();
  $app.replaceChildren(v);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);
render();

// El banner es opcional: si Banner.png no existe, se oculta (sin handlers en línea por la CSP).
const bannerImg = document.querySelector('#banner img');
if (bannerImg) {
  const ocultar = () => { document.getElementById('banner').hidden = true; };
  bannerImg.addEventListener('error', ocultar);
  if (bannerImg.complete && bannerImg.naturalWidth === 0) ocultar();
}

// Service worker: permite instalar la PWA y usarla sin conexión.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin SW la página sigue funcionando */ });
  });
}
