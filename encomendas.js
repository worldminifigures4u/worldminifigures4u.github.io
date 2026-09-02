
const ENCOMENDAS_ANEXOS_BUCKET = 'anexos-encomendas';
const ENCOMENDAS_ANEXO_MAX_BYTES = 10 * 1024 * 1024;
const ENCOMENDAS_ANEXO_TIPOS_PERMITIDOS = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
]);
const ENCOMENDAS_ESTADO_INICIAL = 'A aguardar pagamento';
const ESTADOS_ENCOMENDA = [
    'A aguardar pagamento',
    'Pago',
    'Em preparação',
    'Enviado',
    'Concluído',
    'Devolvido',
    'Cancelado'
];
const ENCOMENDAS_CONCLUIDAS_POR_PAGINA = 60;

let encomendasClient = null;
let encomendasAdmin = [];
let carregamentoComplementarEncomendasId = 0;
let carregamentoImagensModalId = 0;
let totalConcluidasServidor = null;
let carregandoMaisConcluidas = false;
let todasConcluidasCarregadas = false;
let encomendasSelecionadasLote = new Set();
let promessaFichaClienteEncomendas = null;
let fichaClienteEncomendasConfigurada = false;

const ENCOMENDAS_SEM_IMAGEM = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" fill="#222"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#888" font-family="Arial" font-size="13">Sem foto</text></svg>'
);

function normalizarEncomenda(valor) {
    return AdminEncomendaVista.normalizar(valor);
}

function obterClassePlataformaEncomenda(origem) {
    const normalizada = normalizarEncomenda(origem).replace(/\s+/g, '-');
    return normalizada ? ` plataforma-${normalizada}` : '';
}

function formatarEuroEncomenda(valor) {
    return AdminEncomendaVista.formatarEuro(valor);
}

function formatarDataEncomenda(valor) {
    return AdminEncomendaVista.formatarData(valor);
}

function estadoNormalizadoEncomenda(estado) {
    return AdminEncomendaVista.estadoNormalizado(estado);
}

function obterNomeTituloEncomendaAdmin(encomenda) {
    return AdminEncomendaVista.obterNomeTituloEncomenda(encomenda);
}

function definirStatusEncomendas(texto, estado = false) {
    const status = document.getElementById('status-encomendas-admin');
    const erro = estado === true || estado === 'erro';
    const processando = estado === 'processando';
    status.textContent = texto || '';
    status.classList.toggle('msg-erro', erro);
    status.classList.toggle('msg-processando', Boolean(texto) && processando);
    status.classList.toggle('msg-sucesso', Boolean(texto) && !erro && !processando);
    if (texto) {
        status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function criarElementoEncomenda(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function abrirImagemProdutoEncomenda(url, nome) {
    AdminEncomendaVista.abrirImagemProduto(url, nome);
}

function fecharImagemProdutoEncomenda() {
    AdminEncomendaVista.fecharImagemProduto();
}

function configurarVistaEncomendasAdmin() {
    AdminEncomendaVista.configurar({
        client: encomendasClient,
        hooks: {
            definirStatus: definirStatusEncomendas,
            renderizarLista: renderizarEncomendasAdmin,
            renderizarModal: () => {},
            atualizarResumo: atualizarResumoEncomendas,
            obterLista: () => encomendasAdmin,
            definirLista: lista => { encomendasAdmin = lista; },
            onEncomendaApagada: () => {}
        }
    });
}

function carregarScriptEncomendasAdmin(src) {
    return new Promise((resolve, reject) => {
        const existente = document.querySelector(`script[data-encomendas-chunk="${src}"]`);
        if (existente) {
            if (existente.dataset.loaded === '1') return resolve();
            existente.addEventListener('load', () => resolve());
            existente.addEventListener('error', () => reject(new Error('Falha ao carregar ' + src)));
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.defer = true;
        script.dataset.encomendasChunk = src;
        script.onload = () => {
            script.dataset.loaded = '1';
            resolve();
        };
        script.onerror = () => reject(new Error('Falha ao carregar ' + src));
        document.body.appendChild(script);
    });
}

function configurarFichaClienteEncomendas() {
    if (!window.AdminFichaCliente) return;
    window.AdminFichaCliente.configurar({
        client: encomendasClient,
        formatarEuro: valor => Number(valor || 0).toFixed(2).replace('.', ','),
        formatarData: formatarDataEncomenda
    });
    window.AdminFichaCliente.initEventos();
    fichaClienteEncomendasConfigurada = true;
}

function garantirFichaClienteEncomendas() {
    if (window.AdminFichaCliente) {
        if (!fichaClienteEncomendasConfigurada) configurarFichaClienteEncomendas();
        return Promise.resolve();
    }
    if (!promessaFichaClienteEncomendas) {
        promessaFichaClienteEncomendas = carregarScriptEncomendasAdmin('admin-ficha-cliente.js?v=20260902-notas-unificadas')
            .then(() => configurarFichaClienteEncomendas());
    }
    return promessaFichaClienteEncomendas;
}

async function abrirFichaClienteAdmin(encomenda) {
    try {
        await garantirFichaClienteEncomendas();
        const abriu = await window.AdminFichaCliente?.abrirPorEncomenda(String(encomenda.id));
        if (!abriu) definirStatusEncomendas('Não foi possível abrir a ficha do cliente.', true);
    } catch (error) {
        definirStatusEncomendas('Erro ao abrir ficha: ' + (error?.message || 'sem detalhe'), true);
    }
}

function criarCardEncomenda(encomenda) {
    const card = AdminEncomendaVista.criarCardEncomenda(encomenda, {
        abrirCliente: abrirFichaClienteAdmin,
        abrirEncomenda: abrirModalEncomendaAdmin
    });
    acrescentarSelecaoLoteEncomenda(card, encomenda);
    return card;
}

function podeSelecionarEncomendaLote(encomenda) {
    return estadoNormalizadoEncomenda(encomenda?.estado) === 'Enviado'
        && document.getElementById('filtro-estado-encomendas-admin')?.value === 'Enviado'
        && !obterTermoPesquisaFiguraAdmin();
}

function acrescentarSelecaoLoteEncomenda(card, encomenda) {
    if (!podeSelecionarEncomendaLote(encomenda)) return;
    const linha = card.querySelector('.admin-encomenda-linha');
    if (!linha) return;

    const id = String(encomenda.id);
    const controlo = criarElementoEncomenda('label', 'admin-encomenda-selecao-lote');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = encomendasSelecionadasLote.has(id);
    input.setAttribute('aria-label', `Selecionar encomenda ${encomenda.codigo_encomenda || id}`);
    input.addEventListener('click', evento => evento.stopPropagation());
    input.addEventListener('keydown', evento => evento.stopPropagation());
    input.addEventListener('change', evento => {
        evento.stopPropagation();
        if (input.checked) encomendasSelecionadasLote.add(id);
        else encomendasSelecionadasLote.delete(id);
        atualizarAcoesLoteEncomendas();
    });
    controlo.addEventListener('click', evento => evento.stopPropagation());
    controlo.appendChild(input);
    linha.classList.add('admin-encomenda-linha-com-selecao');
    linha.prepend(controlo);
}

function fecharModalEncomendaAdmin() {
    const modal = document.getElementById('admin-encomenda-modal');
    const conteudo = document.getElementById('admin-encomenda-modal-conteudo');
    if (!modal || !conteudo) return;
    carregamentoImagensModalId += 1;
    conteudo.querySelector('.admin-encomenda-card')?._limparAlturaNotas?.();
    modal.hidden = true;
    conteudo.replaceChildren();
    document.body.classList.remove('admin-encomenda-modal-aberto');
}

function abrirModalEncomendaAdmin(encomenda) {
    const carregamentoId = ++carregamentoImagensModalId;
    const modal = document.getElementById('admin-encomenda-modal');
    const conteudo = document.getElementById('admin-encomenda-modal-conteudo');
    const titulo = document.getElementById('admin-encomenda-modal-titulo');
    if (!modal || !conteudo) return;

    const renderizarModal = () => conteudo.replaceChildren(AdminEncomendaVista.criarCardEncomenda(encomenda, {
        modoModal: true,
        abrirCliente: abrirFichaClienteAdmin,
        fecharAoAlterarEstado: fecharModalEncomendaAdmin,
        fecharAoConcluir: fecharModalEncomendaAdmin,
        fecharAoPagar: fecharModalEncomendaAdmin
    }));

    renderizarModal();
    if (titulo) titulo.textContent = `Encomenda ${encomenda.codigo_encomenda || encomenda.id || ''}`.trim();
    modal.hidden = false;
    document.body.classList.add('admin-encomenda-modal-aberto');
    document.getElementById('admin-encomenda-modal-fechar')?.focus();
    AdminEncomendaVista.carregarImagensParaEncomendas([encomenda])
        .then(() => {
            if (carregamentoId !== carregamentoImagensModalId || modal.hidden) return;
            AdminEncomendaVista.atualizarMiniaturasProdutos(conteudo);
        })
        .catch(error => console.warn('Imagens da encomenda indisponiveis.', error));
}

function obterUrlPerfilEncomenda(encomenda) {
    return String(encomenda.perfil_externo_url || encomenda.link_perfil || '').trim();
}

function precisaNomeUtilizadorFicha(encomenda) {
    return Boolean(
        obterUrlPerfilEncomenda(encomenda)
        && !encomenda?.clientes_gestao?.nome_utilizador
        && !encomenda?.cliente_gestao?.nome_utilizador
    );
}

async function preencherNomeUtilizadorPorPerfil(encomenda) {
    const urlPerfil = obterUrlPerfilEncomenda(encomenda);
    if (!urlPerfil) return;
    try {
        const { data, error } = await encomendasClient.rpc('obter_ficha_cliente_por_perfil_admin', {
            p_url_perfil: urlPerfil
        });
        const cliente = data?.cliente;
        if (error || data?.sucesso === false || !cliente?.nome_utilizador) return;
        encomenda.clientes_gestao = {
            ...(encomenda.clientes_gestao || {}),
            nome_utilizador: cliente.nome_utilizador,
            nome: cliente.nome || encomenda.clientes_gestao?.nome || null
        };
        encomenda.cliente_gestao_id = encomenda.cliente_gestao_id || cliente.id || null;
    } catch (_) {}
}

async function preencherNomesUtilizadorPorPerfil() {
    const pendentes = encomendasAdmin.filter(precisaNomeUtilizadorFicha);
    for (let indice = 0; indice < pendentes.length; indice += 8) {
        await Promise.all(pendentes.slice(indice, indice + 8).map(preencherNomeUtilizadorPorPerfil));
    }
}

function obterProdutosEncomenda(encomenda) {
    let produtos = encomenda?.produtos || encomenda?.artigos || [];
    if (typeof produtos === 'string') {
        try { produtos = JSON.parse(produtos); }
        catch (_) { produtos = []; }
    }
    return Array.isArray(produtos) ? produtos : [];
}

function obterQuantidadeItemEncomenda(item) {
    return Math.max(1, Number(item?.quantidade ?? item?.qtd ?? 1) || 1);
}

function obterPrecoItemEncomenda(item) {
    return Number(item?.preco_unitario ?? item?.preco ?? item?.valor_unitario ?? 0) || 0;
}

function obterNomeItemEncomenda(item) {
    return String(item?.nome || item?.titulo || item?.sku || item?.referencia || 'Produto').trim();
}

function itemCorrespondePesquisaFigura(item, termoNormalizado) {
    if (!termoNormalizado) return false;
    const texto = normalizarEncomenda([
        item?.nome,
        item?.titulo,
        item?.sku,
        item?.referencia
    ].join(' '));
    return texto.includes(termoNormalizado);
}

function obterTermoPesquisaFiguraAdmin() {
    return String(document.getElementById('pesquisa-figura-encomendas-admin')?.value || '').trim();
}

function obterEncomendasFiltradasBaseAdmin() {
    const pesquisa = normalizarEncomenda(document.getElementById('pesquisa-encomendas-admin').value);
    const estado = document.getElementById('filtro-estado-encomendas-admin').value;
    return encomendasAdmin.filter(encomenda => {
        const correspondeEstado = estado === 'todos' || estadoNormalizadoEncomenda(encomenda.estado) === estado;
        const texto = normalizarEncomenda([
            encomenda.codigo_encomenda,
            obterNomeTituloEncomendaAdmin(encomenda),
            encomenda.nome_cliente,
            encomenda.email_cliente,
            encomenda.origem,
            encomenda.referencia_externa
        ].join(' '));
        return correspondeEstado && (!pesquisa || texto.includes(pesquisa));
    });
}

function obterVendasFiguraAdmin() {
    const termoNormalizado = normalizarEncomenda(obterTermoPesquisaFiguraAdmin());
    if (!termoNormalizado) return [];

    const vendas = [];
    obterEncomendasFiltradasBaseAdmin().forEach(encomenda => {
        const itens = obterProdutosEncomenda(encomenda)
            .filter(item => itemCorrespondePesquisaFigura(item, termoNormalizado));
        if (!itens.length) return;

        const quantidade = itens.reduce((total, item) => total + obterQuantidadeItemEncomenda(item), 0);
        const subtotal = itens.reduce((total, item) => (
            total + (obterQuantidadeItemEncomenda(item) * obterPrecoItemEncomenda(item))
        ), 0);
        const nomes = [...new Set(itens.map(obterNomeItemEncomenda).filter(Boolean))];

        vendas.push({
            encomenda,
            itens,
            quantidade,
            subtotal,
            nomes
        });
    });

    vendas.sort((a, b) => {
        const dataA = new Date(a.encomenda.created_at).getTime();
        const dataB = new Date(b.encomenda.created_at).getTime();
        return (Number.isNaN(dataB) ? 0 : dataB) - (Number.isNaN(dataA) ? 0 : dataA);
    });

    return vendas;
}

function criarHistoricoModalVendasFigura(vendas) {
    return vendas.map(venda => ({
        id: venda.encomenda.id,
        codigo: venda.encomenda.codigo_encomenda,
        data: venda.encomenda.created_at,
        origem: venda.encomenda.origem,
        estado: venda.encomenda.estado,
        total: venda.encomenda.total
    }));
}

function abrirEncomendaVendaFigura(indice, vendas) {
    if (!Array.isArray(vendas) || !vendas[indice]) return;
    if (typeof abrirModalEncomendaClienteLazy !== 'function' && typeof abrirModalEncomendaCliente !== 'function') return;
    const abrir = typeof abrirModalEncomendaClienteLazy === 'function'
        ? abrirModalEncomendaClienteLazy
        : abrirModalEncomendaCliente;
    abrir(criarHistoricoModalVendasFigura(vendas), indice)?.catch?.(console.error);
}

function atualizarModoPesquisaFiguraAdmin(ativo) {
    document.getElementById('encomendas-aplicacao')?.classList.toggle('pesquisa-figura-ativa', ativo);
}

function renderizarVendasFiguraAdmin() {
    const painel = document.getElementById('lista-vendas-figura-admin');
    const resumo = document.getElementById('resumo-vendas-figura-admin');
    const lista = document.getElementById('lista-encomendas-admin');
    const termo = obterTermoPesquisaFiguraAdmin();
    const vendas = obterVendasFiguraAdmin();

    if (!painel || !lista) return;

    if (!termo) {
        atualizarModoPesquisaFiguraAdmin(false);
        painel.hidden = true;
        painel.replaceChildren();
        if (resumo) resumo.hidden = true;
        lista.hidden = false;
        return;
    }

    atualizarModoPesquisaFiguraAdmin(true);
    lista.hidden = true;
    lista.replaceChildren();
    painel.hidden = false;
    painel.replaceChildren();

    if (resumo) {
        resumo.hidden = true;
        resumo.textContent = '';
    }

    if (!vendas.length) {
        painel.appendChild(criarElementoEncomenda('p', 'admin-encomendas-vendas-figura-vazio', `Nenhuma encomenda contém a figura "${termo}".`));
        return;
    }

    const cabecalho = criarElementoEncomenda('div', 'admin-encomendas-vendas-figura-cabecalho');
    cabecalho.append(
        criarElementoEncomenda('span', '', 'Data'),
        criarElementoEncomenda('span', '', 'Código'),
        criarElementoEncomenda('span', '', 'Cliente'),
        criarElementoEncomenda('span', '', 'Plataforma'),
        criarElementoEncomenda('span', '', 'Estado'),
        criarElementoEncomenda('span', '', 'Qtd'),
        criarElementoEncomenda('span', '', 'Preço'),
        criarElementoEncomenda('span', '', 'Total')
    );
    painel.appendChild(cabecalho);

    vendas.forEach((venda, indice) => {
        const { encomenda, quantidade, subtotal, nomes } = venda;
        const precoMedio = quantidade > 0 ? subtotal / quantidade : 0;
        const linha = criarElementoEncomenda('div', 'admin-encomendas-vendas-figura-linha');
        linha.tabIndex = 0;
        linha.setAttribute('role', 'button');
        linha.setAttribute('aria-label', `Abrir encomenda ${encomenda.codigo_encomenda || encomenda.id}`);

        const codigo = document.createElement('button');
        codigo.type = 'button';
        codigo.className = 'admin-encomendas-vendas-figura-codigo';
        codigo.textContent = encomenda.codigo_encomenda || `#${encomenda.id}`;
        codigo.title = 'Abrir encomenda';

        const abrir = evento => {
            evento.stopPropagation();
            abrirEncomendaVendaFigura(indice, vendas);
        };
        codigo.addEventListener('click', abrir);
        linha.addEventListener('click', () => abrirEncomendaVendaFigura(indice, vendas));
        linha.addEventListener('keydown', evento => {
            if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                abrirEncomendaVendaFigura(indice, vendas);
            }
        });

        linha.append(
            criarElementoEncomenda('span', '', formatarDataEncomenda(encomenda.created_at)),
            codigo,
            criarElementoEncomenda('span', 'admin-encomendas-vendas-figura-nome', obterNomeTituloEncomendaAdmin(encomenda) || '\u2014'),
            criarElementoEncomenda('span', '', encomenda.origem || 'Site'),
            criarElementoEncomenda('span', '', estadoNormalizadoEncomenda(encomenda.estado)),
            criarElementoEncomenda('span', '', String(quantidade)),
            criarElementoEncomenda('span', '', formatarEuroEncomenda(precoMedio)),
            criarElementoEncomenda('span', 'admin-encomendas-vendas-figura-total', formatarEuroEncomenda(subtotal))
        );
        linha.title = nomes.join(' · ');
        painel.appendChild(linha);
    });
}

function encomendasFiltradasAdmin() {
    const filtradas = obterEncomendasFiltradasBaseAdmin();
    const estado = document.getElementById('filtro-estado-encomendas-admin').value;

    if (estado === 'Pago' || estado === 'Enviado') {
        filtradas.sort((a, b) => {
            const prioridadeA = a.prioritaria ? 1 : 0;
            const prioridadeB = b.prioritaria ? 1 : 0;
            if (prioridadeA !== prioridadeB) return prioridadeB - prioridadeA;
            const dataA = new Date(a.data_pagamento || a.created_at).getTime();
            const dataB = new Date(b.data_pagamento || b.created_at).getTime();
            return (Number.isNaN(dataA) ? Number.MAX_SAFE_INTEGER : dataA)
                - (Number.isNaN(dataB) ? Number.MAX_SAFE_INTEGER : dataB);
        });
    }

    return filtradas;
}

function loteEncomendasAtivo() {
    return !obterTermoPesquisaFiguraAdmin();
}

function obterEncomendasLoteVisiveis() {
    if (!loteEncomendasAtivo()) return [];
    return encomendasFiltradasAdmin();
}

function filtroEstadoPermiteTotalEncomendas() {
    const estado = document.getElementById('filtro-estado-encomendas-admin')?.value || ENCOMENDAS_ESTADO_INICIAL;
    return estado !== 'todos' && estado !== 'Concluído';
}

function obterTotalEncomendaLote(encomenda) {
    return Number(encomenda?.total ?? encomenda?.valor_total ?? 0) || 0;
}

function pedirConclusaoLoteEncomendas(quantidade, total) {
    return new Promise(resolve => {
        const existente = document.getElementById('admin-fatura-confirmacao');
        if (existente) existente.remove();

        const fundo = criarElementoEncomenda('div', 'admin-fatura-confirmacao');
        fundo.id = 'admin-fatura-confirmacao';
        fundo.setAttribute('role', 'dialog');
        fundo.setAttribute('aria-modal', 'true');

        const caixa = criarElementoEncomenda('div', 'admin-fatura-confirmacao-caixa');
        caixa.append(
            criarElementoEncomenda('h3', 'admin-fatura-confirmacao-titulo', `Concluir ${quantidade} encomenda(s)?`),
            criarElementoEncomenda('p', 'admin-fatura-confirmacao-texto', 'Os anexos destas encomendas serão eliminados definitivamente.'),
            criarElementoEncomenda('p', 'admin-fatura-confirmacao-texto', 'As notas internas serão mantidas.'),
            criarElementoEncomenda('p', 'admin-fatura-confirmacao-texto', `Total selecionado: ${formatarEuroEncomenda(total)}.`),
            criarElementoEncomenda('p', 'admin-fatura-confirmacao-texto', 'Pode emitir os recibos no Moloni agora ou deixar para mais tarde.'),
            criarElementoEncomenda('p', 'admin-fatura-confirmacao-texto', 'Se emitir agora, a data de emissão é a de hoje e o pagamento fica com a data real.')
        );

        const acoes = criarElementoEncomenda('div', 'admin-fatura-confirmacao-acoes');
        const botoes = [
            { texto: 'Cancelar', valor: null, classe: 'wallapop-botao admin-fatura-confirmacao-cancelar', foco: true },
            { texto: 'Recibos mais tarde', valor: 'mais_tarde', classe: 'wallapop-botao' },
            { texto: 'Concluir e emitir recibos', valor: 'emitir', classe: 'wallapop-botao wallapop-botao-destaque' }
        ];

        const fechar = valor => {
            document.removeEventListener('keydown', aoTecla);
            fundo.remove();
            resolve(valor);
        };
        const aoTecla = evento => {
            if (evento.key === 'Escape') {
                evento.preventDefault();
                fechar(null);
            }
        };

        botoes.forEach(definicao => {
            const botao = criarElementoEncomenda('button', definicao.classe, definicao.texto);
            botao.type = 'button';
            botao.addEventListener('click', () => fechar(definicao.valor));
            acoes.appendChild(botao);
            if (definicao.foco) window.setTimeout(() => botao.focus(), 0);
        });
        fundo.addEventListener('click', evento => {
            if (evento.target === fundo) fechar(null);
        });
        document.addEventListener('keydown', aoTecla);

        caixa.appendChild(acoes);
        fundo.appendChild(caixa);
        document.body.appendChild(fundo);
    });
}

function atualizarAcoesLoteEncomendas() {
    const barra = document.getElementById('acoes-lote-encomendas');
    const total = document.getElementById('total-encomendas-selecionadas');
    const botaoConcluir = document.getElementById('btn-concluir-encomendas-selecionadas');
    if (!barra || !total) return;

    const visiveis = obterEncomendasLoteVisiveis();
    const estado = document.getElementById('filtro-estado-encomendas-admin')?.value || ENCOMENDAS_ESTADO_INICIAL;
    const idsVisiveis = new Set(visiveis.map(encomenda => String(encomenda.id)));
    encomendasSelecionadasLote = new Set([...encomendasSelecionadasLote].filter(id => idsVisiveis.has(id)));
    const selecionaveis = estado === 'Enviado';
    const selecionadas = selecionaveis
        ? visiveis.filter(encomenda => encomendasSelecionadasLote.has(String(encomenda.id)))
        : [];
    const baseTotal = selecionaveis ? selecionadas : visiveis;
    const totalVisivel = baseTotal.reduce((soma, encomenda) => soma + obterTotalEncomendaLote(encomenda), 0);
    barra.hidden = !loteEncomendasAtivo() || !visiveis.length || !filtroEstadoPermiteTotalEncomendas();
    total.textContent = formatarEuroEncomenda(totalVisivel);
    if (botaoConcluir) {
        botaoConcluir.hidden = !selecionaveis || !selecionadas.length;
        botaoConcluir.textContent = selecionadas.length === 1 ? 'Concluir selecionada' : 'Concluir selecionadas';
    }
}

async function concluirEncomendasSelecionadas() {
    const selecionadas = encomendasFiltradasAdmin()
        .filter(encomenda => encomendasSelecionadasLote.has(String(encomenda.id)))
        .filter(encomenda => estadoNormalizadoEncomenda(encomenda.estado) === 'Enviado');
    if (!selecionadas.length) return;

    const total = selecionadas.reduce((soma, encomenda) => soma + obterTotalEncomendaLote(encomenda), 0);
    const escolhaConclusao = await pedirConclusaoLoteEncomendas(selecionadas.length, total);
    if (!escolhaConclusao) return;

    const botao = document.getElementById('btn-concluir-encomendas-selecionadas');
    if (botao) botao.disabled = true;
    definirStatusEncomendas(`A concluir ${selecionadas.length} encomenda(s) selecionada(s)...`, 'processando');

    let concluidas = 0;
    for (const encomenda of selecionadas) {
        const selectTemporario = document.createElement('select');
        selectTemporario.value = estadoNormalizadoEncomenda(encomenda.estado);
        selectTemporario.dataset.estadoAtual = selectTemporario.value;
        const ok = await AdminEncomendaVista.atualizarEstado(encomenda, 'Concluído', selectTemporario, {
            semConfirmacaoConclusao: true,
            emitirFaturaMoloni: escolhaConclusao === 'emitir',
            forcarEmissaoFatura: escolhaConclusao === 'emitir',
            naoPerguntarFaturaMoloni: true,
            aguardarFaturaMoloni: true
        });
        if (ok) {
            concluidas += 1;
            encomendasSelecionadasLote.delete(String(encomenda.id));
        }
    }

    if (botao) botao.disabled = false;
    renderizarEncomendasAdmin();
    definirStatusEncomendas(`${concluidas} encomenda(s) concluída(s).`);
}

function renderizarEncomendasAdmin() {
    const lista = document.getElementById('lista-encomendas-admin');
    const pesquisaFigura = Boolean(obterTermoPesquisaFiguraAdmin());

    if (pesquisaFigura) {
        if (lista) {
            lista.hidden = true;
            lista.replaceChildren();
        }
        atualizarAcoesLoteEncomendas();
        renderizarVendasFiguraAdmin();
        return;
    }

    renderizarVendasFiguraAdmin();
    if (lista) lista.hidden = false;
    const filtradas = encomendasFiltradasAdmin();
    lista.replaceChildren();
    if (!filtradas.length) {
        atualizarAcoesLoteEncomendas();
        lista.appendChild(criarElementoEncomenda('p', 'admin-encomendas-vazio', 'Nenhuma encomenda encontrada.'));
        return;
    }
    filtradas.forEach(encomenda => lista.appendChild(criarCardEncomenda(encomenda)));
    atualizarAcoesLoteEncomendas();
    AdminEncomendaVista.carregarContagensAnexosLista(filtradas).catch(console.warn);
    verificarCarregamentoConcluidasScroll();
}

function obterCodigoEncomendaUrlAdmin() {
    return String(new URLSearchParams(window.location.search).get('encomenda') || '').trim();
}

async function carregarEncomendaAdminPorCodigo(codigo) {
    const alvo = String(codigo || '').trim();
    if (!alvo) return null;
    const existente = encomendasAdmin.find(item => String(item.codigo_encomenda || '').trim().toUpperCase() === alvo.toUpperCase());
    if (existente) return existente;

    try {
        const { data } = await consultarEncomendasAdmin(
            query => query.eq('codigo_encomenda', alvo),
            { inicio: 0, fim: 0 }
        );
        const encomenda = Array.isArray(data) ? data[0] : null;
        if (encomenda && !encomendasAdmin.some(item => String(item.id) === String(encomenda.id))) {
            encomendasAdmin = [encomenda, ...encomendasAdmin].sort(ordenarEncomendasRecentes);
        }
        return encomenda || null;
    } catch (error) {
        console.warn('Nao foi possivel carregar a encomenda por codigo.', error);
        return null;
    }
}

async function abrirEncomendaAdminPorCodigo(codigo) {
    const alvo = String(codigo || '').trim();
    if (!alvo) return false;

    await carregarEncomendaAdminPorCodigo(alvo);
    const pesquisa = document.getElementById('pesquisa-encomendas-admin');
    const filtro = document.getElementById('filtro-estado-encomendas-admin');
    if (pesquisa) pesquisa.value = alvo;
    if (filtro) filtro.value = 'todos';
    renderizarEncomendasAdmin();

    const card = [...document.querySelectorAll('.admin-encomenda-codigo')]
        .find(elemento => String(elemento.textContent || '').trim().toUpperCase() === alvo.toUpperCase())
        ?.closest('.admin-encomenda-card');
    if (!card) return false;

    const encomenda = encomendasAdmin.find(item => String(item.codigo_encomenda || '').trim().toUpperCase() === alvo.toUpperCase());
    if (encomenda) abrirModalEncomendaAdmin(encomenda);
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
}

function atualizarResumoEncomendas() {
    const contar = estado => encomendasAdmin.filter(item => estadoNormalizadoEncomenda(item.estado) === estado).length;
    const concluidas = Number.isFinite(totalConcluidasServidor) ? totalConcluidasServidor : contar('Concluído');
    const totalSemConcluidas = encomendasAdmin.filter(item => estadoNormalizadoEncomenda(item.estado) !== 'Concluído').length;
    document.getElementById('encomendas-total').textContent = totalSemConcluidas + concluidas;
    document.getElementById('encomendas-pendentes').textContent = contar('A aguardar pagamento');
    document.getElementById('encomendas-pagas').textContent = contar('Pago');
    document.getElementById('encomendas-preparacao').textContent = contar('Em preparação');
    document.getElementById('encomendas-enviadas').textContent = contar('Enviado');
    document.getElementById('encomendas-concluidas').textContent = concluidas;
}

function erroPermiteFallbackEncomendasAdmin(error) {
    return /nome_utilizador|clientes_gestao|relationship|schema cache/i.test(String(error?.message || error?.details || ''));
}

async function consultarEncomendasAdmin(aplicarFiltros, opcoes = {}) {
    const seletores = [
        '*, clientes_gestao(nome_utilizador, nome, tem_aviso)',
        '*, clientes_gestao(nome, tem_aviso)',
        '*'
    ];
    let ultimoErro = null;

    for (const seletor of seletores) {
        let query = encomendasClient
            .from('encomendas')
            .select(seletor, opcoes.comContagem ? { count: 'exact' } : undefined);
        query = aplicarFiltros(query).order('created_at', { ascending: false });
        if (Number.isInteger(opcoes.inicio) && Number.isInteger(opcoes.fim)) {
            query = query.range(opcoes.inicio, opcoes.fim);
        }
        const resposta = await query;
        if (!resposta.error) return resposta;
        ultimoErro = resposta.error;
        if (!erroPermiteFallbackEncomendasAdmin(resposta.error)) break;
    }

    throw ultimoErro;
}

function ordenarEncomendasRecentes(a, b) {
    const dataA = new Date(a?.created_at).getTime();
    const dataB = new Date(b?.created_at).getTime();
    return (Number.isNaN(dataB) ? 0 : dataB) - (Number.isNaN(dataA) ? 0 : dataA);
}

function sincronizarEstadoPaginacaoConcluidas() {
    const carregadas = encomendasAdmin.filter(item => estadoNormalizadoEncomenda(item.estado) === 'Concluído').length;
    todasConcluidasCarregadas = Number.isFinite(totalConcluidasServidor)
        ? carregadas >= totalConcluidasServidor
        : false;
}

async function carregarPaginaConcluidasAdmin(inicio = 0) {
    const fim = inicio + ENCOMENDAS_CONCLUIDAS_POR_PAGINA - 1;
    const resposta = await consultarEncomendasAdmin(
        query => query.eq('estado', 'Concluído'),
        { inicio, fim, comContagem: inicio === 0 }
    );
    if (inicio === 0 && Number.isFinite(resposta.count)) {
        totalConcluidasServidor = resposta.count;
    }
    return resposta.data || [];
}

async function carregarEncomendasAdmin() {
    definirStatusEncomendas('A carregar encomendas...');
    const carregamentoId = ++carregamentoComplementarEncomendasId;
    const [{ data: ativas }, concluidas] = await Promise.all([
        consultarEncomendasAdmin(query => query.neq('estado', 'Concluído')),
        carregarPaginaConcluidasAdmin(0)
    ]);
    encomendasAdmin = [...(ativas || []), ...concluidas].sort(ordenarEncomendasRecentes);
    sincronizarEstadoPaginacaoConcluidas();
    atualizarResumoEncomendas();
    renderizarEncomendasAdmin();
    definirStatusEncomendas('');
    carregarDadosComplementaresEncomendasAdmin(carregamentoId);
}

async function carregarMaisEncomendasConcluidasAdmin() {
    if (carregandoMaisConcluidas || todasConcluidasCarregadas) return;
    if ((document.getElementById('filtro-estado-encomendas-admin')?.value || '') !== 'Concluído') return;
    carregandoMaisConcluidas = true;
    try {
        const carregadas = encomendasAdmin.filter(item => estadoNormalizadoEncomenda(item.estado) === 'Concluído').length;
        const mais = await carregarPaginaConcluidasAdmin(carregadas);
        if (mais.length) {
            const idsExistentes = new Set(encomendasAdmin.map(item => String(item.id)));
            encomendasAdmin = [...encomendasAdmin, ...mais.filter(item => !idsExistentes.has(String(item.id)))]
                .sort(ordenarEncomendasRecentes);
        }
        sincronizarEstadoPaginacaoConcluidas();
        renderizarEncomendasAdmin();
    } catch (error) {
        console.warn('Nao foi possivel carregar mais encomendas concluidas.', error);
    } finally {
        carregandoMaisConcluidas = false;
    }
}

function verificarCarregamentoConcluidasScroll() {
    if ((document.getElementById('filtro-estado-encomendas-admin')?.value || '') !== 'Concluído') return;
    if (todasConcluidasCarregadas || carregandoMaisConcluidas) return;
    const distanciaFundo = document.documentElement.scrollHeight - (window.innerHeight + window.scrollY);
    if (distanciaFundo < 650) carregarMaisEncomendasConcluidasAdmin();
}

async function carregarDadosComplementaresEncomendasAdmin(carregamentoId) {
    try {
        await preencherNomesUtilizadorPorPerfil();
        if (carregamentoId !== carregamentoComplementarEncomendasId) return;
        renderizarEncomendasAdmin();
        await carregarImagensProdutosEncomendas();
        if (carregamentoId !== carregamentoComplementarEncomendasId) return;
        renderizarEncomendasAdmin();
    } catch (error) {
        console.warn('Dados complementares das encomendas indisponiveis.', error);
    }
}

async function carregarImagensProdutosEncomendas() {
    AdminEncomendaVista.limparCacheImagens();
    await AdminEncomendaVista.carregarImagensParaEncomendas(encomendasAdmin);
}

async function iniciarPainelEncomendas() {
    const bloqueio = document.getElementById('encomendas-bloqueio');
    try {
        await window.carregarScriptSupabase();
        if (typeof supabase === 'undefined') throw new Error('A biblioteca Supabase não carregou.');
        encomendasClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        configurarVistaEncomendasAdmin();
        const user = await validarAdminRapido(encomendasClient, bloqueio);
        if (!user) return;
        mostrarNavegacaoAdminValidada();
        bloqueio.hidden = true;
        document.getElementById('encomendas-aplicacao').hidden = false;
        const filtroEstado = document.getElementById('filtro-estado-encomendas-admin');
        if (filtroEstado) filtroEstado.value = ENCOMENDAS_ESTADO_INICIAL;
        await carregarEncomendasAdmin();
        const codigoUrl = obterCodigoEncomendaUrlAdmin();
        if (codigoUrl) await abrirEncomendaAdminPorCodigo(codigoUrl);
    } catch (error) {
        console.error(error);
        bloqueio.hidden = false;
        bloqueio.textContent = 'Erro ao abrir o painel: ' + (error.message || 'sem detalhe disponível');
    }
}

document.getElementById('pesquisa-encomendas-admin').addEventListener('input', renderizarEncomendasAdmin);
document.getElementById('pesquisa-figura-encomendas-admin').addEventListener('input', renderizarEncomendasAdmin);
document.getElementById('filtro-estado-encomendas-admin').addEventListener('change', renderizarEncomendasAdmin);
document.getElementById('btn-concluir-encomendas-selecionadas')?.addEventListener('click', concluirEncomendasSelecionadas);
window.addEventListener('scroll', verificarCarregamentoConcluidasScroll, { passive: true });
document.getElementById('admin-imagem-modal-fechar').addEventListener('click', fecharImagemProdutoEncomenda);
document.getElementById('admin-encomenda-modal-fechar')?.addEventListener('click', fecharModalEncomendaAdmin);
ligarFechoModalPorFundo(document.getElementById('admin-imagem-modal'), fecharImagemProdutoEncomenda);
document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && !document.getElementById('admin-imagem-modal').hidden) {
        fecharImagemProdutoEncomenda();
    } else if (evento.key === 'Escape' && !document.getElementById('admin-encomenda-modal')?.hidden) {
        fecharModalEncomendaAdmin();
    }
});
