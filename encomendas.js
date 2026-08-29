
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

function obterUrlExternoSeguroEncomenda(valor) {
    const texto = String(valor || '').trim();
    if (!texto) return '';
    try {
        const url = new URL(texto);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) {
        return '';
    }
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

function obterNomeUtilizadorFichaCliente(cliente = {}) {
    return String(cliente.nome_utilizador || cliente.nome || '').trim();
}

function obterNomePessoaFichaCliente(cliente = {}) {
    return String(cliente.nome || '').trim();
}

async function chamarRpcClienteEncomendasComFallback(nomeFuncao, parametros) {
    const resposta = await encomendasClient.rpc(nomeFuncao, parametros);
    const erro = resposta.error;
    const mensagem = String(erro?.message || erro?.details || '');
    if (!erro || !('p_nome_utilizador' in parametros) || !/p_nome_utilizador|function|schema cache/i.test(mensagem)) {
        return resposta;
    }
    const antigos = { ...parametros, p_nome: parametros.p_nome_utilizador || parametros.p_nome };
    delete antigos.p_nome_utilizador;
    return encomendasClient.rpc(nomeFuncao, antigos);
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

function definirStatusFichaCliente(texto, erro = false) {
    const status = document.getElementById('admin-cliente-status');
    status.textContent = texto || '';
    status.classList.toggle('msg-erro', erro);
    status.classList.toggle('msg-sucesso', Boolean(texto) && !erro);
}

function fecharFichaClienteAdmin() {
    document.getElementById('admin-cliente-modal').hidden = true;
    document.getElementById('admin-cliente-conteudo').replaceChildren();
    definirStatusFichaCliente('');
    document.body.classList.remove('admin-cliente-modal-aberto');
}

function criarCampoFichaCliente(rotulo, valor) {
    const linha = criarElementoEncomenda('div', 'admin-cliente-campo');
    linha.append(
        criarElementoEncomenda('strong', '', rotulo),
        criarElementoEncomenda('span', '', valor || '\u2014')
    );
    return linha;
}

function criarCampoFichaMorada(cliente) {
    const linha = criarElementoEncomenda('div', 'admin-cliente-campo admin-cliente-campo-morada-bloco');
    linha.appendChild(criarElementoEncomenda('strong', '', 'Morada'));
    const formatar = window.MoradaFormato;
    if (formatar?.criarBlocoMorada) {
        linha.appendChild(formatar.criarBlocoMorada(formatar.formatarLinhasMorada(cliente), criarElementoEncomenda));
    } else {
        linha.appendChild(criarElementoEncomenda(
            'span',
            '',
            [cliente.morada, cliente.cp, cliente.cidade, cliente.pais].filter(Boolean).join(', ') || '\u2014'
        ));
    }
    return linha;
}

function criarCampoEdicaoCliente(rotulo, nome, valor, tipo = 'text', obrigatorio = false) {
    const campo = document.createElement('label');
    campo.className = 'admin-cliente-formulario-campo';
    campo.appendChild(criarElementoEncomenda('span', '', rotulo));
    const input = document.createElement('input');
    input.type = tipo;
    input.name = nome;
    input.value = valor || '';
    input.required = obrigatorio;
    input.autocomplete = 'off';
    campo.appendChild(input);
    return campo;
}

function criarCheckboxEdicaoCliente(rotulo, nome, marcado = false) {
    const campo = document.createElement('label');
    campo.className = 'admin-cliente-formulario-campo admin-cliente-formulario-checkbox';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = nome;
    input.checked = Boolean(marcado);
    campo.append(input, criarElementoEncomenda('span', '', rotulo));
    return campo;
}

function obterPerfisFormularioCliente(formulario) {
    return Array.from(formulario.querySelectorAll('[name^="perfil_url_"]'))
        .map(input => ({ url: input.value.trim() }))
        .filter(perfil => perfil.url);
}

function criarCamposPerfisCliente(perfis = []) {
    const fragmento = document.createDocumentFragment();
    for (let indice = 0; indice < 5; indice += 1) {
        const perfil = perfis[indice] || {};
        fragmento.appendChild(criarCampoEdicaoCliente(
            `Link externo ${indice + 1}`,
            `perfil_url_${indice + 1}`,
            perfil.url || '',
            'url'
        ));
    }
    return fragmento;
}

function renderizarFormularioClienteExterno(dados, secao) {
    const cliente = dados.cliente || {};
    const perfis = Array.isArray(dados.perfis) ? dados.perfis : [];
    const formulario = document.createElement('form');
    formulario.className = 'admin-cliente-formulario';
    formulario.append(
        criarCampoEdicaoCliente('Nome de utilizador', 'nome_utilizador', obterNomeUtilizadorFichaCliente(cliente), 'text', true),
        criarCampoEdicaoCliente('Nome', 'nome', obterNomePessoaFichaCliente(cliente), 'text'),
        criarCampoEdicaoCliente('E-mail', 'email', cliente.email, 'email'),
        criarCampoEdicaoCliente('Telem\u00f3vel', 'telefone', cliente.telefone),
        window.MoradaFormato?.criarCampoMoradaEdicao(
            criarElementoEncomenda,
            window.MoradaFormato.obterMoradaEdicao(cliente.morada)
        ) || criarCampoEdicaoCliente('Morada', 'morada', cliente.morada),
        criarCampoEdicaoCliente('C\u00f3digo postal', 'cp', cliente.cp),
        criarCampoEdicaoCliente('Cidade', 'cidade', cliente.cidade),
        window.PaisesCliente?.criarSelectPaisCliente(
            criarElementoEncomenda,
            cliente.pais || 'Portugal'
        ) || criarCampoEdicaoCliente('Pa\u00eds', 'pais', cliente.pais)
    );
    formulario.appendChild(criarCheckboxEdicaoCliente('Cliente com aviso a ler', 'tem_aviso', cliente.tem_aviso));
    const tituloPerfis = criarElementoEncomenda('h3', 'admin-cliente-formulario-subtitulo', 'Links externos');
    formulario.appendChild(tituloPerfis);
    formulario.appendChild(criarCamposPerfisCliente(perfis));
    window.PaisesCliente?.ligarPerfisAoPaisCliente(formulario);

    const acoes = criarElementoEncomenda('div', 'admin-cliente-formulario-acoes');
    const cancelar = criarElementoEncomenda('button', 'wallapop-botao', 'Cancelar');
    cancelar.type = 'button';
    cancelar.addEventListener('click', () => renderizarFichaClienteAdmin(dados));
    const guardar = criarElementoEncomenda('button', 'wallapop-botao wallapop-botao-destaque', 'Guardar altera\u00e7\u00f5es');
    guardar.type = 'submit';
    acoes.append(cancelar, guardar);
    formulario.appendChild(acoes);

    formulario.addEventListener('submit', async evento => {
        evento.preventDefault();
        guardar.disabled = true;
        cancelar.disabled = true;
        definirStatusFichaCliente('A guardar dados do cliente...');
        const campos = new FormData(formulario);
        const { data, error } = await chamarRpcClienteEncomendasComFallback('atualizar_cliente_externo_admin', {
            p_cliente_id: cliente.id,
            p_nome: String(campos.get('nome') || ''),
            p_nome_utilizador: String(campos.get('nome_utilizador') || ''),
            p_email: String(campos.get('email') || ''),
            p_telefone: String(campos.get('telefone') || ''),
            p_morada: window.MoradaFormato?.obterMoradaFormulario(formulario) || String(campos.get('morada') || ''),
            p_cp: String(campos.get('cp') || ''),
            p_cidade: String(campos.get('cidade') || ''),
            p_pais: String(campos.get('pais') || '')
        });
        guardar.disabled = false;
        cancelar.disabled = false;
        if (error || data?.sucesso === false) {
            definirStatusFichaCliente('Erro ao guardar dados: ' + (error?.message || data?.erro || 'sem detalhe'), true);
            return;
        }
        const perfisAtualizados = obterPerfisFormularioCliente(formulario);
        const resultadoPerfis = await encomendasClient.rpc('guardar_perfis_cliente_admin', {
            p_cliente_id: cliente.id,
            p_perfis: perfisAtualizados
        });
        if (resultadoPerfis.error || resultadoPerfis.data?.sucesso === false) {
            definirStatusFichaCliente('Dados guardados, mas erro nos links: ' + (resultadoPerfis.error?.message || resultadoPerfis.data?.erro || 'sem detalhe'), true);
            return;
        }
        const resultadoAviso = await encomendasClient.rpc('guardar_aviso_cliente_admin', {
            p_cliente_id: cliente.id,
            p_tem_aviso: campos.get('tem_aviso') === 'on'
        });
        if (resultadoAviso.error || resultadoAviso.data?.sucesso === false) {
            definirStatusFichaCliente('Dados guardados, mas erro no aviso: ' + (resultadoAviso.error?.message || resultadoAviso.data?.erro || 'sem detalhe'), true);
            return;
        }
        dados.cliente = { ...data.cliente, tem_aviso: campos.get('tem_aviso') === 'on' };
        const fichaAtualizada = await encomendasClient.rpc('obter_ficha_cliente_por_id_admin', {
            p_cliente_id: cliente.id
        });
        renderizarFichaClienteAdmin(fichaAtualizada.data?.sucesso ? fichaAtualizada.data : dados);
        definirStatusFichaCliente('Dados do cliente atualizados.');
    });

    secao.replaceChildren(criarElementoEncomenda('h3', '', 'Editar dados do cliente'), formulario);
    formulario.querySelector('input[name="nome_utilizador"]').focus();
}

function criarCodigoHistoricoEncomenda(item, indice, historico) {
    const codigo = item.codigo || item.codigo_encomenda || `#${item.id}`;
    if (!item.id) return criarElementoEncomenda('strong', '', codigo);
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'clientes-historico-codigo';
    botao.textContent = codigo;
    botao.title = 'Consultar encomenda (janela r\u00e1pida)';
    botao.addEventListener('click', () => {
        const abrir = typeof abrirModalEncomendaClienteLazy === 'function'
            ? abrirModalEncomendaClienteLazy
            : abrirModalEncomendaCliente;
        abrir(historico, indice)?.catch?.(console.error);
    });
    return botao;
}

function renderizarFichaClienteAdmin(dados) {
    const conteudo = document.getElementById('admin-cliente-conteudo');
    const cliente = dados.cliente || {};
    const resumo = dados.resumo || {};
    const perfis = Array.isArray(dados.perfis) ? dados.perfis : [];
    const historico = Array.isArray(dados.historico) ? dados.historico : [];
    conteudo.replaceChildren();

    const dadosPessoais = criarElementoEncomenda('section', 'admin-cliente-secao');
    const cabecalhoDados = criarElementoEncomenda('div', 'admin-cliente-secao-cabecalho');
    cabecalhoDados.appendChild(criarElementoEncomenda('h3', '', 'Dados do cliente'));
    if (!cliente.auth_user_id) {
        const editar = criarElementoEncomenda('button', 'wallapop-botao admin-cliente-editar', 'Editar dados');
        editar.type = 'button';
        editar.addEventListener('click', () => renderizarFormularioClienteExterno(dados, dadosPessoais));
        cabecalhoDados.appendChild(editar);
    }
    dadosPessoais.appendChild(cabecalhoDados);
    const grelha = criarElementoEncomenda('div', 'admin-cliente-grelha');
    grelha.append(
        criarCampoFichaCliente('Nome de utilizador', obterNomeUtilizadorFichaCliente(cliente)),
        criarCampoFichaCliente('Nome', obterNomePessoaFichaCliente(cliente)),
        criarCampoFichaCliente('E-mail', cliente.email),
        criarCampoFichaCliente('Telem\u00f3vel', cliente.telefone),
        criarCampoFichaMorada(cliente)
    );
    dadosPessoais.appendChild(grelha);
    const restricoes = [];
    if (cliente.bloquear_conta) restricoes.push('Login bloqueado no site');
    if (cliente.bloquear_compras) restricoes.push('Compras bloqueadas no site');
    if (restricoes.length) {
        dadosPessoais.appendChild(criarElementoEncomenda(
            'p',
            'admin-cliente-restricoes',
            restricoes.join(' \u2022 ')
        ));
    }
    if (cliente.tem_aviso) {
        dadosPessoais.appendChild(criarElementoEncomenda(
            'p',
            'admin-cliente-aviso-conta',
            '\u26a0\ufe0f Cliente com aviso a ler.'
        ));
    }
    if (cliente.auth_user_id) {
        dadosPessoais.appendChild(criarElementoEncomenda(
            'p',
            'admin-cliente-aviso-conta',
            'Os dados desta conta s\u00e3o geridos pelo pr\u00f3prio cliente no site.'
        ));
    }

    const indicadores = criarElementoEncomenda('section', 'admin-cliente-resumo');
    indicadores.append(
        criarCampoFichaCliente('Encomendas', String(resumo.encomendas || 0)),
        criarCampoFichaCliente('Total comprado', formatarEuroEncomenda(resumo.total)),
        criarCampoFichaCliente('\u00daltima compra', resumo.ultima_compra ? formatarDataEncomenda(resumo.ultima_compra) : '\u2014')
    );

    const perfisSecao = criarElementoEncomenda('section', 'admin-cliente-secao');
    perfisSecao.appendChild(criarElementoEncomenda('h3', '', 'Perfis externos'));
    const listaPerfis = criarElementoEncomenda('div', 'admin-cliente-perfis');
    if (!perfis.length) {
        listaPerfis.appendChild(criarElementoEncomenda('p', 'admin-cliente-vazio', 'Nenhum perfil externo associado.'));
    } else {
        perfis.forEach(perfil => {
            const link = criarElementoEncomenda('a', 'admin-cliente-perfil', `${perfil.plataforma}: ${perfil.utilizador}`);
            link.href = obterUrlExternoSeguroEncomenda(perfil.url) || '#';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            listaPerfis.appendChild(link);
        });
    }
    perfisSecao.appendChild(listaPerfis);

    const historicoSecao = criarElementoEncomenda('section', 'admin-cliente-secao');
    historicoSecao.appendChild(criarElementoEncomenda('h3', '', 'Hist\u00f3rico de encomendas'));
    const listaHistorico = criarElementoEncomenda('div', 'admin-cliente-historico');
    historico.forEach((item, indice) => {
        const cancelada = String(item.estado || '').trim().toLowerCase() === 'cancelado';
        const linha = criarElementoEncomenda('div', 'admin-cliente-historico-linha');
        if (cancelada) linha.classList.add('clientes-historico-cancelada');
        const estado = criarElementoEncomenda('span', cancelada ? 'clientes-historico-estado-cancelada' : '', item.estado || '');
        linha.append(
            criarCodigoHistoricoEncomenda(item, indice, historico),
            criarElementoEncomenda('span', 'clientes-historico-origem', item.origem || 'Site'),
            estado,
            criarElementoEncomenda('span', 'clientes-historico-data', formatarDataEncomenda(item.data)),
            criarElementoEncomenda('strong', 'clientes-historico-total', formatarEuroEncomenda(item.total))
        );
        listaHistorico.appendChild(linha);
    });
    if (!historico.length) listaHistorico.appendChild(criarElementoEncomenda('p', 'admin-cliente-vazio', 'Sem encomendas associadas.'));
    historicoSecao.appendChild(listaHistorico);

    const notasSecao = criarElementoEncomenda('section', 'admin-cliente-secao');
    notasSecao.appendChild(criarElementoEncomenda('h3', '', 'Notas internas'));
    const notas = document.createElement('textarea');
    notas.className = 'admin-cliente-notas';
    notas.rows = 5;
    notas.maxLength = 5000;
    notas.value = cliente.notas || '';
    notas.placeholder = 'Prefer\u00eancias, observa\u00e7\u00f5es de entrega ou outra informa\u00e7\u00e3o realmente necess\u00e1ria.';
    const guardar = criarElementoEncomenda('button', 'wallapop-botao wallapop-botao-destaque', 'Guardar notas');
    guardar.type = 'button';
    guardar.addEventListener('click', async () => {
        guardar.disabled = true;
        definirStatusFichaCliente('A guardar notas...');
        const { data, error } = await encomendasClient.rpc('guardar_notas_cliente_admin', {
            p_cliente_id: cliente.id,
            p_notas: notas.value
        });
        guardar.disabled = false;
        if (error || data?.sucesso === false) {
            definirStatusFichaCliente('Erro ao guardar notas: ' + (error?.message || data?.erro || 'sem detalhe'), true);
            return;
        }
        definirStatusFichaCliente('Notas guardadas.');
    });
    notasSecao.append(notas, guardar);
    conteudo.append(dadosPessoais, indicadores, perfisSecao, historicoSecao, notasSecao);
}

async function abrirFichaClienteAdmin(encomenda) {
    const modal = document.getElementById('admin-cliente-modal');
    modal.hidden = false;
    document.body.classList.add('admin-cliente-modal-aberto');
    document.getElementById('admin-cliente-conteudo').replaceChildren(
        criarElementoEncomenda('p', 'admin-cliente-carregar', 'A carregar ficha do cliente...')
    );
    definirStatusFichaCliente('');
    const { data, error } = await encomendasClient.rpc('obter_ficha_cliente_admin', {
        p_encomenda_id: String(encomenda.id)
    });
    if (error || data?.sucesso === false) {
        document.getElementById('admin-cliente-conteudo').replaceChildren();
        definirStatusFichaCliente('Erro ao carregar ficha: ' + (error?.message || data?.erro || 'sem detalhe'), true);
        return;
    }
    renderizarFichaClienteAdmin(data);
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
    const confirmado = window.confirm(
        `Concluir ${selecionadas.length} encomenda(s) selecionada(s), eliminar os anexos e emitir os recibos no Moloni?\n\nTotal: ${formatarEuroEncomenda(total)}`
    );
    if (!confirmado) return;

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
            emitirFaturaMoloni: true,
            forcarEmissaoFatura: true,
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
document.getElementById('admin-cliente-fechar').addEventListener('click', fecharFichaClienteAdmin);
(function ligarFechoFundoFichaCliente() {
    const modal = document.getElementById('admin-cliente-modal');
    if (!modal) return;
    ligarFechoModalPorFundo(modal, fecharFichaClienteAdmin);
    modal.querySelector('.admin-cliente-dialogo')?.addEventListener('click', (evento) => evento.stopPropagation());
})();
ligarFechoModalPorFundo(document.getElementById('admin-imagem-modal'), fecharImagemProdutoEncomenda);
document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && !document.getElementById('admin-imagem-modal').hidden) {
        fecharImagemProdutoEncomenda();
    } else if (evento.key === 'Escape' && !document.getElementById('admin-encomenda-modal')?.hidden) {
        fecharModalEncomendaAdmin();
    } else if (evento.key === 'Escape' && !document.getElementById('admin-cliente-modal').hidden) {
        fecharFichaClienteAdmin();
    }
});
