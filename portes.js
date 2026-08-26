const PORTES_ZONAS = [
    { id: 'portugal', rotulo: 'Portugal' },
    { id: 'espanha', rotulo: 'Espanha' },
    { id: 'europa', rotulo: 'Europa' }
];

let portesClient = null;
let portesLinhas = [];
let portesZonaAtiva = 'portugal';
let portesOriginais = new Map();

function formatarGramasPortes(pesoG) {
    return `${Number(pesoG).toLocaleString('pt-PT')}g`;
}

function formatarPesoPortes(pesoAteG, pesoAnteriorG = null) {
    const peso = Number(pesoAteG);
    const limiteSuperior = (!Number.isFinite(peso) || peso >= 999999) ? 2000 : peso;
    if (pesoAnteriorG == null || !Number.isFinite(Number(pesoAnteriorG))) {
        return `Até ${formatarGramasPortes(limiteSuperior)}`;
    }
    return `> ${formatarGramasPortes(pesoAnteriorG)} – ${formatarGramasPortes(limiteSuperior)}`;
}

function estadoOriginalPortes(linha) {
    return {
        preco: Math.round(Number(linha.preco || 0) * 100) / 100,
        ativo: linha.ativo !== false
    };
}

function linhaPortesAlterada(linha) {
    const original = portesOriginais.get(linha.id);
    if (!original) return false;
    return Number(original.preco) !== Number(linha.preco)
        || Boolean(original.ativo) !== (linha.ativo !== false);
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

    const pesosOrdenados = [...porPeso.keys()]
        .map((chave) => Number(chave))
        .sort((a, b) => a - b);

    pesosOrdenados.forEach((pesoNum, indice) => {
        const pesoChave = String(pesoNum);
        const grupo = porPeso.get(pesoChave);
        const pesoAnterior = indice === 0 ? null : pesosOrdenados[indice - 1];
        const secao = document.createElement('section');
        secao.className = 'portes-grupo';

        const titulo = document.createElement('h2');
        titulo.textContent = formatarPesoPortes(pesoNum, pesoAnterior);
        secao.appendChild(titulo);

        const tabela = document.createElement('table');
        tabela.className = 'portes-tabela';
        tabela.innerHTML = '<thead><tr><th>Ativo</th><th>Método</th><th>Nome no site</th><th>Preço site (€)</th></tr></thead>';
        const tbody = document.createElement('tbody');

        grupo.forEach((linha) => {
            const tr = document.createElement('tr');
            const ativo = linha.ativo !== false;
            if (linhaPortesAlterada(linha)) tr.classList.add('portes-alterado');
            if (!ativo) tr.classList.add('portes-inativo');

            const tdAtivo = document.createElement('td');
            tdAtivo.className = 'portes-ativo';
            const check = document.createElement('input');
            check.type = 'checkbox';
            check.checked = ativo;
            check.setAttribute('aria-label', `Ativar ${linha.nome_exibicao || linha.metodo_id} para o cliente`);
            check.addEventListener('change', () => {
                linha.ativo = check.checked;
                renderizarTabelaPortes();
            });
            tdAtivo.appendChild(check);
            tr.appendChild(tdAtivo);

            const tdMetodo = document.createElement('td');
            tdMetodo.className = 'portes-metodo';
            tdMetodo.textContent = linha.metodo_id;
            tr.appendChild(tdMetodo);

            const tdNome = document.createElement('td');
            tdNome.className = 'portes-nome';
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

    portesLinhas = (data || [])
        .filter((linha) => String(linha.metodo_id || '') !== 'entrega_tomar')
        .map((linha) => ({
            ...linha,
            preco: Math.round(Number(linha.preco || 0) * 100) / 100,
            ativo: linha.ativo !== false
        }));
    portesOriginais = new Map(portesLinhas.map((linha) => [linha.id, estadoOriginalPortes(linha)]));
    renderizarTabelaPortes();
    definirStatusPortes(portesLinhas.length
        ? `${portesLinhas.length} tarifas carregadas.`
        : 'Tabela vazia. Executa supabase-portes-tarifas.sql no Supabase.');
}

async function guardarPortesAdmin() {
    const alteradas = portesLinhas
        .filter((linha) => linhaPortesAlterada(linha))
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
    definirStatusPortes(`Guardado. ${atualizados} tarifas atualizadas. Opções desativadas deixam de aparecer ao cliente.`);
}

let portesMetodos = [];
let portesMetodosOriginais = new Map();

function slugifyMetodoId(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function metodoPortesAlterado(metodo) {
    const original = portesMetodosOriginais.get(metodo.id);
    if (!original) return false;
    return original.nome_exibicao !== metodo.nome_exibicao
        || Boolean(original.registado) !== Boolean(metodo.registado)
        || Boolean(original.ativo) !== Boolean(metodo.ativo);
}

function renderizarMetodosPortes() {
    const lista = document.getElementById('portes-metodos-lista');
    if (!lista) return;
    lista.replaceChildren();

    if (!portesMetodos.length) {
        const vazio = document.createElement('p');
        vazio.textContent = 'Sem métodos. Executa supabase-portes-metodos.sql no Supabase.';
        lista.appendChild(vazio);
        return;
    }

    const tabela = document.createElement('table');
    tabela.className = 'portes-tabela portes-metodos-tabela';
    tabela.innerHTML = '<thead><tr><th>Ativo</th><th>ID</th><th>Nome no site</th><th>Registado</th><th></th></tr></thead>';
    const tbody = document.createElement('tbody');

    portesMetodos
        .slice()
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || String(a.id).localeCompare(String(b.id)))
        .forEach((metodo) => {
            const tr = document.createElement('tr');
            if (metodoPortesAlterado(metodo)) tr.classList.add('portes-alterado');
            if (!metodo.ativo) tr.classList.add('portes-inativo');

            const tdAtivo = document.createElement('td');
            tdAtivo.className = 'portes-ativo';
            const checkAtivo = document.createElement('input');
            checkAtivo.type = 'checkbox';
            checkAtivo.checked = metodo.ativo !== false;
            checkAtivo.addEventListener('change', () => {
                metodo.ativo = checkAtivo.checked;
                renderizarMetodosPortes();
            });
            tdAtivo.appendChild(checkAtivo);
            tr.appendChild(tdAtivo);

            const tdId = document.createElement('td');
            tdId.className = 'portes-metodo';
            tdId.textContent = metodo.id;
            tr.appendChild(tdId);

            const tdNome = document.createElement('td');
            const inputNome = document.createElement('input');
            inputNome.type = 'text';
            inputNome.value = metodo.nome_exibicao || '';
            inputNome.dataset.semLimparCampo = '1';
            inputNome.addEventListener('change', () => {
                metodo.nome_exibicao = String(inputNome.value || '').trim() || metodo.id;
                inputNome.value = metodo.nome_exibicao;
                renderizarMetodosPortes();
            });
            tdNome.appendChild(inputNome);
            tr.appendChild(tdNome);

            const tdReg = document.createElement('td');
            tdReg.className = 'portes-ativo';
            const checkReg = document.createElement('input');
            checkReg.type = 'checkbox';
            checkReg.checked = metodo.registado === true;
            checkReg.title = 'Com rastreamento no carrinho';
            checkReg.addEventListener('change', () => {
                metodo.registado = checkReg.checked;
                renderizarMetodosPortes();
            });
            tdReg.appendChild(checkReg);
            tr.appendChild(tdReg);

            const tdAcoes = document.createElement('td');
            tdAcoes.className = 'portes-metodo-acoes';
            const btnApagar = document.createElement('button');
            btnApagar.type = 'button';
            btnApagar.className = 'portes-metodo-apagar';
            btnApagar.setAttribute('aria-label', `Apagar método ${metodo.id}`);
            btnApagar.title = 'Apagar método e tarifas';
            btnApagar.textContent = '×';
            btnApagar.addEventListener('click', () => {
                apagarMetodoPortesAdmin(metodo).catch(console.error);
            });
            tdAcoes.appendChild(btnApagar);
            tr.appendChild(tdAcoes);

            tbody.appendChild(tr);
        });

    tabela.appendChild(tbody);
    lista.appendChild(tabela);
}

async function carregarMetodosPortesAdmin() {
    const { data, error } = await portesClient
        .from('portes_metodos')
        .select('id, nome_exibicao, registado, ativo, ordem, updated_at')
        .order('ordem');

    if (error) {
        definirStatusPortes('Erro ao carregar métodos: ' + (error.message || 'desconhecido')
            + ' (executa supabase-portes-metodos.sql)');
        portesMetodos = [];
        renderizarMetodosPortes();
        return;
    }

    portesMetodos = (data || []).map((metodo) => ({
        ...metodo,
        registado: metodo.registado === true,
        ativo: metodo.ativo !== false
    }));
    portesMetodosOriginais = new Map(portesMetodos.map((metodo) => [metodo.id, {
        nome_exibicao: metodo.nome_exibicao,
        registado: metodo.registado,
        ativo: metodo.ativo
    }]));
    if (typeof aplicarCatalogoMetodosEnvio === 'function') {
        aplicarCatalogoMetodosEnvio(portesMetodos.filter((metodo) => metodo.ativo));
    }
    renderizarMetodosPortes();
}

async function guardarMetodosPortesAdmin() {
    const alterados = portesMetodos
        .filter((metodo) => metodoPortesAlterado(metodo))
        .map((metodo) => ({
            id: metodo.id,
            nome_exibicao: metodo.nome_exibicao,
            registado: metodo.registado === true,
            ativo: metodo.ativo !== false,
            ordem: metodo.ordem
        }));

    if (!alterados.length) return 0;

    const { data, error } = await portesClient.rpc('guardar_portes_metodos_admin', {
        p_linhas: alterados
    });
    if (error) throw error;
    return data?.atualizados != null ? data.atualizados : alterados.length;
}

async function apagarMetodoPortesAdmin(metodo) {
    const id = String(metodo?.id || '').trim();
    if (!id) return;

    const ok = window.confirm(
        `Apagar o método "${metodo.nome_exibicao || id}" (${id})?\n\n`
        + 'Isto remove também todas as tarifas desse método em Portugal, Espanha e Europa.'
    );
    if (!ok) return;

    definirStatusPortes(`A apagar método ${id}...`);
    const { data, error } = await portesClient.rpc('remover_portes_metodo_admin', { p_id: id });
    if (error) {
        definirStatusPortes('Erro ao apagar método: ' + (error.message || 'desconhecido')
            + ' (executa supabase-portes-remover-metodo.sql)');
        return;
    }

    if (typeof window.limparCachePortes === 'function') window.limparCachePortes();
    await carregarMetodosPortesAdmin();
    await carregarPortesAdmin();
    definirStatusPortes(
        `Método "${id}" apagado. Tarifas removidas: ${data?.tarifas_removidas || 0}.`
    );
}

async function criarMetodoPortesAdmin(evento) {
    evento.preventDefault();
    const idInput = document.getElementById('novo-metodo-id');
    const nomeInput = document.getElementById('novo-metodo-nome');
    const registadoInput = document.getElementById('novo-metodo-registado');
    const id = slugifyMetodoId(idInput?.value || '');
    const nome = String(nomeInput?.value || '').trim();
    const registado = registadoInput?.checked === true;

    if (!id || !nome) {
        definirStatusPortes('Indica ID e nome do método.');
        return;
    }

    definirStatusPortes('A criar método...');
    const { data, error } = await portesClient.rpc('criar_portes_metodo_admin', {
        p_id: id,
        p_nome_exibicao: nome,
        p_registado: registado,
        p_preco_inicial: 0
    });
    if (error) {
        definirStatusPortes('Erro ao criar método: ' + (error.message || 'desconhecido'));
        return;
    }

    if (idInput) idInput.value = '';
    if (nomeInput) nomeInput.value = '';
    if (registadoInput) registadoInput.checked = false;
    if (typeof window.limparCachePortes === 'function') window.limparCachePortes();
    await carregarMetodosPortesAdmin();
    await carregarPortesAdmin();
    definirStatusPortes(`Método "${nome}" criado. Tarifas criadas: ${data?.tarifas_criadas || 0} (inativas — ativa e define preços).`);
}

async function guardarTudoPortesAdmin() {
    definirStatusPortes('A guardar...');
    try {
        const metodos = await guardarMetodosPortesAdmin();
        const alteradas = portesLinhas
            .filter((linha) => linhaPortesAlterada(linha))
            .map((linha) => ({
                id: linha.id,
                preco: linha.preco,
                nome_exibicao: linha.nome_exibicao,
                ativo: linha.ativo !== false
            }));

        let tarifas = 0;
        if (alteradas.length) {
            const { data, error } = await portesClient.rpc('guardar_portes_tarifas_admin', {
                p_linhas: alteradas
            });
            if (error) throw error;
            tarifas = data?.atualizados != null ? data.atualizados : alteradas.length;
        }

        if (!metodos && !tarifas) {
            definirStatusPortes('Não há alterações para guardar.');
            return;
        }

        if (typeof window.limparCachePortes === 'function') window.limparCachePortes();
        await carregarMetodosPortesAdmin();
        await carregarPortesAdmin();
        definirStatusPortes(`Guardado. Métodos: ${metodos || 0}. Tarifas: ${tarifas || 0}.`);
    } catch (erro) {
        definirStatusPortes('Erro ao guardar: ' + (erro.message || 'desconhecido'));
    }
}

async function iniciarPainelPortes(opcoes = {}) {
    const embutido = Boolean(opcoes.embutido) || Boolean(document.getElementById('portes-aplicacao')?.closest('#gestao-aplicacao'));
    const bloqueio = document.getElementById('portes-bloqueio');
    const aplicacao = document.getElementById('portes-aplicacao');

    await window.carregarScriptSupabase();
    if (typeof supabase === 'undefined') {
        throw new Error('A biblioteca Supabase não carregou.');
    }

    portesClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    if (!opcoes.jaAutenticado) {
        const user = await validarAdminRapido(portesClient, embutido ? null : bloqueio);
        if (!user) {
            if (embutido) {
                definirStatusPortes('Acesso reservado ao administrador.');
                return;
            }
            return;
        }
    }

    if (!embutido) {
        if (typeof mostrarNavegacaoAdminValidada === 'function') {
            mostrarNavegacaoAdminValidada();
        }
        if (bloqueio) bloqueio.hidden = true;
        if (aplicacao) aplicacao.hidden = false;
    }

    if (!window.__portesUiLigada) {
        window.__portesUiLigada = true;
        document.querySelectorAll('.portes-tab').forEach((botao) => {
            botao.addEventListener('click', () => ativarTabPortes(botao.dataset.zona));
        });
        document.getElementById('btn-guardar-portes')?.addEventListener('click', () => {
            guardarTudoPortesAdmin().catch(console.error);
        });
        document.getElementById('form-criar-metodo-portes')?.addEventListener('submit', (evento) => {
            criarMetodoPortesAdmin(evento).catch(console.error);
        });
        document.getElementById('novo-metodo-nome')?.addEventListener('blur', () => {
            const idInput = document.getElementById('novo-metodo-id');
            if (idInput && !idInput.value.trim()) {
                idInput.value = slugifyMetodoId(document.getElementById('novo-metodo-nome')?.value || '');
            }
        });
    }

    await carregarMetodosPortesAdmin();
    await carregarPortesAdmin();

    if (embutido && window.location.hash === '#gestao-portes') {
        document.getElementById('gestao-portes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

window.iniciarPainelPortes = iniciarPainelPortes;

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('portes-aplicacao')?.closest('#gestao-aplicacao')) {
        return;
    }
    iniciarPainelPortes().catch((erro) => {
        console.error(erro);
        const bloqueio = document.getElementById('portes-bloqueio');
        if (bloqueio) bloqueio.textContent = 'Erro ao iniciar o editor de portes.';
    });
});
