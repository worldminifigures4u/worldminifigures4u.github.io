// Carregamento dos modulos da vitrine (app-loja, loja-produtos, cart-mini).
(function () {
    const CHAVE_POPUP_SUCESSO_ENCOMENDA = 'figures-planet-encomenda-sucesso';
    let promessaAppLoja = null;
    let promessaLojaProdutos = null;
    let promessaCartMini = null;
    let promessaModulosLoja = null;
    let promessaVitrineLojaPronta = null;

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

    function garantirCartMiniLoja() {
        if (typeof adicionarAoCarrinho === 'function') return Promise.resolve();
        if (!promessaCartMini) {
            promessaCartMini = carregarScript('cart-mini.js?v=20260711-leve');
        }
        return promessaCartMini;
    }

    function garantirAppLoja() {
        if (typeof inicializarPaginaLoja === 'function') return Promise.resolve();
        if (!promessaAppLoja) {
            promessaAppLoja = carregarScript('app-loja.js?v=20260726-pesquisa-cat');
        }
        return promessaAppLoja;
    }

    function garantirLojaProdutos() {
        if (typeof carregarProdutosDaNuvem === 'function') return Promise.resolve();
        if (!promessaLojaProdutos) {
            promessaLojaProdutos = garantirCartMiniLoja()
                .then(() => carregarScript('loja-produtos.js?v=20260815-pesquisa-nome'));
        }
        return promessaLojaProdutos;
    }

    function garantirModulosLoja() {
        if (typeof carregarProdutosDaNuvem === 'function' && typeof inicializarPaginaLoja === 'function') {
            return Promise.resolve();
        }
        if (!promessaModulosLoja) {
            promessaModulosLoja = Promise.all([
                garantirAppLoja(),
                garantirLojaProdutos()
            ]);
        }
        return promessaModulosLoja;
    }

    window.garantirModulosLoja = garantirModulosLoja;
    window.garantirAppLoja = garantirAppLoja;
    window.garantirLojaProdutos = garantirLojaProdutos;

    function aguardarSessaoSupabase(timeoutMs = 12000) {
        if (typeof dbClient !== 'undefined' && dbClient) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const timer = window.setTimeout(() => {
                window.removeEventListener('figures-planet-sessao-pronta', aoPronto);
                window.removeEventListener('figures-planet-sessao-erro', aoErro);
                reject(new Error('Sessão Supabase indisponível.'));
            }, timeoutMs);

            const aoPronto = () => {
                window.clearTimeout(timer);
                window.removeEventListener('figures-planet-sessao-erro', aoErro);
                resolve();
            };

            const aoErro = () => {
                window.clearTimeout(timer);
                window.removeEventListener('figures-planet-sessao-pronta', aoPronto);
                reject(new Error('Biblioteca Supabase não carregou.'));
            };

            window.addEventListener('figures-planet-sessao-pronta', aoPronto, { once: true });
            window.addEventListener('figures-planet-sessao-erro', aoErro, { once: true });
        });
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

    function atualizarCoracoesAposCarga() {
        if (typeof atualizarBotoesFavoritos === 'function') {
            atualizarBotoesFavoritos();
        }
    }

    function obterMensagemPopupSucessoEncomenda() {
        try {
            const bruto = sessionStorage.getItem(CHAVE_POPUP_SUCESSO_ENCOMENDA);
            if (!bruto) return null;
            sessionStorage.removeItem(CHAVE_POPUP_SUCESSO_ENCOMENDA);
            const dados = JSON.parse(bruto);
            const criadoEm = Number(dados?.criadoEm || 0);
            if (criadoEm && Date.now() - criadoEm > 10 * 60 * 1000) return null;
            return String(dados?.mensagem || '').trim() || null;
        } catch (erro) {
            try { sessionStorage.removeItem(CHAVE_POPUP_SUCESSO_ENCOMENDA); } catch (_) { /* ignore */ }
            console.warn('Nao foi possivel ler o popup de sucesso da encomenda:', erro);
            return null;
        }
    }

    function mostrarPopupSucessoEncomenda(mensagem) {
        const linhas = String(mensagem || '').split(/\r?\n/).map(linha => linha.trim()).filter(Boolean);
        const titulo = linhas.shift() || 'Encomenda registada com sucesso!';
        const detalhe = linhas.join('\n');

        const overlay = document.createElement('div');
        overlay.className = 'popup-encomenda-sucesso';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'popup-encomenda-sucesso-titulo');

        const caixa = document.createElement('div');
        caixa.className = 'popup-encomenda-sucesso__caixa';

        const fechar = document.createElement('button');
        fechar.type = 'button';
        fechar.className = 'popup-encomenda-sucesso__fechar';
        fechar.setAttribute('aria-label', 'Fechar');
        fechar.textContent = 'x';

        const h2 = document.createElement('h2');
        h2.id = 'popup-encomenda-sucesso-titulo';
        h2.textContent = titulo;

        const texto = document.createElement('p');
        texto.textContent = detalhe;

        const ok = document.createElement('button');
        ok.type = 'button';
        ok.className = 'popup-encomenda-sucesso__ok';
        ok.textContent = 'OK';

        const fecharPopup = () => {
            overlay.remove();
            document.removeEventListener('keydown', aoTeclado);
        };
        const aoTeclado = (evento) => {
            if (evento.key === 'Escape') fecharPopup();
        };

        fechar.addEventListener('click', fecharPopup);
        ok.addEventListener('click', fecharPopup);
        caixa.append(fechar, h2);
        if (detalhe) caixa.appendChild(texto);
        caixa.appendChild(ok);
        overlay.appendChild(caixa);
        document.body.appendChild(overlay);
        document.addEventListener('keydown', aoTeclado);
        ok.focus();
    }

    function agendarFavoritosLoja() {
        if (document.body?.dataset?.page !== 'loja') return;
        if (typeof window.garantirAppFavoritos !== 'function') return;

        const iniciar = () => {
            window.garantirAppFavoritos()
                .then(atualizarCoracoesAposCarga)
                .catch(console.error);
        };

        if (pareceSessaoAtiva()) {
            iniciar();
            return;
        }

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(iniciar, { timeout: 4000 });
        } else {
            window.setTimeout(iniciar, 2500);
        }
    }

    function ligarInteracaoModulosLoja() {
        const pedirVitrine = () => garantirVitrineLojaPronta().catch(console.error);

        document.getElementById('campo-pesquisa')?.addEventListener('focus', pedirVitrine, { once: true });
        document.getElementById('menu-lateral-temas')?.addEventListener('click', pedirVitrine, { once: true });
        document.getElementById('vitrine-produtos')?.addEventListener('mouseenter', pedirVitrine, { once: true });
        document.getElementById('btn-categorias-cabecalho')?.addEventListener('click', function (evento) {
            evento.preventDefault();
            garantirVitrineLojaPronta()
                .then(function () {
                    if (typeof alternarMenuCategoriasCabecalho === 'function') {
                        alternarMenuCategoriasCabecalho();
                    }
                })
                .catch(console.error);
        });
    }

    async function iniciarVitrineLoja() {
        const vistaHash = typeof obterVistaHash === 'function' ? obterVistaHash() : '';
        const paginaAtual = typeof obterVistaPagina === 'function' ? obterVistaPagina() : 'loja';
        if (vistaHash && vistaHash !== paginaAtual && typeof PAGINAS_VISTA !== 'undefined') {
            window.location.replace(PAGINAS_VISTA[vistaHash]);
            return;
        }

        await garantirModulosLoja();
        if (typeof inicializarPaginaLoja === 'function') inicializarPaginaLoja();

        try {
            await aguardarSessaoSupabase();
        } catch (erro) {
            console.error('Erro ao iniciar sessão da loja:', erro);
            if (typeof definirEstadoVitrine === 'function') {
                definirEstadoVitrine(
                    'Não foi possível carregar os produtos. Tenta novamente dentro de momentos.',
                    'erro'
                );
            }
            return;
        }

        if (typeof carregarProdutosDaNuvem === 'function') {
            await carregarProdutosDaNuvem();
        }
        if (typeof aplicarPesquisaUrl === 'function') aplicarPesquisaUrl();

        try {
            const params = new URLSearchParams(window.location.search || '');
            if (params.get('categorias') === '1' && typeof abrirMenuCategoriasCabecalho === 'function') {
                abrirMenuCategoriasCabecalho();
                params.delete('categorias');
                const resto = params.toString();
                const novoUrl = window.location.pathname + (resto ? '?' + resto : '') + (window.location.hash || '');
                window.history.replaceState({}, '', novoUrl);
            }
        } catch (_) { /* ignore */ }

        if (typeof window.garantirAppFavoritos === 'function') {
            await window.garantirAppFavoritos();
            atualizarCoracoesAposCarga();
        }
    }

    function garantirVitrineLojaPronta() {
        if (!document.getElementById('vitrine-produtos')) {
            return Promise.resolve();
        }

        if (!promessaVitrineLojaPronta) {
            promessaVitrineLojaPronta = iniciarVitrineLoja().catch((erro) => {
                promessaVitrineLojaPronta = null;
                throw erro;
            });
        }

        return promessaVitrineLojaPronta;
    }

    window.garantirVitrineLojaPronta = garantirVitrineLojaPronta;

    document.addEventListener('DOMContentLoaded', function () {
        if (!document.getElementById('vitrine-produtos')) return;

        const mensagemSucesso = obterMensagemPopupSucessoEncomenda();
        if (mensagemSucesso) {
            window.requestAnimationFrame(() => mostrarPopupSucessoEncomenda(mensagemSucesso));
        }

        garantirModulosLoja().catch(console.error);
        ligarInteracaoModulosLoja();
        agendarFavoritosLoja();
        agendarPrefetchModulosLoja();
    });

    function agendarPrefetchModulosLoja() {
        const iniciar = function () {
            ['loja-produtos.js?v=20260815-pesquisa-nome', 'cart-mini.js?v=20260711-leve'].forEach(function (href) {
                if (document.querySelector('link[rel="prefetch"][href="' + href + '"]')) return;
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = href;
                link.as = 'script';
                document.head.appendChild(link);
            });
        };

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(iniciar, { timeout: 5000 });
        } else {
            window.setTimeout(iniciar, 2000);
        }
    }

    window.addEventListener('load', () => {
        if (document.body?.dataset?.page !== 'loja' && !document.getElementById('vitrine-produtos')) return;
        garantirVitrineLojaPronta().catch(console.error);
    });
})();
