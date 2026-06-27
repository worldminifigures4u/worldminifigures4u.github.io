const MAPAS_SUPABASE_URL = "https://gksndzxadndrsynvzgzb.supabase.co";
const MAPAS_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrc25kenhhZG5kcnN5bnZ6Z3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc5NzMsImV4cCI6MjA5NDY2Mzk3M30.EHZgacYr27dqoc4CJHsOwkNnJFGlLIteSHBi4B1HfVE";
const MAPAS_ADMIN_EMAILS = ["worldminifigures4u@gmail.com"];

const MAPAS_COLUNAS = [
    { chave: "nome", rotulo: "nome", classe: "mapas-col-nome" },
    { chave: "referencia", rotulo: "referência", classe: "mapas-col-ref" },
    { chave: "stock", rotulo: "stock", classe: "mapas-col-stock", numero: true },
    { chave: "tema", rotulo: "tema", classe: "mapas-col-tema" },
    { chave: "subtema", rotulo: "subtema", classe: "mapas-col-subtema" },
    { chave: "preco_compra", rotulo: "preço compra", classe: "mapas-col-preco", numero: true, dinheiro: true },
    { chave: "preco", rotulo: "preço venda", classe: "mapas-col-preco", numero: true, dinheiro: true },
    { chave: "novidade", rotulo: "novidade", classe: "mapas-col-novidade" },
    { chave: "descontinuado", rotulo: "descontinuado", classe: "mapas-col-descontinuado" },
    { chave: "lego", rotulo: "lego", classe: "mapas-col-lego" },
    { chave: "sku", rotulo: "sku", classe: "mapas-col-sku" },
    { chave: "top", rotulo: "top", classe: "mapas-col-top" },
    { chave: "peso", rotulo: "peso", classe: "mapas-col-peso", numero: true }
];

let mapasClient = null;
let mapasProdutos = [];
let mapasResultados = [];
let mapasProdutosVisiveis = [];
let mapasOrdenacao = { coluna: "nome", direcao: "asc" };
let mapasLinhaAltura = 39;
let mapasRenderPendente = 0;
let mapasAtualizacaoPendente = 0;

function normalizarMapa(texto) {
    return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
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
    el.style.color = erro ? "#ff6262" : "#28d75f";
}

function obterTopMapa(produto) {
    return produto?.top || "";
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
        descontinuado: valorBooleanoMapa(produto.descontinuado),
        novidade: valorBooleanoMapa(produto.novidade),
        peso: Number(produto.peso || 10),
        tema: produto.tema || "",
        subtema: produto.subtema || "",
        stock: Math.max(0, Number(produto.stock || 0)),
        ativo: produto.ativo !== false,
        imagens: Array.isArray(produto.imagens) ? produto.imagens : [],
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

function produtoPassaPesquisaMapa(produto, termo) {
    if (!termo) return true;
    return String(produto.pesquisa || "").includes(termo);
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
    if (coluna === "descontinuado" || coluna === "novidade") return valorBooleanoMapa(produto[coluna]) ? 1 : 0;
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
    const totais = resultados.reduce((acc, produto) => {
        if (String(obterTopMapa(produto)).trim()) acc.top += 1;
        if (valorBooleanoMapa(produto.descontinuado)) acc.descontinuado += 1;
        acc.stock += Math.max(0, Number(produto.stock || 0));
        return acc;
    }, { top: 0, descontinuado: 0, stock: 0 });
    contador.append(
        criarItemContadorMapa(resultados.length === 1 ? "figura" : "figuras", resultados.length, true),
        criarItemContadorMapa("Disponível", resultados.length),
        criarItemContadorMapa("OS", 0),
        criarItemContadorMapa("EX", 0),
        criarItemContadorMapa("Top", totais.top),
        criarItemContadorMapa("Descontinuadas", totais.descontinuado),
        criarItemContadorMapa("em stock", totais.stock)
    );
}

function criarCabecalhoTabelaMapa() {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    MAPAS_COLUNAS.forEach(coluna => {
        const th = document.createElement("th");
        th.className = coluna.classe || "";
        th.textContent = coluna.rotulo + (mapasOrdenacao.coluna === coluna.chave ? (mapasOrdenacao.direcao === "asc" ? " ▲" : " ▼") : "");
        th.addEventListener("click", () => {
            if (mapasOrdenacao.coluna === coluna.chave) {
                mapasOrdenacao.direcao = mapasOrdenacao.direcao === "asc" ? "desc" : "asc";
            } else {
                mapasOrdenacao = { coluna: coluna.chave, direcao: "asc" };
            }
            atualizarResultadosMapa();
        });
        tr.appendChild(th);
    });
    thead.appendChild(tr);
    return thead;
}

function valorCelulaMapa(produto, coluna) {
    if (coluna.chave === "preco" || coluna.chave === "preco_compra") return formatarEuroMapa(produto[coluna.chave]);
    if (coluna.chave === "descontinuado" || coluna.chave === "novidade") return textoBooleanoMapa(produto[coluna.chave]);
    if (coluna.chave === "lego") return textoLegoMapa(produto.lego);
    if (coluna.chave === "subtema") return produto.subtema === "semsubtema" ? "" : produto.subtema;
    return produto[coluna.chave] ?? "";
}

function criarLinhaProdutoMapa(produto) {
    const tr = document.createElement("tr");
    MAPAS_COLUNAS.forEach(coluna => {
        const td = document.createElement("td");
        if (coluna.classe) td.className = coluna.classe;
        if (coluna.chave === "nome") {
            const botao = document.createElement("button");
            botao.type = "button";
            botao.className = "mapas-celula-nome";
            botao.textContent = produto.nome || "";
            botao.title = "Editar produto";
            botao.addEventListener("click", () => abrirEdicaoProdutoMapa(produto.id));
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

    spacerTopo.style.height = `${inicio * mapasLinhaAltura}px`;
    spacerFundo.style.height = `${Math.max(0, (mapasResultados.length - fim) * mapasLinhaAltura)}px`;
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
    const resumo = document.createElement("p");
    resumo.className = "fornecedor-contagem-lista mapas-tabela-resumo";
    resumo.textContent = mapasResultados.length ? `${mapasResultados.length} produto(s) no mapa` : "Nenhum produto encontrado.";
    caixa.appendChild(resumo);

    if (!mapasResultados.length) return;

    const wrapper = document.createElement("div");
    wrapper.id = "mapas-tabela-wrapper";
    wrapper.className = "mapas-tabela-wrapper mapas-tabela-virtual";

    const tabela = document.createElement("table");
    tabela.className = "mapas-produtos-tabela";
    tabela.appendChild(criarCabecalhoTabelaMapa());
    const tbody = document.createElement("tbody");
    tbody.id = "mapas-tabela-corpo";
    const spacerTopo = document.createElement("tr");
    spacerTopo.id = "mapas-spacer-topo";
    spacerTopo.className = "mapas-spacer-virtual";
    spacerTopo.innerHTML = `<td colspan="${MAPAS_COLUNAS.length}"></td>`;
    const spacerFundo = document.createElement("tr");
    spacerFundo.id = "mapas-spacer-fundo";
    spacerFundo.className = "mapas-spacer-virtual";
    spacerFundo.innerHTML = `<td colspan="${MAPAS_COLUNAS.length}"></td>`;
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

function copiarListaMapaVisivel() {
    const produtos = mapasProdutosVisiveis || [];
    if (!produtos.length) {
        definirStatusMapa("Não há produtos visíveis para copiar.", true);
        return;
    }
    const linhasProdutos = produtos.map(produto => `${String(produto.nome || "").trim()}\t${formatarEuroMapa(produto.preco)} €`);
    const total = produtos.reduce((soma, produto) => soma + Number(produto.preco || 0), 0);
    const texto = [
        ...linhasProdutos,
        "",
        `Total\t${formatarEuroMapa(total)} €`,
        "",
        "Acresce as despesas com portes de envio e manuseamento para pacote postal de acordo com a sua escolha."
    ].join("\n");
    navigator.clipboard?.writeText(texto)
        .then(() => definirStatusMapa(`${produtos.length} produto(s) copiado(s).`))
        .catch(() => {
            const area = document.createElement("textarea");
            area.value = texto;
            area.style.position = "fixed";
            area.style.left = "-9999px";
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
        </div>`;
    document.body.appendChild(modal);
    modal.querySelector(".mapas-produto-modal-fechar")?.addEventListener("click", fecharEdicaoProdutoMapa);
    modal.querySelector("#mapas-produto-cancelar")?.addEventListener("click", fecharEdicaoProdutoMapa);
    modal.addEventListener("click", evento => { if (evento.target === modal) fecharEdicaoProdutoMapa(); });
    modal.querySelector("#mapas-produto-form")?.addEventListener("submit", guardarEdicaoProdutoMapa);
    return modal;
}

function abrirEdicaoProdutoMapa(produtoId) {
    const produto = mapasProdutos.find(item => String(item.id) === String(produtoId));
    if (!produto) return;
    const modal = garantirModalEdicaoProdutoMapa();
    const campos = modal.querySelector("#mapas-produto-form-campos");
    const status = modal.querySelector("#mapas-produto-status");
    campos.replaceChildren();
    if (status) status.textContent = "";
    modal.querySelector("#mapas-editar-id").value = String(produto.id || "");
    modal.querySelector("#mapas-editar-sku-original").value = String(produto.sku || "");

    const secaoIdentificacao = criarSecaoEdicaoMapa("Identificação", "mapas-produto-secao-identificacao");
    criarInputEdicaoMapa(secaoIdentificacao, "mapas-editar-nome", "Nome", produto.nome || "", "text", { required: true, largo: true });
    criarInputEdicaoMapa(secaoIdentificacao, "mapas-editar-referencia", "Ref.", produto.referencia || "");
    criarInputEdicaoMapa(secaoIdentificacao, "mapas-editar-sku", "SKU", produto.sku || "", "text", { required: true });
    criarSelectEdicaoMapa(secaoIdentificacao, "mapas-editar-lego", "Lego", textoLegoMapa(produto.lego), [
        { valor: "", texto: "por verificar" },
        { valor: "sim", texto: "sim" },
        { valor: "não", texto: "não" }
    ]);
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-top", "Top", Boolean(String(produto.top || "").trim()));
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-descontinuado", "Descontinuado", produto.descontinuado);
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-novidade", "Novidade", produto.novidade);
    campos.appendChild(secaoIdentificacao);

    const secaoDetalhes = criarSecaoEdicaoMapa("Detalhes", "mapas-produto-secao-detalhes");
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-preco-compra", "preço compra", Number(produto.preco_compra || 0).toFixed(2), "number", { min: 0, step: "0.01" });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-preco", "preço venda", Number(produto.preco || 0).toFixed(2), "number", { required: true, min: 0, step: "0.01" });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-peso", "Peso (g)", Number(produto.peso || 10), "number", { required: true, min: 1, step: 1 });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-stock", "Stock", Number(produto.stock || 0), "number", { required: true, min: 0, step: 1 });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-tema", "Tema", produto.tema || "", "text", { required: true });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-subtema", "Subtema", produto.subtema === "semsubtema" ? "" : (produto.subtema || ""));
    criarCheckboxEdicaoMapa(secaoDetalhes, "mapas-editar-ativo", "Produto ativo", produto.ativo !== false);
    campos.appendChild(secaoDetalhes);

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
    const produtoAtual = mapasProdutos.find(item => String(item.id) === String(document.getElementById("mapas-editar-id").value));
    const produto = {
        nome: document.getElementById("mapas-editar-nome").value.trim(),
        referencia: document.getElementById("mapas-editar-referencia").value.trim(),
        sku: normalizarSkuMapa(document.getElementById("mapas-editar-sku").value),
        lego: document.getElementById("mapas-editar-lego").value,
        top: document.getElementById("mapas-editar-top").checked ? "sim" : "",
        descontinuado: document.getElementById("mapas-editar-descontinuado").checked,
        novidade: document.getElementById("mapas-editar-novidade").checked,
        preco_compra: Number(document.getElementById("mapas-editar-preco-compra").value || 0),
        preco: Number(document.getElementById("mapas-editar-preco").value),
        peso: Number(document.getElementById("mapas-editar-peso").value || 10),
        stock: Math.max(0, Math.floor(Number(document.getElementById("mapas-editar-stock").value || 0))),
        tema: document.getElementById("mapas-editar-tema").value.trim(),
        subtema: document.getElementById("mapas-editar-subtema").value.trim() || "semsubtema",
        observacoes: produtoAtual?.observacoes || "",
        imagens: Array.isArray(produtoAtual?.imagens) ? produtoAtual.imagens : [],
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

async function guardarEdicaoProdutoMapa(evento) {
    evento.preventDefault();
    const botao = document.getElementById("mapas-produto-guardar");
    const status = document.getElementById("mapas-produto-status");
    try {
        botao.disabled = true;
        if (status) {
            status.textContent = "A guardar...";
            status.style.color = "#ffc400";
        }
        const { id, skuOriginal, produto } = lerProdutoEditadoMapa();
        const skuDuplicado = mapasProdutos.some(item =>
            String(item.sku || "").trim().toUpperCase() !== String(skuOriginal || "").trim().toUpperCase()
            && String(item.sku || "").trim().toUpperCase() === produto.sku
        );
        if (skuDuplicado) throw new Error("Este SKU já existe noutro produto.");
        const { data, error } = await mapasClient.rpc("editar_produto_mapa_admin", { p_id: id, p_sku_original: skuOriginal, p_produto: produto });
        if (error && /editar_produto_mapa_admin/i.test(String(error.message || ""))) {
            throw new Error("Execute primeiro o SQL atualizado do Mapas no Supabase para editar produtos nesta página.");
        }
        if (error) throw error;
        const atualizado = normalizarProdutoMapa({ ...data, imagens: produto.imagens, observacoes: produto.observacoes, fornecedores: produto.fornecedores });
        mapasProdutos = mapasProdutos.map(item => String(item.id) === String(atualizado.id) ? atualizado : item);
        fecharEdicaoProdutoMapa();
        atualizarResultadosMapa();
        definirStatusMapa("Produto guardado.");
    } catch (erro) {
        console.error(erro);
        if (status) {
            status.textContent = "Erro: " + (erro.message || "Não foi possível guardar.");
            status.style.color = "#ff6262";
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
}

async function iniciarMapas() {
    try {
        mapasClient = supabase.createClient(MAPAS_SUPABASE_URL, MAPAS_SUPABASE_KEY);
        const { data: { user }, error } = await mapasClient.auth.getUser();
        if (error || !user || !MAPAS_ADMIN_EMAILS.includes(String(user.email || "").toLowerCase())) {
            document.getElementById("fornecedores-bloqueio").textContent = "Acesso reservado ao administrador.";
            return;
        }
        document.getElementById("fornecedores-bloqueio").hidden = true;
        document.getElementById("fornecedores-aplicacao").hidden = false;
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
document.getElementById("mapas-copiar-lista")?.addEventListener("click", copiarListaMapaVisivel);
window.addEventListener("scroll", agendarRenderVirtualMapa, { passive: true });
window.addEventListener("resize", agendarRenderVirtualMapa);
document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") fecharEdicaoProdutoMapa();
});

iniciarMapas();
