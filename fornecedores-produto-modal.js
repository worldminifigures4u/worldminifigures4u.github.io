(function () {
'use strict';
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
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector(".mapas-produto-modal-fechar")?.addEventListener("click", fecharEdicaoProdutoMapa);
    modal.querySelector("#mapas-produto-cancelar")?.addEventListener("click", fecharEdicaoProdutoMapa);
    ligarFechoModalPorFundo(modal, fecharEdicaoProdutoMapa);
    modal.querySelector("#mapas-produto-form")?.addEventListener("submit", guardarEdicaoProdutoMapa);
    return modal;
}

function abrirEdicaoProdutoMapa(produtoId) {
    const produto = obterProdutoAtual(produtoId);
    if (!produto) return;

    const modal = garantirModalEdicaoProdutoMapa();
    const campos = modal.querySelector("#mapas-produto-form-campos");
    const status = modal.querySelector("#mapas-produto-status");
    campos.replaceChildren();
    if (status) status.textContent = "";

    modal.querySelector("#mapas-editar-id").value = String(produto.id || "");
    modal.querySelector("#mapas-editar-sku-original").value = String(produto.sku || "");

    const secaoIdentificacao = criarSecaoEdicaoMapa("Identificacao", "mapas-produto-secao-identificacao");
    criarInputEdicaoMapa(secaoIdentificacao, "mapas-editar-nome", "Nome", produto.nome || "", "text", { required: true, largo: true });
    criarInputEdicaoMapa(secaoIdentificacao, "mapas-editar-referencia", "Ref.", produto.referencia || "");
    criarInputEdicaoMapa(secaoIdentificacao, "mapas-editar-sku", "SKU", produto.sku || "", "text", { required: true });
    criarSelectEdicaoMapa(secaoIdentificacao, "mapas-editar-lego", "Lego", normalizarFornecedor(obterLegoProdutoFornecedor(produto)) === "nao" ? "não" : (normalizarFornecedor(obterLegoProdutoFornecedor(produto)) === "sim" ? "sim" : ""), [
        { valor: "", texto: "por verificar" },
        { valor: "sim", texto: "sim" },
        { valor: "não", texto: "não" }
    ]);
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-top", "Top", Boolean(String(obterTopProdutoFornecedor(produto) || "").trim()));
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-arquivado", "Arquivado", obterBooleanoProdutoFornecedor(produto.arquivado));
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-descontinuado", "Descontinuado", obterBooleanoProdutoFornecedor(produto.descontinuado));
    criarCheckboxEdicaoMapa(secaoIdentificacao, "mapas-editar-novidade", "Novidade", obterBooleanoProdutoFornecedor(produto.novidade));
    campos.appendChild(secaoIdentificacao);

    const secaoDetalhes = criarSecaoEdicaoMapa("Detalhes", "mapas-produto-secao-detalhes");
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-preco", "preço venda", Number(produto.preco || 0).toFixed(2), "number", { required: true, min: 0, step: "0.01" });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-preco-compra", "preço compra", Number(produto.preco_compra ?? produto.preco_custo ?? produto.custo ?? 0).toFixed(2), "number", { min: 0, step: "0.01" });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-peso", "Peso (g)", Number(produto.peso || 10), "number", { required: true, min: 1, step: 1 });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-stock", "Stock", Number(produto.stock || 0), "number", { required: true, min: 0, step: 1 });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-tema", "Tema", produto.tema || "", "text", { required: true });
    criarInputEdicaoMapa(secaoDetalhes, "mapas-editar-subtema", "Subtema", produto.subtema === "semsubtema" ? "" : (produto.subtema || ""));
    criarCheckboxEdicaoMapa(secaoDetalhes, "mapas-editar-ativo", "Produto ativo", produto.ativo !== false);
    campos.appendChild(secaoDetalhes);

    const secaoMedia = criarSecaoEdicaoMapa("Imagem e notas", "mapas-produto-secao-media");
    criarInputEdicaoMapa(secaoMedia, "mapas-editar-imagens", "URLs das imagens", imagensProdutoParaTextoFornecedor(produto), "text", { multilinha: true, rows: 4, largo: true });
    criarInputEdicaoMapa(secaoMedia, "mapas-editar-observacoes", "Observacoes", produto.observacoes || "", "text", { multilinha: true, rows: 3, largo: true });
    campos.appendChild(secaoMedia);

    const blocoFornecedores = criarSecaoEdicaoMapa("Fornecedores", "mapas-produto-fornecedores");
    obterCamposProdutoFornecedor().forEach(({ chave, rotulo }) => {
        criarBlocoHistoricoFornecedorFicha(
            blocoFornecedores,
            `mapas-editar-fornecedor-${chave}`,
            rotulo,
            obterFornecedorPorChaveProduto(produto, chave)
        );
    });
    campos.appendChild(blocoFornecedores);

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
    const fornecedores = {};
    const produtoId = document.getElementById("mapas-editar-id")?.value || "";
    const produtoAtual = obterProdutoAtual(produtoId) || fornecedorProdutos.find(item => String(item.id) === String(produtoId)) || null;
    obterCamposProdutoFornecedor().forEach(({ chave }) => {
        const input = document.getElementById(`mapas-editar-fornecedor-${chave}`);
        const valor = input?.value.trim() || "";
        const limparHistorico = input?.dataset.historicoLimpo === "1";
        const historicoEditado = input?.dataset.historicoEditado === "1";
        if (limparHistorico && !valor) return;

        let historicoCustom = null;
        if (historicoEditado || limparHistorico) {
            try {
                historicoCustom = limparHistorico
                    ? []
                    : JSON.parse(input?.dataset.historicoJson || "[]");
                if (!Array.isArray(historicoCustom)) historicoCustom = [];
            } catch (_) {
                historicoCustom = [];
            }
        }

        const anterior = limparHistorico
            ? ""
            : (historicoCustom
                ? { estado: valor, historico: historicoCustom }
                : obterFornecedorPorChaveProduto(produtoAtual, chave));
        const parsed = parseValorMarcacaoFornecedorInput(valor, anterior);
        if (parsed === "" || parsed == null) return;

        if (historicoCustom) {
            const reconstruido = reconstruirMarcacaoHistoricoFornecedor(historicoCustom);
            if (!historicoCustom.length && !valor) return;
            fornecedores[chave] = {
                estado: valor || reconstruido.estado || "",
                historico: historicoCustom,
                datas: reconstruido.datas || [],
                desde: reconstruido.desde || null
            };
            if (!fornecedores[chave].estado && !fornecedores[chave].historico.length) return;
        } else {
            fornecedores[chave] = parsed;
        }
    });

    const produto = {
        nome: document.getElementById("mapas-editar-nome").value.trim(),
        referencia: document.getElementById("mapas-editar-referencia").value.trim(),
        sku: normalizarSkuFornecedor(document.getElementById("mapas-editar-sku").value),
        lego: document.getElementById("mapas-editar-lego").value,
        top: document.getElementById("mapas-editar-top").checked ? "sim" : "",
        arquivado: document.getElementById("mapas-editar-arquivado").checked,
        descontinuado: document.getElementById("mapas-editar-descontinuado").checked,
        novidade: document.getElementById("mapas-editar-novidade").checked,
        preco: Number(document.getElementById("mapas-editar-preco").value),
        preco_compra: Number(document.getElementById("mapas-editar-preco-compra").value || 0),
        peso: Number(document.getElementById("mapas-editar-peso").value || 10),
        stock: Math.floor(Number(document.getElementById("mapas-editar-stock").value || 0)),
        tema: document.getElementById("mapas-editar-tema").value.trim(),
        subtema: document.getElementById("mapas-editar-subtema").value.trim() || "semsubtema",
        imagens: textoParaImagensProdutoFornecedor(document.getElementById("mapas-editar-imagens").value),
        observacoes: document.getElementById("mapas-editar-observacoes").value.trim(),
        fornecedores,
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

async function guardarEdicaoProdutoMapa(evento) {
    evento.preventDefault();
    const status = document.getElementById("mapas-produto-status");
    const botao = document.getElementById("mapas-produto-guardar");

    try {
        if (status) {
            status.textContent = "A guardar produto...";
            status.classList.remove('status-erro', 'status-sucesso', 'status-aviso');
            status.classList.add('status-neutro');
        }
        if (botao) botao.disabled = true;

        const { id, skuOriginal, produto } = lerProdutoEditadoMapa();
        const skuDuplicado = fornecedorProdutos.some(item =>
            String(item.sku || "").trim().toUpperCase() !== String(skuOriginal || "").trim().toUpperCase()
            && String(item.sku || "").trim().toUpperCase() === produto.sku
        );
        if (skuDuplicado) throw new Error("Este SKU ja existe noutro produto.");

        const { data, error } = await fornecedoresClient.rpc("editar_produto_admin_v2", {
            p_id: id,
            p_sku_original: skuOriginal,
            p_produto: produto
        });
        if (error) throw error;
        if (!data?.id) throw new Error("Produto nao encontrado no Supabase.");

        const atualizado = {
            ...data,
            stock: Number.isFinite(Number(data.stock)) ? Number(data.stock) : 0,
            preco: Number.isFinite(Number(data.preco)) ? Number(data.preco) : 0,
            preco_compra: Number.isFinite(Number(data.preco_compra)) ? Number(data.preco_compra) : 0
        };
        fornecedorProdutos = fornecedorProdutos.map(item =>
            String(item.id) === String(atualizado.id) || String(item.sku || "").toUpperCase() === String(skuOriginal || "").toUpperCase()
                ? atualizado
                : item
        );
        fornecedorSelecao = fornecedorSelecao.map(item => String(item.id) === String(atualizado.id) ? { ...atualizado, quantidade: item.quantidade } : item);
        guardarSelecaoFornecedor();
        renderizarResultadosFornecedor();
        renderizarSelecionadosFornecedor();
        fecharEdicaoProdutoMapa();
        definirStatusFornecedor("Produto guardado.");
    } catch (error) {
        console.error(error);
        if (status) {
            status.textContent = "Erro: " + (error.message || "Nao foi possivel guardar o produto.");
            status.classList.remove('status-aviso', 'status-sucesso', 'status-neutro');
            status.classList.add('status-erro');
        }
    } finally {
        if (botao) botao.disabled = false;
    }
}


window.FornecedoresProdutoModal = {
  abrir: abrirEdicaoProdutoMapa,
  guardar: guardarEdicaoProdutoMapa
};
})();
