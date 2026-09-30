(function () {
'use strict';
let temporizadorPopupEdicaoFornecedor = null;

function mostrarPopupEdicaoFornecedor(tipo, mensagem) {
    const modal = document.getElementById("fornecedor-edicao-modal");
    if (!modal || modal.hidden || !mensagem) return;
    const dialog = modal.querySelector(".fornecedor-edicao-dialog") || modal;
    let popup = modal.querySelector("#fornecedor-edicao-popup");
    if (!popup) {
        popup = document.createElement("div");
        popup.id = "fornecedor-edicao-popup";
        popup.className = "fornecedor-edicao-popup";
        popup.setAttribute("role", "alert");
        dialog.appendChild(popup);
    }
    popup.textContent = mensagem;
    popup.className = `fornecedor-edicao-popup ${tipo === "erro" ? "erro" : tipo === "aviso" ? "aviso" : "sucesso"}`;
    popup.hidden = false;
    window.clearTimeout(temporizadorPopupEdicaoFornecedor);
    temporizadorPopupEdicaoFornecedor = window.setTimeout(() => {
        popup.hidden = true;
    }, tipo === "erro" ? 5200 : 3600);
}

function definirStatusEdicaoFornecedor(status, tipo, mensagem) {
    if (status) {
        status.textContent = mensagem;
        status.classList.remove("status-erro", "status-sucesso", "status-aviso", "status-neutro");
        status.classList.add(tipo === "erro" ? "status-erro" : tipo === "aviso" ? "status-aviso" : "status-sucesso");
    }
    mostrarPopupEdicaoFornecedor(tipo, mensagem);
}

function normalizarCodigoEdicaoFornecedor(valor) {
    return String(valor || "").trim();
}

function encontrarPedidoComCodigoEdicaoFornecedor(codigo, idAtual) {
    const codigoNormalizado = normalizarCodigoEdicaoFornecedor(codigo);
    if (!codigoNormalizado) return null;
    return (fornecedorPedidos || []).find((pedido) =>
        String(pedido?.id || "") !== String(idAtual || "")
        && normalizarCodigoEdicaoFornecedor(pedido?.codigo) === codigoNormalizado
    ) || null;
}

function obterMensagemErroEdicaoFornecedor(error) {
    const mensagem = String(error?.message || "Nao foi possivel gravar a ficha.");
    if (/encomendas_fornecedores_codigo_key|duplicate key value/i.test(mensagem)) {
        return "Esse código já existe noutra encomenda de fornecedor. Altere o código ou deixe vazio.";
    }
    return "Erro: " + mensagem;
}

function itemIgnoradoListaEdicaoFornecedor(item) {
    if (typeof itemPedidoIgnoradoListaFornecedor === "function") {
        return itemPedidoIgnoradoListaFornecedor(item);
    }
    const estado = String(item?.estado_fornecedor || "").trim().toUpperCase();
    const origem = String(item?.origem_ajuste || "").trim();
    return estado === "IGNORADO_LISTA" || origem === "ignorado-lista";
}

function normalizarCabecalhoListaFinalFornecedor(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
}

function tipoCabecalhoListaFinalFornecedor(valor) {
    const texto = normalizarCabecalhoListaFinalFornecedor(valor);
    if (!texto) return "";
    if (["CODE", "COD", "CODIGO", "REF", "REFERENCIA", "REFERENCE", "PRODUCTCODE", "ITEMCODE", "ITEM", "ITEMNO", "MODEL", "MODELNO", "PART", "PARTNO", "ARTIGO"].includes(texto)) return "referencia";
    if (["QTY", "QT", "QTD", "QTDE", "QUANTITY", "QUANTIDADE", "UNIDADES", "UNID", "PCS", "PIECES"].includes(texto)) return "quantidade";
    if (["PRICE", "UNITPRICE", "PRECO", "PRECOCOMPRA", "PRECOUNITARIO", "COST", "UNITCOST", "USD", "USDPRICE", "UNITUSD", "FOB"].includes(texto)) return "preco";
    if (["NOTE", "NOTES", "OBS", "OBSERVACAO", "OBSERVACOES", "STATUS", "REMARK", "REMARKS", "COMMENT", "COMMENTS", "COMENTARIO", "COMENTARIOS"].includes(texto)) return "nota";
    return "";
}

function dividirLinhaTabelaListaFinalFornecedor(linha) {
    const original = String(linha ?? "");
    const texto = original.trim();
    if (!texto) return [];
    if (original.includes("\t")) return original.split("\t").map((parte) => String(parte || "").trim());
    if (texto.includes(";")) return texto.split(";").map((parte) => String(parte || "").trim());
    return [];
}

function pareceReferenciaListaFinalFornecedor(valor) {
    const texto = normalizarReferenciaListaFornecedor(valor);
    return /[A-Z]/.test(texto) && /\d/.test(texto) && texto.length >= 3;
}

function pareceQuantidadeListaFinalFornecedor(valor) {
    const texto = String(valor || "").trim();
    if (!/^\d+$/.test(texto)) return false;
    const numero = Number(texto);
    return Number.isInteger(numero) && numero > 0 && numero < 10000;
}

function parecePrecoListaFinalFornecedor(valor) {
    const texto = String(valor || "").trim();
    if (!texto) return false;
    if (/[$€]/.test(texto)) return true;
    return /^\d+[,.]\d{1,4}$/.test(texto);
}

function textoIndicaSemStockListaFinalFornecedor(valor) {
    const texto = String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();
    if (!texto) return false;
    return /\bOUT\s*(OF|DE|QE)?\s*STOCK\b/.test(texto)
        || /\bNO\s*STOCK\b/.test(texto)
        || /\bSEM\s*(STOCK|ESTOQUE)\b/.test(texto)
        || /\bESGOTAD[OA]S?\b/.test(texto)
        || /\bOOS\b/.test(texto)
        || texto === "OS";
}

function obterMapaCabecalhoListaFinalFornecedor(partes) {
    const mapa = {};
    let reconhecidas = 0;
    (partes || []).forEach((parte, indice) => {
        const tipo = tipoCabecalhoListaFinalFornecedor(parte);
        if (!tipo) return;
        reconhecidas += 1;
        if (mapa[tipo] == null) mapa[tipo] = indice;
    });
    if (mapa.referencia != null && mapa.quantidade != null && reconhecidas >= 2) return mapa;
    return null;
}

function inferirMapaTabelaListaFinalFornecedor(partes) {
    if (!Array.isArray(partes) || partes.length < 4) return null;
    const indiceReferencia = partes.findIndex(pareceReferenciaListaFinalFornecedor);
    if (indiceReferencia < 0) return null;
    const indiceQuantidade = partes.findIndex((parte, indice) => indice > indiceReferencia && pareceQuantidadeListaFinalFornecedor(parte));
    if (indiceQuantidade < 0) return null;
    const indicePreco = partes.findIndex((parte, indice) => indice > indiceQuantidade && parecePrecoListaFinalFornecedor(parte));
    const indiceNota = partes.findIndex((parte, indice) => indice > indiceQuantidade && textoIndicaSemStockListaFinalFornecedor(parte));
    if (indicePreco < 0 && indiceNota < 0) return null;
    return {
        referencia: indiceReferencia,
        quantidade: indiceQuantidade,
        preco: indicePreco >= 0 ? indicePreco : null,
        nota: indiceNota >= 0 ? indiceNota : null
    };
}

function obterValorColunaListaFinalFornecedor(partes, indice) {
    return Number.isInteger(indice) && indice >= 0 ? String(partes[indice] || "").trim() : "";
}

function analisarLinhaTabelaListaFinalFornecedor(linha, partes, colunas, numeroLinha) {
    const referencia = obterValorColunaListaFinalFornecedor(partes, colunas.referencia);
    if (!referencia) return null;
    if (!pareceReferenciaListaFinalFornecedor(referencia) && !encontrarProdutoListaFinalFornecedor(referencia)) return null;

    const nota = obterValorColunaListaFinalFornecedor(partes, colunas.nota);
    const semStock = textoIndicaSemStockListaFinalFornecedor(nota) || textoIndicaSemStockListaFinalFornecedor(partes.join(" "));
    const quantidadeTexto = obterValorColunaListaFinalFornecedor(partes, colunas.quantidade);
    const quantidade = Math.floor(converterNumeroListaFornecedor(quantidadeTexto));
    if (quantidade <= 0 && !semStock) {
        return { erro: `linha ${numeroLinha}: quantidade inválida`, original: linha };
    }

    const precoTexto = obterValorColunaListaFinalFornecedor(partes, colunas.preco);
    const precoCusto = semStock ? 0 : Math.max(0, converterNumeroListaFornecedor(precoTexto));
    return {
        referencia,
        quantidade,
        preco_custo: precoCusto,
        preco_lista_usd: precoCusto,
        sem_stock_fornecedor: semStock,
        quantidade_os: semStock && quantidade > 0 ? quantidade : null,
        original: linha
    };
}

function analisarLinhaListaFinalFornecedor(linha, numeroLinha, estadoParser = null) {
    estadoParser = estadoParser || {};
    const partesTabela = dividirLinhaTabelaListaFinalFornecedor(linha);
    if (partesTabela.length) {
        if (!estadoParser.colunas) {
            const cabecalho = obterMapaCabecalhoListaFinalFornecedor(partesTabela);
            if (cabecalho) {
                estadoParser.colunas = cabecalho;
                return { cabecalho: true };
            }
            if (partesTabela.some(tipoCabecalhoListaFinalFornecedor) && !partesTabela.some(pareceReferenciaListaFinalFornecedor)) {
                return { cabecalho: true };
            }
            const inferido = inferirMapaTabelaListaFinalFornecedor(partesTabela);
            if (inferido) estadoParser.colunas = inferido;
        }
        if (estadoParser.colunas) {
            return analisarLinhaTabelaListaFinalFornecedor(linha, partesTabela, estadoParser.colunas, numeroLinha);
        }
    }

    const partes = dividirLinhaListaFinalFornecedor(linha).map(parte => String(parte || "").trim()).filter(Boolean);
    if (!partes.length) return null;
    if (obterMapaCabecalhoListaFinalFornecedor(partes)) return { cabecalho: true };
    if (partes.length < 2) {
        return { erro: `linha ${numeroLinha}: falta quantidade`, original: linha };
    }

    const referencia = partes[0];
    const quantidade = Math.floor(converterNumeroListaFornecedor(partes[1]));
    const semStock = textoIndicaSemStockListaFinalFornecedor(partes.slice(2).join(" "));
    if (!referencia || quantidade <= 0) {
        return { erro: `linha ${numeroLinha}: referência ou quantidade inválida`, original: linha };
    }

    const precoTexto = partes.slice(2).join(" ");
    const precoCusto = semStock ? 0 : Math.max(0, converterNumeroListaFornecedor(precoTexto));
    return {
        referencia,
        quantidade,
        preco_custo: precoCusto,
        preco_lista_usd: precoCusto,
        sem_stock_fornecedor: semStock,
        quantidade_os: semStock ? quantidade : null,
        original: linha
    };
}

function obterItemExistenteListaFinalFornecedor(itensAtuais, item) {
    if (!item || !Array.isArray(itensAtuais)) return null;
    if (typeof encontrarItemPedidoFornecedor === "function") {
        return encontrarItemPedidoFornecedor(itensAtuais, item);
    }
    const chaveItem = normalizarReferenciaListaFornecedor(item.referencia || item.sku || item.id || item.nome);
    return itensAtuais.find((existente) => {
        const chaveExistente = normalizarReferenciaListaFornecedor(existente?.referencia || existente?.sku || existente?.id || existente?.nome);
        return chaveItem && chaveExistente && chaveItem === chaveExistente;
    }) || null;
}

function deveCalcularCustoRealListaAtualFornecedor(opcoes = {}) {
    return Math.max(0, Number(opcoes.totalPagoEur || 0) || 0) > 0;
}

function fundirItemListaFinalComExistenteFornecedor(importado, existente) {
    const veioSemStock = Boolean(importado?.sem_stock_fornecedor);
    if (veioSemStock) {
        const base = existente || importado;
        const quantidadeAtualAnterior = Math.max(0, Math.floor(Number(base.quantidade || 0)));
        const quantidadeOriginalAnterior = Math.max(
            quantidadeAtualAnterior,
            Math.floor(Number(base.quantidade_original ?? base.quantidade_inicial ?? base.quantidade ?? quantidadeAtualAnterior) || quantidadeAtualAnterior)
        );
        const quantidadeOsIndicada = Math.floor(Number(importado.quantidade_os || 0));
        const temQuantidadeOsIndicada = Number.isFinite(quantidadeOsIndicada) && quantidadeOsIndicada > 0;
        const quantidadeInformada = temQuantidadeOsIndicada ? quantidadeOsIndicada : 0;
        const quantidadeOriginal = Math.max(quantidadeOriginalAnterior, quantidadeInformada, 1);
        if (quantidadeOriginal <= 0) return null;
        const faltaOs = Math.max(1, Math.min(quantidadeOriginal, temQuantidadeOsIndicada ? quantidadeInformada : quantidadeOriginal));
        const quantidadeFinal = Math.max(0, quantidadeOriginal - faltaOs);
        const precoImportado = Math.max(0, Number(importado.preco_custo ?? importado.preco ?? 0) || 0);
        const precoExistente = Math.max(0, Number(base.preco_custo ?? base.preco ?? base.custo ?? 0) || 0);
        const precoCusto = precoImportado > 0 ? precoImportado : precoExistente;
        return normalizarItemPedidoFornecedor({
            ...base,
            id: importado.id || base.id,
            nome: importado.nome || base.nome,
            sku: importado.sku || base.sku || "",
            referencia: importado.referencia || base.referencia || "",
            tema: importado.tema || base.tema || "",
            subtema: importado.subtema || base.subtema || "",
            imagens: importado.imagens || base.imagens || [],
            quantidade: quantidadeFinal,
            quantidade_original: quantidadeOriginal,
            falta_os: faltaOs,
            data_os: base.data_os || dataOsHojeFornecedor(),
            estado_fornecedor: "OS",
            marcado_ex: false,
            origem_ajuste: base.origem_ajuste || "lista-final",
            data_origem_ajuste: base.data_origem_ajuste || dataOsAgoraFornecedor(),
            recebido: Math.min(Math.max(0, Number(base.recebido || 0)), quantidadeFinal),
            preco_custo: precoCusto,
            preco: precoCusto
        });
    }
    if (!existente) return importado;
    const quantidadeAnterior = Math.max(0, Math.floor(Number(existente.quantidade || 0)));
    const quantidadeNova = Math.max(0, Math.floor(Number(importado.quantidade || 0)));
    const quantidadeOriginalAnterior = Math.max(
        quantidadeAnterior,
        Math.floor(Number(existente.quantidade_original ?? existente.quantidade ?? quantidadeAnterior) || quantidadeAnterior)
    );
    const quantidadeOriginal = Math.max(quantidadeOriginalAnterior, quantidadeNova);
    const aumentouQuantidade = quantidadeNova > quantidadeAnterior;
    const faltaOsAnterior = Math.max(0, Number(existente.falta_os || 0));
    const faltaOs = quantidadeNova < quantidadeOriginal
        ? Math.max(faltaOsAnterior, quantidadeOriginal - quantidadeNova)
        : 0;
    const estadoFornecedorAnterior = String(existente.estado_fornecedor || "").trim();
    const estadoFornecedor = faltaOs > 0
        ? "OS"
        : (["OS", "EX"].includes(estadoFornecedorAnterior.toUpperCase()) ? "" : estadoFornecedorAnterior);
    const origemAtual = String(existente.origem_ajuste || "").trim();
    const dataOrigemAtual = existente.data_origem_ajuste || null;
    const origemAjuste = aumentouQuantidade ? (origemAtual || "reforco") : origemAtual;
    const dataOrigemAjuste = aumentouQuantidade ? (dataOrigemAtual || dataOsAgoraFornecedor()) : dataOrigemAtual;
    const precoCusto = Math.max(0, Number(importado.preco_custo ?? importado.preco ?? existente.preco_custo ?? existente.preco ?? 0) || 0);

    return normalizarItemPedidoFornecedor({
        ...existente,
        id: importado.id || existente.id,
        nome: importado.nome || existente.nome,
        sku: importado.sku || existente.sku || "",
        referencia: importado.referencia || existente.referencia || "",
        tema: importado.tema || existente.tema || "",
        subtema: importado.subtema || existente.subtema || "",
        imagens: importado.imagens || existente.imagens || [],
        quantidade: quantidadeNova,
        quantidade_original: quantidadeOriginal,
        falta_os: faltaOs,
        estado_fornecedor: estadoFornecedor,
        marcado_ex: false,
        origem_ajuste: origemAjuste,
        data_origem_ajuste: dataOrigemAjuste,
        recebido: Math.min(Math.max(0, Number(existente.recebido || 0)), quantidadeNova),
        preco_lista_usd: Math.max(0, Number(importado.preco_lista_usd ?? importado.preco_custo ?? importado.preco ?? 0) || 0),
        preco_custo: precoCusto,
        preco: precoCusto
    });
}

function limparMetadadosImportacaoListaFinalFornecedor(item) {
    if (!item) return item;
    delete item.sem_stock_fornecedor;
    delete item.quantidade_os;
    delete item.preco_lista_usd;
    delete item.custo_calculado_lista_atual;
    return item;
}

function arredondarPrecoCustoListaAtualFornecedor(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero <= 0) return 0;
    return Math.round(numero * 100) / 100;
}

function itemContaParaCustoRealListaAtualFornecedor(item) {
    if (!item) return false;
    if (itemIgnoradoListaEdicaoFornecedor(item)) return false;
    const estado = String(item.estado_fornecedor || "").trim().toUpperCase();
    if (estado === "EX" || item.marcado_ex === true) return false;
    return Math.max(0, Number(item.quantidade || 0)) > 0;
}

function formatarMoedaResumoCustoListaAtualFornecedor(valor, moeda = "EUR") {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return moeda === "USD" ? "$0,00" : "0,00 €";
    if (moeda === "USD") return `$${numero.toFixed(2).replace(".", ",")}`;
    return `${numero.toFixed(2).replace(".", ",")} €`;
}

function obterResumoCustoRealListaAtualFornecedor(resumo) {
    if (!resumo?.aplicado) {
        if (resumo?.pendente) {
            const modo = resumo.rateioEnvio === "valor" ? "por valor" : "por unidade";
            return `\n\nCusto provisório: ainda falta o Total pago EUR. O preço compra será preenchido em USD, com o envio distribuído ${modo}.`;
        }
        return "";
    }
    if (resumo.precosProvisoriosUsd) {
        const origemTotal = resumo.totalCompraUsdManual ? "o total USD indicado manualmente" : "os preços provisórios em USD já guardados";
        return `\n\nCusto real: ${formatarMoedaResumoCustoListaAtualFornecedor(resumo.totalPagoEur)} / ${formatarMoedaResumoCustoListaAtualFornecedor(resumo.totalCompraUsd, "USD")} = câmbio ${resumo.cambio.toFixed(4)}. Usado ${origemTotal}.`;
    }
    const modo = resumo.rateioEnvio === "valor" ? "por valor" : "por unidade";
    return `\n\nCusto real: ${formatarMoedaResumoCustoListaAtualFornecedor(resumo.totalPagoEur)} / ${formatarMoedaResumoCustoListaAtualFornecedor(resumo.totalCompraUsd, "USD")} = câmbio ${resumo.cambio.toFixed(4)}. Envio distribuído ${modo}.`;
}

function itemTemPrecoCustoProvisorioUsdFornecedor(item) {
    return Boolean(item?.preco_custo_provisorio)
        || String(item?.preco_custo_moeda || "").trim().toUpperCase() === "USD";
}

function obterPrecoUsdListaAtualFornecedor(item, usarProvisorio = false) {
    const precoLista = Math.max(0, Number(item?.preco_lista_usd || 0) || 0);
    if (precoLista > 0) return precoLista;
    if (!usarProvisorio || !itemTemPrecoCustoProvisorioUsdFornecedor(item)) return 0;
    return Math.max(0, Number(item?.preco_custo ?? item?.preco ?? item?.custo ?? 0) || 0);
}

function itensTemPrecoUsdListaAtualFornecedor(itens) {
    return (itens || [])
        .filter(itemContaParaCustoRealListaAtualFornecedor)
        .some((item) => obterPrecoUsdListaAtualFornecedor(item, true) > 0);
}

function calcularCustoRealListaAtualFornecedor(itens, opcoes = {}) {
    const envioUsdInformado = Math.max(0, Number(opcoes.envioUsd || 0) || 0);
    const totalPagoEur = Math.max(0, Number(opcoes.totalPagoEur || 0) || 0);
    const totalCompraUsdManual = Math.max(0, Number(opcoes.totalCompraUsd || 0) || 0);

    const itensReceber = (itens || []).filter(itemContaParaCustoRealListaAtualFornecedor);
    const temPrecosListaUsd = itensReceber.some((item) => Math.max(0, Number(item?.preco_lista_usd || 0)) > 0);
    const temPrecosProvisoriosUsd = !temPrecosListaUsd
        && itensReceber.some((item) => obterPrecoUsdListaAtualFornecedor(item, true) > 0);
    const usarPrecosProvisoriosUsd = !temPrecosListaUsd && temPrecosProvisoriosUsd;
    const envioUsd = usarPrecosProvisoriosUsd ? 0 : envioUsdInformado;
    const temPrecosUsd = temPrecosListaUsd || temPrecosProvisoriosUsd;
    const pendente = (envioUsdInformado > 0 || temPrecosUsd) && totalPagoEur <= 0;

    const semPreco = itensReceber.filter((item) => obterPrecoUsdListaAtualFornecedor(item, usarPrecosProvisoriosUsd) <= 0);
    if (semPreco.length && deveCalcularCustoRealListaAtualFornecedor(opcoes)) {
        const refs = semPreco.slice(0, 6).map(item => item.referencia || item.sku || item.nome || "sem referência").join(", ");
        return { aplicado: false, erro: `Há ${semPreco.length} referência(s) a receber sem PRICE: ${refs}.` };
    }

    const totalUnidades = itensReceber.reduce((total, item) => total + Math.max(0, Math.floor(Number(item.quantidade || 0))), 0);
    const totalProdutosUsd = itensReceber.reduce((total, item) => {
        const quantidade = Math.max(0, Math.floor(Number(item.quantidade || 0)));
        const precoUsd = obterPrecoUsdListaAtualFornecedor(item, usarPrecosProvisoriosUsd);
        return total + (quantidade * precoUsd);
    }, 0);
    const totalCompraUsd = totalCompraUsdManual > 0 ? totalCompraUsdManual : totalProdutosUsd + envioUsd;
    if (!itensReceber.length || totalUnidades <= 0 || totalProdutosUsd <= 0 || totalCompraUsd <= 0) {
        if (deveCalcularCustoRealListaAtualFornecedor(opcoes)) {
            return { aplicado: false, erro: "A lista precisa de quantidades e PRICE em USD para calcular o custo real." };
        }
        return { aplicado: false, pendente: false };
    }

    const rateioEnvio = opcoes.rateioEnvio === "valor" ? "valor" : "unidades";
    const calcularEur = deveCalcularCustoRealListaAtualFornecedor(opcoes);
    const cambio = calcularEur ? totalPagoEur / totalCompraUsd : 1;
    const envioPorUnidadeUsd = rateioEnvio === "unidades" ? envioUsd / totalUnidades : 0;

    itensReceber.forEach((item) => {
        const quantidade = Math.max(0, Math.floor(Number(item.quantidade || 0)));
        const precoUsd = obterPrecoUsdListaAtualFornecedor(item, usarPrecosProvisoriosUsd);
        const linhaUsd = quantidade * precoUsd;
        const envioLinhaUsd = rateioEnvio === "valor" && totalProdutosUsd > 0
            ? envioUsd * (linhaUsd / totalProdutosUsd)
            : 0;
        const envioUnitarioUsd = rateioEnvio === "valor"
            ? (quantidade > 0 ? envioLinhaUsd / quantidade : 0)
            : envioPorUnidadeUsd;
        const precoCusto = arredondarPrecoCustoListaAtualFornecedor((precoUsd + envioUnitarioUsd) * cambio);
        item.preco_custo = precoCusto;
        item.preco = precoCusto;
        item.preco_custo_moeda = calcularEur ? "EUR" : "USD";
        item.preco_custo_provisorio = !calcularEur;
        item.custo_calculado_lista_atual = calcularEur;
    });

    if (!calcularEur) {
        return {
            aplicado: false,
            pendente,
            totalProdutosUsd,
            envioUsd,
            totalCompraUsd,
            totalUnidades,
            rateioEnvio,
            precosProvisoriosUsd: usarPrecosProvisoriosUsd,
            totalCompraUsdManual: totalCompraUsdManual > 0
        };
    }

    return {
        aplicado: true,
        totalProdutosUsd,
        envioUsd,
        totalCompraUsd,
        totalPagoEur,
        cambio,
        totalUnidades,
        rateioEnvio,
        precosProvisoriosUsd: usarPrecosProvisoriosUsd,
        totalCompraUsdManual: totalCompraUsdManual > 0,
        moeda: "EUR"
    };
}

function lerOpcoesCustoFixoEurFornecedor(contexto = document) {
    const obterValor = (seletor) => converterNumeroListaFornecedor(contexto.querySelector(seletor)?.value || "");
    const precoUnitarioEur = Math.max(0, obterValor("#fornecedor-edicao-os-preco-unitario-eur"));
    const envioEur = Math.max(0, obterValor("#fornecedor-edicao-os-envio-eur"));
    const totalCompraEur = Math.max(0, obterValor("#fornecedor-edicao-os-total-compra-eur"));
    return {
        precoUnitarioEur,
        envioEur,
        totalCompraEur,
        ativo: precoUnitarioEur > 0 || envioEur > 0 || totalCompraEur > 0
    };
}

function obterResumoCustoFixoEurFornecedor(resumo) {
    if (!resumo?.aplicado) return "";
    if (resumo.modo === "total") {
        return ` Total compra EUR: ${formatarMoedaResumoCustoListaAtualFornecedor(resumo.totalCompraEur)} / ${resumo.totalUnidades} unidade(s) a receber = ${formatarMoedaResumoCustoListaAtualFornecedor(resumo.precoUnitarioFinal)} por unidade.`;
    }
    const envio = resumo.envioEur > 0
        ? ` + envio ${formatarMoedaResumoCustoListaAtualFornecedor(resumo.envioEur)} / ${resumo.totalUnidades}`
        : "";
    return ` Preço compra EUR: ${formatarMoedaResumoCustoListaAtualFornecedor(resumo.precoBaseEur)}${envio} = ${formatarMoedaResumoCustoListaAtualFornecedor(resumo.precoUnitarioFinal)} por unidade.`;
}

function aplicarCustoFixoEurItensFornecedor(itens, opcoes = {}) {
    if (!opcoes?.ativo) return { aplicado: false };
    const itensReceber = (itens || []).filter(itemContaParaCustoRealListaAtualFornecedor);
    const totalUnidades = itensReceber.reduce((total, item) => total + Math.max(0, Math.floor(Number(item.quantidade || 0))), 0);
    if (totalUnidades <= 0) {
        return { aplicado: false, erro: "Não há unidades a receber para dividir o custo EUR." };
    }

    const totalCompraEur = Math.max(0, Number(opcoes.totalCompraEur || 0) || 0);
    const precoBaseEur = Math.max(0, Number(opcoes.precoUnitarioEur || 0) || 0);
    const envioEur = Math.max(0, Number(opcoes.envioEur || 0) || 0);
    const precoUnitarioFinal = totalCompraEur > 0
        ? totalCompraEur / totalUnidades
        : precoBaseEur + (envioEur > 0 ? envioEur / totalUnidades : 0);

    if (!Number.isFinite(precoUnitarioFinal) || precoUnitarioFinal <= 0) {
        return { aplicado: false };
    }

    const precoCusto = arredondarPrecoCustoListaAtualFornecedor(precoUnitarioFinal);
    itensReceber.forEach((item) => {
        item.preco_custo = precoCusto;
        item.preco = precoCusto;
        item.preco_custo_moeda = "EUR";
        item.preco_custo_provisorio = false;
        item.custo_calculado_lista_atual = true;
    });

    return {
        aplicado: true,
        modo: totalCompraEur > 0 ? "total" : "unitario",
        totalUnidades,
        totalCompraEur,
        precoBaseEur,
        envioEur,
        precoUnitarioFinal: precoCusto,
        moeda: "EUR"
    };
}

function renderizarItensEdicaoPedidoFornecedor(modal, pedido, itens) {
    const lista = modal?.querySelector("#fornecedor-edicao-produtos");
    if (!lista) return;
    lista.replaceChildren();
    (itens || []).forEach((item, indice) => {
        lista.appendChild(montarLinhaEdicaoProdutoFornecedor(pedido, item, indice));
    });
}

function aplicarCustoFixoEurNaEdicaoFornecedor(modal) {
    const pedido = obterPedidoEdicaoFornecedor(modal);
    if (!pedido) return { aplicado: false, erro: "Encomenda não encontrada para calcular o custo EUR." };
    const opcoes = lerOpcoesCustoFixoEurFornecedor(modal);
    if (!opcoes.ativo) return { aplicado: false };
    const itens = lerItensEditadosPedidoFornecedor(pedido, modal);
    const resumo = aplicarCustoFixoEurItensFornecedor(itens, opcoes);
    if (resumo.erro) return resumo;
    if (!resumo.aplicado) return resumo;
    pedido.itens = itens;
    modal.dataset.itensAlteradosListaFinal = "1";
    renderizarItensEdicaoPedidoFornecedor(modal, pedido, itens);
    return resumo;
}

function criarItemAusenteListaFinalFornecedor(item) {
    if (!item) return false;
    const quantidadeAtual = Math.max(0, Math.floor(Number(item.quantidade || 0)));
    const quantidadeOriginal = Math.max(
        quantidadeAtual,
        Math.floor(Number(item.quantidade_original ?? item.quantidade_inicial ?? item.quantidade ?? quantidadeAtual) || quantidadeAtual)
    );
    if (quantidadeOriginal <= 0) return null;
    const estado = String(item.estado_fornecedor || "").trim().toUpperCase();
    const marcadoEx = Boolean(item.marcado_ex) || estado === "EX";
    if (marcadoEx) return normalizarItemPedidoFornecedor({ ...item, marcado_ex: true, estado_fornecedor: "EX" });
    return normalizarItemPedidoFornecedor({
        ...item,
        quantidade: 0,
        quantidade_original: quantidadeOriginal,
        falta_os: 0,
        data_os: null,
        estado_fornecedor: "IGNORADO_LISTA",
        origem_ajuste: "ignorado-lista",
        data_origem_ajuste: item.data_origem_ajuste || dataOsAgoraFornecedor(),
        marcado_ex: false,
        recebido: 0
    });
}

function processarLinhasListaFinalFornecedor(texto, itensAtuais = [], opcoesCusto = {}) {
    const linhas = String(texto || "").split(/\r?\n/);
    const itens = [];
    const erros = [];
    const foraCatalogo = [];
    const itensUsados = new Set();
    const estadoParser = {};
    let linhasImportadas = 0;
    let osImportadas = 0;

    linhas.forEach((linha, indice) => {
        const analisada = analisarLinhaListaFinalFornecedor(linha, indice + 1, estadoParser);
        if (!analisada) return;
        if (analisada.cabecalho) return;
        if (analisada.erro) {
            erros.push(analisada.erro);
            return;
        }
        linhasImportadas += 1;
        if (analisada.sem_stock_fornecedor) osImportadas += 1;

        const produto = encontrarProdutoListaFinalFornecedor(analisada.referencia);
        if (!produto) foraCatalogo.push(analisada.referencia);
        let item = criarItemFornecedorAPartirListaFinal(analisada, produto);
        item.sem_stock_fornecedor = Boolean(analisada.sem_stock_fornecedor);
        item.quantidade_os = analisada.sem_stock_fornecedor && Number(analisada.quantidade_os) > 0
            ? Math.floor(Number(analisada.quantidade_os))
            : null;
        item.preco_lista_usd = Math.max(0, Number(analisada.preco_lista_usd ?? analisada.preco_custo ?? 0) || 0);
        if (produto) {
            item.referencia = analisada.referencia;
            item.nome = produto.nome || item.nome;
            item.sku = produto.sku || item.sku || "";
            item.tema = produto.tema || item.tema || "";
            item.subtema = produto.subtema || item.subtema || "";
            item.imagens = produto.imagens || item.imagens || [];
        }
        const existente = obterItemExistenteListaFinalFornecedor(itensAtuais, item);
        if (existente) itensUsados.add(existente);
        item = fundirItemListaFinalComExistenteFornecedor(item, existente);
        if (item) itens.push(item);
    });

    (Array.isArray(itensAtuais) ? itensAtuais : []).forEach((existente) => {
        if (itensUsados.has(existente)) return;
        const ausente = criarItemAusenteListaFinalFornecedor(existente);
        if (ausente) itens.push(ausente);
    });

    const custoReal = calcularCustoRealListaAtualFornecedor(itens, opcoesCusto);
    itens.forEach(limparMetadadosImportacaoListaFinalFornecedor);
    const unidades = itens.reduce((total, item) => total + Math.max(0, Number(item.quantidade || 0)), 0);
    return { itens, erros, foraCatalogo, unidades, linhasImportadas, osImportadas, custoReal };
}

function lerOpcoesCustoListaAtualFornecedor(contexto = document) {
    const obterValor = (seletor) => converterNumeroListaFornecedor(contexto.querySelector(seletor)?.value || "");
    const envioUsd = obterValor("#fornecedor-edicao-envio-usd, #fornecedor-envio-usd");
    const totalCompraUsd = obterValor("#fornecedor-edicao-total-compra-usd, #fornecedor-total-compra-usd");
    const totalPagoEur = obterValor("#fornecedor-edicao-total-eur, #fornecedor-total-eur");
    const rateioSelecionado = contexto.querySelector('input[name="fornecedor-edicao-rateio-envio"]:checked, input[name="fornecedor-rateio-envio"]:checked')?.value || "unidades";
    return {
        envioUsd,
        totalCompraUsd,
        totalPagoEur,
        rateioEnvio: rateioSelecionado === "valor" ? "valor" : "unidades",
        ativo: envioUsd > 0 || totalCompraUsd > 0 || totalPagoEur > 0
    };
}

function calcularTotalPagoEurSobreItensAtuaisFornecedor(itensAtuais = [], opcoesCusto = {}) {
    if (!(Math.max(0, Number(opcoesCusto?.totalPagoEur || 0)) > 0)) {
        return { aplicado: false, erro: "Preenche o Total pago EUR para recalcular o preço compra." };
    }
    const itens = (Array.isArray(itensAtuais) ? itensAtuais : [])
        .map(item => normalizarItemPedidoFornecedor({ ...item }))
        .filter(Boolean);
    const custoReal = calcularCustoRealListaAtualFornecedor(itens, opcoesCusto);
    if (custoReal?.erro) return { aplicado: false, erro: custoReal.erro };
    if (!custoReal?.aplicado) {
        return { aplicado: false, erro: "Não há preços provisórios em USD suficientes para calcular o preço compra em EUR." };
    }
    const unidades = itens
        .filter(itemContaParaCustoRealListaAtualFornecedor)
        .reduce((total, item) => total + Math.max(0, Math.floor(Number(item.quantidade || 0))), 0);
    return { aplicado: true, itens, custoReal, unidades };
}

async function aplicarListaFinalFornecedor() {
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

    const opcoesCusto = lerOpcoesCustoListaAtualFornecedor(document);
    const { itens: importados, erros, foraCatalogo, unidades, linhasImportadas, osImportadas, custoReal } = processarLinhasListaFinalFornecedor(textoLista, fornecedorSelecao, opcoesCusto);
    if (!linhasImportadas || !importados.length) {
        const totalAtual = calcularTotalPagoEurSobreItensAtuaisFornecedor(fornecedorSelecao, opcoesCusto);
        if (!String(textoLista || "").trim() && totalAtual.aplicado) {
            if (!(await mostrarConfirmacaoSite(
                `Aplicar o Total pago EUR aos preços da encomenda?\n\n${totalAtual.unidades} unidade(s) a receber serão recalculadas para preço compra em EUR.${obterResumoCustoRealListaAtualFornecedor(totalAtual.custoReal)}`,
                { titulo: "Confirmar preço compra", textoConfirmar: "Aplicar", textoCancelar: "Fechar" }
            ))) {
                return;
            }
            fornecedorSelecao = totalAtual.itens;
            guardarSelecaoFornecedor();
            renderizarResultadosFornecedor();
            renderizarSelecionadosFornecedor();
            definirStatusFornecedor(`Preço compra recalculado em EUR para ${totalAtual.unidades} unidade(s).`);
            return;
        }
        if (!String(textoLista || "").trim() && Math.max(0, Number(opcoesCusto.totalPagoEur || 0)) > 0) {
            definirStatusFornecedor(totalAtual.erro || "Não foi possível aplicar o Total pago EUR aos itens atuais.", true);
            return;
        }
        const detalhe = erros.length ? ` ${erros.join("; ")}` : "";
        definirStatusFornecedor(`Cole pelo menos uma referência válida antes de aplicar a lista atual.${detalhe}`, true);
        return;
    }
    if (custoReal?.erro) {
        definirStatusFornecedor(custoReal.erro, true);
        return;
    }

    if (!(await mostrarConfirmacaoSite(
        `Aplicar esta lista atual à encomenda?\n\n${linhasImportadas} referência(s) lida(s), ${unidades} unidade(s) a receber${osImportadas ? ` e ${osImportadas} referência(s) OS` : ""}.\nA lista atual da encomenda será substituída e as referências que não vierem na lista ficam como Ignorado na lista.${obterResumoCustoRealListaAtualFornecedor(custoReal)}`,
        { titulo: "Confirmar lista atual", textoConfirmar: "Aplicar", textoCancelar: "Fechar" }
    ))) {
        return;
    }

    fornecedorSelecao = importados;
    guardarSelecaoFornecedor();
    renderizarResultadosFornecedor();
    renderizarSelecionadosFornecedor();

    const avisos = [];
    if (foraCatalogo.length) avisos.push(`${foraCatalogo.length} referência(s) fora do catálogo incluída(s): ${foraCatalogo.join(", ")}`);
    if (erros.length) avisos.push(erros.join("; "));
    definirStatusFornecedor(`${importados.length} linha(s), ${unidades} unidade(s) a receber${osImportadas ? ` e ${osImportadas} OS` : ""} aplicadas à encomenda.${custoReal?.aplicado ? " Preço compra calculado em EUR." : ""}${custoReal?.pendente ? " Preço compra provisório em USD com envio incluído." : ""}${avisos.length ? " " + avisos.join(" | ") : ""}`, Boolean(avisos.length));
}

function limparTextoListaFinalFornecedor() {
    const area = document.getElementById("fornecedor-lista-final");
    if (area) area.value = "";
    definirStatusFornecedor("Texto da lista atual limpo.");
}

function obterPedidoEdicaoFornecedor(modal) {
    const id = modal?.querySelector("#fornecedor-edicao-id")?.value;
    return fornecedorPedidos.find(item => String(item.id) === String(id)) || null;
}

function obterInputsEdicaoMesmaColunaFornecedor(inputAtual) {
    const campo = inputAtual?.dataset?.campo || "";
    if (!["quantidade", "falta_os", "preco_custo"].includes(campo)) return [];

    const lista = inputAtual.closest("#fornecedor-edicao-produtos");
    if (!lista) return [];

    return Array.from(lista.querySelectorAll(".fornecedor-edicao-produto"))
        .map(linha => linha.querySelector(`input[data-campo="${campo}"]`))
        .filter(input => input && !input.disabled && input.offsetParent !== null);
}

function focarCampoEdicaoMesmaColunaFornecedor(inputAtual, direcao) {
    const inputs = obterInputsEdicaoMesmaColunaFornecedor(inputAtual);
    const indiceAtual = inputs.indexOf(inputAtual);
    if (indiceAtual < 0) return false;

    const proximo = inputs[indiceAtual + direcao];
    if (!proximo) return true;

    proximo.focus({ preventScroll: true });
    proximo.select();
    garantirCampoEdicaoVisivelFornecedor(proximo);
    return true;
}

function garantirCampoEdicaoVisivelFornecedor(input) {
    const linha = input?.closest(".fornecedor-edicao-produto") || input;
    const caixa = input?.closest(".fornecedor-edicao-corpo");
    if (!linha || !caixa) return;

    const ajustar = () => {
        const margem = 12;
        const caixaRect = caixa.getBoundingClientRect();
        const linhaRect = linha.getBoundingClientRect();

        if (linhaRect.bottom > caixaRect.bottom - margem) {
            caixa.scrollTop += linhaRect.bottom - caixaRect.bottom + margem;
        } else if (linhaRect.top < caixaRect.top + margem) {
            caixa.scrollTop -= caixaRect.top - linhaRect.top + margem;
        }
    };

    ajustar();
    requestAnimationFrame(ajustar);
}

function montarLinhaEdicaoProdutoFornecedor(pedido, item, indice) {
    const produtoAtual = obterProdutoParaPedidoFornecedor(item) || item;
    const quantidadeOriginal = Math.max(0, Number(item.quantidade_original ?? item.quantidade ?? 0));
    const quantidadeAtual = Math.max(0, Number(item.quantidade || 0));
    const itemMarcadoEx = item.estado_fornecedor === "EX" || item.marcado_ex === true;
    const itemIgnoradoLista = itemIgnoradoListaEdicaoFornecedor(item);
    const faltaAtual = itemMarcadoEx
        ? 0
        : itemIgnoradoLista
        ? 0
        : Math.max(0, Number(item.falta_os || Math.max(0, quantidadeOriginal - quantidadeAtual)));
    const precoCustoAtual = Number(item.preco_custo ?? item.custo ?? item.preco ?? 0) || 0;
    const precoProvisorioUsd = Boolean(item.preco_custo_provisorio)
        || String(item.preco_custo_moeda || "").trim().toUpperCase() === "USD";
    const linha = document.createElement("div");
    linha.className = "fornecedor-edicao-produto";
    if (!itemMarcadoEx && (faltaAtual > 0 || item.estado_fornecedor === "OS")) linha.classList.add("tem-os");
    linha.dataset.indice = String(indice);
    linha.dataset.referencia = produtoAtual.referencia || item.referencia || "";
    linha.dataset.sku = produtoAtual.sku || item.sku || "";
    linha.dataset.quantidadeOriginal = String(quantidadeOriginal);
    linha.appendChild(criarImagemFornecedor(produtoAtual, "fornecedor-miniatura pequena"));

    const info = document.createElement("div");
    info.className = "fornecedor-info";
    const nome = document.createElement("strong");
    nome.textContent = produtoAtual.nome || item.nome || "Produto";
    const ids = document.createElement("span");
    ids.className = "fornecedor-identificadores";
    ids.textContent = `Ref. ${produtoAtual.referencia || item.referencia || "-"} | SKU ${produtoAtual.sku || item.sku || "-"}`;
    const ajuste = document.createElement("span");
    ajuste.className = itemMarcadoEx
        ? "fornecedor-ajuste-os fornecedor-ajuste-ex ativo"
        : itemIgnoradoLista
        ? "fornecedor-ajuste-os ativo"
        : (faltaAtual > 0 ? "fornecedor-ajuste-os ativo" : "fornecedor-ajuste-os");
    const dataOsTexto = item.data_os ? ` | desde ${formatarDataOsCurtaFornecedor(item.data_os)}` : "";
    ajuste.textContent = itemMarcadoEx
        ? `Inicial: ${quantidadeOriginal} | EX${dataOsTexto}`
        : itemIgnoradoLista
        ? `Inicial: ${quantidadeOriginal} | Ignorado na lista`
        : faltaAtual > 0
        ? `Inicial: ${quantidadeOriginal} | OS: ${faltaAtual}${dataOsTexto}`
        : `Inicial: ${quantidadeOriginal}`;
    if (item.origem_ajuste && !itemIgnoradoLista) {
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
    precoCusto.textContent = precoProvisorioUsd ? "preço compra USD" : "preço compra";
    const precoCustoInput = document.createElement("input");
    precoCustoInput.type = "text";
    precoCustoInput.inputMode = "decimal";
    precoCustoInput.autocomplete = "off";
    precoCustoInput.value = precoCustoAtual.toFixed(2).replace(".", ",");
    precoCustoInput.dataset.campo = "preco_custo";
    precoCusto.appendChild(precoCustoInput);

    const recebido = document.createElement("div");
    recebido.className = "fornecedor-edicao-recebido-info";
    const recebidoAtual = ["A preparar", "Encomendada", "Caixote recebido"].includes(pedido.estado)
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
    marcarOsInput.checked = !itemMarcadoEx && !itemIgnoradoLista && (faltaAtual > 0 || item.estado_fornecedor === "OS");
    marcarOs.append(marcarOsInput, document.createTextNode(" Marcar OS"));

    const marcarEx = document.createElement("label");
    marcarEx.className = "fornecedor-edicao-marcar-ex";
    marcarEx.title = "Marca a figura como EX (preço demasiado caro neste fornecedor) e regista a data na ficha do produto";
    const marcarExInput = document.createElement("input");
    marcarExInput.type = "checkbox";
    marcarExInput.dataset.campo = "marcar_ex";
    marcarExInput.checked = itemMarcadoEx;
    marcarEx.append(marcarExInput, document.createTextNode(" Marcar EX"));
    marcarExInput.addEventListener("change", () => {
        if (marcarExInput.checked) {
            if (marcarOsInput.checked) {
                marcarOsInput.checked = false;
            }
            faltaInput.value = "0";
            // Marcar como EX (caro demais) exclui automaticamente da encomenda,
            // tal como acontece ao marcar OS - mas sem contar como "falta de stock".
            quantidadeInput.value = "0";
        } else {
            quantidadeInput.value = String(quantidadeOriginal);
        }
        atualizarAjuste();
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
        ajuste.className = marcarExInput.checked
            ? "fornecedor-ajuste-os fornecedor-ajuste-ex ativo"
            : faltaValor > 0
                ? "fornecedor-ajuste-os ativo"
                : "fornecedor-ajuste-os";
        ajuste.textContent = marcarExInput.checked
            ? `Inicial: ${quantidadeOriginal} | EX`
            : faltaValor > 0
            ? `Inicial: ${quantidadeOriginal} | OS: ${faltaValor}`
            : `Inicial: ${quantidadeOriginal}`;
        linha.classList.toggle("tem-os", !marcarExInput.checked && (faltaValor > 0 || marcarOsInput.checked));
    };

    const sincronizarFalta = () => {
        const pedidoValor = lerNumeroCampo(quantidadeInput);
        quantidadeInput.value = String(pedidoValor);
        if (marcarExInput.checked) {
            // Marcado como EX: a quantidade pode ser ajustada livremente (ex: decidir
            // encomendar apesar do preço) sem que isso mexa em OS/Falta nem desmarque EX.
            atualizarAjuste();
            return;
        }
        const faltaValor = Math.max(0, quantidadeOriginal - pedidoValor);
        faltaInput.value = String(faltaValor);
        marcarOsInput.checked = faltaValor > 0;
        atualizarAjuste();
    };
    const sincronizarQuantidade = () => {
        const faltaValor = lerNumeroCampo(faltaInput);
        faltaInput.value = String(faltaValor);
        quantidadeInput.value = String(Math.max(0, quantidadeOriginal - faltaValor));
        marcarOsInput.checked = !marcarExInput.checked && faltaValor > 0;
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
            if (evento.key === "Tab") {
                evento.preventDefault();
                evento.stopPropagation();
                evento.stopImmediatePropagation?.();
                const direcao = evento.shiftKey ? -1 : 1;
                focarCampoEdicaoMesmaColunaFornecedor(inputNumero, direcao);
                return;
            }
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
    return correspondeReferenciaListaFornecedor(linha.dataset.referencia, referencia);
}

async function aplicarListaFinalNaEdicaoFornecedor() {
    const modal = document.getElementById("fornecedor-edicao-modal");
    if (!modal || modal.hidden) return;
    const area = modal.querySelector("#fornecedor-edicao-lista-final");
    const status = modal.querySelector("#fornecedor-edicao-status");
    const texto = String(area?.value || "");
    if (texto.length > FORNECEDOR_LISTA_MAX_CARACTERES) {
        definirStatusEdicaoFornecedor(status, "erro", `A lista é demasiado grande. Limite: ${FORNECEDOR_LISTA_MAX_CARACTERES.toLocaleString('pt-PT')} caracteres.`);
        return;
    }
    if (texto.split(/\r?\n/).filter(linha => linha.trim()).length > FORNECEDOR_LISTA_MAX_LINHAS) {
        definirStatusEdicaoFornecedor(status, "erro", `A lista tem demasiadas linhas. Limite: ${FORNECEDOR_LISTA_MAX_LINHAS} referências por colagem.`);
        return;
    }

    const pedido = obterPedidoEdicaoFornecedor(modal);
    if (!pedido) {
        definirStatusEdicaoFornecedor(status, "erro", "Encomenda não encontrada para aplicar a lista.");
        return;
    }

    const opcoesCusto = lerOpcoesCustoListaAtualFornecedor(modal);
    const { itens, erros, foraCatalogo, unidades, linhasImportadas, osImportadas, custoReal } = processarLinhasListaFinalFornecedor(texto, pedido.itens || [], opcoesCusto);
    if (!linhasImportadas || !itens.length) {
        const totalAtual = calcularTotalPagoEurSobreItensAtuaisFornecedor(pedido.itens || [], opcoesCusto);
        if (!String(texto || "").trim() && totalAtual.aplicado) {
            if (!(await mostrarConfirmacaoSite(
                `Aplicar o Total pago EUR aos preços da encomenda?\n\n${totalAtual.unidades} unidade(s) a receber serão recalculadas para preço compra em EUR.${obterResumoCustoRealListaAtualFornecedor(totalAtual.custoReal)}`,
                { titulo: "Confirmar preço compra", textoConfirmar: "Aplicar", textoCancelar: "Fechar" }
            ))) {
                return;
            }
            pedido.itens = totalAtual.itens;
            modal.dataset.itensAlteradosListaFinal = "1";
            renderizarItensEdicaoPedidoFornecedor(modal, pedido, totalAtual.itens);
            definirStatusEdicaoFornecedor(
                status,
                "sucesso",
                `Preço compra recalculado em EUR para ${totalAtual.unidades} unidade(s). Clica em Gravar encomenda para guardar.`
            );
            return;
        }
        if (!String(texto || "").trim() && Math.max(0, Number(opcoesCusto.totalPagoEur || 0)) > 0) {
            definirStatusEdicaoFornecedor(status, "erro", totalAtual.erro || "Não foi possível aplicar o Total pago EUR aos itens atuais.");
            return;
        }
        definirStatusEdicaoFornecedor(status, "erro", erros.length ? erros.join("; ") : "Cole pelo menos uma referência válida antes de aplicar a lista atual.");
        return;
    }
    if (custoReal?.erro) {
        definirStatusEdicaoFornecedor(status, "erro", custoReal.erro);
        return;
    }

    if (!(await mostrarConfirmacaoSite(
        `Aplicar esta lista atual à encomenda?\n\n${linhasImportadas} referência(s) lida(s), ${unidades} unidade(s) a receber${osImportadas ? ` e ${osImportadas} referência(s) OS` : ""}.\nA lista atual da encomenda será substituída e as referências que não vierem na lista ficam como Ignorado na lista.${obterResumoCustoRealListaAtualFornecedor(custoReal)}`,
        { titulo: "Confirmar lista atual", textoConfirmar: "Aplicar", textoCancelar: "Fechar" }
    ))) {
        return;
    }

    pedido.itens = itens;
    modal.dataset.itensAlteradosListaFinal = "1";
    renderizarItensEdicaoPedidoFornecedor(modal, pedido, itens);

    const avisos = [];
    if (foraCatalogo.length) avisos.push(`${foraCatalogo.length} referência(s) fora do catálogo incluída(s): ${foraCatalogo.join(", ")}`);
    if (erros.length) avisos.push(erros.join("; "));
    definirStatusEdicaoFornecedor(
        status,
        avisos.length ? "aviso" : "sucesso",
        `Lista aplicada: ${itens.length} linha(s), ${unidades} unidade(s) a receber${osImportadas ? ` e ${osImportadas} OS` : ""}.${custoReal?.aplicado ? " Preço compra calculado em EUR." : ""}${custoReal?.pendente ? " Preço compra provisório em USD com envio incluído." : ""}${avisos.length ? " " + avisos.join(" | ") : ""}`
    );
}

function limparListaFinalEdicaoFornecedor() {
    const modal = document.getElementById("fornecedor-edicao-modal");
    const area = modal?.querySelector("#fornecedor-edicao-lista-final");
    if (area) area.value = "";
    const envio = modal?.querySelector("#fornecedor-edicao-envio-usd");
    const totalCompraUsd = modal?.querySelector("#fornecedor-edicao-total-compra-usd");
    const total = modal?.querySelector("#fornecedor-edicao-total-eur");
    if (envio) envio.value = "";
    if (totalCompraUsd) totalCompraUsd.value = "";
    if (total) total.value = "";
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

function analisarLinhaListaExFornecedor(linha, numeroLinha) {
    const partes = dividirLinhaListaFinalFornecedor(linha).map((parte) => String(parte || "").trim()).filter(Boolean);
    if (!partes.length) return null;

    const referencia = partes[0];
    if (!referencia) {
        return { erro: `linha ${numeroLinha}: referência inválida`, original: linha };
    }
    return { referencia, original: linha };
}

function processarLinhasListaExFornecedor(texto) {
    const linhas = String(texto || "").split(/\r?\n/);
    const itens = [];
    const erros = [];

    linhas.forEach((linha, indice) => {
        const analisada = analisarLinhaListaExFornecedor(linha, indice + 1);
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
    const marcarExInput = linha.querySelector('[data-campo="marcar_ex"]');
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
    if (marcarExInput) marcarExInput.checked = false;
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

function aplicarListaExNaLinhaEdicaoFornecedor(linha) {
    const quantidadeOriginal = Math.max(0, Math.floor(Number(linha.dataset.quantidadeOriginal || 0)));
    const quantidadeInput = linha.querySelector('[data-campo="quantidade"]');
    const faltaInput = linha.querySelector('[data-campo="falta_os"]');
    const marcarOsInput = linha.querySelector('[data-campo="marcar_os"]');
    const marcarExInput = linha.querySelector('[data-campo="marcar_ex"]');
    const removerInput = linha.querySelector('[data-campo="remover"]');
    if (!quantidadeInput || !faltaInput || !marcarExInput) return false;

    if (removerInput) removerInput.checked = false;
    if (marcarOsInput) marcarOsInput.checked = false;
    marcarExInput.checked = true;
    faltaInput.value = "0";
    quantidadeInput.value = "0";
    linha.classList.remove("tem-os");

    const ajuste = linha.querySelector(".fornecedor-ajuste-os");
    if (ajuste) {
        ajuste.className = "fornecedor-ajuste-os fornecedor-ajuste-ex ativo";
        ajuste.textContent = `Inicial: ${quantidadeOriginal} | EX`;
    }
    return true;
}

async function aplicarListaOsNaEdicaoFornecedor() {
    const modal = document.getElementById("fornecedor-edicao-modal");
    if (!modal || modal.hidden) return;
    const area = modal.querySelector("#fornecedor-edicao-lista-os");
    const status = modal.querySelector("#fornecedor-edicao-status");
    const texto = String(area?.value || "");

    if (texto.length > FORNECEDOR_LISTA_MAX_CARACTERES) {
        definirStatusEdicaoFornecedor(status, "erro", `A lista OS é demasiado grande. Limite: ${FORNECEDOR_LISTA_MAX_CARACTERES.toLocaleString("pt-PT")} caracteres.`);
        return;
    }
    if (texto.split(/\r?\n/).filter((linha) => linha.trim()).length > FORNECEDOR_LISTA_MAX_LINHAS) {
        definirStatusEdicaoFornecedor(status, "erro", `A lista OS tem demasiadas linhas. Limite: ${FORNECEDOR_LISTA_MAX_LINHAS} referências por colagem.`);
        return;
    }

    const { itens, erros } = processarLinhasListaOsFornecedor(texto);
    if (!itens.length) {
        definirStatusEdicaoFornecedor(status, "erro", erros.length ? erros.join("; ") : "Cole a lista OS do fornecedor antes de aplicar.");
        return;
    }

    const linhas = Array.from(modal.querySelectorAll(".fornecedor-edicao-produto"));
    const aplicar = [];
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
        aplicar.push({ referencia: item.referencia, quantidadeOs: item.quantidadeOs, linha });
    });

    const avisos = [];
    if (naoEncontradas.length) {
        avisos.push(`${naoEncontradas.length} não estão nesta encomenda: ${naoEncontradas.join(", ")}`);
    }
    if (erros.length) avisos.push(erros.join("; "));
    if (!aplicar.length) {
        definirStatusEdicaoFornecedor(
            status,
            "erro",
            avisos.length
                ? `Nenhuma figura OS aplicada. ${avisos.join(" | ")}`
                : "Nenhuma figura da lista OS coincide com esta encomenda."
        );
        return;
    }

    if (!(await mostrarConfirmacaoSite(
        `Marcar ${aplicar.length} figura(s) como OS?\n\nEssas figuras vão sair do “a receber” e ficar marcadas como OS/Falta.${avisos.length ? "\n\nAtenção: " + avisos.join(" | ") : ""}`,
        { titulo: "Confirmar lista OS", textoConfirmar: "Marcar OS", textoCancelar: "Fechar" }
    ))) {
        return;
    }

    const aplicadas = [];
    aplicar.forEach((item) => {
        if (aplicarListaOsNaLinhaEdicaoFornecedor(item.linha, item.quantidadeOs)) {
            aplicadas.push(item.referencia);
        }
    });
    const resumoCusto = aplicarCustoFixoEurNaEdicaoFornecedor(modal);
    if (resumoCusto.erro) {
        definirStatusEdicaoFornecedor(status, "aviso", `${aplicadas.length} figura(s) marcada(s) como OS. ${resumoCusto.erro}`);
        return;
    }
    definirStatusEdicaoFornecedor(
        status,
        avisos.length ? "aviso" : "sucesso",
        `${aplicadas.length} figura(s) marcada(s) como OS (removidas do a receber).${resumoCusto.aplicado ? obterResumoCustoFixoEurFornecedor(resumoCusto) : ""}${avisos.length ? " " + avisos.join(" | ") : ""}`
    );
}

async function aplicarListaExNaEdicaoFornecedor() {
    const modal = document.getElementById("fornecedor-edicao-modal");
    if (!modal || modal.hidden) return;
    const area = modal.querySelector("#fornecedor-edicao-lista-ex");
    const status = modal.querySelector("#fornecedor-edicao-status");
    const texto = String(area?.value || "");

    if (texto.length > FORNECEDOR_LISTA_MAX_CARACTERES) {
        definirStatusEdicaoFornecedor(status, "erro", `A lista EX é demasiado grande. Limite: ${FORNECEDOR_LISTA_MAX_CARACTERES.toLocaleString("pt-PT")} caracteres.`);
        return;
    }
    if (texto.split(/\r?\n/).filter((linha) => linha.trim()).length > FORNECEDOR_LISTA_MAX_LINHAS) {
        definirStatusEdicaoFornecedor(status, "erro", `A lista EX tem demasiadas linhas. Limite: ${FORNECEDOR_LISTA_MAX_LINHAS} referências por colagem.`);
        return;
    }

    const { itens, erros } = processarLinhasListaExFornecedor(texto);
    if (!itens.length) {
        definirStatusEdicaoFornecedor(status, "erro", erros.length ? erros.join("; ") : "Cole a lista EX do fornecedor antes de aplicar.");
        return;
    }

    const linhas = Array.from(modal.querySelectorAll(".fornecedor-edicao-produto"));
    const aplicar = [];
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
        aplicar.push({ referencia: item.referencia, linha });
    });

    const avisos = [];
    if (naoEncontradas.length) {
        avisos.push(`${naoEncontradas.length} não estão nesta encomenda: ${naoEncontradas.join(", ")}`);
    }
    if (erros.length) avisos.push(erros.join("; "));
    if (!aplicar.length) {
        definirStatusEdicaoFornecedor(
            status,
            "erro",
            avisos.length
                ? `Nenhuma figura EX aplicada. ${avisos.join(" | ")}`
                : "Nenhuma figura da lista EX coincide com esta encomenda."
        );
        return;
    }

    if (!(await mostrarConfirmacaoSite(
        `Marcar ${aplicar.length} figura(s) como EX?\n\nEssas figuras vão sair do “a receber” sem criar OS/Falta.${avisos.length ? "\n\nAtenção: " + avisos.join(" | ") : ""}`,
        { titulo: "Confirmar lista EX", textoConfirmar: "Marcar EX", textoCancelar: "Fechar" }
    ))) {
        return;
    }

    const aplicadas = [];
    aplicar.forEach((item) => {
        if (aplicarListaExNaLinhaEdicaoFornecedor(item.linha)) {
            aplicadas.push(item.referencia);
        }
    });
    definirStatusEdicaoFornecedor(
        status,
        avisos.length ? "aviso" : "sucesso",
        `${aplicadas.length} figura(s) marcada(s) como EX (removidas do a receber sem OS).${avisos.length ? " " + avisos.join(" | ") : ""}`
    );
}

function limparListaExEdicaoFornecedor() {
    const modal = document.getElementById("fornecedor-edicao-modal");
    const area = modal?.querySelector("#fornecedor-edicao-lista-ex");
    if (area) area.value = "";
}


function garantirModalEdicaoFornecedor() {
    let modal = document.getElementById('fornecedor-edicao-modal');
    // Recria se faltar alguma secção nova (modal antigo em memória)
    if (modal && (!modal.querySelector('#fornecedor-edicao-lista-os') || !modal.querySelector('#fornecedor-edicao-lista-ex') || !modal.querySelector('#fornecedor-edicao-total-eur') || !modal.querySelector('#fornecedor-edicao-total-compra-usd') || !modal.querySelector('#fornecedor-edicao-os-total-compra-eur'))) {
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
                <p class="fornecedores-status fornecedor-edicao-status" id="fornecedor-edicao-status" role="status"></p>
                <button type="button" class="fornecedor-edicao-fechar" id="fornecedor-edicao-fechar">Fechar</button>
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
                    <p class="fornecedor-edicao-aviso-guardar">As alterações aos campos acima só ficam gravadas ao clicar <strong>Gravar encomenda</strong>.</p>
                    <section class="fornecedor-lista-final-box fornecedor-lista-final-edicao" aria-label="Lista atual enviada pelo fornecedor">
                        <h4>Colar lista atual do fornecedor</h4>
                        <p>Cola aqui a tabela do fornecedor. O campo CODE é usado como referência; PRICE é lido como preço unitário em USD; SKU e AMOUNT são ignorados. Se a nota indicar OUT OF STOCK, a figura é marcada como OS automaticamente.</p>
                        <textarea id="fornecedor-edicao-lista-final" rows="5" placeholder="Ex.:&#10;CODE	SKU	QTY	PRICE	AMOUNT	NOTE&#10;AF301	AF301	2	$1,25	$2,50&#10;PG634	PG634	1		$0,00	OUT OF STOCK"></textarea>
                        <div class="fornecedor-custo-real-grid" aria-label="Custo real da compra">
                            <label>
                                Envio USD
                                <input type="text" id="fornecedor-edicao-envio-usd" inputmode="decimal" autocomplete="off" placeholder="$83,00">
                            </label>
                            <label>
                                Total compra USD
                                <input type="text" id="fornecedor-edicao-total-compra-usd" inputmode="decimal" autocomplete="off" placeholder="$415,27">
                            </label>
                            <label>
                                Total pago EUR
                                <input type="text" id="fornecedor-edicao-total-eur" inputmode="decimal" autocomplete="off" placeholder="365,40 €">
                            </label>
                            <fieldset>
                                <legend>Distribuir envio</legend>
                                <label><input type="radio" name="fornecedor-edicao-rateio-envio" value="unidades" checked> Por unidade</label>
                                <label><input type="radio" name="fornecedor-edicao-rateio-envio" value="valor"> Por valor</label>
                            </fieldset>
                        </div>
                        <p class="fornecedor-custo-real-ajuda">Se ainda não tiveres o total pago em EUR, deixa esse campo vazio. O preço compra fica provisório em USD com o envio incluído. Quando souberes o total, podes preencher o Total pago EUR; se a soma em USD não bater certo por arredondamentos, preenche também o Total compra USD da folha.</p>
                        <div class="fornecedor-lista-final-acoes">
                            <button type="button" id="fornecedor-edicao-limpar-lista-final">Limpar texto</button>
                            <button type="button" id="fornecedor-edicao-aplicar-lista-final" class="wallapop-botao-destaque">Aplicar à encomenda</button>
                        </div>
                    </section>
                    <section class="fornecedor-lista-final-box fornecedor-lista-os-edicao" aria-label="Lista OS enviada pelo fornecedor">
                        <h4>Colar lista OS do fornecedor (opcional)</h4>
                        <p>Usa só se a lista atual não trouxer a nota OUT OF STOCK. As referências coladas aqui são marcadas como OS e saem do “a receber”.</p>
                        <textarea id="fornecedor-edicao-lista-os" rows="4" placeholder="Ex.:&#10;AF301&#10;PG634&#10;ou com quantidade:&#10;AF301	2"></textarea>
                        <p class="fornecedor-custo-real-ajuda"><strong>Preço fixo EUR</strong></p>
                        <div class="fornecedor-custo-real-grid fornecedor-custo-fixo-eur-grid" aria-label="Preço fixo EUR da encomenda">
                            <label>
                                Preço por unidade EUR
                                <input type="text" id="fornecedor-edicao-os-preco-unitario-eur" inputmode="decimal" autocomplete="off" placeholder="1,20 €">
                            </label>
                            <label>
                                Envio EUR
                                <input type="text" id="fornecedor-edicao-os-envio-eur" inputmode="decimal" autocomplete="off" placeholder="9,00 €">
                            </label>
                            <label>
                                Total compra EUR
                                <input type="text" id="fornecedor-edicao-os-total-compra-eur" inputmode="decimal" autocomplete="off" placeholder="120,00 €">
                            </label>
                        </div>
                        <p class="fornecedor-custo-real-ajuda">Para fornecedores de preço fixo: o Total compra EUR é dividido pelas unidades que ficarem a receber nesta encomenda. Se preencheres o total, ele substitui o preço por unidade + envio.</p>
                        <div class="fornecedor-lista-final-acoes">
                            <button type="button" id="fornecedor-edicao-limpar-lista-os">Limpar texto</button>
                            <button type="button" id="fornecedor-edicao-aplicar-lista-os" class="wallapop-botao-destaque">Marcar OS na encomenda</button>
                        </div>
                    </section>
                    <section class="fornecedor-lista-final-box fornecedor-lista-ex-edicao" aria-label="Lista EX enviada pelo fornecedor">
                        <h4>Colar lista EX do fornecedor</h4>
                        <p>Cola as referências que o fornecedor indicou como EX. São marcadas como EX e saem do “a receber” sem criar OS.</p>
                        <textarea id="fornecedor-edicao-lista-ex" rows="4" placeholder="Ex.:&#10;AF301&#10;PG634"></textarea>
                        <div class="fornecedor-lista-final-acoes">
                            <button type="button" id="fornecedor-edicao-limpar-lista-ex">Limpar texto</button>
                            <button type="button" id="fornecedor-edicao-aplicar-lista-ex" class="wallapop-botao-destaque">Marcar EX na encomenda</button>
                        </div>
                    </section>
                    <div class="fornecedor-edicao-produtos" id="fornecedor-edicao-produtos"></div>
                </div>
                <div class="fornecedores-acoes fornecedor-edicao-acoes">
                    <button type="button" id="fornecedor-edicao-cancelar" class="wallapop-botao">Fechar</button>
                    <button type="submit" id="fornecedor-edicao-guardar" class="wallapop-botao wallapop-botao-destaque wallapop-botao-guardar">Gravar encomenda</button>
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
    modal.querySelector('#fornecedor-edicao-aplicar-lista-ex')?.addEventListener('click', aplicarListaExNaEdicaoFornecedor);
    modal.querySelector('#fornecedor-edicao-limpar-lista-ex')?.addEventListener('click', limparListaExEdicaoFornecedor);
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
    delete modal.dataset.itensAlteradosListaFinal;
    modal.querySelector('#fornecedor-edicao-lista-final').value = '';
    const envioUsd = modal.querySelector('#fornecedor-edicao-envio-usd');
    const totalEur = modal.querySelector('#fornecedor-edicao-total-eur');
    const rateioUnidades = modal.querySelector('input[name="fornecedor-edicao-rateio-envio"][value="unidades"]');
    if (envioUsd) envioUsd.value = '';
    if (totalEur) totalEur.value = '';
    if (rateioUnidades) rateioUnidades.checked = true;
    const listaOs = modal.querySelector('#fornecedor-edicao-lista-os');
    if (listaOs) listaOs.value = '';
    const precoUnitarioEur = modal.querySelector('#fornecedor-edicao-os-preco-unitario-eur');
    const envioEur = modal.querySelector('#fornecedor-edicao-os-envio-eur');
    const totalCompraEur = modal.querySelector('#fornecedor-edicao-os-total-compra-eur');
    if (precoUnitarioEur) precoUnitarioEur.value = '';
    if (envioEur) envioEur.value = '';
    if (totalCompraEur) totalCompraEur.value = '';
    const listaEx = modal.querySelector('#fornecedor-edicao-lista-ex');
    if (listaEx) listaEx.value = '';

    renderizarItensEdicaoPedidoFornecedor(modal, pedido, pedido.itens);

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
        const marcarEx = Boolean(linha.querySelector('[data-campo="marcar_ex"]')?.checked);
        const marcarOs = Boolean(linha.querySelector('[data-campo="marcar_os"]')?.checked) && !marcarEx;
        let faltaOsIndicada = Math.max(0, Math.floor(Number(linha.querySelector('[data-campo="falta_os"]')?.value || 0)));
        if (marcarOs && faltaOsIndicada === 0) {
            faltaOsIndicada = Math.max(1, quantidadeOriginal - quantidade);
        }
        const itemIgnoradoLista = itemIgnoradoListaEdicaoFornecedor(item);
        const continuarIgnoradoLista = itemIgnoradoLista && !marcarEx && !marcarOs && quantidade <= 0;
        // A diferença entre quantidade original e a receber só implica OS quando
        // não é um caso de EX (aí a quantidade foi reduzida por preço, não por falta).
        const faltaOs = marcarEx || continuarIgnoradoLista ? 0 : Math.max(faltaOsIndicada, quantidadeOriginal - quantidade);
        const precoCusto = Math.max(0, Number(String(linha.querySelector('[data-campo="preco_custo"]')?.value || '').replace(',', '.')) || 0);
        const recebido = Math.max(0, Math.floor(Number(linha.querySelector('[data-campo="recebido"]')?.dataset.valor || item.recebido || 0)));
        const estaOs = !marcarEx && !continuarIgnoradoLista && (faltaOs > 0 || marcarOs);
        const quantidadeFinal = estaOs ? Math.max(0, quantidadeOriginal - faltaOs) : quantidade;
        const estavaOs = itemPedidoEstavaOsFornecedor(item);
        const estavaEx = itemPedidoEstaExFornecedor(item);
        const mudouParaOsOuEx = (estaOs && !estavaOs) || (marcarEx && !estavaEx);
        const produtoAtual = obterProdutoParaPedidoFornecedor(item) || item;
        return {
            ...item,
            id: produtoAtual.id || item.id,
            nome: produtoAtual.nome || item.nome,
            sku: produtoAtual.sku || item.sku || "",
            referencia: produtoAtual.referencia || item.referencia || "",
            tema: produtoAtual.tema || item.tema || "",
            subtema: produtoAtual.subtema || item.subtema || "",
            imagens: produtoAtual.imagens || item.imagens || [],
            quantidade_original: quantidadeOriginal,
            quantidade: quantidadeFinal,
            falta_os: faltaOs,
            data_os: (estaOs || marcarEx) ? (item.data_os || (mudouParaOsOuEx ? dataOsHojeFornecedor() : null)) : null,
            preco_custo: precoCusto,
            preco: precoCusto,
            estado_fornecedor: continuarIgnoradoLista ? 'IGNORADO_LISTA' : (estaOs ? 'OS' : (marcarEx ? 'EX' : (['OS', 'EX', 'IGNORADO_LISTA'].includes(String(item.estado_fornecedor || '').toUpperCase()) ? '' : item.estado_fornecedor || ''))),
            origem_ajuste: continuarIgnoradoLista ? 'ignorado-lista' : (item.origem_ajuste === 'ignorado-lista' ? '' : item.origem_ajuste || ''),
            data_origem_ajuste: continuarIgnoradoLista ? (item.data_origem_ajuste || dataOsAgoraFornecedor()) : (item.origem_ajuste === 'ignorado-lista' ? null : item.data_origem_ajuste || null),
            marcado_ex: marcarEx,
            recebido: Math.min(recebido, quantidadeFinal)
        };
    }).filter(item => item && (Number(item.quantidade || 0) > 0 || Number(item.falta_os || 0) > 0 || item.marcado_ex || itemIgnoradoListaEdicaoFornecedor(item)));
}

function obterInteiroCampoEdicaoFornecedor(linha, campo) {
    return Math.max(0, Math.floor(Number(linha.querySelector(`[data-campo="${campo}"]`)?.value || 0)));
}

function obterPrecoCampoEdicaoFornecedor(linha) {
    const valor = linha.querySelector('[data-campo="preco_custo"]')?.value || "";
    return Math.round(Math.max(0, converterNumeroListaFornecedor(valor)) * 100);
}

function obterPrecoItemEdicaoFornecedor(item) {
    return Math.round(Math.max(0, Number(item?.preco_custo ?? item?.custo ?? item?.preco ?? 0) || 0) * 100);
}

function pedidoTemItensAlteradosEdicaoFornecedor(pedido, modal) {
    const linhas = Array.from(modal.querySelectorAll('.fornecedor-edicao-produto'));
    if (linhas.length !== (pedido.itens || []).length) return true;

    return linhas.some(linha => {
        const indice = Number(linha.dataset.indice);
        const item = pedido.itens[indice];
        if (!item) return true;
        if (linha.querySelector('[data-campo="remover"]')?.checked) return true;

        const quantidadeOriginal = Math.max(0, Number(item.quantidade_original ?? item.quantidade ?? 0));
        const quantidadeAtual = Math.max(0, Number(item.quantidade || 0));
        const itemMarcadoEx = itemPedidoEstaExFornecedor(item);
        const itemIgnoradoLista = itemIgnoradoListaEdicaoFornecedor(item);
        const faltaAtual = itemMarcadoEx
            ? 0
            : itemIgnoradoLista
            ? 0
            : Math.max(0, Number(item.falta_os || Math.max(0, quantidadeOriginal - quantidadeAtual)));
        const marcarOsAtual = !itemMarcadoEx && !itemIgnoradoLista && (faltaAtual > 0 || item.estado_fornecedor === "OS");

        const marcarEx = Boolean(linha.querySelector('[data-campo="marcar_ex"]')?.checked);
        const marcarOs = Boolean(linha.querySelector('[data-campo="marcar_os"]')?.checked) && !marcarEx;

        return obterInteiroCampoEdicaoFornecedor(linha, "quantidade") !== Math.floor(quantidadeAtual)
            || obterInteiroCampoEdicaoFornecedor(linha, "falta_os") !== Math.floor(faltaAtual)
            || obterPrecoCampoEdicaoFornecedor(linha) !== obterPrecoItemEdicaoFornecedor(item)
            || marcarEx !== itemMarcadoEx
            || marcarOs !== marcarOsAtual;
    });
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
            status.textContent = 'Encomenda nao encontrada para gravar.';
            status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
            status.classList.add('status-erro');
        }
        return;
    }

    const codigo = normalizarCodigoEdicaoFornecedor(modal.querySelector('#fornecedor-edicao-codigo').value);
    const codigoOriginal = normalizarCodigoEdicaoFornecedor(pedido.codigo);
    const fornecedor = modal.querySelector('#fornecedor-edicao-nome').value.trim();
    const referencia = modal.querySelector('#fornecedor-edicao-referencia').value.trim();
    const estado = modal.querySelector('#fornecedor-edicao-estado').value;
    const estadoAnterior = pedido.estado;
    let itensAlterados = modal.dataset.itensAlteradosListaFinal === "1" || pedidoTemItensAlteradosEdicaoFornecedor(pedido, modal);
    const deveAtualizarHistoricoConfirmacao = deveConfirmarHistoricoPedidoFornecedor(estadoAnterior, estado);
    const itens = lerItensEditadosPedidoFornecedor(pedido, modal);
    const opcoesCustoListaAtual = lerOpcoesCustoListaAtualFornecedor(modal);
    const resumoCustoRealListaAtual = deveCalcularCustoRealListaAtualFornecedor(opcoesCustoListaAtual)
        && itensTemPrecoUsdListaAtualFornecedor(itens)
        ? calcularCustoRealListaAtualFornecedor(itens, opcoesCustoListaAtual)
        : { aplicado: false };
    if (resumoCustoRealListaAtual.erro) {
        definirStatusEdicaoFornecedor(status, "erro", resumoCustoRealListaAtual.erro);
        status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
    }
    if (resumoCustoRealListaAtual.aplicado) {
        itensAlterados = true;
    }
    const resumoCustoFixoEur = aplicarCustoFixoEurItensFornecedor(itens, lerOpcoesCustoFixoEurFornecedor(modal));
    if (resumoCustoFixoEur.erro) {
        definirStatusEdicaoFornecedor(status, "erro", resumoCustoFixoEur.erro);
        status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
    }
    if (resumoCustoFixoEur.aplicado) {
        itensAlterados = true;
    }

    if (!fornecedor) {
        status.textContent = 'Indique o fornecedor.';
        status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
        status.classList.add('status-erro');
        status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
    }
    if (!itens.length) {
        status.textContent = 'A encomenda precisa de pelo menos um produto. Cole a lista atual e clique em "Aplicar à encomenda", ou desmarque "Remover" nos produtos que quer manter.';
        status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
        status.classList.add('status-erro');
        status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
    }
    const pedidoComMesmoCodigo = codigo !== codigoOriginal
        ? encontrarPedidoComCodigoEdicaoFornecedor(codigo, id)
        : null;
    if (pedidoComMesmoCodigo) {
        definirStatusEdicaoFornecedor(status, "erro", `Esse código já pertence à encomenda ${pedidoComMesmoCodigo.codigo}.`);
        status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
    }

    if (itensAlterados
        && typeof confirmarReferenciasItensFornecedor === "function"
        && !(await confirmarReferenciasItensFornecedor(itens, "gravar a encomenda"))) {
        definirStatusEdicaoFornecedor(status, "aviso", "Gravação cancelada para rever as referencias.");
        return;
    }

    let guardadoComSucesso = false;
    try {
        botao.disabled = true;
        status.textContent = 'A gravar ficha...';
        status.classList.remove('status-erro', 'status-sucesso', 'status-aviso');
        status.classList.add('status-neutro');
        const dadosPedido = {
            fornecedor,
            referencia: referencia || null,
            estado
        };
        if (itensAlterados) {
            dadosPedido.itens = itens;
        }
        if (codigo !== codigoOriginal) {
            dadosPedido.codigo = codigo || null;
        }
        const atualizado = await atualizarPedidoFornecedor(id, dadosPedido);
        if (itensAlterados) {
            status.textContent = 'A atualizar histórico na ficha do produto...';
            await sincronizarHistoricoPedidosFornecedor(itens, fornecedor, {
                modo: "editar",
                itensAnteriores: pedido.itens || [],
                estadoPedido: estado,
                dataPedido: pedido.data_encomendada || pedido.criado_em || ''
            });
        }
        if (deveAtualizarHistoricoConfirmacao) {
            status.textContent = 'A confirmar histórico na ficha do produto...';
            await sincronizarHistoricoPedidosFornecedor(itens, fornecedor, {
                modo: "confirmar",
                dataPedido: atualizado.data_encomendada || atualizado.criado_em || pedido.data_encomendada || pedido.criado_em || ''
            });
        }
        let produtosComPrecoAtualizado = 0;
        let avisoPrecoCompra = '';
        if (itensAlterados) {
            status.textContent = 'A atualizar preço compra nos produtos...';
            try {
                produtosComPrecoAtualizado = await sincronizarPrecoCompraProdutosFornecedor(itens, fornecedor);
            } catch (erroPrecoCompra) {
                console.warn('Nao foi possivel sincronizar preço compra nos produtos.', erroPrecoCompra);
                avisoPrecoCompra = ' O preço compra ficou gravado na encomenda, mas ainda não foi atualizado na ficha do produto. Execute o SQL atualizado no Supabase.';
            }
        }
        guardadoComSucesso = true;
        fecharEdicaoPedidoFornecedor();
        renderizarResultadosFornecedor();
        renderizarPedidosFornecedores();
        const detalhe = itensAlterados || deveAtualizarHistoricoConfirmacao
            ? `${resumoCustoRealListaAtual.aplicado ? obterResumoCustoRealListaAtualFornecedor(resumoCustoRealListaAtual).replace(/\n+/g, ' ') : ''}${resumoCustoFixoEur.aplicado ? obterResumoCustoFixoEurFornecedor(resumoCustoFixoEur) : ''}${produtosComPrecoAtualizado ? ` Preço compra atualizado em ${produtosComPrecoAtualizado} produto(s).` : ''}${avisoPrecoCompra}`
            : '';
        definirStatusFornecedor(`Encomenda ${atualizado.codigo || ''} gravada.${detalhe}`, Boolean(avisoPrecoCompra));
    } catch (error) {
        console.error(error);
        definirStatusEdicaoFornecedor(status, "erro", obterMensagemErroEdicaoFornecedor(error));
    } finally {
        botao.disabled = false;
        if (guardadoComSucesso) fecharEdicaoPedidoFornecedor();
    }
}


window.FornecedoresEdicaoPedido = {
  abrir: abrirEdicaoPedidoFornecedor,
  guardar: guardarEdicaoPedidoFornecedor
};
})();
