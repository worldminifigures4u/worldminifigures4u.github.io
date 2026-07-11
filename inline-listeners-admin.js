(function () {
    function quandoPronto(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
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

    function ligarPesquisaCabecalho() {
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

    quandoPronto(function () {
        iniciarSincronizacaoCabecalho();
        atualizarContadorCarrinhoTopo();
        window.addEventListener('storage', atualizarContadorCarrinhoTopo);
        ligarPesquisaCabecalho();
    });
})();
