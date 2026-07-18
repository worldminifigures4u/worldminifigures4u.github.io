(function () {
    'use strict';

    let promessaVista = null;
    let promessaModal = null;
    let modalConfigurado = false;

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

    function garantirAdminEncomendaVista() {
        if (window.AdminEncomendaVista) return Promise.resolve();
        if (!promessaVista) {
            promessaVista = carregarScript('morada-formato.js?v=20260713-morada-formatada')
                .then(function () {
                    return carregarScript('admin-encomenda-vista.js?v=20260719-portes-total');
                });
        }
        return promessaVista;
    }

    function garantirModalEncomendaCliente() {
        if (modalConfigurado && typeof abrirModalEncomendaCliente === 'function') {
            return Promise.resolve();
        }
        if (!promessaModal) {
            promessaModal = garantirAdminEncomendaVista()
                .then(function () {
                    return carregarScript('clientes-encomenda-modal.js?v=20260713-r27');
                })
                .then(function () {
                    if (typeof configurarModalEncomendaCliente === 'function' && !modalConfigurado) {
                        configurarModalEncomendaCliente();
                        modalConfigurado = true;
                    }
                });
        }
        return promessaModal;
    }

    function abrirModalEncomendaClienteLazy(historico, indice) {
        return garantirModalEncomendaCliente().then(function () {
            if (typeof abrirModalEncomendaCliente === 'function') {
                abrirModalEncomendaCliente(historico, indice);
            }
        });
    }

    window.garantirAdminEncomendaVista = garantirAdminEncomendaVista;
    window.garantirModalEncomendaCliente = garantirModalEncomendaCliente;
    window.abrirModalEncomendaClienteLazy = abrirModalEncomendaClienteLazy;
})();
