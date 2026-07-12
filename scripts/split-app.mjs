import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('app.js', 'utf8');
const lines = src.split(/\r?\n/);

const slice = (start, end) => lines.slice(start - 1, end).join('\n') + '\n';

writeFileSync('app-portes.js', `// Tabelas de portes usadas pelo carrinho.\n${slice(6, 97)}`);

writeFileSync(
    'app-favoritos.js',
    `// Estado e funcoes de favoritos.\nlet favoritosProdutos = new Set(carregarFavoritosLocal());\nlet favoritosChaveAtual = 'figures-planet-favoritos';\n\n${slice(174, 250)}`
);

writeFileSync('app-sku.js', `// Geracao de SKU para gestao.\n${slice(582, 626)}`);

writeFileSync(
    'app-loja.js',
    `// UI especifica da vitrine de produtos.\nlet filtroTemaAtual = 'todos';\n\n${slice(364, 379)}${slice(381, 444)}window.addEventListener('hashchange', () => {
    const vistaHash = obterVistaHash();
    if (vistaHash) mostrarVista(vistaHash);
});

function inicializarPaginaLoja() {
    observarTamanhoMenuTemas();
    agendarAtualizacaoStickyTemas();
    document.fonts?.ready.then(agendarAtualizacaoStickyTemas);
    window.addEventListener('resize', agendarAtualizacaoStickyTemas);
    window.visualViewport?.addEventListener('resize', agendarAtualizacaoStickyTemas);
}
`
);

console.log('Split concluido (app-core.js removido do site; usar app-sessao.js).');
