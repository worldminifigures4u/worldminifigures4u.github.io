const FORNECEDORES_SUPABASE_URL = "https://gksndzxadndrsynvzgzb.supabase.co";
const FORNECEDORES_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrc25kenhhZG5kcnN5bnZ6Z3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc5NzMsImV4cCI6MjA5NDY2Mzk3M30.EHZgacYr27dqoc4CJHsOwkNnJFGlLIteSHBi4B1HfVE";
const FORNECEDORES_ADMIN_EMAILS = ["worldminifigures4u@gmail.com"];
const FORNECEDORES_STORAGE_KEY = "figures-planet-fornecedores-pedidos";
const FORNECEDORES_SELECAO_KEY = "figures-planet-fornecedores-selecao";
const FORNECEDORES_SEM_IMAGEM = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="8" fill="#eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="13" fill="#777">Sem foto</text></svg>');

let fornecedoresClient = null;
let fornecedorProdutos = [];
let fornecedorSelecao = carregarSelecaoFornecedor();
let fornecedorPedidos = carregarPedidosFornecedores();

function normalizarFornecedor(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function formatarEuroFornecedor(valor) {
    return Number(valor || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20ac';
}

function definirStatusFornecedor(texto, erro = false) {
    const el = document.getElementById('fornecedores-status');
    if (!el) return;
    el.textContent = texto || '';
    el.style.color = erro ? '#ff6262' : '#28d75f';
}

function carregarSelecaoFornecedor() {
    try {
        const dados = JSON.parse(localStorage.getItem(FORNECEDORES_SELECAO_KEY) || '[]');
        return Array.isArray(dados) ? dados : [];
    } catch (_) {
        return [];
    }
}

function guardarSelecaoFornecedor() {
    localStorage.setItem(FORNECEDORES_SELECAO_KEY, JSON.stringify(fornecedorSelecao));
}

function carregarPedidosFornecedores() {
    try {
        const dados = JSON.parse(localStorage.getItem(FORNECEDORES_STORAGE_KEY) || '[]');
        return Array.isArray(dados) ? dados : [];
    } catch (_) {
        return [];
    }
}

function guardarPedidosFornecedores() {
    localStorage.setItem(FORNECEDORES_STORAGE_KEY, JSON.stringify(fornecedorPedidos));
}


function normalizarPedidoFornecedor(pedido) {
    if (!pedido) return null;
    return {
        id: String(pedido.id || pedido.codigo || Date.now()),
        codigo: pedido.codigo || '',
        fornecedor: pedido.fornecedor || '',
        referencia: pedido.referencia || '',
        estado: pedido.estado || 'A preparar',
        criado_em: pedido.criado_em || new Date().toISOString(),
        atualizado_em: pedido.atualizado_em || pedido.criado_em || new Date().toISOString(),
        itens: Array.isArray(pedido.itens) ? pedido.itens : []
    };
}

async function carregarPedidosFornecedoresRemotos() {
    try {
        const { data, error } = await fornecedoresClient.rpc('listar_encomendas_fornecedores_admin');
        if (error) throw error;
        const pedidos = Array.isArray(data) ? data : [];
        fornecedorPedidos = pedidos.map(normalizarPedidoFornecedor).filter(Boolean);
        guardarPedidosFornecedores();
    } catch (error) {
        console.warn('Tabela de fornecedores indisponivel; a usar copia local.', error);
        definirStatusFornecedor('A tabela de fornecedores ainda nao esta ativa no Supabase. Execute o SQL criado.', true);
    }
}
function gerarCodigoFornecedor() {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo = 'F';
    const bytes = new Uint8Array(5);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length; i += 1) {
        const valor = bytes[i] || Math.floor(Math.random() * 255);
        codigo += alfabeto[valor % alfabeto.length];
    }
    return codigo;
}

function obterImagemFornecedor(produto) {
    const imagens = produto?.imagens;
    if (Array.isArray(imagens) && imagens.length) return imagens[0];
    if (typeof imagens === 'string' && imagens.trim()) {
        try {
            const parsed = JSON.parse(imagens);
            if (Array.isArray(parsed) && parsed.length) return parsed[0];
        } catch (_) {
            const primeira = imagens.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean)[0];
            if (primeira) return primeira;
        }
    }
    return FORNECEDORES_SEM_IMAGEM;
}

function criarImagemFornecedor(produto, classe = 'fornecedor-miniatura') {
    const img = document.createElement('img');
    img.className = classe;
    img.alt = produto?.nome || 'Produto';
    img.src = obterImagemFornecedor(produto);
    img.onerror = () => {
        img.onerror = null;
        img.src = FORNECEDORES_SEM_IMAGEM;
    };
    return img;
}

function textoIdentificacaoProduto(produto) {
    return `Ref. ${produto.referencia || '-'} | SKU ${produto.sku || '-'}`;
}

function obterProdutoAtual(id) {
    return fornecedorProdutos.find(produto => String(produto.id) === String(id));
}

async function carregarCatalogoFornecedores() {
    const respostaAdmin = await fornecedoresClient.rpc('listar_produtos_plataforma_admin');
    let produtos = Array.isArray(respostaAdmin.data) ? respostaAdmin.data : [];

    if (respostaAdmin.error) {
        console.warn('Catalogo administrativo indisponivel; a usar consulta direta.', respostaAdmin.error);
        produtos = [];
        let inicio = 0;
        const tamanho = 500;
        while (true) {
            const { data, error } = await fornecedoresClient
                .from('produtos')
                .select('id,nome,sku,referencia,preco,stock,ativo,imagens,peso,tema,subtema')
                .order('nome', { ascending: true })
                .range(inicio, inicio + tamanho - 1);
            if (error) throw error;
            if (!data?.length) break;
            produtos.push(...data);
            if (data.length < tamanho) break;
            inicio += tamanho;
        }
    }

    fornecedorProdutos = produtos.map(produto => ({
        ...produto,
        stock: Number.isFinite(Number(produto.stock)) ? Number(produto.stock) : 0,
        preco: Number.isFinite(Number(produto.preco)) ? Number(produto.preco) : 0
    }));

    fornecedorSelecao = fornecedorSelecao.map(item => {
        const atual = obterProdutoAtual(item.id);
        if (!atual) return null;
        return { ...atual, quantidade: Math.max(1, Number(item.quantidade) || 1) };
    }).filter(Boolean);
    guardarSelecaoFornecedor();
}

function renderizarResultadosFornecedor() {
    const caixa = document.getElementById('fornecedor-resultados');
    const termo = normalizarFornecedor(document.getElementById('fornecedor-pesquisa').value);
    caixa.innerHTML = '';

    if (!termo) {
        caixa.innerHTML = '<p class="fornecedor-vazio">Pesquise por nome, Ref. ou SKU.</p>';
        return;
    }

    const resultados = fornecedorProdutos.map(produto => {
        const nome = normalizarFornecedor(produto.nome);
        const sku = normalizarFornecedor(produto.sku);
        const ref = normalizarFornecedor(produto.referencia);
        const tema = normalizarFornecedor(produto.tema);
        let score = 99;
        if (sku === termo || ref === termo) score = 0;
        else if (nome === termo) score = 1;
        else if (nome.startsWith(termo)) score = 2;
        else if (sku.includes(termo) || ref.includes(termo)) score = 3;
        else if ([nome, tema].join(' ').includes(termo)) score = 4;
        return { produto, score };
    }).filter(item => item.score < 99).sort((a, b) => a.score - b.score || String(a.produto.nome).localeCompare(String(b.produto.nome), 'pt')).slice(0, 35);

    if (!resultados.length) {
        caixa.innerHTML = '<p class="fornecedor-vazio">Nenhum produto encontrado.</p>';
        return;
    }

    resultados.forEach(({ produto }) => {
        const linha = document.createElement('div');
        linha.className = 'fornecedor-produto';
        linha.appendChild(criarImagemFornecedor(produto));

        const info = document.createElement('div');
        info.className = 'fornecedor-info';
        const nome = document.createElement('strong');
        nome.textContent = produto.nome || 'Produto sem nome';
        info.appendChild(nome);
        const ids = document.createElement('span');
        ids.className = 'fornecedor-identificadores';
        ids.textContent = textoIdentificacaoProduto(produto);
        info.appendChild(ids);
        const stock = document.createElement('span');
        stock.className = Number(produto.stock) <= 0 ? 'fornecedor-stock sem-stock' : 'fornecedor-stock';
        stock.textContent = `Stock: ${produto.stock}`;
        info.appendChild(stock);
        const preco = document.createElement('span');
        preco.className = 'fornecedor-preco';
        preco.textContent = formatarEuroFornecedor(produto.preco);
        info.appendChild(preco);
        linha.appendChild(info);

        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'wallapop-botao wallapop-botao-destaque';
        botao.textContent = 'Adicionar';
        botao.addEventListener('click', () => adicionarProdutoFornecedor(produto));
        linha.appendChild(botao);
        caixa.appendChild(linha);
    });
}

function adicionarProdutoFornecedor(produto) {
    const existente = fornecedorSelecao.find(item => String(item.id) === String(produto.id));
    if (existente) existente.quantidade += 1;
    else fornecedorSelecao.push({ ...produto, quantidade: 1 });
    guardarSelecaoFornecedor();
    renderizarSelecionadosFornecedor();
    definirStatusFornecedor('Produto adicionado.');
}

function alterarQuantidadeFornecedor(id, delta) {
    fornecedorSelecao = fornecedorSelecao.map(item => {
        if (String(item.id) !== String(id)) return item;
        return { ...item, quantidade: Math.max(1, Number(item.quantidade || 1) + delta) };
    });
    guardarSelecaoFornecedor();
    renderizarSelecionadosFornecedor();
}

function removerProdutoFornecedor(id) {
    fornecedorSelecao = fornecedorSelecao.filter(item => String(item.id) !== String(id));
    guardarSelecaoFornecedor();
    renderizarSelecionadosFornecedor();
}

function renderizarSelecionadosFornecedor() {
    const caixa = document.getElementById('fornecedor-selecionados');
    caixa.innerHTML = '';
    if (!fornecedorSelecao.length) {
        caixa.innerHTML = '<p class="fornecedor-vazio">A lista esta vazia.</p>';
        return;
    }

    fornecedorSelecao.forEach(item => {
        const linha = document.createElement('div');
        linha.className = 'fornecedor-item';
        linha.appendChild(criarImagemFornecedor(item));

        const info = document.createElement('div');
        info.className = 'fornecedor-info';
        const nome = document.createElement('strong');
        nome.textContent = item.nome;
        info.appendChild(nome);
        const ids = document.createElement('span');
        ids.className = 'fornecedor-identificadores';
        ids.textContent = textoIdentificacaoProduto(item);
        info.appendChild(ids);
        const stock = document.createElement('span');
        stock.className = Number(item.stock) <= 0 ? 'fornecedor-stock sem-stock' : 'fornecedor-stock';
        stock.textContent = `Stock atual: ${item.stock}`;
        info.appendChild(stock);
        linha.appendChild(info);

        const controlos = document.createElement('div');
        controlos.className = 'fornecedor-quantidade';
        const menos = document.createElement('button');
        menos.type = 'button';
        menos.textContent = '-';
        menos.addEventListener('click', () => alterarQuantidadeFornecedor(item.id, -1));
        const qtd = document.createElement('strong');
        qtd.textContent = item.quantidade;
        const mais = document.createElement('button');
        mais.type = 'button';
        mais.textContent = '+';
        mais.addEventListener('click', () => alterarQuantidadeFornecedor(item.id, 1));
        const remover = document.createElement('button');
        remover.type = 'button';
        remover.className = 'fornecedor-remover';
        remover.textContent = 'x';
        remover.addEventListener('click', () => removerProdutoFornecedor(item.id));
        controlos.append(menos, qtd, mais, remover);
        linha.appendChild(controlos);
        caixa.appendChild(linha);
    });
}

function limparSelecaoFornecedor() {
    if (!fornecedorSelecao.length) return;
    if (!window.confirm('Limpar todos os produtos da encomenda a fornecedor?')) return;
    fornecedorSelecao = [];
    guardarSelecaoFornecedor();
    renderizarSelecionadosFornecedor();
    definirStatusFornecedor('Lista limpa.');
}

async function criarPedidoFornecedor() {
    if (!fornecedorSelecao.length) {
        definirStatusFornecedor('Adicione produtos antes de criar a encomenda.', true);
        return;
    }
    const fornecedor = document.getElementById('fornecedor-nome').value;
    const referencia = document.getElementById('fornecedor-referencia').value.trim();
    const itens = fornecedorSelecao.map(item => ({
        id: item.id,
        nome: item.nome,
        sku: item.sku || '',
        referencia: item.referencia || '',
        quantidade: Math.max(1, Number(item.quantidade) || 1),
        recebido: 0,
        stock_no_momento: Number(item.stock || 0),
        preco: Number(item.preco || 0),
        imagens: item.imagens || []
    }));

    try {
        definirStatusFornecedor('A criar encomenda no Supabase...');
        const { data, error } = await fornecedoresClient.rpc('criar_encomenda_fornecedor_admin', {
            p_fornecedor: fornecedor,
            p_referencia: referencia,
            p_itens: itens
        });
        if (error) throw error;
        const pedido = normalizarPedidoFornecedor(data);
        fornecedorPedidos.unshift(pedido);
        guardarPedidosFornecedores();
        fornecedorSelecao = [];
        guardarSelecaoFornecedor();
        document.getElementById('fornecedor-referencia').value = '';
        renderizarSelecionadosFornecedor();
        renderizarPedidosFornecedores();
        definirStatusFornecedor(`Encomenda ${pedido.codigo} criada.`);
    } catch (error) {
        console.error(error);
        definirStatusFornecedor('Erro ao criar encomenda de fornecedor: ' + (error.message || 'erro desconhecido'), true);
    }
}
async function alterarEstadoPedidoFornecedor(id, estado) {
    const pedido = fornecedorPedidos.find(item => item.id === id);
    if (!pedido) return;
    try {
        const { data, error } = await fornecedoresClient.rpc('alterar_estado_encomenda_fornecedor_admin', {
            p_id: id,
            p_estado: estado
        });
        if (error) throw error;
        const atualizado = normalizarPedidoFornecedor(data);
        fornecedorPedidos = fornecedorPedidos.map(item => item.id === id ? atualizado : item);
        guardarPedidosFornecedores();
        renderizarPedidosFornecedores();
        definirStatusFornecedor(`Estado da encomenda ${atualizado.codigo} atualizado.`);
    } catch (error) {
        console.error(error);
        definirStatusFornecedor('Erro ao alterar estado: ' + (error.message || 'erro desconhecido'), true);
        renderizarPedidosFornecedores();
    }
}

async function apagarPedidoFornecedor(id) {
    const pedido = fornecedorPedidos.find(item => item.id === id);
    if (!pedido) return;
    if (!window.confirm(`Apagar a encomenda ${pedido.codigo}? Isto nao altera o stock.`)) return;
    try {
        const { error } = await fornecedoresClient.rpc('apagar_encomenda_fornecedor_admin', { p_id: id });
        if (error) throw error;
        fornecedorPedidos = fornecedorPedidos.filter(item => item.id !== id);
        guardarPedidosFornecedores();
        renderizarPedidosFornecedores();
        definirStatusFornecedor(`Encomenda ${pedido.codigo} apagada.`);
    } catch (error) {
        console.error(error);
        definirStatusFornecedor('Erro ao apagar encomenda: ' + (error.message || 'erro desconhecido'), true);
    }
}
function renderizarPedidosFornecedores() {
    const caixa = document.getElementById('fornecedor-pedidos');
    const filtro = document.getElementById('fornecedor-filtro-estado').value;
    caixa.innerHTML = '';
    const pedidos = fornecedorPedidos.filter(pedido => filtro === 'todos' || pedido.estado === filtro);
    if (!pedidos.length) {
        caixa.innerHTML = '<p class="fornecedor-vazio">Ainda nao existem encomendas neste estado.</p>';
        return;
    }

    pedidos.forEach(pedido => {
        const card = document.createElement('article');
        card.className = 'fornecedor-pedido-card';

        const topo = document.createElement('div');
        topo.className = 'fornecedor-pedido-cabecalho';
        const titulo = document.createElement('div');
        titulo.innerHTML = `<strong>${pedido.codigo}</strong><span>${pedido.fornecedor}${pedido.referencia ? ' - ' + pedido.referencia : ''}</span><small>${new Date(pedido.criado_em).toLocaleString('pt-PT')}</small>`;
        const estado = document.createElement('select');
        estado.className = 'fornecedor-status-select';
        ['A preparar', 'Encomendada', 'Recebida parcialmente', 'Recebida', 'Cancelada'].forEach(opcao => {
            const opt = document.createElement('option');
            opt.value = opcao;
            opt.textContent = opcao;
            opt.selected = pedido.estado === opcao;
            estado.appendChild(opt);
        });
        estado.addEventListener('change', () => alterarEstadoPedidoFornecedor(pedido.id, estado.value));
        topo.append(titulo, estado);
        card.appendChild(topo);

        const lista = document.createElement('div');
        lista.className = 'fornecedor-pedido-produtos';
        pedido.itens.forEach(item => {
            const produtoAtual = obterProdutoAtual(item.id) || item;
            const recebido = Number(item.recebido || 0);
            const restante = Math.max(0, Number(item.quantidade || 0) - recebido);
            const linha = document.createElement('div');
            linha.className = 'fornecedor-pedido-linha';
            linha.appendChild(criarImagemFornecedor(produtoAtual, 'fornecedor-miniatura pequena'));
            const info = document.createElement('div');
            info.className = 'fornecedor-info';
            info.innerHTML = `<strong>${item.nome}</strong><span class="fornecedor-identificadores">Ref. ${item.referencia || '-'} | SKU ${item.sku || '-'}</span><span>Pedido: ${item.quantidade} | Recebido: ${recebido} | Stock atual: ${Number(produtoAtual.stock || 0)}</span>`;
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.step = '1';
            input.value = restante > 0 ? restante : 0;
            input.className = 'fornecedor-recebido-input';
            input.dataset.pedido = pedido.id;
            input.dataset.produto = item.id;
            linha.append(info, input);
            lista.appendChild(linha);
        });
        card.appendChild(lista);

        const acoes = document.createElement('div');
        acoes.className = 'fornecedores-acoes pedido';
        const receber = document.createElement('button');
        receber.type = 'button';
        receber.className = 'wallapop-botao wallapop-botao-destaque';
        receber.textContent = 'Receber stock';
        receber.addEventListener('click', () => receberPedidoFornecedor(pedido.id));
        const apagar = document.createElement('button');
        apagar.type = 'button';
        apagar.className = 'wallapop-botao';
        apagar.textContent = 'Apagar pedido';
        apagar.addEventListener('click', () => apagarPedidoFornecedor(pedido.id));
        acoes.append(receber, apagar);
        card.appendChild(acoes);
        caixa.appendChild(card);
    });
}

async function receberPedidoFornecedor(id) {
    const pedido = fornecedorPedidos.find(item => item.id === id);
    if (!pedido) return;
    const linhas = Array.from(document.querySelectorAll(`.fornecedor-recebido-input[data-pedido="${CSS.escape(id)}"]`));
    const rececoes = linhas.map(input => ({
        produto_id: input.dataset.produto,
        quantidade: Math.max(0, Math.floor(Number(input.value) || 0))
    })).filter(item => item.quantidade > 0);
    if (!rececoes.length) {
        definirStatusFornecedor('Indique pelo menos uma quantidade recebida.', true);
        return;
    }
    if (!window.confirm(`Atualizar stock de ${rececoes.length} produto(s) da encomenda ${pedido.codigo}?`)) return;
    try {
        definirStatusFornecedor('A atualizar stock...');
        const { data, error } = await fornecedoresClient.rpc('receber_stock_fornecedor_admin', {
            p_encomenda_id: id,
            p_recebidos: rececoes
        });
        if (error) throw error;

        const atualizado = normalizarPedidoFornecedor(data);
        fornecedorPedidos = fornecedorPedidos.map(item => item.id === id ? atualizado : item);
        guardarPedidosFornecedores();
        await carregarCatalogoFornecedores();
        renderizarResultadosFornecedor();
        renderizarPedidosFornecedores();
        definirStatusFornecedor(`Stock atualizado para a encomenda ${atualizado.codigo}.`);
    } catch (error) {
        console.error(error);
        definirStatusFornecedor('Erro ao receber stock: ' + (error.message || 'erro desconhecido'), true);
    }
}
async function iniciarFornecedoresAdmin() {
    const bloqueio = document.getElementById('fornecedores-bloqueio');
    try {
        if (typeof supabase === 'undefined') throw new Error('A biblioteca Supabase nao carregou.');
        fornecedoresClient = supabase.createClient(FORNECEDORES_SUPABASE_URL, FORNECEDORES_SUPABASE_KEY);
        const { data: { user }, error } = await fornecedoresClient.auth.getUser();
        if (error || !user || !FORNECEDORES_ADMIN_EMAILS.includes(String(user.email || '').toLowerCase())) {
            bloqueio.textContent = 'Acesso reservado ao administrador. A regressar a conta...';
            setTimeout(() => window.location.replace('conta.html'), 1400);
            return;
        }
        await carregarCatalogoFornecedores();
        await carregarPedidosFornecedoresRemotos();
        bloqueio.hidden = true;
        document.getElementById('fornecedores-aplicacao').hidden = false;
        renderizarResultadosFornecedor();
        renderizarSelecionadosFornecedor();
        renderizarPedidosFornecedores();
    } catch (error) {
        console.error(error);
        bloqueio.textContent = 'Erro ao abrir fornecedores: ' + (error.message || 'sem detalhe disponivel');
    }
}

document.getElementById('fornecedor-pesquisa').addEventListener('input', renderizarResultadosFornecedor);
document.getElementById('btn-limpar-fornecedor').addEventListener('click', limparSelecaoFornecedor);
document.getElementById('btn-criar-fornecedor').addEventListener('click', criarPedidoFornecedor);
document.getElementById('fornecedor-filtro-estado').addEventListener('change', renderizarPedidosFornecedores);
document.getElementById('btn-atualizar-catalogo-fornecedor').addEventListener('click', async () => {
    try {
        definirStatusFornecedor('A atualizar catalogo...');
        await carregarCatalogoFornecedores();
        renderizarResultadosFornecedor();
        renderizarSelecionadosFornecedor();
        renderizarPedidosFornecedores();
        definirStatusFornecedor('Catalogo atualizado.');
    } catch (error) {
        console.error(error);
        definirStatusFornecedor('Erro ao atualizar catalogo: ' + (error.message || 'erro desconhecido'), true);
    }
});
window.addEventListener('load', iniciarFornecedoresAdmin);
