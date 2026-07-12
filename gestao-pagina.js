// Carregamento tardio de conta-cliente.js na pagina Gestao.
(function () {
    let promessaContaCliente = null;

    function garantirContaClienteGestao() {
        if (typeof fazerLogin === 'function') return Promise.resolve();
        if (promessaContaCliente) return promessaContaCliente;

        promessaContaCliente = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'conta-cliente.js?v=20260711-leve-r11';
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Falha ao carregar conta-cliente.js'));
            document.body.appendChild(script);
        });

        return promessaContaCliente;
    }

    window.garantirContaClienteGestao = garantirContaClienteGestao;

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
        if (urlTemRecuperacaoConta()) {
            garantirContaClienteGestao().catch(console.error);
            return;
        }
        const iniciar = () => garantirContaClienteGestao().catch(console.error);
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(iniciar, { timeout: 3500 });
        } else {
            window.setTimeout(iniciar, 2000);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const painel = document.getElementById('painel-cliente');
        if (!painel) return;

        const pedirConta = () => garantirContaClienteGestao().catch(console.error);
        painel.addEventListener('focusin', pedirConta, { once: true });
        painel.querySelectorAll('form, button, input, select, textarea, a').forEach((elemento) => {
            elemento.addEventListener('focus', pedirConta, { once: true });
            elemento.addEventListener('click', pedirConta, { once: true });
        });

        agendarCarregamentoConta();
    });
})();
