
const CLIENTES_SUPABASE_URL = "https://gksndzxadndrsynvzgzb.supabase.co";
const CLIENTES_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrc25kenhhZG5kcnN5bnZ6Z3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc5NzMsImV4cCI6MjA5NDY2Mzk3M30.EHZgacYr27dqoc4CJHsOwkNnJFGlLIteSHBi4B1HfVE";
const CLIENTES_ADMIN_EMAILS = ["worldminifigures4u@gmail.com"];

let clientesClient = null;
let clientesLista = [];
let clienteAbertoId = "";

function criarElementoCliente(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function obterUrlExternoSeguroCliente(valor) {
    const texto = String(valor || "").trim();
    if (!texto) return "";
    try {
        const url = new URL(texto);
        return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_) {
        return "";
    }
}

function definirStatusClientes(texto, erro = false) {
    const status = document.getElementById("clientes-status");
    status.textContent = texto || "";
    status.classList.toggle("msg-erro", erro);
    status.classList.toggle("msg-sucesso", Boolean(texto) && !erro);
}

function formatarEuroCliente(valor) {
    return Number(valor || 0).toFixed(2).replace(".", ",") + " €";
}

function formatarDataCliente(valor) {
    if (!valor) return "-";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return String(valor);
    return new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    }).format(data);
}

function criarCampoCliente(rotulo, valor) {
    const campo = criarElementoCliente("div", "admin-cliente-campo");
    campo.append(
        criarElementoCliente("strong", "", rotulo),
        criarElementoCliente("span", "", valor || "-")
    );
    return campo;
}

function criarInputCliente(rotulo, nome, valor, tipo = "text", obrigatorio = false) {
    const campo = document.createElement("label");
    campo.className = "admin-cliente-formulario-campo";
    campo.classList.add(`admin-cliente-campo-${nome}`);
    campo.appendChild(criarElementoCliente("span", "", rotulo));
    const input = document.createElement("input");
    input.type = tipo;
    input.name = nome;
    input.value = valor || "";
    input.required = obrigatorio;
    input.autocomplete = "off";
    campo.appendChild(input);
    return campo;
}

function criarCheckboxCliente(rotulo, nome, marcado = false) {
    const campo = document.createElement("label");
    campo.className = "admin-cliente-formulario-campo admin-cliente-formulario-checkbox";
    campo.classList.add(`admin-cliente-campo-${nome}`);
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = nome;
    input.checked = Boolean(marcado);
    campo.append(input, criarElementoCliente("span", "", rotulo));
    return campo;
}

function criarIconeAvisoCliente(classe = "clientes-lista-aviso") {
    const aviso = document.createElement("span");
    aviso.className = classe;
    aviso.title = "Cliente com aviso a ler.";
    aviso.setAttribute("aria-label", "Cliente com aviso a ler");

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const circuloBranco = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circuloBranco.setAttribute("cx", "12");
    circuloBranco.setAttribute("cy", "12");
    circuloBranco.setAttribute("r", "11.5");
    circuloBranco.setAttribute("fill", "#fff");

    const grupo = document.createElementNS("http://www.w3.org/2000/svg", "g");
    grupo.setAttribute("transform", "translate(12 12)");

    const triangulo = document.createElementNS("http://www.w3.org/2000/svg", "path");
    triangulo.setAttribute(
        "d",
        "M0 -10.6 L9.18 5.3 L-9.18 5.3 Z"
    );
    triangulo.setAttribute("fill", "#ffcc00");
    triangulo.setAttribute("stroke", "#111");
    triangulo.setAttribute("stroke-width", "1.2");
    triangulo.setAttribute("stroke-linejoin", "round");

    const barra = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    barra.setAttribute("x", "-0.9");
    barra.setAttribute("y", "-3");
    barra.setAttribute("width", "1.8");
    barra.setAttribute("height", "6");
    barra.setAttribute("rx", "0.9");
    barra.setAttribute("fill", "#111");

    const ponto = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    ponto.setAttribute("cx", "0");
    ponto.setAttribute("cy", "4.7");
    ponto.setAttribute("r", "1");
    ponto.setAttribute("fill", "#111");

    grupo.append(triangulo, barra, ponto);
    svg.append(circuloBranco, grupo);
    aviso.appendChild(svg);
    return aviso;
}

function criarTextareaCliente(rotulo, nome, valor, linhas = 6) {
    const campo = document.createElement("label");
    campo.className = "admin-cliente-formulario-campo admin-cliente-formulario-notas";
    campo.classList.add(`admin-cliente-campo-${nome}`);
    campo.appendChild(criarElementoCliente("span", "", rotulo));
    const textarea = document.createElement("textarea");
    textarea.className = "admin-cliente-notas";
    textarea.name = nome;
    textarea.rows = linhas;
    textarea.value = valor || "";
    textarea.placeholder = "Notas internas visiveis apenas ao administrador.";
    campo.appendChild(textarea);
    return campo;
}

async function guardarAvisoClienteAdmin(clienteId, temAviso) {
    if (!clienteId) return { data: null, error: null };
    return clientesClient.rpc("guardar_aviso_cliente_admin", {
        p_cliente_id: clienteId,
        p_tem_aviso: Boolean(temAviso)
    });
}

function obterPerfisFormularioCliente(formulario) {
    return Array.from(formulario.querySelectorAll('[name^="perfil_url_"]'))
        .map(input => ({ url: obterUrlExternoSeguroCliente(input.value) }))
        .filter(perfil => perfil.url);
}

function renderizarClientesLista() {
    const caixa = document.getElementById("clientes-lista");
    caixa.replaceChildren();
    if (!clientesLista.length) {
        caixa.appendChild(criarElementoCliente("p", "admin-cliente-vazio", "Nenhum cliente encontrado."));
        return;
    }

    clientesLista.forEach(item => {
        const cliente = item.cliente || {};
        const resumo = item.resumo || {};
        const perfis = Array.isArray(item.perfis) ? item.perfis : [];
        const botao = criarElementoCliente("button", "clientes-lista-item", "");
        botao.type = "button";
        botao.classList.toggle("ativo", String(cliente.id) === String(clienteAbertoId));
        botao.addEventListener("click", () => abrirCliente(cliente.id));

        const linhaNome = criarElementoCliente("div", "clientes-lista-linha-nome");
        if (cliente.tem_aviso) {
            linhaNome.appendChild(criarIconeAvisoCliente());
        }
        linhaNome.appendChild(criarElementoCliente("strong", "", cliente.nome || "Cliente sem nome"));
        const detalhes = criarElementoCliente("span", "", [
            cliente.telefone,
            cliente.cidade,
            `${Number(resumo.encomendas || 0)} encomenda(s)`
        ].filter(Boolean).join(" | "));
        const links = criarElementoCliente("small", "", perfis.map(perfil => `${perfil.plataforma}: ${perfil.utilizador}`).join(" | "));
        botao.append(linhaNome, detalhes, links);
        caixa.appendChild(botao);
    });
}

async function pesquisarClientes() {
    const termo = document.getElementById("clientes-pesquisa").value.trim();
    definirStatusClientes("A pesquisar clientes...");
    const { data, error } = await clientesClient.rpc("listar_clientes_admin", {
        p_pesquisa: termo
    });
    if (error) {
        definirStatusClientes("Erro ao pesquisar clientes: " + (error.message || "sem detalhe"), true);
        return;
    }
    clientesLista = Array.isArray(data) ? data : [];
    renderizarClientesLista();
    definirStatusClientes(`${clientesLista.length} cliente(s) encontrado(s).`);
}

async function abrirCliente(clienteId) {
    clienteAbertoId = String(clienteId || "");
    renderizarClientesLista();
    const ficha = document.getElementById("clientes-ficha");
    ficha.replaceChildren(criarElementoCliente("p", "admin-cliente-carregar", "A carregar ficha do cliente..."));
    const { data, error } = await clientesClient.rpc("obter_ficha_cliente_por_id_admin", {
        p_cliente_id: clienteId
    });
    if (error || data?.sucesso === false) {
        ficha.replaceChildren(criarElementoCliente("p", "admin-cliente-vazio", "Erro ao carregar ficha."));
        definirStatusClientes("Erro ao carregar ficha: " + (error?.message || data?.erro || "sem detalhe"), true);
        return;
    }
    renderizarFichaCliente(data);
}

function renderizarFormularioCliente(dados, modo = "editar") {
    const ficha = document.getElementById("clientes-ficha");
    const cliente = dados.cliente || {};
    const perfis = Array.isArray(dados.perfis) ? dados.perfis : [];
    const novoCliente = modo === "novo";
    clienteAbertoId = novoCliente ? "" : String(cliente.id || "");
    renderizarClientesLista();
    const formulario = document.createElement("form");
    formulario.className = "admin-cliente-formulario clientes-formulario";
    formulario.append(
        criarInputCliente("Nome", "nome", cliente.nome, "text", true),
        criarInputCliente("Morada", "morada", cliente.morada),
        criarInputCliente("C\u00f3digo postal", "cp", cliente.cp),
        criarInputCliente("Cidade", "cidade", cliente.cidade),
        criarInputCliente("Pa\u00eds", "pais", cliente.pais),
        criarInputCliente("E-mail", "email", cliente.email, "email"),
        criarInputCliente("Telem\u00f3vel", "telefone", cliente.telefone)
    );

    formulario.appendChild(criarElementoCliente("h3", "admin-cliente-formulario-subtitulo", "Links externos"));
    for (let indice = 0; indice < 5; indice += 1) {
        formulario.appendChild(criarInputCliente(
            `Link externo ${indice + 1}`,
            `perfil_url_${indice + 1}`,
            perfis[indice]?.url || "",
            "url"
        ));
    }

    formulario.appendChild(criarTextareaCliente("Notas internas", "notas", cliente.notas));

    const rodapeFormulario = criarElementoCliente("div", "clientes-formulario-rodape");
    rodapeFormulario.appendChild(criarCheckboxCliente("Cliente com aviso a ler", "tem_aviso", cliente.tem_aviso));

    const acoes = criarElementoCliente("div", "admin-cliente-formulario-acoes");
    const cancelar = criarElementoCliente("button", "wallapop-botao", "Cancelar");
    cancelar.type = "button";
    cancelar.addEventListener("click", () => {
        if (novoCliente) {
            ficha.replaceChildren(criarElementoCliente("p", "admin-cliente-vazio", "Escolha um cliente para abrir a ficha."));
            definirStatusClientes("");
        } else {
            renderizarFichaCliente(dados);
        }
    });
    const guardar = criarElementoCliente("button", "wallapop-botao wallapop-botao-destaque", novoCliente ? "Gravar" : "Guardar ficha");
    guardar.type = "submit";
    acoes.append(cancelar, guardar);
    formulario.appendChild(acoes);

    formulario.addEventListener("submit", async evento => {
        evento.preventDefault();
        guardar.disabled = true;
        cancelar.disabled = true;
        definirStatusClientes(novoCliente ? "A criar cliente..." : "A guardar ficha...");
        const campos = new FormData(formulario);
        const parametrosCliente = {
            p_nome: String(campos.get("nome") || ""),
            p_email: String(campos.get("email") || ""),
            p_telefone: String(campos.get("telefone") || ""),
            p_morada: String(campos.get("morada") || ""),
            p_cp: String(campos.get("cp") || ""),
            p_cidade: String(campos.get("cidade") || ""),
            p_pais: String(campos.get("pais") || "")
        };
        const { data, error } = novoCliente
            ? await clientesClient.rpc("criar_cliente_externo_admin", parametrosCliente)
            : await clientesClient.rpc("atualizar_cliente_externo_admin", {
                p_cliente_id: cliente.id,
                ...parametrosCliente
            });
        if (error || data?.sucesso === false) {
            guardar.disabled = false;
            cancelar.disabled = false;
            definirStatusClientes("Erro ao guardar dados: " + (error?.message || data?.erro || "sem detalhe"), true);
            return;
        }
        const clienteId = data?.cliente?.id || cliente.id;
        const aviso = await guardarAvisoClienteAdmin(clienteId, campos.get("tem_aviso") === "on");
        const avisoErro = aviso.error || aviso.data?.sucesso === false
            ? (aviso.error?.message || aviso.data?.erro || "sem detalhe")
            : "";

        const perfis = await clientesClient.rpc("guardar_perfis_cliente_admin", {
            p_cliente_id: clienteId,
            p_perfis: obterPerfisFormularioCliente(formulario)
        });
        const notas = await clientesClient.rpc("guardar_notas_cliente_admin", {
            p_cliente_id: clienteId,
            p_notas: String(campos.get("notas") || "")
        });
        guardar.disabled = false;
        cancelar.disabled = false;
        if (perfis.error || perfis.data?.sucesso === false) {
            definirStatusClientes("Dados guardados, mas erro nos links: " + (perfis.error?.message || perfis.data?.erro || "sem detalhe"), true);
            return;
        }
        const notasErro = notas.error || notas.data?.sucesso === false
            ? (notas.error?.message || notas.data?.erro || "sem detalhe")
            : "";
        if (notasErro) {
            definirStatusClientes("Ficha guardada, mas as notas nao foram atualizadas: " + notasErro, true);
            await pesquisarClientes();
            await abrirCliente(clienteId);
            return;
        }
        definirStatusClientes(avisoErro
            ? "Ficha guardada, mas o aviso nao foi atualizado: " + avisoErro
            : (novoCliente ? "Cliente criado." : "Ficha guardada."),
            Boolean(avisoErro)
        );
        await pesquisarClientes();
        await abrirCliente(clienteId);
    });

    ficha.replaceChildren(formulario);
}

function criarClienteNovo() {
    renderizarFormularioCliente({
        cliente: { nome: "", email: "", telefone: "", morada: "", cp: "", cidade: "", pais: "", tem_aviso: false },
        perfis: [],
        historico: [],
        resumo: {}
    }, "novo");
}

async function apagarFichaCliente(dados, botao) {
    const cliente = dados.cliente || {};
    const nome = cliente.nome || "Cliente sem nome";
    const encomendas = Number(dados.resumo?.encomendas || 0);
    const avisoHistorico = encomendas > 0
        ? `\n\nEste cliente tem ${encomendas} encomenda(s). As encomendas ficam guardadas, mas deixam de estar ligadas a esta ficha.`
        : "";
    if (!window.confirm(`Apagar definitivamente a ficha de ${nome}?${avisoHistorico}`)) return;
    if (!window.confirm("Confirmar eliminação definitiva da ficha do cliente?")) return;

    botao.disabled = true;
    definirStatusClientes("A apagar ficha do cliente...");
    const { data, error } = await clientesClient.rpc("apagar_cliente_admin", {
        p_cliente_id: cliente.id
    });
    if (error || data?.sucesso === false) {
        botao.disabled = false;
        definirStatusClientes("Erro ao apagar ficha: " + (error?.message || data?.erro || "sem detalhe"), true);
        return;
    }

    clienteAbertoId = "";
    document.getElementById("clientes-ficha").replaceChildren(
        criarElementoCliente("p", "admin-cliente-vazio", "Escolha um cliente para abrir a ficha.")
    );
    await pesquisarClientes();
    definirStatusClientes(`Ficha de ${nome} apagada.`);
}

function renderizarFichaCliente(dados) {
    const ficha = document.getElementById("clientes-ficha");
    const cliente = dados.cliente || {};
    const perfis = Array.isArray(dados.perfis) ? dados.perfis : [];
    const historico = Array.isArray(dados.historico) ? dados.historico : [];
    const resumo = dados.resumo || {};
    ficha.replaceChildren();

    const topo = criarElementoCliente("div", "clientes-ficha-topo");
    const titulo = criarElementoCliente("h2", "", cliente.nome || "Cliente sem nome");
    if (cliente.tem_aviso) {
        const aviso = criarIconeAvisoCliente("clientes-aviso-badge");
        aviso.append(document.createTextNode("Aviso a ler"));
        titulo.appendChild(aviso);
    }
    topo.append(titulo);
    const editar = criarElementoCliente("button", "wallapop-botao wallapop-botao-destaque", "Editar ficha");
    editar.type = "button";
    editar.addEventListener("click", () => renderizarFormularioCliente(dados));
    const apagar = criarElementoCliente("button", "wallapop-botao clientes-botao-apagar", "Apagar ficha");
    apagar.type = "button";
    apagar.addEventListener("click", () => apagarFichaCliente(dados, apagar));
    const acoesTopo = criarElementoCliente("div", "clientes-ficha-acoes");
    acoesTopo.append(editar, apagar);
    topo.appendChild(acoesTopo);

    const grelha = criarElementoCliente("div", "admin-cliente-grelha");
    grelha.append(
        criarCampoCliente("E-mail", cliente.email),
        criarCampoCliente("Telemóvel", cliente.telefone),
        criarCampoCliente("Morada", [cliente.morada, cliente.cp, cliente.cidade, cliente.pais].filter(Boolean).join(", ")),
        criarCampoCliente("Aviso", cliente.tem_aviso ? "Sim - ler notas internas" : "N\u00e3o"),
        criarCampoCliente("Encomendas", String(resumo.encomendas || 0)),
        criarCampoCliente("Total comprado", formatarEuroCliente(resumo.total)),
        criarCampoCliente("Última compra", formatarDataCliente(resumo.ultima_compra))
    );

    const perfisSecao = criarElementoCliente("section", "admin-cliente-secao");
    perfisSecao.appendChild(criarElementoCliente("h3", "", "Links externos"));
    const listaPerfis = criarElementoCliente("div", "admin-cliente-perfis");
    if (!perfis.length) {
        listaPerfis.appendChild(criarElementoCliente("p", "admin-cliente-vazio", "Sem links externos."));
    } else {
        perfis.forEach(perfil => {
            const link = criarElementoCliente("a", "admin-cliente-perfil", `${perfil.plataforma}: ${perfil.utilizador}`);
            link.href = obterUrlExternoSeguroCliente(perfil.url) || "#";
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            listaPerfis.appendChild(link);
        });
    }
    perfisSecao.appendChild(listaPerfis);

    const notasSecao = criarElementoCliente("section", "admin-cliente-secao");
    notasSecao.appendChild(criarElementoCliente("h3", "", "Notas internas"));
    const notas = document.createElement("textarea");
    notas.className = "admin-cliente-notas";
    notas.rows = 6;
    notas.value = cliente.notas || "";
    const guardarNotas = criarElementoCliente("button", "wallapop-botao wallapop-botao-destaque", "Guardar notas");
    guardarNotas.type = "button";
    guardarNotas.addEventListener("click", async () => {
        guardarNotas.disabled = true;
        const { data, error } = await clientesClient.rpc("guardar_notas_cliente_admin", {
            p_cliente_id: cliente.id,
            p_notas: notas.value
        });
        guardarNotas.disabled = false;
        if (error || data?.sucesso === false) {
            definirStatusClientes("Erro ao guardar notas: " + (error?.message || data?.erro || "sem detalhe"), true);
            return;
        }
        definirStatusClientes("Notas guardadas.");
    });
    notasSecao.append(notas, guardarNotas);

    const historicoSecao = criarElementoCliente("section", "admin-cliente-secao");
    historicoSecao.appendChild(criarElementoCliente("h3", "", "Histórico de encomendas"));
    const listaHistorico = criarElementoCliente("div", "admin-cliente-historico");
    historico.forEach(item => {
        const linha = criarElementoCliente("div", "admin-cliente-historico-linha");
        linha.append(
            criarElementoCliente("strong", "", item.codigo || `#${item.id}`),
            criarElementoCliente("span", "", item.origem || "Site"),
            criarElementoCliente("span", "", item.estado || ""),
            criarElementoCliente("span", "", formatarDataCliente(item.data)),
            criarElementoCliente("strong", "", formatarEuroCliente(item.total))
        );
        listaHistorico.appendChild(linha);
    });
    if (!historico.length) listaHistorico.appendChild(criarElementoCliente("p", "admin-cliente-vazio", "Sem encomendas associadas."));
    historicoSecao.appendChild(listaHistorico);

    ficha.append(topo, grelha, perfisSecao, notasSecao, historicoSecao);
}

async function iniciarClientesAdmin() {
    const bloqueio = document.getElementById("clientes-bloqueio");
    try {
        if (typeof supabase === "undefined") throw new Error("A biblioteca Supabase nao carregou.");
        clientesClient = supabase.createClient(CLIENTES_SUPABASE_URL, CLIENTES_SUPABASE_KEY);
        const { data: { user }, error } = await clientesClient.auth.getUser();
        if (error || !user || !CLIENTES_ADMIN_EMAILS.includes(String(user.email || "").toLowerCase())) {
            bloqueio.textContent = "Acesso reservado ao administrador. A regressar a conta...";
            setTimeout(() => window.location.replace("conta.html"), 1400);
            return;
        }
        mostrarNavegacaoAdminValidada();
        bloqueio.hidden = true;
        document.getElementById("clientes-aplicacao").hidden = false;
        await pesquisarClientes();
    } catch (error) {
        console.error(error);
        bloqueio.textContent = "Erro ao abrir clientes: " + (error.message || "sem detalhe");
    }
}

document.getElementById("btn-pesquisar-clientes").addEventListener("click", pesquisarClientes);
document.getElementById("btn-criar-cliente").addEventListener("click", criarClienteNovo);
document.getElementById("clientes-pesquisa").addEventListener("input", () => {
    clearTimeout(window.__clientesPesquisaTimer);
    window.__clientesPesquisaTimer = setTimeout(pesquisarClientes, 250);
});
window.addEventListener("load", iniciarClientesAdmin);
