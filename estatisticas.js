const ESTATISTICAS_PRECO_FAIXAS = [
    { rotulo: "0-2,99 €", min: 0, max: 2.99 },
    { rotulo: "3-4,99 €", min: 3, max: 4.99 },
    { rotulo: "5-7,99 €", min: 5, max: 7.99 },
    { rotulo: "8-11,99 €", min: 8, max: 11.99 },
    { rotulo: "12-19,99 €", min: 12, max: 19.99 },
    { rotulo: "20 €+", min: 20, max: Infinity }
];

const ESTATISTICAS_DIAS_SEMANA = [
    { chave: 1, rotulo: "Segunda-feira" },
    { chave: 2, rotulo: "Terça-feira" },
    { chave: 3, rotulo: "Quarta-feira" },
    { chave: 4, rotulo: "Quinta-feira" },
    { chave: 5, rotulo: "Sexta-feira" },
    { chave: 6, rotulo: "Sábado" },
    { chave: 7, rotulo: "Domingo" }
];

let estatisticasClient = null;
let estatisticasEncomendas = [];

function criarElementoEstatisticas(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function normalizarTextoEstatisticas(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function formatarEuroEstatisticas(valor) {
    return Number(valor || 0).toLocaleString('pt-PT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + ' €';
}

function formatarNumeroEstatisticas(valor) {
    return Number(valor || 0).toLocaleString('pt-PT');
}

function formatarMesEstatisticas(chave) {
    const partes = String(chave || '').split('-');
    if (partes.length !== 2) return chave || 'Sem data';
    const data = new Date(Number(partes[0]), Number(partes[1]) - 1, 1);
    if (Number.isNaN(data.getTime())) return chave;
    return new Intl.DateTimeFormat('pt-PT', { month: 'short', year: 'numeric' }).format(data);
}

function formatarDiaEstatisticas(chave) {
    const partes = String(chave || '').split('-');
    if (partes.length !== 3) return chave || 'Sem data';
    const data = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    if (Number.isNaN(data.getTime())) return chave;
    return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }).format(data);
}

function obterDataEncomenda(encomenda) {
    const data = new Date(encomenda.created_at || encomenda.data || encomenda.inserted_at || '');
    return Number.isNaN(data.getTime()) ? null : data;
}

function obterChaveDia(encomenda) {
    const data = obterDataEncomenda(encomenda);
    if (!data) return 'Sem data';
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function obterChaveDiaAtualEstatisticas() {
    const data = new Date();
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function obterChaveMes(encomenda) {
    const chaveDia = obterChaveDia(encomenda);
    if (chaveDia === 'Sem data') return 'Sem data';
    return chaveDia.slice(0, 7);
}

function obterAnoEncomenda(encomenda) {
    const data = obterDataEncomenda(encomenda);
    return data ? String(data.getFullYear()) : 'Sem data';
}

function obterChaveDiaSemana(encomenda) {
    const data = obterDataEncomenda(encomenda);
    if (!data) return null;
    const diaJs = data.getDay();
    return diaJs === 0 ? 7 : diaJs;
}

function formatarDiaSemanaEstatisticas(chave) {
    return ESTATISTICAS_DIAS_SEMANA.find(dia => dia.chave === Number(chave))?.rotulo || 'Sem data';
}

function obterPlataformaEncomenda(encomenda) {
    const origem = String(encomenda.origem || encomenda.plataforma || encomenda.site || '').trim();
    if (!origem) return 'Site';
    const normalizada = normalizarTextoEstatisticas(origem);
    if (normalizada === 'loja' || normalizada === 'site') return 'Site';
    if (normalizada === 'wallapop') return 'Wallapop';
    if (normalizada === 'vinted') return 'Vinted';
    if (normalizada === 'olx') return 'OLX';
    if (normalizada === 'todocoleccion') return 'Todocoleccion';
    if (normalizada === 'whatsapp') return 'WhatsApp';
    return origem;
}

const ESTATISTICAS_ESTADOS_TOTAIS = new Set([
    'pago',
    'em preparacao',
    'enviado',
    'concluido'
]);

function obterEstadoEncomenda(encomenda) {
    const estado = String(encomenda.estado || '').trim();
    if (normalizarTextoEstatisticas(estado) === 'pendente') return 'A aguardar pagamento';
    return estado || 'A aguardar pagamento';
}

function obterEstadoNormalizadoEstatisticas(encomenda) {
    return normalizarTextoEstatisticas(obterEstadoEncomenda(encomenda));
}

function encomendaCancelada(encomenda) {
    return obterEstadoNormalizadoEstatisticas(encomenda) === 'cancelado';
}

function encomendaContaNosTotais(encomenda) {
    return ESTATISTICAS_ESTADOS_TOTAIS.has(obterEstadoNormalizadoEstatisticas(encomenda));
}

function obterProdutosEstatisticas(encomenda) {
    let produtos = encomenda.produtos || encomenda.artigos || [];
    if (typeof produtos === 'string') {
        try { produtos = JSON.parse(produtos); }
        catch (_) { produtos = []; }
    }
    return Array.isArray(produtos) ? produtos : [];
}

function obterQuantidadeItem(item) {
    return Math.max(1, Number(item.quantidade ?? item.qtd ?? 1) || 1);
}

function obterPrecoItem(item) {
    return Number(item.preco_unitario ?? item.preco ?? item.valor_unitario ?? 0) || 0;
}

function obterTotalItensEncomenda(encomenda) {
    return obterProdutosEstatisticas(encomenda).reduce((total, item) => {
        return total + obterQuantidadeItem(item) * obterPrecoItem(item);
    }, 0);
}

function obterTotalEncomenda(encomenda) {
    const total = Number(encomenda.total ?? encomenda.valor_total ?? 0) || 0;
    return total > 0 ? total : obterTotalItensEncomenda(encomenda);
}

function obterNomeFigura(item) {
    return String(item.nome || item.titulo || item.sku || item.referencia || 'Produto sem nome').trim();
}

function obterFiltroData() {
    return {
        periodo: document.getElementById('estatisticas-filtro-periodo').value || 'mes',
        inicio: document.getElementById('estatisticas-data-inicio').value,
        fim: document.getElementById('estatisticas-data-fim').value,
        plataforma: document.getElementById('estatisticas-filtro-plataforma').value,
        canceladas: document.getElementById('estatisticas-filtro-canceladas').value
    };
}

function encomendaDentroDoPeriodo(encomenda, filtro) {
    const chave = filtro.periodo === 'dia' ? obterChaveDia(encomenda) : obterChaveMes(encomenda);
    if (chave === 'Sem data') return true;
    if (filtro.inicio && chave < filtro.inicio) return false;
    if (filtro.fim && chave > filtro.fim) return false;
    return true;
}

function filtrarEncomendasEstatisticas() {
    const filtro = obterFiltroData();
    return estatisticasEncomendas.filter(encomenda => {
        if (!encomendaDentroDoPeriodo(encomenda, filtro)) return false;
        if (filtro.plataforma !== 'todas' && obterPlataformaEncomenda(encomenda) !== filtro.plataforma) return false;
        const cancelada = encomendaCancelada(encomenda);
        if (filtro.canceladas === 'excluir') return encomendaContaNosTotais(encomenda);
        if (filtro.canceladas === 'apenas') return cancelada;
        return encomendaContaNosTotais(encomenda) || cancelada;
    });
}

function adicionarGrupo(mapa, chave, receita = 0, quantidade = 0, encomendas = 0) {
    const atual = mapa.get(chave) || { chave, receita: 0, quantidade: 0, encomendas: 0 };
    atual.receita += receita;
    atual.quantidade += quantidade;
    atual.encomendas += encomendas;
    mapa.set(chave, atual);
    return atual;
}

function adicionarFigura(mapa, item) {
    const quantidade = obterQuantidadeItem(item);
    const preco = obterPrecoItem(item);
    const receita = quantidade * preco;
    const nome = obterNomeFigura(item);
    const atual = mapa.get(nome) || { chave: nome, receita: 0, quantidade: 0, encomendas: 0 };
    atual.receita += receita;
    atual.quantidade += quantidade;
    atual.encomendas += 1;
    mapa.set(nome, atual);
}

function obterFaixaPreco(preco) {
    return ESTATISTICAS_PRECO_FAIXAS.find(faixa => preco >= faixa.min && preco <= faixa.max)?.rotulo || 'Sem preço';
}

function ordenarPorReceita(lista) {
    return [...lista].sort((a, b) => b.receita - a.receita || b.quantidade - a.quantidade || String(a.chave).localeCompare(String(b.chave)));
}

function ordenarPorQuantidade(lista) {
    return [...lista].sort((a, b) => b.quantidade - a.quantidade || b.receita - a.receita || String(a.chave).localeCompare(String(b.chave)));
}

function renderizarBarras(id, itens, opcoes = {}) {
    const container = document.getElementById(id);
    container.replaceChildren();
    const lista = [...itens].filter(item => {
        if (!item) return false;
        if (opcoes.manterZeros) return true;
        return item.receita || item.quantidade || item.encomendas;
    });
    if (!lista.length) {
        container.appendChild(criarElementoEstatisticas('p', 'estatisticas-vazio', 'Sem dados para apresentar.'));
        return;
    }

    const valorCampo = opcoes.valorCampo || 'receita';
    const maximo = Math.max(...lista.map(item => Number(item[valorCampo] || 0)), 1);
    lista.slice(0, opcoes.limite || 12).forEach(item => {
        const valor = Number(item[valorCampo] || 0);
        const linha = criarElementoEstatisticas('div', 'estatisticas-barra');
        const label = criarElementoEstatisticas('span', 'estatisticas-barra-label', opcoes.formatarLabel ? opcoes.formatarLabel(item.chave) : item.chave);
        const trilho = criarElementoEstatisticas('span', 'estatisticas-barra-trilho');
        const preenchimento = criarElementoEstatisticas('span', 'estatisticas-barra-preenchimento');
        const largura = Math.max(0, Math.min(100, Math.ceil(((valor / maximo) * 100) / 5) * 5));
        preenchimento.classList.add(`estatisticas-largura-${largura}`);
        const sufixo = opcoes.valorCampo === 'quantidade'
            ? formatarNumeroEstatisticas(valor)
            : formatarEuroEstatisticas(valor);
        const detalhe = opcoes.mostrarEncomendas
            ? `${sufixo} · ${formatarNumeroEstatisticas(item.encomendas)} enc.`
            : sufixo;
        const valorEl = criarElementoEstatisticas('strong', 'estatisticas-barra-valor', detalhe);
        trilho.appendChild(preenchimento);
        linha.append(label, trilho, valorEl);
        container.appendChild(linha);
    });
}

function renderizarTabela(id, itens, opcoes = {}) {
    const container = document.getElementById(id);
    container.replaceChildren();
    const lista = [...itens].filter(Boolean);
    if (!lista.length) {
        container.appendChild(criarElementoEstatisticas('p', 'estatisticas-vazio', 'Sem dados para apresentar.'));
        return;
    }

    lista.slice(0, opcoes.limite || 10).forEach(item => {
        const linha = criarElementoEstatisticas('div', 'estatisticas-linha');
        linha.append(
            criarElementoEstatisticas('span', '', opcoes.formatarLabel ? opcoes.formatarLabel(item.chave) : item.chave),
            criarElementoEstatisticas('span', '', formatarEuroEstatisticas(item.receita)),
            criarElementoEstatisticas('span', '', `${formatarNumeroEstatisticas(item.quantidade || item.encomendas || 0)} ${opcoes.rotuloQuantidade || 'un.'}`)
        );
        container.appendChild(linha);
    });
}

function calcularEstatisticas(encomendas) {
    const dias = new Map();
    const diasSemana = new Map(ESTATISTICAS_DIAS_SEMANA.map(dia => [dia.chave, { chave: dia.chave, receita: 0, quantidade: 0, encomendas: 0 }]));
    const meses = new Map();
    const anos = new Map();
    const plataformas = new Map();
    const estados = new Map();
    const figuras = new Map();
    const faixasPreco = new Map(ESTATISTICAS_PRECO_FAIXAS.map(faixa => [faixa.rotulo, { chave: faixa.rotulo, receita: 0, quantidade: 0, encomendas: 0 }]));

    let totalVendido = 0;
    let unidadesVendidas = 0;
    let somaPrecoFiguras = 0;

    encomendas.forEach(encomenda => {
        const total = obterTotalEncomenda(encomenda);
        const produtos = obterProdutosEstatisticas(encomenda);
        const quantidadeEncomenda = produtos.reduce((soma, item) => soma + obterQuantidadeItem(item), 0);
        const plataforma = obterPlataformaEncomenda(encomenda);
        const estado = obterEstadoEncomenda(encomenda);
        const diaSemana = obterChaveDiaSemana(encomenda);
        totalVendido += total;
        unidadesVendidas += quantidadeEncomenda;

        adicionarGrupo(dias, obterChaveDia(encomenda), total, quantidadeEncomenda, 1);
        if (diaSemana != null) adicionarGrupo(diasSemana, diaSemana, total, quantidadeEncomenda, 1);
        adicionarGrupo(meses, obterChaveMes(encomenda), total, quantidadeEncomenda, 1);
        adicionarGrupo(anos, obterAnoEncomenda(encomenda), total, quantidadeEncomenda, 1);
        adicionarGrupo(plataformas, plataforma, total, quantidadeEncomenda, 1);
        adicionarGrupo(estados, estado, total, quantidadeEncomenda, 1);

        produtos.forEach(item => {
            const quantidade = obterQuantidadeItem(item);
            const preco = obterPrecoItem(item);
            const receita = quantidade * preco;
            somaPrecoFiguras += receita;
            adicionarFigura(figuras, item);
            adicionarGrupo(faixasPreco, obterFaixaPreco(preco), receita, quantidade, 0);
        });
    });

    return {
        totalVendido,
        unidadesVendidas,
        numeroEncomendas: encomendas.length,
        precoMedioFigura: unidadesVendidas ? somaPrecoFiguras / unidadesVendidas : 0,
        dias: ordenarPorReceita([...dias.values()]).sort((a, b) => String(a.chave).localeCompare(String(b.chave))),
        diasSemana: ESTATISTICAS_DIAS_SEMANA.map(dia => diasSemana.get(dia.chave)),
        meses: ordenarPorReceita([...meses.values()]).sort((a, b) => String(a.chave).localeCompare(String(b.chave))),
        anos: ordenarPorReceita([...anos.values()]).sort((a, b) => String(a.chave).localeCompare(String(b.chave))),
        plataformas: ordenarPorReceita([...plataformas.values()]),
        estados: ordenarPorReceita([...estados.values()]),
        figurasReceita: ordenarPorReceita([...figuras.values()]),
        figurasQuantidade: ordenarPorQuantidade([...figuras.values()]),
        faixasPreco: [...faixasPreco.values()],
        melhoresMeses: ordenarPorReceita([...meses.values()]),
        ticketPlataformas: [...plataformas.values()].sort((a, b) => (b.receita / Math.max(1, b.encomendas)) - (a.receita / Math.max(1, a.encomendas)))
    };
}

function renderizarEstatisticas() {
    const encomendas = filtrarEncomendasEstatisticas();
    const dados = calcularEstatisticas(encomendas);

    document.getElementById('estatisticas-total-vendido').textContent = formatarEuroEstatisticas(dados.totalVendido);
    document.getElementById('estatisticas-numero-encomendas').textContent = formatarNumeroEstatisticas(dados.numeroEncomendas);
    document.getElementById('estatisticas-ticket-medio').textContent = formatarEuroEstatisticas(dados.numeroEncomendas ? dados.totalVendido / dados.numeroEncomendas : 0);
    document.getElementById('estatisticas-unidades').textContent = formatarNumeroEstatisticas(dados.unidadesVendidas);
    document.getElementById('estatisticas-preco-medio-figura').textContent = formatarEuroEstatisticas(dados.precoMedioFigura);

    renderizarBarras('estatisticas-dias', dados.dias, { formatarLabel: formatarDiaEstatisticas, mostrarEncomendas: true, limite: 31 });
    renderizarBarras('estatisticas-dias-semana', dados.diasSemana, { formatarLabel: formatarDiaSemanaEstatisticas, mostrarEncomendas: true, limite: 7, manterZeros: true });
    renderizarBarras('estatisticas-meses', dados.meses, { formatarLabel: formatarMesEstatisticas, mostrarEncomendas: true, limite: 18 });
    renderizarBarras('estatisticas-anos', dados.anos, { mostrarEncomendas: true, limite: 10 });
    renderizarBarras('estatisticas-plataformas', dados.plataformas, { mostrarEncomendas: true, limite: 10 });
    renderizarBarras('estatisticas-faixas-preco', dados.faixasPreco, { valorCampo: 'quantidade', limite: 8 });
    renderizarBarras('estatisticas-estados', dados.estados, { mostrarEncomendas: true, limite: 8 });
    renderizarTabela('estatisticas-top-receita', dados.figurasReceita, { limite: 10 });
    renderizarTabela('estatisticas-top-quantidade', dados.figurasQuantidade, { limite: 10 });
    renderizarTabela('estatisticas-melhores-meses', dados.melhoresMeses.map(item => ({
        ...item,
        quantidade: item.encomendas
    })), { limite: 10, formatarLabel: formatarMesEstatisticas, rotuloQuantidade: 'enc.' });
    renderizarTabela('estatisticas-figuras', dados.figurasReceita, { limite: 100 });
    renderizarTabela('estatisticas-ticket-plataformas', dados.ticketPlataformas.map(item => ({
        ...item,
        receita: item.receita / Math.max(1, item.encomendas),
        quantidade: item.encomendas
    })), { limite: 10, rotuloQuantidade: 'enc.' });
}

function atualizarOpcoesPlataforma() {
    const select = document.getElementById('estatisticas-filtro-plataforma');
    const valorAtual = select.value || 'todas';
    const plataformas = [...new Set(estatisticasEncomendas.map(obterPlataformaEncomenda))].sort((a, b) => a.localeCompare(b));
    select.replaceChildren(new Option('Todas', 'todas'));
    plataformas.forEach(plataforma => select.add(new Option(plataforma, plataforma)));
    select.value = plataformas.includes(valorAtual) ? valorAtual : 'todas';
}

function definirTipoInputPeriodo(periodo) {
    const tipo = periodo === 'dia' ? 'date' : 'month';
    document.getElementById('estatisticas-data-inicio').type = tipo;
    document.getElementById('estatisticas-data-fim').type = tipo;
}

function definirPeriodoInicial() {
    const periodo = document.getElementById('estatisticas-filtro-periodo')?.value || 'mes';
    definirTipoInputPeriodo(periodo);

    if (periodo === 'dia') {
        const hoje = obterChaveDiaAtualEstatisticas();
        document.getElementById('estatisticas-data-inicio').value = hoje;
        document.getElementById('estatisticas-data-fim').value = hoje;
        return;
    }

    const meses = estatisticasEncomendas
        .map(obterChaveMes)
        .filter(chave => /^\d{4}-\d{2}$/.test(chave))
        .sort();
    if (!meses.length) return;
    document.getElementById('estatisticas-data-inicio').value = meses[0];
    document.getElementById('estatisticas-data-fim').value = meses[meses.length - 1];
}

function definirStatusEstatisticas(texto, erro = false) {
    const status = document.getElementById('estatisticas-status');
    status.textContent = texto || '';
    status.classList.toggle('msg-erro', erro);
    status.classList.toggle('msg-sucesso', Boolean(texto) && !erro);
}

async function carregarEncomendasEstatisticas() {
    definirStatusEstatisticas('A carregar estatísticas...');
    const todas = [];
    const tamanhoLote = 1000;
    for (let inicio = 0; ; inicio += tamanhoLote) {
        const { data, error } = await estatisticasClient
            .from('encomendas')
            .select('*')
            .order('created_at', { ascending: false })
            .range(inicio, inicio + tamanhoLote - 1);
        if (error) throw error;
        const lote = data || [];
        todas.push(...lote);
        if (lote.length < tamanhoLote) break;
    }
    estatisticasEncomendas = todas;
    atualizarOpcoesPlataforma();
    definirPeriodoInicial();
    renderizarEstatisticas();
    definirStatusEstatisticas('');
}

async function iniciarEstatisticasAdmin() {
    const bloqueio = document.getElementById('estatisticas-bloqueio');
    try {
        await window.carregarScriptSupabase();
        if (typeof supabase === 'undefined') throw new Error('A biblioteca Supabase não carregou.');
        estatisticasClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data: { user }, error } = await estatisticasClient.auth.getUser();
        if (error || !user || !ADMIN_EMAILS.includes(String(user.email || '').toLowerCase())) {
            bloqueio.textContent = 'Acesso reservado ao administrador. A regressar à conta...';
            setTimeout(() => window.location.replace('conta.html'), 1400);
            return;
        }
        mostrarNavegacaoAdminValidada();
        bloqueio.hidden = true;
        document.getElementById('estatisticas-aplicacao').hidden = false;
        await carregarEncomendasEstatisticas();
    } catch (error) {
        console.error(error);
        bloqueio.hidden = false;
        bloqueio.textContent = 'Erro ao abrir estatísticas: ' + (error.message || 'sem detalhe disponível');
    }
}

document.getElementById('estatisticas-filtro-periodo').addEventListener('change', () => {
    definirPeriodoInicial();
    renderizarEstatisticas();
});
document.getElementById('estatisticas-data-inicio').addEventListener('change', renderizarEstatisticas);
document.getElementById('estatisticas-data-fim').addEventListener('change', renderizarEstatisticas);
document.getElementById('estatisticas-filtro-plataforma').addEventListener('change', renderizarEstatisticas);
document.getElementById('estatisticas-filtro-canceladas').addEventListener('change', renderizarEstatisticas);
document.getElementById('btn-atualizar-estatisticas').addEventListener('click', async () => {
    try { await carregarEncomendasEstatisticas(); }
    catch (error) { definirStatusEstatisticas('Erro ao carregar estatísticas: ' + (error.message || 'sem detalhe'), true); }
});
window.addEventListener('load', iniciarEstatisticasAdmin);
