const ESTATISTICAS_DIAS_SEMANA = [
    { chave: 1, rotulo: "Segunda-feira" },
    { chave: 2, rotulo: "Terça-feira" },
    { chave: 3, rotulo: "Quarta-feira" },
    { chave: 4, rotulo: "Quinta-feira" },
    { chave: 5, rotulo: "Sexta-feira" },
    { chave: 6, rotulo: "Sábado" },
    { chave: 7, rotulo: "Domingo" }
];

const ESTATISTICAS_MESES_ANO = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
];

let estatisticasClient = null;
let estatisticasEncomendas = [];
let estatisticasCustosProdutos = new Map();
let estatisticasProdutos = [];
let estatisticasEntradasProdutos = new Map();
// Contexto usado pela ficha do produto (mapas-produto-modal.js), carregada so quando e preciso.
var mapasClient = null;
var mapasProdutos = [];
var mapasEncomendasFornecedorCache = null;
var mapasEncomendasFornecedorPromessa = null;
var mapasVendasClienteCache = null;
var mapasVendasClientePromessa = null;
var MAPAS_FORNECEDORES_STORAGE_KEY = 'figures-planet-fornecedores-pedidos';

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

function capitalizarPrimeiraLetraEstatisticas(texto) {
    const valor = String(texto || '');
    return valor ? valor.charAt(0).toUpperCase() + valor.slice(1) : valor;
}

function formatarMesEstatisticas(chave) {
    const partes = String(chave || '').split('-');
    if (partes.length !== 2) return chave || 'Sem data';
    const data = new Date(Number(partes[0]), Number(partes[1]) - 1, 1);
    if (Number.isNaN(data.getTime())) return chave;
    return capitalizarPrimeiraLetraEstatisticas(new Intl.DateTimeFormat('pt-PT', { month: 'short', year: 'numeric' }).format(data));
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

function obterIdProdutoItem(item) {
    return String(item?.id_produto ?? item?.produto_id ?? item?.id ?? '').trim();
}

// Custo de uma unidade: o gravado na venda (custo_unitario) ou, para vendas antigas, o preco de compra atual.
function obterCustoItemEstatisticas(item) {
    const gravado = Number(item?.custo_unitario);
    if (Number.isFinite(gravado) && gravado > 0) return { custo: gravado, estimado: false };
    const atual = Number(estatisticasCustosProdutos.get(obterIdProdutoItem(item)));
    if (Number.isFinite(atual) && atual > 0) return { custo: atual, estimado: true };
    return null;
}

function obterTotalItensEncomenda(encomenda) {
    return obterProdutosEstatisticas(encomenda).reduce((total, item) => {
        return total + obterQuantidadeItem(item) * obterPrecoItem(item);
    }, 0);
}

function obterTotalComPortesEncomenda(encomenda) {
    const total = Number(encomenda.total ?? encomenda.valor_total ?? 0) || 0;
    return total > 0 ? total : obterTotalItensEncomenda(encomenda);
}

function obterTotalEncomenda(encomenda, filtro = {}) {
    if (filtro.total === 'com-portes') return obterTotalComPortesEncomenda(encomenda);
    return obterTotalItensEncomenda(encomenda);
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
        total: document.getElementById('estatisticas-filtro-total')?.value || 'sem-portes'
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
        return encomendaContaNosTotais(encomenda);
    });
}

function filtrarEncomendasComparacaoAnos() {
    const filtro = obterFiltroData();
    return estatisticasEncomendas.filter(encomenda => {
        if (filtro.plataforma !== 'todas' && obterPlataformaEncomenda(encomenda) !== filtro.plataforma) return false;
        return encomendaContaNosTotais(encomenda);
    });
}

function obterAnosDisponiveisComparacao(encomendas) {
    return [...new Set(encomendas
        .map(obterAnoEncomenda)
        .filter(ano => /^\d{4}$/.test(String(ano))))]
        .sort((a, b) => Number(a) - Number(b));
}

function obterAnosSelecionadosComparacao(anosDisponiveis) {
    const marcados = [...document.querySelectorAll('#estatisticas-comparar-anos input[type="checkbox"]:checked')]
        .map(input => input.value)
        .filter(ano => anosDisponiveis.includes(ano));
    if (marcados.length) return marcados.sort((a, b) => Number(a) - Number(b));
    return anosDisponiveis.slice(-Math.min(3, anosDisponiveis.length));
}

function atualizarOpcoesComparacaoAnos(anosDisponiveis) {
    const container = document.getElementById('estatisticas-comparar-anos');
    const selecionadosAtuais = new Set([...container.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value));
    const selecaoInicial = new Set(selecionadosAtuais.size
        ? [...selecionadosAtuais].filter(ano => anosDisponiveis.includes(ano))
        : anosDisponiveis.slice(-Math.min(3, anosDisponiveis.length)));

    container.replaceChildren();
    if (!anosDisponiveis.length) {
        container.appendChild(criarElementoEstatisticas('span', 'estatisticas-anos-vazio', 'Sem anos'));
        return;
    }

    anosDisponiveis.forEach(ano => {
        const label = criarElementoEstatisticas('label', 'estatisticas-ano-opcao');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = ano;
        input.checked = selecaoInicial.has(ano);
        input.addEventListener('change', renderizarEstatisticas);
        label.append(input, criarElementoEstatisticas('span', '', ano));
        container.appendChild(label);
    });
}

function calcularComparacaoMensalAnos(encomendas, anosSelecionados, filtro) {
    const dados = ESTATISTICAS_MESES_ANO.map((mes, indice) => ({
        mes,
        indice,
        anos: anosSelecionados.map(ano => ({ ano, receita: 0, quantidade: 0, encomendas: 0 }))
    }));
    const indiceAno = new Map();
    dados.forEach(linha => linha.anos.forEach(item => {
        indiceAno.set(`${item.ano}-${linha.indice}`, item);
    }));

    encomendas.forEach(encomenda => {
        const data = obterDataEncomenda(encomenda);
        if (!data) return;
        const ano = String(data.getFullYear());
        if (!anosSelecionados.includes(ano)) return;
        const alvo = indiceAno.get(`${ano}-${data.getMonth()}`);
        if (!alvo) return;
        const produtos = obterProdutosEstatisticas(encomenda);
        alvo.receita += obterTotalEncomenda(encomenda, filtro);
        alvo.quantidade += produtos.reduce((soma, item) => soma + obterQuantidadeItem(item), 0);
        alvo.encomendas += 1;
    });

    return dados;
}

function renderizarComparacaoMensalAnos(encomendasBase, filtro) {
    const anosDisponiveis = obterAnosDisponiveisComparacao(encomendasBase);
    atualizarOpcoesComparacaoAnos(anosDisponiveis);
    const container = document.getElementById('estatisticas-comparacao-meses');
    container.replaceChildren();
    const anosSelecionados = obterAnosSelecionadosComparacao(anosDisponiveis);
    if (!anosSelecionados.length) {
        container.appendChild(criarElementoEstatisticas('p', 'estatisticas-vazio', 'Seleciona pelo menos um ano.'));
        return;
    }

    const dados = calcularComparacaoMensalAnos(encomendasBase, anosSelecionados, filtro);
    const maximo = Math.max(...dados.flatMap(linha => linha.anos.map(item => item.receita)), 1);
    dados.forEach(linha => {
        const grupo = criarElementoEstatisticas('div', 'estatisticas-comparacao-grupo');
        grupo.appendChild(criarElementoEstatisticas('strong', 'estatisticas-comparacao-mes', linha.mes));
        const barras = criarElementoEstatisticas('div', 'estatisticas-comparacao-barras');
        linha.anos.forEach(item => {
            const barra = criarElementoEstatisticas('div', 'estatisticas-comparacao-barra');
            const trilho = criarElementoEstatisticas('span', 'estatisticas-comparacao-trilho');
            const preenchimento = criarElementoEstatisticas('span', 'estatisticas-comparacao-preenchimento');
            const largura = Math.max(0, Math.min(100, Math.ceil(((item.receita / maximo) * 100) / 5) * 5));
            preenchimento.classList.add(`estatisticas-largura-${largura}`);
            trilho.appendChild(preenchimento);
            barra.append(
                criarElementoEstatisticas('span', 'estatisticas-comparacao-ano', item.ano),
                trilho,
                criarElementoEstatisticas('span', 'estatisticas-comparacao-valor', `${formatarEuroEstatisticas(item.receita)} · ${formatarNumeroEstatisticas(item.encomendas)} enc.`)
            );
            barras.appendChild(barra);
        });
        grupo.appendChild(barras);
        container.appendChild(grupo);
    });
}

function adicionarLucro(mapa, chave, receita, custo) {
    const atual = mapa.get(chave) || { chave, receita: 0, custo: 0, lucro: 0, quantidade: 0, encomendas: 0 };
    atual.receita += receita;
    atual.custo += custo;
    atual.lucro = atual.receita - atual.custo;
    mapa.set(chave, atual);
    return atual;
}

function formatarMargemEstatisticas(lucro, receita) {
    if (!receita) return '0 %';
    return `${(lucro / receita * 100).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} %`;
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
        return item.receita || item.quantidade || item.encomendas || item.lucro;
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
        const detalhe = opcoes.formatarDetalhe
            ? opcoes.formatarDetalhe(item)
            : opcoes.mostrarEncomendas
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

function calcularEstatisticas(encomendas, filtro = {}) {
    const dias = new Map();
    const diasSemana = new Map(ESTATISTICAS_DIAS_SEMANA.map(dia => [dia.chave, { chave: dia.chave, receita: 0, quantidade: 0, encomendas: 0 }]));
    const meses = new Map();
    const anos = new Map();
    const plataformas = new Map();
    const estados = new Map();
    const figuras = new Map();

    const lucroMeses = new Map();
    const lucroPlataformas = new Map();
    const lucroFiguras = new Map();

    let totalVendido = 0;
    let unidadesVendidas = 0;
    let somaPrecoFiguras = 0;
    let lucroReceita = 0;
    let lucroCusto = 0;
    let custoEstimado = 0;
    let unidadesSemCusto = 0;
    let receitaSemCusto = 0;

    encomendas.forEach(encomenda => {
        const total = obterTotalEncomenda(encomenda, filtro);
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

            const custoItem = obterCustoItemEstatisticas(item);
            if (!custoItem) {
                unidadesSemCusto += quantidade;
                receitaSemCusto += receita;
                return;
            }
            const custo = quantidade * custoItem.custo;
            lucroReceita += receita;
            lucroCusto += custo;
            if (custoItem.estimado) custoEstimado += custo;
            adicionarLucro(lucroMeses, obterChaveMes(encomenda), receita, custo).quantidade += quantidade;
            adicionarLucro(lucroPlataformas, plataforma, receita, custo).quantidade += quantidade;
            adicionarLucro(lucroFiguras, obterNomeFigura(item), receita, custo).quantidade += quantidade;
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
        melhoresMeses: ordenarPorReceita([...meses.values()]),
        lucro: {
            receita: lucroReceita,
            custo: lucroCusto,
            lucro: lucroReceita - lucroCusto,
            custoEstimado,
            unidadesSemCusto,
            receitaSemCusto,
            meses: [...lucroMeses.values()].sort((a, b) => String(a.chave).localeCompare(String(b.chave))),
            plataformas: [...lucroPlataformas.values()].sort((a, b) => b.lucro - a.lucro),
            figuras: [...lucroFiguras.values()].sort((a, b) => b.lucro - a.lucro || b.quantidade - a.quantidade)
        },
        ticketPlataformas: [...plataformas.values()].sort((a, b) => (b.receita / Math.max(1, b.encomendas)) - (a.receita / Math.max(1, a.encomendas)))
    };
}

function renderizarEstatisticas() {
    const filtro = obterFiltroData();
    const encomendas = filtrarEncomendasEstatisticas();
    const encomendasComparacao = filtrarEncomendasComparacaoAnos();
    const dados = calcularEstatisticas(encomendas, filtro);

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
    renderizarBarras('estatisticas-estados', dados.estados, { mostrarEncomendas: true, limite: 8 });
    renderizarTabela('estatisticas-top-receita', dados.figurasReceita, { limite: 10 });
    renderizarTabela('estatisticas-top-quantidade', dados.figurasQuantidade, { limite: 10 });
    renderizarTabela('estatisticas-melhores-meses', dados.melhoresMeses.map(item => ({
        ...item,
        quantidade: item.encomendas
    })), { limite: 10, formatarLabel: formatarMesEstatisticas, rotuloQuantidade: 'enc.' });
    renderizarTabela('estatisticas-ticket-plataformas', dados.ticketPlataformas.map(item => ({
        ...item,
        receita: item.receita / Math.max(1, item.encomendas),
        quantidade: item.encomendas
    })), { limite: 10, rotuloQuantidade: 'enc.' });
    renderizarComparacaoMensalAnos(encomendasComparacao, filtro);
    renderizarLucroEstatisticas(dados.lucro);
    renderizarStockParadoEstatisticas(filtro);
}

function valorBooleanoEstatisticas(valor) {
    if (typeof valor === 'boolean') return valor;
    return ['sim', 'true', '1', 'yes', 'ativo'].includes(normalizarTextoEstatisticas(valor));
}

function obterDataValidaEstatisticas(valor) {
    if (!valor) return null;
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? null : data;
}

// Ultima entrada de cada figura em stock: data de rececao nas encomendas a fornecedores.
async function carregarEntradasProdutosEstatisticas() {
    const entradas = new Map();
    try {
        const { data, error } = await estatisticasClient.rpc('listar_encomendas_fornecedores_admin');
        if (error) throw error;
        (Array.isArray(data) ? data : []).forEach(pedido => {
            const dataPedido = obterDataValidaEstatisticas(pedido?.atualizado_em || pedido?.data_encomendada || pedido?.criado_em);
            let itens = pedido?.itens || [];
            if (typeof itens === 'string') {
                try { itens = JSON.parse(itens); } catch (_) { itens = []; }
            }
            (Array.isArray(itens) ? itens : []).forEach(item => {
                if (!(Number(item?.recebido) > 0)) return;
                const dataEntrada = obterDataValidaEstatisticas(item?.data_recebida || item?.recebido_em) || dataPedido;
                if (!dataEntrada) return;
                [String(item?.id || '').trim(), `ref:${String(item?.referencia || '').trim().toUpperCase()}`].forEach(chave => {
                    if (!chave || chave === 'ref:') return;
                    const atual = entradas.get(chave);
                    if (!atual || dataEntrada > atual) entradas.set(chave, dataEntrada);
                });
            });
        });
    } catch (erro) {
        console.warn('Entradas de stock indisponíveis (encomendas a fornecedores).', erro);
    }
    estatisticasEntradasProdutos = entradas;
}

function obterUltimasVendasEstatisticas(filtro) {
    const porId = new Map();
    const porNome = new Map();
    estatisticasEncomendas.forEach(encomenda => {
        if (!encomendaContaNosTotais(encomenda)) return;
        if (filtro.plataforma !== 'todas' && obterPlataformaEncomenda(encomenda) !== filtro.plataforma) return;
        const data = obterDataEncomenda(encomenda);
        if (!data) return;
        obterProdutosEstatisticas(encomenda).forEach(item => {
            const id = obterIdProdutoItem(item);
            if (id && (!porId.get(id) || data > porId.get(id))) porId.set(id, data);
            const nome = normalizarTextoEstatisticas(obterNomeFigura(item));
            if (nome && (!porNome.get(nome) || data > porNome.get(nome))) porNome.set(nome, data);
        });
    });
    return { porId, porNome };
}

function renderizarStockParadoEstatisticas(filtro) {
    const container = document.getElementById('estatisticas-parado-lista');
    const resumo = document.getElementById('estatisticas-parado-resumo');
    if (!container || !resumo) return;
    container.replaceChildren();
    if (!estatisticasProdutos.length) {
        resumo.textContent = '';
        container.appendChild(criarElementoEstatisticas('p', 'estatisticas-vazio', 'Não foi possível carregar os produtos.'));
        return;
    }

    const dias = Number(document.getElementById('estatisticas-parado-dias')?.value || 90) || 90;
    const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    const { porId, porNome } = obterUltimasVendasEstatisticas(filtro);

    const parados = estatisticasProdutos.map(produto => {
        const stock = Math.floor(Number(produto?.stock) || 0);
        if (stock <= 0) return null;
        if (valorBooleanoEstatisticas(produto?.arquivado) || valorBooleanoEstatisticas(produto?.descontinuado)) return null;
        if (produto?.ativo === false) return null;
        const id = String(produto?.id ?? '');
        const ultimaVenda = porId.get(id) || porNome.get(normalizarTextoEstatisticas(produto?.nome)) || null;
        if (ultimaVenda && ultimaVenda >= limite) return null;
        const entrada = estatisticasEntradasProdutos.get(id)
            || estatisticasEntradasProdutos.get(`ref:${String(produto?.referencia || '').trim().toUpperCase()}`)
            || null;
        // Figura que entrou em stock ha menos tempo do que o periodo ainda nao conta como parada.
        if (entrada && entrada >= limite) return null;
        const custo = Number(produto?.preco_compra) > 0 ? Number(produto.preco_compra) : 0;
        return { produto, stock, ultimaVenda, custo, valor: stock * custo };
    }).filter(Boolean).sort((a, b) => b.valor - a.valor || b.stock - a.stock || String(a.produto.nome).localeCompare(String(b.produto.nome), 'pt'));

    const unidades = parados.reduce((soma, item) => soma + item.stock, 0);
    const valor = parados.reduce((soma, item) => soma + item.valor, 0);
    resumo.textContent = parados.length
        ? `${formatarNumeroEstatisticas(parados.length)} ${parados.length === 1 ? 'figura' : 'figuras'} · ${formatarNumeroEstatisticas(unidades)} un. · ${formatarEuroEstatisticas(valor)} parados`
        : '';
    if (!parados.length) {
        container.appendChild(criarElementoEstatisticas('p', 'estatisticas-vazio', `Nenhuma figura com stock sem vendas há mais de ${dias} dias.`));
        return;
    }

    const cabecalho = criarElementoEstatisticas('div', 'estatisticas-parado-linha estatisticas-parado-cabecalho');
    cabecalho.append(
        criarElementoEstatisticas('span', '', 'Figura'),
        criarElementoEstatisticas('span', '', 'Stock'),
        criarElementoEstatisticas('span', '', 'Última venda'),
        criarElementoEstatisticas('span', '', 'Valor parado')
    );
    container.appendChild(cabecalho);
    const formatoData = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    parados.forEach(item => {
        const linha = criarElementoEstatisticas('div', 'estatisticas-parado-linha');
        const nome = criarElementoEstatisticas('button', 'estatisticas-parado-nome', item.produto.nome || 'Produto sem nome');
        nome.type = 'button';
        nome.title = 'Abrir a ficha da figura';
        nome.addEventListener('click', () => abrirFichaProdutoEstatisticas(item.produto));
        linha.append(
            nome,
            criarElementoEstatisticas('span', '', formatarNumeroEstatisticas(item.stock)),
            criarElementoEstatisticas('span', item.ultimaVenda ? '' : 'estatisticas-parado-nunca', item.ultimaVenda ? formatoData.format(item.ultimaVenda) : 'Nunca vendida'),
            criarElementoEstatisticas('span', '', item.custo ? formatarEuroEstatisticas(item.valor) : '—')
        );
        container.appendChild(linha);
    });
}

function normalizarProdutoFichaEstatisticas(produto) {
    let imagens = produto?.imagens || [];
    if (typeof imagens === 'string') {
        try { imagens = JSON.parse(imagens); } catch (_) { imagens = imagens.split(',').map(valor => valor.trim()); }
    }
    return {
        ...produto,
        preco: Number(produto?.preco || 0),
        preco_compra: Number(produto?.preco_compra || 0),
        arquivado: valorBooleanoEstatisticas(produto?.arquivado),
        descontinuado: valorBooleanoEstatisticas(produto?.descontinuado),
        novidade: valorBooleanoEstatisticas(produto?.novidade),
        peso: Number(produto?.peso || 10),
        stock: Math.floor(Number(produto?.stock) || 0),
        unidades_por_embalagem: Math.max(1, Math.floor(Number(produto?.unidades_por_embalagem) || 1)),
        ativo: produto?.ativo !== false,
        imagens: Array.isArray(imagens) ? imagens.filter(Boolean) : [],
        fornecedores: produto?.fornecedores || {}
    };
}

let promessaFichaProdutoEstatisticas = null;

function carregarRecursoEstatisticas(tipo, src) {
    return new Promise((resolve, reject) => {
        const elemento = document.createElement(tipo === 'css' ? 'link' : 'script');
        if (tipo === 'css') {
            elemento.rel = 'stylesheet';
            elemento.href = src;
        } else {
            elemento.src = src;
        }
        elemento.onload = () => resolve();
        elemento.onerror = () => reject(new Error('Falha ao carregar ' + src));
        document.head.appendChild(elemento);
    });
}

function garantirFichaProdutoEstatisticas() {
    mapasClient = estatisticasClient;
    if (window.MapasProdutoModal) return Promise.resolve();
    if (!promessaFichaProdutoEstatisticas) {
        promessaFichaProdutoEstatisticas = Promise.all([
            carregarRecursoEstatisticas('css', 'fornecedores-mapas.css?v=20261008-colunas-largas'),
            carregarRecursoEstatisticas('js', 'mapas-produto-modal.js?v=20261008-nao-comprar')
        ]).catch(erro => {
            promessaFichaProdutoEstatisticas = null;
            throw erro;
        });
    }
    return promessaFichaProdutoEstatisticas;
}

async function abrirFichaProdutoEstatisticas(produto) {
    try {
        await garantirFichaProdutoEstatisticas();
        mapasClient = estatisticasClient;
        if (!mapasProdutos.length) mapasProdutos = estatisticasProdutos.map(normalizarProdutoFichaEstatisticas);
        await window.MapasProdutoModal.abrirFicha(produto.id);
    } catch (erro) {
        console.warn('Não foi possível abrir a ficha do produto.', erro);
        definirStatusEstatisticas('Erro ao abrir a ficha: ' + (erro?.message || 'sem detalhe'), true);
    }
}

function renderizarLucroEstatisticas(lucro) {
    document.getElementById('estatisticas-lucro-receita').textContent = formatarEuroEstatisticas(lucro.receita);
    document.getElementById('estatisticas-lucro-custo').textContent = formatarEuroEstatisticas(lucro.custo);
    const total = document.getElementById('estatisticas-lucro-total');
    total.textContent = formatarEuroEstatisticas(lucro.lucro);
    total.classList.toggle('negativo', lucro.lucro < 0);
    document.getElementById('estatisticas-lucro-margem').textContent = formatarMargemEstatisticas(lucro.lucro, lucro.receita);

    const avisos = [];
    if (lucro.unidadesSemCusto) {
        avisos.push(`${formatarNumeroEstatisticas(lucro.unidadesSemCusto)} ${lucro.unidadesSemCusto === 1 ? 'unidade vendida' : 'unidades vendidas'} sem preço de compra (${formatarEuroEstatisticas(lucro.receitaSemCusto)}) ${lucro.unidadesSemCusto === 1 ? 'fica' : 'ficam'} fora do lucro.`);
    }
    if (lucro.custoEstimado > 0.005) {
        avisos.push(`${formatarEuroEstatisticas(lucro.custoEstimado)} do custo é estimado com o preço de compra atual (vendas registadas antes de o custo ser guardado na venda).`);
    }
    const aviso = document.getElementById('estatisticas-lucro-aviso');
    aviso.textContent = avisos.join(' ');
    aviso.hidden = !avisos.length;

    const detalheLucro = item => `${formatarEuroEstatisticas(item.lucro)} · ${formatarMargemEstatisticas(item.lucro, item.receita)}`;
    renderizarBarras('estatisticas-lucro-meses', lucro.meses, { valorCampo: 'lucro', formatarLabel: formatarMesEstatisticas, formatarDetalhe: detalheLucro, limite: 18 });
    renderizarBarras('estatisticas-lucro-plataformas', lucro.plataformas, { valorCampo: 'lucro', formatarDetalhe: detalheLucro, limite: 10 });

    const container = document.getElementById('estatisticas-top-lucro');
    container.replaceChildren();
    if (!lucro.figuras.length) {
        container.appendChild(criarElementoEstatisticas('p', 'estatisticas-vazio', 'Sem dados para apresentar.'));
        return;
    }
    lucro.figuras.slice(0, 10).forEach(item => {
        const linha = criarElementoEstatisticas('div', 'estatisticas-linha');
        const valor = criarElementoEstatisticas('span', item.lucro < 0 ? 'negativo' : '', formatarEuroEstatisticas(item.lucro));
        linha.append(
            criarElementoEstatisticas('span', '', item.chave),
            valor,
            criarElementoEstatisticas('span', '', `${formatarMargemEstatisticas(item.lucro, item.receita)} · ${formatarNumeroEstatisticas(item.quantidade)} un.`)
        );
        container.appendChild(linha);
    });
}

async function carregarCustosProdutosEstatisticas() {
    const custos = new Map();
    for (const nomeRpc of ['listar_produtos_mapas_admin', 'listar_produtos_admin']) {
        const produtos = [];
        try {
            custos.clear();
            const tamanhoPagina = 500;
            for (let inicio = 0; ; inicio += tamanhoPagina) {
                const { data, error } = await estatisticasClient.rpc(nomeRpc, { p_limite: tamanhoPagina, p_offset: inicio });
                if (error) throw error;
                const pagina = Array.isArray(data) ? data : [];
                pagina.forEach(produto => {
                    const custo = Number(produto?.preco_compra);
                    if (produto?.id != null && Number.isFinite(custo) && custo > 0) custos.set(String(produto.id), custo);
                });
                produtos.push(...pagina);
                if (pagina.length < tamanhoPagina) break;
            }
            estatisticasCustosProdutos = custos;
            estatisticasProdutos = produtos;
            return;
        } catch (erro) {
            console.warn(`Custos dos produtos indisponíveis (${nomeRpc}).`, erro);
        }
    }
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
    await Promise.all([carregarCustosProdutosEstatisticas(), carregarEntradasProdutosEstatisticas()]);
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
        const user = await validarAdminRapido(estatisticasClient, bloqueio);
        if (!user) return;
        if (typeof window.mostrarNavegacaoAdminValidada === 'function') window.mostrarNavegacaoAdminValidada(); else document.addEventListener('DOMContentLoaded', () => window.mostrarNavegacaoAdminValidada?.(), { once: true });
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
document.getElementById('estatisticas-filtro-total').addEventListener('change', renderizarEstatisticas);
document.getElementById('estatisticas-parado-dias')?.addEventListener('change', () => renderizarStockParadoEstatisticas(obterFiltroData()));
document.getElementById('btn-atualizar-estatisticas').addEventListener('click', async () => {
    try { await carregarEncomendasEstatisticas(); }
    catch (error) { definirStatusEstatisticas('Erro ao carregar estatísticas: ' + (error.message || 'sem detalhe'), true); }
});
window.addEventListener('load', iniciarEstatisticasAdmin);
