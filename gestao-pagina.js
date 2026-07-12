// Agendamento de conta-cliente.js e gestao-admin.js na pagina Gestao.
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

    function pareceSessaoAtiva() {
        try {
            return Object.keys(localStorage).some((chave) => (
                chave.includes('auth-token') && localStorage.getItem(chave)
            ));
        } catch (erro) {
            return false;
        }
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

    function agendarGestaoAdmin() {
        if (!document.body.classList.contains('pagina-gestao')) return;
        if (typeof window.garantirGestaoAdmin !== 'function') return;

        const iniciar = () => window.garantirGestaoAdmin().catch(console.error);
        if (pareceSessaoAtiva()) {
            iniciar();
            return;
        }
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(iniciar, { timeout: 2000 });
        } else {
            window.setTimeout(iniciar, 1200);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (document.body.classList.contains('pagina-gestao')) {
            const pedirAdmin = () => {
                if (typeof window.garantirGestaoAdmin === 'function') {
                    window.garantirGestaoAdmin().catch(console.error);
                }
            };

            document.getElementById('painel-admin')?.addEventListener('focusin', pedirAdmin, { once: true });
            document.querySelectorAll('[data-tab-gestao], #form-admin-produto, .gestao-tabs button, .admin-seccao button, .admin-seccao input, .admin-seccao textarea').forEach((elemento) => {
                elemento.addEventListener('focus', pedirAdmin, { once: true });
                elemento.addEventListener('click', pedirAdmin, { once: true });
            });
            agendarGestaoAdmin();
        }

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
