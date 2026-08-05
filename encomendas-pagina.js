(function () {
    'use strict';

    let promessaEncomendasJs = null;

    function carregarScript(src) {
        return new Promise(function (resolve, reject) {
            const script = document.createElement('script');
            script.src = src;
            script.defer = true;
            script.onload = function () { resolve(); };
            script.onerror = function () { reject(new Error('Falha ao carregar ' + src)); };
            document.body.appendChild(script);
        });
    }

    function carregarEncomendasJs() {
        if (typeof iniciarPainelEncomendas === 'function') return Promise.resolve();
        if (promessaEncomendasJs) return promessaEncomendasJs;

        promessaEncomendasJs = carregarScript('morada-formato.js?v=20260713-morada-formatada')
            .then(function () {
                return carregarScript('paises-cliente.js?v=20260731-wallapop-es');
            })
            .then(function () {
                return carregarScript('encomendas.js?v=20260805-fechar-modal-concluida');
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
