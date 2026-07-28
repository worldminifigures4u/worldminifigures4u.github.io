// Carregamento tardio de portes e envio na pagina Carrinho.
(function () {
    let promessaPortes = null;
    let promessaEnvio = null;

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

    function garantirAppPortes() {
        if (typeof obterZonaPortesPorPais === 'function' && typeof garantirTabelaPortesCarregada === 'function') {
            return garantirTabelaPortesCarregada();
        }
        if (!promessaPortes) {
            promessaPortes = carregarScript('app-portes.js?v=20260728-inpost-nome')
                .then(() => typeof garantirTabelaPortesCarregada === 'function'
                    ? garantirTabelaPortesCarregada()
                    : undefined);
        }
        return promessaPortes;
    }

    function garantirModulosEnvioCarrinho() {
        if (typeof atualizarOpcoesEnvio === 'function') {
            return typeof garantirTabelaPortesCarregada === 'function'
                ? garantirTabelaPortesCarregada().then(() => undefined)
                : Promise.resolve();
        }
        if (!promessaEnvio) {
            promessaEnvio = garantirAppPortes()
                .then(() => carregarScript('carrinho-envio.js?v=20260718-metodos'));
        }
        return promessaEnvio;
    }

    window.garantirModulosEnvioCarrinho = garantirModulosEnvioCarrinho;
    window.garantirAppPortes = garantirAppPortes;

    function agendarPrecargaEnvio() {
        const iniciar = () => garantirModulosEnvioCarrinho().catch(() => {});
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(iniciar, { timeout: 4000 });
        } else {
            window.setTimeout(iniciar, 1500);
        }
    }

    window.addEventListener('load', () => {
        if (!document.getElementById('lista-carrinho')) return;
        agendarPrecargaEnvio();
    });
})();
