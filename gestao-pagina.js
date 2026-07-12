// Agendamento de conta-cliente.js na pagina Gestao.
(function () {
    function urlTemRecuperacaoConta() {
        const params = new URLSearchParams(window.location.search);
        const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
        const hashParams = new URLSearchParams(hash);
        return params.get('type') === 'recovery'
            || params.has('code')
            || params.has('access_token')
            || hashParams.get('type') === 'recovery'
            || hashParams.has('access_token');
    }

    function agendarCarregamentoConta() {
        if (typeof window.garantirContaCliente !== 'function') return;
        if (urlTemRecuperacaoConta()) {
            window.garantirContaCliente().catch(console.error);
            return;
        }
        const iniciar = () => window.garantirContaCliente().catch(console.error);
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(iniciar, { timeout: 3500 });
        } else {
            window.setTimeout(iniciar, 2000);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const painel = document.getElementById('painel-cliente');
        if (!painel) return;

        const pedirConta = () => {
            if (typeof window.garantirContaCliente === 'function') {
                window.garantirContaCliente().catch(console.error);
            }
        };
        painel.addEventListener('focusin', pedirConta, { once: true });
        painel.querySelectorAll('form, button, input, select, textarea, a').forEach((elemento) => {
            elemento.addEventListener('focus', pedirConta, { once: true });
            elemento.addEventListener('click', pedirConta, { once: true });
        });

        agendarCarregamentoConta();
    });
})();
