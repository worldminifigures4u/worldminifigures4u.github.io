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
        const alvo = document.body || document.documentElement;
        const valor = getComputedStyle(alvo)
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

    function executarPesquisaLoja(imediato) {
        const correr = () => {
            if (typeof window.pesquisarNoCabecalho === 'function') {
                window.pesquisarNoCabecalho();
            } else if (typeof executarFiltrosCombinados === 'function') {
                executarFiltrosCombinados();
            }
        };

        const agendar = () => {
            const promessaVitrine = typeof window.garantirVitrineLojaPronta === 'function'
                ? window.garantirVitrineLojaPronta()
                : (typeof window.garantirModulosLoja === 'function'
                    ? window.garantirModulosLoja()
                    : Promise.resolve());

            promessaVitrine.then(correr).catch(console.error);
        };

        if (imediato) {
            window.clearTimeout(window.__pesquisaLojaTimer);
            agendar();
            return;
        }

        window.clearTimeout(window.__pesquisaLojaTimer);
        window.__pesquisaLojaTimer = window.setTimeout(agendar, 250);
    }

    function ligarPesquisaLoja() {
        const campo = obterCampoPesquisaCabecalho();
        const formulario = campo?.closest('form.cabecalho-pesquisa');

        if (formulario) {
            formulario.addEventListener('submit', function (evento) {
                evento.preventDefault();
                executarPesquisaLoja(true);
            });
        }

        if (!campo) return;

        campo.addEventListener('focus', function () {
            if (typeof window.garantirVitrineLojaPronta === 'function') {
                window.garantirVitrineLojaPronta().catch(console.error);
            } else if (typeof window.garantirModulosLoja === 'function') {
                window.garantirModulosLoja().catch(console.error);
            }
        }, { once: true });

        campo.addEventListener('input', function () {
            executarPesquisaLoja(false);
        });

        campo.addEventListener('keydown', function (evento) {
            if (evento.key !== 'Enter') return;
            evento.preventDefault();
            executarPesquisaLoja(true);
        });
    }

    function prefetchRecursosLoja() {
        const recursos = [
            'index.html',
            'app-config.js',
            'app-util.js',
            'app-sessao.js',
            'app-loja.js',
            'loja-produtos.js',
            'loja.css',
            'styles-tema.css',
            'cart-mini.js'
        ];
        recursos.forEach(function (href) {
            if (document.querySelector('link[rel="prefetch"][href="' + href + '"]')) return;
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = href;
            link.as = href.endsWith('.html') ? 'document' : (href.endsWith('.css') ? 'style' : 'script');
            document.head.appendChild(link);
        });
    }

    function ligarPrefetchConta() {
        let prefetchFeito = false;
        const iniciarPrefetch = function () {
            if (prefetchFeito) return;
            prefetchFeito = true;
            [
                'conta.html',
                'conta.css',
                'styles-tema.css',
                'app-sessao.js',
                'conta-pagina.js'
            ].forEach(function (href) {
                if (document.querySelector('link[rel="prefetch"][href="' + href + '"]')) return;
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = href;
                link.as = href.endsWith('.html') ? 'document' : (href.endsWith('.css') ? 'style' : 'script');
                document.head.appendChild(link);
            });
        };

        document.querySelectorAll('[data-vista-nav="conta"], a[href="conta.html"]').forEach(function (elemento) {
            elemento.addEventListener('mouseenter', iniciarPrefetch, { once: true });
            elemento.addEventListener('focus', iniciarPrefetch, { once: true });
            elemento.addEventListener('touchstart', iniciarPrefetch, { once: true, passive: true });
        });
    }

    function ligarPrefetchCarrinho() {
        let prefetchFeito = false;
        const iniciarPrefetch = function () {
            if (prefetchFeito) return;
            prefetchFeito = true;
            [
                'carrinho.html',
                'carrinho.css',
                'styles-tema.css',
                'app-sessao.js',
                'app-carrinho.js',
                'carrinho-core.js'
            ].forEach(function (href) {
                if (document.querySelector('link[rel="prefetch"][href="' + href + '"]')) return;
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = href;
                link.as = href.endsWith('.html') ? 'document' : (href.endsWith('.css') ? 'style' : 'script');
                document.head.appendChild(link);
            });
        };

        document.querySelectorAll('.acao-carrinho, [data-vista-nav="carrinho"]').forEach(function (elemento) {
            elemento.addEventListener('mouseenter', iniciarPrefetch, { once: true });
            elemento.addEventListener('focus', iniciarPrefetch, { once: true });
            elemento.addEventListener('touchstart', iniciarPrefetch, { once: true, passive: true });
        });
    }

    function ligarPrefetchFavoritos() {
        let prefetchFeito = false;
        const iniciarPrefetch = function () {
            if (prefetchFeito) return;
            prefetchFeito = true;
            [
                'favoritos.html',
                'favoritos.css',
                'styles-tema.css',
                'app-favoritos.js',
                'favoritos-ui.js'
            ].forEach(function (href) {
                if (document.querySelector('link[rel="prefetch"][href="' + href + '"]')) return;
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = href;
                link.as = href.endsWith('.html') ? 'document' : (href.endsWith('.css') ? 'style' : 'script');
                document.head.appendChild(link);
            });
        };

        document.querySelectorAll('.acao-favoritos-topo').forEach(function (elemento) {
            elemento.addEventListener('mouseenter', iniciarPrefetch, { once: true });
            elemento.addEventListener('focus', iniciarPrefetch, { once: true });
            elemento.addEventListener('touchstart', iniciarPrefetch, { once: true, passive: true });
        });
    }

    function ligarPrefetchLoja() {
        let prefetchFeito = false;
        const iniciarPrefetch = function () {
            if (prefetchFeito) return;
            prefetchFeito = true;
            prefetchRecursosLoja();
        };

        document.querySelectorAll('.logo-loja, .rodape-links a[href="index.html"]').forEach(function (elemento) {
            elemento.addEventListener('mouseenter', iniciarPrefetch, { once: true });
            elemento.addEventListener('focus', iniciarPrefetch, { once: true });
            elemento.addEventListener('touchstart', iniciarPrefetch, { once: true, passive: true });
        });
    }

    function paginaEhAdminSemRodape() {
        const body = document.body;
        if (!body) return false;
        return body.classList.contains('pagina-clientes-admin')
            || body.classList.contains('pagina-encomendas-admin')
            || body.classList.contains('pagina-fornecedores-admin')
            || body.classList.contains('pagina-mapas-admin')
            || body.classList.contains('pagina-estatisticas-admin')
            || body.classList.contains('pagina-wallapop')
            || body.classList.contains('pagina-gestao');
    }

    function inserirRodapeSite() {
        if (paginaEhAdminSemRodape()) return;
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

    function executarComModulosEnvio(callback) {
        const correr = () => {
            if (typeof callback === 'function') callback();
        };
        if (typeof window.garantirModulosEnvioCarrinho === 'function') {
            window.garantirModulosEnvioCarrinho().then(correr).catch(console.error);
            return;
        }
        correr();
    }

    function garantirScriptCheckout() {
        if (typeof criarNovaEncomenda === 'function') return Promise.resolve();
        if (promessaCheckoutCarrinho) return promessaCheckoutCarrinho;

        const carregarCheckout = () => new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'checkout.js?v=20260713-bloquear-cliente';
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Falha ao carregar checkout.'));
            document.body.appendChild(script);
        });

        const base = typeof window.garantirModulosEnvioCarrinho === 'function'
            ? window.garantirModulosEnvioCarrinho()
            : Promise.resolve();

        promessaCheckoutCarrinho = base.then(carregarCheckout);
        return promessaCheckoutCarrinho;
    }

    function ligarCarrinhoPagina() {
        const selectPais = document.getElementById('pais-envio');
        if (selectPais) {
            const atualizarEnvio = () => executarComModulosEnvio(() => {
                if (typeof atualizarOpcoesEnvio === 'function') atualizarOpcoesEnvio();
            });
            selectPais.addEventListener('change', atualizarEnvio);
            selectPais.addEventListener('focus', atualizarEnvio, { once: true });
        }

        const metodosEnvio = document.getElementById('metodos-envio');
        if (metodosEnvio) {
            metodosEnvio.addEventListener('change', function (evento) {
                const radio = evento.target;
                if (!radio || radio.name !== 'metodo-envio-radio') return;
                const inputMetodo = document.getElementById('metodo-envio');
                if (inputMetodo) inputMetodo.value = radio.value;
                executarComModulosEnvio(() => {
                    if (typeof recalcularTotais === 'function') recalcularTotais();
                });
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
            ligarPrefetchLoja();
            ligarPrefetchFavoritos();
            ligarPrefetchCarrinho();
            ligarPrefetchConta();
            if (config.rodape) inserirRodapeSite();
            atualizarContadorCarrinhoTopo();
            window.addEventListener('storage', atualizarContadorCarrinhoTopo);

            if (config.contaCabecalhoLeve) {
                agendarNomeContaCabecalhoLeve();
            }

            if (config.pesquisa === 'loja') ligarPesquisaLoja();
            else if (config.pesquisa === 'redirect') ligarPesquisaRedirecionar();

            if (config.loja) ligarLoja();
            if (config.carrinho) ligarCarrinhoPagina();
        });
    }

    function atualizarNomeContaCabecalho(texto) {
        const nomeEl = document.getElementById('nome-login-cabecalho');
        if (!nomeEl) return;

        const primeiroNome = String(texto || '').trim().split(/\s+/)[0] || '';
        if (primeiroNome) {
            localStorage.setItem(NOME_CONTA_CABECALHO_KEY, primeiroNome);
        } else {
            localStorage.removeItem(NOME_CONTA_CABECALHO_KEY);
        }
        nomeEl.textContent = primeiroNome;
        nomeEl.classList.toggle('oculto', !primeiroNome);
    }

    function mostrarNomeContaEmCache() {
        const primeiroNome = localStorage.getItem(NOME_CONTA_CABECALHO_KEY) || '';
        if (primeiroNome) atualizarNomeContaCabecalho(primeiroNome);
    }

    async function atualizarNomeContaCabecalhoRemoto() {
        try {
            await window.carregarScriptSupabase();
            if (typeof supabase === 'undefined') return;

            const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            const { data: { user } } = await client.auth.getUser();
            if (!user) {
                atualizarNomeContaCabecalho('');
                return;
            }

            const { data } = await client
                .from('clientes')
                .select('nome')
                .eq('id', user.id)
                .single();

            atualizarNomeContaCabecalho(data?.nome || user?.user_metadata?.nome || '');
        } catch (erro) {
            console.warn('Nome da conta indisponivel:', erro);
        }
    }

    function agendarNomeContaCabecalhoLeve() {
        mostrarNomeContaEmCache();
        const atualizar = function () {
            atualizarNomeContaCabecalhoRemoto();
        };
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(atualizar, { timeout: 2000 });
        } else {
            window.setTimeout(atualizar, 0);
        }
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

    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
        navigator.serviceWorker.register('sw.js?v=20260716-sem-rodape-admin').then((registo) => {
            registo.addEventListener('updatefound', () => {
                const novoWorker = registo.installing;
                if (!novoWorker) return;
                novoWorker.addEventListener('statechange', () => {
                    if (novoWorker.state === 'activated' && navigator.serviceWorker.controller) {
                        window.location.reload();
                    }
                });
            });
        }).catch(() => {});
    }
})();
