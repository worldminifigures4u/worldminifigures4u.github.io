(function () {
    'use strict';

    let promessaEncomendasJs = null;

    function carregarEncomendasJs() {
        if (typeof iniciarPainelEncomendas === 'function') return Promise.resolve();
        if (promessaEncomendasJs) return promessaEncomendasJs;

        promessaEncomendasJs = new Promise(function (resolve, reject) {
            const script = document.createElement('script');
            script.src = 'encomendas.js?v=20260713-bloquear-cliente';
            script.defer = true;
            script.onload = function () { resolve(); };
            script.onerror = function () { reject(new Error('Falha ao carregar encomendas.js')); };
            document.body.appendChild(script);
        });

        return promessaEncomendasJs;
    }

    async function iniciarPaginaEncomendas() {
        if (!document.getElementById('encomendas-bloqueio')) return;

        await window.garantirAdminEncomendaVista();
        await carregarEncomendasJs();

        if (typeof iniciarPainelEncomendas === 'function') {
            await iniciarPainelEncomendas();
        }
    }

    window.addEventListener('load', function () {
        iniciarPaginaEncomendas().catch(console.error);
    });
})();
