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

    function mostrarLoginGestaoSeNecessario() {
        if (!document.body.classList.contains('pagina-gestao')) return;
        if (document.body.classList.contains('cabecalho-com-admin')) return;

        const bloqueio = document.getElementById('gestao-bloqueio');
        if (bloqueio) bloqueio.hidden = true;

        if (typeof mostrarContaAnonimaSeExistir === 'function') {
            mostrarContaAnonimaSeExistir();
            return;
        }

        const autenticado = document.getElementById('conteudo-cliente-autenticado');
        const anonimo = document.getElementById('conteudo-cliente-anonimo');
        if (autenticado) autenticado.classList.add('oculto');
        if (anonimo) anonimo.classList.remove('oculto');
    }

    function aguardarDbClient(timeoutMs = 20000) {
        return new Promise((resolve, reject) => {
            const inicio = Date.now();
            const verificar = async () => {
                if (window.dbClient) {
                    resolve(window.dbClient);
                    return;
                }
                if (typeof garantirDbClient === 'function') {
                    try {
                        const cliente = await garantirDbClient();
                        if (cliente) {
                            resolve(cliente);
                            return;
                        }
                    } catch (erro) {
                        if (Date.now() - inicio >= timeoutMs) {
                            reject(erro);
                            return;
                        }
                    }
                }
                if (Date.now() - inicio >= timeoutMs) {
                    reject(new Error('Supabase indisponível.'));
                    return;
                }
                window.setTimeout(verificar, 100);
            };
            verificar();
        });
    }

    function ligarFormulariosGestao() {
        const painel = document.getElementById('painel-cliente');
        if (!painel) return;

        painel.addEventListener('submit', async (evento) => {
            const formulario = evento.target;
            if (!(formulario instanceof HTMLFormElement)) return;

            if (formulario.id === 'form-login') {
                evento.preventDefault();
                try {
                    if (typeof window.garantirContaCliente === 'function') {
                        await window.garantirContaCliente();
                    }
                    await aguardarDbClient();
                    if (typeof fazerLogin === 'function') {
                        await fazerLogin(evento);
                    }
                } catch (erro) {
                    console.error(erro);
                    const statusDiv = document.getElementById('status-cliente');
                    if (statusDiv) statusDiv.textContent = 'Erro: ligação ao servidor indisponível. Tente novamente.';
                }
            }
        });

        painel.addEventListener('click', async (evento) => {
            const botao = evento.target.closest('[data-aba-cliente]');
            if (!botao) return;
            if (typeof window.garantirContaCliente === 'function') {
                await window.garantirContaCliente();
            }
            if (typeof mudarAba === 'function') mudarAba(botao.dataset.abaCliente);
        });

        painel.addEventListener('click', async (evento) => {
            const botao = evento.target.closest('[data-acao-cliente="recuperar-password"]');
            if (!botao) return;
            if (typeof window.garantirContaCliente === 'function') {
                await window.garantirContaCliente();
            }
            if (typeof pedirRecuperacaoPassword === 'function') pedirRecuperacaoPassword();
        });
    }

    function agendarCarregamentoConta() {
        if (typeof window.garantirContaCliente !== 'function') return;
        if (urlTemRecuperacaoConta()) {
            window.garantirContaCliente().catch(console.error);
            return;
        }
        window.garantirContaCliente().catch(console.error);
    }

    function agendarGestaoAdmin() {
        if (!document.body.classList.contains('pagina-gestao')) return;
        if (typeof window.garantirGestaoAdmin !== 'function') return;

        const iniciar = () => window.garantirGestaoAdmin().catch(console.error);
        if (!document.body.classList.contains('cabecalho-com-admin')) return;
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

    function agendarFallbackLoginGestao() {
        window.setTimeout(() => {
            const bloqueio = document.getElementById('gestao-bloqueio');
            if (!bloqueio || bloqueio.hidden) return;
            if (document.body.classList.contains('cabecalho-com-admin')) return;
            if (bloqueio.textContent.trim() !== 'A verificar acesso administrativo...') return;
            mostrarLoginGestaoSeNecessario();
        }, 4000);
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
            agendarFallbackLoginGestao();
            ligarFormulariosGestao();
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

    function reagirSessaoGestaoPronta() {
        if (!document.body.classList.contains('pagina-gestao')) return;
        if (!document.body.classList.contains('cabecalho-com-admin')) return;
        if (typeof window.garantirAdminGestao === 'function') {
            window.garantirAdminGestao().catch(console.error);
        }
        if (typeof window.garantirGestaoAdmin === 'function') {
            window.garantirGestaoAdmin().catch(console.error);
        }
    }

    window.addEventListener('figures-planet-sessao-pronta', reagirSessaoGestaoPronta);
    window.addEventListener('figures-planet-admin-gestao-pronta', reagirSessaoGestaoPronta);
    window.addEventListener('figures-planet-core-pronta', reagirSessaoGestaoPronta);
})();
