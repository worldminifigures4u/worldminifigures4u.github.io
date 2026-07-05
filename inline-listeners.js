(function () {
    function quandoPronto(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    }

    function ligar(id, evento, handler) {
        const elemento = document.getElementById(id);
        if (!elemento || typeof handler !== 'function') return;
        elemento.addEventListener(evento, handler);
    }

    function atualizarContadorCarrinhoTopo() {
        const contador = document.getElementById('contador-carrinho-cabecalho');
        if (!contador) return;
        try {
            const carrinho = JSON.parse(localStorage.getItem('carrinho') || '[]');
            const total = Array.isArray(carrinho)
                ? carrinho.reduce((soma, item) => soma + (Number(item.quantidade) || 0), 0)
                : 0;
            contador.textContent = String(total);
        } catch (erro) {
            contador.textContent = '0';
        }
    }

    function obterEspacoAbaixoCabecalho() {
        const valor = getComputedStyle(document.documentElement)
            .getPropertyValue('--espaco-abaixo-cabecalho')
            .trim();
        const numero = parseFloat(valor);
        return Number.isFinite(numero) ? numero : 24;
    }

    function sincronizarEspacamentoCabecalho() {
        const header = document.querySelector('header');
        if (!header) return;
        const altura = Math.ceil(header.getBoundingClientRect().height);
        const margem = obterEspacoAbaixoCabecalho();
        document.documentElement.style.setProperty('--cabecalho-offset', `${altura + margem}px`);
    }

    function inserirRodapeSite() {
        if (document.querySelector('.rodape-site')) return;

        const rodape = document.createElement('footer');
        rodape.className = 'rodape-site';
        rodape.innerHTML = ''
            + '<div class="rodape-conteudo">'
            + '<div class="rodape-frase">Figures Planet &copy; 2026 &middot; Minifiguras, colecion&aacute;veis e pe&ccedil;as especiais</div>'
            + '<nav class="rodape-links" aria-label="Navegacao secundaria">'
            + '<a href="index.html">Produtos</a>'
            + '<a href="sobre.html">Sobre n&oacute;s</a>'
            + '<a href="contactos.html">Contactos</a>'
            + '<a href="politicas.html">Pol&iacute;ticas</a>'
            + '</nav>'
            + '</div>';

        const primeiroScript = document.body.querySelector('script');
        if (primeiroScript) {
            document.body.insertBefore(rodape, primeiroScript);
        } else {
            document.body.appendChild(rodape);
        }
    }

    function iniciarSincronizacaoCabecalho() {
        const header = document.querySelector('header');
        if (!header) return;

        const agendar = function () {
            window.requestAnimationFrame(sincronizarEspacamentoCabecalho);
        };

        agendar();
        window.addEventListener('resize', agendar);
        window.addEventListener('load', agendar);
        document.fonts?.ready.then(agendar);

        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(agendar).observe(header);
        }
    }

    window.sincronizarEspacamentoCabecalho = sincronizarEspacamentoCabecalho;

    function atualizarCabecalhoAdmin() {
        document.body.classList.add('cabecalho-com-admin');
        const nomeEl = document.getElementById('nome-login-cabecalho');
        if (!nomeEl) return;
        nomeEl.textContent = 'Admin';
        nomeEl.classList.remove('oculto');
    }

    function mostrarNavegacaoAdminValidada() {
        const navegacao = document.querySelector('.navegacao-admin-cabecalho');
        if (navegacao) navegacao.hidden = false;
        atualizarCabecalhoAdmin();
        if (typeof window.sincronizarEspacamentoCabecalho === 'function') {
            window.requestAnimationFrame(window.sincronizarEspacamentoCabecalho);
        }
    }

    window.atualizarCabecalhoAdmin = atualizarCabecalhoAdmin;
    window.mostrarNavegacaoAdminValidada = mostrarNavegacaoAdminValidada;

    function ligarPesquisaCabecalho() {
        const campo = document.getElementById('campo-pesquisa');
        if (!campo) return;

        campo.addEventListener('input', function () {
            if (typeof window.pesquisarNoCabecalho === 'function') {
                window.pesquisarNoCabecalho();
            } else if (typeof pesquisarNoCabecalho === 'function') {
                pesquisarNoCabecalho();
            }
        });

        campo.addEventListener('keydown', function (evento) {
            if (typeof window.verificarTeclaEnter === 'function') {
                window.verificarTeclaEnter(evento);
            } else if (typeof verificarTeclaEnter === 'function') {
                verificarTeclaEnter(evento);
            }
        });
    }

    function ligarContaCliente() {
        ligar('form-editar-dados-cliente', 'submit', function (evento) {
            if (typeof guardarDadosCliente === 'function') guardarDadosCliente(evento);
        });
        ligar('form-alterar-password', 'submit', function (evento) {
            if (typeof alterarPasswordConta === 'function') alterarPasswordConta(evento);
        });
        ligar('form-login', 'submit', function (evento) {
            if (typeof fazerLogin === 'function') fazerLogin(evento);
        });
        ligar('form-registo', 'submit', function (evento) {
            if (typeof registarCliente === 'function') registarCliente(evento);
        });
        ligar('form-recuperar-password', 'submit', function (evento) {
            if (typeof atualizarPasswordRecuperacao === 'function') atualizarPasswordRecuperacao(evento);
        });

        document.querySelectorAll('.form-eliminar-conta').forEach(function (form) {
            form.addEventListener('submit', function (evento) {
                if (typeof eliminarContaUtilizador === 'function') eliminarContaUtilizador(evento);
            });
        });

        document.querySelectorAll('[data-aba-cliente]').forEach(function (botao) {
            botao.addEventListener('click', function () {
                if (typeof mudarAba === 'function') mudarAba(botao.dataset.abaCliente);
            });
        });

        document.querySelectorAll('[data-seccao-conta]').forEach(function (botao) {
            botao.addEventListener('click', function () {
                const destino = botao.dataset.seccaoConta;
                document.querySelectorAll('[data-seccao-conta]').forEach(function (item) {
                    item.classList.toggle('ativa', item === botao);
                });
                document.querySelectorAll('[data-conta-seccao]').forEach(function (secao) {
                    secao.classList.toggle('ativa', secao.dataset.contaSeccao === destino);
                });
            });
        });

        document.querySelectorAll('[data-acao-cliente="recuperar-password"]').forEach(function (botao) {
            botao.addEventListener('click', function () {
                if (typeof pedirRecuperacaoPassword === 'function') pedirRecuperacaoPassword();
            });
        });

        document.querySelectorAll('[data-acao-cliente="logout"]').forEach(function (botao) {
            botao.addEventListener('click', function () {
                if (typeof fazerLogout === 'function') fazerLogout();
            });
        });
    }

    function ligarCarrinho() {
        ligar('pais-envio', 'change', function () {
            if (typeof atualizarOpcoesEnvio === 'function') atualizarOpcoesEnvio();
        });
        ligar('metodo-envio', 'change', function () {
            if (typeof recalcularTotais === 'function') recalcularTotais();
        });
        document.querySelectorAll('[data-acao-carrinho="confirmar-encomenda"]').forEach(function (botao) {
            botao.addEventListener('click', function () {
                if (typeof criarNovaEncomenda === 'function') criarNovaEncomenda();
            });
        });
    }

    function ligarLoja() {
        document.querySelectorAll('[data-tema-filtro]').forEach(function (botao) {
            botao.addEventListener('click', function () {
                if (typeof filtrarTema === 'function') filtrarTema(botao.dataset.temaFiltro, botao);
            });
        });
    }

    function ligarGestaoAdmin() {
        ligar('form-admin-produto', 'submit', function (evento) {
            if (typeof criarProdutoAdmin === 'function') criarProdutoAdmin(evento);
        });
        ligar('admin-produto-nome', 'input', function () {
            if (typeof sugerirSkuAdmin === 'function') sugerirSkuAdmin();
        });
        ligar('admin-produto-imagens', 'input', function () {
            if (typeof atualizarPreviewImagensAdmin === 'function') atualizarPreviewImagensAdmin();
        });
        ligar('admin-pesquisa-produtos', 'input', function () {
            if (typeof renderizarListaProdutosAdmin === 'function') renderizarListaProdutosAdmin();
        });
        ligar('admin-ficheiro-stock', 'change', function () {
            if (typeof analisarFicheiroStockAdmin === 'function') analisarFicheiroStockAdmin(this);
        });
        ligar('btn-confirmar-importacao-stock', 'click', function () {
            if (typeof confirmarImportacaoStockAdmin === 'function') confirmarImportacaoStockAdmin();
        });
        ligar('admin-ficheiro-catalogo', 'change', function () {
            if (typeof analisarFicheiroCatalogoAdmin === 'function') analisarFicheiroCatalogoAdmin(this);
        });
        ligar('confirmacao-substituir-catalogo', 'input', function () {
            if (typeof atualizarConfirmacaoCatalogoAdmin === 'function') atualizarConfirmacaoCatalogoAdmin();
        });
        ligar('btn-confirmar-importacao-catalogo', 'click', function () {
            if (typeof confirmarImportacaoCatalogoAdmin === 'function') confirmarImportacaoCatalogoAdmin();
        });
        ligar('form-admin-editar-produto', 'submit', function (evento) {
            if (typeof guardarEdicaoProdutoAdmin === 'function') guardarEdicaoProdutoAdmin(evento);
        });
        ligar('admin-editar-imagens', 'input', function () {
            if (typeof atualizarPreviewEditarImagensAdmin === 'function') atualizarPreviewEditarImagensAdmin();
        });

        document.querySelectorAll('[data-acao-admin="pesquisar-produtos"]').forEach(function (botao) {
            botao.addEventListener('click', function () {
                if (typeof renderizarListaProdutosAdmin === 'function') renderizarListaProdutosAdmin();
            });
        });
        document.querySelectorAll('[data-acao-admin="cancelar-edicao-produto"]').forEach(function (botao) {
            botao.addEventListener('click', function () {
                if (typeof cancelarEdicaoProdutoAdmin === 'function') cancelarEdicaoProdutoAdmin();
            });
        });

        document.querySelectorAll('[data-tab-gestao]').forEach(function (botao) {
            botao.addEventListener('click', function () {
                const destino = botao.dataset.tabGestao;
                document.querySelectorAll('[data-tab-gestao]').forEach(function (item) {
                    const ativo = item === botao;
                    item.classList.toggle('ativa', ativo);
                    item.setAttribute('aria-selected', ativo ? 'true' : 'false');
                });
                document.querySelectorAll('[data-painel-gestao]').forEach(function (painel) {
                    const ativo = painel.dataset.painelGestao === destino;
                    painel.classList.toggle('ativa', ativo);
                    painel.hidden = !ativo;
                });
            });
        });

        const uploadNovo = document.getElementById('admin-produto-upload-imagens');
        if (uploadNovo) {
            uploadNovo.addEventListener('change', function () {
                if (typeof enviarFotosCloudinaryAdmin === 'function') {
                    enviarFotosCloudinaryAdmin(this, 'admin-produto-imagens', atualizarPreviewImagensAdmin, 'status-upload-admin-produto');
                }
            });
        }

        const uploadEditar = document.getElementById('admin-editar-upload-imagens');
        if (uploadEditar) {
            uploadEditar.addEventListener('change', function () {
                if (typeof enviarFotosCloudinaryAdmin === 'function') {
                    enviarFotosCloudinaryAdmin(this, 'admin-editar-imagens', atualizarPreviewEditarImagensAdmin, 'status-upload-admin-editar');
                }
            });
        }
    }

    quandoPronto(function () {
        iniciarSincronizacaoCabecalho();
        inserirRodapeSite();
        atualizarContadorCarrinhoTopo();
        window.addEventListener('storage', atualizarContadorCarrinhoTopo);
        ligarPesquisaCabecalho();
        ligarContaCliente();
        ligarCarrinho();
        ligarLoja();
        ligarGestaoAdmin();
    });
})();
