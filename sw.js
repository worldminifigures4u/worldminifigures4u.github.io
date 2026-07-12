const CACHE_ESTATICO = 'figures-planet-estatico-v18';

const RECURSOS_PRECARGA = [
    'app-config.js',
    'app-util.js',
    'styles.css',
    'styles-tema.css',
    'async-css.js',
    'critico-loja.css',
    'critico-gestao.css',
    'app-admin-gestao-loader.js',
    'loja.css',
    'conta.css',
    'gestao.css',
    'carrinho.css',
    'favoritos.css',
    'institucional.css',
    'app-sessao.js',
    'app-carrinho.js',
    'app-favoritos-loader.js',
    'gestao-admin-loader.js',
    'carrinho-core.js',
    'carrinho-pagina.js',
    'conta-cliente-loader.js',
    'conta-pagina.js',
    'favoritos-pagina.js',
    'gestao-pagina.js',
    'loja-pagina.js',
    'supabase-cdn.js',
    'cart-mini.js',
    'inline-listeners-base.js',
    'inline-listeners-loja.js',
    'inline-listeners-conta.js',
    'figures-planet-logo-transparent.webp',
    'favicon-32.webp'
];

self.addEventListener('install', evento => {
    evento.waitUntil(
        caches.open(CACHE_ESTATICO)
            .then(cache => cache.addAll(RECURSOS_PRECARGA))
            .then(() => self.skipWaiting())
            .catch(() => self.skipWaiting())
    );
});

self.addEventListener('activate', evento => {
    evento.waitUntil(
        caches.keys()
            .then(chaves => Promise.all(
                chaves
                    .filter(chave => chave !== CACHE_ESTATICO)
                    .map(chave => caches.delete(chave))
            ))
            .then(() => self.clients.matchAll({ type: 'window' }))
            .then(clientes => Promise.all(
                clientes.map(cliente => cliente.navigate(cliente.url))
            ))
            .then(() => self.clients.claim())
    );
});

function pedidoCacheavel(pedido) {
    if (pedido.method !== 'GET') return false;
    const url = new URL(pedido.url);
    if (url.origin !== self.location.origin) return false;
    return /\.(?:css|js|webp|png|woff2?)$/i.test(url.pathname);
}

self.addEventListener('fetch', evento => {
    if (!pedidoCacheavel(evento.request)) return;

    evento.respondWith(
        caches.match(evento.request).then(emCache => {
            const rede = fetch(evento.request).then(resposta => {
                if (resposta.ok) {
                    const copia = resposta.clone();
                    caches.open(CACHE_ESTATICO).then(cache => cache.put(evento.request, copia));
                }
                return resposta;
            });
            return emCache || rede;
        })
    );
});
