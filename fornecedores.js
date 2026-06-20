const FORNECEDORES_SUPABASE_URL = "https://gksndzxadndrsynvzgzb.supabase.co";
const FORNECEDORES_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrc25kenhhZG5kcnN5bnZ6Z3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc5NzMsImV4cCI6MjA5NDY2Mzk3M30.EHZgacYr27dqoc4CJHsOwkNnJFGlLIteSHBi4B1HfVE";
const FORNECEDORES_ADMIN_EMAILS = ["worldminifigures4u@gmail.com"];
const FORNECEDORES_STORAGE_KEY = "figures-planet-fornecedores-pedidos";
const FORNECEDORES_SELECAO_KEY = "figures-planet-fornecedores-selecao";
const FORNECEDORES_SEM_IMAGEM = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="8" fill="#eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="13" fill="#777">Sem foto</text></svg>');

const FORNECEDORES_ALIASES = {
    "Lote 50": ["lote50", "lote 50", "lote_50"],
    Enmei: ["enmei", "winnie gong", "winniegong"],
    Minie: ["minie", "minie gong", "miniegong"],
    Ruisbengtu: ["ruisbengtu", "ruisbengtui"],
    Lequgo: ["lequgo", "legougo"],
    Chuangyaoke: ["chuangyaoke", "chuangyoke"],
    Keooli: ["keooli", "keooli koopt", "koopt"],
    Brixtoy: ["brixtoy"],
};

let fornecedoresClient = null;
let fornecedorProdutos = [];
let fornecedorSelecao = carregarSelecaoFornecedor();
let fornecedorPedidos = carregarPedidosFornecedores();
let fornecedorMapaOrdenacao = { coluna: "nome", direcao: "asc" };

function normalizarFornecedor(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function formatarEuroFornecedor(valor) {
    return Number(valor || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20ac';
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
        itens: Array.isArray(pedido.itens) ? pedido.itens : []
    };
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
    const aliases = FORNECEDORES_ALIASES[nome] || [nome];
    return [nome, ...aliases].map(normalizarChaveFornecedor).filter(Boolean);
}

function lerValorPorAlias(objeto, aliases) {
    if (!objeto || typeof objeto !== "object") return "";
    for (const [chave, valor] of Object.entries(objeto)) {
        const chaveNormalizada = normalizarChaveFornecedor(chave);
        if (aliases.includes(chaveNormalizada)) return valor;
    }
    return "";
}

function obterValorFornecedorProduto(produto, fornecedorNome) {
    if (!produto || !fornecedorNome || fornecedorNome === "Outro") return "";
    const aliases = obterAliasesFornecedor(fornecedorNome);
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

function classificarValorFornecedor(valor) {
    const texto = String(valor ?? "").trim();
    const maiusculas = texto.toUpperCase();
    if (!texto) return { tipo: "disponivel", texto: "Disponivel" };
    if (maiusculas === "OS") return { tipo: "os", texto: "OS" };
    if (maiusculas === "EX") return { tipo: "ex", texto: "EX" };
    if (/^-?\d+(?:[,.]\d+)?$/.test(texto)) return { tipo: "numero", texto: `Ja encomendado: ${texto}` };
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
    if (coluna === "sku") return produto.sku || "";
    if (coluna === "ref") return produto.referencia || "";
    if (coluna === "top") return obterTopProdutoFornecedor(produto) || "";
    if (coluna === "stock") return Number(produto.stock || 0);
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
    if (["nome", "sku", "ref", "top", "qtd"].includes(coluna)) {
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

function produtoPassaFiltroTopFornecedor(produto, filtroTop) {
    if (!filtroTop || filtroTop === "todos") return true;
    const valorTop = String(obterTopProdutoFornecedor(produto) || "").trim();
    if (filtroTop === "top") return Boolean(valorTop);
    if (filtroTop === "sem-top") return !valorTop;
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

async function carregarCatalogoFornecedores() {
    const respostaAdmin = await fornecedoresClient.rpc('listar_produtos_plataforma_admin');
    let produtos = Array.isArray(respostaAdmin.data) ? respostaAdmin.data : [];

    if (respostaAdmin.error) {
        console.warn('Catalogo administrativo indisponivel; a usar consulta direta.', respostaAdmin.error);
        produtos = [];
        let inicio = 0;
        const tamanho = 500;
        while (true) {
            const { data, error } = await fornecedoresClient
                .from('produtos')
                .select('*')
                .order('nome', { ascending: true })
                .range(inicio, inicio + tamanho - 1);
            if (error) throw error;
            if (!data?.length) break;
            produtos.push(...data);
            if (data.length < tamanho) break;
            inicio += tamanho;
        }
    }

    fornecedorProdutos = produtos.map(produto => ({
        ...produto,
        stock: Number.isFinite(Number(produto.stock)) ? Number(produto.stock) : 0,
        preco: Number.isFinite(Number(produto.preco)) ? Number(produto.preco) : 0
    }));

    fornecedorSelecao = fornecedorSelecao.map(item => {
        const atual = obterProdutoAtual(item.id);
        if (!atual) return null;
        return { ...atual, quantidade: Math.max(1, Number(item.quantidade) || 1) };
    }).filter(Boolean);
    guardarSelecaoFornecedor();
}


function estaPaginaMapasFornecedor() {
    return document.body?.classList.contains("pagina-mapas-admin");
}

function obterTopProdutoFornecedor(produto) {
    return produto?.top || produto?.tipo || produto?.destaque || "";
}

function criarCelulaMapaFornecedor(texto, className = "") {
    const celula = document.createElement("td");
    if (className) celula.className = className;
    celula.textContent = texto ?? "";
    return celula;
}

function renderizarResultadosFornecedorMapa(caixa, resultados, fornecedor) {
    caixa.classList.add("fornecedor-resultados-mapa");

    const resumo = document.createElement("p");
    resumo.className = "fornecedor-contagem-lista mapas-tabela-resumo";
    resumo.textContent = resultados.length
        ? `${resultados.length} produto(s) no mapa`
        : "Nenhum produto encontrado.";
    caixa.appendChild(resumo);

    if (!resultados.length) return;

    const envoltorio = document.createElement("div");
    envoltorio.className = "mapas-tabela-wrapper";

    const tabela = document.createElement("table");
    tabela.className = "mapas-produtos-tabela";

    const thead = document.createElement("thead");
    const cabecalho = document.createElement("tr");
    [
        ["nome", "mapas-col-nome", "nome"],
        ["Ref.", "mapas-col-ref", "ref"],
        ["stock", "mapas-col-stock", "stock"],
        ["qtd", "mapas-col-qtd", "qtd"],
    ].forEach(([texto, classe, coluna]) => {
        const th = document.createElement("th");
        th.className = `${classe} mapas-th-ordenavel`;
        const botao = document.createElement("button");
        botao.type = "button";
        botao.textContent = texto;
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
    resultados
        .slice()
        .sort((a, b) => compararProdutosPorColunaFornecedor(a, b, fornecedorMapaOrdenacao.coluna, fornecedorMapaOrdenacao.direcao))
        .forEach(({ produto }) => {
            const atual = produto;
            const linha = document.createElement("tr");
            const stockNumero = Number(atual.stock || 0);

            linha.appendChild(criarCelulaMapaFornecedor(atual.nome || "Produto sem nome", "mapas-col-nome"));

            const refCelula = document.createElement("td");
            refCelula.className = "mapas-col-ref";
            const refConteudo = document.createElement("div");
            refConteudo.className = "mapas-ref-com-imagem";
            refConteudo.appendChild(criarImagemFornecedor(atual, "fornecedor-miniatura pequena"));
            const refTexto = document.createElement("span");
            refTexto.textContent = atual.referencia || "-";
            refConteudo.appendChild(refTexto);
            refCelula.appendChild(refConteudo);
            linha.appendChild(refCelula);

            linha.appendChild(criarCelulaMapaFornecedor(stockNumero, `mapas-col-stock mapa-stock-celula ${stockNumero <= 0 ? "sem-stock" : ""}`));

            const qtdCelula = document.createElement("td");
            qtdCelula.className = "mapas-col-qtd";
            const input = document.createElement("input");
            input.type = "number";
            input.min = "0";
            input.step = "1";
            input.value = String(obterQuantidadeSelecionadaFornecedor(atual.id) || 0);
            input.className = "mapa-quantidade-input";
            input.addEventListener("change", () => definirQuantidadeMapaFornecedor(atual, input.value));
            input.addEventListener("blur", () => definirQuantidadeMapaFornecedor(atual, input.value));
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

    const { termo, fornecedor, filtroFornecedor, filtroTop, ordenacao } = obterControlosResultadosFornecedor();
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

        const mais = document.createElement("button");
        mais.type = "button";
        mais.textContent = "+";
        mais.addEventListener("click", () => alterarQuantidadeFornecedor(atual.id, 1));

        const remover = document.createElement("button");
        remover.type = "button";
        remover.textContent = "x";
        remover.className = "fornecedor-remover";
        remover.addEventListener("click", () => removerProdutoFornecedor(atual.id));

        controlos.append(menos, qtd, mais, remover);
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
    const referencia = document.getElementById('fornecedor-referencia').value.trim();
    const itens = fornecedorSelecao.map(item => ({
        id: item.id,
        nome: item.nome,
        sku: item.sku || '',
        referencia: item.referencia || '',
        quantidade: Math.max(1, Number(item.quantidade) || 1),
        recebido: 0,
        stock_no_momento: Number(item.stock || 0),
        preco: Number(item.preco || 0),
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
        document.getElementById('fornecedor-referencia').value = '';
        renderizarSelecionadosFornecedor();
        renderizarPedidosFornecedores();
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
        renderizarPedidosFornecedores();
        definirStatusFornecedor(`Encomenda ${pedido.codigo} apagada.`);
    } catch (error) {
        console.error(error);
        definirStatusFornecedor('Erro ao apagar encomenda: ' + (error.message || 'erro desconhecido'), true);
    }
}
function renderizarPedidosFornecedores() {
    const caixa = document.getElementById('fornecedor-pedidos');
    if (!caixa) return;
    const filtro = document.getElementById('fornecedor-filtro-estado')?.value || 'todos';
    caixa.innerHTML = '';
    const pedidos = fornecedorPedidos.filter(pedido => filtro === 'todos' || pedido.estado === filtro);
    if (!pedidos.length) {
        caixa.innerHTML = '<p class="fornecedor-vazio">Ainda nao existem encomendas neste estado.</p>';
        return;
    }

    pedidos.forEach(pedido => {
        const card = document.createElement('article');
        card.className = 'fornecedor-pedido-card';

        const topo = document.createElement('div');
        topo.className = 'fornecedor-pedido-cabecalho';
        const titulo = document.createElement('div');
        titulo.innerHTML = `<strong>${pedido.codigo}</strong><span>${pedido.fornecedor}${pedido.referencia ? ' - ' + pedido.referencia : ''}</span><small>${new Date(pedido.criado_em).toLocaleString('pt-PT')}</small>`;
        const estado = document.createElement('select');
        estado.className = 'fornecedor-status-select';
        ['A preparar', 'Encomendada', 'Recebida parcialmente', 'Recebida', 'Cancelada'].forEach(opcao => {
            const opt = document.createElement('option');
            opt.value = opcao;
            opt.textContent = opcao;
            opt.selected = pedido.estado === opcao;
            estado.appendChild(opt);
        });
        estado.addEventListener('change', () => alterarEstadoPedidoFornecedor(pedido.id, estado.value));
        topo.append(titulo, estado);
        card.appendChild(topo);

        const lista = document.createElement('div');
        lista.className = 'fornecedor-pedido-produtos';
        pedido.itens.forEach(item => {
            const produtoAtual = obterProdutoAtual(item.id) || item;
            const recebido = Number(item.recebido || 0);
            const restante = Math.max(0, Number(item.quantidade || 0) - recebido);
            const linha = document.createElement('div');
            linha.className = 'fornecedor-pedido-linha';
            linha.appendChild(criarImagemFornecedor(produtoAtual, 'fornecedor-miniatura pequena'));
            const info = document.createElement('div');
            info.className = 'fornecedor-info';
            info.innerHTML = `<strong>${item.nome}</strong><span class="fornecedor-identificadores">Ref. ${item.referencia || '-'} | SKU ${item.sku || '-'}</span><span>Pedido: ${item.quantidade} | Recebido: ${recebido} | Stock atual: ${Number(produtoAtual.stock || 0)}</span>`;
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
        card.appendChild(lista);

        const acoes = document.createElement('div');
        acoes.className = 'fornecedores-acoes pedido';
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
        acoes.append(receber, apagar);
        card.appendChild(acoes);
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

ligarEventoFornecedor('fornecedor-pesquisa', 'input', renderizarResultadosFornecedor);
ligarEventoFornecedor('fornecedor-nome', 'change', renderizarResultadosFornecedor);
ligarEventoFornecedor('fornecedor-ordenacao-stock', 'change', renderizarResultadosFornecedor);
ligarEventoFornecedor('fornecedor-filtro-marcacao', 'change', renderizarResultadosFornecedor);
ligarEventoFornecedor('fornecedor-filtro-top', 'change', renderizarResultadosFornecedor);
ligarEventoFornecedor('btn-limpar-fornecedor', 'click', limparSelecaoFornecedor);
ligarEventoFornecedor('btn-criar-fornecedor', 'click', criarPedidoFornecedor);
ligarEventoFornecedor('fornecedor-filtro-estado', 'change', renderizarPedidosFornecedores);

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
