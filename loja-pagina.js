// Carregamento dos modulos da vitrine (app-loja, loja-produtos, cart-mini).
(function () {
    let promessaAppLoja = null;
    let promessaLojaProdutos = null;
    let promessaCartMini = null;
    let promessaModulosLoja = null;

    function carregarScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
            document.body.appendChild(script);
        });
    }

    function garantirCartMiniLoja() {
        if (typeof adicionarAoCarrinho === 'function') return Promise.resolve();
        if (!promessaCartMini) {
            promessaCartMini = carregarScript('cart-mini.js?v=20260711-leve');
        }
        return promessaCartMini;
    }

    function garantirAppLoja() {
        if (typeof inicializarPaginaLoja === 'function') return Promise.resolve();
        if (!promessaAppLoja) {
            promessaAppLoja = carregarScript('app-loja.js?v=20260711-modular');
        }
        return promessaAppLoja;
    }

    function garantirLojaProdutos() {
        if (typeof carregarProdutosDaNuvem === 'function') return Promise.resolve();
        if (!promessaLojaProdutos) {
            promessaLojaProdutos = garantirCartMiniLoja()
                .then(() => carregarScript('loja-produtos.js?v=20260712-temas-mobile'));
        }
        return promessaLojaProdutos;
    }

    function garantirModulosLoja() {
        if (typeof carregarProdutosDaNuvem === 'function' && typeof inicializarPaginaLoja === 'function') {
            return Promise.resolve();
        }
        if (!promessaModulosLoja) {
            promessaModulosLoja = Promise.all([
                garantirAppLoja(),
                garantirLojaProdutos()
            ]);
        }
        return promessaModulosLoja;
    }

    window.garantirModulosLoja = garantirModulosLoja;
    window.garantirAppLoja = garantirAppLoja;
    window.garantirLojaProdutos = garantirLojaProdutos;

    function pareceSessaoAtiva() {
        try {
            return Object.keys(localStorage).some((chave) => (
                chave.includes('auth-token') && localStorage.getItem(chave)
            ));
        } catch (erro) {
            return false;
        }
    }

    function atualizarCoracoesAposCarga() {
        if (typeof atualizarBotoesFavoritos === 'function') {
            atualizarBotoesFavoritos();
        }
    }

    function agendarFavoritosLoja() {
        if (document.body?.dataset?.page !== 'loja') return;
        if (typeof window.garantirAppFavoritos !== 'function') return;

        const iniciar = () => {
            window.garantirAppFavoritos()
                .then(atualizarCoracoesAposCarga)
                .catch(console.error);
        };

        if (pareceSessaoAtiva()) {
            iniciar();
            return;
        }

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(iniciar, { timeout: 4000 });
        } else {
            window.setTimeout(iniciar, 2500);
        }
    }

    function ligarInteracaoModulosLoja() {
        const pedirModulos = () => garantirModulosLoja().catch(console.error);

        document.getElementById('campo-pesquisa')?.addEventListener('focus', pedirModulos, { once: true });
        document.getElementById('menu-lateral-temas')?.addEventListener('click', pedirModulos, { once: true });
        document.getElementById('vitrine-produtos')?.addEventListener('mouseenter', pedirModulos, { once: true });
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('vitrine-produtos')) return;

        garantirModulosLoja().catch(console.error);
        ligarInteracaoModulosLoja();
        agendarFavoritosLoja();
    });
})();
