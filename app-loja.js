// UI especifica da vitrine de produtos.
let filtroTemaAtual = 'todos';

function pesquisarNoCabecalho() {
    if (obterVistaPagina() !== 'loja') {
        return;
    }
    if(typeof executarFiltrosCombinados === 'function') executarFiltrosCombinados();
}

function aplicarPesquisaUrl() {
    if (obterVistaPagina() !== 'loja') return;
    const pesquisa = (new URLSearchParams(window.location.search).get('q') || '').trim();
    const campo = document.getElementById('campo-pesquisa');
    if (campo && pesquisa) {
        campo.value = pesquisa;
        if(typeof executarFiltrosCombinados === 'function') executarFiltrosCombinados();
    }
}
let frameAtualizacaoStickyTemas = null;
let observadorTamanhoMenuTemas = null;
let folhaDinamicaTemas = null;

function definirCssDinamicoTemas(cssTexto) {
    try {
        if (!('adoptedStyleSheets' in document) || typeof CSSStyleSheet === 'undefined') return;
        if (!folhaDinamicaTemas) {
            folhaDinamicaTemas = new CSSStyleSheet();
            document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets || []).concat(folhaDinamicaTemas);
        }
        if (typeof folhaDinamicaTemas.replaceSync === 'function') {
            folhaDinamicaTemas.replaceSync(cssTexto || '');
        }
    } catch (error) {
        console.warn('CSS dinâmico ignorado:', error);
    }
}

function atualizarStickyTemas() {
    const coluna = document.querySelector('.coluna-esquerda');
    const menu = document.getElementById('menu-lateral-temas');
    const header = document.querySelector('header');
    if (!coluna || !menu) return;

    if (window.matchMedia && window.matchMedia('(max-width: 1100px)').matches) {
        const headerBottom = header ? header.getBoundingClientRect().bottom : 76;
        const stickyTop = Math.max(0, Math.floor(headerBottom) - 2);
        definirCssDinamicoTemas(`.coluna-esquerda { --temas-sticky-top: ${stickyTop}px; }`);
        return;
    }

    const margem = 20;
    const headerBottom = header ? header.getBoundingClientRect().bottom : 76;
    const topoNormal = Math.ceil(headerBottom + margem);
    const alturaMenu = Math.ceil(menu.offsetHeight);
    const topoComFundoVisivel = Math.floor(window.innerHeight - alturaMenu - margem);
    const stickyTop = Math.min(topoNormal, topoComFundoVisivel);

    definirCssDinamicoTemas(`.coluna-esquerda { --temas-sticky-top: ${stickyTop}px; }`);
}

function agendarAtualizacaoStickyTemas() {
    if(frameAtualizacaoStickyTemas !== null) {
        cancelAnimationFrame(frameAtualizacaoStickyTemas);
    }

    frameAtualizacaoStickyTemas = requestAnimationFrame(() => {
        frameAtualizacaoStickyTemas = null;
        atualizarStickyTemas();
    });
}

function observarTamanhoMenuTemas() {
    const menu = document.getElementById('menu-lateral-temas');
    if(!menu || typeof ResizeObserver === 'undefined') return;

    if(observadorTamanhoMenuTemas) {
        observadorTamanhoMenuTemas.disconnect();
    }

    observadorTamanhoMenuTemas = new ResizeObserver(() => {
        agendarAtualizacaoStickyTemas();
    });
    observadorTamanhoMenuTemas.observe(menu);
}
window.addEventListener('hashchange', () => {
    const vistaHash = obterVistaHash();
    if (vistaHash) mostrarVista(vistaHash);
});

function inicializarPaginaLoja() {
    if (typeof window.sincronizarEspacamentoCabecalho === 'function') {
        window.sincronizarEspacamentoCabecalho();
    }
    observarTamanhoMenuTemas();
    agendarAtualizacaoStickyTemas();
    document.fonts?.ready.then(() => {
        if (typeof window.sincronizarEspacamentoCabecalho === 'function') {
            window.sincronizarEspacamentoCabecalho();
        }
        agendarAtualizacaoStickyTemas();
    });
    window.addEventListener('resize', agendarAtualizacaoStickyTemas);
    window.visualViewport?.addEventListener('resize', agendarAtualizacaoStickyTemas);
    window.addEventListener('scroll', agendarAtualizacaoStickyTemas, { passive: true });
}
