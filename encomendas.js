const ENCOMENDAS_SUPABASE_URL = "https://gksndzxadndrsynvzgzb.supabase.co";
const ENCOMENDAS_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrc25kenhhZG5kcnN5bnZ6Z3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc5NzMsImV4cCI6MjA5NDY2Mzk3M30.EHZgacYr27dqoc4CJHsOwkNnJFGlLIteSHBi4B1HfVE";
const ENCOMENDAS_ADMIN_EMAILS = ["worldminifigures4u@gmail.com"];
const ESTADOS_ENCOMENDA = [
    'A aguardar pagamento',
    'Pago',
    'Em preparação',
    'Enviado',
    'Concluído',
    'Cancelado'
];

let encomendasClient = null;
let encomendasAdmin = [];
let imagensProdutosEncomendas = new Map();
let imagensProdutosEncomendasPorSku = new Map();

const ENCOMENDAS_SEM_IMAGEM = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" fill="#222"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#888" font-family="Arial" font-size="13">Sem foto</text></svg>'
);

function normalizarEncomenda(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function formatarEuroEncomenda(valor) {
    return Number(valor || 0).toFixed(2).replace('.', ',') + ' €';
}

function formatarDataEncomenda(valor) {
    if (!valor) return 'Data indisponível';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return String(valor);
    return new Intl.DateTimeFormat('pt-PT', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }).format(data);
}

function estadoNormalizadoEncomenda(estado) {
    return String(estado || '').toLowerCase() === 'pendente'
        ? 'A aguardar pagamento'
        : (estado || 'A aguardar pagamento');
}

function definirStatusEncomendas(texto, erro = false) {
    const status = document.getElementById('status-encomendas-admin');
    status.textContent = texto || '';
    status.classList.toggle('msg-erro', erro);
    status.classList.toggle('msg-sucesso', Boolean(texto) && !erro);
}

function criarElementoEncomenda(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function obterProdutosEncomenda(encomenda) {
    let produtos = encomenda.produtos;
    if (typeof produtos === 'string') {
        try { produtos = JSON.parse(produtos); } catch (_) { produtos = []; }
    }
    return Array.isArray(produtos) ? produtos : [];
}

function obterPrimeiraImagemEncomenda(imagens) {
    let lista = imagens;
    if (typeof lista === 'string') {
        try { lista = JSON.parse(lista); }
        catch (_) { lista = lista.split(',').map(item => item.trim()).filter(Boolean); }
    }
    return Array.isArray(lista) ? String(lista.find(Boolean) || '') : '';
}

function otimizarMiniaturaEncomenda(url) {
    const original = String(url || '');
    if (!original.includes('res.cloudinary.com/') || !original.includes('/image/upload/')) return original;
    return original.replace('/image/upload/', '/image/upload/f_auto,q_auto,w_120,h_120,c_fit/');
}

function obterImagemProdutoEncomenda(item) {
    return imagensProdutosEncomendas.get(String(item.id_produto || item.id || ''))
        || imagensProdutosEncomendasPorSku.get(String(item.sku || '').toUpperCase())
        || '';
}

function abrirImagemProdutoEncomenda(url, nome) {
    if (!url) return;
    const modal = document.getElementById('admin-imagem-modal');
    const foto = document.getElementById('admin-imagem-modal-foto');
    foto.src = url;
    foto.alt = nome || 'Fotografia do produto';
    modal.hidden = false;
    document.body.classList.add('admin-imagem-modal-aberto');
    document.getElementById('admin-imagem-modal-fechar').focus();
}

function fecharImagemProdutoEncomenda() {
    const modal = document.getElementById('admin-imagem-modal');
    const foto = document.getElementById('admin-imagem-modal-foto');
    modal.hidden = true;
    foto.removeAttribute('src');
    document.body.classList.remove('admin-imagem-modal-aberto');
}

function criarMiniaturaProdutoEncomenda(item) {
    const url = obterImagemProdutoEncomenda(item);
    const botao = criarElementoEncomenda('button', 'admin-encomenda-produto-foto');
    botao.type = 'button';
    botao.title = url ? 'Ampliar fotografia' : 'Produto sem fotografia';
    botao.disabled = !url;
    const imagem = document.createElement('img');
    imagem.src = url ? otimizarMiniaturaEncomenda(url) : ENCOMENDAS_SEM_IMAGEM;
    imagem.alt = item.nome || 'Produto';
    imagem.loading = 'lazy';
    imagem.onerror = () => {
        imagem.onerror = null;
        imagem.src = ENCOMENDAS_SEM_IMAGEM;
        botao.disabled = true;
    };
    if (url) botao.addEventListener('click', () => abrirImagemProdutoEncomenda(url, item.nome));
    botao.appendChild(imagem);
    return botao;
}

function textoProdutosEncomenda(encomenda) {
    return obterProdutosEncomenda(encomenda).map(item => {
        const quantidade = Number(item.quantidade || item.qtd || 1);
        const nome = item.nome || 'Produto';
        const sku = item.sku ? ` (${item.sku})` : '';
        const preco = Number(item.preco_unitario ?? item.preco ?? 0);
        return `${quantidade}x ${nome}${sku} - ${formatarEuroEncomenda(preco)}`;
    }).join('\n');
}

function textoCompletoEncomenda(encomenda) {
    const morada = [encomenda.morada_cliente, encomenda.cp_cliente, encomenda.cidade_cliente, encomenda.pais_cliente]
        .filter(Boolean).join(', ');
    return [
        `Encomenda: ${encomenda.codigo_encomenda || encomenda.id}`,
        `Data: ${formatarDataEncomenda(encomenda.created_at)}`,
        `Estado: ${estadoNormalizadoEncomenda(encomenda.estado)}`,
        `Origem: ${encomenda.origem || 'Site'}`,
        encomenda.referencia_externa ? `Referência: ${encomenda.referencia_externa}` : '',
        '',
        `Cliente: ${encomenda.nome_cliente || ''}`,
        `E-mail: ${encomenda.email_cliente || ''}`,
        `Telemóvel: ${encomenda.telefone_cliente || ''}`,
        `Morada: ${morada}`,
        '',
        `Envio: ${encomenda.metodo_envio_nome || encomenda.metodo_envio || ''}`,
        `Portes: ${formatarEuroEncomenda(encomenda.portes)}`,
        `Pagamento: ${encomenda.metodo_pagamento || ''}`,
        '',
        'Produtos:',
        textoProdutosEncomenda(encomenda),
        '',
        `Total: ${formatarEuroEncomenda(encomenda.total)}`
    ].join('\n');
}

async function copiarEncomendaAdmin(encomenda) {
    try {
        await navigator.clipboard.writeText(textoCompletoEncomenda(encomenda));
        definirStatusEncomendas(`Encomenda ${encomenda.codigo_encomenda || ''} copiada.`);
    } catch (_) {
        definirStatusEncomendas('Não foi possível copiar os dados.', true);
    }
}

async function atualizarEstadoEncomendaAdmin(encomenda, estado, select) {
    const estadoAnterior = estadoNormalizadoEncomenda(encomenda.estado);
    const origem = String(encomenda.origem || 'Site').toLowerCase();
    const plataformaExterna = ['wallapop', 'olx', 'todocoleccion'].includes(origem);
    let reporStock = false;

    if (estadoAnterior === 'Cancelado' && encomenda.stock_reposto && estado !== 'Cancelado') {
        select.value = estadoAnterior;
        definirStatusEncomendas('Esta encomenda foi cancelada com reposição de stock e não pode ser reaberta.', true);
        return;
    }

    if (estado === 'Cancelado' && plataformaExterna) {
        if (!window.confirm(`Cancelar esta encomenda ${encomenda.origem}?`)) {
            select.value = estadoAnterior;
            return;
        }
        reporStock = !encomenda.stock_reposto && window.confirm(
            'Pretende repor no stock as unidades desta encomenda?'
        );
    }

    select.disabled = true;
    definirStatusEncomendas('A atualizar o estado...');
    try {
        const chamada = estado === 'Cancelado' && plataformaExterna
            ? encomendasClient.rpc('cancelar_encomenda_plataforma_admin', {
                p_encomenda_id: String(encomenda.id),
                p_repor_stock: reporStock
            })
            : encomendasClient.rpc('atualizar_estado_encomenda_admin', {
                p_encomenda_id: String(encomenda.id),
                p_estado: estado
            });
        const { data, error } = await chamada;
        if (error) throw error;
        if (data?.sucesso === false) throw new Error(data.erro || 'Não foi possível atualizar.');
        encomenda.estado = estado;
        if (data?.stock_reposto) encomenda.stock_reposto = true;
        select.dataset.estadoAtual = estado;
        atualizarResumoEncomendas();
        renderizarEncomendasAdmin();
        definirStatusEncomendas(`Estado da encomenda ${encomenda.codigo_encomenda || ''} atualizado.`);
    } catch (error) {
        select.value = estadoAnterior;
        definirStatusEncomendas('Erro ao atualizar estado: ' + (error.message || 'sem detalhe'), true);
    } finally {
        select.disabled = false;
    }
}

function criarLinhaDetalhe(rotulo, valor) {
    const linha = criarElementoEncomenda('div', 'admin-encomenda-detalhe-linha');
    linha.append(
        criarElementoEncomenda('strong', '', rotulo),
        criarElementoEncomenda('span', '', valor || '—')
    );
    return linha;
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

function renderizarFormularioClienteExterno(dados, secao) {
    const cliente = dados.cliente || {};
    const formulario = document.createElement('form');
    formulario.className = 'admin-cliente-formulario';
    formulario.append(
        criarCampoEdicaoCliente('Nome', 'nome', cliente.nome, 'text', true),
        criarCampoEdicaoCliente('E-mail', 'email', cliente.email, 'email'),
        criarCampoEdicaoCliente('Telem\u00f3vel', 'telefone', cliente.telefone),
        criarCampoEdicaoCliente('Morada', 'morada', cliente.morada),
        criarCampoEdicaoCliente('C\u00f3digo postal', 'cp', cliente.cp),
        criarCampoEdicaoCliente('Cidade', 'cidade', cliente.cidade),
        criarCampoEdicaoCliente('Pa\u00eds', 'pais', cliente.pais)
    );

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
        const { data, error } = await encomendasClient.rpc('atualizar_cliente_externo_admin', {
            p_cliente_id: cliente.id,
            p_nome: String(campos.get('nome') || ''),
            p_email: String(campos.get('email') || ''),
            p_telefone: String(campos.get('telefone') || ''),
            p_morada: String(campos.get('morada') || ''),
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
        dados.cliente = data.cliente;
        renderizarFichaClienteAdmin(dados);
        definirStatusFichaCliente('Dados do cliente atualizados.');
    });

    secao.replaceChildren(criarElementoEncomenda('h3', '', 'Editar dados do cliente'), formulario);
    formulario.querySelector('input[name="nome"]').focus();
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
        criarCampoFichaCliente('Nome', cliente.nome),
        criarCampoFichaCliente('E-mail', cliente.email),
        criarCampoFichaCliente('Telem\u00f3vel', cliente.telefone),
        criarCampoFichaCliente('Morada', [cliente.morada, cliente.cp, cliente.cidade, cliente.pais].filter(Boolean).join(', '))
    );
    dadosPessoais.appendChild(grelha);
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
            link.href = perfil.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            listaPerfis.appendChild(link);
        });
    }
    perfisSecao.appendChild(listaPerfis);

    const historicoSecao = criarElementoEncomenda('section', 'admin-cliente-secao');
    historicoSecao.appendChild(criarElementoEncomenda('h3', '', 'Hist\u00f3rico de encomendas'));
    const listaHistorico = criarElementoEncomenda('div', 'admin-cliente-historico');
    historico.forEach(item => {
        const linha = criarElementoEncomenda('div', 'admin-cliente-historico-linha');
        linha.append(
            criarElementoEncomenda('strong', '', item.codigo || `#${item.id}`),
            criarElementoEncomenda('span', '', item.origem || 'Site'),
            criarElementoEncomenda('span', '', item.estado || ''),
            criarElementoEncomenda('span', '', formatarDataEncomenda(item.data)),
            criarElementoEncomenda('strong', '', formatarEuroEncomenda(item.total))
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
    const card = criarElementoEncomenda('article', 'admin-encomenda-card');
    const cabecalho = criarElementoEncomenda('div', 'admin-encomenda-cabecalho');
    cabecalho.tabIndex = 0;
    cabecalho.setAttribute('role', 'button');

    const identificacao = criarElementoEncomenda('div', 'admin-encomenda-identificacao');
    identificacao.append(
        criarElementoEncomenda('strong', '', encomenda.codigo_encomenda || `#${encomenda.id}`),
        criarElementoEncomenda('span', '', formatarDataEncomenda(encomenda.created_at)),
        criarElementoEncomenda('span', 'admin-encomenda-origem', encomenda.origem || 'Site')
    );
    const cliente = criarElementoEncomenda('div', 'admin-encomenda-cliente');
    const abrirCliente = criarElementoEncomenda('button', 'admin-encomenda-cliente-link', encomenda.nome_cliente || 'Cliente sem nome');
    abrirCliente.type = 'button';
    abrirCliente.title = 'Abrir ficha do cliente';
    abrirCliente.addEventListener('click', evento => {
        evento.stopPropagation();
        abrirFichaClienteAdmin(encomenda);
    });
    abrirCliente.addEventListener('keydown', evento => evento.stopPropagation());
    cliente.appendChild(abrirCliente);
    if (encomenda.email_cliente) {
        const abrirClienteEmail = criarElementoEncomenda('button', 'admin-encomenda-cliente-email', encomenda.email_cliente);
        abrirClienteEmail.type = 'button';
        abrirClienteEmail.title = 'Abrir ficha do cliente';
        abrirClienteEmail.addEventListener('click', evento => {
            evento.stopPropagation();
            abrirFichaClienteAdmin(encomenda);
        });
        abrirClienteEmail.addEventListener('keydown', evento => evento.stopPropagation());
        cliente.appendChild(abrirClienteEmail);
    }
    const resumo = criarElementoEncomenda('div', 'admin-encomenda-valor');
    resumo.append(
        criarElementoEncomenda('strong', '', formatarEuroEncomenda(encomenda.total)),
        criarElementoEncomenda('span', `estado-encomenda estado-${normalizarEncomenda(estadoNormalizadoEncomenda(encomenda.estado)).replace(/\s+/g, '-')}`, estadoNormalizadoEncomenda(encomenda.estado))
    );
    cabecalho.append(identificacao, cliente, resumo, criarElementoEncomenda('span', 'admin-encomenda-seta', '▾'));

    const detalhes = criarElementoEncomenda('div', 'admin-encomenda-detalhes');
    detalhes.hidden = true;
    cabecalho.addEventListener('click', () => {
        detalhes.hidden = !detalhes.hidden;
        card.classList.toggle('aberta', !detalhes.hidden);
    });
    cabecalho.addEventListener('keydown', evento => {
        if (evento.key !== 'Enter' && evento.key !== ' ') return;
        evento.preventDefault();
        detalhes.hidden = !detalhes.hidden;
        card.classList.toggle('aberta', !detalhes.hidden);
    });

    const dados = criarElementoEncomenda('div', 'admin-encomenda-dados');
    const morada = [encomenda.morada_cliente, encomenda.cp_cliente, encomenda.cidade_cliente, encomenda.pais_cliente]
        .filter(Boolean).join(', ');
    dados.append(
        criarLinhaDetalhe('Nome', encomenda.nome_cliente),
        criarLinhaDetalhe('E-mail', encomenda.email_cliente),
        criarLinhaDetalhe('Telemóvel', encomenda.telefone_cliente),
        criarLinhaDetalhe('Morada', morada),
        criarLinhaDetalhe('Envio', encomenda.metodo_envio_nome || encomenda.metodo_envio),
        criarLinhaDetalhe('Portes', formatarEuroEncomenda(encomenda.portes)),
        criarLinhaDetalhe('Pagamento', encomenda.metodo_pagamento)
    );
    if (encomenda.referencia_externa) {
        dados.appendChild(criarLinhaDetalhe('Referência externa', encomenda.referencia_externa));
    }
    if (encomenda.stock_reposto) {
        dados.appendChild(criarLinhaDetalhe('Stock', 'Reposto após cancelamento'));
    }

    const produtos = criarElementoEncomenda('div', 'admin-encomenda-produtos');
    produtos.appendChild(criarElementoEncomenda('h3', '', 'Produtos'));
    const lista = criarElementoEncomenda('div', 'admin-encomenda-produtos-lista');
    obterProdutosEncomenda(encomenda).forEach(item => {
        const linha = criarElementoEncomenda('div', 'admin-encomenda-produto');
        const quantidade = Number(item.quantidade || item.qtd || 1);
        const preco = Number(item.preco_unitario ?? item.preco ?? 0);
        linha.append(
            criarElementoEncomenda('span', 'admin-encomenda-produto-quantidade', `${quantidade}x`),
            criarElementoEncomenda('strong', 'admin-encomenda-produto-nome', item.nome || 'Produto'),
            criarMiniaturaProdutoEncomenda(item),
            criarElementoEncomenda('span', 'admin-encomenda-produto-sku', item.sku || '—'),
            criarElementoEncomenda('span', 'admin-encomenda-produto-preco', formatarEuroEncomenda(preco))
        );
        lista.appendChild(linha);
    });
    produtos.append(lista, criarElementoEncomenda('p', 'admin-encomenda-total', `Total: ${formatarEuroEncomenda(encomenda.total)}`));

    const acoes = criarElementoEncomenda('div', 'admin-encomenda-acoes');
    const grupoEstado = criarElementoEncomenda('label', 'admin-encomenda-estado-edicao');
    grupoEstado.appendChild(criarElementoEncomenda('span', '', 'Estado'));
    const select = document.createElement('select');
    const estadoAtual = estadoNormalizadoEncomenda(encomenda.estado);
    ESTADOS_ENCOMENDA.forEach(estado => {
        const option = new Option(estado, estado, false, estado === estadoAtual);
        select.add(option);
    });
    select.dataset.estadoAtual = estadoAtual;
    select.addEventListener('change', () => atualizarEstadoEncomendaAdmin(encomenda, select.value, select));
    grupoEstado.appendChild(select);
    const copiar = criarElementoEncomenda('button', 'wallapop-botao', 'Copiar dados');
    copiar.type = 'button';
    copiar.addEventListener('click', () => copiarEncomendaAdmin(encomenda));
    const botoes = criarElementoEncomenda('div', 'admin-encomenda-botoes');
    const origem = normalizarEncomenda(encomenda.origem);
    const plataformaExterna = ['wallapop', 'olx', 'todocoleccion'].includes(origem);
    const podeEditar = plataformaExterna
        && estadoNormalizadoEncomenda(encomenda.estado) !== 'Cancelado'
        && encomenda.codigo_encomenda;
    if (podeEditar) {
        const editar = criarElementoEncomenda('a', 'wallapop-botao admin-encomenda-editar', 'Editar encomenda');
        editar.href = `plataforma.html?editar=${encodeURIComponent(encomenda.codigo_encomenda)}`;
        botoes.appendChild(editar);
    }
    botoes.appendChild(copiar);
    acoes.append(grupoEstado, botoes);

    detalhes.append(dados, produtos, acoes);
    card.append(cabecalho, detalhes);
    return card;
}

function encomendasFiltradasAdmin() {
    const pesquisa = normalizarEncomenda(document.getElementById('pesquisa-encomendas-admin').value);
    const estado = document.getElementById('filtro-estado-encomendas-admin').value;
    return encomendasAdmin.filter(encomenda => {
        const correspondeEstado = estado === 'todos' || estadoNormalizadoEncomenda(encomenda.estado) === estado;
        const texto = normalizarEncomenda([
            encomenda.codigo_encomenda,
            encomenda.nome_cliente,
            encomenda.email_cliente,
            encomenda.origem,
            encomenda.referencia_externa
        ].join(' '));
        return correspondeEstado && (!pesquisa || texto.includes(pesquisa));
    });
}

function renderizarEncomendasAdmin() {
    const lista = document.getElementById('lista-encomendas-admin');
    const filtradas = encomendasFiltradasAdmin();
    lista.replaceChildren();
    document.getElementById('contagem-encomendas-admin').textContent = `${filtradas.length} encomenda(s) apresentada(s)`;
    if (!filtradas.length) {
        lista.appendChild(criarElementoEncomenda('p', 'admin-encomendas-vazio', 'Nenhuma encomenda encontrada.'));
        return;
    }
    filtradas.forEach(encomenda => lista.appendChild(criarCardEncomenda(encomenda)));
}

function atualizarResumoEncomendas() {
    const contar = estado => encomendasAdmin.filter(item => estadoNormalizadoEncomenda(item.estado) === estado).length;
    document.getElementById('encomendas-total').textContent = encomendasAdmin.length;
    document.getElementById('encomendas-pendentes').textContent = contar('A aguardar pagamento');
    document.getElementById('encomendas-preparacao').textContent = contar('Em preparação');
    document.getElementById('encomendas-enviadas').textContent = contar('Enviado');
}

async function carregarEncomendasAdmin() {
    definirStatusEncomendas('A carregar encomendas...');
    const { data, error } = await encomendasClient
        .from('encomendas')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    encomendasAdmin = data || [];
    await carregarImagensProdutosEncomendas();
    atualizarResumoEncomendas();
    renderizarEncomendasAdmin();
    definirStatusEncomendas('');
}

async function carregarImagensProdutosEncomendas() {
    imagensProdutosEncomendas = new Map();
    imagensProdutosEncomendasPorSku = new Map();
    const ids = [...new Set(encomendasAdmin.flatMap(obterProdutosEncomenda)
        .map(item => String(item.id_produto || item.id || ''))
        .filter(Boolean))];
    if (!ids.length) return;

    for (let inicio = 0; inicio < ids.length; inicio += 200) {
        const loteIds = ids.slice(inicio, inicio + 200);
        let produtos = [];
        const respostaAdmin = await encomendasClient.rpc('obter_imagens_produtos_encomendas_admin', {
            p_ids: loteIds
        });

        if (!respostaAdmin.error) {
            produtos = Array.isArray(respostaAdmin.data) ? respostaAdmin.data : [];
        } else {
            // Mantem o painel funcional antes de a RPC administrativa ser instalada.
            const respostaPublica = await encomendasClient
                .from('produtos_loja')
                .select('id, sku, imagens')
                .in('id', loteIds);
            if (respostaPublica.error) {
                console.warn('Nao foi possivel carregar fotografias das encomendas.', respostaPublica.error);
                continue;
            }
            produtos = respostaPublica.data || [];
        }

        produtos.forEach(produto => {
            const imagem = obterPrimeiraImagemEncomenda(produto.imagens);
            if (!imagem) return;
            imagensProdutosEncomendas.set(String(produto.id), imagem);
            if (produto.sku) imagensProdutosEncomendasPorSku.set(String(produto.sku).toUpperCase(), imagem);
        });
    }
}

async function iniciarPainelEncomendas() {
    const bloqueio = document.getElementById('encomendas-bloqueio');
    try {
        if (typeof supabase === 'undefined') throw new Error('A biblioteca Supabase não carregou.');
        encomendasClient = supabase.createClient(ENCOMENDAS_SUPABASE_URL, ENCOMENDAS_SUPABASE_KEY);
        const { data: { user }, error } = await encomendasClient.auth.getUser();
        if (error || !user || !ENCOMENDAS_ADMIN_EMAILS.includes(String(user.email || '').toLowerCase())) {
            bloqueio.textContent = 'Acesso reservado ao administrador. A regressar à conta...';
            setTimeout(() => window.location.replace('conta.html'), 1400);
            return;
        }
        bloqueio.hidden = true;
        document.getElementById('encomendas-aplicacao').hidden = false;
        await carregarEncomendasAdmin();
    } catch (error) {
        console.error(error);
        bloqueio.hidden = false;
        bloqueio.textContent = 'Erro ao abrir o painel: ' + (error.message || 'sem detalhe disponível');
    }
}

document.getElementById('pesquisa-encomendas-admin').addEventListener('input', renderizarEncomendasAdmin);
document.getElementById('filtro-estado-encomendas-admin').addEventListener('change', renderizarEncomendasAdmin);
document.getElementById('btn-atualizar-encomendas').addEventListener('click', async () => {
    try { await carregarEncomendasAdmin(); }
    catch (error) { definirStatusEncomendas('Erro ao carregar: ' + (error.message || 'sem detalhe'), true); }
});
document.getElementById('admin-imagem-modal-fechar').addEventListener('click', fecharImagemProdutoEncomenda);
document.getElementById('admin-cliente-fechar').addEventListener('click', fecharFichaClienteAdmin);
document.getElementById('admin-cliente-modal').addEventListener('click', evento => {
    if (evento.target === evento.currentTarget) fecharFichaClienteAdmin();
});
document.getElementById('admin-imagem-modal').addEventListener('click', evento => {
    if (evento.target === evento.currentTarget) fecharImagemProdutoEncomenda();
});
document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && !document.getElementById('admin-imagem-modal').hidden) {
        fecharImagemProdutoEncomenda();
    } else if (evento.key === 'Escape' && !document.getElementById('admin-cliente-modal').hidden) {
        fecharFichaClienteAdmin();
    }
});
window.addEventListener('load', iniciarPainelEncomendas);
