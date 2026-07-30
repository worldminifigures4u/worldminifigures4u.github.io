
const FORNECEDORES_STORAGE_KEY = "figures-planet-fornecedores-pedidos";
const FORNECEDORES_SELECAO_KEY = "figures-planet-fornecedores-selecao";
const FORNECEDORES_FICHAS_KEY = "figures-planet-fornecedores-fichas";
const FORNECEDORES_SEM_IMAGEM = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="8" fill="#eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="13" fill="#777">Sem foto</text></svg>');

const FORNECEDORES_FICHAS_PADRAO = [
    { nome: "Lote 50", contacto: "", notas: "", ativo: true },
    { nome: "Ruishengtu", contacto: "", notas: "", ativo: true },
    { nome: "Leguoguo", contacto: "", notas: "", ativo: true },
    { nome: "Chuangyaoke", contacto: "", notas: "", ativo: true },
    { nome: "Kopf", contacto: "", notas: "", ativo: true },
    { nome: "Brixtoy", contacto: "", notas: "", ativo: true },
];

var fornecedoresClient = null;
var fornecedorProdutos = [];
var fornecedorSelecao = carregarSelecaoFornecedor();
var fornecedorPedidos = carregarPedidosFornecedores();
var fornecedorFichas = carregarFichasFornecedores();
var fornecedorMapaOrdenacao = { coluna: "stock", direcao: "asc" };
var fornecedorPedidoItensOrdenacao = { coluna: "nome", direcao: "asc" };
var fornecedorResumoEncomenda = { totalFiltrados: 0, apresentados: 0, limite: 250 };
var fornecedorRenderizacaoPendente = null;
var FORNECEDOR_LISTA_MAX_CARACTERES = 30000;
var FORNECEDOR_LISTA_MAX_LINHAS = 500;
var fornecedorPedidosAbertos = new Set();
var fornecedorPedidoAlvoJuntar = null;


function carregarScriptAdmin(src) {
    return new Promise(function (resolve, reject) {
        const existente = document.querySelector('script[data-admin-chunk="' + src + '"]');
        if (existente) {
            if (existente.dataset.loaded === "1") return resolve();
            existente.addEventListener("load", function () { resolve(); });
            existente.addEventListener("error", function () { reject(new Error("Falha ao carregar " + src)); });
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.dataset.adminChunk = src;
        script.onload = function () {
            script.dataset.loaded = "1";
            resolve();
        };
        script.onerror = function () { reject(new Error("Falha ao carregar " + src)); };
        document.body.appendChild(script);
    });
}

var __fornecedoresProdutoPromessa = null;
var __fornecedoresEdicaoPromessa = null;
var __fornecedoresPrintPromessa = null;

function garantirFornecedoresProdutoModal() {
    if (window.FornecedoresProdutoModal) return Promise.resolve();
    if (!__fornecedoresProdutoPromessa) {
        __fornecedoresProdutoPromessa = carregarScriptAdmin("fornecedores-produto-modal.js?v=20260730-fecho-fundo");
    }
    return __fornecedoresProdutoPromessa;
}

function garantirFornecedoresEdicaoPedido() {
    if (window.FornecedoresEdicaoPedido) return Promise.resolve();
    if (!__fornecedoresEdicaoPromessa) {
        __fornecedoresEdicaoPromessa = carregarScriptAdmin("fornecedores-edicao-pedido.js?v=20260730-fecho-fundo");
    }
    return __fornecedoresEdicaoPromessa;
}

function garantirFornecedoresPrintReceive() {
    if (window.FornecedoresPrintReceive) return Promise.resolve();
    if (!__fornecedoresPrintPromessa) {
        __fornecedoresPrintPromessa = carregarScriptAdmin("fornecedores-print-receive.js?v=20260721-split");
    }
    return __fornecedoresPrintPromessa;
}

async function abrirEdicaoProdutoMapa() {
    await garantirFornecedoresProdutoModal();
    return window.FornecedoresProdutoModal.abrir.apply(null, arguments);
}

async function abrirEdicaoPedidoFornecedor() {
    await garantirFornecedoresEdicaoPedido();
    return window.FornecedoresEdicaoPedido.abrir.apply(null, arguments);
}

async function imprimirPedidoFornecedor() {
    await garantirFornecedoresPrintReceive();
    return window.FornecedoresPrintReceive.imprimir.apply(null, arguments);
}

async function receberPedidoFornecedor() {
    await garantirFornecedoresPrintReceive();
    return window.FornecedoresPrintReceive.receber.apply(null, arguments);
}

async function exportarTxtPedidoFornecedor() {
    await garantirFornecedoresPrintReceive();
    return window.FornecedoresPrintReceive.exportarTxt.apply(null, arguments);
}

async function exportarTxtItensFornecedor() {
    await garantirFornecedoresPrintReceive();
    return window.FornecedoresPrintReceive.exportarTxtItens.apply(null, arguments);
}

async function exportarTxtTextoFornecedor() {
    await garantirFornecedoresPrintReceive();
    return window.FornecedoresPrintReceive.exportarTxtTexto.apply(null, arguments);
}

function normalizarFornecedor(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function formatarEuroFornecedor(valor) {
    return Number(valor || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20ac';
}

function normalizarSkuFornecedor(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

function obterBooleanoProdutoFornecedor(valor) {
    if (valor === true) return true;
    if (valor === false || valor === null || valor === undefined) return false;
    const texto = normalizarFornecedor(valor);
    return ['1', 'sim', 's', 'x', 'yes', 'y', 'true', 'verdadeiro'].includes(texto);
}

function itemPedidoEhNovaNotaFornecedor(item) {
    // Só a flag novidade gravada na encomenda (snapshot); não usa stock.
    return obterBooleanoProdutoFornecedor(item?.novidade);
}

function obterNovidadeParaItemPedidoFornecedor(produtoOuItem) {
    return obterBooleanoProdutoFornecedor(produtoOuItem?.novidade);
}

function definirStatusFornecedor(texto, erro = false) {
    const el = document.getElementById('fornecedores-status');
    if (!el) return;
    el.textContent = texto || '';
    el.classList.remove('status-erro', 'status-sucesso', 'status-aviso', 'status-neutro', 'status-discreto');
    el.classList.add(erro ? 'status-erro' : 'status-sucesso');
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

function normalizarFichaFornecedor(ficha, indice = 0) {
    const nome = String(ficha?.nome || ficha?.fornecedor || "").trim();
    if (!nome) return null;
    return {
        id: String(ficha?.id || normalizarChaveFornecedor(nome) || `fornecedor-${indice}`),
        nome,
        contacto: String(ficha?.contacto || ficha?.link || ""),
        notas: String(ficha?.notas || ""),
        ativo: ficha?.ativo !== false
    };
}

function obterChaveCanonicaFichaFornecedor(nome) {
    return normalizarChaveFornecedor(nome);
}

function obterCamposProdutoFornecedor() {
    return fornecedorFichas
        .filter(ficha => ficha.ativo !== false)
        .map(ficha => ({
            chave: normalizarChaveFornecedor(ficha.nome),
            rotulo: ficha.nome
        }))
        .filter(campo => campo.chave && campo.rotulo);
}

function combinarFichasFornecedoresComPadrao(fichas = []) {
    const mapa = new Map();

    FORNECEDORES_FICHAS_PADRAO
        .map(normalizarFichaFornecedor)
        .filter(Boolean)
        .forEach(ficha => mapa.set(obterChaveCanonicaFichaFornecedor(ficha.nome), ficha));

    fichas
        .map(normalizarFichaFornecedor)
        .filter(Boolean)
        .forEach(ficha => {
            const chave = obterChaveCanonicaFichaFornecedor(ficha.nome);
            const padrao = mapa.get(chave);
            mapa.set(chave, {
                ...(padrao || {}),
                ...ficha,
                id: ficha.id || padrao?.id
            });
        });

    return [...mapa.values()];
}

function carregarFichasFornecedores() {
    try {
        const dados = JSON.parse(localStorage.getItem(FORNECEDORES_FICHAS_KEY) || "[]");
        const fichas = Array.isArray(dados)
            ? dados.map(normalizarFichaFornecedor).filter(Boolean)
            : [];
        return combinarFichasFornecedoresComPadrao(fichas);
    } catch (_) {
        return combinarFichasFornecedoresComPadrao([]);
    }
}

function guardarFichasFornecedoresLocal() {
    localStorage.setItem(FORNECEDORES_FICHAS_KEY, JSON.stringify(fornecedorFichas));
}

async function carregarFichasFornecedoresRemotas() {
    if (!fornecedoresClient) return;
    try {
        const { data, error } = await fornecedoresClient
            .from("fornecedores_admin")
            .select("id,nome,contacto,notas,ativo")
            .order("nome", { ascending: true });
        if (error) throw error;
        const fichas = (data || []).map(normalizarFichaFornecedor).filter(Boolean);
        if (fichas.length) {
            fornecedorFichas = combinarFichasFornecedoresComPadrao(fichas);
            guardarFichasFornecedoresLocal();
        }
    } catch (error) {
        console.warn("Fichas de fornecedores indisponiveis no Supabase; a usar copia local.", error);
    }
}

function obterFichaFornecedorPorId(id) {
    return fornecedorFichas.find(ficha => String(ficha.id) === String(id));
}

function obterFichaFornecedorPorNome(nome) {
    const alvo = normalizarChaveFornecedor(nome);
    return fornecedorFichas.find(ficha => normalizarChaveFornecedor(ficha.nome) === alvo);
}

function renderizarFornecedoresGuardados() {
    const selectPedido = document.getElementById("fornecedor-nome");
    const selectMarcacao = document.getElementById("fornecedor-filtro-marcacao-fornecedor");
    const selectFicha = document.getElementById("fornecedor-ficha-lista");
    const valorAtual = selectPedido?.value || "";
    const valorMarcacaoAtual = selectMarcacao?.value || "mesmo";

    if (selectPedido) {
        selectPedido.replaceChildren();
        fornecedorFichas
            .filter(ficha => ficha.ativo)
            .forEach(ficha => {
                const option = document.createElement("option");
                option.value = ficha.nome;
                option.textContent = ficha.nome;
                selectPedido.appendChild(option);
            });
        if (valorAtual && Array.from(selectPedido.options).some(option => option.value === valorAtual)) {
            selectPedido.value = valorAtual;
        }
    }

    if (selectMarcacao) {
        selectMarcacao.replaceChildren();
        const opcaoMesma = document.createElement("option");
        opcaoMesma.value = "mesmo";
        opcaoMesma.textContent = "Encomenda";
        selectMarcacao.appendChild(opcaoMesma);
        fornecedorFichas
            .filter(ficha => ficha.ativo)
            .forEach(ficha => {
                const option = document.createElement("option");
                option.value = ficha.nome;
                option.textContent = ficha.nome;
                selectMarcacao.appendChild(option);
            });
        if (valorMarcacaoAtual && Array.from(selectMarcacao.options).some(option => option.value === valorMarcacaoAtual)) {
            selectMarcacao.value = valorMarcacaoAtual;
        } else {
            selectMarcacao.value = "mesmo";
        }
    }

    if (selectFicha) {
        selectFicha.replaceChildren();
        fornecedorFichas.forEach(ficha => {
            const option = document.createElement("option");
            option.value = ficha.id;
            option.textContent = ficha.ativo ? ficha.nome : `${ficha.nome} (inativo)`;
            selectFicha.appendChild(option);
        });
        if (fornecedorFichas.length && !selectFicha.value) {
            selectFicha.value = fornecedorFichas[0].id;
        }
    }
}

function preencherFormularioFichaFornecedor(ficha = null) {
    const atual = ficha || fornecedorFichas[0] || { id: "", nome: "", contacto: "", notas: "", ativo: true };
    const id = document.getElementById("fornecedor-ficha-id");
    const nome = document.getElementById("fornecedor-ficha-nome");
    const contacto = document.getElementById("fornecedor-ficha-contacto");
    const notas = document.getElementById("fornecedor-ficha-notas");
    const ativo = document.getElementById("fornecedor-ficha-ativo");
    if (id) id.value = atual.id || "";
    if (nome) nome.value = atual.nome || "";
    if (contacto) contacto.value = atual.contacto || "";
    if (notas) notas.value = atual.notas || "";
    if (ativo) ativo.checked = atual.ativo !== false;
}

function novaFichaFornecedor() {
    preencherFormularioFichaFornecedor({ id: "", nome: "", contacto: "", notas: "", ativo: true });
    document.getElementById("fornecedor-ficha-lista").value = "";
    document.getElementById("fornecedor-ficha-nome")?.focus();
}

function abrirModalFichaFornecedor() {
    const modal = document.getElementById("fornecedor-ficha-modal");
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add("fornecedor-ficha-modal-aberto");
    document.getElementById("fornecedor-ficha-nome")?.focus();
}

function fecharModalFichaFornecedor() {
    const modal = document.getElementById("fornecedor-ficha-modal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("fornecedor-ficha-modal-aberto");
}

function editarFornecedorSelecionado() {
    const nome = document.getElementById("fornecedor-nome")?.value || "";
    const ficha = obterFichaFornecedorPorNome(nome);
    if (ficha) {
        preencherFormularioFichaFornecedor(ficha);
        const selectFicha = document.getElementById("fornecedor-ficha-lista");
        if (selectFicha) selectFicha.value = ficha.id;
    } else {
        preencherFormularioFichaFornecedor({ id: "", nome, contacto: "", notas: "", ativo: true });
        document.getElementById("fornecedor-ficha-lista").value = "";
    }
    abrirModalFichaFornecedor();
}

async function apagarFichaFornecedor() {
    const idAtual = document.getElementById("fornecedor-ficha-id")?.value || "";
    const ficha = obterFichaFornecedorPorId(idAtual);
    if (!ficha) {
        definirStatusFornecedor("Escolha um fornecedor guardado para apagar.", true);
        return;
    }

    const confirmou = window.confirm(`Apagar o fornecedor "${ficha.nome}"?\n\nIsto remove a ficha do fornecedor, mas nao apaga produtos nem encomendas ja criadas.`);
    if (!confirmou) return;

    try {
        if (!fornecedoresClient) throw new Error("Supabase indisponivel.");
        const { error } = await fornecedoresClient
            .from("fornecedores_admin")
            .delete()
            .eq("id", ficha.id);
        if (error) throw error;
        definirStatusFornecedor("Fornecedor apagado.");
    } catch (error) {
        console.warn("Nao foi possivel apagar ficha no Supabase; removida localmente.", error);
        definirStatusFornecedor("Fornecedor removido apenas neste navegador. Verifique o Supabase se ele voltar a aparecer.", true);
    }

    fornecedorFichas = combinarFichasFornecedoresComPadrao(
        fornecedorFichas.filter(item => String(item.id) !== String(ficha.id))
    );
    guardarFichasFornecedoresLocal();
    renderizarFornecedoresGuardados();
    preencherFormularioFichaFornecedor();
    fecharModalFichaFornecedor();
    renderizarResultadosFornecedor();
}

async function guardarFichaFornecedor(evento) {
    evento.preventDefault();
    const idAtual = document.getElementById("fornecedor-ficha-id")?.value || "";
    const nome = document.getElementById("fornecedor-ficha-nome")?.value.trim() || "";
    const contacto = document.getElementById("fornecedor-ficha-contacto")?.value.trim() || "";
    const notas = document.getElementById("fornecedor-ficha-notas")?.value.trim() || "";
    const ativo = document.getElementById("fornecedor-ficha-ativo")?.checked !== false;
    if (!nome) {
        definirStatusFornecedor("Indique o nome do fornecedor.", true);
        return;
    }

    const duplicado = fornecedorFichas.some(ficha =>
        String(ficha.id) !== String(idAtual)
        && obterChaveCanonicaFichaFornecedor(ficha.nome) === obterChaveCanonicaFichaFornecedor(nome)
    );
    if (duplicado) {
        definirStatusFornecedor("Ja existe uma ficha com esse fornecedor.", true);
        return;
    }

    const ficha = normalizarFichaFornecedor({ id: idAtual || normalizarChaveFornecedor(nome), nome, contacto, notas, ativo });
    try {
        const { data, error } = await fornecedoresClient
            .from("fornecedores_admin")
            .upsert(ficha, { onConflict: "id" })
            .select("id,nome,contacto,notas,ativo")
            .single();
        if (!error && data) {
            const guardada = normalizarFichaFornecedor(data);
            fornecedorFichas = fornecedorFichas.filter(item => item.id !== guardada.id);
            fornecedorFichas.push(guardada);
        } else {
            throw error;
        }
    } catch (error) {
        console.warn("Nao foi possivel guardar ficha no Supabase; guardada localmente.", error);
        fornecedorFichas = fornecedorFichas.filter(item => item.id !== ficha.id);
        fornecedorFichas.push(ficha);
        definirStatusFornecedor("Fornecedor guardado apenas neste navegador. Execute o SQL de fornecedores para guardar no Supabase.", true);
    }

    fornecedorFichas = combinarFichasFornecedoresComPadrao(fornecedorFichas);
    guardarFichasFornecedoresLocal();
    renderizarFornecedoresGuardados();
    preencherFormularioFichaFornecedor(obterFichaFornecedorPorId(ficha.id) || ficha);
    if (document.getElementById("fornecedor-nome")) {
        document.getElementById("fornecedor-nome").value = nome;
        renderizarResultadosFornecedor();
    }
    if (!document.getElementById("fornecedores-status")?.textContent) {
        definirStatusFornecedor("Fornecedor guardado.");
    }
    fecharModalFichaFornecedor();
}

function obterTextoCodigoPedidoFornecedor(pedido) {
    const codigo = String(pedido?.codigo || "").trim();
    return codigo || "Sem código";
}

function normalizarPedidoFornecedor(pedido) {
    if (!pedido) return null;
    return {
        id: String(pedido.id || pedido.codigo || Date.now()),
        codigo: String(pedido.codigo || '').trim(),
        fornecedor: pedido.fornecedor || '',
        referencia: pedido.referencia || '',
        estado: pedido.estado || 'A preparar',
        criado_em: pedido.criado_em || new Date().toISOString(),
        atualizado_em: pedido.atualizado_em || pedido.criado_em || new Date().toISOString(),
        data_encomendada: pedido.data_encomendada || null,
        itens: consolidarItensPedidoFornecedor(
            Array.isArray(pedido.itens) ? pedido.itens.map(normalizarItemPedidoFornecedor).filter(Boolean) : []
        )
    };
}

/** Data a mostrar na lista: momento «Encomendada», senão criação. Nunca atualizado_em. */
function obterDataExibicaoPedidoFornecedor(pedido) {
    if (pedido?.data_encomendada) return pedido.data_encomendada;
    if (estadoPedidoFornecedorEhEncomendada(pedido?.estado) || estadoPedidoFornecedorEhRecebida(pedido?.estado)) {
        return pedido?.data_encomendada || pedido?.criado_em || "";
    }
    return pedido?.criado_em || "";
}

function normalizarItemPedidoFornecedor(item) {
    if (!item) return null;
    const quantidade = Math.max(0, Math.floor(Number(item.quantidade || 0)));
    const quantidadeOriginal = Math.max(
        quantidade,
        Math.floor(Number(item.quantidade_original ?? item.quantidade_inicial ?? quantidade) || quantidade)
    );
    const faltaOs = Math.max(0, Math.floor(Number(item.falta_os || Math.max(0, quantidadeOriginal - quantidade)) || 0));
    const precoCusto = Number(item.preco_custo ?? item.custo ?? item.preco_compra ?? item.preco_fornecedor ?? item.preco ?? 0);
    return {
        ...item,
        quantidade,
        quantidade_original: quantidadeOriginal,
        falta_os: faltaOs,
        data_os: item.data_os || null,
        preco_custo: Number.isFinite(precoCusto) ? Math.max(0, precoCusto) : 0,
        estado_fornecedor: item.estado_fornecedor || (faltaOs > 0 ? 'OS' : ''),
        origem_ajuste: item.origem_ajuste || ''
    };
}

function obterChaveItemPedidoFornecedor(item) {
    const id = String(item?.id || '').trim();
    if (id) return `id:${id}`;
    const sku = String(item?.sku || '').trim().toLowerCase();
    if (sku) return `sku:${sku}`;
    const referencia = String(item?.referencia || '').trim().toLowerCase();
    if (referencia) return `ref:${referencia}`;
    const nome = normalizarFornecedor(item?.nome);
    if (nome) return `nome:${nome}`;
    return '';
}

function itensPedidoFornecedorCorrespondem(itemA, itemB) {
    if (!itemA || !itemB) return false;

    const idA = String(itemA.id || '').trim();
    const idB = String(itemB.id || '').trim();
    if (idA && idB && idA === idB) return true;

    if (correspondeReferenciaListaFornecedor(itemA.referencia, itemB.referencia)) return true;
    if (correspondeReferenciaListaFornecedor(itemA.referencia, itemB.sku)) return true;
    if (correspondeReferenciaListaFornecedor(itemA.sku, itemB.referencia)) return true;
    if (correspondeReferenciaListaFornecedor(itemA.sku, itemB.sku)) return true;

    const nomeA = normalizarFornecedor(itemA.nome);
    const nomeB = normalizarFornecedor(itemB.nome);
    return Boolean(nomeA && nomeB && nomeA === nomeB);
}

function encontrarItemPedidoFornecedor(itens, selecionado) {
    if (!selecionado) return null;
    return (itens || []).find(item => itensPedidoFornecedorCorrespondem(item, selecionado)) || null;
}

function fundirItemPedidoFornecedor(destino, origem) {
    if (!destino || !origem) return destino;
    const quantidadeOrigem = Math.max(0, Math.floor(Number(origem.quantidade || 0)));
    const quantidadeOriginalOrigem = Math.max(
        quantidadeOrigem,
        Math.floor(Number(origem.quantidade_original || origem.quantidade || 0))
    );
    destino.quantidade = Math.max(0, Math.floor(Number(destino.quantidade || 0))) + quantidadeOrigem;
    destino.quantidade_original = Math.max(0, Math.floor(Number(destino.quantidade_original || destino.quantidade || 0))) + quantidadeOriginalOrigem;
    destino.recebido = Math.max(0, Math.floor(Number(destino.recebido || 0))) + Math.max(0, Math.floor(Number(origem.recebido || 0)));
    destino.falta_os = Math.max(0, Math.floor(Number(destino.falta_os || 0))) + Math.max(0, Math.floor(Number(origem.falta_os || 0)));
    if (!destino.id && origem.id) destino.id = String(origem.id);
    if (!destino.sku && origem.sku) destino.sku = String(origem.sku);
    if (!destino.referencia && origem.referencia) destino.referencia = String(origem.referencia);
    if (!destino.nome && origem.nome) destino.nome = String(origem.nome);
    const precoCusto = Math.max(0, Number(origem.preco_custo ?? origem.preco ?? 0) || 0);
    if (precoCusto > 0) {
        destino.preco_custo = precoCusto;
        destino.preco = precoCusto;
    }
    if (!destino.origem_ajuste && origem.origem_ajuste) {
        destino.origem_ajuste = origem.origem_ajuste;
    }
    return destino;
}

function consolidarItensPedidoFornecedor(itens) {
    const consolidados = [];
    (itens || []).forEach(item => {
        const serializado = serializarItemPedidoFornecedor(item);
        if (!serializado) return;
        const existente = consolidados.find(atual => itensPedidoFornecedorCorrespondem(atual, serializado));
        if (!existente) {
            consolidados.push({ ...serializado });
            return;
        }
        fundirItemPedidoFornecedor(existente, serializado);
    });
    return consolidados;
}

function serializarItemPedidoFornecedor(item) {
    const normalizado = normalizarItemPedidoFornecedor(item);
    if (!normalizado) return null;
    const precoCusto = Math.max(0, Number(normalizado.preco_custo || 0) || 0);
    const imagens = Array.isArray(normalizado.imagens)
        ? normalizado.imagens.map(valor => String(valor || '').trim()).filter(Boolean).slice(0, 5)
        : [];
    return {
        id: String(normalizado.id || ''),
        nome: String(normalizado.nome || ''),
        sku: String(normalizado.sku || ''),
        referencia: String(normalizado.referencia || ''),
        tema: String(normalizado.tema || ''),
        subtema: String(normalizado.subtema || ''),
        quantidade: Math.max(0, Math.floor(Number(normalizado.quantidade || 0))),
        quantidade_original: Math.max(0, Math.floor(Number(normalizado.quantidade_original || normalizado.quantidade || 0))),
        falta_os: Math.max(0, Math.floor(Number(normalizado.falta_os || 0))),
        data_os: normalizado.data_os || null,
        estado_fornecedor: String(normalizado.estado_fornecedor || ''),
        origem_ajuste: String(normalizado.origem_ajuste || ''),
        recebido: Math.max(0, Math.floor(Number(normalizado.recebido || 0))),
        novidade: obterBooleanoProdutoFornecedor(normalizado.novidade),
        stock_no_momento: (() => {
            if (Object.prototype.hasOwnProperty.call(normalizado, "stock_no_momento")
                && normalizado.stock_no_momento !== null
                && normalizado.stock_no_momento !== undefined) {
                const valor = Number(normalizado.stock_no_momento);
                return Number.isFinite(valor) ? Math.floor(valor) : 0;
            }
            return 0;
        })(),
        preco_custo: precoCusto,
        preco: precoCusto,
        imagens
    };
}

function serializarItensPedidoFornecedor(itens) {
    return (itens || []).map(serializarItemPedidoFornecedor).filter(Boolean);
}

function obterEstadosPedidoFornecedor() {
    return ['A preparar', 'Encomendada', 'Recebida parcialmente', 'Recebida', 'Cancelada'];
}

function normalizarEstadoPedidoFornecedor(estado) {
    return normalizarFornecedor(estado || "")
        .replace(/[\s-]+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
}

function estadoPedidoFornecedorEhAPreparar(estado) {
    return normalizarEstadoPedidoFornecedor(estado) === "a_preparar";
}

function estadoPedidoFornecedorEhEncomendada(estado) {
    return normalizarEstadoPedidoFornecedor(estado) === "encomendada";
}

function estadoPedidoFornecedorEhRecebida(estado) {
    const normalizado = normalizarEstadoPedidoFornecedor(estado);
    return normalizado === "recebida" || normalizado === "recebida_parcialmente";
}

function deveConfirmarHistoricoPedidoFornecedor(estadoAnterior, estadoNovo) {
    // Sempre sincroniza marcações ao passar para Encomendada / Recebida
    // (inclui reaplicar depois de A preparar → Encomendada outra vez)
    if (!(estadoPedidoFornecedorEhEncomendada(estadoNovo) || estadoPedidoFornecedorEhRecebida(estadoNovo))) {
        return false;
    }
    if (normalizarEstadoPedidoFornecedor(estadoAnterior) === normalizarEstadoPedidoFornecedor(estadoNovo)) {
        return false;
    }
    return true;
}

function passouParaEncomendadaDesdeAPreparar(estadoAnterior, estadoNovo) {
    return deveConfirmarHistoricoPedidoFornecedor(estadoAnterior, estadoNovo);
}

function pedidoFornecedorPassaFiltroEstado(pedido, filtro) {
    const filtroNormalizado = normalizarEstadoPedidoFornecedor(filtro || 'todos');
    if (!filtroNormalizado || filtroNormalizado === 'todos') return true;
    return normalizarEstadoPedidoFornecedor(pedido.estado) === filtroNormalizado;
}

function obterTextoOrigemAjustePedidoFornecedor(origemAjuste) {
    if (origemAjuste === "substituicao") return "Adicionado depois";
    if (origemAjuste === "reforco") return "Quantidade aumentada";
    if (origemAjuste === "lista-final") return "Ajustado pela lista final";
    return "";
}

function escaparHtmlFornecedor(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[caracter]));
}

function fundirProdutosFornecedor(produtos) {
    if (!Array.isArray(produtos) || !produtos.length) return;
    produtos.forEach(produto => {
        if (!produto) return;
        const indice = fornecedorProdutos.findIndex(item => (
            (produto.id && String(item.id) === String(produto.id))
            || (produto.sku && String(item.sku || '').trim().toUpperCase() === String(produto.sku).trim().toUpperCase())
            || (!produto.id && !produto.sku && produto.referencia && String(item.referencia || '').trim().toUpperCase() === String(produto.referencia).trim().toUpperCase())
        ));
        const produtoNormalizado = {
            ...produto,
            stock: Number.isFinite(Number(produto.stock)) ? Number(produto.stock) : 0,
            preco: Number.isFinite(Number(produto.preco)) ? Number(produto.preco) : 0,
            preco_compra: Number.isFinite(Number(produto.preco_compra)) ? Number(produto.preco_compra) : 0
        };
        produtoNormalizado._pesquisaFornecedor = {
            nome: normalizarFornecedor(produtoNormalizado.nome),
            sku: normalizarFornecedor(produtoNormalizado.sku),
            referencia: normalizarFornecedor(produtoNormalizado.referencia),
            tema: normalizarFornecedor(produtoNormalizado.tema),
            subtema: normalizarFornecedor(produtoNormalizado.subtema)
        };
        if (indice >= 0) fornecedorProdutos[indice] = { ...fornecedorProdutos[indice], ...produtoNormalizado };
        else fornecedorProdutos.push(produtoNormalizado);
    });
}

async function carregarProdutosCompletosPedidoFornecedor(pedido) {
    if (!pedido?.itens?.length) return [];

    const ids = [...new Set(pedido.itens.map(item => item.id).filter(Boolean).map(String))];
    const skus = [...new Set(pedido.itens.map(item => String(item.sku || '').trim()).filter(Boolean))];
    const referencias = [...new Set(pedido.itens.map(item => String(item.referencia || '').trim()).filter(Boolean))];
    const produtos = fornecedorProdutos.filter(produto => {
        const id = String(produto.id || '');
        const sku = String(produto.sku || '').trim();
        const referencia = String(produto.referencia || '').trim();
        return ids.includes(id) || skus.includes(sku) || referencias.includes(referencia);
    });

    const unicos = [];
    const vistos = new Set();
    produtos.forEach(produto => {
        const chave = String(produto.id || produto.sku || produto.referencia || produto.nome || '');
        if (!chave || vistos.has(chave)) return;
        vistos.add(chave);
        unicos.push(produto);
    });
    fundirProdutosFornecedor(unicos);
    return unicos;
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

function obterImagemProdutoFornecedor(produto) {
    return obterImagemFornecedor(produto);
}

function imagensProdutoParaTextoFornecedor(produto) {
    const imagens = produto?.imagens;
    if (Array.isArray(imagens)) return imagens.join('\n');
    if (typeof imagens === 'string') {
        try {
            const parsed = JSON.parse(imagens);
            if (Array.isArray(parsed)) return parsed.join('\n');
        } catch (_) {
            return imagens;
        }
    }
    return '';
}

function textoParaImagensProdutoFornecedor(texto) {
    return String(texto || '')
        .split(/[\n,]+/)
        .map(url => url.trim())
        .filter(Boolean);
}

function abrirImagemFornecedorModal(url, alt) {
    const modal = document.getElementById('admin-imagem-modal');
    const foto = document.getElementById('admin-imagem-modal-foto');
    const fechar = document.getElementById('admin-imagem-modal-fechar');
    if (!modal || !foto || !url || url === FORNECEDORES_SEM_IMAGEM) return;
    foto.src = url;
    foto.alt = alt || 'Produto';
    modal.hidden = false;
    document.body.classList.add('admin-imagem-modal-aberto');
    fechar?.focus();
}

function fecharImagemFornecedorModal() {
    const modal = document.getElementById('admin-imagem-modal');
    const foto = document.getElementById('admin-imagem-modal-foto');
    if (!modal) return;
    modal.hidden = true;
    if (foto) {
        foto.removeAttribute('src');
        foto.alt = '';
    }
    document.body.classList.remove('admin-imagem-modal-aberto');
}

function criarImagemFornecedor(produto, classe = 'fornecedor-miniatura') {
    const url = obterImagemFornecedor(produto);
    const nome = produto?.nome || 'Produto';
    const temFoto = Boolean(url && url !== FORNECEDORES_SEM_IMAGEM);
    const modal = document.getElementById('admin-imagem-modal');

    if (modal) {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'admin-encomenda-produto-foto fornecedor-produto-foto';
        botao.disabled = !temFoto;
        botao.title = temFoto ? 'Ampliar fotografia' : 'Produto sem fotografia';
        const img = document.createElement('img');
        img.className = classe;
        img.alt = nome;
        img.src = temFoto ? url : FORNECEDORES_SEM_IMAGEM;
        img.loading = 'lazy';
        img.onerror = () => {
            img.onerror = null;
            img.src = FORNECEDORES_SEM_IMAGEM;
            botao.disabled = true;
            botao.title = 'Produto sem fotografia';
        };
        if (temFoto) {
            botao.addEventListener('click', () => abrirImagemFornecedorModal(url, nome));
        }
        botao.appendChild(img);
        return botao;
    }

    const img = document.createElement('img');
    img.className = classe;
    img.alt = nome;
    img.src = url;
    img.onerror = () => {
        img.onerror = null;
        img.src = FORNECEDORES_SEM_IMAGEM;
    };
    return img;
}

function textoIdentificacaoProduto(produto) {
    return `Ref. ${produto.referencia || '-'} | SKU ${produto.sku || '-'}`;
}


function normalizarChaveFornecedor(texto) {
    return normalizarFornecedor(texto).replace(/[^a-z0-9]/g, "");
}

function obterAliasesFornecedor(nome) {
    return [nome].map(normalizarChaveFornecedor).filter(Boolean);
}

function lerValorPorAlias(objeto, aliases) {
    if (typeof objeto === "string" && objeto.trim()) {
        try {
            objeto = JSON.parse(objeto);
        } catch (_) {
            return "";
        }
    }
    if (!objeto || typeof objeto !== "object") return "";
    for (const [chave, valor] of Object.entries(objeto)) {
        const chaveNormalizada = normalizarChaveFornecedor(chave);
        if (aliases.includes(chaveNormalizada) || aliases.includes(chave)) return valor;
    }
    return "";
}

function obterValorFornecedorProduto(produto, fornecedorNome) {
    if (!produto || !fornecedorNome || fornecedorNome === "Outro") return "";
    const aliases = [
        ...obterAliasesFornecedor(fornecedorNome),
        fornecedorNome
    ].filter(Boolean);
    const fontes = [
        produto.fornecedores,
        produto.fornecedor,
        produto.mapa_fornecedores,
        produto.mapaFornecedores,
        produto.stock_fornecedores,
        produto.stockFornecedores,
        produto,
    ];

    for (const fonte of fontes) {
        const valor = lerValorPorAlias(fonte, aliases);
        if (valor !== "" && valor !== null && valor !== undefined) return valor;
    }

    return "";
}

function obterFornecedorPorChaveProduto(produto, chave) {
    return lerValorPorAlias(produto?.fornecedores, [normalizarChaveFornecedor(chave)]);
}

function formatarDataOsCurtaFornecedor(valor) {
    if (!valor) return "";
    const texto = String(valor).trim();
    const isoDia = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDia) return `${isoDia[3]}/${isoDia[2]}/${isoDia[1]}`;
    const data = new Date(texto);
    if (Number.isNaN(data.getTime())) return "";
    const soData = new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(data);
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return soData;
    const hora = String(data.getHours()).padStart(2, "0");
    const minuto = String(data.getMinutes()).padStart(2, "0");
    if (hora === "00" && minuto === "00" && /T00:00:00/.test(texto)) return soData;
    return `${soData} ${hora}:${minuto}`;
}

function extrairDataOsDeTextoFornecedor(texto) {
    const valor = String(texto || "").trim();
    const iso = valor.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const pt = valor.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (pt) {
        const dia = String(pt[1]).padStart(2, "0");
        const mes = String(pt[2]).padStart(2, "0");
        return `${pt[3]}-${mes}-${dia}`;
    }
    return null;
}

function dataOsHojeFornecedor() {
    return new Date().toISOString().slice(0, 10);
}

function dataOsAgoraFornecedor() {
    return new Date().toISOString();
}

function rotuloHistoricoFornecedor(tipo) {
    const normalizado = String(tipo || "").trim().toLowerCase();
    if (normalizado === "os") return "OS";
    if (normalizado === "solicitada" || normalizado === "solicitado") return "Solicitada";
    if (normalizado === "encomendada_os" || normalizado === "encomendada-os" || normalizado === "parcial") {
        return "Encomendada / OS";
    }
    if (normalizado === "encomendada" || normalizado === "encomendado") return "Encomendada";
    if (normalizado === "ex") return "EX";
    return String(tipo || "").trim() || "—";
}

function normalizarTipoHistoricoFornecedor(tipo) {
    const normalizado = String(tipo || "").trim().toLowerCase();
    if (normalizado === "encomendado") return "encomendada";
    if (normalizado === "solicitado") return "solicitada";
    if (normalizado === "encomendada-os" || normalizado === "parcial") return "encomendada_os";
    return normalizado;
}

function consolidarHistoricoParcialFornecedor(eventos) {
    const origem = Array.isArray(eventos) ? eventos : [];
    const lista = [];
    for (let i = 0; i < origem.length; i += 1) {
        const atual = origem[i];
        const proximo = origem[i + 1];
        if (atual?.tipo === "encomendada" && proximo?.tipo === "os") {
            lista.push({
                tipo: "encomendada_os",
                data: atual.data || proximo.data || null
            });
            i += 1;
            continue;
        }
        if (atual?.tipo === "os" && proximo?.tipo === "encomendada") {
            lista.push({
                tipo: "encomendada_os",
                data: proximo.data || atual.data || null
            });
            i += 1;
            continue;
        }
        lista.push(atual);
    }
    return lista;
}

function obterHistoricoFornecedor(valor) {
    const eventos = [];
    const adicionar = (tipo, data) => {
        const tipoNorm = normalizarTipoHistoricoFornecedor(tipo);
        if (!tipoNorm) return;
        const dataNorm = String(data || "").trim() || null;
        // Marcação atual (ex.: OS no mapa) não é histórico de encomenda — só conta com data real
        if (tipoNorm === "os" && !dataNorm) return;
        eventos.push({
            tipo: tipoNorm,
            data: dataNorm
        });
    };

    if (valor && typeof valor === "object" && !Array.isArray(valor)) {
        const lista = Array.isArray(valor.historico) ? valor.historico : [];
        if (lista.length) {
            lista.forEach((item) => {
                if (!item) return;
                if (typeof item === "string") {
                    const maiusculas = item.toUpperCase();
                    const temOs = maiusculas.includes("OS");
                    const temEncomend = maiusculas.includes("ENCOMEND");
                    if (temOs && temEncomend) adicionar("encomendada_os", extrairDataOsDeTextoFornecedor(item) || item);
                    else if (temOs) adicionar("os", extrairDataOsDeTextoFornecedor(item));
                    else if (maiusculas.includes("SOLICIT")) adicionar("solicitada", extrairDataOsDeTextoFornecedor(item) || item);
                    else if (temEncomend) adicionar("encomendada", extrairDataOsDeTextoFornecedor(item) || item);
                    return;
                }
                adicionar(item.tipo || item.estado || item.status, item.data || item.em || item.desde || null);
            });
        } else {
            // Só datas explícitas de OS antigo — nunca inventar histórico a partir da marcação atual
            const datasOs = Array.isArray(valor.datas) ? valor.datas : (Array.isArray(valor.historico_os) ? valor.historico_os : []);
            if (datasOs.length) datasOs.forEach((data) => adicionar("os", data));
        }
    } else {
        const texto = String(valor ?? "").trim();
        const maiusculas = texto.toUpperCase();
        if (!texto) return [];
        if (maiusculas === "OS" || maiusculas.startsWith("OS")) {
            const matches = texto.match(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}|\d{4}-\d{2}-\d{2}/g) || [];
            matches.forEach((match) => adicionar("os", extrairDataOsDeTextoFornecedor(match) || match));
        }
        // "OS" / "EX" / "Solicitada" / "Encomendada" sozinhos = marcação, não histórico
    }

    return consolidarHistoricoParcialFornecedor(
        eventos
            .filter((item) => !(item.tipo === "os" && !item.data))
            .sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")))
    );
}

function formatarTextoHistoricoFornecedor(historico, estadoAtual = "") {
    const lista = Array.isArray(historico) ? historico : [];
    if (!lista.length) {
        const estado = String(estadoAtual || "").trim();
        return estado || "";
    }
    return lista
        .map((item) => {
            const data = item.data ? formatarDataOsCurtaFornecedor(item.data) : "sem data";
            return `${data} — ${rotuloHistoricoFornecedor(item.tipo)}`;
        })
        .join("\n");
}

function formatarResumoHistoricoFornecedor(historico, estadoAtual = "") {
    const lista = Array.isArray(historico) ? historico : [];
    const estado = String(estadoAtual || "").trim();
    if (estado) {
        const upper = estado.toUpperCase();
        if (upper === "OS") return "OS";
        if (upper === "EX") return "EX";
        if (upper === "SOLICITADA" || upper === "SOLICITADO") return "Solicitada";
        if (upper === "ENCOMENDADA" || upper === "ENCOMENDADO") return "Encomendada";
        if (/^-?\d+(?:[,.]\d+)?$/.test(estado)) return `Marcado no mapa: ${estado}`;
        return estado;
    }
    if (!lista.length) return "Disponivel";
    const ultimo = lista[lista.length - 1];
    const rotulo = rotuloHistoricoFornecedor(ultimo.tipo);
    if (lista.length === 1) {
        return ultimo.data ? `${rotulo} · ${formatarDataOsCurtaFornecedor(ultimo.data)}` : rotulo;
    }
    return `${rotulo} · ${lista.length}×`;
}

function normalizarMarcacaoFornecedor(valor) {
    const historico = obterHistoricoFornecedor(valor);
    const estadoObjeto = valor && typeof valor === "object" && !Array.isArray(valor)
        ? String(valor.estado || "").trim()
        : (historico.length ? "" : String(valor ?? "").trim());
    // Marcação atual = campo estado; não herda automaticamente do histórico
    const estado = estadoObjeto;
    const estadoUpper = estado.toUpperCase();

    let tipo = "disponivel";
    if (estadoUpper === "OS") tipo = "os";
    else if (estadoUpper === "EX") tipo = "ex";
    else if (estadoUpper === "ENCOMENDADA" || estadoUpper === "ENCOMENDADO" || /^-?\d+(?:[,.]\d+)?$/.test(estado)) tipo = "encomendado";
    else if (estadoUpper === "SOLICITADA" || estadoUpper === "SOLICITADO") tipo = "solicitada";
    else if (estado) tipo = "info";

    const datas = historico.filter((item) => item.tipo === "os").map((item) => item.data).filter(Boolean);
    return {
        tipo,
        estado: tipo === "os" ? "OS" : (tipo === "ex" ? "EX" : (tipo === "solicitada" ? "Solicitada" : estado)),
        desde: historico[0]?.data || null,
        datas,
        historico,
        texto: formatarResumoHistoricoFornecedor(historico, estado)
    };
}

function formatarValorFornecedorParaInput(valor) {
    if (valor && typeof valor === "object" && !Array.isArray(valor)) {
        const estado = String(valor.estado || "").trim();
        if (estado) {
            const upper = estado.toUpperCase();
            if (upper === "OS") return "OS";
            if (upper === "EX") return "EX";
            if (upper === "SOLICITADA" || upper === "SOLICITADO") return "Solicitada";
            if (upper === "ENCOMENDADA" || upper === "ENCOMENDADO") return "Encomendada";
            return estado;
        }
        // Estado vazio: mostrar o último evento do histórico (encomendas antigas sem marcação atual)
        const historico = obterHistoricoFornecedor(valor);
        const ultimo = historico[historico.length - 1];
        if (ultimo?.tipo) return rotuloHistoricoFornecedor(ultimo.tipo);
        return "";
    }
    const marcacao = normalizarMarcacaoFornecedor(valor);
    if (marcacao.tipo === "disponivel") {
        const ultimo = marcacao.historico[marcacao.historico.length - 1];
        if (ultimo?.tipo) return rotuloHistoricoFornecedor(ultimo.tipo);
        return "";
    }
    if (marcacao.tipo === "os") return "OS";
    if (marcacao.tipo === "ex") return "EX";
    if (marcacao.tipo === "solicitada") return "Solicitada";
    if (marcacao.tipo === "encomendado") {
        const bruto = String(valor ?? "").trim();
        return /^-?\d+(?:[,.]\d+)?$/.test(bruto) ? bruto : "Encomendada";
    }
    return marcacao.estado || "";
}

function obterEstadoMarcacaoPreservado(valor) {
    if (valor && typeof valor === "object" && !Array.isArray(valor)) {
        return String(valor.estado || "").trim();
    }
    if (valor == null || valor === "") return "";
    const historico = obterHistoricoFornecedor(valor);
    // String antiga sem objeto: a própria string é a marcação
    if (!historico.length) return String(valor).trim();
    return String(valor).trim();
}

function acrescentarHistoricoFornecedor(valorAnterior, tipo, novaData = dataOsAgoraFornecedor()) {
    const anterior = normalizarMarcacaoFornecedor(valorAnterior);
    const historico = [...(anterior.historico || [])];
    historico.push({
        tipo: normalizarTipoHistoricoFornecedor(tipo),
        data: String(novaData || dataOsAgoraFornecedor())
    });
    return montarMarcacaoComHistorico(historico, obterEstadoMarcacaoPreservado(valorAnterior));
}

function montarMarcacaoComHistorico(historico, estadoAtual = "") {
    const lista = Array.isArray(historico) ? historico : [];
    return {
        estado: String(estadoAtual || "").trim(),
        desde: lista[0]?.data || null,
        datas: lista.filter((item) => item.tipo === "os").map((item) => item.data).filter(Boolean),
        historico: lista
    };
}

function reconstruirMarcacaoHistoricoFornecedor(historico, estadoAtual = "") {
    return montarMarcacaoComHistorico(historico, estadoAtual);
}

function corrigirUltimaTentativaParaOs(valorAnterior, novaData = dataOsAgoraFornecedor()) {
    const anterior = normalizarMarcacaoFornecedor(valorAnterior);
    const historico = [...(anterior.historico || [])];
    let indice = -1;
    for (let i = historico.length - 1; i >= 0; i -= 1) {
        const tipo = historico[i]?.tipo;
        if (tipo === "solicitada" || tipo === "encomendada" || tipo === "encomendada_os") {
            indice = i;
            break;
        }
    }
    if (indice < 0) {
        return acrescentarHistoricoFornecedor(valorAnterior, "os", novaData);
    }
    historico[indice] = {
        tipo: "os",
        data: String(novaData || dataOsAgoraFornecedor())
    };
    // Histórico passa a OS; marcação atual só muda ao confirmar Encomendada
    return montarMarcacaoComHistorico(historico, obterEstadoMarcacaoPreservado(valorAnterior));
}

function promoverUltimaSolicitadaParaEncomendada(valorAnterior, novaData = dataOsAgoraFornecedor()) {
    const anterior = normalizarMarcacaoFornecedor(valorAnterior);
    const historico = [...(anterior.historico || [])];
    let indice = -1;
    for (let i = historico.length - 1; i >= 0; i -= 1) {
        if (historico[i]?.tipo === "solicitada") {
            indice = i;
            break;
        }
    }
    if (indice < 0) return null;
    const data = String(novaData || dataOsAgoraFornecedor());
    historico[indice] = {
        tipo: "encomendada",
        data
    };
    // Histórico Encomendada + marcação atual Encomendada (stock disponível na encomenda)
    return montarMarcacaoComHistorico(historico, "Encomendada");
}

function garantirMarcacaoEncomendadaFornecedor(valorAnterior, novaData = dataOsAgoraFornecedor()) {
    const anterior = normalizarMarcacaoFornecedor(valorAnterior);
    const historico = [...(anterior.historico || [])];
    const data = String(novaData || dataOsAgoraFornecedor());
    let indice = -1;
    for (let i = historico.length - 1; i >= 0; i -= 1) {
        const tipo = historico[i]?.tipo;
        if (tipo === "solicitada" || tipo === "encomendada" || tipo === "encomendada_os") {
            indice = i;
            break;
        }
    }
    if (indice >= 0) {
        if (historico[indice].tipo === "solicitada") {
            historico[indice] = { tipo: "encomendada", data };
        }
    } else {
        historico.push({ tipo: "encomendada", data });
    }
    return montarMarcacaoComHistorico(historico, "Encomendada");
}

function confirmarTentativaParcialFornecedor(valorAnterior, novaData = dataOsAgoraFornecedor()) {
    const anterior = normalizarMarcacaoFornecedor(valorAnterior);
    const historico = [...(anterior.historico || [])];
    const data = String(novaData || dataOsAgoraFornecedor());
    let indice = -1;
    for (let i = historico.length - 1; i >= 0; i -= 1) {
        const tipo = historico[i]?.tipo;
        if (tipo === "solicitada" || tipo === "encomendada" || tipo === "encomendada_os" || tipo === "os") {
            indice = i;
            break;
        }
    }

    if (indice >= 0) {
        historico[indice] = { tipo: "encomendada_os", data };
        // Remove linha OS/Encomendada solta logo a seguir (legado com 2 linhas)
        while (
            historico[indice + 1]
            && (historico[indice + 1].tipo === "os" || historico[indice + 1].tipo === "encomendada")
        ) {
            historico.splice(indice + 1, 1);
        }
    } else {
        historico.push({ tipo: "encomendada_os", data });
    }

    return montarMarcacaoComHistorico(historico, "OS");
}

function aplicarMarcacaoAtualAposConfirmar(valorAnterior, estadoMarcacao, novaData = dataOsAgoraFornecedor()) {
    const anterior = normalizarMarcacaoFornecedor(valorAnterior);
    return montarMarcacaoComHistorico(anterior.historico || [], estadoMarcacao);
}

function corrigirUltimaEncomendadaParaOs(valorAnterior, novaData = dataOsAgoraFornecedor()) {
    return corrigirUltimaTentativaParaOs(valorAnterior, novaData);
}

function criarMarcacaoOsFornecedor(valorAnterior, novaData = dataOsAgoraFornecedor()) {
    return corrigirUltimaTentativaParaOs(valorAnterior, novaData);
}

function parseValorMarcacaoFornecedorInput(texto, valorAnterior) {
    const valor = String(texto || "").trim();
    const anterior = normalizarMarcacaoFornecedor(valorAnterior);
    const historico = [...(anterior.historico || [])];
    if (!valor) {
        return historico.length ? { estado: "", historico, datas: anterior.datas || [], desde: anterior.desde || null } : "";
    }
    const maiusculas = valor.toUpperCase();
    if (maiusculas === "OS" || maiusculas.startsWith("OS")) {
        return {
            estado: "OS",
            desde: anterior.desde || historico[0]?.data || null,
            datas: anterior.datas || [],
            historico
        };
    }
    if (maiusculas === "EX") {
        return { estado: "EX", historico, desde: anterior.desde || null, datas: anterior.datas || [] };
    }
    if (/^-?\d+(?:[,.]\d+)?$/.test(valor)) {
        return { estado: valor, historico, desde: anterior.desde || null, datas: anterior.datas || [] };
    }
    if (maiusculas === "SOLICITADA" || maiusculas === "SOLICITADO") {
        return { estado: "Solicitada", historico, desde: anterior.desde || null, datas: anterior.datas || [] };
    }
    if (maiusculas === "ENCOMENDADA" || maiusculas === "ENCOMENDADO") {
        return { estado: "Encomendada", historico, desde: anterior.desde || null, datas: anterior.datas || [] };
    }
    return { estado: valor, historico, desde: anterior.desde || null, datas: anterior.datas || [] };
}

function classificarValorFornecedor(valor) {
    const marcacao = normalizarMarcacaoFornecedor(valor);
    return { tipo: marcacao.tipo, texto: marcacao.texto };
}

function criarBlocoHistoricoFornecedorFicha(form, id, rotulo, valor) {
    const marcacao = normalizarMarcacaoFornecedor(valor);
    let historicoAtual = (marcacao.historico || []).map((item) => ({
        tipo: item.tipo,
        data: item.data || null
    }));
    const historicoBruto = Array.isArray(valor?.historico) ? valor.historico : [];
    const tinhaOsSemData = historicoBruto.some((item) => {
        if (!item || typeof item === "string") {
            return String(item || "").toUpperCase().includes("OS") && !extrairDataOsDeTextoFornecedor(item);
        }
        const tipo = String(item.tipo || item.estado || "").toLowerCase();
        return tipo === "os" && !String(item.data || item.em || item.desde || "").trim();
    });
    const bloco = document.createElement("div");
    bloco.className = "mapas-produto-campo mapas-produto-fornecedor-historico";

    const cabecalho = document.createElement("div");
    cabecalho.className = "mapas-produto-fornecedor-cabecalho";
    const titulo = document.createElement("strong");
    titulo.className = "mapas-produto-fornecedor-titulo";
    titulo.textContent = rotulo;
    cabecalho.appendChild(titulo);

    const botaoLimpar = document.createElement("button");
    botaoLimpar.type = "button";
    botaoLimpar.className = "mapas-produto-fornecedor-limpar-historico";
    botaoLimpar.textContent = "Limpar histórico";
    botaoLimpar.disabled = !historicoAtual.length;
    cabecalho.appendChild(botaoLimpar);
    bloco.appendChild(cabecalho);

    const lista = document.createElement("ul");
    lista.className = "fornecedor-historico-lista";

    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.className = "mapas-produto-fornecedor-marcacao-atual";
    label.textContent = "Marcação atual";
    const input = document.createElement("input");
    input.id = id;
    input.name = id;
    input.type = "text";
    input.value = formatarValorFornecedorParaInput(valor);
    input.placeholder = "OS, EX, Solicitada, Encomendada ou vazio";
    input.dataset.historicoLimpo = "0";
    // Persistir limpeza (OS sem data) ou consolidação Encomendada+OS → Encomendada / OS
    const precisaPersistirHistorico = tinhaOsSemData
        || (Array.isArray(valor?.historico) && valor.historico.length > historicoAtual.length);
    input.dataset.historicoEditado = precisaPersistirHistorico ? "1" : "0";
    input.dataset.historicoJson = JSON.stringify(historicoAtual);
    label.appendChild(input);

    const sincronizarHistoricoInput = () => {
        input.dataset.historicoEditado = "1";
        input.dataset.historicoLimpo = historicoAtual.length ? "0" : "1";
        input.dataset.historicoJson = JSON.stringify(historicoAtual);
        botaoLimpar.disabled = !historicoAtual.length;
        // Marcação atual não muda ao editar o histórico (só ao confirmar Encomendada na encomenda)
    };

    const renderizarLista = () => {
        lista.replaceChildren();
        if (!historicoAtual.length) {
            const vazio = document.createElement("li");
            vazio.className = "fornecedor-historico-vazio";
            vazio.textContent = "Sem histórico de encomendas neste fornecedor.";
            lista.appendChild(vazio);
            return;
        }
        historicoAtual.forEach((item, indice) => {
            const li = document.createElement("li");
            li.className = `fornecedor-historico-item tipo-${item.tipo || "info"}`;
            const data = document.createElement("span");
            data.className = "fornecedor-historico-data";
            data.textContent = item.data ? formatarDataOsCurtaFornecedor(item.data) : "sem data";
            const estado = document.createElement("span");
            estado.className = "fornecedor-historico-estado";
            estado.textContent = rotuloHistoricoFornecedor(item.tipo);
            const apagar = document.createElement("button");
            apagar.type = "button";
            apagar.className = "fornecedor-historico-apagar";
            apagar.setAttribute("aria-label", `Apagar linha ${rotuloHistoricoFornecedor(item.tipo)}`);
            apagar.title = "Apagar esta linha";
            apagar.textContent = "×";
            apagar.addEventListener("click", () => {
                const rotuloLinha = `${item.data ? formatarDataOsCurtaFornecedor(item.data) : "sem data"} — ${rotuloHistoricoFornecedor(item.tipo)}`;
                if (!window.confirm(`Apagar esta linha do histórico de ${rotulo}?\n\n${rotuloLinha}\n\nSó fica definitivo ao guardar o produto.`)) {
                    return;
                }
                historicoAtual = historicoAtual.filter((_, i) => i !== indice);
                sincronizarHistoricoInput();
                renderizarLista();
            });
            li.append(data, estado, apagar);
            lista.appendChild(li);
        });
    };

    renderizarLista();
    bloco.append(lista, label);

    botaoLimpar.addEventListener("click", () => {
        if (!window.confirm(`Limpar o histórico de ${rotulo} nesta ficha?\n\nA marcação atual também fica vazia. Só fica definitivo ao guardar o produto.`)) {
            return;
        }
        historicoAtual = [];
        input.value = "";
        sincronizarHistoricoInput();
        renderizarLista();
    });

    form.appendChild(bloco);
    return input;
}

function obterFornecedorMarcacaoFiltro(fornecedorEncomenda) {
    const select = document.getElementById("fornecedor-filtro-marcacao-fornecedor");
    const escolha = select?.value || "mesmo";
    if (escolha && escolha !== "mesmo") return escolha;
    return fornecedorEncomenda || "";
}

function produtoPassaFiltroFornecedor(produto, fornecedorMarcacao, filtro) {
    if (!filtro || filtro === "todos" || !fornecedorMarcacao || fornecedorMarcacao === "Outro") return true;
    const valor = obterValorFornecedorProduto(produto, fornecedorMarcacao);
    const estado = classificarValorFornecedor(valor);
    if (filtro === "os-ou-ex") return estado.tipo === "os" || estado.tipo === "ex";
    // Disponivel = sem OS/EX (inclui vazio, Encomendada e Solicitada)
    if (filtro === "disponivel") {
        return estado.tipo === "disponivel"
            || estado.tipo === "encomendado"
            || estado.tipo === "solicitada";
    }
    return estado.tipo === filtro;
}

function obterControlosResultadosFornecedor() {
    const fornecedor = document.getElementById("fornecedor-nome")?.value || "";
    return {
        termo: normalizarFornecedor(document.getElementById("fornecedor-pesquisa")?.value || ""),
        fornecedor,
        fornecedorMarcacao: obterFornecedorMarcacaoFiltro(fornecedor),
        filtroFornecedor: document.getElementById("fornecedor-filtro-marcacao")?.value || "disponivel",
        filtroTop: document.getElementById("fornecedor-filtro-top")?.value || "todos",
        filtroArquivado: document.getElementById("fornecedor-filtro-arquivado")?.value || "nao",
        filtroDescontinuado: document.getElementById("fornecedor-filtro-descontinuado")?.value || "nao",
        ordenacao: document.getElementById("fornecedor-ordenacao-stock")?.value || "stock-asc",
    };
}

function calcularScoreResultadoFornecedor(produto, termo) {
    if (!termo) return 5;
    const pesquisa = produto._pesquisaFornecedor || {};
    const nome = pesquisa.nome ?? normalizarFornecedor(produto.nome);
    const sku = pesquisa.sku ?? normalizarFornecedor(produto.sku);
    const referencia = pesquisa.referencia ?? normalizarFornecedor(produto.referencia);
    const tema = pesquisa.tema ?? normalizarFornecedor(produto.tema);
    const subtema = pesquisa.subtema ?? normalizarFornecedor(produto.subtema);

    if (sku === termo || referencia === termo) return 0;
    if (nome === termo) return 1;
    if (sku.includes(termo) || referencia.includes(termo)) return 2;
    if (nome.includes(termo)) return 3;
    if (tema.includes(termo) || subtema.includes(termo)) return 4;
    return 99;
}

function compararTextoFornecedor(a, b) {
    return String(a || "").localeCompare(String(b || ""), "pt", { numeric: true, sensitivity: "base" });
}

function obterValorOrdenacaoFornecedor(item, coluna) {
    const produto = item.produto || item;
    if (coluna === "lego") return obterLegoProdutoFornecedor(produto);
    if (coluna === "sku") return produto.sku || "";
    if (coluna === "ref") return produto.referencia || "";
    if (coluna === "preco_compra") return Number(produto.preco_compra || 0);
    if (coluna === "preco") return Number(produto.preco || 0);
    if (coluna === "top") return obterTopProdutoFornecedor(produto) || "";
    if (coluna === "descontinuado") return obterBooleanoProdutoFornecedor(produto.descontinuado) ? 1 : 0;
    if (coluna === "novidade") return obterBooleanoProdutoFornecedor(produto.novidade) ? 1 : 0;
    if (coluna === "stock") return Number(produto.stock || 0);
    if (coluna === "tema") return produto.tema || "";
    if (coluna === "subtema") return produto.subtema || "";
    if (coluna === "peso") return Number(produto.peso || 0);
    if (coluna === "pendente") return obterPendentesProdutoFornecedor(produto);
    if (coluna === "previsto") return Number(produto.stock || 0) + obterPendentesProdutoFornecedor(produto);
    if (coluna === "qtd") {
        const selecionado = fornecedorSelecao.find(sel => String(sel.id) === String(produto.id));
        return Number(selecionado?.quantidade || 0);
    }
    return produto.nome || "";
}

function compararProdutosPorColunaFornecedor(a, b, coluna, direcao = "asc") {
    const valorA = obterValorOrdenacaoFornecedor(a, coluna);
    const valorB = obterValorOrdenacaoFornecedor(b, coluna);
    let resultado;
    if (typeof valorA === "number" || typeof valorB === "number") {
        resultado = Number(valorA || 0) - Number(valorB || 0);
    } else {
        resultado = compararTextoFornecedor(valorA, valorB);
    }
    if (resultado === 0 && coluna !== "nome") {
        resultado = compararTextoFornecedor(a.produto?.nome, b.produto?.nome);
    }
    return direcao === "desc" ? -resultado : resultado;
}

function compararProdutosFornecedor(a, b, ordenacao) {
    const direcao = ordenacao.endsWith("-desc") ? "desc" : "asc";
    const coluna = ordenacao.replace("-asc", "").replace("-desc", "");

    if (coluna === "stock") {
        return compararProdutosPorColunaFornecedor(a, b, "stock", direcao);
    }
    if (["nome", "sku", "ref", "top", "pendente", "previsto", "qtd"].includes(coluna)) {
        return compararProdutosPorColunaFornecedor(a, b, coluna, direcao);
    }

    if (a.score !== b.score) return a.score - b.score;
    return compararTextoFornecedor(a.produto.nome, b.produto.nome);
}

function definirQuantidadeFornecedor(id, valor) {
    const item = fornecedorSelecao.find((selecionado) => String(selecionado.id) === String(id));
    if (!item) return;
    const quantidade = Math.max(1, Math.floor(Number(valor) || 1));
    item.quantidade = quantidade;
    guardarSelecaoFornecedor();
    renderizarSelecionadosFornecedor();
}

function obterProdutoAtual(id) {
    return fornecedorProdutos.find(produto => String(produto.id) === String(id));
}

function obterProdutoParaPedidoFornecedor(item, listaProdutos = fornecedorProdutos) {
    if (!item) return null;
    const porId = listaProdutos.find(produto => String(produto.id) === String(item.id));
    if (porId) return porId;

    const nomeItem = normalizarFornecedor(item.nome);
    return listaProdutos.find(produto => {
        const mesmoNome = nomeItem && normalizarFornecedor(produto.nome) === nomeItem;
        const mesmaReferencia = correspondeReferenciaListaFornecedor(item.referencia, produto.referencia)
            || correspondeReferenciaListaFornecedor(item.referencia, produto.sku)
            || correspondeReferenciaListaFornecedor(item.sku, produto.referencia)
            || correspondeReferenciaListaFornecedor(item.sku, produto.sku);
        return mesmaReferencia || mesmoNome;
    }) || null;
}

function produtoPassaFiltroTopFornecedor(produto, filtroTop) {
    if (!filtroTop || filtroTop === "todos") return true;
    const valorTop = String(obterTopProdutoFornecedor(produto) || "").trim();
    if (filtroTop === "sim" || filtroTop === "top") return Boolean(valorTop);
    if (filtroTop === "nao" || filtroTop === "sem-top") return !valorTop;
    return true;
}

function produtoPassaFiltroDescontinuadoFornecedor(produto, filtroDescontinuado) {
    if (!filtroDescontinuado || filtroDescontinuado === "todos") return true;
    const descontinuado = obterBooleanoProdutoFornecedor(produto?.descontinuado);
    if (filtroDescontinuado === "sim" || filtroDescontinuado === "descontinuado") return descontinuado;
    if (filtroDescontinuado === "nao" || filtroDescontinuado === "sem-descontinuado") return !descontinuado;
    return true;
}

function produtoPassaFiltroArquivadoFornecedor(produto, filtroArquivado) {
    if (!filtroArquivado || filtroArquivado === "todos") return true;
    const arquivado = obterBooleanoProdutoFornecedor(produto?.arquivado);
    if (filtroArquivado === "sim" || filtroArquivado === "arquivado") return arquivado;
    if (filtroArquivado === "nao" || filtroArquivado === "sem-arquivado") return !arquivado;
    return true;
}

function obterQuantidadeSelecionadaFornecedor(id) {
    const item = fornecedorSelecao.find(selecionado => String(selecionado.id) === String(id));
    return Number(item?.quantidade || 0);
}

function definirQuantidadeMapaFornecedor(produto, valor) {
    const quantidade = Math.max(0, Math.floor(Number(valor) || 0));
    const id = String(produto.id);
    const indice = fornecedorSelecao.findIndex(item => String(item.id) === id);

    if (quantidade <= 0) {
        if (indice >= 0) fornecedorSelecao.splice(indice, 1);
    } else if (indice >= 0) {
        fornecedorSelecao[indice] = { ...fornecedorSelecao[indice], ...produto, quantidade };
    } else {
        fornecedorSelecao.push({ ...produto, quantidade });
    }

    guardarSelecaoFornecedor();
    renderizarSelecionadosFornecedor();
}

function normalizarReferenciaListaFornecedor(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

function obterCandidatosReferenciaListaFornecedor(referencia) {
    const texto = String(referencia || "").trim();
    if (!texto) return [];
    const candidatos = [texto];
    texto.split("/").forEach(parte => {
        const limpa = parte.trim();
        if (limpa) candidatos.push(limpa);
    });
    return [...new Set(candidatos.map(normalizarReferenciaListaFornecedor).filter(Boolean))];
}

function correspondeReferenciaListaFornecedor(referenciaA, referenciaB) {
    const candidatosA = obterCandidatosReferenciaListaFornecedor(referenciaA);
    const candidatosB = obterCandidatosReferenciaListaFornecedor(referenciaB);
    if (!candidatosA.length || !candidatosB.length) return false;
    return candidatosA.some(valor => candidatosB.includes(valor));
}

function encontrarProdutoListaFinalFornecedor(referencia) {
    if (!String(referencia || "").trim()) return null;
    return fornecedorProdutos.find(item =>
        correspondeReferenciaListaFornecedor(referencia, item.referencia)
        || correspondeReferenciaListaFornecedor(referencia, item.sku)
    ) || null;
}

function criarItemFornecedorAPartirListaFinal(analisada, produto = null) {
    const quantidade = Math.max(1, Math.floor(Number(analisada.quantidade) || 1));
    const precoCusto = Math.max(0, Number(analisada.preco_custo) || 0);
    if (produto) {
        return criarItemFornecedorAPartirSelecao({
            ...produto,
            quantidade,
            preco_custo: precoCusto
        }, "lista-final");
    }
    return normalizarItemPedidoFornecedor({
        id: "",
        nome: `Ref. ${analisada.referencia}`,
        referencia: analisada.referencia,
        sku: "",
        tema: "",
        subtema: "",
        quantidade,
        quantidade_original: quantidade,
        falta_os: 0,
        estado_fornecedor: "",
        origem_ajuste: "lista-final",
        recebido: 0,
        preco_custo: precoCusto,
        preco: precoCusto,
        sem_catalogo: true
    });
}

function chaveProdutoListaFinalFornecedor(produto, referenciaLista) {
    if (produto?.id) return `id:${String(produto.id)}`;
    return `ref:${normalizarReferenciaListaFornecedor(referenciaLista)}`;
}

function localizarEntradaListaImportadaFornecedor(referenciaLinha, porReferencia) {
    for (const [chave, entrada] of porReferencia.entries()) {
        if (chave === normalizarReferenciaListaFornecedor(referenciaLinha)) return entrada;
        if (correspondeReferenciaListaFornecedor(entrada.referencia, referenciaLinha)) return entrada;
    }
    return null;
}

function converterNumeroListaFornecedor(valor) {
    const texto = String(valor || "")
        .replace(/[€\s]/g, "")
        .replace(",", ".")
        .replace(/[^0-9.-]/g, "");
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : 0;
}

function dividirLinhaListaFinalFornecedor(linha) {
    const texto = String(linha || "").trim();
    if (!texto) return [];
    if (texto.includes("\t")) return texto.split("\t");
    if (texto.includes(";")) return texto.split(";");
    if (/^[^,]+,\s*\d+,\s*[\d,.]+\s*€?$/i.test(texto)) return texto.split(",");
    return texto.split(/\s+/);
}

function limparListaOsEdicaoFornecedor() {
    const modal = document.getElementById("fornecedor-edicao-modal");
    const area = modal?.querySelector("#fornecedor-edicao-lista-os");
    if (area) area.value = "";
}

function definirSelecaoLinhaQuantidadeMapa(input, ativa) {
    const linha = input?.closest("tr");
    if (!linha) return;
    linha.classList.toggle("mapa-linha-quantidade-ativa", ativa);
}

function ligarSelecaoLinhaQuantidadeMapa(input) {
    input.addEventListener("focus", () => {
        const tabela = input.closest(".mapas-produtos-tabela");
        if (!tabela) return;
        tabela.querySelectorAll("tbody tr.mapa-linha-quantidade-ativa")
            .forEach(linha => linha.classList.remove("mapa-linha-quantidade-ativa"));
        definirSelecaoLinhaQuantidadeMapa(input, true);
    });
    input.addEventListener("blur", () => definirSelecaoLinhaQuantidadeMapa(input, false));
}

function obterAlturaCabecalhoFixoFornecedor() {
    const header = document.querySelector(".cabecalho-site-admin");
    return header ? header.getBoundingClientRect().height : 0;
}

function ajustarVistaEncomendaFornecedor() {
    if (!estaPaginaFornecedoresUnificada()) return;

    const caixaResultados = document.getElementById("fornecedor-resultados");
    if (caixaResultados) caixaResultados.scrollTop = 0;

    const controles = document.querySelector(".fornecedor-controles-unificados");
    const tituloSelecionados = document.querySelector(".fornecedor-selecionados-titulo");
    if (!controles || !tituloSelecionados) return;

    const headerAltura = obterAlturaCabecalhoFixoFornecedor();
    const margemTopo = 8;
    const margemFundo = 20;

    const controlesTop = controles.getBoundingClientRect().top + window.scrollY;
    const tituloBottom = tituloSelecionados.getBoundingClientRect().bottom + window.scrollY;
    const scrollParaControles = controlesTop - headerAltura - margemTopo;
    const scrollParaTitulo = tituloBottom - window.innerHeight + margemFundo;
    const scrollY = Math.max(0, Math.min(scrollParaControles, scrollParaTitulo));

    window.scrollTo({ top: scrollY, behavior: "smooth" });
}

function obterCaixaScrollQuantidadeMapa(input) {
    return input?.closest("#fornecedor-resultados, #fornecedor-selecionados") || null;
}

function garantirInputVisivelNoScroll(caixa, input) {
    if (!caixa || !input) return;
    const estilos = window.getComputedStyle(caixa);
    if (!["auto", "scroll", "overlay"].includes(estilos.overflowY)) return;

    const margem = 8;
    const caixaRect = caixa.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();

    if (inputRect.bottom > caixaRect.bottom - margem) {
        caixa.scrollTop += inputRect.bottom - caixaRect.bottom + margem;
    } else if (inputRect.top < caixaRect.top + margem) {
        caixa.scrollTop -= caixaRect.top - inputRect.top + margem;
    }
}

function focarQuantidadeMapaRelativa(inputAtual, direcao, caixa) {
    const container = caixa || obterCaixaScrollQuantidadeMapa(inputAtual);
    if (!container) return false;

    const inputs = Array.from(container.querySelectorAll(".mapa-quantidade-input"));
    const indiceAtual = inputs.indexOf(inputAtual);
    if (indiceAtual < 0) return false;

    const proximo = inputs[indiceAtual + direcao];
    if (!proximo) return false;

    proximo.focus({ preventScroll: true });
    proximo.select();
    garantirInputVisivelNoScroll(container, proximo);
    return true;
}

function tratarTeclaQuantidadeMapa(evento) {
    if (evento.key !== "Tab") return;

    const caixa = obterCaixaScrollQuantidadeMapa(evento.currentTarget);
    if (!caixa) return;

    evento.preventDefault();
    const direcao = evento.shiftKey ? -1 : 1;
    focarQuantidadeMapaRelativa(evento.currentTarget, direcao, caixa);
}

function obterPendentesProdutoFornecedor(produto) {
    return obterPendentesDetalhadosProdutoFornecedor(produto).total;
}

function obterPendentesDetalhadosProdutoFornecedor(produto) {
    const idProduto = String(produto?.id || "");
    const skuProduto = String(produto?.sku || "").trim().toUpperCase();
    const pedidosAbertos = fornecedorPedidos.filter(pedido =>
        pedido
        && pedido.estado !== "Recebida"
        && pedido.estado !== "Cancelada"
        && Array.isArray(pedido.itens)
    );

    const detalhes = [];
    const total = pedidosAbertos.reduce((soma, pedido) => {
        return soma + pedido.itens.reduce((subtotal, item) => {
            const mesmoId = idProduto && String(item.id || item.produto_id || "") === idProduto;
            const mesmoSku = skuProduto && String(item.sku || "").trim().toUpperCase() === skuProduto;
            if (!mesmoId && !mesmoSku) return subtotal;
            const quantidade = Math.max(0, Number(item.quantidade || 0));
            const recebido = Math.max(0, Number(item.recebido || 0));
            const pendente = Math.max(0, quantidade - recebido);
            if (pendente > 0) {
                detalhes.push(`${pedido.codigo || "Encomenda"}${pedido.fornecedor ? ` - ${pedido.fornecedor}` : ""}: ${pendente}`);
            }
            return subtotal + pendente;
        }, 0);
    }, 0);

    return { total, detalhes };
}

async function carregarCatalogoFornecedores() {
    const respostaAdmin = await fornecedoresClient.rpc('listar_produtos_plataforma_admin');
    const produtos = Array.isArray(respostaAdmin.data) ? respostaAdmin.data : [];

    if (respostaAdmin.error) {
        console.warn('Catalogo administrativo indisponivel.', respostaAdmin.error);
        throw new Error('Execute o SQL atualizado no Supabase para carregar o catalogo administrativo.');
    } else if (produtos.length && !produtos.some(produto =>
        Object.prototype.hasOwnProperty.call(produto, "lego")
        && Object.prototype.hasOwnProperty.call(produto, "top")
        && Object.prototype.hasOwnProperty.call(produto, "descontinuado")
        && Object.prototype.hasOwnProperty.call(produto, "fornecedores")
        && Object.prototype.hasOwnProperty.call(produto, "tema")
        && Object.prototype.hasOwnProperty.call(produto, "subtema")
        && Object.prototype.hasOwnProperty.call(produto, "referencia")
        && Object.prototype.hasOwnProperty.call(produto, "novidade")
    )) {
        definirStatusFornecedor('O Supabase ainda nao esta a devolver todos os campos dos fornecedores. Execute o SQL atualizado.', true);
    }

    fornecedorProdutos = [];
    fundirProdutosFornecedor(produtos);

    fornecedorSelecao = fornecedorSelecao.map(item => {
        const atual = obterProdutoAtual(item.id);
        if (!atual) return null;
        return { ...atual, quantidade: Math.max(1, Number(item.quantidade) || 1) };
    }).filter(Boolean);
    guardarSelecaoFornecedor();
}

function estaPaginaFornecedoresUnificada() {
    return Boolean(
        document.body?.classList.contains("pagina-fornecedores-unificada")
    );
}

function obterTopProdutoFornecedor(produto) {
    return produto?.top || produto?.tipo || produto?.destaque || "";
}

function obterLegoProdutoFornecedor(produto) {
    return String(produto?.lego || produto?.marca || "").trim();
}

function criarCelulaMapaFornecedor(texto, className = "") {
    const celula = document.createElement("td");
    if (className) celula.className = className;
    celula.textContent = texto ?? "";
    return celula;
}

function criarInputEdicaoMapa(form, id, rotulo, valor, tipo = "text", opcoes = {}) {
    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.className = opcoes.largo ? "mapas-produto-campo mapas-produto-campo-largo" : "mapas-produto-campo";
    label.textContent = rotulo;

    const input = document.createElement(opcoes.multilinha ? "textarea" : "input");
    input.id = id;
    input.name = id;
    if (!opcoes.multilinha) input.type = tipo;
    input.value = valor ?? "";
    if (opcoes.required) input.required = true;
    if (opcoes.min !== undefined) input.min = String(opcoes.min);
    if (opcoes.step !== undefined) input.step = String(opcoes.step);
    if (opcoes.rows) input.rows = opcoes.rows;

    label.appendChild(input);
    form.appendChild(label);
    return input;
}

function criarCheckboxEdicaoMapa(form, id, rotulo, marcado) {
    const label = document.createElement("label");
    label.className = "mapas-edicao-checkbox";
    const input = document.createElement("input");
    input.id = id;
    input.name = id;
    input.type = "checkbox";
    input.checked = Boolean(marcado);
    const texto = document.createElement("span");
    texto.textContent = rotulo;
    label.append(input, texto);
    form.appendChild(label);
    return input;
}

function criarSelectEdicaoMapa(form, id, rotulo, valor, opcoes = []) {
    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.className = "mapas-produto-campo";
    label.textContent = rotulo;

    const select = document.createElement("select");
    select.id = id;
    select.name = id;

    opcoes.forEach(({ valor: valorOpcao, texto }) => {
        const option = document.createElement("option");
        option.value = valorOpcao;
        option.textContent = texto;
        select.appendChild(option);
    });

    select.value = valor ?? "";
    label.appendChild(select);
    form.appendChild(label);
    return select;
}

function criarSecaoEdicaoMapa(titulo, classe = "") {
    const secao = document.createElement("fieldset");
    secao.className = `mapas-produto-secao ${classe}`.trim();
    const legenda = document.createElement("legend");
    legenda.textContent = titulo;
    secao.appendChild(legenda);
    return secao;
}

function obterTotalUnidadesEncomendaFornecedor() {
    return fornecedorSelecao.reduce((soma, item) => soma + Math.max(0, Number(item.quantidade || 0)), 0);
}

function obterTextoTotalUnidadesEncomendaFornecedor() {
    const unidades = obterTotalUnidadesEncomendaFornecedor();
    if (unidades === 0) return "Encomenda actual: 0 unidades";
    if (unidades === 1) return "Encomenda actual: 1 unidade";
    return `Encomenda actual: ${unidades} unidades`;
}

function obterTextoTotalFigurasEncomendaFornecedor() {
    const total = obterTotalUnidadesEncomendaFornecedor();
    if (total === 1) return "1 figura";
    return `${total} figuras`;
}

function atualizarTotalFigurasEncomendaFornecedor() {
    const alvo = document.getElementById("fornecedor-total-figuras-encomenda");
    if (!alvo || !estaPaginaFornecedoresUnificada()) return;
    alvo.textContent = obterTextoTotalFigurasEncomendaFornecedor();
    alvo.hidden = fornecedorSelecao.length === 0;
}

function atualizarResumoEncomendaFornecedor(opcoes = {}) {
    const alvo = document.getElementById("fornecedor-resumo-encomenda");
    if (!alvo || !estaPaginaFornecedoresUnificada()) return;

    if (typeof opcoes.totalFiltrados === "number") {
        fornecedorResumoEncomenda.totalFiltrados = opcoes.totalFiltrados;
    }
    if (typeof opcoes.apresentados === "number") {
        fornecedorResumoEncomenda.apresentados = opcoes.apresentados;
    }
    if (typeof opcoes.limite === "number") {
        fornecedorResumoEncomenda.limite = opcoes.limite;
    }

    const { totalFiltrados, limite } = fornecedorResumoEncomenda;

    let textoProdutos;
    if (totalFiltrados <= 0) {
        textoProdutos = "Nenhum produto encontrado.";
    } else if (totalFiltrados > limite) {
        textoProdutos = `${Math.min(totalFiltrados, limite)} de ${totalFiltrados} produto(s)`;
    } else {
        textoProdutos = `${totalFiltrados} produto(s)`;
    }

    let texto = document.getElementById("fornecedor-resumo-encomenda-texto");
    if (!texto) {
        texto = document.createElement("span");
        texto.id = "fornecedor-resumo-encomenda-texto";
        texto.className = "fornecedor-resumo-encomenda-texto";
        alvo.querySelector(".fornecedor-resumo-encomenda-centro")?.appendChild(texto) || alvo.appendChild(texto);
    }
    texto.textContent = textoProdutos;

    let unidades = document.getElementById("fornecedor-resumo-encomenda-unidades");
    if (!unidades) {
        unidades = document.createElement("span");
        unidades.id = "fornecedor-resumo-encomenda-unidades";
        unidades.className = "fornecedor-resumo-encomenda-unidades";
        alvo.appendChild(unidades);
    }
    unidades.textContent = obterTextoTotalUnidadesEncomendaFornecedor();
    atualizarTotalFigurasEncomendaFornecedor();
    atualizarBotaoJuntarSelecaoFornecedor();
}

function obterTextoResumoMarcacaoFornecedor(fornecedor, fornecedorMarcacao, filtroFornecedor) {
    if (!filtroFornecedor || filtroFornecedor === "todos") return "";
    const rotulos = {
        os: "OS",
        ex: "EX",
        "os-ou-ex": "OS ou EX",
        disponivel: "Disponivel"
    };
    const rotulo = rotulos[filtroFornecedor] || filtroFornecedor;
    if (fornecedorMarcacao && fornecedor && fornecedorMarcacao !== fornecedor) {
        return ` | Marcação ${rotulo} de ${fornecedorMarcacao} (encomenda a ${fornecedor})`;
    }
    if (fornecedorMarcacao) {
        return ` | Marcação ${rotulo} de ${fornecedorMarcacao}`;
    }
    return "";
}

function obterCabecalhoFixoTabelaEncomendaFornecedor() {
    const caixa = document.getElementById("fornecedor-resultados");
    const bloc = caixa?.closest(".fornecedor-tabela-encomenda-bloco");
    if (!bloc || !estaPaginaFornecedoresUnificada()) return null;

    let cabecalhoFixo = bloc.querySelector(".fornecedor-tabela-cabecalho-fixo");
    if (!cabecalhoFixo) {
        cabecalhoFixo = document.createElement("div");
        cabecalhoFixo.className = "fornecedor-tabela-cabecalho-fixo";
        bloc.insertBefore(cabecalhoFixo, caixa);
    }
    return cabecalhoFixo;
}

function removerCabecalhoFixoTabelaEncomendaFornecedor() {
    document.querySelector(".fornecedor-tabela-cabecalho-fixo")?.remove();
}

function limparCabecalhoFixoTabelaEncomendaFornecedor() {
    obterCabecalhoFixoTabelaEncomendaFornecedor()?.replaceChildren();
}

function ligarScrollHorizontalTabelaEncomendaFornecedor() {
    const caixa = document.getElementById("fornecedor-resultados");
    const cabecalhoFixo = document.querySelector(".fornecedor-tabela-cabecalho-fixo");
    if (!caixa || !cabecalhoFixo || caixa.dataset.scrollSync === "1") return;

    caixa.dataset.scrollSync = "1";
    caixa.addEventListener("scroll", () => {
        cabecalhoFixo.scrollLeft = caixa.scrollLeft;
    }, { passive: true });
}

function aplicarColgroupTabelaEncomendaFornecedor(tabela, larguras) {
    let colgroup = tabela.querySelector("colgroup");
    if (!colgroup) {
        colgroup = document.createElement("colgroup");
        tabela.insertBefore(colgroup, tabela.firstChild);
    }
    colgroup.replaceChildren();
    larguras.forEach((largura) => {
        const col = document.createElement("col");
        col.style.width = `${largura}px`;
        colgroup.appendChild(col);
    });
    const larguraTotal = larguras.reduce((total, largura) => total + largura, 0);
    tabela.style.tableLayout = "fixed";
    tabela.style.width = `${larguraTotal}px`;
}

function sincronizarLargurasColunasTabelaEncomendaFornecedor() {
    const cabecalho = document.querySelector(".fornecedor-tabela-cabecalho-fixo .fornecedor-tabela-encomenda");
    const corpo = document.querySelector("#fornecedor-resultados .fornecedor-tabela-encomenda");
    if (!cabecalho || !corpo) return;

    cabecalho.style.tableLayout = "auto";
    corpo.style.tableLayout = "auto";
    cabecalho.style.width = "max-content";
    corpo.style.width = "max-content";
    cabecalho.querySelector("colgroup")?.remove();
    corpo.querySelector("colgroup")?.remove();

    requestAnimationFrame(() => {
        const ths = [...cabecalho.querySelectorAll("th")];
        const linhas = [...corpo.querySelectorAll("tbody tr")];
        if (!ths.length || !linhas.length) return;

        const minimos = [58, 88, 68, 42, 52, 52, 56];
        const larguras = ths.map((_, indice) => minimos[indice] || 0);

        linhas.forEach((linha) => {
            [...linha.children].forEach((celula, indice) => {
                larguras[indice] = Math.max(larguras[indice], celula.offsetWidth);
            });
        });
        ths.forEach((th, indice) => {
            larguras[indice] = Math.max(larguras[indice], th.offsetWidth);
        });

        aplicarColgroupTabelaEncomendaFornecedor(cabecalho, larguras);
        aplicarColgroupTabelaEncomendaFornecedor(corpo, larguras);
    });
}

function observarImagensTabelaEncomendaFornecedor() {
    const corpo = document.querySelector("#fornecedor-resultados .fornecedor-tabela-encomenda");
    if (!corpo) return;

    corpo.querySelectorAll("img").forEach((img) => {
        if (img.complete) return;
        img.addEventListener("load", () => {
            sincronizarLargurasColunasTabelaEncomendaFornecedor();
        }, { once: true });
    });
}

function criarTheadTabelaEncomendaFornecedor() {
    const thead = document.createElement("thead");
    const cabecalho = document.createElement("tr");
    [
        ["", "mapas-col-foto", ""],
        ["Nome", "mapas-col-nome", "nome"],
        ["Ref.", "mapas-col-ref", "ref"],
        ["Stock", "mapas-col-stock", "stock"],
        ["Chegar", "mapas-col-pendente", "pendente"],
        ["Prev.", "mapas-col-previsto", "previsto"],
        ["Qtd", "mapas-col-qtd", "qtd"],
    ].forEach(([texto, classe, coluna]) => {
        const th = document.createElement("th");
        th.className = `${classe} mapas-th-ordenavel`;
        const botao = document.createElement("button");
        botao.type = "button";
        botao.textContent = texto;
        botao.tabIndex = -1;
        if (!coluna) {
            botao.disabled = true;
            botao.classList.add("mapas-th-sem-ordenacao");
        } else {
            const ativo = fornecedorMapaOrdenacao.coluna === coluna;
            if (ativo) {
                botao.setAttribute("aria-sort", fornecedorMapaOrdenacao.direcao === "asc" ? "ascending" : "descending");
                botao.textContent += fornecedorMapaOrdenacao.direcao === "asc" ? " ▲" : " ▼";
            }
            botao.addEventListener("click", () => {
                const mesmaColuna = fornecedorMapaOrdenacao.coluna === coluna;
                fornecedorMapaOrdenacao = {
                    coluna,
                    direcao: mesmaColuna && fornecedorMapaOrdenacao.direcao === "asc" ? "desc" : "asc"
                };
                renderizarResultadosFornecedor();
            });
        }
        th.appendChild(botao);
        cabecalho.appendChild(th);
    });
    thead.appendChild(cabecalho);
    return thead;
}

function renderizarResultadosFornecedorTabelaEncomenda(caixa, resultados) {
    caixa.classList.add("fornecedor-resultados-mapa");
    const limiteResultados = 250;

    atualizarResumoEncomendaFornecedor({
        totalFiltrados: resultados.length,
        apresentados: Math.min(resultados.length, limiteResultados),
        limite: limiteResultados
    });

    if (!resultados.length) {
        removerCabecalhoFixoTabelaEncomendaFornecedor();
        return;
    }

    removerCabecalhoFixoTabelaEncomendaFornecedor();

    const envoltorio = document.createElement("div");
    envoltorio.className = "mapas-tabela-wrapper fornecedor-tabela-wrapper-centro";

    const tabela = document.createElement("table");
    tabela.className = "mapas-produtos-tabela fornecedor-tabela-encomenda";

    tabela.appendChild(criarTheadTabelaEncomendaFornecedor());

    const tbody = document.createElement("tbody");
    const resultadosOrdenados = resultados
        .slice()
        .sort((a, b) => compararProdutosPorColunaFornecedor(a, b, fornecedorMapaOrdenacao.coluna, fornecedorMapaOrdenacao.direcao))
        .slice(0, limiteResultados);

    resultadosOrdenados.forEach(({ produto }) => {
        const atual = produto;
        const linha = document.createElement("tr");
        const stockNumero = Number(atual.stock || 0);
        const pendentes = obterPendentesDetalhadosProdutoFornecedor(atual);
        const pendente = pendentes.total;
        const previsto = stockNumero + pendente;

        const fotoCelula = document.createElement("td");
        fotoCelula.className = "mapas-col-foto";
        fotoCelula.appendChild(criarImagemFornecedor(atual, "fornecedor-miniatura pequena"));
        linha.appendChild(fotoCelula);

        const nomeCelula = document.createElement("td");
        nomeCelula.className = "mapas-col-nome";
        const nomeBotao = document.createElement("button");
        nomeBotao.type = "button";
        nomeBotao.className = "mapas-produto-nome-botao";
        nomeBotao.textContent = atual.nome || "Produto sem nome";
        nomeBotao.title = "Editar produto";
        nomeBotao.tabIndex = -1;
        nomeBotao.addEventListener("click", () => abrirEdicaoProdutoMapa(atual.id));
        nomeCelula.appendChild(nomeBotao);
        linha.appendChild(nomeCelula);

        const refCelula = document.createElement("td");
        refCelula.className = "mapas-col-ref";
        refCelula.textContent = atual.referencia || "-";
        linha.appendChild(refCelula);

        linha.appendChild(criarCelulaMapaFornecedor(stockNumero, `mapas-col-stock mapa-stock-celula ${stockNumero <= 0 ? "sem-stock" : ""}`));
        const pendenteCelula = criarCelulaMapaFornecedor(pendente, `mapas-col-pendente mapa-pendente-celula ${pendente > 0 ? "com-pendente" : ""}`);
        if (pendentes.detalhes.length) {
            pendenteCelula.title = pendentes.detalhes.join("\n");
        }
        linha.appendChild(pendenteCelula);
        linha.appendChild(criarCelulaMapaFornecedor(previsto, `mapas-col-previsto mapa-previsto-celula ${previsto > stockNumero ? "com-pendente" : ""}`));

        const qtdCelula = document.createElement("td");
        qtdCelula.className = "mapas-col-qtd";
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.step = "1";
        const quantidadeSelecionada = obterQuantidadeSelecionadaFornecedor(atual.id);
        input.value = quantidadeSelecionada > 0 ? String(quantidadeSelecionada) : "";
        if (quantidadeSelecionada <= 0) input.removeAttribute("value");
        input.className = "mapa-quantidade-input";
        input.setAttribute("aria-label", `Quantidade de ${atual.nome || "produto"}`);
        input.addEventListener("keydown", tratarTeclaQuantidadeMapa);
        input.addEventListener("change", () => definirQuantidadeMapaFornecedor(atual, input.value));
        input.addEventListener("blur", () => definirQuantidadeMapaFornecedor(atual, input.value));
        ligarSelecaoLinhaQuantidadeMapa(input);
        qtdCelula.appendChild(input);
        linha.appendChild(qtdCelula);

        tbody.appendChild(linha);
    });

    tabela.appendChild(tbody);
    envoltorio.appendChild(tabela);
    caixa.appendChild(envoltorio);
}

function renderizarResultadosFornecedor() {
    const caixa = document.getElementById("fornecedor-resultados");
    if (!caixa) return;

    if (estaPaginaFornecedoresUnificada()) {
        caixa.classList.add("fornecedor-resultados-mapa");
    } else {
        removerCabecalhoFixoTabelaEncomendaFornecedor();
        delete caixa.dataset.scrollSync;
        caixa.classList.remove("fornecedor-resultados-mapa");
    }

    const { termo, fornecedor, fornecedorMarcacao, filtroFornecedor, filtroTop, filtroArquivado, filtroDescontinuado, ordenacao } = obterControlosResultadosFornecedor();
    caixa.replaceChildren();

    const resultados = fornecedorProdutos
        .map((produto) => ({
            produto,
            score: calcularScoreResultadoFornecedor(produto, termo),
        }))
        .filter((item) => (
            (!termo || item.score < 99)
            && produtoPassaFiltroFornecedor(item.produto, fornecedorMarcacao, filtroFornecedor)
            && produtoPassaFiltroTopFornecedor(item.produto, filtroTop)
            && produtoPassaFiltroArquivadoFornecedor(item.produto, filtroArquivado)
            && produtoPassaFiltroDescontinuadoFornecedor(item.produto, filtroDescontinuado)
        ))
        .sort((a, b) => compararProdutosFornecedor(a, b, ordenacao));

    if (estaPaginaFornecedoresUnificada()) {
        renderizarResultadosFornecedorTabelaEncomenda(caixa, resultados);
        return;
    }

    caixa.classList.remove("fornecedor-resultados-mapa");

    const resumo = document.createElement("p");
    resumo.className = "fornecedor-contagem-lista";
    const resumoMarcacao = obterTextoResumoMarcacaoFornecedor(fornecedor, fornecedorMarcacao, filtroFornecedor);
    resumo.textContent = resultados.length
        ? `${resultados.length} produto(s) apresentados${resumoMarcacao}`
        : "Nenhum produto encontrado.";
    caixa.appendChild(resumo);

    resultados.forEach(({ produto }) => {
        const atual = produto;
        const linha = document.createElement("div");
        linha.className = "fornecedor-produto";
        linha.appendChild(criarImagemFornecedor(atual, "fornecedor-miniatura"));

        const info = document.createElement("div");
        info.className = "fornecedor-info";

        const nome = document.createElement("strong");
        nome.textContent = atual.nome || "Produto sem nome";
        info.appendChild(nome);

        const ids = document.createElement("span");
        ids.className = "fornecedor-identificadores";
        ids.textContent = `${atual.referencia ? `Ref. ${atual.referencia} | ` : ""}SKU ${atual.sku || "-"}`;
        info.appendChild(ids);

        const estadoFornecedor = classificarValorFornecedor(obterValorFornecedorProduto(atual, fornecedorMarcacao));
        if (fornecedorMarcacao && fornecedorMarcacao !== "Outro" && filtroFornecedor !== "todos") {
            const fornecedorLinha = document.createElement("span");
            fornecedorLinha.className = `fornecedor-marcacao ${estadoFornecedor.tipo}`;
            fornecedorLinha.textContent = `${fornecedorMarcacao}: ${estadoFornecedor.texto}`;
            info.appendChild(fornecedorLinha);
        }

        const stock = document.createElement("span");
        stock.className = `fornecedor-stock ${Number(atual.stock || 0) <= 0 ? "sem-stock" : ""}`;
        stock.textContent = `Stock: ${Number(atual.stock || 0)}`;
        info.appendChild(stock);

        const preco = document.createElement("span");
        preco.className = "fornecedor-preco";
        preco.textContent = formatarEuroFornecedor(atual.preco || 0);
        info.appendChild(preco);

        linha.appendChild(info);

        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "wallapop-botao wallapop-botao-destaque";
        botao.textContent = "Adicionar";
        botao.addEventListener("click", () => adicionarProdutoFornecedor(atual));
        linha.appendChild(botao);

        caixa.appendChild(linha);
    });
}

function agendarRenderizacaoResultadosFornecedor() {
    if (fornecedorRenderizacaoPendente) {
        clearTimeout(fornecedorRenderizacaoPendente);
    }
    fornecedorRenderizacaoPendente = setTimeout(() => {
        fornecedorRenderizacaoPendente = null;
        renderizarResultadosFornecedor();
    }, 120);
}

function adicionarProdutoFornecedor(produto, quantidade = 1) {
    const quantidadeAdicionar = Math.max(1, Math.floor(Number(quantidade) || 1));
    const existente = fornecedorSelecao.find(item => String(item.id) === String(produto.id));
    if (existente) existente.quantidade += quantidadeAdicionar;
    else fornecedorSelecao.push({ ...produto, quantidade: quantidadeAdicionar });
    guardarSelecaoFornecedor();
    renderizarSelecionadosFornecedor();
    definirStatusFornecedor(quantidadeAdicionar > 1 ? `${quantidadeAdicionar} unidades adicionadas.` : 'Produto adicionado.');
}

function alterarQuantidadeFornecedor(id, delta) {
    fornecedorSelecao = fornecedorSelecao.map(item => {
        if (String(item.id) !== String(id)) return item;
        return { ...item, quantidade: Math.max(1, Number(item.quantidade || 1) + delta) };
    });
    guardarSelecaoFornecedor();
    renderizarSelecionadosFornecedor();
}

function definirPrecoCustoFornecedor(id, valor) {
    const precoCusto = Math.max(0, Number(String(valor || '').replace(',', '.')) || 0);
    fornecedorSelecao = fornecedorSelecao.map(item => {
        if (String(item.id) !== String(id)) return item;
        return { ...item, preco_custo: precoCusto };
    });
    guardarSelecaoFornecedor();
}

function removerProdutoFornecedor(id) {
    fornecedorSelecao = fornecedorSelecao.filter(item => String(item.id) !== String(id));
    guardarSelecaoFornecedor();
    renderizarSelecionadosFornecedor();
}

function renderizarSelecionadosFornecedorTabela(caixa) {
    const envoltorio = document.createElement("div");
    envoltorio.className = "mapas-tabela-wrapper fornecedor-tabela-wrapper-centro";

    const tabela = document.createElement("table");
    tabela.className = "mapas-produtos-tabela fornecedor-tabela-encomenda";

    const thead = document.createElement("thead");
    const cabecalho = document.createElement("tr");
    [
        ["", "mapas-col-foto", ""],
        ["Nome", "mapas-col-nome", "nome"],
        ["Ref.", "mapas-col-ref", "ref"],
        ["Stock", "mapas-col-stock", "stock"],
        ["Qtd", "mapas-col-qtd", "qtd"],
        ["Preço", "mapas-col-preco", "preco"],
        ["", "mapas-col-remover", ""],
    ].forEach(([texto, classe, coluna]) => {
        const th = document.createElement("th");
        th.className = `${classe} mapas-th-ordenavel`;
        const botao = document.createElement("button");
        botao.type = "button";
        botao.textContent = texto;
        botao.tabIndex = -1;
        botao.disabled = true;
        botao.classList.add("mapas-th-sem-ordenacao");
        th.appendChild(botao);
        cabecalho.appendChild(th);
    });
    thead.appendChild(cabecalho);
    tabela.appendChild(thead);

    const tbody = document.createElement("tbody");
    fornecedorSelecao.forEach((item) => {
        const atual = obterProdutoAtual(item.id) || item;
        const stockNumero = Number(atual.stock || 0);
        const linha = document.createElement("tr");

        const fotoCelula = document.createElement("td");
        fotoCelula.className = "mapas-col-foto";
        fotoCelula.appendChild(criarImagemFornecedor(atual, "fornecedor-miniatura pequena"));
        linha.appendChild(fotoCelula);

        const nomeCelula = document.createElement("td");
        nomeCelula.className = "mapas-col-nome";
        const nomeBotao = document.createElement("button");
        nomeBotao.type = "button";
        nomeBotao.className = "mapas-produto-nome-botao";
        nomeBotao.textContent = atual.nome || "Produto sem nome";
        nomeBotao.title = "Editar produto";
        nomeBotao.tabIndex = -1;
        nomeBotao.addEventListener("click", () => abrirEdicaoProdutoMapa(atual.id));
        nomeCelula.appendChild(nomeBotao);
        linha.appendChild(nomeCelula);

        const refCelula = document.createElement("td");
        refCelula.className = "mapas-col-ref";
        refCelula.textContent = atual.referencia || "-";
        linha.appendChild(refCelula);

        linha.appendChild(criarCelulaMapaFornecedor(
            stockNumero,
            `mapas-col-stock mapa-stock-celula ${stockNumero <= 0 ? "sem-stock" : ""}`
        ));

        const qtdCelula = document.createElement("td");
        qtdCelula.className = "mapas-col-qtd";
        const qtd = document.createElement("input");
        qtd.type = "number";
        qtd.min = "1";
        qtd.step = "1";
        qtd.inputMode = "numeric";
        qtd.className = "mapa-quantidade-input";
        qtd.dataset.semLimparCampo = "1";
        qtd.value = String(Math.max(1, Number(item.quantidade) || 1));
        qtd.setAttribute("aria-label", `Quantidade de ${atual.nome || "produto"}`);
        qtd.addEventListener("keydown", tratarTeclaQuantidadeMapa);
        qtd.addEventListener("change", () => definirQuantidadeFornecedor(atual.id, qtd.value));
        qtd.addEventListener("blur", () => definirQuantidadeFornecedor(atual.id, qtd.value));
        qtdCelula.appendChild(qtd);
        linha.appendChild(qtdCelula);

        const precoCelula = document.createElement("td");
        precoCelula.className = "mapas-col-preco";
        const precoCustoInput = document.createElement("input");
        precoCustoInput.type = "number";
        precoCustoInput.min = "0";
        precoCustoInput.step = "0.01";
        precoCustoInput.inputMode = "decimal";
        precoCustoInput.className = "mapa-quantidade-input mapa-preco-input";
        precoCustoInput.dataset.semLimparCampo = "1";
        precoCustoInput.value = Number(item.preco_custo ?? item.custo ?? 0).toFixed(2);
        precoCustoInput.setAttribute("aria-label", `preço compra de ${atual.nome || "produto"}`);
        precoCustoInput.addEventListener("change", () => definirPrecoCustoFornecedor(atual.id, precoCustoInput.value));
        precoCustoInput.addEventListener("blur", () => definirPrecoCustoFornecedor(atual.id, precoCustoInput.value));
        precoCelula.appendChild(precoCustoInput);
        linha.appendChild(precoCelula);

        const removerCelula = document.createElement("td");
        removerCelula.className = "mapas-col-remover";
        const remover = document.createElement("button");
        remover.type = "button";
        remover.className = "fornecedor-remover-linha";
        remover.textContent = "×";
        remover.setAttribute("aria-label", `Remover ${atual.nome || "produto"}`);
        remover.addEventListener("click", () => removerProdutoFornecedor(atual.id));
        removerCelula.appendChild(remover);
        linha.appendChild(removerCelula);

        tbody.appendChild(linha);
    });

    tabela.appendChild(tbody);
    envoltorio.appendChild(tabela);
    caixa.appendChild(envoltorio);
}

function renderizarSelecionadosFornecedor() {
    const caixa = document.getElementById("fornecedor-selecionados");
    if (!caixa) return;
    caixa.replaceChildren();

    if (!fornecedorSelecao.length) {
        const vazio = document.createElement('p');
        vazio.className = 'fornecedor-vazio';
        vazio.textContent = 'A lista esta vazia.';
        caixa.appendChild(vazio);
        atualizarResumoEncomendaFornecedor();
        return;
    }

    if (estaPaginaFornecedoresUnificada()) {
        renderizarSelecionadosFornecedorTabela(caixa);
        atualizarResumoEncomendaFornecedor();
        return;
    }

    fornecedorSelecao.forEach((item) => {
        const atual = obterProdutoAtual(item.id) || item;
        const linha = document.createElement("div");
        linha.className = "fornecedor-item";
        linha.appendChild(criarImagemFornecedor(atual, "fornecedor-miniatura"));

        const info = document.createElement("div");
        info.className = "fornecedor-info";
        const nome = document.createElement("strong");
        nome.textContent = atual.nome || "Produto sem nome";
        info.appendChild(nome);
        const ids = document.createElement("span");
        ids.className = "fornecedor-identificadores";
        ids.textContent = `${atual.referencia ? `Ref. ${atual.referencia} | ` : ""}SKU ${atual.sku || "-"}`;
        info.appendChild(ids);
        const stock = document.createElement("span");
        stock.className = Number(atual.stock || 0) <= 0 ? "fornecedor-stock sem-stock" : "fornecedor-stock";
        stock.textContent = `Stock atual: ${Number(atual.stock || 0)}`;
        info.appendChild(stock);
        linha.appendChild(info);

        const controlos = document.createElement("div");
        controlos.className = "fornecedor-quantidade";

        const menos = document.createElement("button");
        menos.type = "button";
        menos.textContent = "-";
        menos.addEventListener("click", () => alterarQuantidadeFornecedor(atual.id, -1));

        const qtd = document.createElement("input");
        qtd.type = "number";
        qtd.min = "1";
        qtd.step = "1";
        qtd.inputMode = "numeric";
        qtd.className = "fornecedor-quantidade-input";
        qtd.value = Math.max(1, Number(item.quantidade) || 1);
        qtd.setAttribute("aria-label", `Quantidade de ${atual.nome || "produto"}`);
        qtd.addEventListener("change", () => definirQuantidadeFornecedor(atual.id, qtd.value));
        qtd.addEventListener("blur", () => definirQuantidadeFornecedor(atual.id, qtd.value));

        const precoCusto = document.createElement("label");
        precoCusto.className = "fornecedor-preco-custo-label";
        precoCusto.textContent = "preço compra";
        const precoCustoInput = document.createElement("input");
        precoCustoInput.type = "number";
        precoCustoInput.min = "0";
        precoCustoInput.step = "0.01";
        precoCustoInput.inputMode = "decimal";
        precoCustoInput.className = "fornecedor-preco-custo-input";
        precoCustoInput.value = Number(item.preco_custo ?? item.custo ?? 0).toFixed(2);
        precoCustoInput.setAttribute("aria-label", `preço compra de ${atual.nome || "produto"}`);
        precoCustoInput.addEventListener("change", () => definirPrecoCustoFornecedor(atual.id, precoCustoInput.value));
        precoCustoInput.addEventListener("blur", () => definirPrecoCustoFornecedor(atual.id, precoCustoInput.value));
        precoCusto.appendChild(precoCustoInput);

        const mais = document.createElement("button");
        mais.type = "button";
        mais.textContent = "+";
        mais.addEventListener("click", () => alterarQuantidadeFornecedor(atual.id, 1));

        const remover = document.createElement("button");
        remover.type = "button";
        remover.textContent = "x";
        remover.className = "fornecedor-remover";
        remover.addEventListener("click", () => removerProdutoFornecedor(atual.id));

        controlos.append(menos, qtd, mais, precoCusto, remover);
        linha.appendChild(controlos);
        caixa.appendChild(linha);
    });
    atualizarResumoEncomendaFornecedor();
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
    const itens = fornecedorSelecao.map(item => ({
        id: item.id,
        nome: item.nome,
        sku: item.sku || '',
        referencia: item.referencia || '',
        tema: item.tema || '',
        subtema: item.subtema || '',
        quantidade: Math.max(1, Number(item.quantidade) || 1),
        quantidade_original: Math.max(1, Number(item.quantidade) || 1),
        falta_os: 0,
        estado_fornecedor: '',
        origem_ajuste: '',
        recebido: 0,
        novidade: obterNovidadeParaItemPedidoFornecedor(item),
        stock_no_momento: Number(item.stock || 0),
        preco_custo: Number(item.preco_custo ?? item.custo ?? 0) || 0,
        preco: Number(item.preco_custo ?? item.custo ?? 0) || 0,
        imagens: item.imagens || []
    }));

    try {
        definirStatusFornecedor('A criar encomenda no Supabase...');
        const { data, error } = await fornecedoresClient.rpc('criar_encomenda_fornecedor_admin', {
            p_fornecedor: fornecedor,
            p_referencia: '',
            p_itens: itens
        });
        if (error) throw error;
        const pedido = normalizarPedidoFornecedor(data);
        fornecedorPedidos.unshift(pedido);
        guardarPedidosFornecedores();
        try {
            await sincronizarHistoricoPedidosFornecedor(itens, fornecedor, { modo: "criar" });
        } catch (erroHistorico) {
            console.warn("Nao foi possivel registar histórico Solicitada na ficha.", erroHistorico);
        }
        fornecedorSelecao = [];
        guardarSelecaoFornecedor();
        renderizarResultadosFornecedor();
        renderizarSelecionadosFornecedor();
        renderizarPedidosFornecedores();
        exportarTxtPedidoFornecedor(pedido);
        definirStatusFornecedor(
            pedido.codigo
                ? `Encomenda ${pedido.codigo} criada.`
                : "Encomenda criada. Adicione o código de seguimento quando o receber."
        );
    } catch (error) {
        console.error(error);
        definirStatusFornecedor('Erro ao criar encomenda de fornecedor: ' + (error.message || 'erro desconhecido'), true);
    }
}
async function alterarEstadoPedidoFornecedor(id, estado) {
    const pedido = fornecedorPedidos.find(item => item.id === id);
    if (!pedido) return;
    const estadoAnterior = pedido.estado;
    try {
        const { data, error } = await fornecedoresClient.rpc('alterar_estado_encomenda_fornecedor_admin', {
            p_id: id,
            p_estado: estado
        });
        if (error) throw error;
        const atualizado = normalizarPedidoFornecedor(data);
        if (
            estadoPedidoFornecedorEhEncomendada(atualizado.estado)
            && !estadoPedidoFornecedorEhEncomendada(estadoAnterior)
            && !atualizado.data_encomendada
        ) {
            atualizado.data_encomendada = dataOsAgoraFornecedor();
        }
        fornecedorPedidos = fornecedorPedidos.map(item => item.id === id ? atualizado : item);
        guardarPedidosFornecedores();
        if (deveConfirmarHistoricoPedidoFornecedor(estadoAnterior, atualizado.estado)) {
            try {
                const atualizados = await sincronizarHistoricoPedidosFornecedor(atualizado.itens || [], atualizado.fornecedor, { modo: "confirmar" });
                try {
                    await carregarCatalogoFornecedores();
                } catch (erroCatalogo) {
                    console.warn("Catalogo nao recarregado apos sincronizar marcacoes.", erroCatalogo);
                }
                renderizarResultadosFornecedor();
                renderizarPedidosFornecedores();
                definirStatusFornecedor(
                    atualizados > 0
                        ? `Estado da encomenda ${atualizado.codigo} atualizado. Marcação atualizada em ${atualizados} produto(s).`
                        : `Estado da encomenda ${atualizado.codigo} atualizado, mas nenhuma marcação de produto foi alterada. Confirma se os itens têm quantidade/OS e existem no catálogo.`
                );
                return;
            } catch (erroHistorico) {
                console.warn("Nao foi possivel atualizar o histórico na ficha.", erroHistorico);
                definirStatusFornecedor(`Estado atualizado, mas falhou a atualização do histórico na ficha: ${erroHistorico.message || "erro"}`, true);
                renderizarResultadosFornecedor();
                renderizarPedidosFornecedores();
                return;
            }
        }
        renderizarResultadosFornecedor();
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
    if (!window.confirm(`Apagar a encomenda ${obterTextoCodigoPedidoFornecedor(pedido)}? Isto nao altera o stock.`)) return;
    try {
        const { error } = await fornecedoresClient.rpc('apagar_encomenda_fornecedor_admin', { p_id: id });
        if (error) throw error;
        fornecedorPedidos = fornecedorPedidos.filter(item => item.id !== id);
        guardarPedidosFornecedores();
        renderizarResultadosFornecedor();
        renderizarPedidosFornecedores();
        definirStatusFornecedor(`Encomenda ${pedido.codigo} apagada.`);
    } catch (error) {
        console.error(error);
        definirStatusFornecedor('Erro ao apagar encomenda: ' + (error.message || 'erro desconhecido'), true);
    }
}

async function atualizarPedidoFornecedor(id, alteracoes) {
    const idPedido = String(id);
    const pedidoAntes = fornecedorPedidos.find(item => String(item.id) === idPedido);
    const payload = { ...(alteracoes || {}) };
    if (Array.isArray(payload.itens)) {
        payload.itens = consolidarItensPedidoFornecedor(serializarItensPedidoFornecedor(payload.itens));
    }
    const { data, error } = await fornecedoresClient.rpc('atualizar_encomenda_fornecedor_admin', {
        p_id: idPedido,
        p_dados: payload
    });
    if (error) throw error;
    const atualizado = normalizarPedidoFornecedor(data);
    if (
        estadoPedidoFornecedorEhEncomendada(atualizado.estado)
        && pedidoAntes
        && !estadoPedidoFornecedorEhEncomendada(pedidoAntes.estado)
        && !atualizado.data_encomendada
    ) {
        atualizado.data_encomendada = dataOsAgoraFornecedor();
    }
    fornecedorPedidos = fornecedorPedidos.map(item => String(item.id) === idPedido ? atualizado : item);
    guardarPedidosFornecedores();
    renderizarResultadosFornecedor();
    renderizarSelecionadosFornecedor();
    renderizarPedidosFornecedores();
    return atualizado;
}

function criarItemFornecedorAPartirSelecao(item, origemAjuste = '') {
    const quantidade = Math.max(1, Math.floor(Number(item.quantidade) || 1));
    return normalizarItemPedidoFornecedor({
        id: item.id,
        nome: item.nome,
        sku: item.sku || '',
        referencia: item.referencia || '',
        tema: item.tema || '',
        subtema: item.subtema || '',
        quantidade,
        quantidade_original: quantidade,
        falta_os: 0,
        estado_fornecedor: '',
        origem_ajuste: origemAjuste,
        recebido: 0,
        novidade: obterNovidadeParaItemPedidoFornecedor(item),
        stock_no_momento: Number(item.stock || 0),
        preco_custo: Number(item.preco_custo ?? item.custo ?? 0) || 0,
        preco: Number(item.preco_custo ?? item.custo ?? 0) || 0,
        imagens: item.imagens || []
    });
}

function obterObjetoFornecedoresProduto(produto) {
    if (!produto?.fornecedores) return {};
    if (typeof produto.fornecedores === 'string') {
        try {
            const convertido = JSON.parse(produto.fornecedores);
            return convertido && typeof convertido === 'object' ? convertido : {};
        } catch (_) {
            return {};
        }
    }
    return typeof produto.fornecedores === 'object' ? { ...produto.fornecedores } : {};
}

function definirFornecedorOsNoProduto(produto, fornecedorNome) {
    const chaveNormalizada = normalizarChaveFornecedor(fornecedorNome);
    if (!produto || !chaveNormalizada) return null;
    const fornecedores = obterObjetoFornecedoresProduto(produto);
    const chaveExistente = Object.keys(fornecedores).find(chave => normalizarChaveFornecedor(chave) === chaveNormalizada);
    const chave = chaveExistente || fornecedorNome;
    fornecedores[chave] = criarMarcacaoOsFornecedor(fornecedores[chave], dataOsAgoraFornecedor());
    return fornecedores;
}

function definirEventoFornecedorNoProduto(produto, fornecedorNome, tipo, data = dataOsAgoraFornecedor()) {
    const chaveNormalizada = normalizarChaveFornecedor(fornecedorNome);
    if (!produto || !chaveNormalizada) return null;
    const fornecedores = obterObjetoFornecedoresProduto(produto);
    const chaveExistente = Object.keys(fornecedores).find(chave => normalizarChaveFornecedor(chave) === chaveNormalizada);
    const chave = chaveExistente || fornecedorNome;
    fornecedores[chave] = acrescentarHistoricoFornecedor(fornecedores[chave], tipo, data);
    return fornecedores;
}

function chaveItemHistoricoPedidoFornecedor(item) {
    return String(item?.id || item?.sku || item?.referencia || "").trim().toUpperCase();
}

function itemPedidoEstavaOsFornecedor(item) {
    if (!item) return false;
    return Math.max(0, Number(item.falta_os || 0)) > 0
        || String(item.estado_fornecedor || "").trim().toUpperCase() === "OS";
}

async function sincronizarHistoricoPedidosFornecedor(itens, fornecedorNome, opcoes = {}) {
    if (!fornecedoresClient || !fornecedorNome || fornecedorNome === "Outro") return 0;
    const modoBruto = String(opcoes.modo || "criar").trim().toLowerCase();
    const modo = modoBruto === "editar" ? "editar" : (modoBruto === "confirmar" ? "confirmar" : "criar");
    const mapaAnterior = new Map(
        (opcoes.itensAnteriores || []).map((item) => [chaveItemHistoricoPedidoFornecedor(item), item])
    );
    const agora = dataOsAgoraFornecedor();
    let atualizados = 0;
    let semProduto = 0;

    for (const item of (itens || [])) {
        const quantidade = Math.max(0, Number(item?.quantidade || 0));
        const faltaOs = Math.max(0, Number(item?.falta_os || 0));
        if (quantidade <= 0 && faltaOs <= 0 && String(item?.estado_fornecedor || "").trim().toUpperCase() !== "OS") {
            continue;
        }

        let produtoAtual = obterProdutoParaPedidoFornecedor(item);
        if (!produtoAtual?.id) {
            semProduto += 1;
            continue;
        }

        // Relê fornecedores frescos da memória (após updates anteriores neste loop)
        produtoAtual = obterProdutoParaPedidoFornecedor(item) || produtoAtual;

        const anterior = mapaAnterior.get(chaveItemHistoricoPedidoFornecedor(item));
        const eraOs = itemPedidoEstavaOsFornecedor(anterior);
        const agoraOs = faltaOs > 0 || String(item.estado_fornecedor || "").trim().toUpperCase() === "OS";

        let fornecedores = obterObjetoFornecedoresProduto(produtoAtual);
        const chaveNormalizada = normalizarChaveFornecedor(fornecedorNome);
        const chaveExistente = Object.keys(fornecedores).find(chave => normalizarChaveFornecedor(chave) === chaveNormalizada);
        const chave = chaveExistente || fornecedorNome;
        let atual = fornecedores[chave];
        let alterou = false;

        if (modo === "criar") {
            if (agoraOs) {
                atual = acrescentarHistoricoFornecedor(atual, "os", agora);
                alterou = true;
            } else if (quantidade > 0) {
                atual = acrescentarHistoricoFornecedor(atual, "solicitada", agora);
                alterou = true;
            }
        } else if (modo === "editar") {
            // OS total (nada a receber): atualiza historico já na edição
            // OS parcial: historico "Encomendada / OS" só ao confirmar estado Encomendada/Recebida
            if (agoraOs && !eraOs && quantidade <= 0) {
                atual = corrigirUltimaTentativaParaOs(atual, agora);
                alterou = true;
            } else if (!anterior && quantidade > 0) {
                atual = acrescentarHistoricoFornecedor(atual, "solicitada", agora);
                alterou = true;
            }
        } else if (modo === "confirmar") {
            // A preparar → Encomendada
            const parcial = quantidade > 0 && agoraOs;
            if (parcial) {
                // Histórico: uma linha "Encomendada / OS" | Marcação atual: OS
                atual = confirmarTentativaParcialFornecedor(atual, agora);
                alterou = true;
            } else if (agoraOs) {
                // Sem unidades a receber: só OS
                let base = atual;
                const marcacao = normalizarMarcacaoFornecedor(atual);
                const ultimo = marcacao.historico[marcacao.historico.length - 1];
                if (!ultimo || ultimo.tipo !== "os") {
                    base = corrigirUltimaTentativaParaOs(atual, agora);
                }
                atual = aplicarMarcacaoAtualAposConfirmar(base, "OS", agora);
                alterou = true;
            } else if (quantidade > 0) {
                // Tudo disponível: Encomendada no histórico e na marcação atual
                const promovido = promoverUltimaSolicitadaParaEncomendada(atual, agora);
                atual = promovido || garantirMarcacaoEncomendadaFornecedor(atual, agora);
                alterou = true;
            }
        }

        if (!alterou) continue;
        fornecedores = { ...fornecedores, [chave]: atual };

        const { error } = await fornecedoresClient.rpc("atualizar_fornecedores_produto_admin", {
            p_id: String(produtoAtual.id),
            p_fornecedores: fornecedores
        });
        if (error) throw error;
        fornecedorProdutos = fornecedorProdutos.map(produto =>
            String(produto.id) === String(produtoAtual.id) ? { ...produto, fornecedores } : produto
        );
        atualizados += 1;
    }

    if (semProduto > 0) {
        console.warn(`Sincronização de marcações: ${semProduto} item(ns) sem produto no catálogo.`);
    }

    return atualizados;
}

async function sincronizarOsProdutosFornecedor(itens, fornecedorNome) {
    return sincronizarHistoricoPedidosFornecedor(itens, fornecedorNome, { modo: "criar" });
}

async function sincronizarPrecoCompraProdutosFornecedor(itens) {
    if (!fornecedoresClient) return 0;
    const porProduto = new Map();
    (itens || []).forEach(item => {
        const precoCompra = Math.max(0, Number(item?.preco_custo ?? item?.preco_compra ?? item?.custo ?? 0) || 0);
        if (precoCompra <= 0) return;
        const produtoAtual = obterProdutoParaPedidoFornecedor(item);
        const chave = String(produtoAtual?.id || item?.id || item?.sku || item?.referencia || "").trim();
        if (!chave) return;
        porProduto.set(chave, { item, produtoAtual, precoCompra });
    });

    let atualizados = 0;
    for (const { item, produtoAtual, precoCompra } of porProduto.values()) {
        const { data, error } = await fornecedoresClient.rpc("atualizar_preco_compra_produto_admin", {
            p_id: produtoAtual?.id || item.id || null,
            p_sku: produtoAtual?.sku || item.sku || null,
            p_referencia: produtoAtual?.referencia || item.referencia || null,
            p_preco_compra: precoCompra
        });
        if (error) throw error;
        const idAtualizado = String(data?.id || produtoAtual?.id || item.id || "");
        fornecedorProdutos = fornecedorProdutos.map(produto => {
            const mesmoId = idAtualizado && String(produto.id || "") === idAtualizado;
            const mesmoSku = !idAtualizado && String(produto.sku || "").trim().toUpperCase() === String(item.sku || "").trim().toUpperCase();
            const mesmaRef = !idAtualizado && String(produto.referencia || "").trim().toUpperCase() === String(item.referencia || "").trim().toUpperCase();
            return mesmoId || mesmoSku || mesmaRef ? { ...produto, preco_compra: precoCompra } : produto;
        });
        fornecedorSelecao = fornecedorSelecao.map(produto =>
            String(produto.id || "") === idAtualizado ? { ...produto, preco_compra: precoCompra } : produto
        );
        atualizados += 1;
    }

    if (atualizados) guardarSelecaoFornecedor();
    return atualizados;
}

function sincronizarPedidoAlvoJuntarSelecaoFornecedor() {
    if (fornecedorPedidoAlvoJuntar && fornecedorPedidosAbertos.has(fornecedorPedidoAlvoJuntar)) {
        return;
    }
    const abertos = [...fornecedorPedidosAbertos];
    fornecedorPedidoAlvoJuntar = abertos.length ? abertos[abertos.length - 1] : null;
}

function obterPedidoAlvoJuntarSelecaoFornecedor() {
    if (!fornecedorPedidoAlvoJuntar) return null;
    return fornecedorPedidos.find(pedido => String(pedido.id) === fornecedorPedidoAlvoJuntar) || null;
}

function atualizarBotaoJuntarSelecaoFornecedor() {
    const botao = document.getElementById("btn-juntar-selecao-fornecedor");
    if (!botao || !estaPaginaFornecedoresUnificada()) return;

    sincronizarPedidoAlvoJuntarSelecaoFornecedor();
    const pedido = obterPedidoAlvoJuntarSelecaoFornecedor();
    const temSelecao = fornecedorSelecao.length > 0;
    const podeJuntar = temSelecao && Boolean(pedido);

    botao.disabled = !podeJuntar;

    if (!temSelecao) {
        botao.title = "Selecione primeiro produtos na lista acima.";
    } else if (!pedido) {
        botao.title = "Abra acima a encomenda existente onde pretende juntar a seleção.";
    } else {
        botao.title = `Juntar seleção à encomenda ${obterTextoCodigoPedidoFornecedor(pedido)}.`;
    }
}

async function juntarSelecaoAEncomendaExistenteFornecedor() {
    sincronizarPedidoAlvoJuntarSelecaoFornecedor();
    const pedido = obterPedidoAlvoJuntarSelecaoFornecedor();
    if (!pedido) {
        definirStatusFornecedor("Abra acima a encomenda existente onde pretende juntar a seleção.", true);
        return;
    }
    await adicionarSelecaoAoPedidoFornecedor(pedido.id);
    atualizarBotaoJuntarSelecaoFornecedor();
}

async function adicionarSelecaoAoPedidoFornecedor(id) {
    const pedido = fornecedorPedidos.find(item => item.id === id);
    if (!pedido) return;
    if (!fornecedorSelecao.length) {
        definirStatusFornecedor('Escolha primeiro os produtos e depois junte a selecao a esta encomenda.', true);
        return;
    }
    const total = fornecedorSelecao.reduce((soma, item) => soma + Math.max(1, Math.floor(Number(item.quantidade) || 1)), 0);
    if (!window.confirm(`Adicionar ${total} unidade(s) selecionada(s) a ${obterTextoCodigoPedidoFornecedor(pedido)}?`)) return;

    const itens = serializarItensPedidoFornecedor(pedido.itens);
    const itensExportar = [];
    fornecedorSelecao.forEach(selecionado => {
        const existente = encontrarItemPedidoFornecedor(itens, selecionado);
        const quantidade = Math.max(1, Math.floor(Number(selecionado.quantidade) || 1));
        itensExportar.push(criarItemFornecedorAPartirSelecao(selecionado, existente ? 'reforco' : 'substituicao'));
        if (existente) {
            existente.quantidade = Math.max(0, Number(existente.quantidade || 0)) + quantidade;
            existente.quantidade_original = Math.max(0, Number(existente.quantidade_original || existente.quantidade || 0)) + quantidade;
            existente.origem_ajuste = existente.origem_ajuste || 'reforco';
            const precoCusto = Math.max(0, Number(selecionado.preco_custo ?? selecionado.custo ?? 0) || 0);
            if (precoCusto > 0) {
                existente.preco_custo = precoCusto;
                existente.preco = precoCusto;
            }
        } else {
            itens.push(serializarItemPedidoFornecedor(criarItemFornecedorAPartirSelecao(selecionado, 'substituicao')));
        }
    });

    try {
        definirStatusFornecedor('A completar encomenda com a selecao...');
        const atualizado = await atualizarPedidoFornecedor(pedido.id, { itens: consolidarItensPedidoFornecedor(itens) });
        fornecedorSelecao = [];
        guardarSelecaoFornecedor();
        renderizarSelecionadosFornecedor();
        exportarTxtItensFornecedor(itensExportar, `${atualizado.codigo}-selecao`);
        definirStatusFornecedor(`Encomenda ${atualizado.codigo} completada com os novos produtos.`);
    } catch (error) {
        console.error(error);
        definirStatusFornecedor('Erro ao completar encomenda: ' + (error.message || 'erro desconhecido'), true);
    }
}

function formatarDataPedidoFornecedor(valor) {
    if (!valor) return "Data indisponivel";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return String(valor);
    return new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(data).replace(",", "");
}

function obterClasseBadgeEstadoPedidoFornecedor(estado) {
    const mapa = {
        a_preparar: "estado-fornecedor-a-preparar",
        encomendada: "estado-fornecedor-encomendada",
        recebida_parcialmente: "estado-fornecedor-recebida-parcialmente",
        recebida: "estado-fornecedor-recebida",
        cancelada: "estado-fornecedor-cancelada"
    };
    return mapa[normalizarEstadoPedidoFornecedor(estado)] || "estado-fornecedor-a-preparar";
}

function obterValorOrdenacaoItemPedidoFornecedor(item, coluna) {
    const produtoAtual = obterProdutoParaPedidoFornecedor(item) || item;
    if (coluna === "nome") return item?.nome || "";
    if (coluna === "ref") return item?.referencia || "";
    if (coluna === "estado") return Math.max(0, Number(item?.quantidade || 0));
    if (coluna === "receber") {
        const recebido = Math.max(0, Number(item?.recebido || 0));
        return Math.max(0, Number(item?.quantidade || 0) - recebido);
    }
    if (coluna === "stock") return Number(produtoAtual?.stock || 0);
    return item?.nome || "";
}

function compararItensPedidoFornecedorPorColuna(itemA, itemB, coluna, direcao = "asc") {
    const valorA = obterValorOrdenacaoItemPedidoFornecedor(itemA, coluna);
    const valorB = obterValorOrdenacaoItemPedidoFornecedor(itemB, coluna);
    let resultado;
    if (typeof valorA === "number" || typeof valorB === "number") {
        resultado = Number(valorA || 0) - Number(valorB || 0);
    } else {
        resultado = compararTextoFornecedor(valorA, valorB);
    }
    if (resultado === 0 && coluna !== "nome") {
        resultado = compararTextoFornecedor(itemA?.nome, itemB?.nome);
    }
    return direcao === "desc" ? -resultado : resultado;
}

function ordenarItensPedidoFornecedor(itens) {
    const { coluna, direcao } = fornecedorPedidoItensOrdenacao;
    return (itens || [])
        .slice()
        .sort((a, b) => compararItensPedidoFornecedorPorColuna(a, b, coluna, direcao));
}

function criarElementoPedidoFornecedor(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function renderizarPedidoFornecedorProdutosTabela(caixa, pedido) {
    const envoltorio = document.createElement("div");
    envoltorio.className = "mapas-tabela-wrapper fornecedor-tabela-wrapper-centro";

    const tabela = document.createElement("table");
    tabela.className = "mapas-produtos-tabela fornecedor-tabela-encomenda fornecedor-pedido-tabela";

    const thead = document.createElement("thead");
    const cabecalho = document.createElement("tr");
    [
        ["", "mapas-col-foto", ""],
        ["Nome", "mapas-col-nome", "nome"],
        ["Ref.", "mapas-col-ref", "ref"],
        ["Estado", "mapas-col-pedido-info", "estado"],
        ["Receber", "mapas-col-qtd", "receber"],
    ].forEach(([texto, classe, coluna]) => {
        const th = document.createElement("th");
        th.className = `${classe} mapas-th-ordenavel`;
        const botao = document.createElement("button");
        botao.type = "button";
        botao.textContent = texto;
        botao.tabIndex = -1;
        if (!coluna) {
            botao.disabled = true;
            botao.classList.add("mapas-th-sem-ordenacao");
        } else {
            const ativo = fornecedorPedidoItensOrdenacao.coluna === coluna;
            if (ativo) {
                botao.setAttribute("aria-sort", fornecedorPedidoItensOrdenacao.direcao === "asc" ? "ascending" : "descending");
                botao.textContent += fornecedorPedidoItensOrdenacao.direcao === "asc" ? " ▲" : " ▼";
            }
            botao.addEventListener("click", () => {
                const mesmaColuna = fornecedorPedidoItensOrdenacao.coluna === coluna;
                fornecedorPedidoItensOrdenacao = {
                    coluna,
                    direcao: mesmaColuna && fornecedorPedidoItensOrdenacao.direcao === "asc" ? "desc" : "asc"
                };
                renderizarPedidosFornecedores();
            });
        }
        th.appendChild(botao);
        cabecalho.appendChild(th);
    });
    thead.appendChild(cabecalho);
    tabela.appendChild(thead);

    const tbody = document.createElement("tbody");
    ordenarItensPedidoFornecedor(pedido.itens || []).forEach(item => {
        const produtoAtual = obterProdutoParaPedidoFornecedor(item) || item;
        const recebido = Number(item.recebido || 0);
        const restante = Math.max(0, Number(item.quantidade || 0) - recebido);
        const faltaOs = Math.max(0, Number(item.falta_os || 0));
        const linha = document.createElement("tr");
        if (faltaOs > 0) linha.classList.add("tem-os");

        const fotoCelula = document.createElement("td");
        fotoCelula.className = "mapas-col-foto";
        fotoCelula.appendChild(criarImagemFornecedor(produtoAtual, "fornecedor-miniatura pequena"));
        linha.appendChild(fotoCelula);

        const nomeCelula = document.createElement("td");
        nomeCelula.className = "mapas-col-nome";
        const nomeBotao = document.createElement("button");
        nomeBotao.type = "button";
        nomeBotao.className = "mapas-produto-nome-botao";
        nomeBotao.textContent = item.nome || "Produto sem nome";
        nomeBotao.title = "Editar produto";
        nomeBotao.tabIndex = -1;
        if (produtoAtual?.id) {
            nomeBotao.addEventListener("click", () => abrirEdicaoProdutoMapa(produtoAtual.id));
        } else {
            nomeBotao.disabled = true;
        }
        nomeCelula.appendChild(nomeBotao);
        linha.appendChild(nomeCelula);

        const refCelula = document.createElement("td");
        refCelula.className = "mapas-col-ref";
        refCelula.textContent = item.referencia || "-";
        linha.appendChild(refCelula);

        const infoCelula = document.createElement("td");
        infoCelula.className = "mapas-col-pedido-info";
        const infoPrincipal = document.createElement("span");
        infoPrincipal.className = "fornecedor-pedido-info-linha";
        infoPrincipal.textContent = `Pedido: ${Number(item.quantidade || 0)} | Recebido: ${recebido} | Stock atual: ${Number(produtoAtual.stock || 0)}`;
        infoCelula.appendChild(infoPrincipal);
        if (faltaOs > 0) {
            const osSpan = document.createElement("span");
            osSpan.className = "fornecedor-ajuste-os ativo";
            osSpan.textContent = `OS/Falta: ${faltaOs}${item.quantidade_original ? ` de ${Number(item.quantidade_original || 0)}` : ""}`;
            infoCelula.appendChild(osSpan);
        }
        if (item.origem_ajuste) {
            const origemSpan = document.createElement("span");
            origemSpan.className = "fornecedor-ajuste-os";
            origemSpan.textContent = obterTextoOrigemAjustePedidoFornecedor(item.origem_ajuste);
            infoCelula.appendChild(origemSpan);
        }
        linha.appendChild(infoCelula);

        const qtdCelula = document.createElement("td");
        qtdCelula.className = "mapas-col-qtd";
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.max = String(restante);
        input.step = "1";
        input.value = restante > 0 ? restante : 0;
        input.className = "mapa-quantidade-input fornecedor-recebido-input";
        input.dataset.pedido = pedido.id;
        input.dataset.produto = item.id;
        input.setAttribute("aria-label", `Quantidade a receber de ${item.nome || "produto"}`);
        qtdCelula.appendChild(input);
        linha.appendChild(qtdCelula);

        tbody.appendChild(linha);
    });

    tabela.appendChild(tbody);
    envoltorio.appendChild(tabela);
    caixa.appendChild(envoltorio);
}

function renderizarPedidosFornecedores() {
    const caixa = document.getElementById('fornecedor-pedidos');
    if (!caixa) return;
    // Pre-definição: começar por "Encomendada" (em vez de "A preparar")
    const filtro = document.getElementById('fornecedor-filtro-estado')?.value || 'encomendada';
    caixa.replaceChildren();
    const pedidos = fornecedorPedidos.filter(pedido => pedidoFornecedorPassaFiltroEstado(pedido, filtro));
    if (!pedidos.length) {
        const vazio = document.createElement('p');
        vazio.className = 'fornecedor-vazio';
        vazio.textContent = 'Ainda nao existem encomendas neste estado.';
        caixa.appendChild(vazio);
        atualizarBotaoJuntarSelecaoFornecedor();
        return;
    }

    pedidos.forEach(pedido => {
        const aberto = fornecedorPedidosAbertos.has(String(pedido.id));
        const alvoJuntar = String(pedido.id) === fornecedorPedidoAlvoJuntar && aberto;
        const totaisPedido = (pedido.itens || []).reduce((totais, item) => {
            const quantidade = Math.max(0, Number(item.quantidade || 0));
            const recebido = Math.max(0, Number(item.recebido || 0));
            const faltaOs = Math.max(0, Number(item.falta_os || 0));
            totais.itens += 1;
            totais.quantidade += quantidade;
            totais.os += faltaOs;
            totais.pendente += Math.max(0, quantidade - recebido);
            return totais;
        }, { itens: 0, quantidade: 0, os: 0, pendente: 0 });

        const card = criarElementoPedidoFornecedor("article", `admin-encomenda-card fornecedor-pedido-card${aberto ? " aberta" : ""}${alvoJuntar ? " fornecedor-pedido-alvo-juntar" : ""}`);
        const cabecalho = criarElementoPedidoFornecedor("div", "admin-encomenda-cabecalho fornecedor-pedido-cabecalho");
        cabecalho.tabIndex = 0;
        cabecalho.setAttribute("role", "button");
        cabecalho.setAttribute("aria-expanded", aberto ? "true" : "false");

        const alternarPedido = () => {
            const idPedido = String(pedido.id);
            if (fornecedorPedidosAbertos.has(idPedido)) {
                fornecedorPedidosAbertos.delete(idPedido);
            } else {
                fornecedorPedidosAbertos.add(idPedido);
                fornecedorPedidoAlvoJuntar = idPedido;
            }
            sincronizarPedidoAlvoJuntarSelecaoFornecedor();
            renderizarPedidosFornecedores();
        };
        cabecalho.addEventListener("click", alternarPedido);
        cabecalho.addEventListener("keydown", (evento) => {
            if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault();
                alternarPedido();
            }
        });

        const linha = criarElementoPedidoFornecedor("div", "admin-encomenda-linha fornecedor-pedido-linha-cabecalho");
        const resumo = `${totaisPedido.itens} artigo(s) | ${totaisPedido.quantidade} unidade(s) | ${totaisPedido.pendente} por receber${totaisPedido.os > 0 ? ` | ${totaisPedido.os} OS` : ""}`;
        linha.append(
            criarElementoPedidoFornecedor("strong", "admin-encomenda-codigo", obterTextoCodigoPedidoFornecedor(pedido)),
            criarElementoPedidoFornecedor("span", "admin-encomenda-data", formatarDataPedidoFornecedor(obterDataExibicaoPedidoFornecedor(pedido))),
            criarElementoPedidoFornecedor("span", "fornecedor-pedido-fornecedor-nome", pedido.fornecedor || "Fornecedor"),
            criarElementoPedidoFornecedor("span", "fornecedor-pedido-resumo", resumo),
            criarElementoPedidoFornecedor("span", `estado-encomenda ${obterClasseBadgeEstadoPedidoFornecedor(pedido.estado)}`, pedido.estado || "A preparar")
        );
        if (alvoJuntar) {
            linha.classList.add("com-destino-selecao");
            linha.appendChild(criarElementoPedidoFornecedor("span", "fornecedor-pedido-destino-selecao", "Destino seleção"));
        }
        cabecalho.append(linha, criarElementoPedidoFornecedor("span", "admin-encomenda-seta", "▾"));

        const detalhes = criarElementoPedidoFornecedor("div", "admin-encomenda-detalhes fornecedor-pedido-detalhes");
        detalhes.hidden = !aberto;

        const produtos = criarElementoPedidoFornecedor("div", "admin-encomenda-produtos fornecedor-pedido-produtos");
        if (estaPaginaFornecedoresUnificada()) {
            renderizarPedidoFornecedorProdutosTabela(produtos, pedido);
        } else {
            const lista = criarElementoPedidoFornecedor("div", "fornecedor-pedido-produtos-lista");
            pedido.itens.forEach(item => {
                const produtoAtual = obterProdutoParaPedidoFornecedor(item) || item;
                const recebido = Number(item.recebido || 0);
                const restante = Math.max(0, Number(item.quantidade || 0) - recebido);
                const faltaOs = Math.max(0, Number(item.falta_os || 0));
                const linhaProduto = criarElementoPedidoFornecedor("div", "fornecedor-pedido-linha");
                if (faltaOs > 0) linhaProduto.classList.add("tem-os");
                linhaProduto.appendChild(criarImagemFornecedor(produtoAtual, "fornecedor-miniatura pequena"));
                const info = criarElementoPedidoFornecedor("div", "fornecedor-info");
                info.innerHTML = `<strong>${escaparHtmlFornecedor(item.nome)}</strong><span class="fornecedor-identificadores">Ref. ${escaparHtmlFornecedor(item.referencia || "-")} | SKU ${escaparHtmlFornecedor(item.sku || "-")}</span><span>Pedido: ${Number(item.quantidade || 0)} | Recebido: ${recebido} | Stock atual: ${Number(produtoAtual.stock || 0)}</span>${faltaOs > 0 ? `<span class="fornecedor-ajuste-os ativo">OS/Falta: ${faltaOs}${item.quantidade_original ? ` de ${Number(item.quantidade_original || 0)}` : ""}</span>` : ""}${item.origem_ajuste ? `<span class="fornecedor-ajuste-os">${escaparHtmlFornecedor(obterTextoOrigemAjustePedidoFornecedor(item.origem_ajuste))}</span>` : ""}`;
                const input = document.createElement("input");
                input.type = "number";
                input.min = "0";
                input.max = String(restante);
                input.step = "1";
                input.value = restante > 0 ? restante : 0;
                input.className = "fornecedor-recebido-input";
                input.dataset.pedido = pedido.id;
                input.dataset.produto = item.id;
                linhaProduto.append(info, input);
                lista.appendChild(linhaProduto);
            });
            produtos.appendChild(lista);
        }

        const acoes = criarElementoPedidoFornecedor("div", "admin-encomenda-acoes fornecedor-pedido-acoes");
        const grupoEstado = criarElementoPedidoFornecedor("div", "admin-encomenda-estado-edicao");
        const estado = document.createElement("select");
        estado.className = "fornecedor-status-select";
        estado.setAttribute("aria-label", "Estado da encomenda");
        obterEstadosPedidoFornecedor().forEach(opcao => {
            const opt = document.createElement("option");
            opt.value = opcao;
            opt.textContent = opcao;
            opt.selected = pedido.estado === opcao;
            estado.appendChild(opt);
        });
        estado.addEventListener("change", () => alterarEstadoPedidoFornecedor(pedido.id, estado.value));
        grupoEstado.appendChild(estado);

        const botoes = criarElementoPedidoFornecedor("div", "admin-encomenda-botoes");
        const editar = criarElementoPedidoFornecedor("button", "wallapop-botao", "Editar encomenda");
        editar.type = "button";
        editar.addEventListener("click", () => abrirEdicaoPedidoFornecedor(pedido.id));
        const imprimir = criarElementoPedidoFornecedor("button", "wallapop-botao", "Imprimir");
        imprimir.type = "button";
        imprimir.addEventListener("click", () => imprimirPedidoFornecedor(pedido.id));
        const exportarTxt = criarElementoPedidoFornecedor("button", "wallapop-botao", "Exportar TXT");
        exportarTxt.type = "button";
        exportarTxt.addEventListener("click", () => {
            const texto = obterTextoExportacaoPedidoFornecedor(pedido);
            if (!texto) {
                definirStatusFornecedor("A encomenda nao tem produtos para exportar.", true);
                return;
            }
            exportarTxtPedidoFornecedor(pedido);
            definirStatusFornecedor(`TXT da encomenda ${pedido.codigo || pedido.id} exportado.`);
        });
        const receber = criarElementoPedidoFornecedor("button", "wallapop-botao wallapop-botao-destaque", "Receber stock");
        receber.type = "button";
        receber.addEventListener("click", () => receberPedidoFornecedor(pedido.id));
        const apagar = criarElementoPedidoFornecedor("button", "wallapop-botao admin-encomenda-apagar", "Apagar pedido");
        apagar.type = "button";
        apagar.addEventListener("click", () => apagarPedidoFornecedor(pedido.id));
        botoes.append(editar, imprimir, exportarTxt, receber, apagar);
        acoes.append(grupoEstado, botoes);

        detalhes.append(acoes, produtos);
        card.append(cabecalho, detalhes);
        caixa.appendChild(card);
    });
    atualizarBotaoJuntarSelecaoFornecedor();
}

async function iniciarFornecedoresAdmin() {
    const bloqueio = document.getElementById('fornecedores-bloqueio');
    try {
        await window.carregarScriptSupabase();
        if (typeof supabase === 'undefined') throw new Error('A biblioteca Supabase nao carregou.');
        fornecedoresClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data: { user }, error } = await fornecedoresClient.auth.getUser();
        if (error || !user || !ADMIN_EMAILS.includes(String(user.email || '').toLowerCase())) {
            bloqueio.textContent = 'Acesso reservado ao administrador. A regressar a conta...';
            setTimeout(() => window.location.replace('conta.html'), 1400);
            return;
        }
        mostrarNavegacaoAdminValidada();
        await carregarFichasFornecedoresRemotas();
        renderizarFornecedoresGuardados();
        preencherFormularioFichaFornecedor();
        await carregarCatalogoFornecedores();
        await carregarPedidosFornecedoresRemotos();
        bloqueio.hidden = true;
        document.getElementById('fornecedores-aplicacao').hidden = false;
        renderizarResultadosFornecedor();
        renderizarSelecionadosFornecedor();
        renderizarPedidosFornecedores();
        const prefetch = function () {
            garantirFornecedoresEdicaoPedido().catch(() => {});
            garantirFornecedoresProdutoModal().catch(() => {});
            garantirFornecedoresPrintReceive().catch(() => {});
        };
        if ('requestIdleCallback' in window) window.requestIdleCallback(prefetch, { timeout: 4000 });
        else window.setTimeout(prefetch, 1200);
    } catch (error) {
        console.error(error);
        bloqueio.textContent = 'Erro ao abrir fornecedores: ' + (error.message || 'sem detalhe disponivel');
    }
}

function ligarBloqueioScrollExternoListaFornecedor() {
    const caixa = document.getElementById("fornecedor-resultados");
    if (!caixa || caixa.dataset.scrollChainBlock === "1") return;

    caixa.dataset.scrollChainBlock = "1";
    caixa.addEventListener("wheel", (evento) => {
        if (!estaPaginaFornecedoresUnificada()) return;

        const delta = evento.deltaY;
        if (delta === 0) return;

        const { scrollTop, scrollHeight, clientHeight } = caixa;
        const noTopo = scrollTop <= 0;
        const noFundo = Math.ceil(scrollTop + clientHeight) >= scrollHeight;

        if ((delta < 0 && noTopo) || (delta > 0 && noFundo)) {
            evento.preventDefault();
        }
    }, { passive: false });
}

function ligarEventoFornecedor(id, evento, handler) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.addEventListener(evento, handler);
    }
}

ligarBloqueioScrollExternoListaFornecedor();
ligarEventoFornecedor('fornecedor-pesquisa', 'input', agendarRenderizacaoResultadosFornecedor);
ligarEventoFornecedor('fornecedor-nome', 'change', agendarRenderizacaoResultadosFornecedor);
ligarEventoFornecedor('fornecedor-ordenacao-stock', 'change', agendarRenderizacaoResultadosFornecedor);
ligarEventoFornecedor('fornecedor-filtro-marcacao-fornecedor', 'change', agendarRenderizacaoResultadosFornecedor);
ligarEventoFornecedor('fornecedor-filtro-marcacao', 'change', agendarRenderizacaoResultadosFornecedor);
ligarEventoFornecedor('fornecedor-filtro-top', 'change', agendarRenderizacaoResultadosFornecedor);
ligarEventoFornecedor('fornecedor-filtro-arquivado', 'change', agendarRenderizacaoResultadosFornecedor);
ligarEventoFornecedor('fornecedor-filtro-descontinuado', 'change', agendarRenderizacaoResultadosFornecedor);
ligarEventoFornecedor('btn-fornecedor-ajustar-vista', 'click', ajustarVistaEncomendaFornecedor);
ligarEventoFornecedor('btn-limpar-fornecedor', 'click', limparSelecaoFornecedor);
ligarEventoFornecedor('btn-juntar-selecao-fornecedor', 'click', juntarSelecaoAEncomendaExistenteFornecedor);
ligarEventoFornecedor('btn-criar-fornecedor', 'click', criarPedidoFornecedor);
ligarEventoFornecedor('fornecedor-filtro-estado', 'change', renderizarPedidosFornecedores);
ligarEventoFornecedor('btn-editar-fornecedor-selecionado', 'click', editarFornecedorSelecionado);
ligarEventoFornecedor('fornecedor-ficha-modal-fechar', 'click', fecharModalFichaFornecedor);
ligarFechoModalPorFundo(document.getElementById('fornecedor-ficha-modal'), fecharModalFichaFornecedor);
ligarEventoFornecedor('fornecedor-ficha-lista', 'change', () => {
    preencherFormularioFichaFornecedor(obterFichaFornecedorPorId(document.getElementById('fornecedor-ficha-lista')?.value));
});
ligarEventoFornecedor('fornecedor-ficha-novo', 'click', novaFichaFornecedor);
ligarEventoFornecedor('fornecedor-ficha-apagar', 'click', apagarFichaFornecedor);
ligarEventoFornecedor('fornecedor-ficha-form', 'submit', guardarFichaFornecedor);

const botaoFecharImagemFornecedor = document.getElementById('admin-imagem-modal-fechar');
botaoFecharImagemFornecedor?.addEventListener('click', fecharImagemFornecedorModal);
ligarFechoModalPorFundo(document.getElementById('admin-imagem-modal'), fecharImagemFornecedorModal);
document.addEventListener('keydown', (evento) => {
    const modal = document.getElementById('admin-imagem-modal');
    if (evento.key === 'Escape' && modal && !modal.hidden) {
        fecharImagemFornecedorModal();
    }
    const modalProduto = document.getElementById('mapas-produto-modal');
    if (evento.key === 'Escape' && modalProduto && !modalProduto.hidden) {
        fecharEdicaoProdutoMapa();
    }
    const modalFornecedor = document.getElementById('fornecedor-edicao-modal');
    if (evento.key === 'Escape' && modalFornecedor && !modalFornecedor.hidden) {
        fecharEdicaoPedidoFornecedor();
    }
    const modalFicha = document.getElementById('fornecedor-ficha-modal');
    if (evento.key === 'Escape' && modalFicha && !modalFicha.hidden) {
        fecharModalFichaFornecedor();
    }
});

ligarEventoFornecedor('btn-atualizar-catalogo-fornecedor', 'click', async () => {
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
