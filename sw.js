const CACHE_ESTATICO = 'figures-planet-estatico-v7';

const RECURSOS_PRECARGA = [
    'app-config.js',
    'styles.css',
    'app-core.js',
    'app-sessao.js',
    'app-carrinho.js',
    'carrinho-core.js',
    'carrinho-pagina.js',
    'conta-cliente-loader.js',
    'conta-pagina.js',
    'favoritos-pagina.js',
    'gestao-pagina.js',
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
