// Carregamento partilhado de app-sku.js e gestao-admin.js.
(function () {
    let promessaAppSku = null;
    let promessaGestaoAdmin = null;

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

    function garantirAppSku() {
        if (typeof gerarSkuProduto === 'function') return Promise.resolve();
        if (!promessaAppSku) {
            promessaAppSku = carregarScript('app-sku.js?v=20260716-pesquisa-trim');
        }
        return promessaAppSku;
    }

    function garantirGestaoAdmin() {
        if (typeof carregarProdutosAdminDaNuvem === 'function') return Promise.resolve();
        if (!promessaGestaoAdmin) {
            promessaGestaoAdmin = garantirAppSku()
                .then(() => carregarScript('gestao-admin.js?v=20260713-r27'));
        }
        return promessaGestaoAdmin;
    }

    window.garantirGestaoAdmin = garantirGestaoAdmin;
})();
