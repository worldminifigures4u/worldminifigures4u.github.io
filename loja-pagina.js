// Agendamento de app-favoritos.js na pagina da loja.
(function () {
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

    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('vitrine-produtos')) return;
        agendarFavoritosLoja();
    });
})();
