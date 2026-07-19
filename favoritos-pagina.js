// Carregamento tardio de favoritos-ui.js na pagina Favoritos.
(function () {
    let promessaFavoritosUi = null;
    let promessaCartMini = null;

    function carregarScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Falha ao carregar ' + src));
            document.body.appendChild(script);
        });
    }

    function garantirCartMini() {
        if (typeof adicionarAoCarrinho === 'function') return Promise.resolve();
        if (!promessaCartMini) {
            promessaCartMini = carregarScript('cart-mini.js?v=20260711-leve');
        }
        return promessaCartMini;
    }

    function garantirFavoritosUi() {
        if (typeof renderizarFavoritosCliente === 'function') return Promise.resolve();
        if (promessaFavoritosUi) return promessaFavoritosUi;

        promessaFavoritosUi = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'favoritos-ui.js?v=20260719-vazio-sem-botao';
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Falha ao carregar favoritos-ui.js'));
            document.body.appendChild(script);
        });

        return promessaFavoritosUi;
    }

    window.garantirFavoritosUi = garantirFavoritosUi;

    function pareceSessaoAtiva() {
        try {
            return Object.keys(localStorage).some((chave) => (
                chave.includes('auth-token') && localStorage.getItem(chave)
            ));
        } catch (erro) {
            return false;
        }
    }

    async function iniciarPaginaFavoritos() {
        if (document.body?.dataset?.page !== 'favoritos') return;
        if (typeof window.garantirAppFavoritos === 'function') {
            await window.garantirAppFavoritos();
        }
        await garantirCartMini();
        await garantirFavoritosUi();
        if (typeof renderizarFavoritosCliente === 'function') {
            renderizarFavoritosCliente();
        }
    }

    function agendarCarregamentoFavoritos() {
        const iniciar = () => iniciarPaginaFavoritos().catch(console.error);
        if (pareceSessaoAtiva()) {
            iniciar();
            return;
        }
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(iniciar, { timeout: 2500 });
        } else {
            window.setTimeout(iniciar, 1500);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const lista = document.getElementById('lista-favoritos-cliente');
        if (!lista) return;

        const pedirUi = () => iniciarPaginaFavoritos().catch(console.error);
        lista.addEventListener('mouseenter', pedirUi, { once: true });
        lista.addEventListener('focusin', pedirUi, { once: true });

        agendarCarregamentoFavoritos();
    });
})();
