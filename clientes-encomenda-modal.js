let clientesHistoricoConsulta = [];
let clientesIndiceConsulta = 0;
let clientesEncomendaModalAtual = null;

function obterSupabaseModalEncomendaCliente() {
    if (typeof clientesClient !== "undefined" && clientesClient) return clientesClient;
    if (typeof encomendasClient !== "undefined" && encomendasClient) return encomendasClient;
    return null;
}

function criarElementoModalEncomendaCliente(tag, classe, texto) {
    if (typeof criarElementoCliente === "function") return criarElementoCliente(tag, classe, texto);
    if (typeof criarElementoEncomenda === "function") return criarElementoEncomenda(tag, classe, texto);
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function formatarDataModalEncomendaCliente(valor) {
    if (typeof formatarDataCliente === "function") return formatarDataCliente(valor);
    if (typeof formatarDataEncomenda === "function") return formatarDataEncomenda(valor);
    return String(valor || "");
}

function formatarEuroModalEncomendaCliente(valor) {
    if (typeof formatarEuroCliente === "function") return formatarEuroCliente(valor);
    if (typeof formatarEuroEncomenda === "function") return formatarEuroEncomenda(valor);
    return String(valor ?? "");
}

function obterClassePlataformaModalEncomendaCliente(origem) {
    const normalizada = AdminEncomendaVista.normalizar(origem).replace(/\s+/g, "-");
    return normalizada ? ` plataforma-${normalizada}` : "";
}

function obterVoltarAoEditarModalEncomendaCliente() {
    if (document.body.classList.contains("pagina-clientes-admin")) return "clientes";
    if (document.body.classList.contains("pagina-encomendas-admin")) return "encomendas";
    return "";
}

function definirStatusModalEncomendaCliente(texto, erro = false) {
    const status = document.getElementById("clientes-encomenda-status");
    if (!status) return;
    status.textContent = texto || "";
    status.classList.toggle("msg-erro", erro);
    status.classList.toggle("msg-sucesso", Boolean(texto) && !erro);
}

function marcarBotaoTopoModalEncomendaCliente(botao) {
    if (!botao) return;
    botao.classList.add("admin-encomenda-modal-botao", "admin-encomenda-topo-compacto");
}

function reporBotaoFecharTopoModalEncomendaCliente() {
    const modal = document.getElementById("clientes-encomenda-modal");
    const topo = modal?.querySelector(".clientes-encomenda-topo");
    const botaoFechar = document.getElementById("clientes-encomenda-fechar");
    if (botaoFechar && topo && botaoFechar.parentElement !== topo) {
        topo.appendChild(botaoFechar);
    }
}

function limparTopoModalEncomendaCliente() {
    reporBotaoFecharTopoModalEncomendaCliente();
    document.getElementById("clientes-encomenda-modal-acoes")?.replaceChildren();
    const titulo = document.getElementById("clientes-encomenda-titulo");
    if (!titulo) return;
    titulo.classList.remove("admin-encomenda-modal-titulo-resumo");
    titulo.textContent = "Consulta de encomenda";
    titulo.removeAttribute("title");
}

function preencherTituloModalEncomendaCliente(encomenda = {}) {
    const titulo = document.getElementById("clientes-encomenda-titulo");
    if (!titulo) return;
    const codigo = String(encomenda.codigo_encomenda || encomenda.id || "").trim();
    const data = formatarDataModalEncomendaCliente(encomenda.data_pagamento || encomenda.created_at);
    const origem = String(encomenda.origem || "Site").trim() || "Site";
    const cliente = AdminEncomendaVista.obterNomeTituloEncomenda(encomenda) || "Cliente sem nome";
    const origemClasse = `admin-encomenda-modal-titulo-origem${obterClassePlataformaModalEncomendaCliente(origem)}`;
    const clienteTexto = criarElementoModalEncomendaCliente("span", "admin-encomenda-modal-titulo-cliente", cliente);
    titulo.classList.add("admin-encomenda-modal-titulo-resumo");
    titulo.replaceChildren(...[
        codigo ? criarElementoModalEncomendaCliente("span", "admin-encomenda-modal-titulo-codigo", codigo) : null,
        criarElementoModalEncomendaCliente("span", "admin-encomenda-modal-titulo-data", data),
        criarElementoModalEncomendaCliente("span", origemClasse, origem),
        clienteTexto
    ].filter(Boolean));
    titulo.title = [codigo, data, origem, cliente].filter(Boolean).join(" · ");
}

function moverAcoesParaTopoModalEncomendaCliente(card) {
    const acoesTopo = document.getElementById("clientes-encomenda-modal-acoes");
    const botoes = card?.querySelector(".admin-encomenda-dados-botoes");
    if (!acoesTopo || !botoes) return;

    const colunaAcoes = botoes.closest(".admin-encomenda-dados-acoes");
    const estado = card?.querySelector(".admin-encomenda-gestao-estado");
    const statusGravacao = card?.querySelector(".admin-encomenda-gravar-status-modal");
    const botaoFechar = document.getElementById("clientes-encomenda-fechar");
    botoes.classList.add("admin-encomenda-modal-botoes");
    estado?.classList.add("admin-encomenda-modal-estado");

    const botaoAnexos = botoes.querySelector(".admin-encomenda-anexos-escolher-acao");
    const ordemPreferida = [
        botoes.querySelector(".admin-encomenda-apagar"),
        botoes.querySelector(".admin-encomenda-editar"),
        botoes.querySelector(".admin-encomenda-exportar"),
        botoes.querySelector(".admin-encomenda-gravar")
    ].filter(Boolean);
    const restantes = Array.from(botoes.children).filter(botao => !ordemPreferida.includes(botao) && botao !== botaoAnexos);
    botoes.replaceChildren(...ordemPreferida, ...restantes);
    botoes.querySelectorAll("a, button, label").forEach(marcarBotaoTopoModalEncomendaCliente);

    marcarBotaoTopoModalEncomendaCliente(botaoFechar);
    if (botaoFechar) botoes.appendChild(botaoFechar);
    statusGravacao?.classList.add("admin-encomenda-modal-status");
    acoesTopo.replaceChildren(...[estado, botoes, statusGravacao].filter(Boolean));
    colunaAcoes?.remove();
}

function fecharModalEncomendaCliente() {
    const modal = document.getElementById("clientes-encomenda-modal");
    if (!modal) return;
    reporBotaoFecharTopoModalEncomendaCliente();
    modal.hidden = true;
    document.getElementById("clientes-encomenda-conteudo")?.replaceChildren();
    document.getElementById("clientes-encomenda-modal-acoes")?.replaceChildren();
    definirStatusModalEncomendaCliente("");
    document.body.classList.remove("clientes-encomenda-modal-aberto");
    clientesEncomendaModalAtual = null;
}

function sincronizarHistoricoClienteModal(itemResumo) {
    if (!itemResumo) return;
    const linhas = document.querySelectorAll(".admin-cliente-historico-linha");
    const item = clientesHistoricoConsulta[clientesIndiceConsulta];
    if (!item) return;
    item.estado = itemResumo.estado ?? item.estado;
    item.total = itemResumo.total ?? item.total;
    item.data = itemResumo.created_at ?? item.data;
    const linha = linhas[clientesIndiceConsulta];
    if (!linha) return;
    const spans = linha.querySelectorAll("span");
    if (spans[1]) spans[1].textContent = itemResumo.origem || item.origem || "Site";
    if (spans[2]) spans[2].textContent = AdminEncomendaVista.estadoNormalizado(itemResumo.estado || item.estado);
    if (spans[3]) spans[3].textContent = formatarDataModalEncomendaCliente(itemResumo.created_at || item.data);
    const total = linha.querySelector("strong:last-child");
    if (total) total.textContent = formatarEuroModalEncomendaCliente(itemResumo.total ?? item.total);
}

async function renderizarModalEncomendaCliente() {
    const item = clientesHistoricoConsulta[clientesIndiceConsulta];
    const conteudo = document.getElementById("clientes-encomenda-conteudo");
    if (!item?.id || !conteudo) return;

    limparTopoModalEncomendaCliente();
    conteudo.replaceChildren(criarElementoModalEncomendaCliente("p", "admin-cliente-carregar", "A carregar encomenda..."));
    const supabaseAdmin = obterSupabaseModalEncomendaCliente();
    if (!supabaseAdmin) {
        conteudo.replaceChildren(criarElementoModalEncomendaCliente("p", "admin-cliente-vazio", "Erro ao carregar encomenda."));
        definirStatusModalEncomendaCliente("Cliente Supabase indisponivel.", true);
        return;
    }

    const { data, error } = await supabaseAdmin
        .from("encomendas")
        .select("*")
        .eq("id", String(item.id))
        .single();

    if (error || !data) {
        conteudo.replaceChildren(criarElementoModalEncomendaCliente("p", "admin-cliente-vazio", "Erro ao carregar encomenda."));
        definirStatusModalEncomendaCliente(error?.message || "Encomenda nao encontrada.", true);
        return;
    }

    try {
        const ficha = await supabaseAdmin.rpc("obter_ficha_cliente_admin", {
            p_encomenda_id: String(data.id)
        });
        if (!ficha.error && ficha.data?.sucesso) {
            AdminEncomendaVista.aplicarFichaClienteEncomenda(data, ficha.data);
        }
    } catch (erroFicha) {
        console.warn("Nao foi possivel atualizar a ficha do cliente na encomenda.", erroFicha);
    }

    clientesEncomendaModalAtual = data;
    item.estado = data.estado;
    item.total = data.total;
    item.data = data.created_at;
    item.codigo = data.codigo_encomenda || item.codigo;

    await AdminEncomendaVista.carregarImagensParaEncomendas([data]);
    const card = AdminEncomendaVista.criarCardEncomenda(data, {
        modoModal: true,
        voltarAoEditar: obterVoltarAoEditarModalEncomendaCliente()
    });
    moverAcoesParaTopoModalEncomendaCliente(card);
    preencherTituloModalEncomendaCliente(data);
    conteudo.replaceChildren(card);
    sincronizarHistoricoClienteModal(data);
}

function aoApagarEncomendaModalCliente(encomenda) {
    clientesHistoricoConsulta = clientesHistoricoConsulta.filter(item => String(item.id) !== String(encomenda.id));
    const linhas = document.querySelectorAll(".admin-cliente-historico-linha");
    linhas[clientesIndiceConsulta]?.remove();
    if (!clientesHistoricoConsulta.length) {
        fecharModalEncomendaCliente();
        return;
    }
    if (clientesIndiceConsulta >= clientesHistoricoConsulta.length) {
        clientesIndiceConsulta = clientesHistoricoConsulta.length - 1;
    }
    renderizarModalEncomendaCliente();
}

function abrirModalEncomendaCliente(historico, indiceInicial = 0) {
    if (!Array.isArray(historico) || !historico.length) return;
    clientesHistoricoConsulta = historico.filter(item => item?.id);
    if (!clientesHistoricoConsulta.length) return;

    clientesIndiceConsulta = Math.max(0, Math.min(indiceInicial, clientesHistoricoConsulta.length - 1));
    const modal = document.getElementById("clientes-encomenda-modal");
    if (!modal) return;

    modal.hidden = false;
    document.body.classList.add("clientes-encomenda-modal-aberto");
    definirStatusModalEncomendaCliente("");
    renderizarModalEncomendaCliente();
    document.getElementById("clientes-encomenda-fechar")?.focus();
}

function configurarModalEncomendaCliente() {
    AdminEncomendaVista.configurar({
        client: obterSupabaseModalEncomendaCliente(),
        hooks: {
            definirStatus: definirStatusModalEncomendaCliente,
            renderizarModal: () => {
                if (clientesEncomendaModalAtual && !document.getElementById("clientes-encomenda-modal")?.hidden) {
                    renderizarModalEncomendaCliente();
                }
            },
            atualizarResumo: () => {},
            obterLista: () => clientesHistoricoConsulta,
            definirLista: lista => { clientesHistoricoConsulta = lista; },
            onEncomendaApagada: aoApagarEncomendaModalCliente
        }
    });

    document.getElementById("clientes-encomenda-fechar")?.addEventListener("click", fecharModalEncomendaCliente);
    ligarFechoModalPorFundo(document.getElementById("clientes-encomenda-modal"), fecharModalEncomendaCliente);
    document.getElementById("admin-imagem-modal-fechar")?.addEventListener("click", () => {
        AdminEncomendaVista.fecharImagemProduto();
    });
    ligarFechoModalPorFundo(document.getElementById("admin-imagem-modal"), () => AdminEncomendaVista.fecharImagemProduto());
    document.addEventListener("keydown", evento => {
        const modal = document.getElementById("clientes-encomenda-modal");
        if (modal?.hidden) return;
        if (!document.getElementById("admin-imagem-modal")?.hidden) {
            if (evento.key === "Escape") AdminEncomendaVista.fecharImagemProduto();
            return;
        }
        if (evento.key === "Escape") fecharModalEncomendaCliente();
    });
}
