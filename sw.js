/* PlantaCalc — service worker: abre rápido e sem internet.
   - Páginas e arquivos do site: entrega a cópia guardada na hora e atualiza a cópia em segundo plano.
   - Bibliotecas com versão fixa (CDN) e fontes: guardadas uma vez.
   - version.json, Supabase, Mercado Pago, anúncios e IA: sempre pela internet, nunca guardados.
   - Versão nova: o aviso "Atualizar agora" do programa troca a cópia guardada antes de recarregar. */
const CACHE = 'pc-site-v1';
const SITE = ['app.html', 'index.html', 'conta.html', 'config.js', 'manifest.webmanifest', 'site.css', 'sinapi_mapa.json', 'img/icon-192.png', 'img/icon-512.png', 'img/icone.svg'];

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('pc-site-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const chave = (url) => { const u = new URL(url); u.search = ''; u.hash = ''; if (u.pathname.endsWith('/')) u.pathname += 'index.html'; return u.toString(); };
const doSite = (u) => u.origin === self.location.origin;
const nuncaGuardar = (u) => doSite(u) && /\/(version\.json|admin\.(html|js)|sw\.js)$/.test(u.pathname);
const imutavel = (u) => (u.hostname === 'cdn.jsdelivr.net' && /@\d+\.\d+\.\d+/.test(u.pathname)) || u.hostname === 'fonts.gstatic.com' || u.hostname === 'fonts.googleapis.com';

async function guardadaOuRede(req, u) {
  const c = await caches.open(CACHE);
  const k = chave(req.url);
  const g = await c.match(k);
  const rede = fetch(req).then((r) => { if (r && r.ok && r.type !== 'opaque') c.put(k, r.clone()); return r; }).catch(() => null);
  if (g) { rede.catch(() => {}); return g; }
  const r = await rede;
  if (r) return r;
  if (req.mode === 'navigate') { const app = await c.match(chave(new URL('app.html', self.location).toString())); if (app) return app; }
  return new Response('Sem internet', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
async function umaVez(req) {
  const c = await caches.open(CACHE);
  const g = await c.match(req.url);
  if (g) return g;
  const r = await fetch(req);
  if (r && (r.ok || r.type === 'opaque')) c.put(req.url, r.clone());
  return r;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (nuncaGuardar(u)) return;
  if (doSite(u)) { e.respondWith(guardadaOuRede(req, u)); return; }
  if (imutavel(u)) { e.respondWith(umaVez(req)); return; }
  /* Supabase, Mercado Pago, anúncios, IA e o resto: direto pela internet */
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.tipo === 'atualizar') {
    e.waitUntil((async () => {
      const c = await caches.open(CACHE);
      for (const p of SITE) { try { const r = await fetch(p, { cache: 'reload' }); if (r.ok) await c.put(chave(new URL(p, self.location).toString()), r); } catch (x) { /* fica a anterior */ } }
      if (e.source) e.source.postMessage({ tipo: 'atualizado' });
    })());
  }
});
