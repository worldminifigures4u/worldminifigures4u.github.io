
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

let fornecedoresClient = null;
let fornecedorProdutos = [];
let fornecedorSelecao = carregarSelecaoFornecedor();
let fornecedorPedidos = carregarPedidosFornecedores();
let fornecedorFichas = carregarFichasFornecedores();
let fornecedorMapaOrdenacao = { coluna: "stock", direcao: "asc" };
let fornecedorResumoEncomenda = { totalFiltrados: 0, apresentados: 0, limite: 250 };
let fornecedorRenderizacaoPendente = null;
const FORNECEDOR_LISTA_MAX_CARACTERES = 30000;
const FORNECEDOR_LISTA_MAX_LINHAS = 500;
let fornecedorPedidosAbertos = new Set();

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
        itens: Array.isArray(pedido.itens) ? pedido.itens.map(normalizarItemPedidoFornecedor).filter(Boolean) : []
    };
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
        preco_custo: Number.isFinite(precoCusto) ? Math.max(0, precoCusto) : 0,
        estado_fornecedor: item.estado_fornecedor || (faltaOs > 0 ? 'OS' : ''),
        origem_ajuste: item.origem_ajuste || ''
    };
}

function obterEstadosPedidoFornecedor() {
    return ['A preparar', 'Encomendada', 'Recebida parcialmente', 'Recebida', 'Cancelada'];
}

function normalizarEstadoPedidoFornecedor(estado) {
    return normalizarChaveFornecedor(estado || '').replace(/-/g, '_');
}

function pedidoFornecedorPassaFiltroEstado(pedido, filtro) {
    const filtroNormalizado = normalizarEstadoPedidoFornecedor(filtro || 'todos');
    if (!filtroNormalizado || filtroNormalizado === 'todos') return true;
    return normalizarEstadoPedidoFornecedor(pedido.estado) === filtroNormalizado;
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

function limparCampoExportacaoFornecedor(valor) {
    return String(valor ?? '').replace(/[\t\r\n]+/g, ' ').trim();
}

function criarNomeFicheiroExportacaoFornecedor(pedido) {
    const codigo = limparCampoExportacaoFornecedor(pedido?.codigo || 'encomenda').replace(/[^a-z0-9_-]+/gi, '-');
    const data = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    return `${codigo || 'encomenda'}-${data}.txt`;
}

function obterTextoExportacaoPedidoFornecedor(pedido) {
    return (pedido?.itens || [])
        .map(item => {
            const referencia = limparCampoExportacaoFornecedor(item.referencia);
            const quantidade = Math.max(0, Math.floor(Number(item.quantidade || 0)));
            return `${referencia}\t${quantidade}`;
        })
        .filter(Boolean)
        .join('\r\n');
}

function exportarTxtTextoFornecedor(texto, nomeBase = 'encomenda') {
    if (!texto) return;
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = criarNomeFicheiroExportacaoFornecedor({ codigo: nomeBase });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportarTxtPedidoFornecedor(pedido) {
    exportarTxtTextoFornecedor(obterTextoExportacaoPedidoFornecedor(pedido), pedido?.codigo || 'encomenda');
}

function exportarTxtItensFornecedor(itens, nomeBase = 'encomenda') {
    exportarTxtTextoFornecedor(obterTextoExportacaoPedidoFornecedor({ itens }), nomeBase);
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

async function imprimirPedidoFornecedor(id) {
    const pedido = fornecedorPedidos.find(item => String(item.id) === String(id));
    if (!pedido) return;

    const janela = window.open('', '_blank', 'width=900,height=700');
    if (!janela) {
        definirStatusFornecedor('O navegador bloqueou a janela de impressao. Autorize pop-ups para imprimir.', true);
        return;
    }
    try { janela.opener = null; } catch (_) {}
    janela.document.open();
    janela.document.write('<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><title>A preparar impressao</title></head><body>A preparar impressão...</body></html>');
    janela.document.close();

    let produtosCompletos = [];
    try {
        produtosCompletos = await carregarProdutosCompletosPedidoFornecedor(pedido);
    } catch (error) {
        console.warn('Nao foi possivel carregar produtos completos para impressao.', error);
    }

    const produtosImpressao = produtosCompletos.length ? produtosCompletos : fornecedorProdutos;
    const linhas = (pedido.itens || []).map(item => {
        const produtoAtual = obterProdutoParaPedidoFornecedor(item, produtosImpressao) || item;
        const subtemaProduto = produtoAtual.subtema && produtoAtual.subtema !== 'semsubtema' ? produtoAtual.subtema : '';
        const subtemaItem = item.subtema && item.subtema !== 'semsubtema' ? item.subtema : '';
        const novidade = obterBooleanoProdutoFornecedor(produtoAtual.novidade ?? item.novidade);
        return `
            <tr>
                <td>${escaparHtmlFornecedor(produtoAtual.nome || item.nome || '')}</td>
                <td>${escaparHtmlFornecedor(produtoAtual.tema || item.tema || '')}</td>
                <td>${escaparHtmlFornecedor(subtemaProduto || subtemaItem || '')}</td>
                <td>${escaparHtmlFornecedor(produtoAtual.referencia || item.referencia || '')}</td>
                <td class="quantidade">${escaparHtmlFornecedor(item.quantidade || 0)}</td>
                <td class="novidade">${novidade ? 'NOVA' : ''}</td>
            </tr>`;
    }).join('');

    janela.document.open();
    janela.document.write(`<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <title>${escaparHtmlFornecedor(pedido.codigo || 'Encomenda')}</title>
    <style>
        @page { size: A4; margin: 14mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
        h1 { margin: 0 0 14px; font-size: 22px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #444; padding: 7px 8px; text-align: left; vertical-align: top; }
        th { background: #f2c200; color: #000; font-weight: 700; }
        td.quantidade, th.quantidade { width: 90px; text-align: center; }
        td.novidade, th.novidade { width: 70px; text-align: center; font-weight: 700; }
    </style>
</head>
<body>
    <h1>${escaparHtmlFornecedor(pedido.codigo || 'Encomenda')}</h1>
    <table>
        <thead>
            <tr>
                <th>Nome da figura</th>
                <th>Tema</th>
                <th>Subtema</th>
                <th>Referência</th>
                <th class="quantidade">Quantidade encomendada</th>
                <th class="novidade">Nota</th>
            </tr>
        </thead>
        <tbody>
            ${linhas || '<tr><td colspan="6">Sem produtos.</td></tr>'}
        </tbody>
    </table>
</body>
</html>`);
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 250);
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

function classificarValorFornecedor(valor) {
    const texto = String(valor ?? "").trim();
    const maiusculas = texto.toUpperCase();
    if (!texto) return { tipo: "disponivel", texto: "Disponivel" };
    if (maiusculas === "OS") return { tipo: "os", texto: "OS" };
    if (maiusculas === "EX") return { tipo: "ex", texto: "EX" };
    if (/^-?\d+(?:[,.]\d+)?$/.test(texto)) return { tipo: "encomendado", texto: `Marcado no mapa: ${texto}` };
    return { tipo: "info", texto };
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

function analisarLinhaListaFinalFornecedor(linha, numeroLinha) {
    const partes = dividirLinhaListaFinalFornecedor(linha).map(parte => String(parte || "").trim()).filter(Boolean);
    if (!partes.length) return null;
    if (partes.length < 2) {
        return { erro: `linha ${numeroLinha}: falta quantidade`, original: linha };
    }

    const referencia = partes[0];
    const quantidade = Math.floor(converterNumeroListaFornecedor(partes[1]));
    if (!referencia || quantidade <= 0) {
        return { erro: `linha ${numeroLinha}: referência ou quantidade inválida`, original: linha };
    }

    const precoTexto = partes.slice(2).join(" ");
    const precoCusto = Math.max(0, converterNumeroListaFornecedor(precoTexto));
    return { referencia, quantidade, preco_custo: precoCusto, original: linha };
}

function processarLinhasListaFinalFornecedor(texto) {
    const linhas = String(texto || "").split(/\r?\n/);
    const itens = [];
    const erros = [];
    const foraCatalogo = [];

    linhas.forEach((linha, indice) => {
        const analisada = analisarLinhaListaFinalFornecedor(linha, indice + 1);
        if (!analisada) return;
        if (analisada.erro) {
            erros.push(analisada.erro);
            return;
        }

        const produto = encontrarProdutoListaFinalFornecedor(analisada.referencia);
        if (!produto) foraCatalogo.push(analisada.referencia);
        const item = criarItemFornecedorAPartirListaFinal(analisada, produto);
        if (produto) {
            item.referencia = analisada.referencia;
            item.nome = produto.nome || item.nome;
            item.sku = produto.sku || item.sku || "";
            item.tema = produto.tema || item.tema || "";
            item.subtema = produto.subtema || item.subtema || "";
            item.imagens = produto.imagens || item.imagens || [];
        }
        itens.push(item);
    });

    const unidades = itens.reduce((total, item) => total + Math.max(0, Number(item.quantidade || 0)), 0);
    return { itens, erros, foraCatalogo, unidades };
}

function aplicarListaFinalFornecedor() {
    const area = document.getElementById("fornecedor-lista-final");
    if (!area) return;
    const textoLista = String(area.value || "");
    if (textoLista.length > FORNECEDOR_LISTA_MAX_CARACTERES) {
        definirStatusFornecedor(`A lista é demasiado grande. Limite: ${FORNECEDOR_LISTA_MAX_CARACTERES.toLocaleString('pt-PT')} caracteres.`, true);
        return;
    }
    if (textoLista.split(/\r?\n/).filter(linha => linha.trim()).length > FORNECEDOR_LISTA_MAX_LINHAS) {
        definirStatusFornecedor(`A lista tem demasiadas linhas. Limite: ${FORNECEDOR_LISTA_MAX_LINHAS} referências por colagem.`, true);
        return;
    }

    const { itens: importados, erros, foraCatalogo, unidades } = processarLinhasListaFinalFornecedor(textoLista);
    if (!importados.length) {
        const detalhe = erros.length ? ` ${erros.join("; ")}` : "";
        definirStatusFornecedor(`Não foi possível importar produtos da lista.${detalhe}`, true);
        return;
    }

    if (fornecedorSelecao.length && !window.confirm("Substituir a lista atual pela lista final enviada pelo fornecedor?")) {
        return;
    }

    fornecedorSelecao = importados;
    guardarSelecaoFornecedor();
    renderizarResultadosFornecedor();
    renderizarSelecionadosFornecedor();

    const avisos = [];
    if (foraCatalogo.length) avisos.push(`${foraCatalogo.length} referência(s) fora do catálogo incluída(s): ${foraCatalogo.join(", ")}`);
    if (erros.length) avisos.push(erros.join("; "));
    definirStatusFornecedor(`${importados.length} linha(s), ${unidades} unidade(s) aplicadas à encomenda.${avisos.length ? " " + avisos.join(" | ") : ""}`, Boolean(avisos.length));
}

function limparTextoListaFinalFornecedor() {
    const area = document.getElementById("fornecedor-lista-final");
    if (area) area.value = "";
    definirStatusFornecedor("Texto da lista final limpo.");
}

function obterPedidoEdicaoFornecedor(modal) {
    const id = modal?.querySelector("#fornecedor-edicao-id")?.value;
    return fornecedorPedidos.find(item => String(item.id) === String(id)) || null;
}

function montarLinhaEdicaoProdutoFornecedor(pedido, item, indice) {
    const produtoAtual = obterProdutoParaPedidoFornecedor(item) || item;
    const quantidadeOriginal = Math.max(0, Number(item.quantidade_original ?? item.quantidade ?? 0));
    const quantidadeAtual = Math.max(0, Number(item.quantidade || 0));
    const faltaAtual = Math.max(0, Number(item.falta_os || Math.max(0, quantidadeOriginal - quantidadeAtual)));
    const precoCustoAtual = Number(item.preco_custo ?? item.custo ?? item.preco ?? 0) || 0;
    const linha = document.createElement("div");
    linha.className = "fornecedor-edicao-produto";
    if (faltaAtual > 0) linha.classList.add("tem-os");
    linha.dataset.indice = String(indice);
    linha.dataset.referencia = item.referencia || produtoAtual.referencia || "";
    linha.dataset.sku = item.sku || produtoAtual.sku || "";
    linha.dataset.quantidadeOriginal = String(quantidadeOriginal);
    linha.appendChild(criarImagemFornecedor(produtoAtual, "fornecedor-miniatura pequena"));

    const info = document.createElement("div");
    info.className = "fornecedor-info";
    const nome = document.createElement("strong");
    nome.textContent = item.nome || produtoAtual.nome || "Produto";
    const ids = document.createElement("span");
    ids.className = "fornecedor-identificadores";
    ids.textContent = `Ref. ${item.referencia || produtoAtual.referencia || "-"} | SKU ${item.sku || produtoAtual.sku || "-"}`;
    const ajuste = document.createElement("span");
    ajuste.className = faltaAtual > 0 ? "fornecedor-ajuste-os ativo" : "fornecedor-ajuste-os";
    ajuste.textContent = faltaAtual > 0
        ? `Inicial: ${quantidadeOriginal} | OS: ${faltaAtual}`
        : `Inicial: ${quantidadeOriginal}`;
    if (item.origem_ajuste) {
        ajuste.textContent += item.origem_ajuste === "substituicao" ? " | Substituto" : " | Reforco";
    }
    info.append(nome, ids, ajuste);

    const campos = document.createElement("div");
    campos.className = "fornecedor-edicao-produto-campos";
    const quantidade = document.createElement("label");
    quantidade.textContent = "A receber";
    const quantidadeInput = document.createElement("input");
    quantidadeInput.type = "number";
    quantidadeInput.min = "0";
    quantidadeInput.step = "1";
    quantidadeInput.value = quantidadeAtual;
    quantidadeInput.dataset.campo = "quantidade";
    quantidade.appendChild(quantidadeInput);

    const falta = document.createElement("label");
    falta.textContent = "OS/Falta";
    const faltaInput = document.createElement("input");
    faltaInput.type = "number";
    faltaInput.min = "0";
    faltaInput.step = "1";
    faltaInput.value = faltaAtual;
    faltaInput.dataset.campo = "falta_os";
    falta.appendChild(faltaInput);

    const precoCusto = document.createElement("label");
    precoCusto.textContent = "preço compra";
    const precoCustoInput = document.createElement("input");
    precoCustoInput.type = "number";
    precoCustoInput.min = "0";
    precoCustoInput.step = "0.01";
    precoCustoInput.value = precoCustoAtual.toFixed(2);
    precoCustoInput.dataset.campo = "preco_custo";
    precoCusto.appendChild(precoCustoInput);

    const recebido = document.createElement("div");
    recebido.className = "fornecedor-edicao-recebido-info";
    const recebidoAtual = ["A preparar", "Encomendada"].includes(pedido.estado)
        ? 0
        : Math.max(0, Number(item.recebido || 0));
    recebido.dataset.campo = "recebido";
    recebido.dataset.valor = String(recebidoAtual);
    const recebidoTitulo = document.createElement("strong");
    recebidoTitulo.textContent = "Recebido";
    const recebidoValor = document.createElement("span");
    recebidoValor.textContent = String(recebidoAtual);
    recebido.append(recebidoTitulo, recebidoValor);

    const remover = document.createElement("label");
    remover.className = "fornecedor-edicao-remover";
    const removerInput = document.createElement("input");
    removerInput.type = "checkbox";
    removerInput.dataset.campo = "remover";
    remover.append(removerInput, document.createTextNode(" Remover"));

    const sincronizarFalta = () => {
        const pedidoValor = Math.max(0, Math.floor(Number(quantidadeInput.value) || 0));
        const faltaValor = Math.max(0, quantidadeOriginal - pedidoValor);
        if (faltaValor > 0 && Number(faltaInput.value || 0) === 0) {
            faltaInput.value = String(faltaValor);
        }
    };
    const sincronizarQuantidade = () => {
        const faltaValor = Math.max(0, Math.floor(Number(faltaInput.value) || 0));
        if (faltaValor > 0) {
            quantidadeInput.value = String(Math.max(0, quantidadeOriginal - faltaValor));
        }
    };
    quantidadeInput.addEventListener("change", sincronizarFalta);
    quantidadeInput.addEventListener("blur", sincronizarFalta);
    faltaInput.addEventListener("change", sincronizarQuantidade);
    faltaInput.addEventListener("blur", sincronizarQuantidade);

    campos.append(quantidade, falta, precoCusto, recebido, remover);
    linha.append(info, campos);
    return linha;
}

function linhaEdicaoContemReferenciaFornecedor(linha, referencia) {
    if (!referencia) return false;
    return correspondeReferenciaListaFornecedor(linha.dataset.referencia, referencia)
        || correspondeReferenciaListaFornecedor(linha.dataset.sku, referencia);
}

function aplicarListaFinalNaEdicaoFornecedor() {
    const modal = document.getElementById("fornecedor-edicao-modal");
    if (!modal || modal.hidden) return;
    const area = modal.querySelector("#fornecedor-edicao-lista-final");
    const status = modal.querySelector("#fornecedor-edicao-status");
    const texto = String(area?.value || "");
    if (texto.length > FORNECEDOR_LISTA_MAX_CARACTERES) {
        if (status) {
            status.textContent = `A lista é demasiado grande. Limite: ${FORNECEDOR_LISTA_MAX_CARACTERES.toLocaleString('pt-PT')} caracteres.`;
            status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
            status.classList.add('status-erro');
        }
        return;
    }
    if (texto.split(/\r?\n/).filter(linha => linha.trim()).length > FORNECEDOR_LISTA_MAX_LINHAS) {
        if (status) {
            status.textContent = `A lista tem demasiadas linhas. Limite: ${FORNECEDOR_LISTA_MAX_LINHAS} referências por colagem.`;
            status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
            status.classList.add('status-erro');
        }
        return;
    }

    const pedido = obterPedidoEdicaoFornecedor(modal);
    if (!pedido) return;

    const { itens, erros, foraCatalogo, unidades } = processarLinhasListaFinalFornecedor(texto);
    if (!itens.length) {
        if (status) {
            status.textContent = erros.length ? erros.join("; ") : "Cole a lista final do fornecedor antes de aplicar.";
            status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
            status.classList.add('status-erro');
        }
        return;
    }

    pedido.itens = itens;
    const lista = modal.querySelector("#fornecedor-edicao-produtos");
    if (lista) {
        lista.replaceChildren();
        itens.forEach((item, indice) => {
            lista.appendChild(montarLinhaEdicaoProdutoFornecedor(pedido, item, indice));
        });
    }

    if (status) {
        const avisos = [];
        if (foraCatalogo.length) avisos.push(`${foraCatalogo.length} referência(s) fora do catálogo incluída(s): ${foraCatalogo.join(", ")}`);
        if (erros.length) avisos.push(erros.join("; "));
        status.textContent = `Lista aplicada: ${itens.length} linha(s), ${unidades} unidade(s).${avisos.length ? " " + avisos.join(" | ") : ""}`;
        status.classList.remove("status-erro", "status-sucesso", "status-aviso", "status-neutro");
        status.classList.add(avisos.length ? "status-aviso" : "status-sucesso");
    }
}

function limparListaFinalEdicaoFornecedor() {
    const modal = document.getElementById("fornecedor-edicao-modal");
    const area = modal?.querySelector("#fornecedor-edicao-lista-final");
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

function garantirModalEdicaoProdutoMapa() {
    let modal = document.getElementById("mapas-produto-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "mapas-produto-modal";
    modal.className = "mapas-produto-modal";
    modal.hidden = true;
    modal.innerHTML = `
        <div class="mapas-produto-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="mapas-produto-modal-titulo">
            <div class="mapas-produto-modal-topo">
                <h3 id="mapas-produto-modal-titulo">Editar produto</h3>
                <button type="button" class="mapas-produto-modal-fechar" aria-label="Fechar">x</button>
            </div>
            <form id="mapas-produto-form" class="mapas-produto-form">
                <input type="hidden" id="mapas-editar-id">
                <input type="hidden" id="mapas-editar-sku-original">
                <div class="mapas-produto-form-grid" id="mapas-produto-form-campos"></div>
                <p class="fornecedores-status mapas-produto-status" id="mapas-produto-status" role="status"></p>
                <div class="fornecedores-acoes">
                    <button type="button" id="mapas-produto-cancelar">Cancelar</button>
                    <button type="submit" id="mapas-produto-guardar">Guardar produto</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector(".mapas-produto-modal-fechar")?.addEventListener("click", fecharEdicaoProdutoMapa);
    modal.querySelector("#mapas-produto-cancelar")?.addEventListener("click", fecharEdicaoProdutoMapa);
    modal.addEventListener("click", (evento) => {
        if (evento.target === modal) fecharEdicaoProdutoMapa();
    });
    modal.querySelector("#mapas-produto-form")?.addEventListener("submit", guardarEdicaoProdutoMapa);
    return modal;
}

function abrirEdicaoProdutoMapa(produtoId) {
    const produto = obterProdutoAtual(produtoId);
    if (!produto) return;

    const modal = garantirModalEdicaoProdutoMapa();
    const campos = modal.querySelector("#mapas-produto-form-campos");
    const status = modal.querySelector("#mapas-produto-status");
    campos.replaceChildren();
    if (status) status.textContent = "";

    modal.querySelector("#mapas-editar-id").value = String(produto.id || "");
    modal.querySelector("#mapas-editar-sku-original").value = String(produto.sku || "");

    const secaoIdentificacao = criarSecaoEdicaoMapa("Identificacao", "mapas-produto-secao-identificacao");
    criarInputEdicaoMapa(secaoIdentificacao, "mapas-editar-nome", "Nome", produto.nome || "", "text", { required: true, largo: true });
    criarInputEdicaoMapa(secaoIdentificacao, "mapas-editar-referencia", "Ref.", produto.referencia || "");
    criarInputEdicaoMapa(secaoIdentificacao, "mapas-editar-sku", "SKU", produto.sku || "", "text", { required: true });
    criarSelectEdicaoMapa(secaoIdentificacao, "mapas-editar-lego", "Lego", normalizarFornecedor(obterLegoProdutoFornecedor(produto)) === "nao" ? "não" : (normalizarFornecedor(obterLegoProdutoFornecedor(produto)) === "sim" ? "sim" : ""), [
        { valor: "", texto: "por verificar" },
        { valor: "sim", texto: "sim" },
        { valor: "não", texto: "não" }
    ]);
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-top", "Top", Boolean(String(obterTopProdutoFornecedor(produto) || "").trim()));
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-arquivado", "Arquivado", obterBooleanoProdutoFornecedor(produto.arquivado));
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-descontinuado", "Descontinuado", obterBooleanoProdutoFornecedor(produto.descontinuado));
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-novidade", "Novidade", obterBooleanoProdutoFornecedor(produto.novidade));
    campos.appendChild(secaoIdentificacao);

    const secaoDetalhes = criarSecaoEdicaoMapa("Detalhes", "mapas-produto-secao-detalhes");
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-preco", "preço venda", Number(produto.preco || 0).toFixed(2), "number", { required: true, min: 0, step: "0.01" });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-preco-compra", "preço compra", Number(produto.preco_compra ?? produto.preco_custo ?? produto.custo ?? 0).toFixed(2), "number", { min: 0, step: "0.01" });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-peso", "Peso (g)", Number(produto.peso || 10), "number", { required: true, min: 1, step: 1 });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-stock", "Stock", Number(produto.stock || 0), "number", { required: true, min: 0, step: 1 });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-tema", "Tema", produto.tema || "", "text", { required: true });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-subtema", "Subtema", produto.subtema === "semsubtema" ? "" : (produto.subtema || ""));
    criarCheckboxEdicaoMapa(secaoDetalhes, "mapas-editar-ativo", "Produto ativo", produto.ativo !== false);
    campos.appendChild(secaoDetalhes);

    const secaoMedia = criarSecaoEdicaoMapa("Imagem e notas", "mapas-produto-secao-media");
    criarInputEdicaoMapa(secaoMedia, "mapas-editar-imagens", "URLs das imagens", imagensProdutoParaTextoFornecedor(produto), "text", { multilinha: true, rows: 4, largo: true });
    criarInputEdicaoMapa(secaoMedia, "mapas-editar-observacoes", "Observacoes", produto.observacoes || "", "text", { multilinha: true, rows: 3, largo: true });
    campos.appendChild(secaoMedia);

    const blocoFornecedores = criarSecaoEdicaoMapa("Fornecedores", "mapas-produto-fornecedores");
    obterCamposProdutoFornecedor().forEach(({ chave, rotulo }) => {
        criarInputEdicaoMapa(blocoFornecedores, `mapas-editar-fornecedor-${chave}`, rotulo, obterFornecedorPorChaveProduto(produto, chave));
    });
    campos.appendChild(blocoFornecedores);

    modal.hidden = false;
    document.body.classList.add("mapas-produto-modal-aberto");
    modal.querySelector("#mapas-editar-nome")?.focus();
}

function fecharEdicaoProdutoMapa() {
    const modal = document.getElementById("mapas-produto-modal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("mapas-produto-modal-aberto");
}

function lerProdutoEditadoMapa() {
    const fornecedores = {};
    obterCamposProdutoFornecedor().forEach(({ chave }) => {
        const valor = document.getElementById(`mapas-editar-fornecedor-${chave}`)?.value.trim() || "";
        if (valor) fornecedores[chave] = valor;
    });

    const produto = {
        nome: document.getElementById("mapas-editar-nome").value.trim(),
        referencia: document.getElementById("mapas-editar-referencia").value.trim(),
        sku: normalizarSkuFornecedor(document.getElementById("mapas-editar-sku").value),
        lego: document.getElementById("mapas-editar-lego").value,
        top: document.getElementById("mapas-editar-top").checked ? "sim" : "",
        arquivado: document.getElementById("mapas-editar-arquivado").checked,
        descontinuado: document.getElementById("mapas-editar-descontinuado").checked,
        novidade: document.getElementById("mapas-editar-novidade").checked,
        preco: Number(document.getElementById("mapas-editar-preco").value),
        preco_compra: Number(document.getElementById("mapas-editar-preco-compra").value || 0),
        peso: Number(document.getElementById("mapas-editar-peso").value || 10),
        stock: Math.max(0, Math.floor(Number(document.getElementById("mapas-editar-stock").value || 0))),
        tema: document.getElementById("mapas-editar-tema").value.trim(),
        subtema: document.getElementById("mapas-editar-subtema").value.trim() || "semsubtema",
        imagens: textoParaImagensProdutoFornecedor(document.getElementById("mapas-editar-imagens").value),
        observacoes: document.getElementById("mapas-editar-observacoes").value.trim(),
        fornecedores,
        ativo: document.getElementById("mapas-editar-ativo").checked
    };

    if (!produto.nome || !produto.sku || !produto.tema || !Number.isFinite(produto.preco) || produto.preco < 0 || !Number.isFinite(produto.preco_compra) || produto.preco_compra < 0 || !Number.isFinite(produto.peso) || produto.peso < 1) {
        throw new Error("Preencha nome, SKU, tema, preço venda, preço compra e peso corretamente.");
    }

    return {
        id: document.getElementById("mapas-editar-id").value,
        skuOriginal: document.getElementById("mapas-editar-sku-original").value,
        produto
    };
}

async function guardarEdicaoProdutoMapa(evento) {
    evento.preventDefault();
    const status = document.getElementById("mapas-produto-status");
    const botao = document.getElementById("mapas-produto-guardar");

    try {
        if (status) {
            status.textContent = "A guardar produto...";
            status.classList.remove('status-erro', 'status-sucesso', 'status-aviso');
            status.classList.add('status-neutro');
        }
        if (botao) botao.disabled = true;

        const { id, skuOriginal, produto } = lerProdutoEditadoMapa();
        const skuDuplicado = fornecedorProdutos.some(item =>
            String(item.sku || "").trim().toUpperCase() !== String(skuOriginal || "").trim().toUpperCase()
            && String(item.sku || "").trim().toUpperCase() === produto.sku
        );
        if (skuDuplicado) throw new Error("Este SKU ja existe noutro produto.");

        const { data, error } = await fornecedoresClient.rpc("editar_produto_admin_v2", {
            p_id: id,
            p_sku_original: skuOriginal,
            p_produto: produto
        });
        if (error) throw error;
        if (!data?.id) throw new Error("Produto nao encontrado no Supabase.");

        const atualizado = {
            ...data,
            stock: Number.isFinite(Number(data.stock)) ? Number(data.stock) : 0,
            preco: Number.isFinite(Number(data.preco)) ? Number(data.preco) : 0,
            preco_compra: Number.isFinite(Number(data.preco_compra)) ? Number(data.preco_compra) : 0
        };
        fornecedorProdutos = fornecedorProdutos.map(item =>
            String(item.id) === String(atualizado.id) || String(item.sku || "").toUpperCase() === String(skuOriginal || "").toUpperCase()
                ? atualizado
                : item
        );
        fornecedorSelecao = fornecedorSelecao.map(item => String(item.id) === String(atualizado.id) ? { ...atualizado, quantidade: item.quantidade } : item);
        guardarSelecaoFornecedor();
        renderizarResultadosFornecedor();
        renderizarSelecionadosFornecedor();
        fecharEdicaoProdutoMapa();
        definirStatusFornecedor("Produto guardado.");
    } catch (error) {
        console.error(error);
        if (status) {
            status.textContent = "Erro: " + (error.message || "Nao foi possivel guardar o produto.");
            status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
            status.classList.add('status-erro');
        }
    } finally {
        if (botao) botao.disabled = false;
    }
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
        alvo.appendChild(texto);
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
        novidade: obterBooleanoProdutoFornecedor(item.novidade),
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
        fornecedorSelecao = [];
        guardarSelecaoFornecedor();
        renderizarResultadosFornecedor();
        renderizarSelecionadosFornecedor();
        renderizarPedidosFornecedores();
        exportarTxtPedidoFornecedor(pedido);
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
    if (!window.confirm(`Apagar a encomenda ${pedido.codigo}? Isto nao altera o stock.`)) return;
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
    const { data, error } = await fornecedoresClient
        .from('encomendas_fornecedores')
        .update(alteracoes)
        .eq('id', idPedido)
        .select()
        .single();
    if (error) throw error;
    const atualizado = normalizarPedidoFornecedor(data);
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
        novidade: obterBooleanoProdutoFornecedor(item.novidade),
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
    fornecedores[chaveExistente || fornecedorNome] = 'OS';
    return fornecedores;
}

async function sincronizarOsProdutosFornecedor(itens, fornecedorNome) {
    if (!fornecedoresClient || !fornecedorNome || fornecedorNome === 'Outro') return;
    const itensOs = (itens || []).filter(item => Number(item?.falta_os || 0) > 0);
    if (!itensOs.length) return;

    for (const item of itensOs) {
        const produtoAtual = obterProdutoParaPedidoFornecedor(item);
        if (!produtoAtual?.id) continue;
        const fornecedores = definirFornecedorOsNoProduto(produtoAtual, fornecedorNome);
        if (!fornecedores) continue;
        const { error } = await fornecedoresClient.rpc("atualizar_fornecedores_produto_admin", {
            p_id: produtoAtual.id,
            p_fornecedores: fornecedores
        });
        if (error) throw error;
        fornecedorProdutos = fornecedorProdutos.map(produto =>
            String(produto.id) === String(produtoAtual.id) ? { ...produto, fornecedores } : produto
        );
    }
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

async function adicionarSelecaoAoPedidoFornecedor(id) {
    const pedido = fornecedorPedidos.find(item => item.id === id);
    if (!pedido) return;
    if (!fornecedorSelecao.length) {
        definirStatusFornecedor('Escolha primeiro os produtos e depois junte a selecao a esta encomenda.', true);
        return;
    }
    const total = fornecedorSelecao.reduce((soma, item) => soma + Math.max(1, Math.floor(Number(item.quantidade) || 1)), 0);
    if (!window.confirm(`Adicionar ${total} unidade(s) selecionada(s) a ${pedido.codigo}?`)) return;

    const itens = [...pedido.itens.map(normalizarItemPedidoFornecedor)];
    const itensExportar = [];
    fornecedorSelecao.forEach(selecionado => {
        const existente = itens.find(item => String(item.id) === String(selecionado.id));
        const quantidade = Math.max(1, Math.floor(Number(selecionado.quantidade) || 1));
        itensExportar.push(criarItemFornecedorAPartirSelecao(selecionado, 'substituicao'));
        if (existente) {
            existente.quantidade = Math.max(0, Number(existente.quantidade || 0)) + quantidade;
            existente.quantidade_original = Math.max(0, Number(existente.quantidade_original || existente.quantidade || 0)) + quantidade;
            existente.origem_ajuste = existente.origem_ajuste || 'reforco';
        } else {
            itens.push(criarItemFornecedorAPartirSelecao(selecionado, 'substituicao'));
        }
    });

    try {
        definirStatusFornecedor('A completar encomenda com a selecao...');
        const atualizado = await atualizarPedidoFornecedor(pedido.id, { itens });
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

function garantirModalEdicaoFornecedor() {
    let modal = document.getElementById('fornecedor-edicao-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'fornecedor-edicao-modal';
    modal.className = 'fornecedor-edicao-modal';
    modal.hidden = true;
    modal.innerHTML = `
        <div class="fornecedor-edicao-dialog" role="dialog" aria-modal="true" aria-labelledby="fornecedor-edicao-titulo">
            <div class="fornecedor-edicao-topo">
                <h3 id="fornecedor-edicao-titulo">Editar encomenda do fornecedor</h3>
                <button type="button" class="fornecedor-edicao-fechar" id="fornecedor-edicao-fechar" aria-label="Fechar">x</button>
            </div>
            <form id="fornecedor-edicao-form" class="fornecedor-edicao-form">
                <input type="hidden" id="fornecedor-edicao-id">
                <div class="fornecedor-edicao-corpo">
                    <div class="fornecedor-edicao-grid">
                        <label>
                            Código da encomenda
                            <input type="text" id="fornecedor-edicao-codigo" required>
                        </label>
                        <label>
                            Fornecedor
                            <input type="text" id="fornecedor-edicao-nome" required>
                        </label>
                        <label>
                            Referencia interna
                            <input type="text" id="fornecedor-edicao-referencia">
                        </label>
                        <label>
                            Estado
                            <select id="fornecedor-edicao-estado"></select>
                        </label>
                    </div>
                    <p class="fornecedor-edicao-aviso-guardar">As alterações aos campos acima só ficam guardadas ao clicar <strong>Guardar encomenda</strong>.</p>
                    <section class="fornecedor-lista-final-box fornecedor-lista-final-edicao" aria-label="Lista final enviada pelo fornecedor">
                        <h4>Colar lista final do fornecedor</h4>
                        <p>Depois de o fornecedor responder, cola aqui referência, quantidade e preço compra. A encomenda abaixo é corrigida automaticamente.</p>
                        <textarea id="fornecedor-edicao-lista-final" rows="5" placeholder="Ex.:&#10;AF301	2	1,25&#10;PG634	1	0,85"></textarea>
                        <div class="fornecedor-lista-final-acoes">
                            <button type="button" id="fornecedor-edicao-limpar-lista-final">Limpar texto</button>
                            <button type="button" id="fornecedor-edicao-aplicar-lista-final" class="wallapop-botao-destaque">Aplicar à encomenda</button>
                        </div>
                    </section>
                    <div class="fornecedor-edicao-produtos" id="fornecedor-edicao-produtos"></div>
                    <p class="fornecedores-status fornecedor-edicao-status" id="fornecedor-edicao-status" role="status"></p>
                </div>
                <div class="fornecedores-acoes fornecedor-edicao-acoes">
                    <button type="button" id="fornecedor-edicao-cancelar" class="wallapop-botao">Cancelar</button>
                    <button type="submit" id="fornecedor-edicao-guardar" class="wallapop-botao wallapop-botao-destaque">Guardar encomenda</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#fornecedor-edicao-fechar')?.addEventListener('click', fecharEdicaoPedidoFornecedor);
    modal.querySelector('#fornecedor-edicao-cancelar')?.addEventListener('click', fecharEdicaoPedidoFornecedor);
    modal.querySelector('#fornecedor-edicao-aplicar-lista-final')?.addEventListener('click', aplicarListaFinalNaEdicaoFornecedor);
    modal.querySelector('#fornecedor-edicao-limpar-lista-final')?.addEventListener('click', limparListaFinalEdicaoFornecedor);
    modal.addEventListener('click', (evento) => {
        if (evento.target === modal) fecharEdicaoPedidoFornecedor();
    });
    modal.querySelector('#fornecedor-edicao-form')?.addEventListener('submit', guardarEdicaoPedidoFornecedor);
    return modal;
}

function abrirEdicaoPedidoFornecedor(id) {
    const pedido = fornecedorPedidos.find(item => item.id === id);
    if (!pedido) return;
    const modal = garantirModalEdicaoFornecedor();
    const estadoSelect = modal.querySelector('#fornecedor-edicao-estado');
    estadoSelect.replaceChildren();
    obterEstadosPedidoFornecedor().forEach(opcao => {
        const opt = document.createElement('option');
        opt.value = opcao;
        opt.textContent = opcao;
        opt.selected = pedido.estado === opcao;
        estadoSelect.appendChild(opt);
    });

    modal.querySelector('#fornecedor-edicao-id').value = pedido.id;
    modal.querySelector('#fornecedor-edicao-codigo').value = pedido.codigo || '';
    modal.querySelector('#fornecedor-edicao-nome').value = pedido.fornecedor || '';
    modal.querySelector('#fornecedor-edicao-referencia').value = pedido.referencia || '';
    modal.querySelector('#fornecedor-edicao-status').textContent = '';
    modal.querySelector('#fornecedor-edicao-lista-final').value = '';

    const lista = modal.querySelector('#fornecedor-edicao-produtos');
    lista.replaceChildren();
    pedido.itens.forEach((item, indice) => {
        lista.appendChild(montarLinhaEdicaoProdutoFornecedor(pedido, item, indice));
    });

    modal.hidden = false;
    document.body.classList.add('fornecedor-edicao-modal-aberto');
    modal.querySelector('#fornecedor-edicao-nome')?.focus();
}

function fecharEdicaoPedidoFornecedor() {
    const modal = document.getElementById('fornecedor-edicao-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('fornecedor-edicao-modal-aberto');
}

function lerItensEditadosPedidoFornecedor(pedido, modal) {
    const linhas = Array.from(modal.querySelectorAll('.fornecedor-edicao-produto'));
    return linhas.map(linha => {
        const indice = Number(linha.dataset.indice);
        const item = pedido.itens[indice];
        if (!item) return null;
        const remover = linha.querySelector('[data-campo="remover"]')?.checked;
        if (remover) return null;
        const quantidade = Math.max(0, Math.floor(Number(linha.querySelector('[data-campo="quantidade"]')?.value || 0)));
        const quantidadeOriginal = Math.max(quantidade, Math.floor(Number(item.quantidade_original ?? item.quantidade ?? quantidade) || quantidade));
        const faltaOsIndicada = Math.max(0, Math.floor(Number(linha.querySelector('[data-campo="falta_os"]')?.value || 0)));
        const faltaOs = Math.max(faltaOsIndicada, quantidadeOriginal - quantidade);
        const precoCusto = Math.max(0, Number(String(linha.querySelector('[data-campo="preco_custo"]')?.value || '').replace(',', '.')) || 0);
        const recebido = Math.max(0, Math.floor(Number(linha.querySelector('[data-campo="recebido"]')?.dataset.valor || item.recebido || 0)));
        return {
            ...item,
            quantidade_original: quantidadeOriginal,
            quantidade,
            falta_os: faltaOs,
            preco_custo: precoCusto,
            preco: precoCusto,
            estado_fornecedor: faltaOs > 0 ? 'OS' : (item.estado_fornecedor === 'OS' ? '' : item.estado_fornecedor || ''),
            recebido: Math.min(recebido, quantidade)
        };
    }).filter(item => item && (Number(item.quantidade || 0) > 0 || Number(item.falta_os || 0) > 0));
}

async function guardarEdicaoPedidoFornecedor(evento) {
    evento.preventDefault();
    const modal = document.getElementById('fornecedor-edicao-modal');
    if (!modal || modal.hidden) return;
    const status = modal.querySelector('#fornecedor-edicao-status');
    const botao = modal.querySelector('#fornecedor-edicao-guardar');
    const id = modal.querySelector('#fornecedor-edicao-id')?.value || '';
    const pedido = fornecedorPedidos.find(item => String(item.id) === String(id));
    if (!pedido) {
        if (status) {
            status.textContent = 'Encomenda nao encontrada para guardar.';
            status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
            status.classList.add('status-erro');
        }
        return;
    }

    const codigo = modal.querySelector('#fornecedor-edicao-codigo').value.trim();
    const fornecedor = modal.querySelector('#fornecedor-edicao-nome').value.trim();
    const referencia = modal.querySelector('#fornecedor-edicao-referencia').value.trim();
    const estado = modal.querySelector('#fornecedor-edicao-estado').value;
    const itens = lerItensEditadosPedidoFornecedor(pedido, modal);

    if (!codigo) {
        status.textContent = 'Indique o codigo da encomenda.';
        status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
        status.classList.add('status-erro');
        return;
    }
    if (!fornecedor) {
        status.textContent = 'Indique o fornecedor.';
        status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
        status.classList.add('status-erro');
        return;
    }
    if (!itens.length) {
        status.textContent = 'A encomenda precisa de pelo menos um produto. Cole a lista final e clique em "Aplicar à encomenda", ou desmarque "Remover" nos produtos que quer manter.';
        status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
        status.classList.add('status-erro');
        return;
    }

    try {
        botao.disabled = true;
        status.textContent = 'A guardar ficha...';
        status.classList.remove('status-erro', 'status-sucesso', 'status-aviso');
        status.classList.add('status-neutro');
        const atualizado = await atualizarPedidoFornecedor(id, { codigo, fornecedor, referencia: referencia || null, estado, itens });
        status.textContent = 'A marcar OS no mapa do fornecedor...';
        await sincronizarOsProdutosFornecedor(itens, fornecedor);
        status.textContent = 'A atualizar preço compra nos produtos...';
        let produtosComPrecoAtualizado = 0;
        let avisoPrecoCompra = '';
        try {
            produtosComPrecoAtualizado = await sincronizarPrecoCompraProdutosFornecedor(itens);
        } catch (erroPrecoCompra) {
            console.warn('Nao foi possivel sincronizar preço compra nos produtos.', erroPrecoCompra);
            avisoPrecoCompra = ' O preço compra ficou guardado na encomenda, mas ainda não foi atualizado na ficha do produto. Execute o SQL atualizado no Supabase.';
        }
        renderizarResultadosFornecedor();
        renderizarPedidosFornecedores();
        fecharEdicaoPedidoFornecedor();
        definirStatusFornecedor(`Ajuste ${atualizado.codigo} guardado.${produtosComPrecoAtualizado ? ` Preço compra atualizado em ${produtosComPrecoAtualizado} produto(s).` : ''}${avisoPrecoCompra}`, Boolean(avisoPrecoCompra));
    } catch (error) {
        console.error(error);
        status.textContent = 'Erro: ' + (error.message || 'Nao foi possivel guardar a ficha.');
        status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
        status.classList.add('status-erro');
    } finally {
        botao.disabled = false;
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

function criarElementoPedidoFornecedor(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function criarLinhaDetalhePedidoFornecedor(rotulo, valor) {
    const linha = criarElementoPedidoFornecedor("div", "admin-encomenda-detalhe-linha");
    linha.append(
        criarElementoPedidoFornecedor("strong", "", rotulo),
        criarElementoPedidoFornecedor("span", "", valor || "—")
    );
    return linha;
}

function renderizarPedidosFornecedores() {
    const caixa = document.getElementById('fornecedor-pedidos');
    if (!caixa) return;
    const filtro = document.getElementById('fornecedor-filtro-estado')?.value || 'a_preparar';
    caixa.replaceChildren();
    const pedidos = fornecedorPedidos.filter(pedido => pedidoFornecedorPassaFiltroEstado(pedido, filtro));
    if (!pedidos.length) {
        const vazio = document.createElement('p');
        vazio.className = 'fornecedor-vazio';
        vazio.textContent = 'Ainda nao existem encomendas neste estado.';
        caixa.appendChild(vazio);
        return;
    }

    pedidos.forEach(pedido => {
        const aberto = fornecedorPedidosAbertos.has(String(pedido.id));
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

        const card = criarElementoPedidoFornecedor("article", `admin-encomenda-card fornecedor-pedido-card${aberto ? " aberta" : ""}`);
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
            }
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
            criarElementoPedidoFornecedor("strong", "admin-encomenda-codigo", pedido.codigo || `#${pedido.id}`),
            criarElementoPedidoFornecedor("span", "admin-encomenda-data", formatarDataPedidoFornecedor(pedido.criado_em)),
            criarElementoPedidoFornecedor("span", "fornecedor-pedido-fornecedor-nome", pedido.fornecedor || "Fornecedor"),
            criarElementoPedidoFornecedor("span", "fornecedor-pedido-resumo", resumo),
            criarElementoPedidoFornecedor("span", `estado-encomenda ${obterClasseBadgeEstadoPedidoFornecedor(pedido.estado)}`, pedido.estado || "A preparar")
        );
        cabecalho.append(linha, criarElementoPedidoFornecedor("span", "admin-encomenda-seta", "▾"));

        const detalhes = criarElementoPedidoFornecedor("div", "admin-encomenda-detalhes fornecedor-pedido-detalhes");
        detalhes.hidden = !aberto;

        const dados = criarElementoPedidoFornecedor("div", "admin-encomenda-dados");
        dados.append(
            criarLinhaDetalhePedidoFornecedor("Fornecedor", pedido.fornecedor),
            criarLinhaDetalhePedidoFornecedor("Referência", pedido.referencia),
            criarLinhaDetalhePedidoFornecedor("Código", pedido.codigo),
            criarLinhaDetalhePedidoFornecedor("Criada", formatarDataPedidoFornecedor(pedido.criado_em)),
            criarLinhaDetalhePedidoFornecedor("Artigos", String(totaisPedido.itens)),
            criarLinhaDetalhePedidoFornecedor("Unidades", String(totaisPedido.quantidade)),
            criarLinhaDetalhePedidoFornecedor("Por receber", String(totaisPedido.pendente)),
            criarLinhaDetalhePedidoFornecedor("OS/Falta", totaisPedido.os > 0 ? String(totaisPedido.os) : "0")
        );

        const produtos = criarElementoPedidoFornecedor("div", "admin-encomenda-produtos fornecedor-pedido-produtos");
        produtos.appendChild(criarElementoPedidoFornecedor("h3", "", "Produtos"));
        const lista = criarElementoPedidoFornecedor("div", "fornecedor-pedido-produtos");
        pedido.itens.forEach(item => {
            const produtoAtual = obterProdutoParaPedidoFornecedor(item) || item;
            const recebido = Number(item.recebido || 0);
            const restante = Math.max(0, Number(item.quantidade || 0) - recebido);
            const faltaOs = Math.max(0, Number(item.falta_os || 0));
            const linhaProduto = criarElementoPedidoFornecedor("div", "fornecedor-pedido-linha");
            if (faltaOs > 0) linhaProduto.classList.add("tem-os");
            linhaProduto.appendChild(criarImagemFornecedor(produtoAtual, "fornecedor-miniatura pequena"));
            const info = criarElementoPedidoFornecedor("div", "fornecedor-info");
            info.innerHTML = `<strong>${escaparHtmlFornecedor(item.nome)}</strong><span class="fornecedor-identificadores">Ref. ${escaparHtmlFornecedor(item.referencia || "-")} | SKU ${escaparHtmlFornecedor(item.sku || "-")}</span><span>Pedido: ${Number(item.quantidade || 0)} | Recebido: ${recebido} | Stock atual: ${Number(produtoAtual.stock || 0)}</span>${faltaOs > 0 ? `<span class="fornecedor-ajuste-os ativo">OS/Falta: ${faltaOs}${item.quantidade_original ? ` de ${Number(item.quantidade_original || 0)}` : ""}</span>` : ""}${item.origem_ajuste ? `<span class="fornecedor-ajuste-os">${item.origem_ajuste === "substituicao" ? "Substituto para completar encomenda" : "Reforco adicionado"}</span>` : ""}`;
            const input = document.createElement("input");
            input.type = "number";
            input.min = "0";
            input.step = "1";
            input.value = restante > 0 ? restante : 0;
            input.className = "fornecedor-recebido-input";
            input.dataset.pedido = pedido.id;
            input.dataset.produto = item.id;
            linhaProduto.append(info, input);
            lista.appendChild(linhaProduto);
        });
        produtos.appendChild(lista);

        const acoes = criarElementoPedidoFornecedor("div", "admin-encomenda-acoes fornecedor-pedido-acoes");
        const grupoEstado = criarElementoPedidoFornecedor("label", "admin-encomenda-estado-edicao");
        grupoEstado.appendChild(criarElementoPedidoFornecedor("span", "", "Estado"));
        const estado = document.createElement("select");
        estado.className = "fornecedor-status-select";
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
        const completar = criarElementoPedidoFornecedor("button", "wallapop-botao", "Juntar selecao");
        completar.type = "button";
        completar.addEventListener("click", () => adicionarSelecaoAoPedidoFornecedor(pedido.id));
        const imprimir = criarElementoPedidoFornecedor("button", "wallapop-botao", "Imprimir");
        imprimir.type = "button";
        imprimir.addEventListener("click", () => imprimirPedidoFornecedor(pedido.id));
        const receber = criarElementoPedidoFornecedor("button", "wallapop-botao wallapop-botao-destaque", "Receber stock");
        receber.type = "button";
        receber.addEventListener("click", () => receberPedidoFornecedor(pedido.id));
        const apagar = criarElementoPedidoFornecedor("button", "wallapop-botao admin-encomenda-apagar", "Apagar pedido");
        apagar.type = "button";
        apagar.addEventListener("click", () => apagarPedidoFornecedor(pedido.id));
        botoes.append(editar, completar, imprimir, receber, apagar);
        acoes.append(grupoEstado, botoes);

        detalhes.append(dados, acoes, produtos);
        card.append(cabecalho, detalhes);
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
ligarEventoFornecedor('btn-criar-fornecedor', 'click', criarPedidoFornecedor);
ligarEventoFornecedor('fornecedor-filtro-estado', 'change', renderizarPedidosFornecedores);
ligarEventoFornecedor('btn-editar-fornecedor-selecionado', 'click', editarFornecedorSelecionado);
ligarEventoFornecedor('fornecedor-ficha-modal-fechar', 'click', fecharModalFichaFornecedor);
document.getElementById('fornecedor-ficha-modal')?.addEventListener('click', (evento) => {
    if (evento.target?.id === 'fornecedor-ficha-modal') {
        fecharModalFichaFornecedor();
    }
});
ligarEventoFornecedor('fornecedor-ficha-lista', 'change', () => {
    preencherFormularioFichaFornecedor(obterFichaFornecedorPorId(document.getElementById('fornecedor-ficha-lista')?.value));
});
ligarEventoFornecedor('fornecedor-ficha-novo', 'click', novaFichaFornecedor);
ligarEventoFornecedor('fornecedor-ficha-apagar', 'click', apagarFichaFornecedor);
ligarEventoFornecedor('fornecedor-ficha-form', 'submit', guardarFichaFornecedor);

const botaoFecharImagemFornecedor = document.getElementById('admin-imagem-modal-fechar');
botaoFecharImagemFornecedor?.addEventListener('click', fecharImagemFornecedorModal);
document.getElementById('admin-imagem-modal')?.addEventListener('click', (evento) => {
    if (evento.target?.id === 'admin-imagem-modal') {
        fecharImagemFornecedorModal();
    }
});
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
