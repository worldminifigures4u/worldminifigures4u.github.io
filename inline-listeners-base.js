(function () {
    let promessaCheckoutCarrinho = null;

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
            const carrinhoLocal = JSON.parse(localStorage.getItem('carrinho') || '[]');
            const total = Array.isArray(carrinhoLocal)
                ? carrinhoLocal.reduce((soma, item) => soma + (Number(item.quantidade) || 0), 0)
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
        if (typeof garantirEstilosAdmin === 'function') garantirEstilosAdmin();
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

    function obterCampoPesquisaCabecalho() {
        return document.getElementById('campo-pesquisa')
            || document.querySelector('.cabecalho-pesquisa input[name="q"]')
            || document.querySelector('.cabecalho-pesquisa .input-pesquisa');
    }

    function irParaPesquisaProdutos(termo) {
        const pesquisa = String(termo ?? '').trim();
        window.location.href = 'index.html' + (pesquisa ? '?q=' + encodeURIComponent(pesquisa) : '');
    }

    window.irParaPesquisaProdutos = irParaPesquisaProdutos;

    function ligarPesquisaRedirecionar() {
        const campo = obterCampoPesquisaCabecalho();
        const formulario = campo?.closest('form.cabecalho-pesquisa');

        if (formulario) {
            formulario.addEventListener('submit', function (evento) {
                evento.preventDefault();
                irParaPesquisaProdutos(campo?.value);
            });
        }

        if (!campo) return;

        campo.addEventListener('keydown', function (evento) {
            if (evento.key !== 'Enter') return;
            evento.preventDefault();
            irParaPesquisaProdutos(campo.value);
        });
    }

    function ligarPesquisaLoja() {
        const campo = obterCampoPesquisaCabecalho();
        const formulario = campo?.closest('form.cabecalho-pesquisa');

        if (formulario) {
            formulario.addEventListener('submit', function (evento) {
                evento.preventDefault();
                if (typeof window.verificarTeclaEnter === 'function') {
                    window.verificarTeclaEnter(evento);
                } else if (typeof executarFiltrosCombinados === 'function') {
                    executarFiltrosCombinados();
                }
            });
        }

        if (!campo) return;

        campo.addEventListener('input', function () {
            if (typeof window.pesquisarNoCabecalho === 'function') {
                window.pesquisarNoCabecalho();
            }
        });

        campo.addEventListener('keydown', function (evento) {
            if (evento.key !== 'Enter') return;
            if (typeof window.verificarTeclaEnter === 'function') {
                window.verificarTeclaEnter(evento);
            } else if (typeof executarFiltrosCombinados === 'function') {
                evento.preventDefault();
                executarFiltrosCombinados();
            }
        });
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

    function ligarLoja() {
        document.querySelectorAll('[data-tema-filtro]').forEach(function (botao) {
            botao.addEventListener('click', function () {
                if (typeof filtrarTema === 'function') filtrarTema(botao.dataset.temaFiltro, botao);
            });
        });
    }

    function garantirScriptCheckout() {
        if (typeof criarNovaEncomenda === 'function') return Promise.resolve();
        if (promessaCheckoutCarrinho) return promessaCheckoutCarrinho;

        promessaCheckoutCarrinho = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'checkout.js?v=20260711-leve-r9';
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Falha ao carregar checkout.'));
            document.body.appendChild(script);
        });

        return promessaCheckoutCarrinho;
    }

    function ligarCarrinhoPagina() {
        ligar('pais-envio', 'change', function () {
            if (typeof atualizarOpcoesEnvio === 'function') atualizarOpcoesEnvio();
        });

        const metodosEnvio = document.getElementById('metodos-envio');
        if (metodosEnvio) {
            metodosEnvio.addEventListener('change', function (evento) {
                const radio = evento.target;
                if (!radio || radio.name !== 'metodo-envio-radio') return;
                const inputMetodo = document.getElementById('metodo-envio');
                if (inputMetodo) inputMetodo.value = radio.value;
                if (typeof recalcularTotais === 'function') recalcularTotais();
            });
        }

        document.querySelectorAll('[data-acao-carrinho="confirmar-encomenda"]').forEach(function (botao) {
            botao.addEventListener('click', function () {
                garantirScriptCheckout()
                    .then(() => {
                        if (typeof criarNovaEncomenda === 'function') criarNovaEncomenda();
                    })
                    .catch(console.error);
            });
        });
    }

    function iniciarPaginaPublica(opcoes) {
        const config = opcoes || {};
        quandoPronto(function () {
            iniciarSincronizacaoCabecalho();
            if (config.rodape) inserirRodapeSite();
            atualizarContadorCarrinhoTopo();
            window.addEventListener('storage', atualizarContadorCarrinhoTopo);

            if (config.pesquisa === 'loja') ligarPesquisaLoja();
            else if (config.pesquisa === 'redirect') ligarPesquisaRedirecionar();

            if (config.loja) ligarLoja();
            if (config.carrinho) ligarCarrinhoPagina();
        });
    }

    window.FiguresPlanetListeners = {
        quandoPronto,
        ligar,
        atualizarContadorCarrinhoTopo,
        iniciarSincronizacaoCabecalho,
        ligarPesquisaRedirecionar,
        ligarPesquisaLoja,
        ligarLoja,
        ligarCarrinhoPagina,
        inserirRodapeSite,
        iniciarPaginaPublica
    };
})();
