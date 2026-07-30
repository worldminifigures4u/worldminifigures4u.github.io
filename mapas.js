
const MAPAS_COLUNAS = [
    { chave: "foto", rotulo: "foto", classe: "mapas-col-foto", semOrdenacao: true, largura: 64 },
    { chave: "nome", rotulo: "nome", classe: "mapas-col-nome", obrigatorio: true, largura: 280 },
    { chave: "referencia", rotulo: "referência", classe: "mapas-col-ref", largura: 110 },
    { chave: "stock", rotulo: "stock", classe: "mapas-col-stock", numero: true, largura: 72 },
    { chave: "tema", rotulo: "tema", classe: "mapas-col-tema", largura: 150 },
    { chave: "subtema", rotulo: "subtema", classe: "mapas-col-subtema", largura: 170 },
    { chave: "preco_compra", rotulo: "preço compra", classe: "mapas-col-preco", numero: true, dinheiro: true, largura: 128 },
    { chave: "preco", rotulo: "preço venda", classe: "mapas-col-preco", numero: true, dinheiro: true, largura: 118 },
    { chave: "lego", rotulo: "lego", classe: "mapas-col-lego", largura: 72 },
    { chave: "sku", rotulo: "sku", classe: "mapas-col-sku", largura: 80 },
    { chave: "top", rotulo: "top", classe: "mapas-col-top", largura: 64 },
    { chave: "ativo", rotulo: "ativo", classe: "mapas-col-ativo", largura: 70 },
    { chave: "arquivado", rotulo: "arq.", classe: "mapas-col-arquivado", titulo: "arquivado", largura: 70 },
    { chave: "descontinuado", rotulo: "desc.", classe: "mapas-col-descontinuado", titulo: "descontinuado", largura: 70 },
    { chave: "novidade", rotulo: "nov.", classe: "mapas-col-novidade", titulo: "novidade", largura: 70 },
    { chave: "peso", rotulo: "peso", classe: "mapas-col-peso", numero: true, largura: 70 }
];

const MAPAS_COLUNAS_STORAGE = "fp-mapas-colunas-visiveis";

var mapasClient = null;
var mapasProdutos = [];
var mapasResultados = [];
var mapasProdutosVisiveis = [];
var mapasOrdenacao = { coluna: "nome", direcao: "asc" };
var mapasLinhaAltura = 46;
var mapasRenderPendente = 0;
var mapasAtualizacaoPendente = 0;
var mapasColunasVisiveis = new Set(MAPAS_COLUNAS.map((coluna) => coluna.chave));
var folhaDinamicaMapas = null;
var mapasEncomendasFornecedorCache = null;
var mapasEncomendasFornecedorPromessa = null;
var mapasVendasClienteCache = null;
var mapasVendasClientePromessa = null;
var MAPAS_FORNECEDORES_STORAGE_KEY = "figures-planet-fornecedores-pedidos";


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

var __mapasProdutoModalPromessa = null;
function garantirMapasProdutoModal() {
    if (window.MapasProdutoModal) return Promise.resolve();
    if (!__mapasProdutoModalPromessa) {
        __mapasProdutoModalPromessa = carregarScriptAdmin("mapas-produto-modal.js?v=20260730-fecho-fundo");
    }
    return __mapasProdutoModalPromessa;
}

async function abrirFichaProdutoMapa() {
    await garantirMapasProdutoModal();
    return window.MapasProdutoModal.abrirFicha.apply(null, arguments);
}

async function abrirEdicaoProdutoMapa() {
    await garantirMapasProdutoModal();
    return window.MapasProdutoModal.abrirEdicao.apply(null, arguments);
}

function abrirCriacaoProdutoMapa() {
    return garantirMapasProdutoModal().then(function () {
        return window.MapasProdutoModal.abrirCriacao.apply(null, arguments);
    });
}


function definirCssDinamicoMapas(cssTexto) {
    try {
        if (!('adoptedStyleSheets' in document) || typeof CSSStyleSheet === 'undefined') return;
        if (!folhaDinamicaMapas) {
            folhaDinamicaMapas = new CSSStyleSheet();
            document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets || []).concat(folhaDinamicaMapas);
        }
        if (typeof folhaDinamicaMapas.replaceSync === 'function') {
            folhaDinamicaMapas.replaceSync(cssTexto || '');
        }
    } catch (error) {
        console.warn('CSS dinâmico ignorado:', error);
    }
}

function normalizarMapa(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function produtoPassaPesquisaMapa(produto, termo) {
    if (!termo) return true;
    const haystack = String(produto.pesquisa || "");
    if (haystack.includes(termo)) return true;
    // Pesquisa por palavras: "Doctor Evazan" encontra mesmo com espaços a mais no nome
    const tokens = termo.split(" ").filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
}

function normalizarSkuMapa(valor) {
    return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatarEuroMapa(valor) {
    return Number(valor || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function valorBooleanoMapa(valor) {
    if (valor === true) return true;
    if (!valor) return false;
    return ["1", "sim", "s", "x", "yes", "y", "true", "verdadeiro"].includes(normalizarMapa(valor));
}

function textoBooleanoMapa(valor) {
    return valorBooleanoMapa(valor) ? "sim" : "";
}

function textoLegoMapa(valor) {
    const texto = normalizarMapa(valor);
    if (texto === "sim") return "sim";
    if (texto === "nao" || texto === "não") return "não";
    return "";
}

function definirStatusMapa(texto, erro = false) {
    const el = document.getElementById("fornecedores-status");
    if (!el) return;
    el.textContent = texto || "";
    el.classList.remove('status-erro', 'status-sucesso', 'status-aviso', 'status-neutro', 'status-discreto');
    el.classList.add(erro ? 'status-erro' : 'status-sucesso');
}

function obterTopMapa(produto) {
    return produto?.top || "";
}

function carregarPreferenciasColunasMapa() {
    const todas = MAPAS_COLUNAS.map((coluna) => coluna.chave);
    try {
        const bruto = localStorage.getItem(MAPAS_COLUNAS_STORAGE);
        if (!bruto) {
            mapasColunasVisiveis = new Set(todas);
            return;
        }
        const lista = JSON.parse(bruto);
        const validas = Array.isArray(lista)
            ? lista.map((item) => String(item || "").trim()).filter((chave) => todas.includes(chave))
            : [];
        mapasColunasVisiveis = new Set(validas.length ? validas : todas);
    } catch (_erro) {
        mapasColunasVisiveis = new Set(todas);
    }
    // Nome fica sempre visível
    mapasColunasVisiveis.add("nome");
}

function guardarPreferenciasColunasMapa() {
    try {
        localStorage.setItem(MAPAS_COLUNAS_STORAGE, JSON.stringify([...mapasColunasVisiveis]));
    } catch (_erro) {
        // ignore quota / private mode
    }
}

function obterColunasVisiveisMapa() {
    const visiveis = MAPAS_COLUNAS.filter((coluna) => mapasColunasVisiveis.has(coluna.chave));
    return visiveis.length ? visiveis : MAPAS_COLUNAS.filter((coluna) => coluna.chave === "nome");
}

function rotuloColunaMapa(coluna) {
    return coluna.titulo || coluna.rotulo;
}

function montarPainelColunasMapa() {
    const caixa = document.getElementById("mapas-colunas-opcoes");
    if (!caixa) return;
    caixa.replaceChildren();

    MAPAS_COLUNAS.forEach((coluna) => {
        const label = document.createElement("label");
        label.className = "mapas-coluna-opcao";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = coluna.chave;
        input.checked = mapasColunasVisiveis.has(coluna.chave);
        input.disabled = Boolean(coluna.obrigatorio);
        input.addEventListener("change", () => {
            if (coluna.obrigatorio) {
                input.checked = true;
                return;
            }
            if (input.checked) mapasColunasVisiveis.add(coluna.chave);
            else mapasColunasVisiveis.delete(coluna.chave);
            mapasColunasVisiveis.add("nome");
            guardarPreferenciasColunasMapa();
            renderizarTabelaMapa();
        });
        label.append(input, document.createTextNode(` ${rotuloColunaMapa(coluna)}`));
        caixa.appendChild(label);
    });
}

function normalizarImagensMapa(imagens) {
    let lista = imagens;
    if (typeof lista === "string") {
        try {
            lista = JSON.parse(lista);
        } catch (_erro) {
            lista = String(lista).split(/[\n,]+/);
        }
    }
    if (!Array.isArray(lista)) return [];
    return lista
        .map((item) => {
            if (typeof item === "string") {
                const texto = item.trim();
                if (!texto) return "";
                if ((texto.startsWith('"') && texto.endsWith('"')) || (texto.startsWith("'") && texto.endsWith("'"))) {
                    try {
                        return String(JSON.parse(texto) || "").trim();
                    } catch (_erro) {
                        return texto.slice(1, -1).trim();
                    }
                }
                return texto;
            }
            if (item && typeof item === "object") {
                return String(item.url || item.secure_url || item.src || "").trim();
            }
            return String(item || "").trim();
        })
        .filter(Boolean);
}

function normalizarProdutoMapa(produto) {
    const normalizado = {
        id: produto.id,
        referencia: produto.referencia || "",
        lego: produto.lego || "",
        sku: produto.sku || "",
        nome: produto.nome || "",
        preco: Number(produto.preco || 0),
        preco_compra: Number(produto.preco_compra || 0),
        top: produto.top || "",
        arquivado: valorBooleanoMapa(produto.arquivado),
        descontinuado: valorBooleanoMapa(produto.descontinuado),
        novidade: valorBooleanoMapa(produto.novidade),
        peso: Number(produto.peso || 10),
        tema: produto.tema || "",
        subtema: produto.subtema || "",
        stock: Number.isFinite(Number(produto.stock)) ? Math.floor(Number(produto.stock)) : 0,
        ativo: produto.ativo !== false,
        imagens: normalizarImagensMapa(produto.imagens),
        observacoes: produto.observacoes || "",
        fornecedores: produto.fornecedores || {}
    };
    normalizado.pesquisa = normalizarMapa([
        normalizado.nome,
        normalizado.referencia,
        normalizado.sku,
        normalizado.tema,
        normalizado.subtema
    ].join(" "));
    return normalizado;
}

function produtoPassaFiltroStockMapa(produto, filtro) {
    const stock = Number(produto.stock || 0);
    if (!filtro || filtro === "todos") return true;
    if (filtro === "com-stock") return stock > 0;
    if (filtro === "sem-stock") return stock <= 0;
    if (filtro.startsWith("maior-")) return stock > Number(filtro.replace("maior-", ""));
    return true;
}

function valorOrdenacaoMapa(produto, coluna) {
    if (coluna === "preco" || coluna === "preco_compra" || coluna === "stock" || coluna === "peso") return Number(produto[coluna] || 0);
    if (coluna === "ativo") return produto.ativo !== false ? 1 : 0;
    if (coluna === "arquivado" || coluna === "descontinuado" || coluna === "novidade") return valorBooleanoMapa(produto[coluna]) ? 1 : 0;
    return String(produto[coluna] || "");
}

function compararProdutosMapa(a, b) {
    const coluna = mapasOrdenacao.coluna;
    const valorA = valorOrdenacaoMapa(a, coluna);
    const valorB = valorOrdenacaoMapa(b, coluna);
    let resultado;
    if (typeof valorA === "number" || typeof valorB === "number") {
        resultado = Number(valorA || 0) - Number(valorB || 0);
    } else {
        resultado = String(valorA || "").localeCompare(String(valorB || ""), "pt", { numeric: true, sensitivity: "base" });
    }
    if (resultado === 0 && coluna !== "nome") {
        resultado = String(a.nome || "").localeCompare(String(b.nome || ""), "pt", { numeric: true, sensitivity: "base" });
    }
    return mapasOrdenacao.direcao === "desc" ? -resultado : resultado;
}

function criarItemContadorMapa(rotulo, valor, destaque = false) {
    const item = document.createElement("span");
    item.className = destaque ? "mapas-contador-item destaque" : "mapas-contador-item";
    const texto = document.createElement("span");
    texto.textContent = rotulo;
    const numero = document.createElement("strong");
    numero.textContent = String(valor);
    item.append(texto, numero);
    return item;
}

function renderizarContadoresMapa(resultados) {
    const contador = document.getElementById("fornecedor-contador-barra");
    if (!contador) return;
    contador.querySelectorAll(".mapas-contador-item").forEach(item => item.remove());
    const totalStock = resultados.reduce((acc, produto) => acc + Number(produto.stock || 0), 0);
    const figuras = criarItemContadorMapa(resultados.length === 1 ? "Figura" : "Figuras", resultados.length);
    const stock = criarItemContadorMapa("Stock", totalStock);
    const pesquisa = contador.querySelector(".campo-com-limpar, #fornecedor-pesquisa");
    const ancora = pesquisa?.closest?.(".campo-com-limpar") || pesquisa;
    if (ancora?.nextSibling) {
        contador.insertBefore(figuras, ancora.nextSibling);
        contador.insertBefore(stock, figuras.nextSibling);
    } else if (ancora) {
        ancora.after(figuras, stock);
    } else {
        contador.prepend(figuras, stock);
    }
}

function criarColgroupTabelaMapa() {
    const colgroup = document.createElement("colgroup");
    obterColunasVisiveisMapa().forEach((coluna) => {
        const col = document.createElement("col");
        col.style.width = `${Number(coluna.largura) || 100}px`;
        colgroup.appendChild(col);
    });
    return colgroup;
}

function larguraTabelaMapaVisivel() {
    return obterColunasVisiveisMapa().reduce((soma, coluna) => soma + (Number(coluna.largura) || 100), 0);
}

function atualizarScrollHorizontalTopoMapa() {
    const topo = document.getElementById("mapas-tabela-scroll-topo");
    const inner = document.getElementById("mapas-tabela-scroll-topo-inner");
    const wrapper = document.getElementById("mapas-tabela-wrapper");
    if (!topo || !inner || !wrapper) return;

    const largura = larguraTabelaMapaVisivel();
    inner.style.width = `${largura}px`;
    const precisaScroll = largura > wrapper.clientWidth + 1;
    topo.classList.toggle("mapas-scroll-topo-oculto", !precisaScroll);
    if (precisaScroll) topo.scrollLeft = wrapper.scrollLeft;
}

function ligarScrollHorizontalTopoMapa() {
    const topo = document.getElementById("mapas-tabela-scroll-topo");
    const wrapper = document.getElementById("mapas-tabela-wrapper");
    if (!topo || !wrapper) return;

    let aSincronizar = false;
    const sincronizar = (origem, destino) => {
        if (aSincronizar) return;
        aSincronizar = true;
        destino.scrollLeft = origem.scrollLeft;
        requestAnimationFrame(() => {
            aSincronizar = false;
        });
    };

    topo.addEventListener("scroll", () => sincronizar(topo, wrapper), { passive: true });
    wrapper.addEventListener("scroll", () => sincronizar(wrapper, topo), { passive: true });
}

function criarCabecalhoTabelaMapa() {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    obterColunasVisiveisMapa().forEach(coluna => {
        const th = document.createElement("th");
        th.className = coluna.classe || "";
        th.title = coluna.titulo || coluna.rotulo;
        if (coluna.semOrdenacao) {
            th.classList.add("mapas-th-sem-ordenacao");
            th.textContent = coluna.rotulo;
        } else {
            th.textContent = coluna.rotulo + (mapasOrdenacao.coluna === coluna.chave ? (mapasOrdenacao.direcao === "asc" ? " ▲" : " ▼") : "");
            th.addEventListener("click", () => {
                if (mapasOrdenacao.coluna === coluna.chave) {
                    mapasOrdenacao.direcao = mapasOrdenacao.direcao === "asc" ? "desc" : "asc";
                } else {
                    mapasOrdenacao = { coluna: coluna.chave, direcao: "asc" };
                }
                atualizarResultadosMapa();
            });
        }
        tr.appendChild(th);
    });
    thead.appendChild(tr);
    return thead;
}

function criarMiniaturaProdutoMapa(produto) {
    const urlOriginal = typeof obterImagemPrincipalProduto === "function"
        ? obterImagemPrincipalProduto(produto)
        : (normalizarImagensMapa(produto?.imagens)[0] || "");
    const url = typeof otimizarImagemCloudinary === "function"
        ? otimizarImagemCloudinary(urlOriginal, 72)
        : urlOriginal;

    if (!url) {
        const vazio = document.createElement("span");
        vazio.className = "mapas-produto-foto-vazia";
        vazio.setAttribute("aria-hidden", "true");
        return vazio;
    }

    const img = document.createElement("img");
    img.className = "mapas-produto-foto";
    img.src = url;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 36;
    img.height = 36;
    img.onerror = () => {
        const vazio = document.createElement("span");
        vazio.className = "mapas-produto-foto-vazia";
        vazio.setAttribute("aria-hidden", "true");
        img.replaceWith(vazio);
    };
    return img;
}

function valorCelulaMapa(produto, coluna) {
    if (coluna.chave === "preco" || coluna.chave === "preco_compra") return formatarEuroMapa(produto[coluna.chave]);
    if (coluna.chave === "ativo") return produto.ativo !== false ? "sim" : "";
    if (coluna.chave === "arquivado" || coluna.chave === "descontinuado" || coluna.chave === "novidade") return textoBooleanoMapa(produto[coluna.chave]);
    if (coluna.chave === "lego") return textoLegoMapa(produto.lego);
    if (coluna.chave === "subtema") return produto.subtema === "semsubtema" ? "" : produto.subtema;
    return produto[coluna.chave] ?? "";
}

function criarLinhaProdutoMapa(produto) {
    const tr = document.createElement("tr");
    obterColunasVisiveisMapa().forEach(coluna => {
        const td = document.createElement("td");
        if (coluna.classe) td.className = coluna.classe;
        if (coluna.chave === "foto") {
            td.appendChild(criarMiniaturaProdutoMapa(produto));
        } else if (coluna.chave === "nome") {
            const botao = document.createElement("button");
            botao.type = "button";
            botao.className = "mapas-celula-nome";
            botao.textContent = produto.nome || "";
            botao.title = produto.nome || "Abrir ficha do produto";
            botao.addEventListener("click", () => abrirFichaProdutoMapa(produto.id));
            td.appendChild(botao);
        } else {
            const texto = valorCelulaMapa(produto, coluna);
            if (coluna.chave === "tema" || coluna.chave === "subtema") {
                const span = document.createElement("span");
                span.className = "mapas-celula-texto-2linhas";
                span.textContent = texto;
                if (texto) span.title = String(texto);
                td.appendChild(span);
            } else {
                td.textContent = texto;
                if (coluna.chave === "referencia" && texto) td.title = String(texto);
            }
        }
        if (coluna.chave === "stock" && Number(produto.stock || 0) <= 0) td.classList.add("sem-stock");
        tr.appendChild(td);
    });
    return tr;
}

function renderizarJanelaVirtualMapa() {
    const tbody = document.getElementById("mapas-tabela-corpo");
    const spacerTopo = document.getElementById("mapas-spacer-topo");
    const spacerFundo = document.getElementById("mapas-spacer-fundo");
    if (!tbody || !spacerTopo || !spacerFundo) return;

    const viewport = Math.max(window.innerHeight || 700, 500);
    const tabela = document.getElementById("mapas-tabela-wrapper");
    const rect = tabela?.getBoundingClientRect();
    const topo = Math.max(0, -(rect?.top || 0));
    const overscan = 12;
    const inicio = Math.max(0, Math.floor(topo / mapasLinhaAltura) - overscan);
    const quantidade = Math.min(mapasResultados.length - inicio, Math.ceil(viewport / mapasLinhaAltura) + overscan * 2);
    const fim = Math.max(inicio, inicio + quantidade);

    const alturaTopo = Math.max(0, inicio * mapasLinhaAltura);
    const alturaFundo = Math.max(0, (mapasResultados.length - fim) * mapasLinhaAltura);
    definirCssDinamicoMapas(`#mapas-spacer-topo > td { height: ${alturaTopo}px; } #mapas-spacer-fundo > td { height: ${alturaFundo}px; }`);
    tbody.replaceChildren(spacerTopo);
    mapasResultados.slice(inicio, fim).forEach(produto => tbody.appendChild(criarLinhaProdutoMapa(produto)));
    tbody.appendChild(spacerFundo);
    mapasProdutosVisiveis = mapasResultados;
}

function agendarRenderVirtualMapa() {
    if (mapasRenderPendente) return;
    mapasRenderPendente = requestAnimationFrame(() => {
        mapasRenderPendente = 0;
        renderizarJanelaVirtualMapa();
    });
}

function renderizarTabelaMapa() {
    const caixa = document.getElementById("fornecedor-resultados");
    if (!caixa) return;
    caixa.classList.add("fornecedor-resultados-mapa");
    caixa.replaceChildren();

    renderizarContadoresMapa(mapasResultados);

    if (!mapasResultados.length) {
        const vazio = document.createElement("p");
        vazio.className = "fornecedor-contagem-lista mapas-tabela-resumo";
        vazio.textContent = "Nenhum produto encontrado.";
        caixa.appendChild(vazio);
        return;
    }

    const colunasVisiveis = obterColunasVisiveisMapa();
    const comFoto = colunasVisiveis.some((coluna) => coluna.chave === "foto");
    mapasLinhaAltura = comFoto ? 56 : 42;

    const bloco = document.createElement("div");
    bloco.className = "mapas-tabela-bloco";

    const scrollTopo = document.createElement("div");
    scrollTopo.id = "mapas-tabela-scroll-topo";
    scrollTopo.className = "mapas-tabela-scroll-topo";
    scrollTopo.setAttribute("aria-hidden", "true");
    const scrollTopoInner = document.createElement("div");
    scrollTopoInner.id = "mapas-tabela-scroll-topo-inner";
    scrollTopoInner.className = "mapas-tabela-scroll-topo-inner";
    scrollTopo.appendChild(scrollTopoInner);

    const wrapper = document.createElement("div");
    wrapper.id = "mapas-tabela-wrapper";
    wrapper.className = "mapas-tabela-wrapper mapas-tabela-virtual";

    const tabela = document.createElement("table");
    tabela.className = `mapas-produtos-tabela${comFoto ? " mapas-com-foto" : " mapas-sem-foto"}`;
    tabela.style.width = `${larguraTabelaMapaVisivel()}px`;
    tabela.appendChild(criarColgroupTabelaMapa());
    tabela.appendChild(criarCabecalhoTabelaMapa());
    const tbody = document.createElement("tbody");
    tbody.id = "mapas-tabela-corpo";
    const spacerTopo = document.createElement("tr");
    spacerTopo.id = "mapas-spacer-topo";
    spacerTopo.className = "mapas-spacer-virtual";
    const spacerTopoCelula = document.createElement("td");
    spacerTopoCelula.colSpan = colunasVisiveis.length;
    spacerTopo.appendChild(spacerTopoCelula);
    const spacerFundo = document.createElement("tr");
    spacerFundo.id = "mapas-spacer-fundo";
    spacerFundo.className = "mapas-spacer-virtual";
    const spacerFundoCelula = document.createElement("td");
    spacerFundoCelula.colSpan = colunasVisiveis.length;
    spacerFundo.appendChild(spacerFundoCelula);
    tbody.append(spacerTopo, spacerFundo);
    tabela.appendChild(tbody);
    wrapper.appendChild(tabela);
    bloco.append(scrollTopo, wrapper);
    caixa.appendChild(bloco);

    renderizarJanelaVirtualMapa();
    ligarScrollHorizontalTopoMapa();
    requestAnimationFrame(atualizarScrollHorizontalTopoMapa);
}

function atualizarResultadosMapa() {
    mapasAtualizacaoPendente = 0;
    const termo = normalizarMapa(document.getElementById("fornecedor-pesquisa")?.value || "");
    const filtroStock = document.getElementById("mapas-filtro-stock")?.value || "todos";
    mapasResultados = mapasProdutos
        .filter(produto => produtoPassaPesquisaMapa(produto, termo))
        .filter(produto => produtoPassaFiltroStockMapa(produto, filtroStock))
        .sort(compararProdutosMapa);
    renderizarTabelaMapa();
}

function agendarAtualizacaoResultadosMapa() {
    clearTimeout(mapasAtualizacaoPendente);
    mapasAtualizacaoPendente = setTimeout(atualizarResultadosMapa, 90);
}

function valorCelulaCopiaMapa(produto, coluna) {
    if (coluna.chave === "foto") return "";
    if (coluna.chave === "preco" || coluna.chave === "preco_compra") {
        return `${formatarEuroMapa(produto[coluna.chave])} €`;
    }
    return String(valorCelulaMapa(produto, coluna) ?? "").trim();
}

function copiarListaMapaVisivel() {
    const produtos = mapasProdutosVisiveis || [];
    if (!produtos.length) {
        definirStatusMapa("Não há produtos visíveis para copiar.", true);
        return;
    }

    const colunas = obterColunasVisiveisMapa();
    const temPrecoVenda = colunas.some((coluna) => coluna.chave === "preco");
    const linhasProdutos = produtos.map((produto) =>
        colunas.map((coluna) => valorCelulaCopiaMapa(produto, coluna)).join("\t")
    );

    let texto = linhasProdutos.join("\n");
    if (temPrecoVenda) {
        const total = produtos.reduce((soma, produto) => soma + Number(produto.preco || 0), 0);
        const indicePreco = colunas.findIndex((coluna) => coluna.chave === "preco");
        const linhaTotal = colunas
            .map((coluna, indice) => {
                if (coluna.chave === "nome") return "Total";
                if (indice === indicePreco) return `${formatarEuroMapa(total)} €`;
                return "";
            })
            .join("\t");
        texto = [
            ...linhasProdutos,
            "",
            linhaTotal,
            "",
            "Acresce as despesas com portes de envio e manuseamento para pacote postal de acordo com a sua escolha."
        ].join("\n");
    }

    navigator.clipboard?.writeText(texto)
        .then(() => definirStatusMapa(`${produtos.length} produto(s) copiado(s).`))
        .catch(() => {
            const area = document.createElement("textarea");
            area.value = texto;
            area.classList.add("campo-copia-fora-ecran");
            document.body.appendChild(area);
            area.select();
            document.execCommand("copy");
            area.remove();
            definirStatusMapa(`${produtos.length} produto(s) copiado(s).`);
        });
}

async function carregarProdutosMapa() {
    const tamanhoPagina = 500;
    let produtos = [];
    let inicio = 0;
    let usarFallback = false;
    while (true) {
        const resposta = await mapasClient.rpc("listar_produtos_mapas_admin", { p_limite: tamanhoPagina, p_offset: inicio });
        if (resposta.error) {
            usarFallback = true;
            break;
        }
        const pagina = Array.isArray(resposta.data) ? resposta.data : [];
        // RPC antiga sem imagens/observacoes → usar listagem completa admin
        if (inicio === 0 && pagina.length && !Object.prototype.hasOwnProperty.call(pagina[0], "imagens")) {
            usarFallback = true;
            break;
        }
        produtos.push(...pagina);
        if (pagina.length < tamanhoPagina) break;
        inicio += tamanhoPagina;
    }
    if (usarFallback) {
        produtos = [];
        inicio = 0;
        while (true) {
            const resposta = await mapasClient.rpc("listar_produtos_admin", { p_limite: tamanhoPagina, p_offset: inicio });
            if (resposta.error) throw resposta.error;
            const pagina = Array.isArray(resposta.data) ? resposta.data : [];
            produtos.push(...pagina);
            if (pagina.length < tamanhoPagina) break;
            inicio += tamanhoPagina;
        }
    }
    mapasProdutos = produtos.map(normalizarProdutoMapa);
    sincronizarEstadoImportacaoMapa();
}

function sincronizarEstadoImportacaoMapa() {
    window.dbClient = mapasClient;
    window.todosOsProdutos = mapasProdutos;
}

async function carregarProdutosAdminDaNuvem() {
    await carregarProdutosMapa();
    sincronizarEstadoImportacaoMapa();
    atualizarResultadosMapa();
}
window.carregarProdutosAdminDaNuvem = carregarProdutosAdminDaNuvem;

let scriptImportacaoMapasCarregado = false;
let promessaScriptImportacaoMapas = null;

function garantirScriptImportacaoMapas() {
    if (typeof analisarFicheiroCatalogoAdmin === "function") {
        scriptImportacaoMapasCarregado = true;
        return Promise.resolve();
    }
    if (promessaScriptImportacaoMapas) return promessaScriptImportacaoMapas;

    promessaScriptImportacaoMapas = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "gestao-importacao.js?v=20260720-novidade-novos";
        script.onload = () => {
            scriptImportacaoMapasCarregado = true;
            resolve();
        };
        script.onerror = () => reject(new Error("Falha ao carregar importação administrativa."));
        document.body.appendChild(script);
    });
    return promessaScriptImportacaoMapas;
}

function prefetchBibliotecaSheetJsMapas() {
    const url = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    if (document.querySelector(`link[rel="prefetch"][href="${url}"]`)) return;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = url;
    link.as = "script";
    document.head.appendChild(link);
}

function ligarElementoImportacaoMapa(id, evento, handler) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.addEventListener(evento, handler);
}

function ligarImportacaoMapas() {
    ligarElementoImportacaoMapa("admin-ficheiro-stock", "change", function () {
        sincronizarEstadoImportacaoMapa();
        garantirScriptImportacaoMapas().then(() => {
            if (typeof analisarFicheiroStockAdmin === "function") analisarFicheiroStockAdmin(this);
        }).catch(console.error);
    });
    ligarElementoImportacaoMapa("btn-confirmar-importacao-stock", "click", () => {
        sincronizarEstadoImportacaoMapa();
        garantirScriptImportacaoMapas().then(() => {
            if (typeof confirmarImportacaoStockAdmin === "function") confirmarImportacaoStockAdmin();
        }).catch(console.error);
    });
    ligarElementoImportacaoMapa("admin-ficheiro-catalogo-sem-stock", "change", function () {
        sincronizarEstadoImportacaoMapa();
        garantirScriptImportacaoMapas().then(() => {
            if (typeof analisarFicheiroCatalogoSemStockAdmin === "function") analisarFicheiroCatalogoSemStockAdmin(this);
        }).catch(console.error);
    });
    ligarElementoImportacaoMapa("btn-confirmar-importacao-catalogo-sem-stock", "click", () => {
        sincronizarEstadoImportacaoMapa();
        garantirScriptImportacaoMapas().then(() => {
            if (typeof confirmarImportacaoCatalogoSemStockAdmin === "function") confirmarImportacaoCatalogoSemStockAdmin();
        }).catch(console.error);
    });
    ligarElementoImportacaoMapa("admin-ficheiro-catalogo", "change", function () {
        sincronizarEstadoImportacaoMapa();
        garantirScriptImportacaoMapas().then(() => {
            if (typeof analisarFicheiroCatalogoAdmin === "function") analisarFicheiroCatalogoAdmin(this);
        }).catch(console.error);
    });
    ligarElementoImportacaoMapa("confirmacao-substituir-catalogo", "input", () => {
        garantirScriptImportacaoMapas().then(() => {
            if (typeof atualizarConfirmacaoCatalogoAdmin === "function") atualizarConfirmacaoCatalogoAdmin();
        }).catch(console.error);
    });
    ligarElementoImportacaoMapa("btn-confirmar-importacao-catalogo", "click", () => {
        sincronizarEstadoImportacaoMapa();
        garantirScriptImportacaoMapas().then(() => {
            if (typeof confirmarImportacaoCatalogoAdmin === "function") confirmarImportacaoCatalogoAdmin();
        }).catch(console.error);
    });

    document.getElementById("mapas-painel-importacao")?.addEventListener("toggle", (evento) => {
        if (evento.target.open) prefetchBibliotecaSheetJsMapas();
    });
}

async function iniciarMapas() {
    try {
        await window.carregarScriptSupabase();
        if (typeof supabase === "undefined") throw new Error("A biblioteca Supabase nao carregou.");
        mapasClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data: { user }, error } = await mapasClient.auth.getUser();
        if (error || !user || !ADMIN_EMAILS.includes(String(user.email || "").toLowerCase())) {
            document.getElementById("fornecedores-bloqueio").textContent = "Acesso reservado ao administrador.";
            return;
        }
        mostrarNavegacaoAdminValidada();
        document.getElementById("fornecedores-bloqueio").hidden = true;
        document.getElementById("fornecedores-aplicacao").hidden = false;
        carregarPreferenciasColunasMapa();
        montarPainelColunasMapa();
        ligarImportacaoMapas();
        const prefetchModal = function () { garantirMapasProdutoModal().catch(function () {}); };
        if ("requestIdleCallback" in window) window.requestIdleCallback(prefetchModal, { timeout: 4000 });
        else window.setTimeout(prefetchModal, 1500);
        sincronizarEstadoImportacaoMapa();
        definirStatusMapa("A carregar mapas...");
        await carregarProdutosMapa();
        atualizarResultadosMapa();
        definirStatusMapa("");
    } catch (erro) {
        console.error(erro);
        definirStatusMapa("Erro: " + (erro.message || "não foi possível carregar a página Mapas."), true);
    }
}

document.getElementById("fornecedor-pesquisa")?.addEventListener("input", agendarAtualizacaoResultadosMapa);
document.getElementById("mapas-filtro-stock")?.addEventListener("change", atualizarResultadosMapa);
document.getElementById("mapas-criar-produto")?.addEventListener("click", abrirCriacaoProdutoMapa);
document.getElementById("mapas-copiar-lista")?.addEventListener("click", copiarListaMapaVisivel);
document.addEventListener("click", (evento) => {
    ["mapas-colunas-painel", "mapas-painel-importacao"].forEach((id) => {
        const painel = document.getElementById(id);
        if (!painel?.open) return;
        if (painel.contains(evento.target)) return;
        painel.open = false;
    });
});
window.addEventListener("scroll", agendarRenderVirtualMapa, { passive: true });
window.addEventListener("resize", () => {
    agendarRenderVirtualMapa();
    atualizarScrollHorizontalTopoMapa();
});
document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") fecharEdicaoProdutoMapa();
});

iniciarMapas();
