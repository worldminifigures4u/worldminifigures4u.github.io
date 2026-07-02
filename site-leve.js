(function () {
    const SUPABASE_URL = "https://gksndzxadndrsynvzgzb.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrc25kenhhZG5kcnN5bnZ6Z3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc5NzMsImV4cCI6MjA5NDY2Mzk3M30.EHZgacYr27dqoc4CJHsOwkNnJFGlLIteSHBi4B1HfVE";
    const NOME_CONTA_CABECALHO_KEY = 'figures-planet-conta-primeiro-nome';

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

    async function atualizarNomeContaCabecalho() {
        try {
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

    document.addEventListener('DOMContentLoaded', () => {
        atualizarContadorCarrinhoCabecalho();
        mostrarNomeContaEmCache();
        atualizarNomeContaCabecalho();
    });
    window.addEventListener('storage', atualizarContadorCarrinhoCabecalho);
})();
