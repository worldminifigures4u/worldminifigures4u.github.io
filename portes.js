const PORTES_ZONAS = [
    { id: 'portugal', rotulo: 'Portugal' },
    { id: 'espanha', rotulo: 'Espanha' },
    { id: 'europa', rotulo: 'Europa' }
];

let portesClient = null;
let portesLinhas = [];
let portesZonaAtiva = 'portugal';
let portesOriginais = new Map();

function formatarPesoPortes(pesoAteG) {
    const peso = Number(pesoAteG);
    if (!Number.isFinite(peso) || peso >= 999999) return 'Acima do último escalão';
    return `Até ${peso.toLocaleString('pt-PT')} g`;
}

function formatarPrecoInput(valor) {
    return (Math.round(Number(valor || 0) * 100) / 100).toFixed(2);
}

function definirStatusPortes(mensagem) {
    const status = document.getElementById('portes-status');
    if (status) status.textContent = mensagem || '';
}

function linhasZonaAtual() {
    return portesLinhas
        .filter((linha) => linha.zona === portesZonaAtiva)
        .sort((a, b) => {
            if (a.peso_ate_g !== b.peso_ate_g) return a.peso_ate_g - b.peso_ate_g;
            return (a.ordem || 0) - (b.ordem || 0);
        });
}

function renderizarTabelaPortes() {
    const painel = document.getElementById('portes-painel');
    if (!painel) return;

    const linhas = linhasZonaAtual();
    painel.replaceChildren();

    if (!linhas.length) {
        const vazio = document.createElement('p');
        vazio.textContent = 'Sem tarifas para esta zona. Confirma se executaste o SQL supabase-portes-tarifas.sql.';
        painel.appendChild(vazio);
        return;
    }

    const porPeso = new Map();
    linhas.forEach((linha) => {
        const chave = String(linha.peso_ate_g);
        if (!porPeso.has(chave)) porPeso.set(chave, []);
        porPeso.get(chave).push(linha);
    });

    porPeso.forEach((grupo, pesoChave) => {
        const secao = document.createElement('section');
        secao.className = 'portes-grupo';

        const titulo = document.createElement('h2');
        titulo.textContent = formatarPesoPortes(pesoChave);
        secao.appendChild(titulo);

        const tabela = document.createElement('table');
        tabela.className = 'portes-tabela';
        tabela.innerHTML = '<thead><tr><th>Método</th><th>Nome no site</th><th>Preço site (€)</th></tr></thead>';
        const tbody = document.createElement('tbody');

        grupo.forEach((linha) => {
            const tr = document.createElement('tr');
            const original = portesOriginais.get(linha.id);
            const alterado = original !== undefined && Number(original) !== Number(linha.preco);
            if (alterado) tr.classList.add('portes-alterado');

            const tdMetodo = document.createElement('td');
            tdMetodo.textContent = linha.metodo_id;
            tr.appendChild(tdMetodo);

            const tdNome = document.createElement('td');
            tdNome.textContent = linha.nome_exibicao || '';
            tr.appendChild(tdNome);

            const tdPreco = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.step = '0.01';
            input.inputMode = 'decimal';
            input.value = formatarPrecoInput(linha.preco);
            input.dataset.id = linha.id;
            input.setAttribute('aria-label', `Preço ${linha.metodo_id}`);
            input.addEventListener('change', () => {
                const valor = Math.round(Number(input.value || 0) * 100) / 100;
                input.value = formatarPrecoInput(valor);
                linha.preco = valor;
                renderizarTabelaPortes();
            });
            tdPreco.appendChild(input);
            tr.appendChild(tdPreco);
            tbody.appendChild(tr);
        });

        tabela.appendChild(tbody);
        secao.appendChild(tabela);
        painel.appendChild(secao);
    });
}

function ativarTabPortes(zona) {
    portesZonaAtiva = zona;
    document.querySelectorAll('.portes-tab').forEach((botao) => {
        const ativa = botao.dataset.zona === zona;
        botao.classList.toggle('ativa', ativa);
        botao.setAttribute('aria-selected', ativa ? 'true' : 'false');
    });
    renderizarTabelaPortes();
}

async function carregarPortesAdmin() {
    definirStatusPortes('A carregar tarifas...');
    const { data, error } = await portesClient
        .from('portes_tarifas')
        .select('id, zona, peso_ate_g, metodo_id, nome_exibicao, preco, ativo, ordem, updated_at')
        .order('zona')
        .order('peso_ate_g')
        .order('ordem');

    if (error) {
        definirStatusPortes('Erro ao carregar portes: ' + (error.message || 'desconhecido'));
        return;
    }

    portesLinhas = (data || []).map((linha) => ({
        ...linha,
        preco: Math.round(Number(linha.preco || 0) * 100) / 100
    }));
    portesOriginais = new Map(portesLinhas.map((linha) => [linha.id, linha.preco]));
    renderizarTabelaPortes();
    definirStatusPortes(portesLinhas.length
        ? `${portesLinhas.length} tarifas carregadas.`
        : 'Tabela vazia. Executa supabase-portes-tarifas.sql no Supabase.');
}

async function guardarPortesAdmin() {
    const alteradas = portesLinhas
        .filter((linha) => portesOriginais.get(linha.id) !== linha.preco)
        .map((linha) => ({
            id: linha.id,
            preco: linha.preco,
            nome_exibicao: linha.nome_exibicao,
            ativo: linha.ativo !== false
        }));

    if (!alteradas.length) {
        definirStatusPortes('Não há alterações para guardar.');
        return;
    }

    definirStatusPortes('A guardar...');
    const { data, error } = await portesClient.rpc('guardar_portes_tarifas_admin', {
        p_linhas: alteradas
    });

    if (error) {
        definirStatusPortes('Erro ao guardar: ' + (error.message || 'desconhecido'));
        return;
    }

    if (typeof window.limparCachePortes === 'function') {
        window.limparCachePortes();
    }

    await carregarPortesAdmin();
    const atualizados = data && data.atualizados != null ? data.atualizados : alteradas.length;
    definirStatusPortes(`Guardado. ${atualizados} tarifas atualizadas. O carrinho usa cache até 6h (ou limpa ao guardar nesta página).`);
}

async function iniciarPainelPortes() {
    const bloqueio = document.getElementById('portes-bloqueio');
    const aplicacao = document.getElementById('portes-aplicacao');

    await window.carregarScriptSupabase();
    if (typeof supabase === 'undefined') {
        throw new Error('A biblioteca Supabase não carregou.');
    }

    portesClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: { user }, error } = await portesClient.auth.getUser();
    if (error || !user || !ADMIN_EMAILS.includes(String(user.email || '').toLowerCase())) {
        if (bloqueio) bloqueio.textContent = 'Acesso reservado ao administrador. A regressar à conta...';
        setTimeout(() => window.location.replace('conta.html'), 1400);
        return;
    }

    if (typeof mostrarNavegacaoAdminValidada === 'function') {
        mostrarNavegacaoAdminValidada();
    }
    if (bloqueio) bloqueio.hidden = true;
    if (aplicacao) aplicacao.hidden = false;

    document.querySelectorAll('.portes-tab').forEach((botao) => {
        botao.addEventListener('click', () => ativarTabPortes(botao.dataset.zona));
    });
    document.getElementById('btn-recarregar-portes')?.addEventListener('click', () => {
        carregarPortesAdmin().catch(console.error);
    });
    document.getElementById('btn-guardar-portes')?.addEventListener('click', () => {
        guardarPortesAdmin().catch(console.error);
    });

    await carregarPortesAdmin();
}

document.addEventListener('DOMContentLoaded', () => {
    iniciarPainelPortes().catch((erro) => {
        console.error(erro);
        const bloqueio = document.getElementById('portes-bloqueio');
        if (bloqueio) bloqueio.textContent = 'Erro ao iniciar o editor de portes.';
    });
});
