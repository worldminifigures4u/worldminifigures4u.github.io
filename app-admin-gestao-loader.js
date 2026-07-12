// Carregamento lazy do painel administrativo da pagina Gestao.
(function () {
    let promessaAdminGestao = null;

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

    function garantirAdminGestao() {
        if (typeof window.aplicarPainelGestaoAdmin === 'function') return Promise.resolve();
        if (!promessaAdminGestao) {
            promessaAdminGestao = carregarScript('app-admin-gestao.js?v=20260712-leve-r23');
        }
        return promessaAdminGestao;
    }

    window.garantirAdminGestao = garantirAdminGestao;
})();
