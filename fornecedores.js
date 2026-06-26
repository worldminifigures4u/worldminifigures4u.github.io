const FORNECEDORES_SUPABASE_URL = "https://gksndzxadndrsynvzgzb.supabase.co";
const FORNECEDORES_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrc25kenhhZG5kcnN5bnZ6Z3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc5NzMsImV4cCI6MjA5NDY2Mzk3M30.EHZgacYr27dqoc4CJHsOwkNnJFGlLIteSHBi4B1HfVE";
const FORNECEDORES_ADMIN_EMAILS = ["worldminifigures4u@gmail.com"];
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
let fornecedorMapaOrdenacao = { coluna: "nome", direcao: "asc" };
let mapasProdutosVisiveis = [];
let fornecedorRenderizacaoPendente = null;
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
    const selectFicha = document.getElementById("fornecedor-ficha-lista");
    const valorAtual = selectPedido?.value || "";

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
            || (produto.referencia && String(item.referencia || '').trim().toUpperCase() === String(produto.referencia).trim().toUpperCase())
        ));
        const produtoNormalizado = {
            ...produto,
            stock: Number.isFinite(Number(produto.stock)) ? Number(produto.stock) : 0,
            preco: Number.isFinite(Number(produto.preco)) ? Number(produto.preco) : 0
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
    <script>
        window.addEventListener('load', () => {
            window.print();
        });
    <\/script>
</body>
</html>`);
    janela.document.close();
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

function tornarImagemFornecedorAmpliavel(img, produto) {
    const modal = document.getElementById('admin-imagem-modal');
    const url = obterImagemFornecedor(produto);
    if (!modal || !url || url === FORNECEDORES_SEM_IMAGEM) return;
    img.classList.add('fornecedor-miniatura-clicavel');
    img.title = 'Ver imagem maior';
    img.tabIndex = 0;
    const abrir = () => abrirImagemFornecedorModal(url, img.alt);
    img.addEventListener('click', abrir);
    img.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter' || evento.key === ' ') {
            evento.preventDefault();
            abrir();
        }
    });
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
    tornarImagemFornecedorAmpliavel(img, produto);
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

function produtoPassaFiltroFornecedor(produto, fornecedorNome, filtro) {
    if (!filtro || filtro === "todos" || fornecedorNome === "Outro") return true;
    const valor = obterValorFornecedorProduto(produto, fornecedorNome);
    const estado = classificarValorFornecedor(valor);
    return estado.tipo === filtro;
}

function obterControlosResultadosFornecedor() {
    return {
        termo: normalizarFornecedor(document.getElementById("fornecedor-pesquisa")?.value || ""),
        fornecedor: document.getElementById("fornecedor-nome")?.value || "",
        filtroFornecedor: document.getElementById("fornecedor-filtro-marcacao")?.value || "todos",
        filtroTop: document.getElementById("fornecedor-filtro-top")?.value || "todos",
        filtroDescontinuado: document.getElementById("fornecedor-filtro-descontinuado")?.value || "todos",
        filtroStockMapa: document.getElementById("mapas-filtro-stock")?.value || "todos",
        ordenacao: document.getElementById("fornecedor-ordenacao-stock")?.value || "nome",
    };
}

function calcularScoreResultadoFornecedor(produto, termo) {
    if (!termo) return 5;
    const nome = normalizarFornecedor(produto.nome);
    const sku = normalizarFornecedor(produto.sku);
    const referencia = normalizarFornecedor(produto.referencia);
    const tema = normalizarFornecedor(produto.tema);
    const subtema = normalizarFornecedor(produto.subtema);

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

    const skuItem = String(item.sku || '').trim().toUpperCase();
    const referenciaItem = String(item.referencia || '').trim().toUpperCase();
    const nomeItem = normalizarFornecedor(item.nome);
    return listaProdutos.find(produto => {
        const mesmoSku = skuItem && String(produto.sku || '').trim().toUpperCase() === skuItem;
        const mesmaReferencia = referenciaItem && String(produto.referencia || '').trim().toUpperCase() === referenciaItem;
        const mesmoNome = nomeItem && normalizarFornecedor(produto.nome) === nomeItem;
        return mesmoSku || mesmaReferencia || mesmoNome;
    }) || null;
}

function produtoPassaFiltroTopFornecedor(produto, filtroTop) {
    if (!filtroTop || filtroTop === "todos") return true;
    const valorTop = String(obterTopProdutoFornecedor(produto) || "").trim();
    if (filtroTop === "top") return Boolean(valorTop);
    if (filtroTop === "sem-top") return !valorTop;
    return true;
}

function produtoPassaFiltroDescontinuadoFornecedor(produto, filtroDescontinuado) {
    if (!filtroDescontinuado || filtroDescontinuado === "todos") return true;
    const descontinuado = obterBooleanoProdutoFornecedor(produto?.descontinuado);
    if (filtroDescontinuado === "descontinuado") return descontinuado;
    if (filtroDescontinuado === "sem-descontinuado") return !descontinuado;
    return true;
}

function produtoPassaFiltroStockMapaFornecedor(produto, filtroStockMapa) {
    if (!estaPaginaMapasFornecedor() || !filtroStockMapa || filtroStockMapa === "todos") return true;
    const stock = Number(produto?.stock || 0);
    if (filtroStockMapa === "com-stock") return stock > 0;
    if (filtroStockMapa === "sem-stock") return stock <= 0;
    if (String(filtroStockMapa).startsWith("maior-")) {
        const minimo = Number(String(filtroStockMapa).replace("maior-", ""));
        return stock > minimo;
    }
    return true;
}

function formatarProdutoMapaParaCopiar(produto) {
    const nome = String(produto?.nome || "Produto sem nome").trim();
    const preco = formatarEuroFornecedor(produto?.preco || 0);
    return `${nome}\t${preco}`;
}

async function copiarListaMapaVisivel() {
    const produtos = mapasProdutosVisiveis || [];
    if (!produtos.length) {
        definirStatusFornecedor("Nao ha produtos visiveis para copiar.", true);
        return;
    }

    const linhasProdutos = produtos.map(formatarProdutoMapaParaCopiar);
    const total = produtos.reduce((soma, produto) => soma + Number(produto?.preco || 0), 0);
    const texto = [
        ...linhasProdutos,
        "",
        `Total\t${formatarEuroFornecedor(total)}`,
        "",
        "Acresce as despesas com portes de envio e manuseamento para pacote postal de acordo com a sua escolha."
    ].join("\n");
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(texto);
        } else {
            const area = document.createElement("textarea");
            area.value = texto;
            area.setAttribute("readonly", "readonly");
            area.style.position = "fixed";
            area.style.left = "-9999px";
            document.body.appendChild(area);
            area.select();
            document.execCommand("copy");
            area.remove();
        }
        definirStatusFornecedor(`${produtos.length} produto(s) copiado(s) para colar no site.`);
    } catch (erro) {
        console.error(erro);
        definirStatusFornecedor("Nao foi possivel copiar automaticamente. Selecione a tabela e copie manualmente.", true);
    }
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

function focarQuantidadeMapaRelativa(inputAtual, direcao) {
    const inputs = Array.from(document.querySelectorAll(".mapa-quantidade-input"));
    const indiceAtual = inputs.indexOf(inputAtual);
    if (indiceAtual < 0) return false;
    const proximo = inputs[indiceAtual + direcao];
    if (!proximo) return false;
    proximo.focus();
    proximo.select();
    return true;
}

function tratarTeclaQuantidadeMapa(evento) {
    if (evento.key !== "Tab") return;
    const direcao = evento.shiftKey ? -1 : 1;
    if (focarQuantidadeMapaRelativa(evento.currentTarget, direcao)) {
        evento.preventDefault();
    }
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
    let produtos = Array.isArray(respostaAdmin.data) ? respostaAdmin.data : [];

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
        if (estaPaginaMapasFornecedor()) {
            definirStatusFornecedor('O Supabase ainda nao esta a devolver todos os campos dos mapas. Execute o SQL atualizado e volte a importar o mapas.ods.', true);
        }
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

function estaPaginaMapasFornecedor() {
    return Boolean(
        document.body?.classList.contains("pagina-mapas-admin")
        || document.body?.classList.contains("pagina-fornecedores-unificada")
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
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-descontinuado", "Descontinuado", obterBooleanoProdutoFornecedor(produto.descontinuado));
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-novidade", "Novidade", obterBooleanoProdutoFornecedor(produto.novidade));
    campos.appendChild(secaoIdentificacao);

    const secaoDetalhes = criarSecaoEdicaoMapa("Detalhes", "mapas-produto-secao-detalhes");
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-preco", "Preco", Number(produto.preco || 0).toFixed(2), "number", { required: true, min: 0, step: "0.01" });
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
        descontinuado: document.getElementById("mapas-editar-descontinuado").checked,
        novidade: document.getElementById("mapas-editar-novidade").checked,
        preco: Number(document.getElementById("mapas-editar-preco").value),
        peso: Number(document.getElementById("mapas-editar-peso").value || 10),
        stock: Math.max(0, Math.floor(Number(document.getElementById("mapas-editar-stock").value || 0))),
        tema: document.getElementById("mapas-editar-tema").value.trim(),
        subtema: document.getElementById("mapas-editar-subtema").value.trim() || "semsubtema",
        imagens: textoParaImagensProdutoFornecedor(document.getElementById("mapas-editar-imagens").value),
        observacoes: document.getElementById("mapas-editar-observacoes").value.trim(),
        fornecedores,
        ativo: document.getElementById("mapas-editar-ativo").checked
    };

    if (!produto.nome || !produto.sku || !produto.tema || !Number.isFinite(produto.preco) || produto.preco < 0 || !Number.isFinite(produto.peso) || produto.peso < 1) {
        throw new Error("Preencha nome, SKU, tema, preco e peso corretamente.");
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
            status.style.color = "#ddd";
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
            preco: Number.isFinite(Number(data.preco)) ? Number(data.preco) : 0
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
            status.style.color = "#ff6262";
        }
    } finally {
        if (botao) botao.disabled = false;
    }
}

function criarItemContadorMapa(rotulo, valor, destaque = false) {
    const item = document.createElement("span");
    item.className = destaque ? "mapas-contador-item destaque" : "mapas-contador-item";

    const numero = document.createElement("strong");
    numero.textContent = String(valor);

    const texto = document.createElement("span");
    texto.textContent = rotulo;

    item.append(texto, numero);
    return item;
}

function renderizarContadorMapa(caixa, resultados, fornecedor) {
    const contadores = resultados.reduce((totais, { produto }) => {
        const estado = classificarValorFornecedor(obterValorFornecedorProduto(produto, fornecedor));
        if (estado.tipo === "os") totais.os += 1;
        if (estado.tipo === "ex") totais.ex += 1;
        if (estado.tipo === "disponivel") totais.disponivel += 1;
        if (estado.tipo === "encomendado") totais.encomendado += 1;
        if (String(obterTopProdutoFornecedor(produto) || "").trim()) totais.top += 1;
        if (obterBooleanoProdutoFornecedor(produto?.descontinuado)) totais.descontinuado += 1;
        totais.stock += Math.max(0, Number(produto?.stock || 0));
        return totais;
    }, {
        top: 0,
        descontinuado: 0,
        os: 0,
        ex: 0,
        disponivel: 0,
        encomendado: 0,
        stock: 0
    });

    const contadorExistente = document.getElementById("fornecedor-contador-barra");
    const contador = contadorExistente || document.createElement("div");
    contador.className = "mapas-contador-filtros";
    contador.querySelectorAll(".mapas-contador-item").forEach(item => item.remove());

    contador.append(
        criarItemContadorMapa(resultados.length === 1 ? "figura" : "figuras", resultados.length, true),
        criarItemContadorMapa("Disponivel", contadores.disponivel),
        criarItemContadorMapa("OS", contadores.os),
        criarItemContadorMapa("EX", contadores.ex),
        criarItemContadorMapa("Top", contadores.top),
        criarItemContadorMapa("Descontinuadas", contadores.descontinuado),
        criarItemContadorMapa("em stock", contadores.stock)
    );
    if (!contadorExistente) caixa.appendChild(contador);
}

function renderizarResultadosFornecedorMapa(caixa, resultados, fornecedor) {
    caixa.classList.add("fornecedor-resultados-mapa");
    renderizarContadorMapa(caixa, resultados, fornecedor);

    const resumo = document.createElement("p");
    resumo.className = "fornecedor-contagem-lista mapas-tabela-resumo";
    resumo.textContent = resultados.length
        ? `${resultados.length} produto(s) no mapa`
        : "Nenhum produto encontrado.";
    caixa.appendChild(resumo);

    if (!resultados.length) {
        mapasProdutosVisiveis = [];
        return;
    }

    const envoltorio = document.createElement("div");
    envoltorio.className = "mapas-tabela-wrapper";

    const tabela = document.createElement("table");
    tabela.className = "mapas-produtos-tabela";

    const thead = document.createElement("thead");
    const cabecalho = document.createElement("tr");
    [
        ["nome", "mapas-col-nome", "nome"],
        ["referência", "mapas-col-ref", "ref"],
        ["stock", "mapas-col-stock", "stock"],
        ["tema", "mapas-col-tema", "tema"],
        ["subtema", "mapas-col-subtema", "subtema"],
        ["preço", "mapas-col-preco", "preco"],
        ["novidade", "mapas-col-novidade", "novidade"],
        ["descontinuado", "mapas-col-descontinuado", "descontinuado"],
        ["lego", "mapas-col-lego", "lego"],
        ["sku", "mapas-col-sku", "sku"],
        ["top", "mapas-col-top", "top"],
        ["peso", "mapas-col-peso", "peso"],
    ].forEach(([texto, classe, coluna]) => {
        const th = document.createElement("th");
        th.className = `${classe} mapas-th-ordenavel`;
        const botao = document.createElement("button");
        botao.type = "button";
        botao.textContent = texto;
        botao.tabIndex = -1;
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
        th.appendChild(botao);
        cabecalho.appendChild(th);
    });
    thead.appendChild(cabecalho);
    tabela.appendChild(thead);

    const tbody = document.createElement("tbody");
    const resultadosOrdenados = resultados
        .slice()
        .sort((a, b) => compararProdutosPorColunaFornecedor(a, b, fornecedorMapaOrdenacao.coluna, fornecedorMapaOrdenacao.direcao));

    mapasProdutosVisiveis = resultadosOrdenados.map(({ produto }) => produto);

    resultadosOrdenados
        .forEach(({ produto }) => {
            const atual = produto;
            const linha = document.createElement("tr");
            const stockNumero = Number(atual.stock || 0);

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

            linha.appendChild(criarCelulaMapaFornecedor(atual.referencia || "-", "mapas-col-ref"));
            linha.appendChild(criarCelulaMapaFornecedor(stockNumero, `mapas-col-stock mapa-stock-celula ${stockNumero <= 0 ? "sem-stock" : ""}`));
            linha.appendChild(criarCelulaMapaFornecedor(atual.tema || "", "mapas-col-tema"));
            linha.appendChild(criarCelulaMapaFornecedor(atual.subtema === "semsubtema" ? "" : (atual.subtema || ""), "mapas-col-subtema"));
            linha.appendChild(criarCelulaMapaFornecedor(Number(atual.preco || 0).toFixed(2), "mapas-col-preco"));
            linha.appendChild(criarCelulaMapaFornecedor(obterBooleanoProdutoFornecedor(atual.novidade) ? "sim" : "", "mapas-col-novidade"));
            linha.appendChild(criarCelulaMapaFornecedor(obterBooleanoProdutoFornecedor(atual.descontinuado) ? "sim" : "", "mapas-col-descontinuado"));
            linha.appendChild(criarCelulaMapaFornecedor(obterLegoProdutoFornecedor(atual), "mapas-col-lego"));
            linha.appendChild(criarCelulaMapaFornecedor(atual.sku || "-", "mapas-col-sku"));
            linha.appendChild(criarCelulaMapaFornecedor(String(obterTopProdutoFornecedor(atual) || "").trim() ? "sim" : "", "mapas-col-top"));
            linha.appendChild(criarCelulaMapaFornecedor(Number(atual.peso || 0), "mapas-col-peso"));

            tbody.appendChild(linha);
        });

    tabela.appendChild(tbody);
    envoltorio.appendChild(tabela);
    caixa.appendChild(envoltorio);
}

function renderizarResultadosFornecedor() {
    const caixa = document.getElementById("fornecedor-resultados");
    if (!caixa) return;

    const { termo, fornecedor, filtroFornecedor, filtroTop, filtroDescontinuado, filtroStockMapa, ordenacao } = obterControlosResultadosFornecedor();
    caixa.innerHTML = "";

    const resultados = fornecedorProdutos
        .map((produto) => ({
            produto,
            score: calcularScoreResultadoFornecedor(produto, termo),
        }))
        .filter((item) => (
            (!termo || item.score < 99)
            && produtoPassaFiltroFornecedor(item.produto, fornecedor, filtroFornecedor)
            && produtoPassaFiltroTopFornecedor(item.produto, filtroTop)
            && produtoPassaFiltroDescontinuadoFornecedor(item.produto, filtroDescontinuado)
            && produtoPassaFiltroStockMapaFornecedor(item.produto, filtroStockMapa)
        ))
        .sort((a, b) => compararProdutosFornecedor(a, b, ordenacao));

    if (estaPaginaMapasFornecedor()) {
        renderizarResultadosFornecedorMapa(caixa, resultados, fornecedor);
        return;
    }

    caixa.classList.remove("fornecedor-resultados-mapa");

    const resumo = document.createElement("p");
    resumo.className = "fornecedor-contagem-lista";
    resumo.textContent = resultados.length
        ? `${resultados.length} produto(s) apresentados`
        : "Nenhum produto encontrado.";
    caixa.appendChild(resumo);

    resultados.forEach(({ produto }) => {
        const atual = produto;
        const linha = document.createElement("div");
        linha.className = "fornecedor-produto";

        const img = document.createElement("img");
        img.className = "fornecedor-miniatura";
        img.src = obterImagemProdutoFornecedor(atual);
        img.alt = atual.nome || "Produto";
        linha.appendChild(img);

        const info = document.createElement("div");
        info.className = "fornecedor-info";

        const nome = document.createElement("strong");
        nome.textContent = atual.nome || "Produto sem nome";
        info.appendChild(nome);

        const ids = document.createElement("span");
        ids.className = "fornecedor-identificadores";
        ids.textContent = `${atual.referencia ? `Ref. ${atual.referencia} | ` : ""}SKU ${atual.sku || "-"}`;
        info.appendChild(ids);

        const estadoFornecedor = classificarValorFornecedor(obterValorFornecedorProduto(atual, fornecedor));
        if (fornecedor && fornecedor !== "Outro" && filtroFornecedor !== "todos") {
            const fornecedorLinha = document.createElement("span");
            fornecedorLinha.className = `fornecedor-marcacao ${estadoFornecedor.tipo}`;
            fornecedorLinha.textContent = `${fornecedor}: ${estadoFornecedor.texto}`;
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

function renderizarSelecionadosFornecedor() {
    const caixa = document.getElementById("fornecedor-selecionados");
    if (!caixa) return;
    caixa.innerHTML = "";

    if (!fornecedorSelecao.length) {
        caixa.innerHTML = '<p class="fornecedor-vazio">A lista esta vazia.</p>';
        return;
    }

    fornecedorSelecao.forEach((item) => {
        const atual = obterProdutoAtual(item.id) || item;
        const linha = document.createElement("div");
        linha.className = "fornecedor-item";

        const img = document.createElement("img");
        img.className = "fornecedor-miniatura";
        img.src = obterImagemProdutoFornecedor(atual);
        img.alt = atual.nome || "Produto";
        linha.appendChild(img);

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
        precoCusto.textContent = "Preço custo";
        const precoCustoInput = document.createElement("input");
        precoCustoInput.type = "number";
        precoCustoInput.min = "0";
        precoCustoInput.step = "0.01";
        precoCustoInput.inputMode = "decimal";
        precoCustoInput.className = "fornecedor-preco-custo-input";
        precoCustoInput.value = Number(item.preco_custo ?? item.custo ?? 0).toFixed(2);
        precoCustoInput.setAttribute("aria-label", `Preço de custo de ${atual.nome || "produto"}`);
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
    const referencia = document.getElementById('fornecedor-referencia')?.value.trim() || '';
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
            p_referencia: referencia,
            p_itens: itens
        });
        if (error) throw error;
        const pedido = normalizarPedidoFornecedor(data);
        fornecedorPedidos.unshift(pedido);
        guardarPedidosFornecedores();
        fornecedorSelecao = [];
        guardarSelecaoFornecedor();
        if (document.getElementById('fornecedor-referencia')) {
            document.getElementById('fornecedor-referencia').value = '';
        }
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
    const { data, error } = await fornecedoresClient
        .from('encomendas_fornecedores')
        .update(alteracoes)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    const atualizado = normalizarPedidoFornecedor(data);
    fornecedorPedidos = fornecedorPedidos.map(item => item.id === id ? atualizado : item);
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
                <div class="fornecedor-edicao-grid">
                    <label>
                        Nome da encomenda
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
                <div class="fornecedor-edicao-produtos" id="fornecedor-edicao-produtos"></div>
                <p class="fornecedores-status fornecedor-edicao-status" id="fornecedor-edicao-status" role="status"></p>
                <div class="fornecedores-acoes fornecedor-edicao-acoes">
                    <button type="button" id="fornecedor-edicao-cancelar">Cancelar</button>
                    <button type="submit" id="fornecedor-edicao-guardar">Guardar encomenda</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#fornecedor-edicao-fechar')?.addEventListener('click', fecharEdicaoPedidoFornecedor);
    modal.querySelector('#fornecedor-edicao-cancelar')?.addEventListener('click', fecharEdicaoPedidoFornecedor);
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

    const lista = modal.querySelector('#fornecedor-edicao-produtos');
    lista.replaceChildren();
    pedido.itens.forEach((item, indice) => {
        const produtoAtual = obterProdutoParaPedidoFornecedor(item) || item;
        const quantidadeOriginal = Math.max(0, Number(item.quantidade_original ?? item.quantidade ?? 0));
        const quantidadeAtual = Math.max(0, Number(item.quantidade || 0));
        const faltaAtual = Math.max(0, Number(item.falta_os || Math.max(0, quantidadeOriginal - quantidadeAtual)));
        const precoCustoAtual = Number(item.preco_custo ?? item.custo ?? item.preco ?? 0) || 0;
        const linha = document.createElement('div');
        linha.className = 'fornecedor-edicao-produto';
        if (faltaAtual > 0) linha.classList.add('tem-os');
        linha.dataset.indice = String(indice);
        linha.appendChild(criarImagemFornecedor(produtoAtual, 'fornecedor-miniatura pequena'));

        const info = document.createElement('div');
        info.className = 'fornecedor-info';
        const nome = document.createElement('strong');
        nome.textContent = item.nome || produtoAtual.nome || 'Produto';
        const ids = document.createElement('span');
        ids.className = 'fornecedor-identificadores';
        ids.textContent = `Ref. ${item.referencia || produtoAtual.referencia || '-'} | SKU ${item.sku || produtoAtual.sku || '-'}`;
        const ajuste = document.createElement('span');
        ajuste.className = faltaAtual > 0 ? 'fornecedor-ajuste-os ativo' : 'fornecedor-ajuste-os';
        ajuste.textContent = faltaAtual > 0
            ? `Inicial: ${quantidadeOriginal} | OS: ${faltaAtual}`
            : `Inicial: ${quantidadeOriginal}`;
        if (item.origem_ajuste) {
            ajuste.textContent += item.origem_ajuste === 'substituicao' ? ' | Substituto' : ' | Reforco';
        }
        info.append(nome, ids, ajuste);

        const campos = document.createElement('div');
        campos.className = 'fornecedor-edicao-produto-campos';
        const quantidade = document.createElement('label');
        quantidade.textContent = 'A receber';
        const quantidadeInput = document.createElement('input');
        quantidadeInput.type = 'number';
        quantidadeInput.min = '0';
        quantidadeInput.step = '1';
        quantidadeInput.value = quantidadeAtual;
        quantidadeInput.dataset.campo = 'quantidade';
        quantidade.appendChild(quantidadeInput);

        const falta = document.createElement('label');
        falta.textContent = 'OS/Falta';
        const faltaInput = document.createElement('input');
        faltaInput.type = 'number';
        faltaInput.min = '0';
        faltaInput.step = '1';
        faltaInput.value = faltaAtual;
        faltaInput.dataset.campo = 'falta_os';
        falta.appendChild(faltaInput);

        const precoCusto = document.createElement('label');
        precoCusto.textContent = 'Preço custo';
        const precoCustoInput = document.createElement('input');
        precoCustoInput.type = 'number';
        precoCustoInput.min = '0';
        precoCustoInput.step = '0.01';
        precoCustoInput.value = precoCustoAtual.toFixed(2);
        precoCustoInput.dataset.campo = 'preco_custo';
        precoCusto.appendChild(precoCustoInput);

        const recebido = document.createElement('div');
        recebido.className = 'fornecedor-edicao-recebido-info';
        const recebidoAtual = ['A preparar', 'Encomendada'].includes(pedido.estado)
            ? 0
            : Math.max(0, Number(item.recebido || 0));
        recebido.dataset.campo = 'recebido';
        recebido.dataset.valor = String(recebidoAtual);
        recebido.innerHTML = `<strong>Recebido</strong><span>${recebidoAtual}</span>`;

        const remover = document.createElement('label');
        remover.className = 'fornecedor-edicao-remover';
        const removerInput = document.createElement('input');
        removerInput.type = 'checkbox';
        removerInput.dataset.campo = 'remover';
        remover.append(removerInput, document.createTextNode(' Remover'));

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
        quantidadeInput.addEventListener('change', sincronizarFalta);
        quantidadeInput.addEventListener('blur', sincronizarFalta);
        faltaInput.addEventListener('change', sincronizarQuantidade);
        faltaInput.addEventListener('blur', sincronizarQuantidade);

        campos.append(quantidade, falta, precoCusto, recebido, remover);
        linha.append(info, campos);
        lista.appendChild(linha);
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
    const modal = garantirModalEdicaoFornecedor();
    const status = modal.querySelector('#fornecedor-edicao-status');
    const botao = modal.querySelector('#fornecedor-edicao-guardar');
    const id = modal.querySelector('#fornecedor-edicao-id').value;
    const pedido = fornecedorPedidos.find(item => item.id === id);
    if (!pedido) return;

    const codigo = modal.querySelector('#fornecedor-edicao-codigo').value.trim();
    const fornecedor = modal.querySelector('#fornecedor-edicao-nome').value.trim();
    const referencia = modal.querySelector('#fornecedor-edicao-referencia').value.trim();
    const estado = modal.querySelector('#fornecedor-edicao-estado').value;
    const itens = lerItensEditadosPedidoFornecedor(pedido, modal);

    if (!codigo) {
        status.textContent = 'Indique o nome da encomenda.';
        status.style.color = '#ff6262';
        return;
    }
    if (!fornecedor) {
        status.textContent = 'Indique o fornecedor.';
        status.style.color = '#ff6262';
        return;
    }
    if (!itens.length) {
        status.textContent = 'A ficha precisa de pelo menos um produto.';
        status.style.color = '#ff6262';
        return;
    }

    try {
        botao.disabled = true;
        status.textContent = 'A guardar ficha...';
        status.style.color = '#ddd';
        const atualizado = await atualizarPedidoFornecedor(id, { codigo, fornecedor, referencia: referencia || null, estado, itens });
        status.textContent = 'A marcar OS no mapa do fornecedor...';
        await sincronizarOsProdutosFornecedor(itens, fornecedor);
        renderizarResultadosFornecedor();
        renderizarPedidosFornecedores();
        fecharEdicaoPedidoFornecedor();
        definirStatusFornecedor(`Ajuste ${atualizado.codigo} guardado.`);
    } catch (error) {
        console.error(error);
        status.textContent = 'Erro: ' + (error.message || 'Nao foi possivel guardar a ficha.');
        status.style.color = '#ff6262';
    } finally {
        botao.disabled = false;
    }
}

function renderizarPedidosFornecedores() {
    const caixa = document.getElementById('fornecedor-pedidos');
    if (!caixa) return;
    const filtro = document.getElementById('fornecedor-filtro-estado')?.value || 'todos';
    caixa.innerHTML = '';
    const pedidos = fornecedorPedidos.filter(pedido => pedidoFornecedorPassaFiltroEstado(pedido, filtro));
    if (!pedidos.length) {
        caixa.innerHTML = '<p class="fornecedor-vazio">Ainda nao existem encomendas neste estado.</p>';
        return;
    }

    pedidos.forEach(pedido => {
        const card = document.createElement('article');
        card.className = 'fornecedor-pedido-card';
        const aberto = fornecedorPedidosAbertos.has(String(pedido.id));
        if (aberto) card.classList.add('aberta');

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

        const topo = document.createElement('div');
        topo.className = 'fornecedor-pedido-cabecalho';
        topo.setAttribute('role', 'button');
        topo.tabIndex = 0;
        topo.setAttribute('aria-expanded', aberto ? 'true' : 'false');
        const alternarPedido = () => {
            const idPedido = String(pedido.id);
            if (fornecedorPedidosAbertos.has(idPedido)) {
                fornecedorPedidosAbertos.delete(idPedido);
            } else {
                fornecedorPedidosAbertos.add(idPedido);
            }
            renderizarPedidosFornecedores();
        };
        topo.addEventListener('click', alternarPedido);
        topo.addEventListener('keydown', (evento) => {
            if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                alternarPedido();
            }
        });
        const titulo = document.createElement('div');
        titulo.innerHTML = `<strong>${pedido.codigo}</strong><span>${pedido.fornecedor}${pedido.referencia ? ' - ' + pedido.referencia : ''}</span><small>${new Date(pedido.criado_em).toLocaleString('pt-PT')}</small><small>${totaisPedido.itens} artigo(s) | ${totaisPedido.quantidade} unidade(s) | ${totaisPedido.pendente} por receber${totaisPedido.os > 0 ? ` | ${totaisPedido.os} OS` : ''}</small>`;
        const controlos = document.createElement('div');
        controlos.className = 'fornecedor-pedido-controlos';
        const estado = document.createElement('select');
        estado.className = 'fornecedor-status-select';
        obterEstadosPedidoFornecedor().forEach(opcao => {
            const opt = document.createElement('option');
            opt.value = opcao;
            opt.textContent = opcao;
            opt.selected = pedido.estado === opcao;
            estado.appendChild(opt);
        });
        estado.addEventListener('click', evento => evento.stopPropagation());
        estado.addEventListener('keydown', evento => evento.stopPropagation());
        estado.addEventListener('change', () => alterarEstadoPedidoFornecedor(pedido.id, estado.value));
        const seta = document.createElement('span');
        seta.className = 'fornecedor-pedido-seta';
        seta.textContent = '▾';
        seta.setAttribute('aria-hidden', 'true');
        controlos.append(estado, seta);
        topo.append(titulo, controlos);
        card.appendChild(topo);

        const detalhes = document.createElement('div');
        detalhes.className = 'fornecedor-pedido-detalhes';
        detalhes.hidden = !aberto;

        const lista = document.createElement('div');
        lista.className = 'fornecedor-pedido-produtos';
        pedido.itens.forEach(item => {
            const produtoAtual = obterProdutoParaPedidoFornecedor(item) || item;
            const recebido = Number(item.recebido || 0);
            const restante = Math.max(0, Number(item.quantidade || 0) - recebido);
            const faltaOs = Math.max(0, Number(item.falta_os || 0));
            const linha = document.createElement('div');
            linha.className = 'fornecedor-pedido-linha';
            if (faltaOs > 0) linha.classList.add('tem-os');
            linha.appendChild(criarImagemFornecedor(produtoAtual, 'fornecedor-miniatura pequena'));
            const info = document.createElement('div');
            info.className = 'fornecedor-info';
            info.innerHTML = `<strong>${item.nome}</strong><span class="fornecedor-identificadores">Ref. ${item.referencia || '-'} | SKU ${item.sku || '-'}</span><span>Pedido: ${item.quantidade} | Recebido: ${recebido} | Stock atual: ${Number(produtoAtual.stock || 0)}</span>${faltaOs > 0 ? `<span class="fornecedor-ajuste-os ativo">OS/Falta: ${faltaOs}${item.quantidade_original ? ` de ${item.quantidade_original}` : ''}</span>` : ''}${item.origem_ajuste ? `<span class="fornecedor-ajuste-os">${item.origem_ajuste === 'substituicao' ? 'Substituto para completar encomenda' : 'Reforco adicionado'}</span>` : ''}`;
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
        detalhes.appendChild(lista);

        const acoes = document.createElement('div');
        acoes.className = 'fornecedores-acoes pedido';
        const editar = document.createElement('button');
        editar.type = 'button';
        editar.className = 'wallapop-botao';
        editar.textContent = 'Editar encomenda';
        editar.addEventListener('click', () => abrirEdicaoPedidoFornecedor(pedido.id));
        const completar = document.createElement('button');
        completar.type = 'button';
        completar.className = 'wallapop-botao';
        completar.textContent = 'Juntar selecao';
        completar.addEventListener('click', () => adicionarSelecaoAoPedidoFornecedor(pedido.id));
        const imprimir = document.createElement('button');
        imprimir.type = 'button';
        imprimir.className = 'wallapop-botao';
        imprimir.textContent = 'Imprimir';
        imprimir.addEventListener('click', () => imprimirPedidoFornecedor(pedido.id));
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
        acoes.append(editar, completar, imprimir, receber, apagar);
        detalhes.appendChild(acoes);
        card.appendChild(detalhes);
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

function ligarEventoFornecedor(id, evento, handler) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.addEventListener(evento, handler);
    }
}

ligarEventoFornecedor('fornecedor-pesquisa', 'input', agendarRenderizacaoResultadosFornecedor);
ligarEventoFornecedor('fornecedor-nome', 'change', agendarRenderizacaoResultadosFornecedor);
ligarEventoFornecedor('fornecedor-ordenacao-stock', 'change', agendarRenderizacaoResultadosFornecedor);
ligarEventoFornecedor('fornecedor-filtro-marcacao', 'change', agendarRenderizacaoResultadosFornecedor);
ligarEventoFornecedor('fornecedor-filtro-top', 'change', agendarRenderizacaoResultadosFornecedor);
ligarEventoFornecedor('fornecedor-filtro-descontinuado', 'change', agendarRenderizacaoResultadosFornecedor);
ligarEventoFornecedor('mapas-filtro-stock', 'change', agendarRenderizacaoResultadosFornecedor);
ligarEventoFornecedor('mapas-copiar-lista', 'click', copiarListaMapaVisivel);
ligarEventoFornecedor('btn-limpar-fornecedor', 'click', limparSelecaoFornecedor);
ligarEventoFornecedor('btn-criar-fornecedor', 'click', criarPedidoFornecedor);
ligarEventoFornecedor('fornecedor-filtro-estado', 'change', renderizarPedidosFornecedores);
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
