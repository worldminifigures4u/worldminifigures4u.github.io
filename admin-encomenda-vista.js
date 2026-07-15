window.AdminEncomendaVista = (function () {
    const ANEXOS_BUCKET = "anexos-encomendas";
    const ANEXO_MAX_BYTES = 10 * 1024 * 1024;
    const ANEXO_TIPOS_PERMITIDOS = new Set([
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp"
    ]);
    const ESTADOS_ENCOMENDA = [
        "A aguardar pagamento",
        "Pago",
        "Em preparação",
        "Enviado",
        "Concluído",
        "Cancelado"
    ];
    const SEM_IMAGEM = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" fill="#222"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#888" font-family="Arial" font-size="13">Sem foto</text></svg>'
    );
    const SUPABASE_FUNCTIONS_URL = "https://gksndzxadndrsynvzgzb.supabase.co";

    let client = null;
    let hooks = {
        definirStatus: () => {},
        renderizarLista: () => {},
        renderizarModal: () => {},
        atualizarResumo: () => {},
        obterLista: () => [],
        definirLista: () => {},
        onEncomendaApagada: () => {}
    };

    let imagensProdutos = new Map();
    let imagensProdutosPorSku = new Map();
    let referenciasProdutos = new Map();
    let referenciasProdutosPorSku = new Map();
    let temasProdutos = new Map();
    let temasProdutosPorSku = new Map();
    let subtemasProdutos = new Map();
    let subtemasProdutosPorSku = new Map();

    function configurar(opcoes = {}) {
        if (opcoes.client) client = opcoes.client;
        if (opcoes.hooks) hooks = { ...hooks, ...opcoes.hooks };
    }

    function obterClient() {
        if (!client) throw new Error("Cliente Supabase nao configurado.");
        return client;
    }

    function normalizar(valor) {
        return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }

    function obterClassePlataforma(origem) {
        const normalizada = normalizar(origem).replace(/\s+/g, "-");
        return normalizada ? ` plataforma-${normalizada}` : "";
    }

    function formatarEuro(valor) {
        return Number(valor || 0).toFixed(2).replace(".", ",") + " €";
    }

    function formatarData(valor) {
        if (!valor) return "Data indisponível";
        const data = new Date(valor);
        if (Number.isNaN(data.getTime())) return String(valor);
        return new Intl.DateTimeFormat("pt-PT", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        }).format(data).replace(",", "");
    }

    function estadoNormalizado(estado) {
        return String(estado || "").toLowerCase() === "pendente"
            ? "A aguardar pagamento"
            : (estado || "A aguardar pagamento");
    }

    function detalheErro(error) {
        if (!error) return "sem detalhe";
        const partes = [
            error.message,
            error.details,
            error.hint,
            error.code ? `código ${error.code}` : "",
            error.status ? `estado HTTP ${error.status}` : ""
        ].filter(Boolean);
        return partes.join(" | ") || String(error);
    }

    function criarElemento(tag, classe, texto) {
        const elemento = document.createElement(tag);
        if (classe) elemento.className = classe;
        if (texto !== undefined) elemento.textContent = texto;
        return elemento;
    }

    function obterProdutos(encomenda) {
        let produtos = encomenda.produtos;
        if (typeof produtos === "string") {
            try { produtos = JSON.parse(produtos); } catch (_) { produtos = []; }
        }
        return Array.isArray(produtos) ? produtos : [];
    }

    function resumirQuantidadesProdutos(encomenda) {
        const itens = obterProdutos(encomenda);
        let totalPecas = 0;
        const distintos = new Set();
        itens.forEach((item, indice) => {
            const quantidade = Math.max(1, Number(item.quantidade || item.qtd || 1) || 1);
            totalPecas += quantidade;
            const chave = String(item.sku || item.id_produto || item.id || item.nome || `linha-${indice}`).trim().toUpperCase();
            distintos.add(chave);
        });
        return { totalPecas, diferentes: distintos.size };
    }

    function criarResumoPecasProdutos(encomenda) {
        const { totalPecas, diferentes } = resumirQuantidadesProdutos(encomenda);
        const resumo = criarElemento("div", "admin-encomenda-resumo-pecas");

        function adicionarItem(rotulo, valor, titulo) {
            const item = criarElemento("span", "admin-encomenda-resumo-pecas-item");
            const rotuloElemento = criarElemento("span", "admin-encomenda-resumo-rotulo", rotulo);
            rotuloElemento.title = titulo;
            item.append(
                rotuloElemento,
                criarElemento("strong", "admin-encomenda-resumo-valor", String(valor))
            );
            resumo.appendChild(item);
        }

        adicionarItem("Peças:", totalPecas, "Total de figuras");
        adicionarItem("Diferentes:", diferentes, "Figuras diferentes");
        return resumo;
    }

    function obterPrimeiraImagem(imagens) {
        let lista = imagens;
        if (typeof lista === "string") {
            try { lista = JSON.parse(lista); }
            catch (_) { lista = lista.split(",").map(item => item.trim()).filter(Boolean); }
        }
        return Array.isArray(lista) ? String(lista.find(Boolean) || "") : "";
    }

    function otimizarMiniatura(url) {
        const original = String(url || "");
        if (!original.includes("res.cloudinary.com/") || !original.includes("/image/upload/")) return original;
        return original.replace("/image/upload/", "/image/upload/f_auto,q_auto,w_120,h_120,c_fit/");
    }

    function obterImagemProduto(item) {
        return imagensProdutos.get(String(item.id_produto || item.id || ""))
            || imagensProdutosPorSku.get(String(item.sku || "").toUpperCase())
            || "";
    }

    function obterReferenciaProduto(item) {
        return item.referencia
            || referenciasProdutos.get(String(item.id_produto || item.id || ""))
            || referenciasProdutosPorSku.get(String(item.sku || "").toUpperCase())
            || "";
    }

    function formatarSubtemaProduto(valor) {
        const texto = String(valor || "").trim();
        if (!texto || texto === "semsubtema" || /^sem\s*subtema$/i.test(texto)) return "—";
        return texto;
    }

    function obterTemaProduto(item) {
        const tema = item.tema
            || temasProdutos.get(String(item.id_produto || item.id || ""))
            || temasProdutosPorSku.get(String(item.sku || "").toUpperCase())
            || "";
        return String(tema).trim() || "—";
    }

    function obterSubtemaProduto(item) {
        const subtema = item.subtema
            || subtemasProdutos.get(String(item.id_produto || item.id || ""))
            || subtemasProdutosPorSku.get(String(item.sku || "").toUpperCase())
            || "";
        return formatarSubtemaProduto(subtema);
    }

    function abrirImagemProduto(url, nome) {
        if (!url) return;
        const modal = document.getElementById("admin-imagem-modal");
        const foto = document.getElementById("admin-imagem-modal-foto");
        if (!modal || !foto) return;
        foto.src = url;
        foto.alt = nome || "Fotografia do produto";
        modal.hidden = false;
        document.body.classList.add("admin-imagem-modal-aberto");
        document.getElementById("admin-imagem-modal-fechar")?.focus();
    }

    function fecharImagemProduto() {
        const modal = document.getElementById("admin-imagem-modal");
        const foto = document.getElementById("admin-imagem-modal-foto");
        if (!modal || !foto) return;
        modal.hidden = true;
        foto.removeAttribute("src");
        document.body.classList.remove("admin-imagem-modal-aberto");
    }

    function criarMiniaturaProduto(item) {
        const url = obterImagemProduto(item);
        const botao = criarElemento("button", "admin-encomenda-produto-foto");
        botao.type = "button";
        botao.title = url ? "Ampliar fotografia" : "Produto sem fotografia";
        botao.disabled = !url;
        const imagem = document.createElement("img");
        imagem.src = url ? otimizarMiniatura(url) : SEM_IMAGEM;
        imagem.alt = item.nome || "Produto";
        imagem.loading = "lazy";
        imagem.onerror = () => {
            imagem.onerror = null;
            imagem.src = SEM_IMAGEM;
            botao.disabled = true;
        };
        if (url) botao.addEventListener("click", () => abrirImagemProduto(url, item.nome));
        botao.appendChild(imagem);
        return botao;
    }

    function pastaAnexos(encomenda) {
        return String(encomenda.id);
    }

    function limparNomeAnexo(nome) {
        const partes = String(nome || "anexo").split(".");
        const extensao = partes.length > 1 ? `.${partes.pop().toLowerCase()}` : "";
        const base = partes.join(".")
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[\\/:*?"<>|#\u0000-\u001f]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 100) || "anexo";
        return `${base}${extensao}`;
    }

    function nomeVisivelAnexo(nome) {
        return String(nome || "").replace(/^\d{13}-[a-z0-9]{6}-/i, "");
    }

    function formatarTextoContagemAnexos(quantidade) {
        const n = Number(quantidade);
        if (!Number.isFinite(n) || n < 0) return "…";
        if (n === 0) return "0 anexos";
        return n === 1 ? "1 anexo" : `${n} anexos`;
    }

    function atualizarContagemAnexosLista(encomenda, quantidade) {
        const valor = Number(quantidade);
        if (!Number.isFinite(valor) || valor < 0) return;
        sincronizarEncomendaNaLista(encomenda, { num_anexos: valor });
        document
            .querySelectorAll(`.admin-encomenda-anexos-contagem[data-encomenda-id="${String(encomenda.id)}"]`)
            .forEach((elemento) => {
                elemento.textContent = formatarTextoContagemAnexos(valor);
                elemento.title = formatarTextoContagemAnexos(valor);
                elemento.classList.toggle("sem-anexos", valor === 0);
            });
    }

    async function contarAnexos(encomenda) {
        if (estadoNormalizado(encomenda.estado) === "Concluído") return 0;
        const anexos = await listarAnexos(encomenda);
        return anexos.length;
    }

    async function carregarContagensAnexosLista(encomendas) {
        if (!Array.isArray(encomendas) || !encomendas.length) return;
        await Promise.all(encomendas.map(async (encomenda) => {
            if (estadoNormalizado(encomenda.estado) === "Concluído") {
                atualizarContagemAnexosLista(encomenda, 0);
                return;
            }
            try {
                const quantidade = await contarAnexos(encomenda);
                atualizarContagemAnexosLista(encomenda, quantidade);
            } catch (error) {
                console.warn("Contagem de anexos indisponivel para encomenda.", encomenda.id, error);
                if (typeof encomenda.num_anexos === "number") {
                    atualizarContagemAnexosLista(encomenda, encomenda.num_anexos);
                }
            }
        }));
    }

    async function listarAnexos(encomenda) {
        const { data, error } = await obterClient().storage
            .from(ANEXOS_BUCKET)
            .list(pastaAnexos(encomenda), {
                limit: 1000,
                sortBy: { column: "created_at", order: "desc" }
            });
        if (error) throw error;
        return (data || []).filter(item => item.name && item.name !== ".emptyFolderPlaceholder");
    }

    async function abrirAnexo(encomenda, anexo) {
        const caminho = `${pastaAnexos(encomenda)}/${anexo.name}`;
        const { data, error } = await obterClient().storage
            .from(ANEXOS_BUCKET)
            .createSignedUrl(caminho, 300);
        if (error) throw error;
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }

    async function apagarAnexos(encomenda) {
        const anexos = await listarAnexos(encomenda);
        if (!anexos.length) return 0;
        const caminhos = anexos.map(item => `${pastaAnexos(encomenda)}/${item.name}`);
        const { error } = await obterClient().storage.from(ANEXOS_BUCKET).remove(caminhos);
        if (error) throw error;
        return caminhos.length;
    }

    async function carregarAnexos(encomenda, lista, status) {
        status.textContent = "A carregar anexos...";
        try {
            const anexos = await listarAnexos(encomenda);
            lista.replaceChildren();
            if (!anexos.length) {
                lista.appendChild(criarElemento("p", "admin-encomenda-anexos-vazio", "Sem anexos."));
            } else {
                anexos.forEach(anexo => {
                    const linha = criarElemento("div", "admin-encomenda-anexo");
                    const nome = criarElemento("span", "", nomeVisivelAnexo(anexo.name));
                    nome.title = nome.textContent;
                    const abrir = criarElemento("button", "wallapop-botao", "Abrir");
                    abrir.type = "button";
                    abrir.addEventListener("click", async () => {
                        abrir.disabled = true;
                        status.textContent = "A abrir anexo...";
                        try {
                            await abrirAnexo(encomenda, anexo);
                            status.textContent = "";
                        } catch (error) {
                            status.textContent = "Erro ao abrir: " + (error.message || "sem detalhe");
                        } finally {
                            abrir.disabled = false;
                        }
                    });
                    const apagar = criarElemento("button", "wallapop-botao admin-encomenda-anexo-apagar", "Eliminar");
                    apagar.type = "button";
                    apagar.addEventListener("click", async () => {
                        if (!window.confirm(`Eliminar o anexo "${nome.textContent}"?`)) return;
                        apagar.disabled = true;
                        const caminho = `${pastaAnexos(encomenda)}/${anexo.name}`;
                        const { error } = await obterClient().storage.from(ANEXOS_BUCKET).remove([caminho]);
                        if (error) {
                            status.textContent = "Erro ao eliminar: " + error.message;
                            apagar.disabled = false;
                            return;
                        }
                        await carregarAnexos(encomenda, lista, status);
                    });
                    linha.append(nome, abrir, apagar);
                    lista.appendChild(linha);
                });
            }
            atualizarContagemAnexosLista(encomenda, anexos.length);
            status.textContent = "";
        } catch (error) {
            lista.replaceChildren();
            status.textContent = "Anexos indisponíveis. Execute primeiro o ficheiro SQL de configuração.";
            console.warn("Erro ao carregar anexos da encomenda.", error);
        }
    }

    function criarSecaoNotasInternasEncomenda(encomenda, opcoes = {}) {
        const compacto = opcoes.compacto === true;
        const semBotao = opcoes.semBotao === true;
        const notasSecao = criarElemento("section", `admin-encomenda-notas${compacto ? " admin-encomenda-notas-cabecalho" : ""}`);
        const notas = document.createElement("textarea");
        notas.rows = compacto ? 1 : 4;
        notas.maxLength = 10000;
        let valorGuardado = encomenda.notas_internas || "";
        notas.value = valorGuardado;
        notas.placeholder = "Pormenores de preparação visíveis apenas ao administrador.";
        notas.addEventListener("click", evento => evento.stopPropagation());
        notas.addEventListener("keydown", evento => evento.stopPropagation());
        const statusNotas = criarElemento("p", "admin-encomenda-gestao-status");

        function temAlteracoesPendentes() {
            return notas.value !== valorGuardado;
        }

        async function guardarNotasInternas() {
            if (!temAlteracoesPendentes()) return true;
            if (!compacto) statusNotas.textContent = "A guardar...";
            const { data, error } = await obterClient().rpc("guardar_notas_encomenda_admin", {
                p_encomenda_id: String(encomenda.id),
                p_notas: notas.value
            });
            if (error || data?.sucesso === false) {
                const mensagem = "Erro ao guardar notas: " + (error?.message || data?.erro || "sem detalhe");
                if (compacto) hooks.definirStatus(mensagem, true);
                else statusNotas.textContent = mensagem;
                return false;
            }
            valorGuardado = notas.value;
            encomenda.notas_internas = notas.value;
            if (!compacto) statusNotas.textContent = "";
            return true;
        }

        function reverterNotas() {
            notas.value = valorGuardado;
            if (!compacto) statusNotas.textContent = "";
        }

        let ignorarBlurNotas = false;
        let promessaGravacaoNotas = null;

        async function gravarNotasAoSair() {
            if (!temAlteracoesPendentes()) return true;
            if (promessaGravacaoNotas) return promessaGravacaoNotas;
            promessaGravacaoNotas = guardarNotasInternas().finally(() => {
                promessaGravacaoNotas = null;
            });
            return promessaGravacaoNotas;
        }

        function ignorarProximoBlurNotas() {
            ignorarBlurNotas = true;
        }

        notas.addEventListener("blur", () => {
            window.setTimeout(async () => {
                if (ignorarBlurNotas) {
                    ignorarBlurNotas = false;
                    return;
                }
                if (notasSecao.contains(document.activeElement)) return;
                await gravarNotasAoSair();
            }, 0);
        });

        const controloNotas = {
            guardar: guardarNotasInternas,
            gravarAoSair: gravarNotasAoSair,
            temAlteracoesPendentes,
            reverter: reverterNotas,
            ignorarProximoBlur: ignorarProximoBlurNotas
        };

        if (!semBotao) {
            const guardarNotas = criarElemento("button", "wallapop-botao wallapop-botao-destaque", compacto ? "Gravar" : "Guardar notas");
            guardarNotas.type = "button";
            guardarNotas.addEventListener("click", evento => evento.stopPropagation());
            guardarNotas.addEventListener("mousedown", ignorarProximoBlurNotas);
            guardarNotas.addEventListener("click", async () => {
                guardarNotas.disabled = true;
                await guardarNotasInternas();
                guardarNotas.disabled = false;
            });

            if (compacto) {
                const linhaNotas = criarElemento("div", "admin-encomenda-notas-linha");
                linhaNotas.append(notas, guardarNotas);
                notasSecao.appendChild(linhaNotas);
            } else {
                notasSecao.append(notas, guardarNotas, statusNotas);
            }

            return {
                elemento: notasSecao,
                ...controloNotas
            };
        }

        notasSecao.appendChild(notas);
        return {
            elemento: notasSecao,
            ...controloNotas
        };
    }

    function criarGestaoEncomenda(encomenda) {
        const bloco = criarElemento("div", "admin-encomenda-gestao-bloco admin-encomenda-gestao-anexos");
        bloco.appendChild(criarElemento("span", "admin-encomenda-gestao-rotulo", "Anexos"));
        const conteudo = criarElemento("div", "admin-encomenda-anexos-conteudo");
        const lista = criarElemento("div", "admin-encomenda-anexos-lista");
        const statusAnexos = criarElemento("p", "admin-encomenda-gestao-status");
        const concluida = estadoNormalizado(encomenda.estado) === "Concluído";
        let avisoConcluida = null;

        if (concluida) {
            avisoConcluida = criarElemento(
                "p",
                "admin-encomenda-anexos-aviso",
                "Os anexos foram eliminados quando a encomenda foi concluída."
            );
            conteudo.appendChild(avisoConcluida);
        } else {
            const upload = criarElemento("div", "admin-encomenda-gestao-caixa admin-encomenda-anexos-upload");
            const campoFicheiro = criarElemento("label", "admin-encomenda-anexos-escolher");
            const input = document.createElement("input");
            input.type = "file";
            input.className = "admin-encomenda-anexos-input";
            input.accept = ".pdf,image/jpeg,image/png,image/webp";
            input.multiple = true;
            campoFicheiro.append(
                input,
                criarElemento("span", "admin-encomenda-anexos-escolher-texto", "Escolher Ficheiros")
            );
            upload.appendChild(campoFicheiro);
            const listaPendentes = criarElemento("div", "admin-encomenda-anexos-pendentes");
            conteudo.append(upload, listaPendentes);

            function atualizarAnexosPendentes() {
                listaPendentes.replaceChildren();
                const ficheiros = [...input.files];
                const semAnexos = lista.querySelector(".admin-encomenda-anexos-vazio");
                if (semAnexos) semAnexos.hidden = ficheiros.length > 0;
                if (!ficheiros.length) return;
                ficheiros.forEach(ficheiro => {
                    const linha = criarElemento("div", "admin-encomenda-anexo admin-encomenda-anexo-pendente");
                    const nome = criarElemento("span", "", ficheiro.name);
                    nome.title = ficheiro.name;
                    linha.appendChild(nome);
                    listaPendentes.appendChild(linha);
                });
            }

            input.addEventListener("change", atualizarAnexosPendentes);

            bloco.temAnexosPendentes = () => Boolean(input.files?.length);
            bloco.reverterAnexos = () => {
                input.value = "";
                atualizarAnexosPendentes();
            };
            bloco.enviarAnexosPendentes = async () => {
                const ficheiros = [...input.files];
                if (!ficheiros.length) return true;
                const tiposInvalidos = ficheiros.filter(item => !ANEXO_TIPOS_PERMITIDOS.has(item.type));
                if (tiposInvalidos.length) {
                    statusAnexos.textContent = "Só são permitidos anexos PDF, JPEG, PNG ou WebP.";
                    return false;
                }
                const demasiadoGrandes = ficheiros.filter(item => item.size > ANEXO_MAX_BYTES);
                if (demasiadoGrandes.length) {
                    statusAnexos.textContent = "Cada anexo pode ter no máximo 10 MB.";
                    return false;
                }
                input.disabled = true;
                statusAnexos.textContent = "A enviar anexos...";
                try {
                    for (const ficheiro of ficheiros) {
                        const aleatorio = Math.random().toString(36).slice(2, 8);
                        const nome = `${Date.now()}-${aleatorio}-${limparNomeAnexo(ficheiro.name)}`;
                        const caminho = `${pastaAnexos(encomenda)}/${nome}`;
                        const { error } = await obterClient().storage
                            .from(ANEXOS_BUCKET)
                            .upload(caminho, ficheiro, { cacheControl: "3600", upsert: false });
                        if (error) throw error;
                    }
                    input.value = "";
                    atualizarAnexosPendentes();
                    await carregarAnexos(encomenda, lista, statusAnexos);
                    statusAnexos.textContent = `${ficheiros.length} anexo(s) guardado(s).`;
                    return true;
                } catch (error) {
                    statusAnexos.textContent = "Erro no envio: " + (error.message || "sem detalhe");
                    return false;
                } finally {
                    input.disabled = false;
                }
            };
        }

        conteudo.append(lista, statusAnexos);
        bloco.appendChild(conteudo);
        bloco.carregarAnexos = async () => {
            if (bloco.dataset.anexosCarregados === "true") return;
            bloco.dataset.anexosCarregados = "true";
            if (concluida) {
                statusAnexos.textContent = "A verificar anexos residuais...";
                try {
                    const eliminados = await apagarAnexos(encomenda);
                    avisoConcluida.textContent = eliminados
                        ? `${eliminados} anexo(s) residual(is) eliminado(s). As notas internas foram mantidas.`
                        : "Não existem anexos nesta encomenda concluída. As notas internas foram mantidas.";
                    statusAnexos.textContent = "";
                } catch (error) {
                    bloco.dataset.anexosCarregados = "false";
                    statusAnexos.textContent = "Não foi possível verificar a eliminação dos anexos: " + (error.message || "sem detalhe");
                }
                return;
            }
            await carregarAnexos(encomenda, lista, statusAnexos);
        };
        return bloco;
    }

    function textoProdutos(encomenda) {
        return obterProdutos(encomenda).map(item => {
            const quantidade = Number(item.quantidade || item.qtd || 1);
            const nome = item.nome || "Produto";
            const referencia = obterReferenciaProduto(item);
            const identificadores = [referencia ? `Ref. ${referencia}` : "", item.sku ? `SKU ${item.sku}` : ""].filter(Boolean).join(" | ");
            const sufixo = identificadores ? ` (${identificadores})` : "";
            const preco = Number(item.preco_unitario ?? item.preco ?? 0);
            return `${quantidade}x ${nome}${sufixo} - ${formatarEuro(preco)}`;
        }).join("\n");
    }

    function textoCompleto(encomenda) {
        const morada = window.MoradaFormato?.formatarMoradaTexto(encomenda)
            || [encomenda.morada_cliente, encomenda.cp_cliente, encomenda.cidade_cliente, encomenda.pais_cliente]
                .filter(Boolean).join(", ");
        return [
            `Encomenda: ${encomenda.codigo_encomenda || encomenda.id}`,
            `Data: ${formatarData(encomenda.created_at)}`,
            `Estado: ${estadoNormalizado(encomenda.estado)}`,
            `Origem: ${encomenda.origem || "Site"}`,
            encomenda.referencia_externa ? `Referência: ${encomenda.referencia_externa}` : "",
            "",
            `Cliente: ${encomenda.nome_cliente || ""}`,
            `E-mail: ${encomenda.email_cliente || ""}`,
            `Telemóvel: ${encomenda.telefone_cliente || ""}`,
            "Morada:",
            morada,
            "",
            `Envio: ${encomenda.metodo_envio_nome || encomenda.metodo_envio || ""}`,
            `Portes: ${formatarEuro(encomenda.portes)}`,
            `Pagamento: ${encomenda.metodo_pagamento || ""}`,
            "",
            "Produtos:",
            textoProdutos(encomenda),
            "",
            `Total: ${formatarEuro(encomenda.total)}`
        ].join("\n");
    }

    async function copiarEncomenda(encomenda) {
        try {
            await navigator.clipboard.writeText(textoCompleto(encomenda));
            hooks.definirStatus(`Encomenda ${encomenda.codigo_encomenda || ""} copiada.`);
        } catch (_) {
            hooks.definirStatus("Não foi possível copiar os dados.", true);
        }
    }

    async function atualizarEstadoDireto(encomenda, estado, dataPagamentoIso = null) {
        const { data, error } = await obterClient()
            .from("encomendas")
            .update({ estado })
            .eq("id", String(encomenda.id))
            .select("id, estado, created_at")
            .single();
        if (error) throw error;
        if (!dataPagamentoIso) return data;

        try {
            return await atualizarDataPagamento(encomenda, dataPagamentoIso);
        } catch (erroData) {
            console.warn("Nao foi possivel atualizar data de pagamento.", erroData);
            return data;
        }
    }

    function deveAtualizarDataPagamento(estadoAnterior, estadoNovo) {
        return estadoNormalizado(estadoNovo) === "Pago"
            && estadoNormalizado(estadoAnterior) !== "Pago";
    }

    async function atualizarDataPagamento(encomenda, dataPagamentoIso) {
        const { data, error } = await obterClient()
            .from("encomendas")
            .update({ created_at: dataPagamentoIso })
            .eq("id", String(encomenda.id))
            .select("id, created_at")
            .single();
        if (error) throw error;
        return data;
    }

    function parseEuroInput(texto) {
        const limpo = String(texto || "").replace(/\s/g, "").replace(/€/g, "").replace(",", ".");
        const valor = Number.parseFloat(limpo);
        return Number.isFinite(valor) ? Math.round(valor * 100) / 100 : Number.NaN;
    }

    function formatarEuroInput(valor) {
        return Number(valor || 0).toFixed(2).replace(".", ",") + " €";
    }

    async function atualizarTotalEncomenda(encomenda, total, input, card, opcoes = {}) {
        const silencioso = opcoes.silencioso === true;
        input.disabled = true;
        if (!silencioso) hooks.definirStatus("A guardar total...");
        try {
            const { data, error } = await obterClient().rpc("atualizar_total_encomenda_admin", {
                p_encomenda_id: String(encomenda.id),
                p_total: total
            });
            if (error || data?.sucesso === false) {
                throw error || new Error(data?.erro || "Não foi possível guardar o total.");
            }
            const totalGuardado = Number(data?.total ?? total);
            sincronizarEncomendaNaLista(encomenda, { total: totalGuardado });
            input.value = formatarEuroInput(totalGuardado);
            const valorLinha = card.querySelector(".admin-encomenda-valor-linha");
            if (valorLinha) valorLinha.textContent = formatarEuro(totalGuardado);
            atualizarListaAposAlteracaoEncomenda();
            if (!silencioso) hooks.definirStatus(`Total da encomenda atualizado para ${formatarEuro(totalGuardado)}.`);
            return true;
        } catch (error) {
            input.value = formatarEuroInput(encomenda.total);
            if (!silencioso) {
                hooks.definirStatus(
                    "Erro ao guardar total: " + detalheErro(error)
                    + ". Execute o SQL atualizado do painel de encomendas no Supabase.",
                    true
                );
            }
            return false;
        } finally {
            input.disabled = false;
        }
    }

    function criarLinhaTotalEditavel(encomenda, card) {
        const linha = criarElemento("div", "admin-encomenda-total-linha");
        linha.appendChild(criarResumoPecasProdutos(encomenda));

        const totalGrupo = criarElemento("div", "admin-encomenda-total-grupo");
        totalGrupo.appendChild(criarElemento("span", "admin-encomenda-total-rotulo", "Total:"));
        const input = document.createElement("input");
        input.type = "text";
        input.className = "admin-encomenda-total-input";
        input.inputMode = "decimal";
        input.autocomplete = "off";
        input.spellcheck = false;
        let valorGuardado = Number(encomenda.total);
        input.value = formatarEuroInput(valorGuardado);
        input.title = "Editar valor total da encomenda";
        input.addEventListener("click", evento => evento.stopPropagation());
        input.addEventListener("keydown", evento => evento.stopPropagation());
        input.addEventListener("keydown", evento => {
            if (evento.key !== "Enter") return;
            evento.preventDefault();
            input.blur();
        });

        function reverter() {
            input.value = formatarEuroInput(valorGuardado);
        }

        function temAlteracao() {
            const total = parseEuroInput(input.value);
            return !Number.isNaN(total) && total !== valorGuardado;
        }

        async function guardar() {
            const total = parseEuroInput(input.value);
            if (Number.isNaN(total)) {
                reverter();
                return false;
            }
            if (total === valorGuardado) return true;
            const ok = await atualizarTotalEncomenda(encomenda, total, input, card, { silencioso: true });
            if (ok) valorGuardado = Number(encomenda.total);
            return ok;
        }

        input.addEventListener("blur", () => {
            const total = parseEuroInput(input.value);
            if (Number.isNaN(total)) {
                reverter();
                return;
            }
            input.value = formatarEuroInput(total);
        });
        totalGrupo.appendChild(input);
        linha.appendChild(totalGrupo);
        return { elemento: linha, temAlteracao, reverter, guardar };
    }

    async function atualizarPrioridade(encomenda, prioritaria, checkbox) {
        checkbox.disabled = true;
        hooks.definirStatus("A guardar prioridade...");
        try {
            const { data, error } = await obterClient().rpc("atualizar_prioridade_encomenda_admin", {
                p_encomenda_id: String(encomenda.id),
                p_prioritaria: prioritaria
            });
            if (error || data?.sucesso === false) {
                throw error || new Error(data?.erro || "Não foi possível guardar a prioridade.");
            }
            encomenda.prioritaria = prioritaria;
            sincronizarEncomendaNaLista(encomenda, { prioritaria });
            atualizarListaAposAlteracaoEncomenda();
            hooks.definirStatus(prioritaria ? "Encomenda marcada como prioritária." : "Prioridade removida.");
        } catch (error) {
            checkbox.checked = !prioritaria;
            hooks.definirStatus(
                "Erro ao guardar prioridade: " + detalheErro(error)
                + ". Execute o SQL atualizado do painel de encomendas no Supabase.",
                true
            );
        } finally {
            checkbox.disabled = false;
        }
    }

    function sincronizarEncomendaNaLista(encomenda, alteracoes = {}) {
        const lista = hooks.obterLista();
        const indice = lista.findIndex(item => String(item.id) === String(encomenda.id));
        if (indice < 0) return;
        Object.assign(lista[indice], alteracoes);
        Object.assign(encomenda, alteracoes);
    }

    function atualizarListaAposAlteracaoEncomenda() {
        hooks.atualizarResumo();
        hooks.renderizarLista();
        hooks.renderizarModal();
    }

    const ORIGENS_FATURA_MOLONI_OPCIONAL = new Set(["olx"]);

    function origemEncomenda(encomenda) {
        return normalizar(encomenda?.origem || "site");
    }

    function encomendaOrigemOlx(encomenda) {
        return origemEncomenda(encomenda) === "olx";
    }

    function podeEmitirFaturaMoloni(encomenda) {
        if (encomenda?.moloni_document_id) return false;
        return true;
    }

    function deveEmitirFaturaMoloniAutomaticamente(encomenda) {
        if (!podeEmitirFaturaMoloni(encomenda)) return false;
        return !ORIGENS_FATURA_MOLONI_OPCIONAL.has(origemEncomenda(encomenda));
    }

    function pedirEmissaoFaturaMoloniOlx(encomenda) {
        const codigo = encomenda.codigo_encomenda || "";
        return window.confirm(
            `Encomenda OLX ${codigo}: emitir fatura-recibo Moloni automaticamente?`
        );
    }

    async function emitirFaturaMoloni(encomenda, opcoes = {}) {
        const forcarOlx = Boolean(opcoes.forcarOlx);
        if (!podeEmitirFaturaMoloni(encomenda)) return null;
        if (encomendaOrigemOlx(encomenda) && !forcarOlx) return null;

        const { data: { session } } = await obterClient().auth.getSession();
        if (!session?.access_token) {
            throw new Error("Sessao invalida para emitir fatura.");
        }

        const resposta = await fetch(`${SUPABASE_FUNCTIONS_URL}/functions/v1/emitir-fatura-moloni`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                encomenda_id: String(encomenda.id),
                forcar_olx: forcarOlx
            })
        });
        const resultado = await resposta.json().catch(() => ({}));

        if (resultado?.ignorada) return null;
        if (!resposta.ok || !resultado?.sucesso) {
            throw new Error(resultado?.error || "Nao foi possivel emitir a fatura no Moloni.");
        }

        encomenda.moloni_document_id = resultado.document_id;
        encomenda.moloni_fatura_numero = resultado.numero ?? encomenda.moloni_fatura_numero;
        return resultado;
    }

    async function atualizarEstado(encomenda, estado, select) {
        const estadoAnterior = estadoNormalizado(encomenda.estado);
        const atualizarDataPagamentoFlag = deveAtualizarDataPagamento(estadoAnterior, estado);
        const dataPagamentoIso = atualizarDataPagamentoFlag ? new Date().toISOString() : null;
        let reporStock = false;

        if (estado === "Concluído" && estadoAnterior !== "Concluído") {
            const confirmado = window.confirm(
                "Ao concluir a encomenda, todos os anexos serão eliminados definitivamente. As notas internas serão mantidas. Continuar?"
            );
            if (!confirmado) {
                select.value = estadoAnterior;
                return;
            }
        }

        if (estadoAnterior === "Cancelado" && estado !== "Cancelado") {
            const codigo = encomenda.codigo_encomenda || "";
            let mensagemRecuperacao = `Recuperar a encomenda ${codigo} para o estado «${estado}»?`;
            if (encomenda.stock_reposto) {
                mensagemRecuperacao += "\n\nO stock dos produtos será novamente reduzido.";
            }
            if (!window.confirm(mensagemRecuperacao)) {
                select.value = estadoAnterior;
                return;
            }
        }

        if (estado === "Cancelado") {
            const mensagemCancelamento = encomenda.stock_reposto
                ? `Cancelar esta encomenda ${encomenda.codigo_encomenda || ""}? O stock já foi reposto anteriormente.`
                : `Cancelar esta encomenda ${encomenda.codigo_encomenda || ""} e repor automaticamente o stock dos produtos?`;
            if (!window.confirm(mensagemCancelamento)) {
                select.value = estadoAnterior;
                return;
            }
            reporStock = !encomenda.stock_reposto;
        }

        if (estado === "Pago" && estadoAnterior !== "Pago") {
            const codigo = encomenda.codigo_encomenda || "";
            const origem = encomenda.origem || "Site";
            let avisoFatura = "";
            if (podeEmitirFaturaMoloni(encomenda)) {
                avisoFatura = encomendaOrigemOlx(encomenda)
                    ? "\n\nDepois pode escolher se emite fatura-recibo no Moloni."
                    : "\n\nSerá emitida automaticamente uma fatura-recibo no Moloni.";
            }
            if (!window.confirm(`Marcar a encomenda ${codigo} (${origem}) como Pago?${avisoFatura}`)) {
                select.value = estadoAnterior;
                return;
            }
        }

        select.disabled = true;
        hooks.definirStatus("A atualizar o estado...");
        try {
            let data = null;
            let error = null;

            if (estado === "Cancelado") {
                ({ data, error } = await obterClient().rpc("cancelar_encomenda_plataforma_admin", {
                    p_encomenda_id: String(encomenda.id),
                    p_repor_stock: reporStock
                }));
            } else if (estadoAnterior === "Cancelado") {
                ({ data, error } = await obterClient().rpc("recuperar_encomenda_admin", {
                    p_encomenda_id: String(encomenda.id),
                    p_estado: estado
                }));
                if (!error && dataPagamentoIso) {
                    try {
                        const dataAtualizada = await atualizarDataPagamento(encomenda, dataPagamentoIso);
                        data = { ...(data || {}), created_at: dataAtualizada?.created_at || dataPagamentoIso };
                    } catch (erroData) {
                        console.warn("Nao foi possivel atualizar data de pagamento.", erroData);
                        data = { ...(data || {}), created_at: dataPagamentoIso };
                    }
                }
            } else {
                let respostaRpc;
                try {
                    respostaRpc = await obterClient().rpc("atualizar_estado_encomenda_admin", {
                        p_encomenda_id: String(encomenda.id),
                        p_estado: estado
                    });
                } catch (erroRede) {
                    respostaRpc = { data: null, error: erroRede };
                }
                data = respostaRpc.data;
                error = respostaRpc.error;

                if (error) {
                    try {
                        const dataAtualizada = await atualizarEstadoDireto(encomenda, estado, dataPagamentoIso);
                        data = { sucesso: true, estado, created_at: dataAtualizada?.created_at || dataPagamentoIso };
                        error = null;
                    } catch (erroFallback) {
                        throw new Error(
                            `RPC: ${detalheErro(respostaRpc.error)}. Atualização direta: ${detalheErro(erroFallback)}`
                        );
                    }
                } else if (dataPagamentoIso) {
                    try {
                        const dataAtualizada = await atualizarDataPagamento(encomenda, dataPagamentoIso);
                        data = { ...(data || {}), created_at: dataAtualizada?.created_at || dataPagamentoIso };
                    } catch (erroData) {
                        console.warn("Nao foi possivel atualizar data de pagamento.", erroData);
                        data = { ...(data || {}), created_at: dataPagamentoIso };
                    }
                }
            }
            if (error) throw error;
            if (data?.sucesso === false) throw new Error(data.erro || "Não foi possível atualizar.");
            encomenda.estado = estado;
            if (data?.created_at) encomenda.created_at = data.created_at;
            else if (dataPagamentoIso) encomenda.created_at = dataPagamentoIso;
            if (typeof data?.stock_reposto === "boolean") encomenda.stock_reposto = data.stock_reposto;
            else if (data?.stock_reposto) encomenda.stock_reposto = true;
            sincronizarEncomendaNaLista(encomenda, {
                estado,
                created_at: encomenda.created_at,
                stock_reposto: encomenda.stock_reposto
            });
            let anexosEliminados = 0;
            let erroAnexos = null;
            if (estado === "Concluído") {
                try {
                    anexosEliminados = await apagarAnexos(encomenda);
                } catch (erroLimpezaAnexos) {
                    erroAnexos = erroLimpezaAnexos;
                    console.error("Erro ao eliminar anexos da encomenda concluida.", erroLimpezaAnexos);
                }
            }
            select.dataset.estadoAtual = estado;
            atualizarListaAposAlteracaoEncomenda();
            let mensagemFatura = "";
            if (estado === "Pago" && estadoAnterior !== "Pago" && podeEmitirFaturaMoloni(encomenda)) {
                let emitirFatura = deveEmitirFaturaMoloniAutomaticamente(encomenda);
                if (encomendaOrigemOlx(encomenda)) {
                    emitirFatura = pedirEmissaoFaturaMoloniOlx(encomenda);
                }
                if (emitirFatura) {
                    hooks.definirStatus(`Estado atualizado. A emitir fatura-recibo Moloni para ${encomenda.codigo_encomenda || ""}...`);
                    try {
                        const fatura = await emitirFaturaMoloni(encomenda, {
                            forcarOlx: encomendaOrigemOlx(encomenda)
                        });
                        if (fatura?.sucesso) {
                            const numeroFatura = fatura.numero && String(fatura.numero) !== "0"
                                ? ` n. ${fatura.numero}`
                                : " (rascunho)";
                            mensagemFatura = ` Fatura-recibo Moloni${numeroFatura} criada.`;
                        }
                    } catch (erroFatura) {
                        mensagemFatura = ` Fatura-recibo Moloni nao emitida: ${erroFatura.message || "erro desconhecido"}.`;
                    }
                }
            }
            if (erroAnexos) {
                hooks.definirStatus(
                    `Estado atualizado, mas não foi possível eliminar os anexos: ${erroAnexos.message || "erro desconhecido"}${mensagemFatura}`,
                    true
                );
            } else {
                const limpeza = estado === "Concluído" ? ` ${anexosEliminados} anexo(s) eliminado(s).` : "";
                const reposicao = estado === "Cancelado" && data?.stock_reposto ? " Stock reposto." : "";
                const recuperacao = estadoAnterior === "Cancelado" && estado !== "Cancelado"
                    ? (data?.stock_reduzido ? " Stock reduzido novamente." : " Encomenda recuperada.")
                    : "";
                const faturaComErro = mensagemFatura.includes("nao emitida");
                hooks.definirStatus(
                    `Estado da encomenda ${encomenda.codigo_encomenda || ""} atualizado.${limpeza}${reposicao}${recuperacao}${mensagemFatura}`,
                    faturaComErro
                );
            }
        } catch (error) {
            select.value = estadoAnterior;
            hooks.definirStatus("Erro ao atualizar estado: " + detalheErro(error), true);
        } finally {
            select.disabled = false;
        }
    }

    async function apagarEncomenda(encomenda, botao) {
        const codigo = encomenda.codigo_encomenda || `#${encomenda.id}`;
        const avisoStock = estadoNormalizado(encomenda.estado) !== "Cancelado"
            ? "\n\nAtenção: isto não repõe stock. Para repor stock, cancele primeiro a encomenda."
            : "";
        if (!window.confirm(`Apagar definitivamente a encomenda ${codigo}?${avisoStock}`)) return;
        if (!window.confirm("Confirmar eliminação definitiva? Esta ação não pode ser desfeita.")) return;

        botao.disabled = true;
        hooks.definirStatus("A apagar encomenda...");
        try {
            try {
                await apagarAnexos(encomenda);
            } catch (erroAnexos) {
                console.warn("Nao foi possivel eliminar anexos antes de apagar a encomenda.", erroAnexos);
            }

            const { data, error } = await obterClient().rpc("apagar_encomenda_admin", {
                p_encomenda_id: String(encomenda.id)
            });
            if (error || data?.sucesso === false) {
                throw error || new Error(data?.erro || "Erro ao apagar encomenda");
            }

            const lista = hooks.obterLista().filter(item => String(item.id) !== String(encomenda.id));
            hooks.definirLista(lista);
            atualizarListaAposAlteracaoEncomenda();
            hooks.onEncomendaApagada(encomenda);
            hooks.definirStatus(`Encomenda ${codigo} apagada.`);
        } catch (error) {
            botao.disabled = false;
            hooks.definirStatus("Erro ao apagar encomenda: " + detalheErro(error), true);
        }
    }

    function criarLinhaDetalhe(rotulo, valor) {
        const linha = criarElemento("div", "admin-encomenda-detalhe-linha");
        linha.append(
            criarElemento("strong", "", rotulo),
            criarElemento("span", "", valor || "—")
        );
        return linha;
    }

    function criarLinhaDetalheMorada(encomenda) {
        const linha = criarElemento("div", "admin-encomenda-detalhe-linha admin-encomenda-detalhe-linha-morada");
        linha.appendChild(criarElemento("strong", "", "Morada"));
        const formatar = window.MoradaFormato;
        if (formatar?.criarBlocoMorada) {
            linha.appendChild(formatar.criarBlocoMorada(formatar.formatarLinhasMorada(encomenda), criarElemento));
        } else {
            const morada = [encomenda.morada_cliente, encomenda.cp_cliente, encomenda.cidade_cliente, encomenda.pais_cliente]
                .filter(Boolean).join(", ");
            linha.appendChild(criarElemento("span", "", morada || "—"));
        }
        return linha;
    }

    function ligarAlturaNotasComInfo(card, grupoInfo, controloNotas, colunaAcoes) {
        const textarea = controloNotas?.elemento?.querySelector("textarea");
        if (!grupoInfo || !textarea) return;

        const ajustar = () => {
            const altura = Math.round(grupoInfo.offsetHeight);
            if (altura > 0) {
                textarea.style.height = `${altura}px`;
                textarea.style.minHeight = `${altura}px`;
                if (colunaAcoes) {
                    colunaAcoes.style.height = `${altura}px`;
                    colunaAcoes.style.maxHeight = `${altura}px`;
                }
            }
        };

        requestAnimationFrame(() => requestAnimationFrame(ajustar));

        if (typeof ResizeObserver !== "undefined") {
            const observador = new ResizeObserver(ajustar);
            observador.observe(grupoInfo);
            card._limparAlturaNotas = () => observador.disconnect();
        } else {
            window.addEventListener("resize", ajustar);
            card._limparAlturaNotas = () => window.removeEventListener("resize", ajustar);
        }

        card._ajustarAlturaNotas = ajustar;
    }

    function criarCardEncomenda(encomenda, opcoes = {}) {
        const modoModal = opcoes.modoModal === true;
        const ocultarCliente = opcoes.ocultarCliente === true;
        const card = criarElemento(
            "article",
            `admin-encomenda-card${encomenda.prioritaria ? " prioritaria" : ""}${modoModal ? " admin-encomenda-card-modal" : ""}`
        );
        card.dataset.encomendaId = String(encomenda.id);

        const cabecalho = criarElemento("div", "admin-encomenda-cabecalho");
        if (!modoModal) {
            cabecalho.tabIndex = 0;
            cabecalho.setAttribute("role", "button");
        } else {
            cabecalho.classList.add("admin-encomenda-cabecalho-fixo");
        }

        const linha = criarElemento("div", "admin-encomenda-linha");
        linha.append(
            criarElemento("strong", "admin-encomenda-codigo", encomenda.codigo_encomenda || `#${encomenda.id}`),
            criarElemento("span", "admin-encomenda-data", formatarData(encomenda.created_at)),
            criarElemento("span", `admin-encomenda-origem${obterClassePlataforma(encomenda.origem)}`, encomenda.origem || "Site")
        );

        if (!ocultarCliente) {
            const abrirCliente = criarElemento("button", "admin-encomenda-cliente-link", encomenda.nome_cliente || "Cliente sem nome");
            abrirCliente.type = "button";
            abrirCliente.title = "Abrir ficha do cliente";
            abrirCliente.addEventListener("click", evento => {
                evento.stopPropagation();
                if (typeof opcoes.abrirCliente === "function") opcoes.abrirCliente(encomenda);
            });
            abrirCliente.addEventListener("keydown", evento => evento.stopPropagation());
            linha.appendChild(abrirCliente);
        } else {
            linha.appendChild(criarElemento("span", "admin-encomenda-cliente-link admin-encomenda-cliente-texto", encomenda.nome_cliente || "Cliente sem nome"));
        }

        linha.append(
            criarElemento("strong", "admin-encomenda-valor-linha", formatarEuro(encomenda.total)),
            criarElemento("span", `estado-encomenda estado-${normalizar(estadoNormalizado(encomenda.estado)).replace(/\s+/g, "-")}`, estadoNormalizado(encomenda.estado))
        );

        const anexosContagem = criarElemento(
            "span",
            `admin-encomenda-anexos-contagem${Number(encomenda.num_anexos) === 0 ? " sem-anexos" : ""}`,
            formatarTextoContagemAnexos(encomenda.num_anexos)
        );
        anexosContagem.dataset.encomendaId = String(encomenda.id);
        anexosContagem.title = formatarTextoContagemAnexos(encomenda.num_anexos);
        linha.appendChild(anexosContagem);

        if (estadoNormalizado(encomenda.estado) === "Pago") {
            const prioridade = criarElemento("label", "admin-encomenda-prioridade");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = Boolean(encomenda.prioritaria);
            checkbox.addEventListener("click", evento => evento.stopPropagation());
            checkbox.addEventListener("keydown", evento => evento.stopPropagation());
            checkbox.addEventListener("change", () => atualizarPrioridade(encomenda, checkbox.checked, checkbox));
            prioridade.addEventListener("click", evento => evento.stopPropagation());
            prioridade.append(checkbox, criarElemento("span", "", "Prioritária"));
            linha.appendChild(prioridade);
        } else {
            linha.appendChild(criarElemento("span", "admin-encomenda-prioridade-vazia", ""));
        }

        cabecalho.append(linha);
        if (!modoModal) cabecalho.appendChild(criarElemento("span", "admin-encomenda-seta", "▾"));

        const detalhes = criarElemento("div", "admin-encomenda-detalhes");
        detalhes.hidden = false;
        let gestaoEncomenda = null;
        let controloNotas = null;
        let controloTotal = null;
        let gravarTudo = null;

        function temAlteracoesPendentes() {
            return Boolean(
                controloNotas?.temAlteracoesPendentes?.()
                || gestaoEncomenda?.temAnexosPendentes?.()
                || controloTotal?.temAlteracao?.()
            );
        }

        function reverterAlteracoesPendentes() {
            gestaoEncomenda?.reverterAnexos?.();
            controloTotal?.reverter?.();
        }

        async function gravarAlteracoesPendentes() {
            if (!temAlteracoesPendentes()) return true;
            if (gravarTudo) gravarTudo.disabled = true;
            let ok = true;

            if (controloNotas?.temAlteracoesPendentes?.()) {
                ok = (await controloNotas.guardar()) && ok;
            }
            if (ok && gestaoEncomenda?.temAnexosPendentes?.()) {
                ok = (await gestaoEncomenda.enviarAnexosPendentes()) && ok;
            }
            if (ok && controloTotal?.temAlteracao?.()) {
                ok = (await controloTotal.guardar()) && ok;
            }

            if (!ok) hooks.definirStatus("Algumas alterações não foram guardadas.", true);
            if (gravarTudo) gravarTudo.disabled = false;
            return ok;
        }

        async function prepararSaidaEncomenda() {
            await controloNotas?.gravarAoSair?.();
            reverterAlteracoesPendentes();
        }

        if (!modoModal) {
            detalhes.hidden = true;
            card.classList.remove("aberta");
            const alternarDetalhes = async () => {
                if (!detalhes.hidden) {
                    await prepararSaidaEncomenda();
                }
                detalhes.hidden = !detalhes.hidden;
                card.classList.toggle("aberta", !detalhes.hidden);
                if (!detalhes.hidden) {
                    gestaoEncomenda?.carregarAnexos?.();
                    card._ajustarAlturaNotas?.();
                }
            };
            cabecalho.addEventListener("click", alternarDetalhes);
            cabecalho.addEventListener("keydown", evento => {
                if (evento.key !== "Enter" && evento.key !== " ") return;
                evento.preventDefault();
                alternarDetalhes();
            });
        }

        const dados = criarElemento("div", "admin-encomenda-dados");
        const colunaCliente = criarElemento("div", "admin-encomenda-dados-coluna admin-encomenda-dados-cliente");
        const colunaContacto = criarElemento("div", "admin-encomenda-dados-coluna admin-encomenda-dados-contacto");
        const colunaNotas = criarElemento("div", "admin-encomenda-dados-coluna admin-encomenda-dados-notas");
        const colunaAcoes = criarElemento("div", "admin-encomenda-dados-coluna admin-encomenda-dados-acoes");

        colunaCliente.append(
            criarLinhaDetalhe("Nome", encomenda.nome_cliente),
            criarLinhaDetalheMorada(encomenda)
        );

        colunaContacto.append(
            criarLinhaDetalhe("E-mail", encomenda.email_cliente),
            criarLinhaDetalhe("Telemóvel", encomenda.telefone_cliente),
            criarLinhaDetalhe("Envio", encomenda.metodo_envio_nome || encomenda.metodo_envio),
            criarLinhaDetalhe("Portes", formatarEuro(encomenda.portes)),
            criarLinhaDetalhe("Pagamento", encomenda.metodo_pagamento)
        );

        if (encomenda.referencia_externa) {
            colunaContacto.appendChild(criarLinhaDetalhe("Referência externa", encomenda.referencia_externa));
        }
        if (encomenda.stock_reposto) {
            colunaContacto.appendChild(criarLinhaDetalhe("Stock", "Reposto após cancelamento"));
        }

        const grupoInfo = criarElemento("div", "admin-encomenda-dados-info-grupo");
        grupoInfo.append(colunaCliente, colunaContacto);

        const grupoConteudo = criarElemento("div", "admin-encomenda-dados-conteudo");
        grupoConteudo.append(grupoInfo, colunaNotas);

        controloNotas = criarSecaoNotasInternasEncomenda(encomenda, { compacto: true, semBotao: true });
        colunaNotas.appendChild(controloNotas.elemento);

        gravarTudo = criarElemento("button", "wallapop-botao wallapop-botao-destaque admin-encomenda-gravar", "Gravar");
        gravarTudo.type = "button";
        gravarTudo.addEventListener("mousedown", () => {
            controloNotas?.ignorarProximoBlur?.();
        });
        gravarTudo.addEventListener("click", evento => {
            evento.stopPropagation();
            gravarAlteracoesPendentes();
        });
        const origem = normalizar(encomenda.origem);
        const plataformaExterna = ["wallapop", "olx", "todocoleccion"].includes(origem);
        const podeEditar = plataformaExterna
            && estadoNormalizado(encomenda.estado) !== "Cancelado"
            && encomenda.codigo_encomenda;

        const botoesAcoes = criarElemento("div", "admin-encomenda-dados-botoes");
        botoesAcoes.appendChild(gravarTudo);
        if (podeEditar) {
            const editar = criarElemento("a", "wallapop-botao admin-encomenda-editar", "Editar");
            editar.href = `plataforma.html?editar=${encodeURIComponent(encomenda.codigo_encomenda)}`;
            editar.addEventListener("click", evento => evento.stopPropagation());
            botoesAcoes.appendChild(editar);
        }
        const apagar = criarElemento("button", "wallapop-botao admin-encomenda-apagar", "Apagar");
        apagar.type = "button";
        apagar.addEventListener("click", evento => {
            evento.stopPropagation();
            apagarEncomenda(encomenda, apagar);
        });
        botoesAcoes.appendChild(apagar);
        colunaAcoes.appendChild(botoesAcoes);
        dados.append(grupoConteudo, colunaAcoes);

        const produtos = criarElemento("div", "admin-encomenda-produtos");
        const lista = criarElemento("div", "admin-encomenda-produtos-lista");
        obterProdutos(encomenda).forEach(item => {
            const linhaProduto = criarElemento("div", "admin-encomenda-produto");
            const quantidade = Number(item.quantidade || item.qtd || 1);
            const preco = Number(item.preco_unitario ?? item.preco ?? 0);
            linhaProduto.append(
                criarElemento("span", "admin-encomenda-produto-quantidade", `${quantidade}x`),
                criarElemento("strong", "admin-encomenda-produto-nome", item.nome || "Produto"),
                criarMiniaturaProduto(item),
                criarElemento("span", "admin-encomenda-produto-tema", obterTemaProduto(item)),
                criarElemento("span", "admin-encomenda-produto-subtema", obterSubtemaProduto(item)),
                criarElemento("span", "admin-encomenda-produto-referencia", `Ref. ${obterReferenciaProduto(item) || "—"}`),
                criarElemento("span", "admin-encomenda-produto-sku", `SKU ${item.sku || "—"}`),
                criarElemento("span", "admin-encomenda-produto-preco", formatarEuro(preco))
            );
            lista.appendChild(linhaProduto);
        });
        controloTotal = criarLinhaTotalEditavel(encomenda, card);
        produtos.append(lista, controloTotal.elemento);

        const gestaoLinha = criarElemento("div", "admin-encomenda-gestao");
        const blocoEstado = criarElemento("div", "admin-encomenda-gestao-bloco admin-encomenda-gestao-estado");
        blocoEstado.appendChild(criarElemento("span", "admin-encomenda-gestao-rotulo", "Estado"));
        const caixaEstado = criarElemento("div", "admin-encomenda-gestao-caixa admin-encomenda-estado-caixa");
        const select = document.createElement("select");
        const estadoAtual = estadoNormalizado(encomenda.estado);
        ESTADOS_ENCOMENDA.forEach(estado => {
            const option = new Option(estado, estado, false, estado === estadoAtual);
            select.add(option);
        });
        select.dataset.estadoAtual = estadoAtual;
        select.addEventListener("click", evento => evento.stopPropagation());
        select.addEventListener("keydown", evento => evento.stopPropagation());
        select.addEventListener("change", evento => {
            evento.stopPropagation();
            if (select.value === select.dataset.estadoAtual) return;
            atualizarEstado(encomenda, select.value, select);
        });
        caixaEstado.appendChild(select);
        blocoEstado.appendChild(caixaEstado);

        gestaoEncomenda = criarGestaoEncomenda(encomenda);
        gestaoLinha.append(blocoEstado, gestaoEncomenda);

        detalhes.append(dados, gestaoLinha, produtos);
        card.append(cabecalho, detalhes);
        ligarAlturaNotasComInfo(card, grupoInfo, controloNotas, colunaAcoes);

        if (modoModal) {
            gestaoEncomenda.carregarAnexos?.();
            card._ajustarAlturaNotas?.();
        }
        return card;
    }

    function aplicarMetadadosProdutoEncomenda(produto) {
        if (!produto) return;
        const id = String(produto.id || "");
        const sku = String(produto.sku || "").trim();
        const skuChave = sku.toUpperCase();

        const referencia = String(produto.referencia || "").trim();
        if (referencia) {
            if (id) referenciasProdutos.set(id, referencia);
            if (skuChave) referenciasProdutosPorSku.set(skuChave, referencia);
        }

        const tema = String(produto.tema || "").trim();
        if (tema) {
            if (id) temasProdutos.set(id, tema);
            if (skuChave) temasProdutosPorSku.set(skuChave, tema);
        }

        const subtema = String(produto.subtema || "").trim();
        if (subtema) {
            if (id) subtemasProdutos.set(id, subtema);
            if (skuChave) subtemasProdutosPorSku.set(skuChave, subtema);
        }

        const imagem = obterPrimeiraImagem(produto.imagens);
        if (imagem) {
            if (id) imagensProdutos.set(id, imagem);
            if (skuChave) imagensProdutosPorSku.set(skuChave, imagem);
        }
    }

    async function carregarMetadadosProdutosLojaPorIds(ids) {
        for (let inicio = 0; inicio < ids.length; inicio += 200) {
            const loteIds = ids.slice(inicio, inicio + 200);
            const { data, error } = await obterClient()
                .from("produtos_loja")
                .select("id, sku, tema, subtema, imagens")
                .in("id", loteIds);
            if (error) {
                console.warn("Nao foi possivel carregar tema/subtema por id.", error);
                continue;
            }
            (data || []).forEach(aplicarMetadadosProdutoEncomenda);
        }
    }

    async function carregarMetadadosProdutosLojaPorSkus(skus) {
        for (let inicio = 0; inicio < skus.length; inicio += 200) {
            const loteSkus = skus.slice(inicio, inicio + 200);
            const { data, error } = await obterClient()
                .from("produtos_loja")
                .select("id, sku, tema, subtema, imagens")
                .in("sku", loteSkus);
            if (error) {
                console.warn("Nao foi possivel carregar tema/subtema por sku.", error);
                continue;
            }
            (data || []).forEach(aplicarMetadadosProdutoEncomenda);
        }
    }

    async function carregarImagensParaEncomendas(encomendas) {
        const itens = (encomendas || []).flatMap(obterProdutos);
        const ids = [...new Set(itens.map(item => String(item.id_produto || item.id || "")).filter(Boolean))];
        const skus = [...new Set(itens.map(item => String(item.sku || "").trim()).filter(Boolean))];
        if (!ids.length && !skus.length) return;

        if (ids.length) {
            for (let inicio = 0; inicio < ids.length; inicio += 200) {
                const loteIds = ids.slice(inicio, inicio + 200);
                const respostaAdmin = await obterClient().rpc("obter_imagens_produtos_encomendas_admin", {
                    p_ids: loteIds
                });

                if (!respostaAdmin.error) {
                    const produtos = Array.isArray(respostaAdmin.data) ? respostaAdmin.data : [];
                    produtos.forEach(aplicarMetadadosProdutoEncomenda);
                }
            }
            await carregarMetadadosProdutosLojaPorIds(ids);
        }

        const skusEmFalta = skus.filter(sku => !temasProdutosPorSku.has(sku.toUpperCase()));
        if (skusEmFalta.length) {
            await carregarMetadadosProdutosLojaPorSkus(skusEmFalta);
        }
    }

    function limparCacheImagens() {
        imagensProdutos = new Map();
        imagensProdutosPorSku = new Map();
        referenciasProdutos = new Map();
        referenciasProdutosPorSku = new Map();
        temasProdutos = new Map();
        temasProdutosPorSku = new Map();
        subtemasProdutos = new Map();
        subtemasProdutosPorSku = new Map();
    }

    return {
        ESTADOS_ENCOMENDA,
        configurar,
        criarCardEncomenda,
        carregarContagensAnexosLista,
        atualizarContagemAnexosLista,
        carregarImagensParaEncomendas,
        limparCacheImagens,
        formatarEuro,
        formatarData,
        estadoNormalizado,
        normalizar,
        abrirImagemProduto,
        fecharImagemProduto
    };
})();
