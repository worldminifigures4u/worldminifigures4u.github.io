
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

function criarCampoCliente(rotulo, valor, classeExtra = "") {
    const campo = criarElementoCliente("div", `admin-cliente-campo${classeExtra ? ` ${classeExtra}` : ""}`);
    campo.append(
        criarElementoCliente("strong", "", rotulo),
        criarElementoCliente("span", "", valor || "-")
    );
    return campo;
}

function criarCampoFichaMoradaCliente(cliente) {
    const campo = criarElementoCliente("div", "admin-cliente-campo admin-cliente-campo-morada-bloco");
    campo.appendChild(criarElementoCliente("strong", "", "Morada"));
    const formatar = window.MoradaFormato;
    if (formatar?.criarBlocoMorada) {
        campo.appendChild(formatar.criarBlocoMorada(formatar.formatarLinhasMorada(cliente), criarElementoCliente));
    } else {
        campo.appendChild(criarElementoCliente(
            "span",
            "",
            [cliente.morada, cliente.cp, cliente.cidade, cliente.pais].filter(Boolean).join(", ") || "-"
        ));
    }
    return campo;
}

function obterRotuloPerfilCliente(perfil, indice) {
    if (perfil?.plataforma && perfil?.utilizador) {
        return `${perfil.plataforma}: ${perfil.utilizador}`;
    }
    const url = String(perfil?.url || "").trim();
    if (!url) return "";
    if (url.includes("wallapop.com")) {
        const match = url.match(/\/user\/([^/?#]+)/i);
        if (match) return `Wallapop: ${match[1]}`;
    }
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch (_) {
        return `Link externo ${indice + 1}`;
    }
}

function montarVistaConsultaCliente(dados, resumo = {}) {
    const cliente = dados.cliente || {};
    const perfis = Array.isArray(dados.perfis) ? dados.perfis : [];
    const contentor = criarElementoCliente("div", "clientes-ficha-consulta");

    const restricoes = criarSecaoRestricoesCliente(cliente);
    if (restricoes) contentor.appendChild(restricoes);

    const linhaPrincipal = criarElementoCliente("div", "clientes-ficha-consulta-principal");

    const colunaEsquerda = criarElementoCliente("div", "clientes-ficha-consulta-esquerda");
    colunaEsquerda.appendChild(criarSecaoResumoCliente(resumo));

    const dadosSecao = criarElementoCliente("section", "admin-cliente-secao clientes-ficha-consulta-dados");
    const grelha = criarElementoCliente("div", "admin-cliente-grelha");
    grelha.append(
        criarCampoFichaMoradaCliente(cliente),
        criarCampoCliente("Telem\u00f3vel", cliente.telefone, "admin-cliente-campo-telefone"),
        criarCampoCliente("E-mail", cliente.email, "admin-cliente-campo-email")
    );
    dadosSecao.appendChild(grelha);
    colunaEsquerda.appendChild(dadosSecao);
    linhaPrincipal.appendChild(colunaEsquerda);

    const notasSecao = criarElementoCliente("section", "admin-cliente-secao clientes-ficha-consulta-notas");
    const notas = criarElementoCliente("div", "admin-cliente-notas admin-cliente-notas-consulta");
    notas.textContent = String(cliente.notas || "").trim() || "Sem notas internas.";
    notasSecao.appendChild(notas);
    linhaPrincipal.appendChild(notasSecao);

    contentor.appendChild(linhaPrincipal);

    const linksSecao = criarElementoCliente("section", "admin-cliente-secao");
    const listaLinks = criarElementoCliente("div", "admin-cliente-perfis");
    const linksValidos = perfis
        .map((perfil, indice) => ({ perfil, indice, url: obterUrlExternoSeguroCliente(perfil?.url) }))
        .filter(item => item.url);
    if (!linksValidos.length) {
        listaLinks.appendChild(criarElementoCliente("p", "admin-cliente-vazio", "Nenhum link externo associado."));
    } else {
        linksValidos.forEach(({ perfil, indice, url }) => {
            const link = document.createElement("a");
            link.className = "admin-cliente-perfil";
            link.href = url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = obterRotuloPerfilCliente(perfil, indice);
            listaLinks.appendChild(link);
        });
    }
    linksSecao.appendChild(listaLinks);
    contentor.appendChild(linksSecao);

    return contentor;
}

function clienteRegistadoNoSite(cliente) {
    return Boolean(cliente?.auth_user_id);
}

function aplicarCamposClienteRegistadoSite(formulario, cliente) {
    if (!clienteRegistadoNoSite(cliente)) return;
    ["nome", "morada", "morada_linha1", "morada_linha2", "cp", "cidade", "pais", "email", "telefone"].forEach((nome) => {
        const input = formulario.querySelector(`input[name="${nome}"]`);
        if (!input) return;
        input.readOnly = true;
        input.title = "Gerido pelo cliente no site";
        input.closest(".admin-cliente-formulario-campo")?.classList.add("clientes-campo-site");
    });
    const aviso = criarElementoCliente(
        "p",
        "admin-cliente-aviso-conta clientes-aviso-edicao-site",
        "Os dados pessoais desta conta sao geridos pelo proprio cliente no site. Pode alterar aviso, restricoes, links externos e notas internas."
    );
    formulario.insertBefore(aviso, formulario.firstChild);
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

function criarIconeFichaCliente() {
    const aviso = document.createElement("span");
    aviso.className = "clientes-ficha-alerta";
    aviso.title = "Ler ficha do cliente antes de preparar a proxima encomenda";
    aviso.setAttribute("aria-label", "Ler ficha do cliente antes de preparar a proxima encomenda");

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("clientes-ficha-icone");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    [
        "M9 3h6a2 2 0 0 1 2 2h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1a2 2 0 0 1 2-2Z",
        "M9 5h6v2H9V5Z",
        "M8 11h8",
        "M8 15h8"
    ].forEach(d => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        svg.appendChild(path);
    });

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

function obterPerfisFormularioCliente(formulario) {
    return Array.from(formulario.querySelectorAll('[name^="perfil_url_"]'))
        .map(input => ({ url: obterUrlExternoSeguroCliente(input.value) }))
        .filter(perfil => perfil.url);
}

async function guardarAvisoClienteAdmin(clienteId, temAviso) {
    if (!clienteId) return { data: null, error: null };
    return clientesClient.rpc("guardar_aviso_cliente_admin", {
        p_cliente_id: clienteId,
        p_tem_aviso: Boolean(temAviso)
    });
}

async function guardarRestricoesClienteAdmin(clienteId, bloquearCompras, bloquearConta) {
    if (!clienteId) return { data: null, error: null };
    return clientesClient.rpc("guardar_restricoes_cliente_admin", {
        p_cliente_id: clienteId,
        p_bloquear_compras: Boolean(bloquearCompras),
        p_bloquear_conta: Boolean(bloquearConta)
    });
}

function criarBadgesRestricoesCliente(cliente, classeContentor = "clientes-restricoes-lista") {
    const lista = criarElementoCliente("div", classeContentor);
    if (cliente?.bloquear_conta) {
        lista.appendChild(criarElementoCliente("span", "clientes-restricao-badge clientes-restricao-conta", "Login bloqueado"));
    }
    if (cliente?.bloquear_compras) {
        lista.appendChild(criarElementoCliente("span", "clientes-restricao-badge clientes-restricao-compras", "Compras bloqueadas"));
    }
    return lista.childElementCount ? lista : null;
}

function criarSecaoRestricoesCliente(cliente) {
    const badges = criarBadgesRestricoesCliente(cliente);
    if (!badges) return null;
    const secao = criarElementoCliente("section", "admin-cliente-secao clientes-restricoes-secao");
    secao.appendChild(criarElementoCliente("h3", "", "Restricoes no site"));
    secao.appendChild(badges);
    return secao;
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
        const botao = criarElementoCliente("button", "clientes-lista-item", "");
        botao.type = "button";
        botao.title = "Abrir ficha do cliente";
        botao.classList.toggle("ativo", String(cliente.id) === String(clienteAbertoId));
        botao.addEventListener("click", () => abrirCliente(cliente.id));

        botao.appendChild(criarElementoCliente("span", "clientes-lista-nome", cliente.nome || "Cliente sem nome"));
        if (cliente.tem_aviso) {
            botao.appendChild(criarIconeFichaCliente());
        }
        if (cliente.bloquear_conta) {
            botao.appendChild(criarElementoCliente("span", "clientes-lista-restricao", "Login"));
        } else if (cliente.bloquear_compras) {
            botao.appendChild(criarElementoCliente("span", "clientes-lista-restricao", "Compras"));
        }
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
    try {
        renderizarClientesLista();
    } catch (error) {
        console.error(error);
        definirStatusClientes("Erro ao mostrar clientes: " + (error.message || "sem detalhe"), true);
        return;
    }
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

function criarSecaoResumoCliente(resumo = {}) {
    const secao = criarElementoCliente("section", "admin-cliente-secao clientes-resumo-secao");
    const grelha = criarElementoCliente("div", "clientes-resumo-grelha");
    const encomendas = criarCampoCliente("Encomendas", String(resumo.encomendas || 0));
    encomendas.classList.add("clientes-resumo-encomendas");
    const total = criarCampoCliente("Total comprado", formatarEuroCliente(resumo.total));
    total.classList.add("clientes-resumo-total");
    const ultima = criarCampoCliente("\u00daltima compra", formatarDataCliente(resumo.ultima_compra));
    ultima.classList.add("clientes-resumo-ultima");
    grelha.append(encomendas, total, ultima);
    secao.appendChild(grelha);
    return secao;
}

function criarSecaoHistoricoCliente(historico = []) {
    const historicoSecao = criarElementoCliente("section", "admin-cliente-secao");
    const listaHistorico = criarElementoCliente("div", "admin-cliente-historico");
    historico.forEach((item, indice) => {
        const cancelada = String(item.estado || "").trim().toLowerCase() === "cancelado";
        const linha = criarElementoCliente("div", "admin-cliente-historico-linha");
        if (cancelada) linha.classList.add("clientes-historico-cancelada");
        const estado = criarElementoCliente("span", cancelada ? "clientes-historico-estado-cancelada" : "", item.estado || "");
        linha.append(
            criarCodigoHistoricoCliente(item, indice, historico),
            criarElementoCliente("span", "", item.origem || "Site"),
            estado,
            criarElementoCliente("span", "", formatarDataCliente(item.data)),
            criarElementoCliente("strong", "", formatarEuroCliente(item.total))
        );
        listaHistorico.appendChild(linha);
    });
    if (!historico.length) {
        listaHistorico.appendChild(criarElementoCliente("p", "admin-cliente-vazio", "Sem encomendas associadas."));
    }
    historicoSecao.appendChild(listaHistorico);
    return historicoSecao;
}

function criarCodigoHistoricoCliente(item, indice, historico) {
    const codigo = item.codigo || item.codigo_encomenda || `#${item.id}`;
    if (!item.id) return criarElementoCliente("strong", "", codigo);
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "clientes-historico-codigo";
    botao.textContent = codigo;
    botao.title = "Consultar encomenda (janela rápida)";
    botao.addEventListener("click", () => {
        const abrir = typeof abrirModalEncomendaClienteLazy === "function"
            ? abrirModalEncomendaClienteLazy
            : abrirModalEncomendaCliente;
        abrir(historico, indice)?.catch?.(console.error);
    });
    return botao;
}

function criarSecaoRestricoesFormularioCliente(checkboxBloquearCompras, checkboxBloquearConta) {
    if (!checkboxBloquearCompras && !checkboxBloquearConta) return null;
    const secao = criarElementoCliente("div", "clientes-restricoes-formulario");
    secao.appendChild(criarElementoCliente("h3", "admin-cliente-formulario-subtitulo", "Restricoes do site"));
    secao.appendChild(criarElementoCliente(
        "p",
        "clientes-restricoes-ajuda",
        "Bloquear compras: o cliente mantem login, mas nao finaliza encomendas. Bloquear login: a conta deixa de entrar no site."
    ));
    if (checkboxBloquearCompras) {
        secao.appendChild(checkboxBloquearCompras);
    }
    if (checkboxBloquearConta) {
        secao.appendChild(checkboxBloquearConta);
    }
    return secao;
}

function montarFormularioCliente(dados, opcoes = {}) {
    const { novoCliente = false, mostrarCancelar = false, acoesNoTopo = false, acoesAntesCampos = false } = opcoes;
    const cliente = dados.cliente || {};
    const perfis = Array.isArray(dados.perfis) ? dados.perfis : [];
    const formulario = document.createElement("form");
    formulario.className = "admin-cliente-formulario clientes-formulario";
    formulario.id = `clientes-formulario-${cliente.id || "novo"}`;

    let cancelar = null;
    if (mostrarCancelar) {
        cancelar = criarElementoCliente("button", "wallapop-botao", "Cancelar");
        cancelar.type = "button";
    }

    const guardar = criarElementoCliente("button", "wallapop-botao wallapop-botao-destaque", novoCliente ? "Gravar" : "Guardar ficha");
    guardar.type = "submit";

    if (acoesAntesCampos) {
        const acoesTopo = criarElementoCliente("div", "clientes-formulario-acoes-topo admin-cliente-formulario-acoes");
        if (cancelar) {
            acoesTopo.appendChild(cancelar);
        }
        acoesTopo.appendChild(guardar);
        formulario.appendChild(acoesTopo);
    }

    let checkboxAviso = null;
    let checkboxBloquearCompras = null;
    let checkboxBloquearConta = null;
    if (!novoCliente) {
        checkboxAviso = criarCheckboxCliente("Cliente com aviso a ler", "tem_aviso", cliente.tem_aviso);
        checkboxBloquearCompras = criarCheckboxCliente("Bloquear compras no site", "bloquear_compras", cliente.bloquear_compras);
        checkboxBloquearConta = criarCheckboxCliente("Bloquear login no site", "bloquear_conta", cliente.bloquear_conta);
    }
    const secaoRestricoes = criarSecaoRestricoesFormularioCliente(checkboxBloquearCompras, checkboxBloquearConta);

    const dadosCliente = criarElementoCliente("div", "clientes-formulario-dados");
    dadosCliente.append(
        criarInputCliente("Nome", "nome", cliente.nome, "text", true),
        window.MoradaFormato?.criarCampoMoradaEdicao(
            criarElementoCliente,
            window.MoradaFormato.obterMoradaEdicao(cliente.morada)
        ) || criarInputCliente("Morada", "morada", cliente.morada),
        criarInputCliente("C\u00f3digo postal", "cp", cliente.cp),
        criarInputCliente("Cidade", "cidade", cliente.cidade),
        criarInputCliente("Pa\u00eds", "pais", cliente.pais),
        criarInputCliente("Telem\u00f3vel", "telefone", cliente.telefone),
        criarInputCliente("E-mail", "email", cliente.email, "email")
    );
    if (secaoRestricoes) {
        dadosCliente.appendChild(secaoRestricoes);
    }
    formulario.appendChild(dadosCliente);

    const linksExternos = criarElementoCliente("div", "clientes-formulario-links");
    linksExternos.appendChild(criarInputCliente(
        "Link principal",
        "perfil_url_1",
        perfis[0]?.url || "",
        "url"
    ));
    linksExternos.appendChild(criarTextareaCliente("Notas internas", "notas", cliente.notas, 8));
    for (let indice = 1; indice < 5; indice += 1) {
        linksExternos.appendChild(criarInputCliente(
            `Link externo ${indice + 1}`,
            `perfil_url_${indice + 1}`,
            perfis[indice]?.url || "",
            "url"
        ));
    }
    formulario.appendChild(linksExternos);

    aplicarCamposClienteRegistadoSite(formulario, cliente);

    if (acoesNoTopo) {
        if (checkboxAviso) {
            checkboxAviso.querySelector("input")?.setAttribute("form", formulario.id);
        }
        guardar.setAttribute("form", formulario.id);
    }

    if (!acoesNoTopo && !acoesAntesCampos) {
        const rodapeFormulario = criarElementoCliente("div", "clientes-formulario-rodape");
        if (checkboxAviso) {
            rodapeFormulario.appendChild(checkboxAviso);
        }
        const acoes = criarElementoCliente("div", "admin-cliente-formulario-acoes");
        if (cancelar) {
            acoes.appendChild(cancelar);
        }
        acoes.appendChild(guardar);
        rodapeFormulario.appendChild(acoes);
        formulario.appendChild(rodapeFormulario);
    }

    if (cancelar) {
        cancelar.addEventListener("click", () => {
            const ficha = document.getElementById("clientes-ficha");
            if (novoCliente) {
                ficha.replaceChildren(criarElementoCliente("p", "admin-cliente-vazio", "Escolha um cliente para abrir a ficha."));
                definirStatusClientes("");
                return;
            }
            renderizarFichaCliente(dados);
        });
    }

    formulario.addEventListener("submit", async evento => {
        evento.preventDefault();
        guardar.disabled = true;
        if (cancelar) cancelar.disabled = true;
        definirStatusClientes(novoCliente ? "A criar cliente..." : "A guardar ficha...");
        const campos = new FormData(formulario);
        const parametrosCliente = {
            p_nome: String(campos.get("nome") || ""),
            p_email: String(campos.get("email") || ""),
            p_telefone: String(campos.get("telefone") || ""),
            p_morada: window.MoradaFormato?.obterMoradaFormulario(formulario) || String(campos.get("morada") || ""),
            p_cp: String(campos.get("cp") || ""),
            p_cidade: String(campos.get("cidade") || ""),
            p_pais: String(campos.get("pais") || "")
        };
        const clienteRegistadoSite = !novoCliente && clienteRegistadoNoSite(cliente);
        let clienteId = cliente.id;
        if (!clienteRegistadoSite) {
            const { data, error } = novoCliente
                ? await clientesClient.rpc("criar_cliente_externo_admin", parametrosCliente)
                : await clientesClient.rpc("atualizar_cliente_externo_admin", {
                    p_cliente_id: cliente.id,
                    ...parametrosCliente
                });
            if (error || data?.sucesso === false) {
                guardar.disabled = false;
                if (cancelar) cancelar.disabled = false;
                definirStatusClientes("Erro ao guardar dados: " + (error?.message || data?.erro || "sem detalhe"), true);
                return;
            }
            clienteId = data?.cliente?.id || cliente.id;
        }
        const aviso = novoCliente
            ? { data: null, error: null }
            : await guardarAvisoClienteAdmin(clienteId, campos.get("tem_aviso") === "on");
        const avisoErro = aviso.error || aviso.data?.sucesso === false
            ? (aviso.error?.message || aviso.data?.erro || "sem detalhe")
            : "";
        const restricoes = novoCliente
            ? { data: null, error: null }
            : await guardarRestricoesClienteAdmin(
                clienteId,
                campos.get("bloquear_compras") === "on",
                campos.get("bloquear_conta") === "on"
            );
        const restricoesErro = restricoes.error || restricoes.data?.sucesso === false
            ? (restricoes.error?.message || restricoes.data?.erro || "sem detalhe")
            : "";
        const perfisResposta = await clientesClient.rpc("guardar_perfis_cliente_admin", {
            p_cliente_id: clienteId,
            p_perfis: obterPerfisFormularioCliente(formulario)
        });
        const notas = await clientesClient.rpc("guardar_notas_cliente_admin", {
            p_cliente_id: clienteId,
            p_notas: String(campos.get("notas") || "")
        });
        guardar.disabled = false;
        if (cancelar) cancelar.disabled = false;
        if (perfisResposta.error || perfisResposta.data?.sucesso === false) {
            definirStatusClientes("Dados guardados, mas erro nos links: " + (perfisResposta.error?.message || perfisResposta.data?.erro || "sem detalhe"), true);
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
            : restricoesErro
                ? "Ficha guardada, mas as restricoes nao foram atualizadas: " + restricoesErro
                : (novoCliente
                    ? "Cliente criado."
                    : (clienteRegistadoSite
                        ? "Aviso, restricoes, links e notas guardados."
                        : "Ficha guardada.")),
            Boolean(avisoErro || restricoesErro)
        );
        await pesquisarClientes();
        await abrirCliente(clienteId);
    });

    return { formulario, checkboxAviso, cancelar, guardar };
}

function renderizarFormularioCliente(dados, modo = "novo") {
    if (modo !== "novo") {
        renderizarEdicaoCliente(dados);
        return;
    }

    const ficha = document.getElementById("clientes-ficha");
    clienteAbertoId = "";
    renderizarClientesLista();
    ficha.replaceChildren(montarFormularioCliente(dados, {
        novoCliente: true,
        mostrarCancelar: true,
        acoesAntesCampos: true
    }).formulario);
}

function renderizarEdicaoCliente(dados) {
    const ficha = document.getElementById("clientes-ficha");
    const cliente = dados.cliente || {};
    clienteAbertoId = String(cliente.id || "");
    renderizarClientesLista();
    ficha.replaceChildren();

    const topo = criarElementoCliente("div", "clientes-ficha-topo");
    topo.appendChild(criarElementoCliente("h2", "", cliente.nome || "Cliente sem nome"));
    const acoesTopo = criarElementoCliente("div", "clientes-ficha-acoes");
    const cancelar = criarElementoCliente("button", "wallapop-botao", "Cancelar");
    cancelar.type = "button";
    cancelar.addEventListener("click", () => renderizarFichaCliente(dados));
    const { formulario, checkboxAviso, guardar } = montarFormularioCliente(dados, { acoesNoTopo: true });
    if (checkboxAviso) {
        acoesTopo.appendChild(checkboxAviso);
    }
    acoesTopo.append(cancelar, guardar);
    topo.appendChild(acoesTopo);

    ficha.append(topo, formulario);
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
    const historico = Array.isArray(dados.historico) ? dados.historico : [];
    const resumo = dados.resumo || {};
    clienteAbertoId = String(cliente.id || "");
    renderizarClientesLista();
    ficha.replaceChildren();

    const topo = criarElementoCliente("div", "clientes-ficha-topo");
    const titulo = criarElementoCliente("h2", "", cliente.nome || "Cliente sem nome");
    if (cliente.tem_aviso) {
        const aviso = criarElementoCliente("span", "clientes-ficha-aviso-topo");
        aviso.append(
            criarIconeFichaCliente(),
            criarElementoCliente("span", "clientes-ficha-aviso-texto", "Aviso a ler")
        );
        titulo.appendChild(aviso);
    }
    const restricoesTopo = criarBadgesRestricoesCliente(cliente, "clientes-ficha-restricoes-topo");
    topo.append(titulo);
    if (restricoesTopo) topo.appendChild(restricoesTopo);
    const editar = criarElementoCliente("button", "wallapop-botao", "Editar ficha");
    editar.type = "button";
    editar.addEventListener("click", () => renderizarEdicaoCliente(dados));
    const apagar = criarElementoCliente("button", "wallapop-botao clientes-botao-apagar", "Apagar ficha");
    apagar.type = "button";
    apagar.addEventListener("click", () => apagarFichaCliente(dados, apagar));
    const acoesTopo = criarElementoCliente("div", "clientes-ficha-acoes");
    acoesTopo.append(editar, apagar);
    topo.appendChild(acoesTopo);

    ficha.append(
        topo,
        montarVistaConsultaCliente(dados, resumo),
        criarSecaoHistoricoCliente(historico)
    );
}

async function iniciarClientesAdmin() {
    const bloqueio = document.getElementById("clientes-bloqueio");
    try {
        await window.carregarScriptSupabase();
        if (typeof supabase === "undefined") throw new Error("A biblioteca Supabase nao carregou.");
        clientesClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data: { user }, error } = await clientesClient.auth.getUser();
        if (error || !user || !ADMIN_EMAILS.includes(String(user.email || "").toLowerCase())) {
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
document.getElementById("clientes-ficha")?.addEventListener("mouseenter", () => {
    if (typeof window.garantirModalEncomendaCliente === "function") {
        window.garantirModalEncomendaCliente().catch(() => {});
    }
}, { once: true });
window.addEventListener("load", iniciarClientesAdmin);
