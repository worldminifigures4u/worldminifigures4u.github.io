// Agendamento de conta-cliente.js na pagina Conta.
(function () {
    function prepararContaSemFlash() {
        if (document.body?.dataset?.page === 'conta') {
            document.body.classList.add('conta-a-verificar');
        }
        document.getElementById('conteudo-cliente-anonimo')?.classList.add('oculto');
        document.querySelectorAll('[data-seccao-conta="historico"]').forEach((botao) => {
            botao.remove();
        });
    }

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
        if (urlTemRecuperacaoConta() || pareceSessaoAtiva()) {
            window.garantirContaCliente().catch(console.error);
            return;
        }
        const iniciar = () => window.garantirContaCliente().catch(console.error);
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(iniciar, { timeout: 3000 });
        } else {
            window.setTimeout(iniciar, 2000);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        prepararContaSemFlash();

        const painel = document.getElementById('painel-cliente');
        const formLogin = document.getElementById('form-login');
        if (!painel && !formLogin) return;

        const pedirConta = () => {
            if (typeof window.garantirContaCliente === 'function') {
                window.garantirContaCliente().catch(console.error);
            }
        };
        const raiz = painel || document.body;

        raiz.querySelectorAll('form, button, input, select, textarea, a[data-aba-cliente], [data-acao-cliente], [data-seccao-conta]').forEach((elemento) => {
            elemento.addEventListener('focus', pedirConta, { once: true });
            elemento.addEventListener('click', pedirConta, { once: true });
        });

        agendarCarregamentoConta();
    });

    prepararContaSemFlash();
})();
