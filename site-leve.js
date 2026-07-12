(function () {
    const RECURSOS_PREFETCH_LOJA = [
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

    function carregarCarrinhoLocal() {
        try {
            const guardado = JSON.parse(localStorage.getItem('carrinho')) || [];
            return Array.isArray(guardado) ? guardado : [];
        } catch (erro) {
            localStorage.removeItem('carrinho');
            return [];
        }
    }

    function atualizarContadorCarrinhoCabecalho() {
        const contador = document.getElementById('contador-carrinho-cabecalho');
        if (!contador) return;
        const total = carregarCarrinhoLocal().reduce((soma, item) => soma + Number(item?.quantidade || 0), 0);
        contador.textContent = total;
    }

    function atualizarCabecalhoCliente(nome = '') {
        const nomeEl = document.getElementById('nome-login-cabecalho');
        if (!nomeEl) return;

        const primeiroNome = String(nome || '').trim().split(/\s+/)[0] || '';
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
        if (primeiroNome) atualizarCabecalhoCliente(primeiroNome);
    }

    function sincronizarEspacamentoCabecalho() {
        const header = document.querySelector('header');
        if (!header) return;
        const altura = Math.ceil(header.getBoundingClientRect().height);
        const valor = getComputedStyle(document.documentElement).getPropertyValue('--espaco-abaixo-cabecalho').trim();
        const numero = parseFloat(valor);
        const margem = Number.isFinite(numero) ? numero : 24;
        document.documentElement.style.setProperty('--cabecalho-offset', `${altura + margem}px`);
    }

    function iniciarCabecalhoLeve() {
        const agendar = () => window.requestAnimationFrame(sincronizarEspacamentoCabecalho);
        agendar();
        window.addEventListener('resize', agendar);
        const header = document.querySelector('header');
        if (header && typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(agendar).observe(header);
        }
    }

    async function atualizarNomeContaCabecalho() {
        try {
            await window.carregarScriptSupabase();
            if (typeof supabase === 'undefined') return;
            const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            const { data: { user } } = await client.auth.getUser();
            if (!user) {
                atualizarCabecalhoCliente();
                return;
            }

            const { data } = await client
                .from('clientes')
                .select('nome')
                .eq('id', user.id)
                .single();

            atualizarCabecalhoCliente(data?.nome || user?.user_metadata?.nome || '');
        } catch (erro) {
            console.warn('Nome da conta indisponivel:', erro);
        }
    }

    window.pesquisarNoCabecalho = function pesquisarNoCabecalho() {
        return;
    };

    window.verificarTeclaEnter = function verificarTeclaEnter(evento) {
        if (evento.key !== 'Enter') return;
        evento.preventDefault();
        const pesquisa = document.getElementById('campo-pesquisa')?.value.trim() || '';
        window.location.href = 'index.html' + (pesquisa ? '?q=' + encodeURIComponent(pesquisa) : '');
    };

    function prefetchRecursosLoja() {
        RECURSOS_PREFETCH_LOJA.forEach((href) => {
            if (document.querySelector(`link[rel="prefetch"][href="${href}"]`)) return;
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = href;
            link.as = href.endsWith('.html') ? 'document' : (href.endsWith('.css') ? 'style' : 'script');
            document.head.appendChild(link);
        });
    }

    function ligarPrefetchLojaHover() {
        let prefetchFeito = false;
        const iniciarPrefetch = () => {
            if (prefetchFeito) return;
            prefetchFeito = true;
            prefetchRecursosLoja();
        };

        document.querySelectorAll('.logo-loja, .rodape-links a[href="index.html"]').forEach((elemento) => {
            elemento.addEventListener('mouseenter', iniciarPrefetch, { once: true });
            elemento.addEventListener('focus', iniciarPrefetch, { once: true });
            elemento.addEventListener('touchstart', iniciarPrefetch, { once: true, passive: true });
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        iniciarCabecalhoLeve();
        atualizarContadorCarrinhoCabecalho();
        mostrarNomeContaEmCache();
        ligarPrefetchLojaHover();

        const campoPesquisa = document.getElementById('campo-pesquisa');
        if (campoPesquisa) {
            campoPesquisa.addEventListener('keydown', window.verificarTeclaEnter);
        }

        const atualizar = () => atualizarNomeContaCabecalho();
        if ('requestIdleCallback' in window) {
            requestIdleCallback(atualizar, { timeout: 2000 });
            requestIdleCallback(prefetchRecursosLoja, { timeout: 5000 });
        } else {
            setTimeout(atualizar, 0);
            setTimeout(prefetchRecursosLoja, 1500);
        }
    });
    window.addEventListener('storage', atualizarContadorCarrinhoCabecalho);
})();
