let clientesHistoricoConsulta = [];
let clientesIndiceConsulta = 0;
let clientesEncomendaModalAtual = null;

function definirStatusModalEncomendaCliente(texto, erro = false) {
    const status = document.getElementById("clientes-encomenda-status");
    if (!status) return;
    status.textContent = texto || "";
    status.classList.toggle("msg-erro", erro);
    status.classList.toggle("msg-sucesso", Boolean(texto) && !erro);
}

function fecharModalEncomendaCliente() {
    const modal = document.getElementById("clientes-encomenda-modal");
    if (!modal) return;
    modal.hidden = true;
    document.getElementById("clientes-encomenda-conteudo")?.replaceChildren();
    definirStatusModalEncomendaCliente("");
    document.body.classList.remove("clientes-encomenda-modal-aberto");
    clientesEncomendaModalAtual = null;
}

function atualizarNavegacaoModalEncomendaCliente() {
    const total = clientesHistoricoConsulta.length;
    const indice = clientesIndiceConsulta;
    const contador = document.getElementById("clientes-encomenda-contador");
    const anterior = document.getElementById("clientes-encomenda-anterior");
    const seguinte = document.getElementById("clientes-encomenda-seguinte");
    if (contador) {
        contador.textContent = total ? `Encomenda ${indice + 1} de ${total}` : "";
    }
    if (anterior) anterior.disabled = indice <= 0;
    if (seguinte) seguinte.disabled = indice >= total - 1;
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
    if (spans[3]) spans[3].textContent = formatarDataCliente(itemResumo.created_at || item.data);
    const total = linha.querySelector("strong:last-child");
    if (total) total.textContent = formatarEuroCliente(itemResumo.total ?? item.total);
}

async function renderizarModalEncomendaCliente() {
    const item = clientesHistoricoConsulta[clientesIndiceConsulta];
    const conteudo = document.getElementById("clientes-encomenda-conteudo");
    if (!item?.id || !conteudo) return;

    conteudo.replaceChildren(criarElementoCliente("p", "admin-cliente-carregar", "A carregar encomenda..."));
    atualizarNavegacaoModalEncomendaCliente();

    const { data, error } = await clientesClient
        .from("encomendas")
        .select("*")
        .eq("id", String(item.id))
        .single();

    if (error || !data) {
        conteudo.replaceChildren(criarElementoCliente("p", "admin-cliente-vazio", "Erro ao carregar encomenda."));
        definirStatusModalEncomendaCliente(error?.message || "Encomenda nao encontrada.", true);
        return;
    }

    clientesEncomendaModalAtual = data;
    item.estado = data.estado;
    item.total = data.total;
    item.data = data.created_at;
    item.codigo = data.codigo_encomenda || item.codigo;

    await AdminEncomendaVista.carregarImagensParaEncomendas([data]);
    conteudo.replaceChildren(AdminEncomendaVista.criarCardEncomenda(data, {
        modoModal: true,
        ocultarCliente: true
    }));
    sincronizarHistoricoClienteModal(data);
}

function irParaEncomendaModalCliente(delta) {
    const novoIndice = clientesIndiceConsulta + delta;
    if (novoIndice < 0 || novoIndice >= clientesHistoricoConsulta.length) return;
    clientesIndiceConsulta = novoIndice;
    definirStatusModalEncomendaCliente("");
    renderizarModalEncomendaCliente();
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
        client: clientesClient,
        hooks: {
            definirStatus: definirStatusModalEncomendaCliente,
            renderizarLista: () => {},
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
    document.getElementById("clientes-encomenda-anterior")?.addEventListener("click", () => irParaEncomendaModalCliente(-1));
    document.getElementById("clientes-encomenda-seguinte")?.addEventListener("click", () => irParaEncomendaModalCliente(1));
    document.getElementById("clientes-encomenda-modal")?.addEventListener("click", evento => {
        if (evento.target === evento.currentTarget) fecharModalEncomendaCliente();
    });
    document.getElementById("admin-imagem-modal-fechar")?.addEventListener("click", () => {
        AdminEncomendaVista.fecharImagemProduto();
    });
    document.getElementById("admin-imagem-modal")?.addEventListener("click", evento => {
        if (evento.target === evento.currentTarget) AdminEncomendaVista.fecharImagemProduto();
    });
    document.addEventListener("keydown", evento => {
        const modal = document.getElementById("clientes-encomenda-modal");
        if (modal?.hidden) return;
        if (!document.getElementById("admin-imagem-modal")?.hidden) {
            if (evento.key === "Escape") AdminEncomendaVista.fecharImagemProduto();
            return;
        }
        if (evento.key === "Escape") fecharModalEncomendaCliente();
        else if (evento.key === "ArrowLeft") irParaEncomendaModalCliente(-1);
        else if (evento.key === "ArrowRight") irParaEncomendaModalCliente(1);
    });
}
