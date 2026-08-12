(function () {
'use strict';

function normalizarTextoProdutoMapa(valor) {
    return String(valor || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function textoLegoProdutoModal(valor) {
    const texto = normalizarTextoProdutoMapa(valor);
    if (texto === "sim") return "sim";
    if (texto === "nao") return "não";
    return "";
}

function formatarEuroProdutoModal(valor) {
    return Number(valor || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizarSkuProdutoModal(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
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
    input.autocomplete = "off";
    input.value = valor ?? "";
    if (opcoes.required) input.required = true;
    if (opcoes.min !== undefined) input.min = String(opcoes.min);
    if (opcoes.step !== undefined) input.step = String(opcoes.step);
    if (opcoes.listaId) {
        input.setAttribute("list", opcoes.listaId);
    }
    label.appendChild(input);
    form.appendChild(label);
    if (opcoes.listaId) {
        const datalist = document.createElement("datalist");
        datalist.id = opcoes.listaId;
        (opcoes.listaOpcoes || []).forEach((texto) => {
            const option = document.createElement("option");
            option.value = texto;
            datalist.appendChild(option);
        });
        form.appendChild(datalist);
    }
    return input;
}

/** Temas/subtemas distintos já usados no catálogo, para sugerir no formulário de produto. */
function obterTemasESubtemasExistentesMapa() {
    const temas = new Set();
    const subtemasPorTema = {};
    const todosSubtemas = new Set();
    (typeof mapasProdutos !== "undefined" ? mapasProdutos : []).forEach((produto) => {
        const tema = String(produto?.tema || "").trim();
        const subtema = String(produto?.subtema || "").trim();
        const subtemaValido = subtema && subtema.toLowerCase() !== "semsubtema" ? subtema : "";
        if (tema) temas.add(tema);
        if (subtemaValido) {
            todosSubtemas.add(subtemaValido);
            if (tema) {
                if (!subtemasPorTema[tema]) subtemasPorTema[tema] = new Set();
                subtemasPorTema[tema].add(subtemaValido);
            }
        }
    });
    const ordenar = (conjunto) => Array.from(conjunto).sort((a, b) => a.localeCompare(b, "pt"));
    const subtemasPorTemaOrdenado = {};
    Object.keys(subtemasPorTema).forEach((tema) => {
        subtemasPorTemaOrdenado[tema] = ordenar(subtemasPorTema[tema]);
    });
    return {
        temas: ordenar(temas),
        subtemas: ordenar(todosSubtemas),
        subtemasPorTema: subtemasPorTemaOrdenado
    };
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

function obterExtensaoEditorProdutoMapa() {
    const extensao = window.FornecedoresProdutoEditorExt;
    return extensao && typeof extensao === "object" ? extensao : null;
}

function montarSecoesExtraEdicaoMapa(campos, produto, modo) {
    const extensao = obterExtensaoEditorProdutoMapa();
    if (!extensao || typeof extensao.montarSecao !== "function") return;
    extensao.montarSecao(campos, produto, modo, {
        criarSecaoEdicaoMapa,
        criarInputEdicaoMapa,
        criarTextareaEdicaoMapa,
        criarSelectEdicaoMapa,
        criarCheckboxEdicaoMapa
    });
}

function lerFornecedoresEditadosMapa(produtoAtual) {
    const extensao = obterExtensaoEditorProdutoMapa();
    if (!extensao || typeof extensao.lerFornecedores !== "function") {
        return produtoAtual?.fornecedores || {};
    }
    return extensao.lerFornecedores(produtoAtual) || {};
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

/** Vendas: só ID (preferência) ou SKU. Nunca referência (ex. "Personalizado" partilhada). */
function produtoCorrespondeItemVendaMapa(produto, item) {
    if (!produto || !item) return false;
    const produtoId = String(produto.id || "").trim();
    const itemId = String(item.id_produto || item.produto_id || item.id || "").trim();
    if (produtoId && itemId && produtoId === itemId) return true;

    const produtoSku = String(produto.sku || "").trim().toUpperCase();
    const itemSku = String(item.sku || "").trim().toUpperCase();
    return Boolean(produtoSku && itemSku && produtoSku === itemSku);
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
        data_encomendada: pedido.data_encomendada || "",
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
                .select("id,codigo,fornecedor,referencia,estado,criado_em,atualizado_em,data_encomendada,itens")
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

function obterQuantidadePedidaItemFornecedorMapa(item) {
    return Math.max(0, Math.floor(Number(
        item?.quantidade_original ?? item?.quantidade ?? item?.qtd ?? 0
    )));
}

function normalizarChaveFornecedorMapa(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}

function obterObjetoFornecedoresProdutoMapa(produto) {
    let fornecedores = produto?.fornecedores;
    if (typeof fornecedores === "string") {
        try { fornecedores = JSON.parse(fornecedores); }
        catch (_) { return {}; }
    }
    return fornecedores && typeof fornecedores === "object" && !Array.isArray(fornecedores)
        ? fornecedores
        : {};
}

/** Data da marcação Encomendada na ficha (a que o utilizador vê no mapa), se existir. */
function obterDataMarcacaoEncomendadaMapa(produto, fornecedorNome) {
    const chaveAlvo = normalizarChaveFornecedorMapa(fornecedorNome);
    if (!chaveAlvo) return "";
    const fornecedores = obterObjetoFornecedoresProdutoMapa(produto);
    const entrada = Object.entries(fornecedores).find(([chave]) =>
        normalizarChaveFornecedorMapa(chave) === chaveAlvo
    );
    if (!entrada) return "";
    const valor = entrada[1];
    const historico = Array.isArray(valor?.historico) ? valor.historico : [];
    for (let i = historico.length - 1; i >= 0; i -= 1) {
        const tipo = String(historico[i]?.tipo || "").trim().toLowerCase();
        if (tipo === "encomendada" || tipo === "encomendado" || tipo === "encomendada_os") {
            return String(historico[i].data || "").trim();
        }
    }
    return "";
}

function obterDataLinhaEncomendaFornecedorMapa(produto, pedido) {
    if (pedido?.data_encomendada) return pedido.data_encomendada;
    const marcacao = obterDataMarcacaoEncomendadaMapa(produto, pedido?.fornecedor);
    if (marcacao) return marcacao;
    return pedido?.criado_em || "";
}

function obterLinhasEncomendaFornecedorProdutoMapa(produto, pedidos) {
    const linhas = [];
    (pedidos || []).forEach((pedido) => {
        (pedido.itens || []).forEach((item) => {
            if (!produtoCorrespondeItemRececaoMapa(produto, item)) return;
            const pedidoQtd = obterQuantidadePedidaItemFornecedorMapa(item);
            if (pedidoQtd <= 0) return;
            const recebido = Math.max(0, Math.floor(Number(item.recebido || 0)));
            const dataRef = obterDataLinhaEncomendaFornecedorMapa(produto, pedido);
            linhas.push({ pedido, item, pedidoQtd, recebido, dataRef });
        });
    });
    linhas.sort((a, b) => {
        const dataA = Date.parse(a.dataRef || a.pedido.criado_em || 0) || 0;
        const dataB = Date.parse(b.dataRef || b.pedido.criado_em || 0) || 0;
        return dataB - dataA;
    });
    return linhas;
}

function formatarDataEncomendaFornecedorMapa(valor) {
    if (!valor) return "—";
    const texto = String(valor).trim();
    const isoDia = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDia) return `${isoDia[3]}/${isoDia[2]}/${isoDia[1]}`;
    const data = new Date(texto);
    return Number.isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pt-PT");
}

function renderizarHistoricoEncomendasFornecedorMapa(conteudo, produto, pedidos) {
    if (!conteudo) return;
    const linhas = obterLinhasEncomendaFornecedorProdutoMapa(produto, pedidos).filter(({ item }) => {
        const faltaOs = Math.max(0, Math.floor(Number(item?.falta_os || 0)));
        const emEx = Boolean(item?.marcado_ex) || String(item?.estado_fornecedor || "").trim().toUpperCase() === "EX";
        // EX (preço alto) não deve aparecer aqui - só interessa mostrar quando é OS.
        return faltaOs > 0 || !emEx;
    });
    conteudo.replaceChildren();

    if (!linhas.length) {
        const vazio = document.createElement("p");
        vazio.className = "mapas-produto-ajuda-media";
        vazio.textContent = "Ainda não há encomendas a fornecedores com esta figura.";
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
    linhas.forEach(({ pedido, item, pedidoQtd, recebido, dataRef }) => {
        const tr = document.createElement("tr");
        const faltaOs = Math.max(0, Math.floor(Number(item?.falta_os || 0)));
        const emFalta = faltaOs > 0;
        const emEx = Boolean(item?.marcado_ex) || String(item?.estado_fornecedor || "").trim().toUpperCase() === "EX";
        if (emFalta) {
            tr.classList.add("mapas-produto-historico-os");
        } else if (emEx) {
            tr.classList.add("mapas-produto-historico-ex");
        } else if (recebido < pedidoQtd) {
            tr.classList.add("mapas-produto-historico-pendente");
        }
        const estadoTexto = emFalta
            ? `Sem stock no fornecedor (OS: ${faltaOs})`
            : emEx
                ? "Preço muito alto neste fornecedor (EX)"
                : (pedido.estado || "—");
        [
            formatarDataEncomendaFornecedorMapa(dataRef),
            pedido.codigo || pedido.referencia || "—",
            pedido.fornecedor || "—",
            String(pedidoQtd || "—"),
            String(recebido),
            estadoTexto
        ].forEach((valor) => {
            const td = document.createElement("td");
            td.textContent = valor;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    tabela.append(thead, tbody);
    conteudo.appendChild(tabela);
}

function montarSecaoHistoricoRececoesMapa(campos, produto) {
    const secao = criarSecaoEdicaoMapa("Histórico a fornecedores", "mapas-produto-secao-media mapas-produto-secao-historico");
    const conteudo = document.createElement("div");
    conteudo.className = "mapas-produto-historico-rececoes";
    conteudo.id = "mapas-produto-historico-rececoes";
    conteudo.dataset.produtoId = String(produto.id || "");
    const loading = document.createElement("p");
    loading.className = "mapas-produto-ajuda-media";
    loading.textContent = "A carregar histórico...";
    conteudo.appendChild(loading);
    secao.append(conteudo);
    campos.appendChild(secao);

    const produtoId = String(produto.id || "");
    carregarEncomendasFornecedorMapa(true).then((pedidos) => {
        if (conteudo.dataset.produtoId !== produtoId) return;
        renderizarHistoricoEncomendasFornecedorMapa(conteudo, produto, pedidos);
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

function obterPrimeiroTextoEncomendaMapa(encomenda, campos) {
    for (const campo of campos) {
        const valor = String(encomenda?.[campo] ?? "").trim();
        if (valor) return valor;
    }
    return "";
}

function obterCodigoEncomendaClienteMapa(encomenda) {
    return obterPrimeiroTextoEncomendaMapa(encomenda, [
        "codigo_encomenda",
        "codigo",
        "numero_encomenda",
        "numero",
        "referencia_encomenda",
        "referencia_externa",
        "referencia"
    ]);
}

function obterOrigemEncomendaClienteMapa(encomenda) {
    const origem = obterPrimeiroTextoEncomendaMapa(encomenda, ["origem"]);
    if (origem && normalizarTextoProdutoMapa(origem) !== "site") return origem;

    const plataforma = obterPrimeiroTextoEncomendaMapa(encomenda, [
        "plataforma",
        "canal",
        "canal_venda",
        "origem_venda",
        "marketplace"
    ]);
    if (plataforma) return plataforma;

    const plataformaPorMetodo = obterPrimeiroTextoEncomendaMapa(encomenda, [
        "metodo_pagamento",
        "metodo_envio_nome"
    ]);
    const metodoNormalizado = normalizarTextoProdutoMapa(plataformaPorMetodo);
    if (["wallapop", "vinted", "olx", "todocoleccion"].includes(metodoNormalizado)) {
        return plataformaPorMetodo;
    }

    return origem || "Site";
}

function normalizarEncomendaClienteMapa(encomenda) {
    if (!encomenda) return null;
    return {
        id: encomenda.id || "",
        codigo: obterCodigoEncomendaClienteMapa(encomenda),
        cliente: encomenda.nome_cliente || "",
        origem: obterOrigemEncomendaClienteMapa(encomenda),
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
                .select("*")
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
            produtoCorrespondeItemVendaMapa(produto, item)
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
            `${formatarEuroProdutoModal(subtotal)} €`,
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
    const conteudo = document.createElement("div");
    conteudo.className = "mapas-produto-historico-vendas";
    conteudo.id = "mapas-produto-historico-vendas";
    conteudo.dataset.produtoId = String(produto.id || "");
    const loading = document.createElement("p");
    loading.className = "mapas-produto-ajuda-media";
    loading.textContent = "A carregar histórico...";
    conteudo.appendChild(loading);
    secao.append(conteudo);
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
    criarCampoLeituraMapa(secaoDetalhes, "preço compra", `${formatarEuroProdutoModal(produto.preco_compra)} €`);
    criarCampoLeituraMapa(secaoDetalhes, "preço venda", `${formatarEuroProdutoModal(produto.preco)} €`);
    criarCampoLeituraMapa(secaoDetalhes, "Peso (g)", Number(produto.peso || PESO_PADRAO_PRODUTO_GRAMAS || 10));
    criarCampoLeituraMapa(secaoDetalhes, "Lego", textoLegoProdutoModal(produto.lego) || "por verificar");
    if (Number(produto.unidades_por_embalagem || 1) > 1) {
        criarCampoLeituraMapa(secaoDetalhes, "Unid/emb.", Number(produto.unidades_por_embalagem));
    }
    topo.appendChild(secaoDetalhes);

    const observacoesTexto = String(produto.observacoes || "").trim();
    if (observacoesTexto) {
        topo.classList.add("mapas-produto-ficha-topo-com-obs");
        const secaoObsLeitura = criarSecaoEdicaoMapa("Observações", "mapas-produto-secao-media");
        const textoObs = document.createElement("p");
        textoObs.className = "mapas-produto-observacoes-leitura";
        textoObs.textContent = observacoesTexto;
        secaoObsLeitura.appendChild(textoObs);
        topo.appendChild(secaoObsLeitura);
    }

    const secaoMarcas = criarSecaoEdicaoMapa("Estado", "mapas-produto-secao-marcas");
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
    // Só o quadrado deve responder ao clique - qualquer clique na label (texto,
    // espaço vazio à volta) que não seja diretamente no input é ignorado.
    label.addEventListener("click", (evento) => {
        if (evento.target !== input) {
            evento.preventDefault();
        }
    });
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
    ligarFechoModalPorFundo(modal, fecharEdicaoProdutoMapa);
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
    const { temas, subtemas, subtemasPorTema } = obterTemasESubtemasExistentesMapa();
    criarInputEdicaoMapa(secaoIdentificacao, "mapas-editar-tema", "Tema", produto.tema || "", "text", { required: true, listaId: "mapas-lista-temas", listaOpcoes: temas });
    const inputSubtema = criarInputEdicaoMapa(secaoIdentificacao, "mapas-editar-subtema", "Subtema", produto.subtema === "semsubtema" ? "" : (produto.subtema || ""), "text", { listaId: "mapas-lista-subtemas", listaOpcoes: subtemas });
    const inputTema = secaoIdentificacao.querySelector("#mapas-editar-tema");
    const datalistSubtema = secaoIdentificacao.querySelector("#mapas-lista-subtemas");
    if (inputTema && datalistSubtema) {
        inputTema.addEventListener("input", () => {
            const temaAtual = inputTema.value.trim();
            const opcoesFiltradas = subtemasPorTema[temaAtual] || subtemas;
            datalistSubtema.replaceChildren();
            opcoesFiltradas.forEach((texto) => {
                const option = document.createElement("option");
                option.value = texto;
                datalistSubtema.appendChild(option);
            });
        });
    }
    campos.appendChild(secaoIdentificacao);

    const linhaDetalhesEstado = document.createElement("div");
    linhaDetalhesEstado.className = "mapas-produto-linha-detalhes-estado";

    const secaoDetalhes = criarSecaoEdicaoMapa("Detalhes", "mapas-produto-secao-detalhes");
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-stock", "Stock", Number(produto.stock || 0), "number", { required: true, step: 1 });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-preco-compra", "preço compra", Number(produto.preco_compra || 0).toFixed(2), "number", { min: 0, step: "0.01" });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-preco", "preço venda", Number(produto.preco || 0).toFixed(2), "number", { required: true, min: 0, step: "0.01" });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-peso", "Peso (g)", Number(produto.peso || PESO_PADRAO_PRODUTO_GRAMAS || 10), "number", { required: true, min: 1, step: 1 });
    criarSelectEdicaoMapa(secaoDetalhes, "mapas-editar-lego", "Lego", textoLegoProdutoModal(produto.lego), [
        { valor: "", texto: "por verificar" },
        { valor: "sim", texto: "sim" },
        { valor: "não", texto: "não" }
    ]);
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-unidades-por-embalagem", "Unidades por embalagem", Number(produto.unidades_por_embalagem || 1), "number", { required: true, min: 1, step: 1 });
    linhaDetalhesEstado.appendChild(secaoDetalhes);

    const secaoEstado = criarSecaoEdicaoMapa("Estado", "mapas-produto-secao-marcas");
    criarCheckboxEdicaoMapa(secaoEstado, "mapas-editar-ativo", "Produto ativo", produto.ativo !== false);
    criarCheckboxEdicaoMapa(secaoEstado, "mapas-editar-top", "Top", Boolean(String(produto.top || "").trim()));
    criarCheckboxEdicaoMapa(secaoEstado, "mapas-editar-arquivado", "Arquivado", Boolean(produto.arquivado));
    criarCheckboxEdicaoMapa(secaoEstado, "mapas-editar-descontinuado", "Descontinuado", Boolean(produto.descontinuado));
    criarCheckboxEdicaoMapa(secaoEstado, "mapas-editar-novidade", "Novidade", modo === "criar" ? true : Boolean(produto.novidade));
    linhaDetalhesEstado.appendChild(secaoEstado);

    campos.appendChild(linhaDetalhesEstado);

    montarSecaoMediaEdicaoMapa(campos, produto);
    montarSecoesExtraEdicaoMapa(campos, produto, modo);

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
        sku: normalizarSkuProdutoModal(document.getElementById("mapas-editar-sku").value),
        lego: document.getElementById("mapas-editar-lego").value,
        top: document.getElementById("mapas-editar-top").checked ? "sim" : "",
        arquivado: document.getElementById("mapas-editar-arquivado").checked,
        descontinuado: document.getElementById("mapas-editar-descontinuado").checked,
        novidade: document.getElementById("mapas-editar-novidade").checked,
        preco_compra: Number(document.getElementById("mapas-editar-preco-compra").value || 0),
        preco: Number(document.getElementById("mapas-editar-preco").value),
        peso: Number(document.getElementById("mapas-editar-peso").value || 10),
        stock: Math.floor(Number(document.getElementById("mapas-editar-stock").value || 0)),
        unidades_por_embalagem: Math.max(1, Math.floor(Number(document.getElementById("mapas-editar-unidades-por-embalagem")?.value || 1))),
        tema: document.getElementById("mapas-editar-tema").value.trim(),
        subtema: document.getElementById("mapas-editar-subtema").value.trim() || "semsubtema",
        observacoes: observacoesCampo
            ? observacoesCampo.value.trim()
            : (produtoAtual?.observacoes || ""),
        imagens: imagensCampo
            ? obterUrlsImagensEdicaoMapa()
            : normalizarImagensMapa(produtoAtual?.imagens),
        fornecedores: lerFornecedoresEditadosMapa(produtoAtual),
        ativo: document.getElementById("mapas-editar-ativo").checked
    };
    if (!produto.nome || !produto.sku || !produto.tema || !Number.isFinite(produto.preco) || produto.preco < 0 || !Number.isFinite(produto.preco_compra) || produto.preco_compra < 0 || !Number.isFinite(produto.peso) || produto.peso < 1 || !Number.isFinite(produto.stock)) {
        throw new Error("Preencha nome, SKU, tema, preço venda, preço compra, stock e peso corretamente.");
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


window.MapasProdutoModal = {
  abrirFicha: abrirFichaProdutoMapa,
  abrirEdicao: abrirEdicaoProdutoMapa,
  abrirEditar: abrirEdicaoProdutoMapa,
  abrirCriacao: abrirCriacaoProdutoMapa,
  fechar: fecharEdicaoProdutoMapa,
  guardar: guardarEdicaoProdutoMapa
};
})();
