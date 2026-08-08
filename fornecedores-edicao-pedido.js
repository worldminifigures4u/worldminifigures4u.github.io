(function () {
'use strict';
function analisarLinhaListaFinalFornecedor(linha, numeroLinha) {
    const partes = dividirLinhaListaFinalFornecedor(linha).map(parte => String(parte || "").trim()).filter(Boolean);
    if (!partes.length) return null;
    if (partes.length < 2) {
        return { erro: `linha ${numeroLinha}: falta quantidade`, original: linha };
    }

    const referencia = partes[0];
    const quantidade = Math.floor(converterNumeroListaFornecedor(partes[1]));
    if (!referencia || quantidade <= 0) {
        return { erro: `linha ${numeroLinha}: referência ou quantidade inválida`, original: linha };
    }

    const precoTexto = partes.slice(2).join(" ");
    const precoCusto = Math.max(0, converterNumeroListaFornecedor(precoTexto));
    return { referencia, quantidade, preco_custo: precoCusto, original: linha };
}

function processarLinhasListaFinalFornecedor(texto) {
    const linhas = String(texto || "").split(/\r?\n/);
    const itens = [];
    const erros = [];
    const foraCatalogo = [];

    linhas.forEach((linha, indice) => {
        const analisada = analisarLinhaListaFinalFornecedor(linha, indice + 1);
        if (!analisada) return;
        if (analisada.erro) {
            erros.push(analisada.erro);
            return;
        }

        const produto = encontrarProdutoListaFinalFornecedor(analisada.referencia);
        if (!produto) foraCatalogo.push(analisada.referencia);
        const item = criarItemFornecedorAPartirListaFinal(analisada, produto);
        if (produto) {
            item.referencia = analisada.referencia;
            item.nome = produto.nome || item.nome;
            item.sku = produto.sku || item.sku || "";
            item.tema = produto.tema || item.tema || "";
            item.subtema = produto.subtema || item.subtema || "";
            item.imagens = produto.imagens || item.imagens || [];
        }
        itens.push(item);
    });

    const unidades = itens.reduce((total, item) => total + Math.max(0, Number(item.quantidade || 0)), 0);
    return { itens, erros, foraCatalogo, unidades };
}

function aplicarListaFinalFornecedor() {
    const area = document.getElementById("fornecedor-lista-final");
    if (!area) return;
    const textoLista = String(area.value || "");
    if (textoLista.length > FORNECEDOR_LISTA_MAX_CARACTERES) {
        definirStatusFornecedor(`A lista é demasiado grande. Limite: ${FORNECEDOR_LISTA_MAX_CARACTERES.toLocaleString('pt-PT')} caracteres.`, true);
        return;
    }
    if (textoLista.split(/\r?\n/).filter(linha => linha.trim()).length > FORNECEDOR_LISTA_MAX_LINHAS) {
        definirStatusFornecedor(`A lista tem demasiadas linhas. Limite: ${FORNECEDOR_LISTA_MAX_LINHAS} referências por colagem.`, true);
        return;
    }

    const { itens: importados, erros, foraCatalogo, unidades } = processarLinhasListaFinalFornecedor(textoLista);
    if (!importados.length) {
        const detalhe = erros.length ? ` ${erros.join("; ")}` : "";
        definirStatusFornecedor(`Não foi possível importar produtos da lista.${detalhe}`, true);
        return;
    }

    if (fornecedorSelecao.length && !window.confirm("Substituir a lista atual pela lista final enviada pelo fornecedor?")) {
        return;
    }

    fornecedorSelecao = importados;
    guardarSelecaoFornecedor();
    renderizarResultadosFornecedor();
    renderizarSelecionadosFornecedor();

    const avisos = [];
    if (foraCatalogo.length) avisos.push(`${foraCatalogo.length} referência(s) fora do catálogo incluída(s): ${foraCatalogo.join(", ")}`);
    if (erros.length) avisos.push(erros.join("; "));
    definirStatusFornecedor(`${importados.length} linha(s), ${unidades} unidade(s) aplicadas à encomenda.${avisos.length ? " " + avisos.join(" | ") : ""}`, Boolean(avisos.length));
}

function limparTextoListaFinalFornecedor() {
    const area = document.getElementById("fornecedor-lista-final");
    if (area) area.value = "";
    definirStatusFornecedor("Texto da lista final limpo.");
}

function obterPedidoEdicaoFornecedor(modal) {
    const id = modal?.querySelector("#fornecedor-edicao-id")?.value;
    return fornecedorPedidos.find(item => String(item.id) === String(id)) || null;
}

function montarLinhaEdicaoProdutoFornecedor(pedido, item, indice) {
    const produtoAtual = obterProdutoParaPedidoFornecedor(item) || item;
    const quantidadeOriginal = Math.max(0, Number(item.quantidade_original ?? item.quantidade ?? 0));
    const quantidadeAtual = Math.max(0, Number(item.quantidade || 0));
    const faltaAtual = Math.max(0, Number(item.falta_os || Math.max(0, quantidadeOriginal - quantidadeAtual)));
    const precoCustoAtual = Number(item.preco_custo ?? item.custo ?? item.preco ?? 0) || 0;
    const linha = document.createElement("div");
    linha.className = "fornecedor-edicao-produto";
    if (faltaAtual > 0 || item.estado_fornecedor === "OS") linha.classList.add("tem-os");
    linha.dataset.indice = String(indice);
    linha.dataset.referencia = item.referencia || produtoAtual.referencia || "";
    linha.dataset.sku = item.sku || produtoAtual.sku || "";
    linha.dataset.quantidadeOriginal = String(quantidadeOriginal);
    linha.appendChild(criarImagemFornecedor(produtoAtual, "fornecedor-miniatura pequena"));

    const info = document.createElement("div");
    info.className = "fornecedor-info";
    const nome = document.createElement("strong");
    nome.textContent = item.nome || produtoAtual.nome || "Produto";
    const ids = document.createElement("span");
    ids.className = "fornecedor-identificadores";
    ids.textContent = `Ref. ${item.referencia || produtoAtual.referencia || "-"} | SKU ${item.sku || produtoAtual.sku || "-"}`;
    const ajuste = document.createElement("span");
    ajuste.className = faltaAtual > 0 ? "fornecedor-ajuste-os ativo" : "fornecedor-ajuste-os";
    const dataOsTexto = item.data_os ? ` | desde ${formatarDataOsCurtaFornecedor(item.data_os)}` : "";
    ajuste.textContent = faltaAtual > 0
        ? `Inicial: ${quantidadeOriginal} | OS: ${faltaAtual}${dataOsTexto}`
        : `Inicial: ${quantidadeOriginal}`;
    if (item.origem_ajuste) {
        const textoOrigem = obterTextoOrigemAjustePedidoFornecedor(item.origem_ajuste);
        if (textoOrigem) ajuste.textContent += ` | ${textoOrigem}`;
    }
    info.append(nome, ids, ajuste);

    const campos = document.createElement("div");
    campos.className = "fornecedor-edicao-produto-campos";
    const quantidade = document.createElement("label");
    quantidade.textContent = "A receber";
    const quantidadeInput = document.createElement("input");
    quantidadeInput.type = "text";
    quantidadeInput.inputMode = "numeric";
    quantidadeInput.autocomplete = "off";
    quantidadeInput.value = String(quantidadeAtual);
    quantidadeInput.dataset.campo = "quantidade";
    quantidade.appendChild(quantidadeInput);

    const falta = document.createElement("label");
    falta.textContent = "OS/Falta";
    const faltaInput = document.createElement("input");
    faltaInput.type = "text";
    faltaInput.inputMode = "numeric";
    faltaInput.autocomplete = "off";
    faltaInput.value = String(faltaAtual);
    faltaInput.dataset.campo = "falta_os";
    falta.appendChild(faltaInput);

    const precoCusto = document.createElement("label");
    precoCusto.textContent = "preço compra";
    const precoCustoInput = document.createElement("input");
    precoCustoInput.type = "text";
    precoCustoInput.inputMode = "decimal";
    precoCustoInput.autocomplete = "off";
    precoCustoInput.value = precoCustoAtual.toFixed(2).replace(".", ",");
    precoCustoInput.dataset.campo = "preco_custo";
    precoCusto.appendChild(precoCustoInput);

    const recebido = document.createElement("div");
    recebido.className = "fornecedor-edicao-recebido-info";
    const recebidoAtual = ["A preparar", "Encomendada"].includes(pedido.estado)
        ? 0
        : Math.max(0, Number(item.recebido || 0));
    recebido.dataset.campo = "recebido";
    recebido.dataset.valor = String(recebidoAtual);
    const recebidoTitulo = document.createElement("strong");
    recebidoTitulo.textContent = "Recebido";
    const recebidoValor = document.createElement("span");
    recebidoValor.textContent = String(recebidoAtual);
    recebido.append(recebidoTitulo, recebidoValor);

    const marcarOs = document.createElement("label");
    marcarOs.className = "fornecedor-edicao-marcar-os";
    marcarOs.title = "Marca a figura como OS neste fornecedor e regista a data na ficha do produto";
    const marcarOsInput = document.createElement("input");
    marcarOsInput.type = "checkbox";
    marcarOsInput.dataset.campo = "marcar_os";
    marcarOsInput.checked = faltaAtual > 0 || item.estado_fornecedor === "OS";
    marcarOs.append(marcarOsInput, document.createTextNode(" Marcar OS"));

    const marcarEx = document.createElement("label");
    marcarEx.className = "fornecedor-edicao-marcar-ex";
    marcarEx.title = "Marca a figura como EX (preço demasiado caro neste fornecedor) e regista a data na ficha do produto";
    const marcarExInput = document.createElement("input");
    marcarExInput.type = "checkbox";
    marcarExInput.dataset.campo = "marcar_ex";
    marcarExInput.checked = item.estado_fornecedor === "EX";
    marcarEx.append(marcarExInput, document.createTextNode(" Marcar EX"));
    marcarExInput.addEventListener("change", () => {
        if (marcarExInput.checked && marcarOsInput.checked) {
            marcarOsInput.checked = false;
            faltaInput.value = "0";
            quantidadeInput.value = String(quantidadeOriginal);
            atualizarAjuste();
        }
    });
    marcarOsInput.addEventListener("change", () => {
        if (marcarOsInput.checked && marcarExInput.checked) marcarExInput.checked = false;
    });

    const remover = document.createElement("label");
    remover.className = "fornecedor-edicao-remover";
    const removerInput = document.createElement("input");
    removerInput.type = "checkbox";
    removerInput.dataset.campo = "remover";
    remover.append(removerInput, document.createTextNode(" Remover"));

    const lerNumeroCampo = (input, casas = 0) => {
        const bruto = String(input?.value || "").trim().replace(",", ".");
        const numero = Number(bruto);
        if (!Number.isFinite(numero) || numero < 0) return 0;
        if (casas <= 0) return Math.floor(numero);
        return Math.round(numero * (10 ** casas)) / (10 ** casas);
    };
    const atualizarAjuste = () => {
        const faltaValor = lerNumeroCampo(faltaInput);
        ajuste.className = faltaValor > 0 ? "fornecedor-ajuste-os ativo" : "fornecedor-ajuste-os";
        ajuste.textContent = faltaValor > 0
            ? `Inicial: ${quantidadeOriginal} | OS: ${faltaValor}`
            : `Inicial: ${quantidadeOriginal}`;
        linha.classList.toggle("tem-os", faltaValor > 0 || marcarOsInput.checked);
    };

    const sincronizarFalta = () => {
        const pedidoValor = lerNumeroCampo(quantidadeInput);
        quantidadeInput.value = String(pedidoValor);
        const faltaValor = Math.max(0, quantidadeOriginal - pedidoValor);
        faltaInput.value = String(faltaValor);
        marcarOsInput.checked = faltaValor > 0;
        atualizarAjuste();
    };
    const sincronizarQuantidade = () => {
        const faltaValor = lerNumeroCampo(faltaInput);
        faltaInput.value = String(faltaValor);
        quantidadeInput.value = String(Math.max(0, quantidadeOriginal - faltaValor));
        marcarOsInput.checked = faltaValor > 0;
        atualizarAjuste();
    };
    const confirmarPreco = () => {
        const preco = lerNumeroCampo(precoCustoInput, 2);
        precoCustoInput.value = preco.toFixed(2).replace(".", ",");
    };
    marcarOsInput.addEventListener("change", () => {
        if (marcarOsInput.checked) {
            const quantidadeAtualLinha = lerNumeroCampo(quantidadeInput);
            if (quantidadeAtualLinha >= quantidadeOriginal) {
                faltaInput.value = String(Math.max(1, quantidadeOriginal));
                quantidadeInput.value = "0";
            } else {
                const faltaValor = Math.max(1, quantidadeOriginal - quantidadeAtualLinha, lerNumeroCampo(faltaInput));
                faltaInput.value = String(faltaValor);
                quantidadeInput.value = String(Math.max(0, quantidadeOriginal - faltaValor));
            }
        } else {
            faltaInput.value = "0";
            quantidadeInput.value = String(quantidadeOriginal);
        }
        atualizarAjuste();
    });
    // Aceitar valor ao sair da célula (clicar fora) ou ao pressionar Enter
    quantidadeInput.addEventListener("change", sincronizarFalta);
    quantidadeInput.addEventListener("blur", sincronizarFalta);
    faltaInput.addEventListener("change", sincronizarQuantidade);
    faltaInput.addEventListener("blur", sincronizarQuantidade);
    precoCustoInput.addEventListener("change", confirmarPreco);
    precoCustoInput.addEventListener("blur", confirmarPreco);
    [quantidadeInput, faltaInput, precoCustoInput].forEach((inputNumero) => {
        inputNumero.addEventListener("keydown", (evento) => {
            if (evento.key === "Enter") {
                evento.preventDefault();
                inputNumero.blur();
            }
        });
    });

    campos.append(quantidade, falta, precoCusto, recebido, marcarOs, marcarEx, remover);
    linha.append(info, campos);
    return linha;
}

function linhaEdicaoContemReferenciaFornecedor(linha, referencia) {
    if (!referencia) return false;
    return correspondeReferenciaListaFornecedor(linha.dataset.referencia, referencia)
        || correspondeReferenciaListaFornecedor(linha.dataset.sku, referencia);
}

function aplicarListaFinalNaEdicaoFornecedor() {
    const modal = document.getElementById("fornecedor-edicao-modal");
    if (!modal || modal.hidden) return;
    const area = modal.querySelector("#fornecedor-edicao-lista-final");
    const status = modal.querySelector("#fornecedor-edicao-status");
    const texto = String(area?.value || "");
    if (texto.length > FORNECEDOR_LISTA_MAX_CARACTERES) {
        if (status) {
            status.textContent = `A lista é demasiado grande. Limite: ${FORNECEDOR_LISTA_MAX_CARACTERES.toLocaleString('pt-PT')} caracteres.`;
            status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
            status.classList.add('status-erro');
        }
        return;
    }
    if (texto.split(/\r?\n/).filter(linha => linha.trim()).length > FORNECEDOR_LISTA_MAX_LINHAS) {
        if (status) {
            status.textContent = `A lista tem demasiadas linhas. Limite: ${FORNECEDOR_LISTA_MAX_LINHAS} referências por colagem.`;
            status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
            status.classList.add('status-erro');
        }
        return;
    }

    const pedido = obterPedidoEdicaoFornecedor(modal);
    if (!pedido) return;

    const { itens, erros, foraCatalogo, unidades } = processarLinhasListaFinalFornecedor(texto);
    if (!itens.length) {
        if (status) {
            status.textContent = erros.length ? erros.join("; ") : "Cole a lista final do fornecedor antes de aplicar.";
            status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
            status.classList.add('status-erro');
        }
        return;
    }

    pedido.itens = itens;
    const lista = modal.querySelector("#fornecedor-edicao-produtos");
    if (lista) {
        lista.replaceChildren();
        itens.forEach((item, indice) => {
            lista.appendChild(montarLinhaEdicaoProdutoFornecedor(pedido, item, indice));
        });
    }

    if (status) {
        const avisos = [];
        if (foraCatalogo.length) avisos.push(`${foraCatalogo.length} referência(s) fora do catálogo incluída(s): ${foraCatalogo.join(", ")}`);
        if (erros.length) avisos.push(erros.join("; "));
        status.textContent = `Lista aplicada: ${itens.length} linha(s), ${unidades} unidade(s).${avisos.length ? " " + avisos.join(" | ") : ""}`;
        status.classList.remove("status-erro", "status-sucesso", "status-aviso", "status-neutro");
        status.classList.add(avisos.length ? "status-aviso" : "status-sucesso");
    }
}

function limparListaFinalEdicaoFornecedor() {
    const modal = document.getElementById("fornecedor-edicao-modal");
    const area = modal?.querySelector("#fornecedor-edicao-lista-final");
    if (area) area.value = "";
}

function analisarLinhaListaOsFornecedor(linha, numeroLinha) {
    const partes = dividirLinhaListaFinalFornecedor(linha).map((parte) => String(parte || "").trim()).filter(Boolean);
    if (!partes.length) return null;

    const referencia = partes[0];
    if (!referencia) {
        return { erro: `linha ${numeroLinha}: referência inválida`, original: linha };
    }

    let quantidadeOs = null;
    if (partes.length >= 2) {
        const quantidade = Math.floor(converterNumeroListaFornecedor(partes[1]));
        if (quantidade > 0) quantidadeOs = quantidade;
        else if (/^\d+([.,]\d+)?$/.test(String(partes[1]).replace(/\s/g, ""))) {
            return { erro: `linha ${numeroLinha}: quantidade OS inválida`, original: linha };
        }
    }

    return { referencia, quantidadeOs, original: linha };
}

function processarLinhasListaOsFornecedor(texto) {
    const linhas = String(texto || "").split(/\r?\n/);
    const itens = [];
    const erros = [];

    linhas.forEach((linha, indice) => {
        const analisada = analisarLinhaListaOsFornecedor(linha, indice + 1);
        if (!analisada) return;
        if (analisada.erro) {
            erros.push(analisada.erro);
            return;
        }
        itens.push(analisada);
    });

    return { itens, erros };
}

function aplicarListaOsNaLinhaEdicaoFornecedor(linha, quantidadeOsIndicada = null) {
    const quantidadeOriginal = Math.max(0, Math.floor(Number(linha.dataset.quantidadeOriginal || 0)));
    const quantidadeInput = linha.querySelector('[data-campo="quantidade"]');
    const faltaInput = linha.querySelector('[data-campo="falta_os"]');
    const marcarOsInput = linha.querySelector('[data-campo="marcar_os"]');
    const removerInput = linha.querySelector('[data-campo="remover"]');
    if (!quantidadeInput || !faltaInput || !marcarOsInput) return false;

    const faltaOs = Math.max(
        1,
        Math.min(
            quantidadeOriginal || 1,
            quantidadeOsIndicada == null ? (quantidadeOriginal || 1) : Math.floor(Number(quantidadeOsIndicada) || 0)
        )
    );
    if (removerInput) removerInput.checked = false;
    marcarOsInput.checked = true;
    faltaInput.value = String(faltaOs);
    quantidadeInput.value = String(Math.max(0, quantidadeOriginal - faltaOs));
    linha.classList.add("tem-os");

    const ajuste = linha.querySelector(".fornecedor-ajuste-os");
    if (ajuste) {
        ajuste.className = "fornecedor-ajuste-os ativo";
        ajuste.textContent = `Inicial: ${quantidadeOriginal} | OS: ${faltaOs}`;
    }
    return true;
}

function aplicarListaOsNaEdicaoFornecedor() {
    const modal = document.getElementById("fornecedor-edicao-modal");
    if (!modal || modal.hidden) return;
    const area = modal.querySelector("#fornecedor-edicao-lista-os");
    const status = modal.querySelector("#fornecedor-edicao-status");
    const texto = String(area?.value || "");

    if (texto.length > FORNECEDOR_LISTA_MAX_CARACTERES) {
        if (status) {
            status.textContent = `A lista OS é demasiado grande. Limite: ${FORNECEDOR_LISTA_MAX_CARACTERES.toLocaleString("pt-PT")} caracteres.`;
            status.classList.remove("status-aviso", "status-sucesso", "status-neutro");
            status.classList.add("status-erro");
        }
        return;
    }
    if (texto.split(/\r?\n/).filter((linha) => linha.trim()).length > FORNECEDOR_LISTA_MAX_LINHAS) {
        if (status) {
            status.textContent = `A lista OS tem demasiadas linhas. Limite: ${FORNECEDOR_LISTA_MAX_LINHAS} referências por colagem.`;
            status.classList.remove("status-aviso", "status-sucesso", "status-neutro");
            status.classList.add("status-erro");
        }
        return;
    }

    const { itens, erros } = processarLinhasListaOsFornecedor(texto);
    if (!itens.length) {
        if (status) {
            status.textContent = erros.length ? erros.join("; ") : "Cole a lista OS do fornecedor antes de aplicar.";
            status.classList.remove("status-aviso", "status-sucesso", "status-neutro");
            status.classList.add("status-erro");
        }
        return;
    }

    const linhas = Array.from(modal.querySelectorAll(".fornecedor-edicao-produto"));
    const aplicadas = [];
    const naoEncontradas = [];
    const vistas = new Set();

    itens.forEach((item) => {
        const chave = normalizarReferenciaListaFornecedor(item.referencia);
        if (vistas.has(chave)) return;
        vistas.add(chave);

        const linha = linhas.find((atual) => linhaEdicaoContemReferenciaFornecedor(atual, item.referencia));
        if (!linha) {
            naoEncontradas.push(item.referencia);
            return;
        }
        if (aplicarListaOsNaLinhaEdicaoFornecedor(linha, item.quantidadeOs)) {
            aplicadas.push(item.referencia);
        }
    });

    if (status) {
        const avisos = [];
        if (naoEncontradas.length) {
            avisos.push(`${naoEncontradas.length} não estão nesta encomenda: ${naoEncontradas.join(", ")}`);
        }
        if (erros.length) avisos.push(erros.join("; "));
        if (!aplicadas.length) {
            status.textContent = avisos.length
                ? `Nenhuma figura OS aplicada. ${avisos.join(" | ")}`
                : "Nenhuma figura da lista OS coincide com esta encomenda.";
            status.classList.remove("status-aviso", "status-sucesso", "status-neutro");
            status.classList.add("status-erro");
            return;
        }
        status.textContent = `${aplicadas.length} figura(s) marcada(s) como OS (removidas do a receber).${avisos.length ? " " + avisos.join(" | ") : ""}`;
        status.classList.remove("status-erro", "status-sucesso", "status-aviso", "status-neutro");
        status.classList.add(avisos.length ? "status-aviso" : "status-sucesso");
    }
}


function garantirModalEdicaoFornecedor() {
    let modal = document.getElementById('fornecedor-edicao-modal');
    // Recria se faltar a secção lista OS (modal antigo em memória)
    if (modal && !modal.querySelector('#fornecedor-edicao-lista-os')) {
        modal.remove();
        modal = null;
    }
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'fornecedor-edicao-modal';
    modal.className = 'fornecedor-edicao-modal';
    modal.hidden = true;
    modal.innerHTML = `
        <div class="fornecedor-edicao-dialog" role="dialog" aria-modal="true" aria-labelledby="fornecedor-edicao-titulo">
            <div class="fornecedor-edicao-topo">
                <h3 id="fornecedor-edicao-titulo">Editar encomenda do fornecedor</h3>
                <button type="button" class="fornecedor-edicao-fechar" id="fornecedor-edicao-fechar" aria-label="Fechar">x</button>
            </div>
            <form id="fornecedor-edicao-form" class="fornecedor-edicao-form">
                <input type="hidden" id="fornecedor-edicao-id">
                <div class="fornecedor-edicao-corpo">
                    <div class="fornecedor-edicao-grid">
                        <label>
                            Código da encomenda
                            <input type="text" id="fornecedor-edicao-codigo" placeholder="Código de seguimento do fornecedor">
                        </label>
                        <label>
                            Fornecedor
                            <input type="text" id="fornecedor-edicao-nome" required>
                        </label>
                        <label>
                            Referencia interna
                            <input type="text" id="fornecedor-edicao-referencia">
                        </label>
                        <label>
                            Estado
                            <select id="fornecedor-edicao-estado"></select>
                        </label>
                    </div>
                    <p class="fornecedor-edicao-aviso-guardar">As alterações aos campos acima só ficam guardadas ao clicar <strong>Guardar encomenda</strong>.</p>
                    <section class="fornecedor-lista-final-box fornecedor-lista-final-edicao" aria-label="Lista final enviada pelo fornecedor">
                        <h4>Colar lista final do fornecedor</h4>
                        <p>Depois de o fornecedor responder, cola aqui referência, quantidade e preço compra. A encomenda abaixo é corrigida automaticamente.</p>
                        <textarea id="fornecedor-edicao-lista-final" rows="5" placeholder="Ex.:&#10;AF301	2	1,25&#10;PG634	1	0,85"></textarea>
                        <div class="fornecedor-lista-final-acoes">
                            <button type="button" id="fornecedor-edicao-limpar-lista-final">Limpar texto</button>
                            <button type="button" id="fornecedor-edicao-aplicar-lista-final" class="wallapop-botao-destaque">Aplicar à encomenda</button>
                        </div>
                    </section>
                    <section class="fornecedor-lista-final-box fornecedor-lista-os-edicao" aria-label="Lista OS enviada pelo fornecedor">
                        <h4>Colar lista OS do fornecedor</h4>
                        <p>Cola as referências sem stock. São marcadas como OS e saem do “a receber” (a quantidade OS fica na ficha ao guardar).</p>
                        <textarea id="fornecedor-edicao-lista-os" rows="4" placeholder="Ex.:&#10;AF301&#10;PG634&#10;ou com quantidade:&#10;AF301	2"></textarea>
                        <div class="fornecedor-lista-final-acoes">
                            <button type="button" id="fornecedor-edicao-limpar-lista-os">Limpar texto</button>
                            <button type="button" id="fornecedor-edicao-aplicar-lista-os" class="wallapop-botao-destaque">Marcar OS na encomenda</button>
                        </div>
                    </section>
                    <div class="fornecedor-edicao-produtos" id="fornecedor-edicao-produtos"></div>
                    <p class="fornecedores-status fornecedor-edicao-status" id="fornecedor-edicao-status" role="status"></p>
                </div>
                <div class="fornecedores-acoes fornecedor-edicao-acoes">
                    <button type="button" id="fornecedor-edicao-cancelar" class="wallapop-botao">Cancelar</button>
                    <button type="submit" id="fornecedor-edicao-guardar" class="wallapop-botao wallapop-botao-destaque">Guardar encomenda</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#fornecedor-edicao-fechar')?.addEventListener('click', fecharEdicaoPedidoFornecedor);
    modal.querySelector('#fornecedor-edicao-cancelar')?.addEventListener('click', fecharEdicaoPedidoFornecedor);
    modal.querySelector('#fornecedor-edicao-aplicar-lista-final')?.addEventListener('click', aplicarListaFinalNaEdicaoFornecedor);
    modal.querySelector('#fornecedor-edicao-limpar-lista-final')?.addEventListener('click', limparListaFinalEdicaoFornecedor);
    modal.querySelector('#fornecedor-edicao-aplicar-lista-os')?.addEventListener('click', aplicarListaOsNaEdicaoFornecedor);
    modal.querySelector('#fornecedor-edicao-limpar-lista-os')?.addEventListener('click', limparListaOsEdicaoFornecedor);
    ligarFechoModalPorFundo(modal, fecharEdicaoPedidoFornecedor);
    modal.querySelector('#fornecedor-edicao-form')?.addEventListener('submit', guardarEdicaoPedidoFornecedor);
    modal.querySelector('#fornecedor-edicao-form')?.addEventListener('keydown', (evento) => {
        if (evento.key !== 'Enter') return;
        const alvo = evento.target;
        if (!(alvo instanceof HTMLElement)) return;
        if (alvo.tagName === 'TEXTAREA') return;
        if (alvo.closest('button[type="submit"], input[type="submit"]')) return;
        // Evita o Enter nos campos gravar a meio da edição e "saltar" o modal
        evento.preventDefault();
    });
    return modal;
}

function abrirEdicaoPedidoFornecedor(id) {
    const pedido = fornecedorPedidos.find(item => item.id === id);
    if (!pedido) return;
    const modal = garantirModalEdicaoFornecedor();
    const estadoSelect = modal.querySelector('#fornecedor-edicao-estado');
    estadoSelect.replaceChildren();
    obterEstadosPedidoFornecedor().forEach(opcao => {
        const opt = document.createElement('option');
        opt.value = opcao;
        opt.textContent = opcao;
        opt.selected = pedido.estado === opcao;
        estadoSelect.appendChild(opt);
    });

    modal.querySelector('#fornecedor-edicao-id').value = pedido.id;
    modal.querySelector('#fornecedor-edicao-codigo').value = pedido.codigo || '';
    modal.querySelector('#fornecedor-edicao-nome').value = pedido.fornecedor || '';
    modal.querySelector('#fornecedor-edicao-referencia').value = pedido.referencia || '';
    modal.querySelector('#fornecedor-edicao-status').textContent = '';
    modal.querySelector('#fornecedor-edicao-lista-final').value = '';
    const listaOs = modal.querySelector('#fornecedor-edicao-lista-os');
    if (listaOs) listaOs.value = '';

    const lista = modal.querySelector('#fornecedor-edicao-produtos');
    lista.replaceChildren();
    pedido.itens.forEach((item, indice) => {
        lista.appendChild(montarLinhaEdicaoProdutoFornecedor(pedido, item, indice));
    });

    modal.hidden = false;
    document.body.classList.add('fornecedor-edicao-modal-aberto');
    modal.querySelector('#fornecedor-edicao-nome')?.focus();
}

function fecharEdicaoPedidoFornecedor() {
    const modal = document.getElementById('fornecedor-edicao-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('fornecedor-edicao-modal-aberto');
}

function lerItensEditadosPedidoFornecedor(pedido, modal) {
    const linhas = Array.from(modal.querySelectorAll('.fornecedor-edicao-produto'));
    return linhas.map(linha => {
        const indice = Number(linha.dataset.indice);
        const item = pedido.itens[indice];
        if (!item) return null;
        const remover = linha.querySelector('[data-campo="remover"]')?.checked;
        if (remover) return null;
        const quantidade = Math.max(0, Math.floor(Number(linha.querySelector('[data-campo="quantidade"]')?.value || 0)));
        const quantidadeOriginal = Math.max(quantidade, Math.floor(Number(item.quantidade_original ?? item.quantidade ?? quantidade) || quantidade));
        const marcarOs = Boolean(linha.querySelector('[data-campo="marcar_os"]')?.checked);
        const marcarEx = Boolean(linha.querySelector('[data-campo="marcar_ex"]')?.checked) && !marcarOs;
        let faltaOsIndicada = Math.max(0, Math.floor(Number(linha.querySelector('[data-campo="falta_os"]')?.value || 0)));
        if (marcarOs && faltaOsIndicada === 0) {
            faltaOsIndicada = Math.max(1, quantidadeOriginal - quantidade);
        }
        const faltaOs = Math.max(faltaOsIndicada, quantidadeOriginal - quantidade);
        const precoCusto = Math.max(0, Number(String(linha.querySelector('[data-campo="preco_custo"]')?.value || '').replace(',', '.')) || 0);
        const recebido = Math.max(0, Math.floor(Number(linha.querySelector('[data-campo="recebido"]')?.dataset.valor || item.recebido || 0)));
        const estaOs = faltaOs > 0 || marcarOs;
        const quantidadeFinal = estaOs ? Math.max(0, quantidadeOriginal - faltaOs) : quantidade;
        return {
            ...item,
            quantidade_original: quantidadeOriginal,
            quantidade: quantidadeFinal,
            falta_os: faltaOs,
            data_os: estaOs ? (item.data_os || dataOsHojeFornecedor()) : null,
            preco_custo: precoCusto,
            preco: precoCusto,
            estado_fornecedor: estaOs ? 'OS' : (marcarEx ? 'EX' : (['OS', 'EX'].includes(item.estado_fornecedor) ? '' : item.estado_fornecedor || '')),
            marcado_ex: marcarEx,
            recebido: Math.min(recebido, quantidadeFinal)
        };
    }).filter(item => item && (Number(item.quantidade || 0) > 0 || Number(item.falta_os || 0) > 0));
}

async function guardarEdicaoPedidoFornecedor(evento) {
    evento.preventDefault();
    const modal = document.getElementById('fornecedor-edicao-modal');
    if (!modal || modal.hidden) return;
    const status = modal.querySelector('#fornecedor-edicao-status');
    const botao = modal.querySelector('#fornecedor-edicao-guardar');
    const id = modal.querySelector('#fornecedor-edicao-id')?.value || '';
    const pedido = fornecedorPedidos.find(item => String(item.id) === String(id));
    if (!pedido) {
        if (status) {
            status.textContent = 'Encomenda nao encontrada para guardar.';
            status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
            status.classList.add('status-erro');
        }
        return;
    }

    const codigo = modal.querySelector('#fornecedor-edicao-codigo').value.trim();
    const fornecedor = modal.querySelector('#fornecedor-edicao-nome').value.trim();
    const referencia = modal.querySelector('#fornecedor-edicao-referencia').value.trim();
    const estado = modal.querySelector('#fornecedor-edicao-estado').value;
    const itens = lerItensEditadosPedidoFornecedor(pedido, modal);

    if (!fornecedor) {
        status.textContent = 'Indique o fornecedor.';
        status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
        status.classList.add('status-erro');
        status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
    }
    if (!itens.length) {
        status.textContent = 'A encomenda precisa de pelo menos um produto. Cole a lista final e clique em "Aplicar à encomenda", ou desmarque "Remover" nos produtos que quer manter.';
        status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
        status.classList.add('status-erro');
        status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
    }

    try {
        botao.disabled = true;
        status.textContent = 'A guardar ficha...';
        status.classList.remove('status-erro', 'status-sucesso', 'status-aviso');
        status.classList.add('status-neutro');
        const estadoAnterior = pedido.estado;
        const atualizado = await atualizarPedidoFornecedor(id, {
            codigo: codigo || null,
            fornecedor,
            referencia: referencia || null,
            estado,
            itens
        });
        status.textContent = 'A atualizar histórico na ficha do produto...';
        await sincronizarHistoricoPedidosFornecedor(itens, fornecedor, {
            modo: "editar",
            itensAnteriores: pedido.itens || [],
            estadoPedido: estado,
            dataPedido: pedido.data_encomendada || pedido.criado_em || ''
        });
        if (deveConfirmarHistoricoPedidoFornecedor(estadoAnterior, estado)) {
            await sincronizarHistoricoPedidosFornecedor(itens, fornecedor, { modo: "confirmar" });
        }
        status.textContent = 'A atualizar preço compra nos produtos...';
        let produtosComPrecoAtualizado = 0;
        let avisoPrecoCompra = '';
        try {
            produtosComPrecoAtualizado = await sincronizarPrecoCompraProdutosFornecedor(itens);
        } catch (erroPrecoCompra) {
            console.warn('Nao foi possivel sincronizar preço compra nos produtos.', erroPrecoCompra);
            avisoPrecoCompra = ' O preço compra ficou guardado na encomenda, mas ainda não foi atualizado na ficha do produto. Execute o SQL atualizado no Supabase.';
        }
        renderizarResultadosFornecedor();
        renderizarPedidosFornecedores();
        fecharEdicaoPedidoFornecedor();
        definirStatusFornecedor(`Ajuste ${atualizado.codigo} guardado.${produtosComPrecoAtualizado ? ` Preço compra atualizado em ${produtosComPrecoAtualizado} produto(s).` : ''}${avisoPrecoCompra}`, Boolean(avisoPrecoCompra));
    } catch (error) {
        console.error(error);
        status.textContent = 'Erro: ' + (error.message || 'Nao foi possivel guardar a ficha.');
        status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
        status.classList.add('status-erro');
    } finally {
        botao.disabled = false;
    }
}


window.FornecedoresEdicaoPedido = {
  abrir: abrirEdicaoPedidoFornecedor,
  guardar: guardarEdicaoPedidoFornecedor
};
})();
