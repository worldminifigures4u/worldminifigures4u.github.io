
const WALLAPOP_SUPABASE_URL = "https://gksndzxadndrsynvzgzb.supabase.co";
const WALLAPOP_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrc25kenhhZG5kcnN5bnZ6Z3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc5NzMsImV4cCI6MjA5NDY2Mzk3M30.EHZgacYr27dqoc4CJHsOwkNnJFGlLIteSHBi4B1HfVE";
const WALLAPOP_ADMIN_EMAILS = ["worldminifigures4u@gmail.com"];
const WALLAPOP_STORAGE_KEY = "figures-planet-wallapop-itens";
const PESO_PADRAO_PLATAFORMA = 10;
const TABELA_PORTES_PLATAFORMA = {
    portugal: [
        { ate: 100, opcoes: [
            { id: 'entrega_tomar', nome: 'Entrega em m\u00e3o em Tomar', valor: 0 },
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 1.75 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 2.20 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 4.50 },
            { id: 'inpost_registado', nome: 'InPost Registado (com seguro de 25\u20ac)', valor: 4.95 }
        ]},
        { ate: 500, opcoes: [
            { id: 'entrega_tomar', nome: 'Entrega em m\u00e3o em Tomar', valor: 0 },
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 2.50 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 3.95 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 5.30 },
            { id: 'inpost_registado', nome: 'InPost Registado (com seguro de 25\u20ac)', valor: 4.95 }
        ]},
        { ate: Infinity, opcoes: [
            { id: 'entrega_tomar', nome: 'Entrega em m\u00e3o em Tomar', valor: 0 },
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 5.75 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 7.95 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 8.95 },
            { id: 'inpost_registado', nome: 'InPost Registado (com seguro de 25\u20ac)', valor: 5.65 }
        ]}
    ],
    espanha: [
        { ate: 100, opcoes: [
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 5.80 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 5.12 }
        ]},
        { ate: 250, opcoes: [
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 7.55 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 5.12 }
        ]},
        { ate: 500, opcoes: [
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 9.80 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 5.12 }
        ]},
        { ate: 1000, opcoes: [
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 13.20 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 5.81 }
        ]},
        { ate: Infinity, opcoes: [
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 21.20 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 6.64 }
        ]}
    ],
    europa: [
        { ate: 100, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 5.80 }] },
        { ate: 250, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 7.55 }] },
        { ate: 500, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 9.80 }] },
        { ate: 1000, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 13.20 }] },
        { ate: Infinity, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 21.20 }] }
    ]
};

const ZONA_PORTES_PLATAFORMA = {
    portugal: 'portugal',
    espanha: 'espanha',
    alemanha: 'europa',
    austria: 'europa',
    belgica: 'europa',
    bulgaria: 'europa',
    chequia: 'europa',
    chipre: 'europa',
    croacia: 'europa',
    dinamarca: 'europa',
    eslovaquia: 'europa',
    eslovenia: 'europa',
    estonia: 'europa',
    finlandia: 'europa',
    franca: 'europa',
    grecia: 'europa',
    hungria: 'europa',
    irlanda: 'europa',
    italia: 'europa',
    letonia: 'europa',
    lituania: 'europa',
    luxemburgo: 'europa',
    malta: 'europa',
    paises_baixos: 'europa',
    polonia: 'europa',
    romenia: 'europa',
    suecia: 'europa'
};

function obterZonaPortesPlataforma(paisEnvio) {
    return ZONA_PORTES_PLATAFORMA[paisEnvio] || 'europa';
}
const WALLAPOP_SEM_IMAGEM = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="100%" height="100%" fill="#f1f1f1"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#777" font-family="Arial" font-size="34">Sem foto</text></svg>'
);

let wallapopClient = null;
let wallapopProdutos = [];
let wallapopItens = carregarItensWallapop();
let wallapopRegistoConcluido = false;
let encomendaPlataformaEmEdicao = null;
let encomendaPlataformaParaFicheiros = null;
let perfilExternoDetetado = null;
let fichaClientePlataformaAtual = null;
let stockNegativoConfirmado = new Set();
const PLATAFORMA_LISTA_MAX_CARACTERES = 30000;
const PLATAFORMA_LISTA_MAX_LINHAS = 500;

function obterTextoOpcaoSelecionada(selectId) {
    const select = document.getElementById(selectId);
    return select?.selectedOptions?.[0]?.textContent?.trim() || select?.value || '';
}

function analisarLinkPerfilPlataforma(valor) {
    const texto = String(valor || '').trim();
    if (!texto) return null;
    let url;
    try { url = new URL(texto); }
    catch (_) { return { erro: 'O link do perfil n\u00e3o \u00e9 v\u00e1lido.' }; }

    if (!['http:', 'https:'].includes(url.protocol)) {
        return { erro: 'O link do perfil deve come\u00e7ar por http:// ou https://.' };
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const dominioValido = dominio => host === dominio || host.endsWith(`.${dominio}`);
    const caminho = decodeURIComponent(url.pathname).replace(/\/+$/, '');
    const regras = [
        { plataforma: 'Wallapop', valido: dominioValido('wallapop.com'), expressao: /\/user\/([^/?#]+)$/i },
        { plataforma: 'OLX', valido: dominioValido('olx.pt'), expressao: /\/ads\/user\/([^/?#]+)$/i },
        { plataforma: 'Todocoleccion', valido: dominioValido('todocoleccion.net'), expressao: /\/usuario\/([^/?#]+)$/i }
    ];
    const regra = regras.find(item => item.valido && item.expressao.test(caminho));
    if (!regra) return { erro: 'Link n\u00e3o reconhecido. Use um perfil Wallapop, OLX ou Todocoleccion.' };
    const correspondencia = caminho.match(regra.expressao);
    return {
        plataforma: regra.plataforma,
        utilizador: correspondencia?.[1] || '',
        url: url.href
    };
}

function atualizarBarraPerfilPlataforma(opcoes = {}) {
    const aviso = document.getElementById('plataforma-perfil-detetado');
    if (!aviso) return;

    const erro = Boolean(opcoes.erro);
    const fichaCarregada = Boolean(opcoes.fichaCarregada);
    const textoPersonalizado = String(opcoes.texto || '').trim();
    const perfil = perfilExternoDetetado;

    if (!textoPersonalizado && !perfil) {
        aviso.hidden = true;
        aviso.textContent = '';
        aviso.classList.remove('erro');
        return;
    }

    aviso.hidden = false;
    aviso.classList.toggle('erro', erro);

    if (textoPersonalizado) {
        aviso.textContent = textoPersonalizado;
        return;
    }

    if (!perfil) {
        aviso.hidden = true;
        aviso.textContent = '';
        return;
    }

    aviso.textContent = fichaCarregada
        ? `\u2713 Ficha carregada \u00b7 ${perfil.plataforma}: ${perfil.utilizador}`
        : `${perfil.plataforma}: ${perfil.utilizador}`;
}

function atualizarPerfilExternoPlataforma() {
    const input = document.getElementById('plataforma-link-perfil');
    const resultado = analisarLinkPerfilPlataforma(input?.value);
    perfilExternoDetetado = resultado && !resultado.erro ? resultado : null;

    if (resultado?.erro) {
        atualizarBarraPerfilPlataforma({ erro: true, texto: resultado.erro });
    } else if (resultado) {
        atualizarBarraPerfilPlataforma({ fichaCarregada: false });
    } else {
        atualizarBarraPerfilPlataforma({});
    }

    if (!perfilExternoDetetado) return;
    fichaClientePlataformaAtual = null;

    const seletor = document.getElementById('plataforma-tipo');
    if (!seletor.disabled) {
        seletor.value = perfilExternoDetetado.plataforma;
        atualizarModoPlataforma();
    }
    document.getElementById('wallapop-nome-cliente').value = perfilExternoDetetado.utilizador;
}

function normalizarTextoPlataforma(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function selecionarPaisEnvioPorTextoPlataforma(pais) {
    const select = document.getElementById('plataforma-pais-envio');
    if (!select || !pais) return;
    const alvo = normalizarTextoPlataforma(pais);
    const option = [...select.options].find(item => (
        normalizarTextoPlataforma(item.textContent) === alvo
        || normalizarTextoPlataforma(item.value) === alvo
    ));
    if (option) {
        select.value = option.value;
        atualizarOpcoesEnvioPlataforma();
    }
}

function preencherClientePlataformaComFicha(dados) {
    fichaClientePlataformaAtual = dados?.sucesso ? dados : null;
    const cliente = fichaClientePlataformaAtual?.cliente || {};
    document.getElementById('wallapop-nome-encomenda').value = cliente.nome || '';
    document.getElementById('plataforma-telefone-cliente').value = cliente.telefone || '';
    document.getElementById('plataforma-morada-cliente').value = cliente.morada || '';
    document.getElementById('plataforma-cp-cliente').value = cliente.cp || '';
    document.getElementById('plataforma-cidade-cliente').value = cliente.cidade || '';
    selecionarPaisEnvioPorTextoPlataforma(cliente.pais);
    renderizarFichaClientePlataforma(dados);
}

function obterPlataformaAtual() {
    return document.getElementById('plataforma-tipo')?.value || 'Wallapop';
}

function obterNomeClientePlataforma() {
    return fichaClientePlataformaAtual?.cliente?.nome
        || document.getElementById('wallapop-nome-encomenda')?.value.trim()
        || '';
}

function obterNomeUtilizadorPlataforma() {
    return document.getElementById('wallapop-nome-cliente')?.value.trim() || '';
}

function obterDadosClientePlataforma() {
    if (obterPlataformaAtual() !== 'OLX') {
        return { telefone: '', morada: '', cp: '', cidade: '', pais: '' };
    }
    const cliente = fichaClientePlataformaAtual?.cliente || {};
    return {
        telefone: cliente.telefone || document.getElementById('plataforma-telefone-cliente')?.value.trim() || '',
        morada: cliente.morada || document.getElementById('plataforma-morada-cliente')?.value.trim() || '',
        cp: cliente.cp || document.getElementById('plataforma-cp-cliente')?.value.trim() || '',
        cidade: cliente.cidade || document.getElementById('plataforma-cidade-cliente')?.value.trim() || '',
        pais: cliente.pais || obterTextoOpcaoSelecionada('plataforma-pais-envio')
    };
}

function limparDadosClientePlataforma() {
    ['plataforma-telefone-cliente', 'plataforma-morada-cliente', 'plataforma-cp-cliente', 'plataforma-cidade-cliente'].forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = '';
    });
}

function obterCodigoEncomendaAtual() {
    return String(
        encomendaPlataformaEmEdicao?.codigo_encomenda
        || encomendaPlataformaParaFicheiros?.codigo_encomenda
        || ''
    ).trim();
}

function obterItensParaFicheirosPlataforma() {
    return encomendaPlataformaParaFicheiros?.itens || wallapopItens;
}

function obterPlataformaParaFicheiros() {
    return encomendaPlataformaParaFicheiros?.plataforma || obterPlataformaAtual();
}

function obterEnvioParaFicheirosPlataforma() {
    return encomendaPlataformaParaFicheiros?.envio || obterEnvioPlataforma();
}

function obterNomeParaFicheirosPlataforma() {
    if (encomendaPlataformaParaFicheiros?.nome_encomenda) {
        return encomendaPlataformaParaFicheiros.nome_encomenda;
    }

    const campoNome = document.getElementById('wallapop-nome-encomenda')?.value.trim() || '';
    const codigo = obterCodigoEncomendaAtual();
    const plataforma = obterPlataformaParaFicheiros();
    if (!codigo) return campoNome;

    const nomeNormalizado = normalizarTextoPlataforma(campoNome);
    const codigoNormalizado = normalizarTextoPlataforma(codigo);
    const plataformaNormalizada = normalizarTextoPlataforma(plataforma);
    if (
        nomeNormalizado.includes(codigoNormalizado)
        && nomeNormalizado.includes(plataformaNormalizada)
    ) {
        return campoNome;
    }

    return comporNomeEncomendaPlataforma(codigo, obterNomeClientePlataforma(), plataforma);
}

function comporNomeEncomendaPlataforma(codigo, cliente, plataforma) {
    return [String(cliente || '').trim(), String(plataforma || '').trim(), String(codigo || '').trim()]
        .filter(Boolean)
        .join(' ');
}

function atualizarBotaoRegistoPlataforma() {
    const botao = document.getElementById('btn-registar-wallapop');
    if (!botao) return;
    botao.textContent = encomendaPlataformaEmEdicao
        ? 'Guardar altera\u00e7\u00f5es'
        : `Registar encomenda ${obterPlataformaAtual()}`;
    botao.disabled = wallapopRegistoConcluido;
}

function formatarEncomendasAnterioresPlataforma(numero) {
    const valor = Math.max(0, Number(numero) || 0);
    if (valor === 0) return 'Primeira encomenda';
    if (valor === 1) return '1 encomenda anterior';
    return `${valor} encomendas anteriores`;
}

function obterEncomendasAnterioresClientePlataforma(dados) {
    const historico = Array.isArray(dados?.historico) ? dados.historico : [];
    const total = Number(
        dados?.resumo?.encomendas
        ?? dados?.numero_encomenda_cliente
        ?? historico.length
        ?? 0
    );
    if (encomendaPlataformaEmEdicao?.id) {
        const incluiAtual = historico.some(item => String(item.id) === String(encomendaPlataformaEmEdicao.id));
        return Math.max(0, incluiAtual ? total - 1 : total);
    }
    return Math.max(0, total);
}

function formatarOrdinalEncomendaPlataforma(numero) {
    const valor = Math.max(0, Number(numero) || 0);
    if (valor <= 0) return '';
    return `${valor}.\u00aa encomenda`;
}

function criarIconeFichaClientePlataforma() {
    const aviso = document.createElement('span');
    aviso.className = 'plataforma-cliente-ficha-alerta';
    aviso.title = 'Ler ficha do cliente antes de preparar a proxima encomenda';
    aviso.setAttribute('aria-label', 'Ler ficha do cliente antes de preparar a proxima encomenda');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('plataforma-cliente-ficha-icone');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    [
        'M9 3h6a2 2 0 0 1 2 2h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1a2 2 0 0 1 2-2Z',
        'M9 5h6v2H9V5Z',
        'M8 11h8',
        'M8 15h8'
    ].forEach(d => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
    });

    aviso.appendChild(svg);
    return aviso;
}

function renderizarFichaClientePlataforma(dados) {
    const caixa = document.getElementById('plataforma-cliente-ficha');
    if (!caixa) return;
    caixa.replaceChildren();
    if (!dados?.sucesso) {
        fichaClientePlataformaAtual = null;
        caixa.hidden = true;
        atualizarBarraPerfilPlataforma({ fichaCarregada: false });
        return;
    }
    fichaClientePlataformaAtual = dados;

    const cliente = dados.cliente || {};
    const linha = document.createElement('div');
    linha.className = 'plataforma-cliente-ficha-linha';

    const nome = document.createElement('span');
    nome.className = 'plataforma-cliente-ficha-nome';
    nome.textContent = cliente.nome || dados.utilizador || 'Cliente externo';
    linha.appendChild(nome);

    const direita = document.createElement('div');
    direita.className = 'plataforma-cliente-ficha-direita';

    const encomendas = document.createElement('span');
    encomendas.className = 'plataforma-cliente-ficha-encomendas';
    encomendas.textContent = formatarEncomendasAnterioresPlataforma(
        obterEncomendasAnterioresClientePlataforma(dados)
    );
    direita.appendChild(encomendas);

    if (cliente.tem_aviso) {
        direita.appendChild(criarIconeFichaClientePlataforma());
    }

    linha.appendChild(direita);

    caixa.appendChild(linha);
    caixa.hidden = false;
    atualizarBarraPerfilPlataforma({ fichaCarregada: true });
}

async function carregarFichaClientePlataforma(encomendaId) {
    if (!encomendaId) return null;
    const { data, error } = await wallapopClient.rpc('obter_ficha_cliente_admin', {
        p_encomenda_id: String(encomendaId)
    });
    if (error || data?.sucesso === false) throw error || new Error(data?.erro || 'Nao foi possivel carregar a ficha do cliente.');
    renderizarFichaClientePlataforma(data);
    return data;
}

async function carregarFichaClientePorPerfilPlataforma() {
    const linkPerfil = document.getElementById('plataforma-link-perfil')?.value.trim() || '';
    if (!linkPerfil || !perfilExternoDetetado) {
        fichaClientePlataformaAtual = null;
        renderizarFichaClientePlataforma(null);
        limparDadosClientePlataforma();
        return null;
    }
    definirStatusWallapop('');
    const { data, error } = await wallapopClient.rpc('obter_ficha_cliente_por_perfil_admin', {
        p_url_perfil: linkPerfil
    });
    if (error || data?.sucesso === false) {
        fichaClientePlataformaAtual = null;
        renderizarFichaClientePlataforma(null);
        limparDadosClientePlataforma();
        atualizarBarraPerfilPlataforma({
            erro: true,
            texto: `Perfil reconhecido (${perfilExternoDetetado.plataforma}: ${perfilExternoDetetado.utilizador}), mas sem ficha de cliente. Crie/edite a ficha na p\u00e1gina Clientes.`
        });
        definirStatusWallapop('');
        return null;
    }
    preencherClientePlataformaComFicha(data);
    definirStatusWallapop('');
    return data;
}

function formatarEuroWallapop(valor) {
    return Number(valor || 0).toFixed(2).replace('.', ',');
}

function calcularSubtotalPlataforma() {
    return wallapopItens.reduce((total, item) => (
        total + Math.max(1, Number(item.quantidade) || 1) * Number(item.preco || 0)
    ), 0);
}

function calcularPesoPlataforma() {
    return wallapopItens.reduce((total, item) => (
        total + Math.max(1, Number(item.quantidade) || 1) * Number(item.peso || PESO_PADRAO_PLATAFORMA)
    ), 0);
}

function obterOpcoesEnvioPlataforma(regiao, peso) {
    if (peso <= 0) return [];
    const zonaEnvio = obterZonaPortesPlataforma(regiao);
    const tabela = TABELA_PORTES_PLATAFORMA[zonaEnvio] || TABELA_PORTES_PLATAFORMA.portugal;
    return (tabela.find(linha => peso <= linha.ate) || tabela[tabela.length - 1]).opcoes;
}

function calcularPortesPlataforma(valorBase) {
    return Math.round(Number(valorBase || 0) * 100) / 100;
}

function obterEnvioPlataforma() {
    const regiao = document.getElementById('plataforma-pais-envio')?.value || 'portugal';
    const peso = calcularPesoPlataforma();
    const opcoes = obterOpcoesEnvioPlataforma(regiao, peso);
    const metodo = document.getElementById('plataforma-metodo-envio')?.value || '';
    const opcao = opcoes.find(item => item.id === metodo) || opcoes[0] || { id: '', nome: '', valor: 0 };
    return { regiao, peso, ...opcao, portes: calcularPortesPlataforma(opcao.valor) };
}

function atualizarOpcoesEnvioPlataforma() {
    const select = document.getElementById('plataforma-metodo-envio');
    if (!select) return;
    const anterior = select.value;
    const regiao = document.getElementById('plataforma-pais-envio')?.value || 'portugal';
    const opcoes = obterOpcoesEnvioPlataforma(regiao, calcularPesoPlataforma());
    select.replaceChildren();
    opcoes.forEach(opcao => {
        const option = document.createElement('option');
        option.value = opcao.id;
        option.textContent = `${opcao.nome} - ${formatarEuroWallapop(calcularPortesPlataforma(opcao.valor))} \u20ac`;
        select.appendChild(option);
    });
    const registado = opcoes.find(opcao => opcao.id === 'ctt_registado');
    select.value = opcoes.some(opcao => opcao.id === anterior) ? anterior : (registado?.id || opcoes[0]?.id || '');
    atualizarResumoPlataforma();
}

function atualizarResumoPlataforma() {
    const subtotal = calcularSubtotalPlataforma();
    const envio = obterEnvioPlataforma();
    const portes = obterPlataformaAtual() === 'OLX' ? envio.portes : 0;
    const peso = document.getElementById('plataforma-peso');
    if (peso) peso.textContent = `Peso estimado: ${envio.peso}g`;
    document.getElementById('plataforma-subtotal').textContent = `${formatarEuroWallapop(subtotal)} \u20ac`;
    document.getElementById('plataforma-portes').textContent = `${formatarEuroWallapop(portes)} \u20ac`;
    document.getElementById('plataforma-total').textContent = `${formatarEuroWallapop(subtotal + portes)} \u20ac`;
}

function atualizarModoPlataforma() {
    const plataforma = obterPlataformaAtual();
    const wallapop = plataforma === 'Wallapop';
    const olx = plataforma === 'OLX';
    document.getElementById('label-cliente-plataforma').textContent = 'Nome de utilizador';
    document.getElementById('wallapop-nome-cliente').placeholder = `Nome ou utilizador no ${plataforma}`;
    document.getElementById('plataforma-envio').hidden = !olx;
    document.getElementById('wallapop-folha-escala').hidden = !wallapop;
    document.getElementById('plataforma-resumo').hidden = true;
    document.getElementById('plataforma-resumo-titulo').textContent = plataforma === 'OLX'
        ? 'Ficheiros OLX'
        : 'Ficheiro Todocoleccion';
    document.getElementById('plataforma-resumo-texto').textContent = plataforma === 'OLX'
        ? 'Ser\u00e3o criados dois TXT: um para enviar ao cliente e outro para a gest\u00e3o interna.'
        : 'Ser\u00e1 criado um TXT interno com quantidade, nome e SKU separados por tabula\u00e7\u00f5es.';
    document.getElementById('btn-descarregar-wallapop').textContent = wallapop
        ? 'Guardar an\u00fancio'
        : (olx ? 'Guardar ficheiros OLX' : 'Guardar ficheiro Todocoleccion');
    atualizarBotaoRegistoPlataforma();
    document.getElementById('plataforma-ajuda-ficheiros').textContent = wallapop
        ? 'Ao guardar, ser\u00e3o criados o PNG e o TXT dentro da pasta da encomenda.'
        : 'Ao guardar, escolhe a pasta de destino. Dentro dela ser\u00e1 criada uma pasta com o nome da encomenda.';
    marcarWallapopPorRegistar();
    if (olx) atualizarOpcoesEnvioPlataforma();
    atualizarResumoPlataforma();
}

function normalizarTextoWallapop(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function distanciaLevenshteinPlataforma(a, b) {
    const primeiro = String(a || '');
    const segundo = String(b || '');
    const linha = Array.from({ length: segundo.length + 1 }, (_, indice) => indice);
    for (let i = 1; i <= primeiro.length; i += 1) {
        let anterior = linha[0];
        linha[0] = i;
        for (let j = 1; j <= segundo.length; j += 1) {
            const guardado = linha[j];
            linha[j] = Math.min(
                linha[j] + 1,
                linha[j - 1] + 1,
                anterior + (primeiro[i - 1] === segundo[j - 1] ? 0 : 1)
            );
            anterior = guardado;
        }
    }
    return linha[segundo.length];
}

function pontuarCorrespondenciaPlataforma(termo, produto) {
    const nome = normalizarTextoWallapop(produto.nome);
    const sku = normalizarTextoWallapop(produto.sku);
    const referencia = normalizarTextoWallapop(produto.referencia);
    if (!termo) return 0;
    if (termo === nome || termo === sku || termo === referencia) return 1;

    const distancia = distanciaLevenshteinPlataforma(termo, nome);
    const similaridade = 1 - (distancia / Math.max(termo.length, nome.length, 1));
    const palavrasTermo = new Set(termo.split(' ').filter(Boolean));
    const palavrasNome = new Set(nome.split(' ').filter(Boolean));
    const comuns = [...palavrasTermo].filter(palavra => palavrasNome.has(palavra)).length;
    const cobertura = comuns / Math.max(palavrasTermo.size, palavrasNome.size, 1);
    const contem = nome.includes(termo) || termo.includes(nome) ? 0.9 : 0;
    return Math.max(similaridade, similaridade * 0.72 + cobertura * 0.28, contem);
}

function linhaProdutosTemQuantidadeExplicitaPlataforma(texto) {
    const linha = String(texto || '').trim().replace(/^[\s\-*\u2022]+/, '');
    return /^\d+\s*(?:x|un(?:id(?:ades?)?)?\.?)\s+.+$/i.test(linha)
        || /^.+?\s+[xX]\s*\d+$/.test(linha);
}

function obterNumeroListaProdutosPlataforma(texto) {
    const linha = String(texto || '').trim().replace(/^[\s\-*\u2022]+/, '');
    if (linhaProdutosTemQuantidadeExplicitaPlataforma(linha)) return null;
    const correspondencia = linha.match(/^(\d+)(?:[.)-]|\s+)\s*(.+)$/);
    if (!correspondencia || !correspondencia[2]?.trim()) return null;
    return Number(correspondencia[1]);
}

function listaProdutosPareceNumeradaPlataforma(linhas) {
    const numeros = linhas
        .map(obterNumeroListaProdutosPlataforma)
        .filter(numero => Number.isInteger(numero));
    if (numeros.length < 2) return false;
    return numeros.every((numero, indice) => numero === indice + 1);
}

function interpretarLinhaProdutosPlataforma(linha, indice, opcoes = {}) {
    let texto = String(linha || '').trim().replace(/^[\s\-*\u2022]+/, '');
    if (!texto) return null;
    let quantidade = 1;
    const inicio = texto.match(/^(\d+)\s*(?:x|un(?:id(?:ades?)?)?\.?|-)??\s+(.+)$/i);
    const fim = texto.match(/^(.+?)\s+[xX]\s*(\d+)$/);
    if (opcoes.ignorarNumeracao && !linhaProdutosTemQuantidadeExplicitaPlataforma(texto)) {
        const numerada = texto.match(/^(\d+)(?:[.)-]|\s+)\s*(.+)$/);
        if (numerada) texto = numerada[2].trim();
    } else if (inicio) {
        quantidade = Math.max(1, Number(inicio[1]) || 1);
        texto = inicio[2].trim();
    } else if (fim) {
        texto = fim[1].trim();
        quantidade = Math.max(1, Number(fim[2]) || 1);
    }
    return { indice, original: texto, quantidade };
}

function analisarListaProdutosPlataforma(texto) {
    const linhasOriginais = String(texto || '')
        .split(/\r?\n/)
        .map(linha => String(linha || '').trim())
        .filter(Boolean);
    const ignorarNumeracao = listaProdutosPareceNumeradaPlataforma(linhasOriginais);
    return linhasOriginais
        .map((linha, indice) => interpretarLinhaProdutosPlataforma(linha, indice, { ignorarNumeracao }))
        .filter(Boolean)
        .map(linha => {
            const termo = normalizarTextoWallapop(linha.original);
            const candidatos = wallapopProdutos
                .map(produto => ({ produto, pontuacao: pontuarCorrespondenciaPlataforma(termo, produto) }))
                .filter(item => item.pontuacao >= 0.48)
                .sort((a, b) => b.pontuacao - a.pontuacao || String(a.produto.nome).localeCompare(String(b.produto.nome), 'pt'))
                .slice(0, 8);
            const melhor = candidatos[0];
            const segundo = candidatos[1];
            const exata = melhor?.pontuacao === 1;
            const segura = Boolean(melhor && melhor.pontuacao >= 0.78
                && (!segundo || melhor.pontuacao - segundo.pontuacao >= 0.045));
            return {
                ...linha,
                candidatos,
                produtoId: exata || segura ? String(melhor.produto.id) : '',
                estado: exata ? 'exata' : (segura ? 'sugerida' : 'rever')
            };
        });
}

function textoOpcaoProdutoPlataforma(produto) {
    const stock = Number.isFinite(Number(produto.stock)) ? Number(produto.stock) : 0;
    return `${produto.nome} (Ref. ${produto.referencia || '-'} | Stock: ${stock})`;
}

function buscarProdutosCatalogoPlataforma(termo, limite = 30) {
    const pesquisa = normalizarTextoWallapop(termo);
    if (!pesquisa) return [];
    return wallapopProdutos
        .map(produto => {
            const nome = normalizarTextoWallapop(produto.nome);
            const sku = normalizarTextoWallapop(produto.sku);
            const referencia = normalizarTextoWallapop(produto.referencia);
            const tema = normalizarTextoWallapop(produto.tema);
            const subtema = normalizarTextoWallapop(produto.subtema);
            const textoCompleto = [nome, sku, referencia, tema, subtema].filter(Boolean).join(' ');
            let prioridade = 0;
            if (sku === pesquisa || referencia === pesquisa) prioridade = 1;
            else if (nome === pesquisa) prioridade = 0.98;
            else if (nome.includes(pesquisa) || pesquisa.includes(nome)) prioridade = 0.92;
            else if (textoCompleto.includes(pesquisa)) prioridade = 0.84;
            else prioridade = pontuarCorrespondenciaPlataforma(pesquisa, produto) * 0.72;
            return { produto, prioridade };
        })
        .filter(item => item.prioridade >= 0.35)
        .sort((a, b) => b.prioridade - a.prioridade || String(a.produto.nome).localeCompare(String(b.produto.nome), 'pt'))
        .slice(0, limite)
        .map(item => item.produto);
}

function preencherSelectProdutosPlataforma(select, produtos, textoVazio, produtoIdSelecionado = '') {
    select.replaceChildren();
    const vazio = document.createElement('option');
    vazio.value = '';
    vazio.textContent = textoVazio;
    select.appendChild(vazio);

    produtos.forEach(produto => {
        const option = document.createElement('option');
        option.value = String(produto.id);
        option.textContent = textoOpcaoProdutoPlataforma(produto);
        select.appendChild(option);
    });
    select.value = produtoIdSelecionado;
}

function fecharRevisaoListaProdutosPlataforma() {
    document.getElementById('plataforma-revisao-lista')?.remove();
    document.body.classList.remove('plataforma-modal-aberto');
}

function adicionarListaRevistaPlataforma(linhas, modal) {
    const selecoes = [...modal.querySelectorAll('[data-linha-lista]')].map((linha, indice) => ({
        produtoId: linha.querySelector('select').value,
        quantidade: linhas[indice].quantidade
    })).filter(item => item.produtoId);

    if (!selecoes.length) {
        modal.querySelector('.plataforma-lista-aviso').textContent = 'Seleciona pelo menos um produto.';
        return;
    }

    const agrupadas = new Map();
    selecoes.forEach(item => agrupadas.set(item.produtoId, (agrupadas.get(item.produtoId) || 0) + item.quantidade));
    let adicionados = 0;
    agrupadas.forEach((quantidade, produtoId) => {
        const produto = wallapopProdutos.find(item => String(item.id) === String(produtoId));
        if (!produto) return;
        const existente = wallapopItens.find(item => String(item.id) === String(produtoId));
        const quantidadeFinal = quantidade;
        if (!confirmarStockNegativoPlataforma(produto, quantidadeFinal)) return;
        if (existente) existente.quantidade = quantidadeFinal;
        else wallapopItens.push({ ...produto, quantidade });
        adicionados += quantidade;
    });

    if (!adicionados) return;
    guardarItensWallapop();
    marcarWallapopPorRegistar();
    renderizarSelecionadosWallapop();
    renderizarFolhaWallapop();
    document.getElementById('plataforma-lista-produtos').value = '';
    fecharRevisaoListaProdutosPlataforma();
    definirStatusWallapop(`${adicionados} produto(s) adicionado(s) a partir da lista.`);
}

function abrirRevisaoListaProdutosPlataforma() {
    const texto = document.getElementById('plataforma-lista-produtos').value;
    if (texto.length > PLATAFORMA_LISTA_MAX_CARACTERES) {
        definirStatusWallapop(`A lista é demasiado grande. Limite: ${PLATAFORMA_LISTA_MAX_CARACTERES.toLocaleString('pt-PT')} caracteres.`, true);
        return;
    }
    const totalLinhas = texto.split(/\r?\n/).filter(linha => linha.trim()).length;
    if (totalLinhas > PLATAFORMA_LISTA_MAX_LINHAS) {
        definirStatusWallapop(`A lista tem demasiadas linhas. Limite: ${PLATAFORMA_LISTA_MAX_LINHAS} figuras por colagem.`, true);
        return;
    }
    const linhas = analisarListaProdutosPlataforma(texto);
    if (!linhas.length) {
        definirStatusWallapop('Cola primeiro uma lista com uma figura por linha.', true);
        return;
    }

    fecharRevisaoListaProdutosPlataforma();
    const modal = document.createElement('div');
    modal.id = 'plataforma-revisao-lista';
    modal.className = 'plataforma-lista-modal';
    const dialogo = document.createElement('div');
    dialogo.className = 'plataforma-lista-dialogo';
    const topo = document.createElement('div');
    topo.className = 'plataforma-lista-topo';
    const titulo = document.createElement('h2');
    titulo.textContent = 'Rever produtos da lista';
    const fechar = document.createElement('button');
    fechar.type = 'button';
    fechar.className = 'wallapop-remover';
    fechar.textContent = '\u00d7';
    fechar.title = 'Fechar';
    fechar.onclick = fecharRevisaoListaProdutosPlataforma;
    topo.append(titulo, fechar);

    const explicacao = document.createElement('p');
    explicacao.textContent = 'Confirma as correspond\u00eancias. As corre\u00e7\u00f5es prov\u00e1veis j\u00e1 est\u00e3o selecionadas; os casos duvidosos ficam por escolher.';
    const lista = document.createElement('div');
    lista.className = 'plataforma-lista-revisao';

    linhas.forEach(linha => {
        const item = document.createElement('div');
        item.className = `plataforma-lista-linha estado-${linha.estado}`;
        item.dataset.linhaLista = String(linha.indice);
        const original = document.createElement('div');
        original.className = 'plataforma-lista-original';
        const quantidade = document.createElement('strong');
        quantidade.textContent = `${linha.quantidade}x`;
        const nome = document.createElement('span');
        nome.textContent = linha.original;
        const estado = document.createElement('small');
        estado.textContent = linha.estado === 'exata'
            ? 'Correspond\u00eancia exata'
            : (linha.estado === 'sugerida' ? 'Corre\u00e7\u00e3o sugerida' : 'Escolha necess\u00e1ria');
        original.append(quantidade, nome, estado);

        const select = document.createElement('select');
        select.setAttribute('aria-label', `Produto correspondente a ${linha.original}`);
        const vazio = document.createElement('option');
        vazio.value = '';
        vazio.textContent = linha.candidatos.length ? 'Ignorar / escolher produto' : 'Nenhuma correspond\u00eancia encontrada';
        select.appendChild(vazio);
        linha.candidatos.forEach(candidato => {
            const option = document.createElement('option');
            option.value = String(candidato.produto.id);
            option.textContent = textoOpcaoProdutoPlataforma(candidato.produto);
            select.appendChild(option);
        });
        select.value = linha.produtoId;
        select.onchange = () => item.classList.toggle('estado-rever', !select.value);

        const seletorArea = document.createElement('div');
        seletorArea.className = 'plataforma-lista-seletor';
        const pesquisaManual = document.createElement('input');
        pesquisaManual.type = 'search';
        pesquisaManual.className = 'plataforma-lista-pesquisa';
        pesquisaManual.placeholder = 'Procurar no catalogo completo';
        pesquisaManual.setAttribute('aria-label', `Procurar produto para ${linha.original}`);
        let pesquisaTimer = null;
        pesquisaManual.addEventListener('input', () => {
            clearTimeout(pesquisaTimer);
            pesquisaTimer = setTimeout(() => {
                const termo = pesquisaManual.value.trim();
                if (!termo) {
                    preencherSelectProdutosPlataforma(
                        select,
                        linha.candidatos.map(candidato => candidato.produto),
                        linha.candidatos.length ? 'Ignorar / escolher produto' : 'Nenhuma correspondencia encontrada',
                        select.value
                    );
                    item.classList.toggle('estado-rever', !select.value);
                    return;
                }
                const resultados = buscarProdutosCatalogoPlataforma(termo);
                preencherSelectProdutosPlataforma(
                    select,
                    resultados,
                    resultados.length ? 'Ignorar / escolher produto' : 'Nenhum produto encontrado no catalogo',
                    resultados.some(produto => String(produto.id) === String(select.value)) ? select.value : ''
                );
                item.classList.toggle('estado-rever', !select.value);
            }, 120);
        });
        seletorArea.append(select, pesquisaManual);
        item.append(original, seletorArea);
        lista.appendChild(item);
    });

    const aviso = document.createElement('p');
    aviso.className = 'plataforma-lista-aviso';
    const acoes = document.createElement('div');
    acoes.className = 'plataforma-lista-acoes';
    const cancelar = document.createElement('button');
    cancelar.type = 'button';
    cancelar.className = 'wallapop-botao';
    cancelar.textContent = 'Cancelar';
    cancelar.onclick = fecharRevisaoListaProdutosPlataforma;
    const adicionar = document.createElement('button');
    adicionar.type = 'button';
    adicionar.className = 'wallapop-botao wallapop-botao-destaque';
    adicionar.textContent = 'Adicionar produtos selecionados';
    adicionar.onclick = () => adicionarListaRevistaPlataforma(linhas, modal);
    acoes.append(cancelar, adicionar);
    dialogo.append(topo, explicacao, lista, aviso, acoes);
    modal.appendChild(dialogo);
    modal.addEventListener('click', evento => {
        if (evento.target === modal) fecharRevisaoListaProdutosPlataforma();
    });
    document.body.appendChild(modal);
    document.body.classList.add('plataforma-modal-aberto');
}

function obterImagemWallapop(produto = {}) {
    let imagens = produto.imagens;
    if (typeof imagens === 'string') {
        try {
            imagens = JSON.parse(imagens);
        } catch (_) {
            imagens = imagens.split(',').map(item => item.trim());
        }
    }
    const url = Array.isArray(imagens) ? imagens.find(Boolean) : '';
    return url || WALLAPOP_SEM_IMAGEM;
}

function otimizarImagemWallapop(url, largura = 500) {
    const original = String(url || '');
    if (!original.includes('res.cloudinary.com/') || !original.includes('/image/upload/')) return original;
    return original.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${largura},c_limit/`);
}

function carregarItensWallapop() {
    try {
        const guardados = JSON.parse(localStorage.getItem(WALLAPOP_STORAGE_KEY) || '[]');
        return Array.isArray(guardados) ? guardados : [];
    } catch (_) {
        return [];
    }
}

function guardarItensWallapop() {
    localStorage.setItem(WALLAPOP_STORAGE_KEY, JSON.stringify(wallapopItens));
}

function marcarWallapopPorRegistar() {
    wallapopRegistoConcluido = false;
    atualizarBotaoRegistoPlataforma();
}

function definirStatusWallapop(texto, erro = false) {
    const elemento = document.getElementById('wallapop-status');
    elemento.textContent = texto || '';
    elemento.classList.remove('status-erro', 'status-sucesso', 'status-aviso', 'status-neutro', 'status-discreto');
    elemento.classList.add(erro ? 'status-erro' : 'status-discreto');
}

async function carregarCatalogoWallapop() {
    const respostaAdmin = await wallapopClient.rpc('listar_produtos_plataforma_admin');
    let produtos = Array.isArray(respostaAdmin.data) ? respostaAdmin.data : [];

    if (respostaAdmin.error) {
        console.warn('Catalogo administrativo indisponivel; a usar catalogo publico.', respostaAdmin.error);
        produtos = [];
        let inicio = 0;
        const tamanho = 500;
        while (true) {
            const { data, error } = await wallapopClient
                .from('produtos_loja')
                .select('id, sku, nome, preco, peso, imagens, ativo')
                .order('nome', { ascending: true })
                .range(inicio, inicio + tamanho - 1);
            if (error) throw error;
            if (!data?.length) break;
            produtos.push(...data.filter(produto => produto.ativo !== false).map(produto => ({
                ...produto,
                stock: null
            })));
            if (data.length < tamanho) break;
            inicio += tamanho;
        }
    }

    wallapopProdutos = produtos;
    wallapopItens = wallapopItens
        .map(item => {
            const produto = produtos.find(atual => String(atual.id) === String(item.id));
            if (produto) return { ...produto, quantidade: Math.max(1, Number(item.quantidade) || 1) };
            return encomendaPlataformaEmEdicao ? item : null;
        })
        .filter(Boolean);
    guardarItensWallapop();
}

function criarImagemWallapop(src, alt, classe) {
    const imagem = document.createElement('img');
    imagem.className = classe;
    imagem.alt = alt;
    imagem.crossOrigin = 'anonymous';
    imagem.src = otimizarImagemWallapop(src);
    imagem.onerror = () => {
        imagem.onerror = null;
        imagem.removeAttribute('crossorigin');
        imagem.src = WALLAPOP_SEM_IMAGEM;
    };
    return imagem;
}

function obterQuantidadeOriginalPlataforma(id) {
    return Number(encomendaPlataformaEmEdicao?.quantidades_originais?.[String(id)] || 0);
}

function obterStockDisponivelPlataforma(produto) {
    if (produto?.stock === null || produto?.stock === undefined) return null;
    const stock = Number(produto?.stock);
    if (!Number.isFinite(stock)) return null;
    return Math.max(stock, 0) + obterQuantidadeOriginalPlataforma(produto.id);
}

function confirmarStockNegativoPlataforma(produto, quantidadePretendida) {
    const disponivel = obterStockDisponivelPlataforma(produto);
    if (disponivel === null || quantidadePretendida <= disponivel) return true;
    const confirmado = window.confirm(
        `O produto "${produto.nome}" nao tem stock suficiente registado.\n\n` +
        `Stock disponivel: ${Math.max(disponivel, 0)}\n` +
        `Quantidade pretendida: ${quantidadePretendida}\n\n` +
        'Confirmas que queres adicionar mesmo assim? O stock ficara negativo.'
    );
    if (confirmado) stockNegativoConfirmado.add(String(produto.id));
    return confirmado;
}

function confirmarFaltasStockPlataforma() {
    for (const item of wallapopItens) {
        const disponivel = obterStockDisponivelPlataforma(item);
        if (disponivel === null || item.quantidade <= disponivel) continue;
        if (stockNegativoConfirmado.has(String(item.id))) continue;
        if (!confirmarStockNegativoPlataforma(item, item.quantidade)) return false;
    }
    return true;
}

function adicionarProdutoWallapop(id) {
    const existente = wallapopItens.find(item => String(item.id) === String(id));
    if (existente) {
        if (!confirmarStockNegativoPlataforma(existente, existente.quantidade + 1)) return;
        existente.quantidade += 1;
    } else {
        const produto = wallapopProdutos.find(item => String(item.id) === String(id));
        if (!produto) return;
        if (!confirmarStockNegativoPlataforma(produto, 1)) return;
        wallapopItens.push({ ...produto, quantidade: 1 });
    }
    guardarItensWallapop();
    marcarWallapopPorRegistar();
    renderizarSelecionadosWallapop();
    renderizarFolhaWallapop();
}

function alterarQuantidadeWallapop(id, diferenca) {
    const item = wallapopItens.find(produto => String(produto.id) === String(id));
    if (!item) return;
    const novaQuantidade = Math.max(1, item.quantidade + diferenca);
    if (diferenca > 0 && !confirmarStockNegativoPlataforma(item, novaQuantidade)) return;
    item.quantidade = novaQuantidade;
    guardarItensWallapop();
    marcarWallapopPorRegistar();
    renderizarSelecionadosWallapop();
    renderizarFolhaWallapop();
}

function removerProdutoWallapop(id) {
    wallapopItens = wallapopItens.filter(item => String(item.id) !== String(id));
    guardarItensWallapop();
    marcarWallapopPorRegistar();
    renderizarSelecionadosWallapop();
    renderizarFolhaWallapop();
}

function moverProdutoWallapop(id, diferenca) {
    const indice = wallapopItens.findIndex(item => String(item.id) === String(id));
    const destino = indice + diferenca;
    if (indice < 0 || destino < 0 || destino >= wallapopItens.length) return;
    [wallapopItens[indice], wallapopItens[destino]] = [wallapopItens[destino], wallapopItens[indice]];
    guardarItensWallapop();
    marcarWallapopPorRegistar();
    renderizarSelecionadosWallapop();
    renderizarFolhaWallapop();
}

function renderizarResultadosWallapop() {
    const termo = normalizarTextoWallapop(document.getElementById('wallapop-pesquisa').value);
    const contentor = document.getElementById('wallapop-resultados');
    contentor.replaceChildren();

    if (!termo) {
        return;
    }

    const resultados = wallapopProdutos.filter(produto =>
        normalizarTextoWallapop(produto.nome).includes(termo) ||
        normalizarTextoWallapop(produto.referencia).includes(termo) ||
        normalizarTextoWallapop(produto.sku).includes(termo)
    ).slice(0, 30);

    resultados.forEach(produto => {
        const linha = document.createElement('div');
        linha.className = 'wallapop-resultado';
        linha.appendChild(criarImagemWallapop(obterImagemWallapop(produto), produto.nome, 'wallapop-miniatura'));

        const info = document.createElement('div');
        info.className = 'wallapop-resultado-info';
        const nome = document.createElement('strong');
        nome.textContent = produto.nome;
        const preco = document.createElement('span');
        preco.className = 'plataforma-produto-preco';
        preco.textContent = `${formatarEuroWallapop(produto.preco)} €`;
        const identificadores = document.createElement('span');
        identificadores.className = 'plataforma-produto-identificadores';
        identificadores.textContent = `Ref. ${produto.referencia || '—'} | SKU ${produto.sku || '—'}`;
        info.append(nome, identificadores);
        if (produto.stock !== null && produto.stock !== undefined && Number.isFinite(Number(produto.stock))) {
            const stock = Number(produto.stock);
            const stockInfo = document.createElement('span');
            stockInfo.className = stock <= 0 ? 'plataforma-sem-stock' : 'plataforma-produto-stock';
            stockInfo.textContent = stock <= 0 ? `Stock: ${stock} | Sem stock` : `Stock: ${stock}`;
            info.appendChild(stockInfo);
        }
        info.appendChild(preco);

        const adicionar = document.createElement('button');
        adicionar.className = 'wallapop-botao wallapop-botao-destaque';
        adicionar.type = 'button';
        adicionar.textContent = 'Adicionar';
        adicionar.onclick = () => adicionarProdutoWallapop(produto.id);
        linha.append(info, adicionar);
        contentor.appendChild(linha);
    });

    if (!resultados.length) {
        const vazio = document.createElement('p');
        vazio.className = 'wallapop-status';
        vazio.textContent = 'Nenhum produto encontrado.';
        contentor.appendChild(vazio);
    }
}

function renderizarSelecionadosWallapop() {
    const contentor = document.getElementById('wallapop-selecionados');
    contentor.replaceChildren();

    wallapopItens.forEach(item => {
        const linha = document.createElement('div');
        linha.className = 'wallapop-selecionado';
        linha.appendChild(criarImagemWallapop(obterImagemWallapop(item), item.nome, 'wallapop-miniatura'));

        const info = document.createElement('div');
        info.className = 'wallapop-selecionado-info';
        const nome = document.createElement('strong');
        nome.textContent = item.nome;
        const preco = document.createElement('span');
        preco.className = 'plataforma-produto-preco';
        preco.textContent = `${formatarEuroWallapop(item.preco)} €`;
        info.append(nome, preco);

        const controlos = document.createElement('div');
        controlos.className = 'wallapop-quantidade';
        const subir = document.createElement('button');
        subir.type = 'button';
        subir.textContent = '↑';
        subir.title = 'Mover para cima';
        subir.onclick = () => moverProdutoWallapop(item.id, -1);
        const descer = document.createElement('button');
        descer.type = 'button';
        descer.textContent = '↓';
        descer.title = 'Mover para baixo';
        descer.onclick = () => moverProdutoWallapop(item.id, 1);
        const menos = document.createElement('button');
        menos.type = 'button';
        menos.textContent = '−';
        menos.title = 'Diminuir quantidade';
        menos.onclick = () => alterarQuantidadeWallapop(item.id, -1);
        const quantidade = document.createElement('strong');
        quantidade.textContent = item.quantidade;
        const mais = document.createElement('button');
        mais.type = 'button';
        mais.textContent = '+';
        mais.title = 'Aumentar quantidade';
        mais.onclick = () => alterarQuantidadeWallapop(item.id, 1);
        const remover = document.createElement('button');
        remover.type = 'button';
        remover.className = 'wallapop-remover';
        remover.textContent = '×';
        remover.title = 'Remover produto';
        remover.onclick = () => removerProdutoWallapop(item.id);
        controlos.append(subir, descer, menos, quantidade, mais, remover);
        linha.append(info, controlos);
        contentor.appendChild(linha);
    });

    if (!wallapopItens.length) {
        const vazio = document.createElement('p');
        vazio.className = 'wallapop-status';
        vazio.textContent = 'A lista está vazia.';
        contentor.appendChild(vazio);
    }
    if (obterPlataformaAtual() === 'OLX') atualizarOpcoesEnvioPlataforma();
    else atualizarResumoPlataforma();
}

let folhaDinamicaWallapop = null;

function definirCssDinamicoWallapop(cssTexto) {
    try {
        if (!('adoptedStyleSheets' in document) || typeof CSSStyleSheet === 'undefined') return;
        if (!folhaDinamicaWallapop) {
            folhaDinamicaWallapop = new CSSStyleSheet();
            document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets || []).concat(folhaDinamicaWallapop);
        }
        if (typeof folhaDinamicaWallapop.replaceSync === 'function') {
            folhaDinamicaWallapop.replaceSync(cssTexto || '');
        }
    } catch (error) {
        console.warn('CSS dinâmico ignorado:', error);
    }
}

const WALLAPOP_ITENS_POR_FOLHA = 10;
const WALLAPOP_LARGURA_FOLHA = 794;
const WALLAPOP_ALTURA_FOLHA = 1123;
const WALLAPOP_ALTURA_FOLHA_MINIMA = Math.ceil(WALLAPOP_ALTURA_FOLHA / 2);
const WALLAPOP_MARGEM_FOLHA = 42;
const WALLAPOP_ALTURA_LINHA = 96;
const WALLAPOP_MARGEM_FINAL = 24;

function dividirItensWallapop(itens, tamanho = WALLAPOP_ITENS_POR_FOLHA) {
    const paginas = [];
    for (let indice = 0; indice < itens.length; indice += tamanho) {
        paginas.push(itens.slice(indice, indice + tamanho));
    }
    return paginas;
}

function calcularAlturaFolhaWallapop(totalItens) {
    const itens = Math.max(1, Math.min(WALLAPOP_ITENS_POR_FOLHA, Number(totalItens) || 0));
    const alturaConteudo = WALLAPOP_MARGEM_FOLHA + (itens * WALLAPOP_ALTURA_LINHA) + WALLAPOP_MARGEM_FINAL;
    return Math.min(
        WALLAPOP_ALTURA_FOLHA,
        Math.max(WALLAPOP_ALTURA_FOLHA_MINIMA, alturaConteudo)
    );
}

function obterEscalaPrevisualizacaoWallapop() {
    const escala = document.getElementById('wallapop-folha-escala');
    if (!escala) return;
    const estilos = getComputedStyle(escala);
    const alturaPagina = parseFloat(estilos.getPropertyValue('--wallapop-preview-page-height')) || 674;
    return alturaPagina / WALLAPOP_ALTURA_FOLHA;
}

function atualizarAlturaPrevisualizacaoWallapop() {
    const escala = document.getElementById('wallapop-folha-escala');
    const folha = document.getElementById('wallapop-folha');
    if (!escala || !folha) return;

    const aplicarAltura = () => {
        const fatorEscala = obterEscalaPrevisualizacaoWallapop() || 0.6;
        const alturaTotal = Math.max(120, Math.ceil(folha.offsetHeight * fatorEscala));
        definirCssDinamicoWallapop(`#wallapop-folha-escala { height: ${alturaTotal}px; }`);
    };

    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(aplicarAltura);
    else aplicarAltura();
}

function criarLinhaFolhaWallapop(item) {
    const linha = document.createElement('article');
    linha.className = 'wallapop-linha';

    const foto = document.createElement('div');
    foto.className = 'wallapop-linha-foto';
    foto.appendChild(criarImagemWallapop(obterImagemWallapop(item), item.nome, ''));

    const quantidade = document.createElement('div');
    quantidade.className = 'wallapop-linha-quantidade';
    quantidade.textContent = `${item.quantidade || 1}x`;

    const nome = document.createElement('h3');
    nome.className = 'wallapop-linha-nome';
    nome.textContent = item.nome;

    const preco = document.createElement('div');
    preco.className = 'wallapop-linha-preco';
    preco.textContent = `${formatarEuroWallapop(item.preco)} € / un.`;

    linha.append(foto, quantidade, nome, preco);
    return linha;
}
function carregarImagemCanvasWallapop(src) {
    return new Promise(resolve => {
        const imagem = new Image();
        const url = otimizarImagemWallapop(src, 320) || WALLAPOP_SEM_IMAGEM;
        if (!url.startsWith('data:')) imagem.crossOrigin = 'anonymous';
        imagem.onload = () => resolve(imagem);
        imagem.onerror = () => {
            const fallback = new Image();
            fallback.onload = () => resolve(fallback);
            fallback.src = WALLAPOP_SEM_IMAGEM;
        };
        imagem.src = url;
    });
}

function desenharImagemContidaWallapop(ctx, imagem, x, y, largura, altura) {
    const origemLargura = imagem.naturalWidth || imagem.width || largura;
    const origemAltura = imagem.naturalHeight || imagem.height || altura;
    const escala = Math.min(largura / origemLargura, altura / origemAltura);
    const destinoLargura = origemLargura * escala;
    const destinoAltura = origemAltura * escala;
    const destinoX = x + (largura - destinoLargura) / 2;
    const destinoY = y + (altura - destinoAltura) / 2;
    ctx.drawImage(imagem, destinoX, destinoY, destinoLargura, destinoAltura);
}

function quebrarTextoCanvasWallapop(ctx, texto, larguraMaxima, maximoLinhas = 2) {
    const palavras = String(texto || '').split(/\s+/).filter(Boolean);
    const linhas = [];
    let linha = '';

    palavras.forEach(palavra => {
        const tentativa = linha ? `${linha} ${palavra}` : palavra;
        if (ctx.measureText(tentativa).width <= larguraMaxima) {
            linha = tentativa;
            return;
        }
        if (linha) linhas.push(linha);
        linha = palavra;
    });
    if (linha) linhas.push(linha);

    if (linhas.length > maximoLinhas) {
        const cortadas = linhas.slice(0, maximoLinhas);
        let ultima = cortadas[maximoLinhas - 1];
        while (ultima.length > 1 && ctx.measureText(`${ultima}...`).width > larguraMaxima) {
            ultima = ultima.slice(0, -1).trimEnd();
        }
        cortadas[maximoLinhas - 1] = `${ultima}...`;
        return cortadas;
    }
    return linhas;
}

async function gerarCanvasFolhaWallapop(itensPagina) {
    const largura = WALLAPOP_LARGURA_FOLHA;
    const altura = calcularAlturaFolhaWallapop(itensPagina.length);
    const escala = 2;
    const margem = WALLAPOP_MARGEM_FOLHA;
    const alturaLinha = WALLAPOP_ALTURA_LINHA;
    const canvas = document.createElement('canvas');
    canvas.width = largura * escala;
    canvas.height = altura * escala;
    const ctx = canvas.getContext('2d');
    ctx.scale(escala, escala);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, largura, altura);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111111';

    for (let indice = 0; indice < itensPagina.length; indice += 1) {
        const item = itensPagina[indice];
        const y = margem + (indice * alturaLinha);
        const centroY = y + (alturaLinha / 2);
        const imagem = await carregarImagemCanvasWallapop(obterImagemWallapop(item));
        desenharImagemContidaWallapop(ctx, imagem, margem, y + 3, 90, 90);

        ctx.font = '700 17px Arial, Helvetica, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${item.quantidade || 1}x`, 152, centroY);

        ctx.font = '700 16px Arial, Helvetica, sans-serif';
        const linhasNome = quebrarTextoCanvasWallapop(ctx, item.nome, 365, 2);
        const linhaAltura = 19;
        const inicioNomeY = centroY - ((linhasNome.length - 1) * linhaAltura / 2);
        linhasNome.forEach((linha, linhaIndice) => {
            ctx.fillText(linha, 210, inicioNomeY + (linhaIndice * linhaAltura));
        });

        ctx.font = '700 16px Arial, Helvetica, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${formatarEuroWallapop(item.preco)} € / un.`, largura - margem, centroY);
    }

    return canvas;
}
function renderizarFolhaWallapop(itens = wallapopItens) {
    const folha = document.getElementById('wallapop-folha');
    folha.replaceChildren();
    const paginas = dividirItensWallapop(itens);

    if (!itens.length) {
        const pagina = document.createElement('section');
        pagina.className = 'wallapop-pagina';
        const vazio = document.createElement('div');
        vazio.className = 'wallapop-vazio';
        vazio.textContent = 'Adicione produtos para criar a imagem.';
        pagina.appendChild(vazio);
        folha.appendChild(pagina);
        atualizarAlturaPrevisualizacaoWallapop();
        return;
    }

    paginas.forEach((itensPagina, indice) => {
        const pagina = document.createElement('section');
        pagina.className = 'wallapop-pagina';
        pagina.setAttribute('aria-label', `Folha A4 ${indice + 1}`);
        const lista = document.createElement('div');
        lista.className = 'wallapop-lista';
        itensPagina.forEach(item => lista.appendChild(criarLinhaFolhaWallapop(item)));
        pagina.appendChild(lista);
        folha.appendChild(pagina);
    });

    atualizarAlturaPrevisualizacaoWallapop();
}

async function esperarImagensWallapop() {
    const imagens = [...document.querySelectorAll('#wallapop-folha img')];
    await Promise.all(imagens.map(imagem => {
        if (imagem.complete) return Promise.resolve();
        return new Promise(resolve => {
            imagem.addEventListener('load', resolve, { once: true });
            imagem.addEventListener('error', resolve, { once: true });
        });
    }));
}

async function obterPastaBaseWallapop() {
    if (!window.showDirectoryPicker) throw new Error('Esta função requer Chrome ou Edge atualizado.');
    return window.showDirectoryPicker({
        id: 'figures-planet-anuncio-destino',
        mode: 'readwrite'
    });
}

function limparNomePastaWallapop(nome) {
    const limpo = String(nome || '')
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
        .replace(/[. ]+$/g, '')
        .slice(0, 100);
    if (!limpo || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(limpo)) return '';
    return limpo;
}

async function escreverFicheiroWallapop(pasta, nome, conteudo) {
    const ficheiro = await pasta.getFileHandle(nome, { create: true });
    const escrita = await ficheiro.createWritable();
    await escrita.write(conteudo);
    await escrita.close();
}

function criarTextoEncomendaWallapop() {
    const itens = obterItensParaFicheirosPlataforma();
    const linhas = criarCabecalhoCodigoEncomenda().concat(itens.map(item => [
        Math.max(1, Number(item.quantidade) || 1),
        String(item.nome || '').trim(),
        String(item.sku || '').trim()
    ].join('\t')));
    const total = itens.reduce((soma, item) => {
        return soma + (Math.max(1, Number(item.quantidade) || 1) * Number(item.preco || 0));
    }, 0);
    linhas.push('', `Total:\t${formatarEuroWallapop(total)} €`);
    return '\ufeff' + linhas.join('\r\n');
}

function criarLinhasDadosClienteOlx() {
    const dadosCliente = encomendaPlataformaParaFicheiros?.cliente || obterDadosClientePlataforma();
    const moradaCliente = [
        dadosCliente.morada,
        dadosCliente.cp,
        dadosCliente.cidade,
        dadosCliente.pais
    ].filter(Boolean).join(', ');
    return [
        `Nome:\t${encomendaPlataformaParaFicheiros?.nome_cliente || obterNomeClientePlataforma()}`,
        `Morada:\t${moradaCliente}`,
        `Telefone:\t${dadosCliente.telefone}`
    ];
}

function criarTextoInternoPlataforma() {
    const linhas = criarCabecalhoCodigoEncomenda().concat(obterItensParaFicheirosPlataforma().map(item => [
        Math.max(1, Number(item.quantidade) || 1),
        String(item.nome || '').trim(),
        String(item.sku || '').trim()
    ].join('\t')));
    if (obterPlataformaParaFicheiros() === 'OLX') {
        const envio = obterEnvioParaFicheirosPlataforma();
        linhas.push(
            '',
            `Envio:\t${envio.nome} - ${formatarEuroWallapop(envio.portes)} \u20ac`,
            '',
            ...criarLinhasDadosClienteOlx()
        );
    }
    return '\ufeff' + linhas.join('\r\n');
}

function criarTextoClienteOlx() {
    const itens = obterItensParaFicheirosPlataforma();
    const envio = obterEnvioParaFicheirosPlataforma();
    const subtotal = itens.reduce((total, item) => (
        total + Math.max(1, Number(item.quantidade) || 1) * Number(item.preco || 0)
    ), 0);
    const linhas = criarCabecalhoCodigoEncomenda().concat(['Produtos:']);
    itens.forEach(item => {
        linhas.push([
            `${Math.max(1, Number(item.quantidade) || 1)}x`,
            String(item.nome || '').trim(),
            `${formatarEuroWallapop(item.preco)} \u20ac / un.`
        ].join('\t'));
    });
    linhas.push(
        '',
        `Portes de envio (${envio.nome}):\t${formatarEuroWallapop(envio.portes)} \u20ac`,
        '',
        `Total geral:\t${formatarEuroWallapop(subtotal + envio.portes)} \u20ac`,
        '',
        ...criarLinhasDadosClienteOlx()
    );
    return '\ufeff' + linhas.join('\r\n');
}

function criarCabecalhoCodigoEncomenda() {
    const codigo = obterCodigoEncomendaAtual();
    return codigo ? [`Pedido ${codigo}`, ''] : [];
}

function validarEncomendaRegistadaParaFicheiros() {
    if (obterCodigoEncomendaAtual()) return true;
    definirStatusWallapop('Registe primeiro a encomenda para incluir o c\u00f3digo nos ficheiros.', true);
    document.getElementById('btn-registar-wallapop')?.focus();
    return false;
}

function canvasParaBlobWallapop(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível gerar o PNG.')), 'image/png');
    });
}

let html2canvasPromessaPlataforma = null;

function garantirHtml2CanvasPlataforma() {
    if (typeof html2canvas === 'function') return Promise.resolve();
    if (html2canvasPromessaPlataforma) return html2canvasPromessaPlataforma;

    html2canvasPromessaPlataforma = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        script.async = true;
        script.onload = () => typeof html2canvas === 'function'
            ? resolve()
            : reject(new Error('A ferramenta de imagem nao ficou disponivel.'));
        script.onerror = () => reject(new Error('Nao foi possivel carregar a ferramenta de imagem.'));
        document.head.appendChild(script);
    });

    return html2canvasPromessaPlataforma;
}

async function descarregarImagemWallapop() {
    if (!validarEncomendaRegistadaParaFicheiros()) return;
    const campoNome = document.getElementById('wallapop-nome-encomenda');
    const nomeEncomenda = limparNomePastaWallapop(obterNomeParaFicheirosPlataforma());
    if (!nomeEncomenda) {
        definirStatusWallapop('Indique um nome válido para a encomenda.', true);
        campoNome.focus();
        return;
    }
    const itensFicheiros = obterItensParaFicheirosPlataforma();
    if (!itensFicheiros.length) {
        definirStatusWallapop('Adicione pelo menos um produto.', true);
        return;
    }
    definirStatusWallapop('A preparar a pasta e os ficheiros...');
    try {
        await garantirHtml2CanvasPlataforma();
        const pastaBase = await obterPastaBaseWallapop();
        const paginasItens = dividirItensWallapop(itensFicheiros);
        if (!paginasItens.length) throw new Error('Nao existem folhas para exportar.');

        const pastaEncomenda = await pastaBase.getDirectoryHandle(nomeEncomenda, { create: true });
        await escreverFicheiroWallapop(pastaEncomenda, `${nomeEncomenda}.txt`, criarTextoEncomendaWallapop());

        for (let indice = 0; indice < paginasItens.length; indice += 1) {
            const canvas = await gerarCanvasFolhaWallapop(paginasItens[indice]);
            const imagem = await canvasParaBlobWallapop(canvas);
            const nomeImagem = paginasItens.length === 1 ? 'foto anuncio.png' : `foto anuncio ${indice + 1}.png`;
            await escreverFicheiroWallapop(pastaEncomenda, nomeImagem, imagem);
        }
        definirStatusWallapop(`Pasta "${nomeEncomenda}" guardada com ${paginasItens.length} imagem(ns).`);
    } catch (error) {
        console.error(error);
        if (error?.name === 'AbortError') {
            definirStatusWallapop('Seleção da pasta cancelada.', true);
            return;
        }
        definirStatusWallapop('Não foi possível guardar a encomenda: ' + (error.message || 'erro desconhecido'), true);
    } finally {
        renderizarFolhaWallapop();
    }
}

async function guardarFicheirosPlataforma() {
    const plataforma = obterPlataformaParaFicheiros();
    if (plataforma === 'Wallapop') {
        await descarregarImagemWallapop();
        return;
    }
    if (!validarEncomendaRegistadaParaFicheiros()) return;

    const campoNome = document.getElementById('wallapop-nome-encomenda');
    const nomeEncomenda = limparNomePastaWallapop(obterNomeParaFicheirosPlataforma());
    if (!nomeEncomenda) {
        definirStatusWallapop('Indique um nome v\u00e1lido para a encomenda.', true);
        campoNome.focus();
        return;
    }
    if (!obterItensParaFicheirosPlataforma().length) {
        definirStatusWallapop('Adicione pelo menos um produto.', true);
        return;
    }

    definirStatusWallapop('A preparar a pasta e os ficheiros...');
    try {
        const pastaBase = await obterPastaBaseWallapop();
        const pastaEncomenda = await pastaBase.getDirectoryHandle(nomeEncomenda, { create: true });
        if (plataforma === 'OLX') {
            await escreverFicheiroWallapop(pastaEncomenda, 'informacao cliente.txt', criarTextoClienteOlx());
            await escreverFicheiroWallapop(pastaEncomenda, `${nomeEncomenda}.txt`, criarTextoInternoPlataforma());
            definirStatusWallapop(`Pasta "${nomeEncomenda}" guardada com os dois ficheiros OLX.`);
        } else {
            await escreverFicheiroWallapop(pastaEncomenda, `${nomeEncomenda}.txt`, criarTextoInternoPlataforma());
            definirStatusWallapop(`Ficheiro Todocoleccion guardado na pasta "${nomeEncomenda}".`);
        }
    } catch (error) {
        console.error(error);
        if (error?.name === 'AbortError') {
            definirStatusWallapop('Sele\u00e7\u00e3o da pasta cancelada.', true);
            return;
        }
        definirStatusWallapop('N\u00e3o foi poss\u00edvel guardar: ' + (error.message || 'erro desconhecido'), true);
    }
}

function obterItensEncomendaWallapop() {
    return wallapopItens.map((item, indice) => ({
        id_produto: String(item.id),
        quantidade: Math.max(1, Number(item.quantidade) || 1),
        ordem: indice,
        permitir_stock_negativo: stockNegativoConfirmado.has(String(item.id))
    }));
}

function extrairCodigoEncomendaDoTxt(conteudo) {
    const correspondencia = String(conteudo || '').match(
        /(?:pedido|c[o\u00f3]digo\s+da\s+encomenda|encomenda)\s*:?\s*([a-z0-9]+)/i
    );
    return correspondencia ? correspondencia[1].toUpperCase() : '';
}

function mostrarEdicaoPlataforma(encomenda) {
    const aviso = document.getElementById('plataforma-edicao');
    if (!aviso) return;
    if (!encomenda) {
        aviso.hidden = true;
        aviso.textContent = '';
        return;
    }
    aviso.textContent = `A editar encomenda ${encomenda.codigo_encomenda} - ${encomenda.origem}`;
    aviso.hidden = false;
}

function obterQuantidadesAtuaisPlataforma() {
    return Object.fromEntries(wallapopItens.map(item => [
        String(item.id),
        Math.max(1, Number(item.quantidade) || 1)
    ]));
}

function obterReducoesStockPlataforma() {
    const originais = encomendaPlataformaEmEdicao?.quantidades_originais || {};
    const atuais = obterQuantidadesAtuaisPlataforma();
    return Object.entries(originais).map(([id, quantidadeOriginal]) => {
        const quantidadeAtual = Number(atuais[id] || 0);
        const produto = wallapopProdutos.find(item => String(item.id) === String(id));
        return {
            id,
            nome: produto?.nome || `Produto ${id}`,
            quantidade: Math.max(0, Number(quantidadeOriginal) - quantidadeAtual)
        };
    }).filter(item => item.quantidade > 0);
}

function perguntarReposicaoStockPlataforma(reducao) {
    return new Promise(resolve => {
        const fundo = document.createElement('div');
        fundo.className = 'plataforma-stock-modal';
        const caixa = document.createElement('div');
        caixa.className = 'plataforma-stock-dialogo';
        const titulo = document.createElement('h2');
        titulo.textContent = 'Ajustar stock';
        const texto = document.createElement('p');
        texto.textContent = `${reducao.quantidade} unidade(s) de "${reducao.nome}" foram retiradas da encomenda. O que aconteceu a estas unidades?`;
        const acoes = document.createElement('div');
        acoes.className = 'plataforma-stock-acoes';

        const terminar = resposta => {
            fundo.remove();
            document.body.classList.remove('plataforma-modal-aberto');
            resolve(resposta);
        };
        const repor = document.createElement('button');
        repor.type = 'button';
        repor.className = 'wallapop-botao wallapop-botao-destaque';
        repor.textContent = 'Repor no stock';
        repor.addEventListener('click', () => terminar(true));
        const naoRepor = document.createElement('button');
        naoRepor.type = 'button';
        naoRepor.className = 'wallapop-botao plataforma-stock-incorreto';
        naoRepor.textContent = 'N\u00e3o repor, stock incorreto';
        naoRepor.addEventListener('click', () => terminar(false));
        const cancelar = document.createElement('button');
        cancelar.type = 'button';
        cancelar.className = 'wallapop-botao';
        cancelar.textContent = 'Cancelar altera\u00e7\u00f5es';
        cancelar.addEventListener('click', () => terminar(null));

        acoes.append(repor, naoRepor, cancelar);
        caixa.append(titulo, texto, acoes);
        fundo.appendChild(caixa);
        document.body.appendChild(fundo);
        document.body.classList.add('plataforma-modal-aberto');
        repor.focus();
    });
}

async function escolherReposicaoStockPlataforma() {
    const naoRepor = [];
    for (const reducao of obterReducoesStockPlataforma()) {
        const resposta = await perguntarReposicaoStockPlataforma(reducao);
        if (resposta === null) return null;
        if (resposta === false) naoRepor.push(reducao.id);
    }
    return naoRepor;
}

async function carregarEncomendaPlataformaPorCodigo(codigo) {
    const codigoNormalizado = String(codigo || '').trim().toUpperCase();
    if (!codigoNormalizado) throw new Error('Indique o c\u00f3digo da encomenda.');

    const { data, error } = await wallapopClient.rpc('obter_encomenda_plataforma_admin', {
        p_codigo_encomenda: codigoNormalizado
    });
    if (error) throw error;
    if (!data?.sucesso || !data?.encomenda) throw new Error(data?.erro || 'Encomenda n\u00e3o encontrada.');

    const encomenda = data.encomenda;
    const catalogo = Array.isArray(data.catalogo_itens) ? data.catalogo_itens : [];
    const produtosEncomenda = Array.isArray(encomenda.produtos) ? encomenda.produtos : [];
    stockNegativoConfirmado = new Set();
    wallapopItens = catalogo.map(produto => {
        const reservado = produtosEncomenda.find(item => String(item.id_produto) === String(produto.id));
        const atual = wallapopProdutos.find(item => String(item.id) === String(produto.id));
        return { ...produto, ...atual, quantidade: Math.max(1, Number(reservado?.quantidade) || 1) };
    });
    encomendaPlataformaEmEdicao = {
        id: encomenda.id,
        codigo_encomenda: encomenda.codigo_encomenda,
        origem: encomenda.origem,
        estado: encomenda.estado,
        quantidades_originais: Object.fromEntries(produtosEncomenda.map(item => [
            String(item.id_produto),
            Math.max(1, Number(item.quantidade) || 1)
        ]))
    };
    encomendaPlataformaParaFicheiros = null;
    wallapopRegistoConcluido = true;

    const seletor = document.getElementById('plataforma-tipo');
    seletor.value = encomenda.origem;
    seletor.disabled = true;
    atualizarModoPlataforma();
    document.getElementById('wallapop-nome-encomenda').value = encomenda.nome_cliente || '';
    document.getElementById('wallapop-nome-cliente').value = '';
    document.getElementById('plataforma-link-perfil').value = encomenda.perfil_externo_url || '';
    atualizarPerfilExternoPlataforma();
    document.getElementById('plataforma-telefone-cliente').value = encomenda.telefone_cliente || '';
    document.getElementById('plataforma-morada-cliente').value = encomenda.morada_cliente || '';
    document.getElementById('plataforma-cp-cliente').value = encomenda.cp_cliente || '';
    document.getElementById('plataforma-cidade-cliente').value = encomenda.cidade_cliente || '';

    if (encomenda.origem === 'OLX') {
        document.getElementById('plataforma-pais-envio').value = encomenda.regiao_envio || 'portugal';
        atualizarOpcoesEnvioPlataforma();
        document.getElementById('plataforma-metodo-envio').value = encomenda.metodo_envio || '';
    }

    guardarItensWallapop();
    mostrarEdicaoPlataforma(encomendaPlataformaEmEdicao);
    atualizarBotaoRegistoPlataforma();
    renderizarResultadosWallapop();
    renderizarSelecionadosWallapop();
    renderizarFolhaWallapop();
    try {
        await carregarFichaClientePlataforma(encomenda.id);
    } catch (error) {
        console.warn('Nao foi possivel carregar a ficha do cliente externo.', error);
        renderizarFichaClientePlataforma(null);
    }
    return encomenda;
}

async function abrirEncomendaPlataformaPeloTxt(evento) {
    const input = evento.currentTarget;
    const ficheiro = input.files?.[0];
    input.value = '';
    if (!ficheiro) return;

    definirStatusWallapop('A abrir a encomenda...');
    try {
        const codigo = extrairCodigoEncomendaDoTxt(await ficheiro.text());
        if (!codigo) throw new Error('O TXT n\u00e3o cont\u00e9m o c\u00f3digo da encomenda. Gere novamente os ficheiros desta encomenda.');

        await carregarEncomendaPlataformaPorCodigo(codigo);
        definirStatusWallapop(`Encomenda ${codigo} aberta. Pode alterar produtos, quantidades e dados.`);
    } catch (error) {
        console.error(error);
        definirStatusWallapop('Erro ao abrir: ' + (error.message || 'erro desconhecido'), true);
    }
}

function novaEncomendaPlataforma() {
    if (wallapopItens.length && !window.confirm('Come\u00e7ar uma nova encomenda e limpar a lista atual?')) return;
    encomendaPlataformaEmEdicao = null;
    stockNegativoConfirmado = new Set();
    wallapopRegistoConcluido = false;
    wallapopItens = [];
    guardarItensWallapop();
    const seletor = document.getElementById('plataforma-tipo');
    seletor.disabled = false;
    document.getElementById('wallapop-nome-encomenda').value = '';
    document.getElementById('wallapop-nome-cliente').value = '';
    document.getElementById('plataforma-link-perfil').value = '';
    limparDadosClientePlataforma();
    perfilExternoDetetado = null;
    fichaClientePlataformaAtual = null;
    atualizarPerfilExternoPlataforma();
    renderizarFichaClientePlataforma(null);
    mostrarEdicaoPlataforma(null);
    atualizarModoPlataforma();
    renderizarSelecionadosWallapop();
    renderizarFolhaWallapop();
    definirStatusWallapop('Nova encomenda pronta.');
}

async function registarEncomendaWallapop() {
    const plataforma = obterPlataformaAtual();
    const eraEdicao = Boolean(encomendaPlataformaEmEdicao);
    const botao = document.getElementById('btn-registar-wallapop');
    const linkPerfil = document.getElementById('plataforma-link-perfil').value.trim();

    if (!linkPerfil) {
        definirStatusWallapop('Cole primeiro o link do perfil do cliente.', true);
        document.getElementById('plataforma-link-perfil').focus();
        return;
    }
    if (linkPerfil) {
        const perfil = analisarLinkPerfilPlataforma(linkPerfil);
        if (!perfil || perfil.erro) {
            definirStatusWallapop(perfil?.erro || 'Link do perfil inv\u00e1lido.', true);
            document.getElementById('plataforma-link-perfil').focus();
            return;
        }
        if (perfil.plataforma !== plataforma) {
            definirStatusWallapop(`O link pertence a ${perfil.plataforma}, mas a encomenda est\u00e1 em ${plataforma}.`, true);
            return;
        }
        perfilExternoDetetado = perfil;
        if (!fichaClientePlataformaAtual) {
            const ficha = await carregarFichaClientePorPerfilPlataforma();
            if (!ficha) {
                document.getElementById('plataforma-link-perfil').focus();
                return;
            }
        }
    }
    const nomeCliente = obterNomeClientePlataforma();

    if (wallapopRegistoConcluido && !encomendaPlataformaEmEdicao) {
        definirStatusWallapop(`Esta encomenda ${plataforma} já foi registada.`, true);
        return;
    }
    if (!nomeCliente) {
        definirStatusWallapop(`Indique o nome ou utilizador do cliente ${plataforma}.`, true);
        document.getElementById('wallapop-nome-encomenda').focus();
        return;
    }
    if (!wallapopItens.length) {
        definirStatusWallapop('Adicione pelo menos um produto.', true);
        return;
    }
    if (!confirmarFaltasStockPlataforma()) {
        definirStatusWallapop('Encomenda n\u00e3o registada. Confirma primeiro os produtos sem stock.', true);
        return;
    }

    const envio = plataforma === 'OLX' ? obterEnvioPlataforma() : { regiao: '', id: '', nome: '', portes: 0 };
    const dadosCliente = obterDadosClientePlataforma();
    const total = calcularSubtotalPlataforma() + envio.portes;
    const naoReporStock = encomendaPlataformaEmEdicao
        ? await escolherReposicaoStockPlataforma()
        : [];
    if (naoReporStock === null) {
        definirStatusWallapop('Altera\u00e7\u00f5es n\u00e3o guardadas.');
        return;
    }
    const confirmado = window.confirm(encomendaPlataformaEmEdicao
        ? `Guardar as alterações da encomenda ${obterCodigoEncomendaAtual()}? O stock será ajustado automaticamente.`
        : `Registar a encomenda ${plataforma} de ${nomeCliente} por ${formatarEuroWallapop(total)} € e descontar o stock?`
    );
    if (!confirmado) return;

    botao.disabled = true;
    definirStatusWallapop(encomendaPlataformaEmEdicao
        ? 'A validar o stock e guardar as alterações...'
        : 'A validar o stock e registar a encomenda...');
    try {
        const parametros = {
            p_itens: obterItensEncomendaWallapop(),
            p_nome_cliente: nomeCliente,
            p_referencia_externa: null,
            p_regiao_envio: envio.regiao || null,
            p_metodo_envio: envio.id || null,
            p_metodo_envio_nome: envio.nome || null,
            p_portes: envio.portes || 0,
            p_telefone_cliente: dadosCliente.telefone || null,
            p_morada_cliente: dadosCliente.morada || null,
            p_cp_cliente: dadosCliente.cp || null,
            p_cidade_cliente: dadosCliente.cidade || null,
            p_pais_cliente: dadosCliente.pais || null
        };
        const nomeFuncao = encomendaPlataformaEmEdicao
            ? 'atualizar_encomenda_plataforma_admin'
            : 'criar_encomenda_plataforma_admin';
        if (encomendaPlataformaEmEdicao) {
            parametros.p_encomenda_id = String(encomendaPlataformaEmEdicao.id);
            parametros.p_nao_repor_ids = naoReporStock;
        } else {
            parametros.p_plataforma = plataforma;
        }
        const { data, error } = await wallapopClient.rpc(nomeFuncao, parametros);
        if (error) throw error;

        if (!data?.sucesso) {
            const indisponiveis = Array.isArray(data?.produtos_sem_stock)
                ? data.produtos_sem_stock.map(item => item.nome).filter(Boolean)
                : [];
            throw new Error(indisponiveis.length
                ? `Stock insuficiente: ${indisponiveis.join(', ')}.`
                : 'Não foi possível validar o stock.');
        }

        wallapopRegistoConcluido = true;
        const codigo = data.encomenda?.codigo_encomenda || obterCodigoEncomendaAtual();
        let avisoPerfil = '';
        if (linkPerfil) {
            const associacao = await wallapopClient.rpc('associar_perfil_encomenda_admin', {
                p_encomenda_id: String(data.encomenda?.id || encomendaPlataformaEmEdicao?.id),
                p_url_perfil: linkPerfil
            });
            if (associacao.error || associacao.data?.sucesso === false) {
                avisoPerfil = ' A encomenda foi guardada, mas o perfil do cliente n\u00e3o ficou associado.';
                console.error('Erro ao associar perfil externo:', associacao.error || associacao.data);
            } else {
                renderizarFichaClientePlataforma(associacao.data);
                const numeroCliente = Number(associacao.data?.resumo?.encomendas || associacao.data?.numero_encomenda_cliente || 0);
                if (numeroCliente > 1) avisoPerfil = ` ${formatarOrdinalEncomendaPlataforma(numeroCliente)} deste cliente.`;
            }
        } else {
            renderizarFichaClientePlataforma(null);
        }
        const encomendaGuardada = {
            id: data.encomenda?.id || encomendaPlataformaEmEdicao?.id,
            codigo_encomenda: codigo,
            origem: data.encomenda?.origem || plataforma,
            estado: data.encomenda?.estado || 'A aguardar pagamento',
            quantidades_originais: obterQuantidadesAtuaisPlataforma()
        };
        if (eraEdicao) {
            encomendaPlataformaEmEdicao = encomendaGuardada;
            encomendaPlataformaParaFicheiros = null;
            document.getElementById('plataforma-tipo').disabled = true;
            document.getElementById('wallapop-nome-encomenda').value = comporNomeEncomendaPlataforma(codigo, nomeCliente, plataforma);
            mostrarEdicaoPlataforma(encomendaPlataformaEmEdicao);
            atualizarBotaoRegistoPlataforma();
            definirStatusWallapop(`Encomenda ${codigo} guardada. O stock foi atualizado.${avisoPerfil}`);
        } else {
            const nomeEncomendaAutomatico = comporNomeEncomendaPlataforma(codigo, nomeCliente, plataforma);
            encomendaPlataformaParaFicheiros = {
                codigo_encomenda: codigo,
                plataforma,
                nome_cliente: nomeCliente,
                nome_encomenda: nomeEncomendaAutomatico,
                envio: { ...envio },
                cliente: { ...dadosCliente },
                itens: wallapopItens.map(item => ({
                    ...item,
                    imagens: Array.isArray(item.imagens) ? [...item.imagens] : item.imagens
                }))
            };
            encomendaPlataformaEmEdicao = null;
            wallapopRegistoConcluido = false;
            wallapopItens = [];
            stockNegativoConfirmado = new Set();
            guardarItensWallapop();
            document.getElementById('plataforma-tipo').disabled = false;
            document.getElementById('wallapop-nome-encomenda').value = '';
            document.getElementById('wallapop-nome-cliente').value = '';
            document.getElementById('plataforma-link-perfil').value = '';
            limparDadosClientePlataforma();
            perfilExternoDetetado = null;
            fichaClientePlataformaAtual = null;
            atualizarPerfilExternoPlataforma();
            mostrarEdicaoPlataforma(null);
            atualizarModoPlataforma();
            definirStatusWallapop(`Encomenda ${codigo} guardada e lista limpa. Pode guardar os ficheiros da encomenda anterior ou iniciar a seguinte.${avisoPerfil}`);
        }
        await carregarCatalogoWallapop();
        renderizarResultadosWallapop();
        renderizarSelecionadosWallapop();
        renderizarFolhaWallapop();
    } catch (error) {
        console.error(error);
        botao.disabled = false;
        definirStatusWallapop('Erro ao registar: ' + (error.message || 'erro desconhecido'), true);
    }
}

function limparListaWallapop() {
    if (!wallapopItens.length || !window.confirm('Limpar todos os produtos desta imagem?')) return;
    wallapopItens = [];
    guardarItensWallapop();
    marcarWallapopPorRegistar();
    renderizarSelecionadosWallapop();
    renderizarFolhaWallapop();
    definirStatusWallapop('Lista limpa.');
}

async function iniciarWallapopAdmin() {
    const bloqueio = document.getElementById('wallapop-bloqueio');
    try {
        if (typeof supabase === 'undefined') throw new Error('A biblioteca Supabase não carregou.');
        wallapopClient = supabase.createClient(WALLAPOP_SUPABASE_URL, WALLAPOP_SUPABASE_KEY);
        const { data: { user }, error } = await wallapopClient.auth.getUser();
        if (error || !user || !WALLAPOP_ADMIN_EMAILS.includes(String(user.email || '').toLowerCase())) {
            bloqueio.textContent = 'Acesso reservado ao administrador. A regressar à conta...';
            setTimeout(() => window.location.replace('conta.html'), 1400);
            return;
        }

        mostrarNavegacaoAdminValidada();
        await carregarCatalogoWallapop();
        bloqueio.hidden = true;
        document.getElementById('wallapop-aplicacao').hidden = false;
        renderizarResultadosWallapop();
        renderizarSelecionadosWallapop();
        renderizarFolhaWallapop();
        atualizarModoPlataforma();

        const codigoEditar = new URLSearchParams(window.location.search).get('editar');
        if (codigoEditar) {
            try {
                definirStatusWallapop('A abrir a encomenda...');
                const encomenda = await carregarEncomendaPlataformaPorCodigo(codigoEditar);
                definirStatusWallapop(`Encomenda ${encomenda.codigo_encomenda} aberta. Pode alterar produtos, quantidades e dados.`);
            } catch (error) {
                console.error(error);
                definirStatusWallapop('Erro ao abrir: ' + (error.message || 'erro desconhecido'), true);
            }
        }
    } catch (error) {
        console.error(error);
        bloqueio.textContent = 'Erro ao abrir a ferramenta: ' + (error.message || 'sem detalhe disponível');
    }
}

document.getElementById('wallapop-pesquisa').addEventListener('input', renderizarResultadosWallapop);
document.getElementById('btn-analisar-lista-produtos').addEventListener('click', abrirRevisaoListaProdutosPlataforma);
document.getElementById('btn-limpar-wallapop').addEventListener('click', limparListaWallapop);
document.getElementById('btn-descarregar-wallapop').addEventListener('click', guardarFicheirosPlataforma);
document.getElementById('btn-registar-wallapop').addEventListener('click', registarEncomendaWallapop);
document.getElementById('btn-abrir-encomenda-txt')?.addEventListener('click', () => {
    document.getElementById('ficheiro-encomenda-txt')?.click();
});
document.getElementById('ficheiro-encomenda-txt')?.addEventListener('change', abrirEncomendaPlataformaPeloTxt);
document.getElementById('btn-nova-encomenda-plataforma')?.addEventListener('click', novaEncomendaPlataforma);
document.getElementById('wallapop-nome-encomenda').addEventListener('input', marcarWallapopPorRegistar);
document.getElementById('wallapop-nome-cliente').addEventListener('input', marcarWallapopPorRegistar);
document.getElementById('plataforma-telefone-cliente')?.addEventListener('input', marcarWallapopPorRegistar);
document.getElementById('plataforma-morada-cliente')?.addEventListener('input', marcarWallapopPorRegistar);
document.getElementById('plataforma-cp-cliente')?.addEventListener('input', marcarWallapopPorRegistar);
document.getElementById('plataforma-cidade-cliente')?.addEventListener('input', marcarWallapopPorRegistar);
document.getElementById('plataforma-tipo').addEventListener('change', atualizarModoPlataforma);
document.getElementById('plataforma-link-perfil').addEventListener('input', () => {
    atualizarPerfilExternoPlataforma();
    marcarWallapopPorRegistar();
    clearTimeout(window.__plataformaPerfilTimer);
    window.__plataformaPerfilTimer = setTimeout(() => {
        carregarFichaClientePorPerfilPlataforma().catch(error => {
            console.error('Erro ao carregar ficha pelo perfil.', error);
            definirStatusWallapop('Erro ao carregar ficha do cliente: ' + (error.message || 'sem detalhe'), true);
        });
    }, 350);
});
document.getElementById('plataforma-pais-envio').addEventListener('change', atualizarOpcoesEnvioPlataforma);
document.getElementById('plataforma-metodo-envio').addEventListener('change', () => {
    marcarWallapopPorRegistar();
    atualizarResumoPlataforma();
});
window.addEventListener('load', iniciarWallapopAdmin);

