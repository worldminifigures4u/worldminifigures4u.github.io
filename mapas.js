
const MAPAS_COLUNAS = [
    { chave: "foto", rotulo: "foto", classe: "mapas-col-foto", semOrdenacao: true, largura: 53 },
    { chave: "nome", rotulo: "nome", classe: "mapas-col-nome", obrigatorio: true, largura: 280 },
    { chave: "referencia", rotulo: "referência", classe: "mapas-col-ref", largura: 110 },
    { chave: "stock", rotulo: "stock", classe: "mapas-col-stock", numero: true, largura: 72 },
    { chave: "tema", rotulo: "tema", classe: "mapas-col-tema", largura: 150 },
    { chave: "subtema", rotulo: "subtema", classe: "mapas-col-subtema", largura: 170 },
    { chave: "preco_compra", rotulo: "preço compra", classe: "mapas-col-preco", numero: true, dinheiro: true, largura: 110 },
    { chave: "preco", rotulo: "preço venda", classe: "mapas-col-preco", numero: true, dinheiro: true, largura: 100 },
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

let mapasClient = null;
let mapasProdutos = [];
let mapasResultados = [];
let mapasProdutosVisiveis = [];
let mapasOrdenacao = { coluna: "nome", direcao: "asc" };
let mapasLinhaAltura = 46;
let mapasRenderPendente = 0;
let mapasAtualizacaoPendente = 0;
let mapasColunasVisiveis = new Set(MAPAS_COLUNAS.map((coluna) => coluna.chave));
let folhaDinamicaMapas = null;
let mapasEncomendasFornecedorCache = null;
let mapasEncomendasFornecedorPromessa = null;
let mapasVendasClienteCache = null;
let mapasVendasClientePromessa = null;
const MAPAS_FORNECEDORES_STORAGE_KEY = "figures-planet-fornecedores-pedidos";

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
        stock: Math.max(0, Number(produto.stock || 0)),
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
    const totalStock = resultados.reduce((acc, produto) => acc + Math.max(0, Number(produto.stock || 0)), 0);
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
            td.textContent = valorCelulaMapa(produto, coluna);
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
    caixa.appendChild(wrapper);

    renderizarJanelaVirtualMapa();
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

function criarInputEdicaoMapa(form, id, rotulo, valor, tipo = "text", opcoes = {}) {
    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.className = opcoes.largo ? "mapas-produto-campo mapas-produto-campo-largo" : "mapas-produto-campo";
    label.textContent = rotulo;
    const input = document.createElement("input");
    input.id = id;
    input.name = id;
    input.type = tipo;
    input.value = valor ?? "";
    if (opcoes.required) input.required = true;
    if (opcoes.min !== undefined) input.min = String(opcoes.min);
    if (opcoes.step !== undefined) input.step = String(opcoes.step);
    label.appendChild(input);
    form.appendChild(label);
    return input;
}

function criarTextareaEdicaoMapa(form, id, rotulo, valor, opcoes = {}) {
    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.className = opcoes.largo ? "mapas-produto-campo mapas-produto-campo-largo" : "mapas-produto-campo";
    label.textContent = rotulo;
    const area = document.createElement("textarea");
    area.id = id;
    area.name = id;
    area.rows = opcoes.rows || 4;
    area.placeholder = opcoes.placeholder || "";
    area.value = valor ?? "";
    label.appendChild(area);
    form.appendChild(label);
    return area;
}

const MAPAS_UPLOAD_IMAGEM_MAX_BYTES = 8 * 1024 * 1024;
const MAPAS_UPLOAD_IMAGEM_TIPOS = new Set(["image/jpeg", "image/png", "image/webp"]);

function obterUrlsImagensEdicaoMapa() {
    const textarea = document.getElementById("mapas-editar-imagens");
    if (!textarea) return [];
    return textarea.value
        .split(/[\n,]+/)
        .map((url) => url.trim())
        .filter(Boolean);
}

function reordenarUrlsImagensMapa(origem, destino) {
    const textarea = document.getElementById("mapas-editar-imagens");
    if (!textarea || origem === destino || origem < 0 || destino < 0) return;
    const urls = obterUrlsImagensEdicaoMapa();
    if (origem >= urls.length || destino >= urls.length) return;
    const [movido] = urls.splice(origem, 1);
    urls.splice(destino, 0, movido);
    textarea.value = urls.join("\n");
    atualizarPreviewImagensEdicaoMapa();
}

function atualizarPreviewImagensEdicaoMapa() {
    const preview = document.getElementById("mapas-editar-preview-imagens");
    if (!preview) return;
    const urls = obterUrlsImagensEdicaoMapa();
    preview.replaceChildren();
    const otimizar = typeof otimizarImagemCloudinary === "function"
        ? otimizarImagemCloudinary
        : (url) => url;

    urls.slice(0, 12).forEach((url, index) => {
        const item = document.createElement("div");
        item.className = "item-preview-imagem-admin";
        item.draggable = true;
        item.dataset.indiceImagem = String(index);
        item.title = "Arraste para alterar a ordem";

        const imagem = document.createElement("img");
        imagem.src = otimizar(url, 360);
        imagem.alt = `Imagem ${index + 1}`;
        imagem.loading = "lazy";
        imagem.onerror = () => item.classList.add("oculto");
        item.appendChild(imagem);

        if (index === 0) {
            const etiqueta = document.createElement("span");
            etiqueta.className = "etiqueta-imagem-principal";
            etiqueta.textContent = "Principal";
            item.appendChild(etiqueta);
        }

        item.addEventListener("dragstart", (evento) => {
            item.classList.add("arrastando");
            evento.dataTransfer.effectAllowed = "move";
            evento.dataTransfer.setData("text/plain", String(index));
        });
        item.addEventListener("dragend", () => {
            preview.querySelectorAll(".item-preview-imagem-admin").forEach((elemento) => {
                elemento.classList.remove("arrastando", "destino-arrasto");
            });
        });
        item.addEventListener("dragover", (evento) => {
            evento.preventDefault();
            evento.dataTransfer.dropEffect = "move";
            preview.querySelectorAll(".destino-arrasto").forEach((elemento) => elemento.classList.remove("destino-arrasto"));
            item.classList.add("destino-arrasto");
        });
        item.addEventListener("drop", (evento) => {
            evento.preventDefault();
            const origem = Number(evento.dataTransfer.getData("text/plain"));
            reordenarUrlsImagensMapa(origem, index);
        });

        preview.appendChild(item);
    });
}

function adicionarUrlsImagensEdicaoMapa(urls) {
    const textarea = document.getElementById("mapas-editar-imagens");
    if (!textarea || !urls.length) return;
    const atuais = obterUrlsImagensEdicaoMapa();
    urls.forEach((url) => {
        if (!atuais.includes(url)) atuais.push(url);
    });
    textarea.value = atuais.join("\n");
    atualizarPreviewImagensEdicaoMapa();
}

async function obterAssinaturaCloudinaryMapa() {
    const { data: { session }, error: sessionError } = await mapasClient.auth.getSession();
    if (sessionError || !session?.access_token) {
        throw new Error("Sessão de administrador obrigatória para enviar fotos.");
    }
    const resposta = await fetch(`${SUPABASE_URL}/functions/v1/cloudinary-sign-upload`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_KEY
        },
        body: JSON.stringify({ origem: "mapas-produtos" })
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados?.error || "Não foi possível obter assinatura segura do Cloudinary.");
    if (!dados?.cloudName || !dados?.apiKey || !dados?.timestamp || !dados?.signature) {
        throw new Error("Assinatura Cloudinary incompleta.");
    }
    return dados;
}

async function enviarFicheiroCloudinaryMapa(ficheiro) {
    const assinatura = await obterAssinaturaCloudinaryMapa();
    const formData = new FormData();
    formData.append("file", ficheiro);
    formData.append("api_key", assinatura.apiKey);
    formData.append("timestamp", String(assinatura.timestamp));
    formData.append("signature", assinatura.signature);
    if (assinatura.folder) formData.append("folder", assinatura.folder);
    if (assinatura.eager) formData.append("eager", assinatura.eager);

    const resposta = await fetch(`https://api.cloudinary.com/v1_1/${assinatura.cloudName}/image/upload`, {
        method: "POST",
        body: formData
    });
    const resultado = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(resultado?.error?.message || "Falha no upload assinado para o Cloudinary.");
    if (!resultado?.secure_url) throw new Error("O Cloudinary não devolveu URL seguro da imagem.");
    return resultado.eager?.[0]?.secure_url || resultado.secure_url;
}

async function enviarFotosCloudinaryMapa(input) {
    const status = document.getElementById("mapas-editar-upload-status");
    const ficheiros = Array.from(input.files || []);
    if (!ficheiros.length) return;
    try {
        const { data: { user }, error: authError } = await mapasClient.auth.getUser();
        if (authError || !user || !ADMIN_EMAILS.includes(String(user.email || "").toLowerCase())) {
            throw new Error("Apenas o administrador pode enviar fotos.");
        }
        if (status) {
            status.textContent = `A enviar ${ficheiros.length} foto(s)...`;
            status.classList.remove("status-erro", "status-sucesso");
            status.classList.add("status-aviso");
        }
        const urls = [];
        for (const ficheiro of ficheiros) {
            if (!MAPAS_UPLOAD_IMAGEM_TIPOS.has(ficheiro.type)) {
                throw new Error("Só pode enviar imagens JPG, PNG ou WebP.");
            }
            if (ficheiro.size > MAPAS_UPLOAD_IMAGEM_MAX_BYTES) {
                throw new Error("Cada imagem pode ter no máximo 8 MB.");
            }
            urls.push(await enviarFicheiroCloudinaryMapa(ficheiro));
            if (status) status.textContent = `Enviadas ${urls.length}/${ficheiros.length} foto(s)...`;
        }
        adicionarUrlsImagensEdicaoMapa(urls);
        input.value = "";
        if (status) {
            status.textContent = `${urls.length} foto(s) adicionada(s). Guarde o produto para confirmar.`;
            status.classList.remove("status-aviso", "status-erro");
            status.classList.add("status-sucesso");
        }
    } catch (erro) {
        console.error(erro);
        if (status) {
            status.textContent = "Erro: " + (erro.message || "Não foi possível enviar as fotos.");
            status.classList.remove("status-aviso", "status-sucesso");
            status.classList.add("status-erro");
        }
    }
}

function montarSecaoMediaEdicaoMapa(campos, produto) {
    const secaoObs = criarSecaoEdicaoMapa("Observações", "mapas-produto-secao-media mapas-produto-secao-observacoes");
    criarTextareaEdicaoMapa(
        secaoObs,
        "mapas-editar-observacoes",
        "",
        produto.observacoes || "",
        { largo: true, rows: 3, placeholder: "Notas internas sobre estado, acessórios, origem, etc." }
    );
    campos.appendChild(secaoObs);

    const secaoFotos = criarSecaoEdicaoMapa("Fotos", "mapas-produto-secao-media mapas-produto-secao-fotos");

    const blocoUpload = document.createElement("div");
    blocoUpload.className = "mapas-produto-campo mapas-produto-campo-largo mapas-produto-upload-bloco";
    const ajuda = document.createElement("p");
    ajuda.className = "mapas-produto-ajuda-media";
    ajuda.textContent = "Envie JPG, PNG ou WebP. Arraste as miniaturas para definir a foto principal.";
    const inputUpload = document.createElement("input");
    inputUpload.className = "input-upload-admin";
    inputUpload.type = "file";
    inputUpload.id = "mapas-editar-upload-imagens";
    inputUpload.accept = "image/jpeg,image/png,image/webp";
    inputUpload.multiple = true;
    inputUpload.addEventListener("change", () => enviarFotosCloudinaryMapa(inputUpload));
    const statusUpload = document.createElement("p");
    statusUpload.id = "mapas-editar-upload-status";
    statusUpload.className = "mapas-produto-upload-status";
    statusUpload.setAttribute("role", "status");
    blocoUpload.append(ajuda, inputUpload, statusUpload);
    secaoFotos.appendChild(blocoUpload);

    criarTextareaEdicaoMapa(
        secaoFotos,
        "mapas-editar-imagens",
        "URLs das imagens",
        normalizarImagensMapa(produto.imagens).join("\n"),
        { largo: true, rows: 4, placeholder: "Um URL por linha" }
    );
    document.getElementById("mapas-editar-imagens")?.addEventListener("input", atualizarPreviewImagensEdicaoMapa);

    const preview = document.createElement("div");
    preview.id = "mapas-editar-preview-imagens";
    preview.className = "preview-imagens-admin mapas-produto-preview-imagens";
    secaoFotos.appendChild(preview);
    campos.appendChild(secaoFotos);

    atualizarPreviewImagensEdicaoMapa();
}

async function enriquecerMediaProdutoMapa(produto) {
    const atual = {
        ...produto,
        imagens: normalizarImagensMapa(produto.imagens),
        observacoes: String(produto.observacoes || "")
    };
    if (atual.imagens.length) return atual;

    try {
        const { data, error } = await mapasClient.rpc("obter_imagens_produtos_encomendas_admin", {
            p_ids: [String(produto.id)]
        });
        if (error) return atual;
        const lista = Array.isArray(data) ? data : [];
        const entrada = lista.find((item) =>
            String(item.id) === String(produto.id)
            || String(item.sku || "").toUpperCase() === String(produto.sku || "").toUpperCase()
        ) || lista[0];
        if (entrada?.imagens) atual.imagens = normalizarImagensMapa(entrada.imagens);
    } catch (_erro) {
        // Mantém o que já temos se o RPC falhar
    }
    return atual;
}

function produtoCorrespondeItemRececaoMapa(produto, item) {
    if (!produto || !item) return false;
    const produtoId = String(produto.id || "").trim();
    const itemId = String(item.id || item.id_produto || item.produto_id || "").trim();
    const produtoSku = String(produto.sku || "").trim().toUpperCase();
    const itemSku = String(item.sku || "").trim().toUpperCase();
    const produtoRef = String(produto.referencia || "").trim().toUpperCase();
    const itemRef = String(item.referencia || "").trim().toUpperCase();
    return Boolean(
        (produtoId && itemId && produtoId === itemId)
        || (produtoSku && itemSku && produtoSku === itemSku)
        || (produtoRef && itemRef && produtoRef === itemRef)
    );
}

function normalizarPedidoRececaoMapa(pedido) {
    if (!pedido) return null;
    let itens = pedido.itens;
    if (typeof itens === "string") {
        try { itens = JSON.parse(itens); }
        catch (_) { itens = []; }
    }
    return {
        id: pedido.id || "",
        codigo: pedido.codigo || "",
        fornecedor: pedido.fornecedor || "",
        referencia: pedido.referencia || "",
        estado: pedido.estado || "",
        criado_em: pedido.criado_em || pedido.data || pedido.created_at || "",
        atualizado_em: pedido.atualizado_em || pedido.updated_at || "",
        itens: Array.isArray(itens) ? itens : []
    };
}

function obterEncomendasFornecedorLocaisMapa() {
    try {
        const dados = JSON.parse(localStorage.getItem(MAPAS_FORNECEDORES_STORAGE_KEY) || "[]");
        return Array.isArray(dados) ? dados.map(normalizarPedidoRececaoMapa).filter(Boolean) : [];
    } catch (_) {
        return [];
    }
}

async function carregarEncomendasFornecedorMapa(forcar = false) {
    if (!forcar && Array.isArray(mapasEncomendasFornecedorCache)) {
        return mapasEncomendasFornecedorCache;
    }
    if (!forcar && mapasEncomendasFornecedorPromessa) {
        return mapasEncomendasFornecedorPromessa;
    }

    mapasEncomendasFornecedorPromessa = (async () => {
        try {
            if (!mapasClient) throw new Error("Supabase indisponível.");
            const rpc = await mapasClient.rpc("listar_encomendas_fornecedores_admin");
            if (!rpc.error && Array.isArray(rpc.data)) {
                mapasEncomendasFornecedorCache = rpc.data.map(normalizarPedidoRececaoMapa).filter(Boolean);
                return mapasEncomendasFornecedorCache;
            }
            const { data, error } = await mapasClient
                .from("encomendas_fornecedores")
                .select("id,codigo,fornecedor,referencia,estado,criado_em,atualizado_em,itens")
                .order("criado_em", { ascending: false })
                .limit(500);
            if (error) throw error;
            mapasEncomendasFornecedorCache = (data || []).map(normalizarPedidoRececaoMapa).filter(Boolean);
            return mapasEncomendasFornecedorCache;
        } catch (erro) {
            console.warn("Não foi possível carregar encomendas a fornecedor; a usar cópia local.", erro);
            mapasEncomendasFornecedorCache = obterEncomendasFornecedorLocaisMapa();
            return mapasEncomendasFornecedorCache;
        } finally {
            mapasEncomendasFornecedorPromessa = null;
        }
    })();

    return mapasEncomendasFornecedorPromessa;
}

function obterLinhasRececaoProdutoMapa(produto, pedidos) {
    const linhas = [];
    (pedidos || []).forEach((pedido) => {
        (pedido.itens || []).forEach((item) => {
            if (!produtoCorrespondeItemRececaoMapa(produto, item)) return;
            const recebido = Math.max(0, Math.floor(Number(item.recebido || 0)));
            if (recebido <= 0) return;
            linhas.push({ pedido, item, recebido });
        });
    });
    linhas.sort((a, b) => {
        const dataA = Date.parse(a.pedido.atualizado_em || a.pedido.criado_em || 0) || 0;
        const dataB = Date.parse(b.pedido.atualizado_em || b.pedido.criado_em || 0) || 0;
        return dataB - dataA;
    });
    return linhas;
}

function formatarDataRececaoMapa(pedido) {
    const bruto = pedido?.atualizado_em || pedido?.criado_em || "";
    if (!bruto) return "—";
    const data = new Date(bruto);
    return Number.isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pt-PT");
}

function renderizarHistoricoRececoesMapa(conteudo, produto, pedidos) {
    if (!conteudo) return;
    const linhas = obterLinhasRececaoProdutoMapa(produto, pedidos);
    conteudo.replaceChildren();

    if (!linhas.length) {
        const vazio = document.createElement("p");
        vazio.className = "mapas-produto-ajuda-media";
        vazio.textContent = "Ainda não há receções desta figura em encomendas a fornecedores.";
        conteudo.appendChild(vazio);
        return;
    }

    const tabela = document.createElement("table");
    tabela.className = "mapas-produto-historico-rececoes-tabela";
    const thead = document.createElement("thead");
    const linhaCabecalho = document.createElement("tr");
    ["Data", "Encomenda", "Fornecedor", "Pedido", "Recebido", "Estado"].forEach((rotulo) => {
        const th = document.createElement("th");
        th.textContent = rotulo;
        linhaCabecalho.appendChild(th);
    });
    thead.appendChild(linhaCabecalho);

    const tbody = document.createElement("tbody");
    linhas.forEach(({ pedido, item, recebido }) => {
        const tr = document.createElement("tr");
        const pedidoQtd = Math.max(0, Math.floor(Number(
            item.quantidade_original ?? item.quantidade ?? item.qtd ?? 0
        )));
        [
            formatarDataRececaoMapa(pedido),
            pedido.codigo || pedido.referencia || "—",
            pedido.fornecedor || "—",
            String(pedidoQtd || "—"),
            String(recebido),
            pedido.estado || "—"
        ].forEach((valor) => {
            const td = document.createElement("td");
            td.textContent = valor;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    tabela.append(thead, tbody);
    conteudo.appendChild(tabela);

    const totalRecebido = linhas.reduce((soma, linha) => soma + linha.recebido, 0);
    const resumo = document.createElement("p");
    resumo.className = "mapas-produto-ajuda-media";
    resumo.textContent = `${linhas.length} encomenda(s) · ${totalRecebido} unidade(s) recebida(s)`;
    conteudo.appendChild(resumo);
}

function montarSecaoHistoricoRececoesMapa(campos, produto) {
    const secao = criarSecaoEdicaoMapa("Histórico de receções", "mapas-produto-secao-media mapas-produto-secao-historico");
    const ajuda = document.createElement("p");
    ajuda.className = "mapas-produto-ajuda-media";
    ajuda.textContent = "Encomendas a fornecedores em que esta figura já foi recebida.";
    const conteudo = document.createElement("div");
    conteudo.className = "mapas-produto-historico-rececoes";
    conteudo.id = "mapas-produto-historico-rececoes";
    conteudo.dataset.produtoId = String(produto.id || "");
    const loading = document.createElement("p");
    loading.className = "mapas-produto-ajuda-media";
    loading.textContent = "A carregar histórico...";
    conteudo.appendChild(loading);
    secao.append(ajuda, conteudo);
    campos.appendChild(secao);

    const produtoId = String(produto.id || "");
    carregarEncomendasFornecedorMapa().then((pedidos) => {
        if (conteudo.dataset.produtoId !== produtoId) return;
        renderizarHistoricoRececoesMapa(conteudo, produto, pedidos);
    });
}

function obterProdutosEncomendaClienteMapa(encomenda) {
    let produtos = encomenda?.produtos || encomenda?.artigos || [];
    if (typeof produtos === "string") {
        try { produtos = JSON.parse(produtos); }
        catch (_) { produtos = []; }
    }
    return Array.isArray(produtos) ? produtos : [];
}

function obterQuantidadeItemVendaMapa(item) {
    return Math.max(1, Math.floor(Number(item?.quantidade ?? item?.qtd ?? 1) || 1));
}

function obterPrecoItemVendaMapa(item) {
    return Number(item?.preco_unitario ?? item?.preco ?? item?.valor_unitario ?? 0) || 0;
}

function normalizarEncomendaClienteMapa(encomenda) {
    if (!encomenda) return null;
    return {
        id: encomenda.id || "",
        codigo: encomenda.codigo_encomenda || encomenda.codigo || "",
        cliente: encomenda.nome_cliente || "",
        origem: encomenda.origem || "Site",
        estado: encomenda.estado || "",
        criado_em: encomenda.created_at || encomenda.criado_em || "",
        produtos: obterProdutosEncomendaClienteMapa(encomenda)
    };
}

async function carregarVendasClienteMapa(forcar = false) {
    if (!forcar && Array.isArray(mapasVendasClienteCache)) {
        return mapasVendasClienteCache;
    }
    if (!forcar && mapasVendasClientePromessa) {
        return mapasVendasClientePromessa;
    }

    mapasVendasClientePromessa = (async () => {
        try {
            if (!mapasClient) throw new Error("Supabase indisponível.");
            const { data, error } = await mapasClient
                .from("encomendas")
                .select("id,codigo_encomenda,nome_cliente,origem,estado,created_at,produtos")
                .order("created_at", { ascending: false })
                .limit(1000);
            if (error) throw error;
            mapasVendasClienteCache = (data || []).map(normalizarEncomendaClienteMapa).filter(Boolean);
            return mapasVendasClienteCache;
        } catch (erro) {
            console.warn("Não foi possível carregar histórico de vendas.", erro);
            mapasVendasClienteCache = [];
            return mapasVendasClienteCache;
        } finally {
            mapasVendasClientePromessa = null;
        }
    })();

    return mapasVendasClientePromessa;
}

function obterLinhasVendaProdutoMapa(produto, encomendas) {
    const linhas = [];
    (encomendas || []).forEach((encomenda) => {
        const itens = (encomenda.produtos || []).filter((item) =>
            produtoCorrespondeItemRececaoMapa(produto, item)
        );
        if (!itens.length) return;
        const quantidade = itens.reduce((total, item) => total + obterQuantidadeItemVendaMapa(item), 0);
        const subtotal = itens.reduce(
            (total, item) => total + (obterQuantidadeItemVendaMapa(item) * obterPrecoItemVendaMapa(item)),
            0
        );
        linhas.push({ encomenda, itens, quantidade, subtotal });
    });
    linhas.sort((a, b) => {
        const dataA = Date.parse(a.encomenda.criado_em || 0) || 0;
        const dataB = Date.parse(b.encomenda.criado_em || 0) || 0;
        return dataB - dataA;
    });
    return linhas;
}

function formatarDataVendaMapa(encomenda) {
    const bruto = encomenda?.criado_em || "";
    if (!bruto) return "—";
    const data = new Date(bruto);
    return Number.isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pt-PT");
}

function renderizarHistoricoVendasMapa(conteudo, produto, encomendas) {
    if (!conteudo) return;
    const linhas = obterLinhasVendaProdutoMapa(produto, encomendas);
    conteudo.replaceChildren();

    if (!linhas.length) {
        const vazio = document.createElement("p");
        vazio.className = "mapas-produto-ajuda-media";
        vazio.textContent = "Ainda não há vendas desta figura em encomendas de clientes.";
        conteudo.appendChild(vazio);
        return;
    }

    const tabela = document.createElement("table");
    tabela.className = "mapas-produto-historico-rececoes-tabela";
    const thead = document.createElement("thead");
    const linhaCabecalho = document.createElement("tr");
    ["Data", "Encomenda", "Cliente", "Origem", "Qtd.", "Total", "Estado"].forEach((rotulo) => {
        const th = document.createElement("th");
        th.textContent = rotulo;
        linhaCabecalho.appendChild(th);
    });
    thead.appendChild(linhaCabecalho);

    const tbody = document.createElement("tbody");
    linhas.forEach(({ encomenda, quantidade, subtotal }) => {
        const tr = document.createElement("tr");
        [
            formatarDataVendaMapa(encomenda),
            encomenda.codigo || (encomenda.id ? `#${encomenda.id}` : "—"),
            encomenda.cliente || "—",
            encomenda.origem || "Site",
            String(quantidade),
            `${formatarEuroMapa(subtotal)} €`,
            encomenda.estado || "—"
        ].forEach((valor) => {
            const td = document.createElement("td");
            td.textContent = valor;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    tabela.append(thead, tbody);
    conteudo.appendChild(tabela);

    const totalUnidades = linhas.reduce((soma, linha) => soma + linha.quantidade, 0);
    const resumo = document.createElement("p");
    resumo.className = "mapas-produto-ajuda-media";
    resumo.textContent = `${linhas.length} encomenda(s) · ${totalUnidades} unidade(s) vendida(s)`;
    conteudo.appendChild(resumo);
}

function montarSecaoHistoricoVendasMapa(campos, produto) {
    const secao = criarSecaoEdicaoMapa("Histórico de vendas", "mapas-produto-secao-media mapas-produto-secao-historico");
    const ajuda = document.createElement("p");
    ajuda.className = "mapas-produto-ajuda-media";
    ajuda.textContent = "Encomendas de clientes em que esta figura saiu.";
    const conteudo = document.createElement("div");
    conteudo.className = "mapas-produto-historico-vendas";
    conteudo.id = "mapas-produto-historico-vendas";
    conteudo.dataset.produtoId = String(produto.id || "");
    const loading = document.createElement("p");
    loading.className = "mapas-produto-ajuda-media";
    loading.textContent = "A carregar histórico...";
    conteudo.appendChild(loading);
    secao.append(ajuda, conteudo);
    campos.appendChild(secao);

    const produtoId = String(produto.id || "");
    carregarVendasClienteMapa().then((encomendas) => {
        if (conteudo.dataset.produtoId !== produtoId) return;
        renderizarHistoricoVendasMapa(conteudo, produto, encomendas);
    });
}

function criarCampoLeituraMapa(secao, rotulo, valor, opcoes = {}) {
    const bloco = document.createElement("div");
    bloco.className = `mapas-produto-campo mapas-produto-leitura${opcoes.largo ? " mapas-produto-campo-largo" : ""}`;
    const etiqueta = document.createElement("span");
    etiqueta.className = "mapas-produto-leitura-rotulo";
    etiqueta.textContent = rotulo;
    const texto = document.createElement("strong");
    texto.className = "mapas-produto-leitura-valor";
    const conteudo = valor === null || valor === undefined || String(valor).trim() === "" ? "—" : String(valor);
    texto.textContent = conteudo;
    if (opcoes.classeValor) texto.classList.add(opcoes.classeValor);
    bloco.append(etiqueta, texto);
    secao.appendChild(bloco);
    return bloco;
}

function criarBadgeLeituraMapa(secao, rotulo, ativo) {
    const badge = document.createElement("span");
    badge.className = `mapas-produto-leitura-badge${ativo ? " ativo" : ""}`;
    badge.textContent = rotulo;
    secao.appendChild(badge);
    return badge;
}

function montarSecaoMediaLeituraMapa(campos, produto) {
    const observacoes = String(produto.observacoes || "").trim();
    if (!observacoes) return;

    const secao = criarSecaoEdicaoMapa("Observações", "mapas-produto-secao-media");
    const texto = document.createElement("p");
    texto.className = "mapas-produto-observacoes-leitura";
    texto.textContent = observacoes;
    secao.appendChild(texto);
    campos.appendChild(secao);
}

function criarFotoPrincipalFichaMapa(produto) {
    const imagens = normalizarImagensMapa(produto.imagens);
    const figura = document.createElement("figure");
    figura.className = "mapas-produto-foto-principal";
    if (imagens.length) {
        const img = document.createElement("img");
        img.src = imagens[0];
        img.alt = produto.nome || "Foto principal";
        figura.appendChild(img);
    } else {
        const vazio = document.createElement("span");
        vazio.className = "mapas-produto-foto-principal-vazia";
        vazio.textContent = "Sem foto";
        figura.appendChild(vazio);
    }
    return figura;
}

function preencherFichaProdutoMapa(produto) {
    const modal = garantirModalEdicaoProdutoMapa();
    const campos = modal.querySelector("#mapas-produto-form-campos");
    const status = modal.querySelector("#mapas-produto-status");
    const titulo = modal.querySelector("#mapas-produto-modal-titulo");
    campos.replaceChildren();
    if (status) status.textContent = "";
    modal.querySelector("#mapas-produto-modo").value = "ver";
    modal.querySelector("#mapas-editar-id").value = String(produto.id || "");
    modal.querySelector("#mapas-editar-sku-original").value = String(produto.sku || "");
    modal.dataset.produtoId = String(produto.id || "");
    if (titulo) titulo.textContent = produto.nome || "Ficha do produto";
    atualizarAcoesModalProdutoMapa("ver");

    const topo = document.createElement("div");
    topo.className = "mapas-produto-ficha-topo";
    topo.appendChild(criarFotoPrincipalFichaMapa(produto));

    const secaoIdentificacao = criarSecaoEdicaoMapa("Identificação", "mapas-produto-secao-identificacao");
    criarCampoLeituraMapa(secaoIdentificacao, "Ref.", produto.referencia || "");
    criarCampoLeituraMapa(secaoIdentificacao, "SKU", produto.sku || "");
    criarCampoLeituraMapa(secaoIdentificacao, "Tema", produto.tema || "");
    criarCampoLeituraMapa(secaoIdentificacao, "Subtema", produto.subtema === "semsubtema" ? "" : (produto.subtema || ""));
    topo.appendChild(secaoIdentificacao);

    const secaoDetalhes = criarSecaoEdicaoMapa("Detalhes", "mapas-produto-secao-detalhes");
    criarCampoLeituraMapa(
        secaoDetalhes,
        "Stock",
        Number(produto.stock || 0),
        { classeValor: Number(produto.stock || 0) <= 0 ? "sem-stock" : "" }
    );
    criarCampoLeituraMapa(secaoDetalhes, "preço compra", `${formatarEuroMapa(produto.preco_compra)} €`);
    criarCampoLeituraMapa(secaoDetalhes, "preço venda", `${formatarEuroMapa(produto.preco)} €`);
    criarCampoLeituraMapa(secaoDetalhes, "Peso (g)", Number(produto.peso || PESO_PADRAO_PRODUTO_GRAMAS || 10));
    criarCampoLeituraMapa(secaoDetalhes, "Lego", textoLegoMapa(produto.lego) || "por verificar");
    topo.appendChild(secaoDetalhes);

    const secaoMarcas = criarSecaoEdicaoMapa("Marcas", "mapas-produto-secao-marcas");
    const flagsLista = document.createElement("div");
    flagsLista.className = "mapas-produto-leitura-badges mapas-produto-leitura-badges-vertical";
    secaoMarcas.appendChild(flagsLista);
    [
        ["Ativo", produto.ativo !== false],
        ["Top", Boolean(String(produto.top || "").trim())],
        ["Arquivado", Boolean(produto.arquivado)],
        ["Descontinuado", Boolean(produto.descontinuado)],
        ["Novidade", Boolean(produto.novidade)]
    ].forEach(([rotulo, ativo]) => criarBadgeLeituraMapa(flagsLista, rotulo, ativo));
    topo.appendChild(secaoMarcas);
    campos.appendChild(topo);

    montarSecaoMediaLeituraMapa(campos, produto);
    montarSecaoHistoricoRececoesMapa(campos, produto);
    montarSecaoHistoricoVendasMapa(campos, produto);
}

function atualizarAcoesModalProdutoMapa(modo) {
    const acoesEdicao = document.getElementById("mapas-produto-acoes-edicao");
    const acoesVer = document.getElementById("mapas-produto-acoes-ver");
    const form = document.getElementById("mapas-produto-form");
    if (acoesEdicao) acoesEdicao.hidden = modo === "ver";
    if (acoesVer) acoesVer.hidden = modo !== "ver";
    if (form) form.classList.toggle("mapas-produto-form-leitura", modo === "ver");
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
    if (modal && modal.dataset.acoesLayout !== "editar-fechar-topo") {
        modal.remove();
        modal = null;
    }
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "mapas-produto-modal";
    modal.className = "mapas-produto-modal";
    modal.dataset.acoesLayout = "editar-fechar-topo";
    modal.hidden = true;
    modal.innerHTML = `
        <div class="mapas-produto-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="mapas-produto-modal-titulo">
            <div class="mapas-produto-modal-topo">
                <h3 id="mapas-produto-modal-titulo">Ficha do produto</h3>
                <div class="mapas-produto-acoes mapas-produto-acoes-topo" id="mapas-produto-acoes-ver">
                    <button type="button" id="mapas-produto-passar-editar" class="wallapop-botao wallapop-botao-destaque">Editar produto</button>
                    <button type="button" id="mapas-produto-fechar-ficha" class="wallapop-botao">Fechar</button>
                </div>
                <div class="mapas-produto-acoes mapas-produto-acoes-topo" id="mapas-produto-acoes-edicao" hidden>
                    <button type="button" id="mapas-produto-cancelar" class="wallapop-botao">Cancelar</button>
                    <button type="submit" form="mapas-produto-form" id="mapas-produto-guardar" class="wallapop-botao wallapop-botao-destaque">Guardar produto</button>
                </div>
            </div>
            <form id="mapas-produto-form" class="mapas-produto-form">
                <input type="hidden" id="mapas-produto-modo" value="ver">
                <input type="hidden" id="mapas-editar-id">
                <input type="hidden" id="mapas-editar-sku-original">
                <div class="mapas-produto-form-grid" id="mapas-produto-form-campos"></div>
                <p class="fornecedores-status mapas-produto-status" id="mapas-produto-status" role="status"></p>
            </form>
        </div>`;
    document.body.appendChild(modal);
    modal.querySelector("#mapas-produto-fechar-ficha")?.addEventListener("click", fecharEdicaoProdutoMapa);
    modal.querySelector("#mapas-produto-cancelar")?.addEventListener("click", () => {
        const id = modal.dataset.produtoId || document.getElementById("mapas-editar-id")?.value;
        const modo = document.getElementById("mapas-produto-modo")?.value;
        if (modo === "criar" || !id) {
            fecharEdicaoProdutoMapa();
            return;
        }
        abrirFichaProdutoMapa(id);
    });
    modal.querySelector("#mapas-produto-passar-editar")?.addEventListener("click", () => {
        const id = modal.dataset.produtoId || document.getElementById("mapas-editar-id")?.value;
        if (id) abrirEdicaoProdutoMapa(id);
    });
    modal.addEventListener("click", evento => { if (evento.target === modal) fecharEdicaoProdutoMapa(); });
    modal.querySelector("#mapas-produto-form")?.addEventListener("submit", guardarEdicaoProdutoMapa);
    return modal;
}

function preencherFormularioProdutoMapa(produto, modo = "editar") {
    const modal = garantirModalEdicaoProdutoMapa();
    const campos = modal.querySelector("#mapas-produto-form-campos");
    const status = modal.querySelector("#mapas-produto-status");
    const titulo = modal.querySelector("#mapas-produto-modal-titulo");
    const botaoGuardar = modal.querySelector("#mapas-produto-guardar");
    campos.replaceChildren();
    if (status) status.textContent = "";
    modal.querySelector("#mapas-produto-modo").value = modo;
    modal.querySelector("#mapas-editar-id").value = String(produto.id || "");
    modal.querySelector("#mapas-editar-sku-original").value = String(produto.sku || "");
    if (produto.id) modal.dataset.produtoId = String(produto.id);
    else delete modal.dataset.produtoId;
    if (titulo) titulo.textContent = modo === "criar" ? "Novo produto" : "Editar produto";
    if (botaoGuardar) botaoGuardar.textContent = modo === "criar" ? "Criar produto" : "Guardar produto";
    atualizarAcoesModalProdutoMapa(modo);

    const secaoIdentificacao = criarSecaoEdicaoMapa("Identificação", "mapas-produto-secao-identificacao");
    criarInputEdicaoMapa(secaoIdentificacao, "mapas-editar-nome", "Nome", produto.nome || "", "text", { required: true, largo: true });
    criarInputEdicaoMapa(secaoIdentificacao, "mapas-editar-referencia", "Ref.", produto.referencia || "");
    criarInputEdicaoMapa(secaoIdentificacao, "mapas-editar-sku", "SKU", produto.sku || "", "text", { required: true });
    criarInputEdicaoMapa(secaoIdentificacao, "mapas-editar-tema", "Tema", produto.tema || "", "text", { required: true });
    criarInputEdicaoMapa(secaoIdentificacao, "mapas-editar-subtema", "Subtema", produto.subtema === "semsubtema" ? "" : (produto.subtema || ""));
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-top", "Top", Boolean(String(produto.top || "").trim()));
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-arquivado", "Arquivado", Boolean(produto.arquivado));
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-descontinuado", "Descontinuado", Boolean(produto.descontinuado));
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-novidade", "Novidade", modo === "criar" ? true : Boolean(produto.novidade));
    campos.appendChild(secaoIdentificacao);

    const secaoDetalhes = criarSecaoEdicaoMapa("Detalhes", "mapas-produto-secao-detalhes");
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-stock", "Stock", Number(produto.stock || 0), "number", { required: true, min: 0, step: 1 });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-preco-compra", "preço compra", Number(produto.preco_compra || 0).toFixed(2), "number", { min: 0, step: "0.01" });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-preco", "preço venda", Number(produto.preco || 0).toFixed(2), "number", { required: true, min: 0, step: "0.01" });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-peso", "Peso (g)", Number(produto.peso || PESO_PADRAO_PRODUTO_GRAMAS || 10), "number", { required: true, min: 1, step: 1 });
    criarSelectEdicaoMapa(secaoDetalhes, "mapas-editar-lego", "Lego", textoLegoMapa(produto.lego), [
        { valor: "", texto: "por verificar" },
        { valor: "sim", texto: "sim" },
        { valor: "não", texto: "não" }
    ]);
    criarCheckboxEdicaoMapa(secaoDetalhes, "mapas-editar-ativo", "Produto ativo", produto.ativo !== false);
    campos.appendChild(secaoDetalhes);

    montarSecaoMediaEdicaoMapa(campos, produto);

    const nomeInput = modal.querySelector("#mapas-editar-nome");
    const skuInput = modal.querySelector("#mapas-editar-sku");
    if (modo === "criar" && nomeInput && skuInput) {
        nomeInput.addEventListener("blur", () => {
            if (String(skuInput.value || "").trim()) return;
            if (typeof gerarSkuProduto === "function") {
                skuInput.value = gerarSkuProduto(nomeInput.value, mapasProdutos);
            }
        });
    }
    nomeInput?.focus();
}

async function abrirFichaProdutoMapa(produtoId) {
    const produtoBase = mapasProdutos.find(item => String(item.id) === String(produtoId));
    if (!produtoBase) return;
    const modal = garantirModalEdicaoProdutoMapa();
    const status = modal.querySelector("#mapas-produto-status");
    const campos = modal.querySelector("#mapas-produto-form-campos");
    const token = `ver:${produtoId}:${Date.now()}`;
    modal.dataset.vistaToken = token;
    modal.dataset.produtoId = String(produtoId);
    campos.replaceChildren();
    if (status) {
        status.textContent = "A carregar ficha...";
        status.classList.remove("status-erro", "status-sucesso");
        status.classList.add("status-aviso");
    }
    atualizarAcoesModalProdutoMapa("ver");
    modal.hidden = false;
    document.body.classList.add("mapas-produto-modal-aberto");

    const produto = await enriquecerMediaProdutoMapa(produtoBase);
    if (modal.dataset.vistaToken !== token) return;
    mapasProdutos = mapasProdutos.map((item) =>
        String(item.id) === String(produto.id) ? { ...item, imagens: produto.imagens, observacoes: produto.observacoes } : item
    );
    preencherFichaProdutoMapa(produto);
}

async function abrirEdicaoProdutoMapa(produtoId) {
    const produtoBase = mapasProdutos.find(item => String(item.id) === String(produtoId));
    if (!produtoBase) return;
    const modal = garantirModalEdicaoProdutoMapa();
    const status = modal.querySelector("#mapas-produto-status");
    const campos = modal.querySelector("#mapas-produto-form-campos");
    const token = `editar:${produtoId}:${Date.now()}`;
    modal.dataset.vistaToken = token;
    modal.dataset.produtoId = String(produtoId);
    campos.replaceChildren();
    if (status) {
        status.textContent = "A carregar edição...";
        status.classList.remove("status-erro", "status-sucesso");
        status.classList.add("status-aviso");
    }
    atualizarAcoesModalProdutoMapa("editar");
    modal.hidden = false;
    document.body.classList.add("mapas-produto-modal-aberto");

    const produto = await enriquecerMediaProdutoMapa(produtoBase);
    if (modal.dataset.vistaToken !== token) return;
    mapasProdutos = mapasProdutos.map((item) =>
        String(item.id) === String(produto.id) ? { ...item, imagens: produto.imagens, observacoes: produto.observacoes } : item
    );
    preencherFormularioProdutoMapa(produto, "editar");
}

function abrirCriacaoProdutoMapa() {
    const modal = garantirModalEdicaoProdutoMapa();
    modal.hidden = false;
    document.body.classList.add("mapas-produto-modal-aberto");
    preencherFormularioProdutoMapa({
        id: "",
        sku: "",
        nome: "",
        referencia: "",
        lego: "",
        top: "",
        arquivado: false,
        descontinuado: false,
        novidade: true,
        preco_compra: 0,
        preco: 0,
        peso: typeof PESO_PADRAO_PRODUTO_GRAMAS === "number" ? PESO_PADRAO_PRODUTO_GRAMAS : 10,
        stock: 0,
        tema: "",
        subtema: "",
        ativo: false,
        imagens: [],
        observacoes: "",
        fornecedores: {}
    }, "criar");
}

function fecharEdicaoProdutoMapa() {
    const modal = document.getElementById("mapas-produto-modal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("mapas-produto-modal-aberto");
}

function lerProdutoEditadoMapa() {
    const produtoAtual = mapasProdutos.find(item => String(item.id) === String(document.getElementById("mapas-editar-id").value));
    const observacoesCampo = document.getElementById("mapas-editar-observacoes");
    const imagensCampo = document.getElementById("mapas-editar-imagens");
    const produto = {
        nome: document.getElementById("mapas-editar-nome").value.trim(),
        referencia: document.getElementById("mapas-editar-referencia").value.trim(),
        sku: normalizarSkuMapa(document.getElementById("mapas-editar-sku").value),
        lego: document.getElementById("mapas-editar-lego").value,
        top: document.getElementById("mapas-editar-top").checked ? "sim" : "",
        arquivado: document.getElementById("mapas-editar-arquivado").checked,
        descontinuado: document.getElementById("mapas-editar-descontinuado").checked,
        novidade: document.getElementById("mapas-editar-novidade").checked,
        preco_compra: Number(document.getElementById("mapas-editar-preco-compra").value || 0),
        preco: Number(document.getElementById("mapas-editar-preco").value),
        peso: Number(document.getElementById("mapas-editar-peso").value || 10),
        stock: Math.max(0, Math.floor(Number(document.getElementById("mapas-editar-stock").value || 0))),
        tema: document.getElementById("mapas-editar-tema").value.trim(),
        subtema: document.getElementById("mapas-editar-subtema").value.trim() || "semsubtema",
        observacoes: observacoesCampo
            ? observacoesCampo.value.trim()
            : (produtoAtual?.observacoes || ""),
        imagens: imagensCampo
            ? obterUrlsImagensEdicaoMapa()
            : normalizarImagensMapa(produtoAtual?.imagens),
        fornecedores: produtoAtual?.fornecedores || {},
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

async function editarProdutoMapaRpc(id, skuOriginal, produto) {
    let { data, error } = await mapasClient.rpc("editar_produto_admin_v2", {
        p_id: id,
        p_sku_original: skuOriginal,
        p_produto: produto
    });
    if (error) {
        ({ data, error } = await mapasClient.rpc("editar_produto_mapa_admin", {
            p_id: id,
            p_sku_original: skuOriginal,
            p_produto: produto
        }));
    }
    return { data, error };
}

async function guardarEdicaoProdutoMapa(evento) {
    evento.preventDefault();
    const botao = document.getElementById("mapas-produto-guardar");
    const status = document.getElementById("mapas-produto-status");
    const modo = document.getElementById("mapas-produto-modo")?.value || "editar";
    if (modo === "ver") return;
    try {
        botao.disabled = true;
        if (status) {
            status.textContent = modo === "criar" ? "A criar..." : "A guardar...";
            status.classList.remove("status-erro", "status-sucesso", "status-neutro");
            status.classList.add("status-aviso");
        }
        const { id, skuOriginal, produto } = lerProdutoEditadoMapa();
        const skuDuplicado = mapasProdutos.some(item =>
            String(item.sku || "").trim().toUpperCase() !== String(skuOriginal || "").trim().toUpperCase()
            && String(item.sku || "").trim().toUpperCase() === produto.sku
        );
        if (skuDuplicado) throw new Error("Este SKU já existe noutro produto.");

        let data = null;
        let error = null;

        if (modo === "criar") {
            ({ data, error } = await mapasClient.rpc("criar_produto_admin", { p_produto: produto }));
            if (error) throw error;
            const precisaExtras = Boolean(produto.top) || produto.arquivado || produto.descontinuado;
            if (precisaExtras && data?.id) {
                const extra = await editarProdutoMapaRpc(data.id, data.sku || produto.sku, {
                    ...produto,
                    fornecedores: data.fornecedores || {}
                });
                if (!extra.error && extra.data) data = extra.data;
            }
            const criado = normalizarProdutoMapa({
                ...produto,
                ...data,
                imagens: data?.imagens ?? produto.imagens,
                observacoes: data?.observacoes ?? produto.observacoes,
                fornecedores: data?.fornecedores ?? produto.fornecedores
            });
            mapasProdutos = [criado, ...mapasProdutos.filter(item => String(item.id) !== String(criado.id))];
            sincronizarEstadoImportacaoMapa();
            atualizarResultadosMapa();
            definirStatusMapa("Produto criado.");
            await abrirFichaProdutoMapa(criado.id);
            return;
        }

        ({ data, error } = await editarProdutoMapaRpc(id, skuOriginal, produto));
        if (error) throw error;
        const atualizado = normalizarProdutoMapa({
            ...data,
            imagens: data?.imagens ?? produto.imagens,
            observacoes: data?.observacoes ?? produto.observacoes,
            fornecedores: data?.fornecedores ?? produto.fornecedores
        });
        mapasProdutos = mapasProdutos.map(item => String(item.id) === String(atualizado.id) ? atualizado : item);
        sincronizarEstadoImportacaoMapa();
        atualizarResultadosMapa();
        definirStatusMapa("Produto guardado.");
        await abrirFichaProdutoMapa(atualizado.id);
    } catch (erro) {
        console.error(erro);
        if (status) {
            status.textContent = "Erro: " + (erro.message || "Não foi possível guardar.");
            status.classList.remove("status-aviso", "status-sucesso", "status-neutro");
            status.classList.add("status-erro");
        }
    } finally {
        if (botao) botao.disabled = false;
    }
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
        script.src = "gestao-importacao.js?v=20260717-catalogo-ativo-auto";
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
window.addEventListener("resize", agendarRenderVirtualMapa);
document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") fecharEdicaoProdutoMapa();
});

iniciarMapas();
