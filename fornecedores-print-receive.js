(function () {
'use strict';
function limparCampoExportacaoFornecedor(valor) {
    return String(valor ?? '').replace(/[\t\r\n]+/g, ' ').trim();
}

function criarNomeFicheiroExportacaoFornecedor(pedido) {
    const codigo = limparCampoExportacaoFornecedor(pedido?.codigo || 'encomenda').replace(/[^a-z0-9_-]+/gi, '-');
    const data = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    return `${codigo || 'encomenda'}-${data}.txt`;
}

function obterTextoExportacaoPedidoFornecedor(pedido) {
    return ordenarItensPedidoFornecedor(pedido?.itens || [])
        .map(item => {
            const referencia = limparCampoExportacaoFornecedor(item.referencia);
            const quantidade = Math.max(0, Math.floor(Number(item.quantidade || 0)));
            return `${referencia}\t${quantidade}`;
        })
        .filter(Boolean)
        .join('\r\n');
}

function exportarTxtTextoFornecedor(texto, nomeBase = 'encomenda') {
    if (!texto) return;
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = criarNomeFicheiroExportacaoFornecedor({ codigo: nomeBase });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportarTxtPedidoFornecedor(pedido) {
    exportarTxtTextoFornecedor(obterTextoExportacaoPedidoFornecedor(pedido), pedido?.codigo || 'encomenda');
}

function exportarTxtItensFornecedor(itens, nomeBase = 'encomenda') {
    exportarTxtTextoFornecedor(obterTextoExportacaoPedidoFornecedor({ itens }), nomeBase);
}


async function imprimirPedidoFornecedor(id) {
    const pedido = fornecedorPedidos.find(item => String(item.id) === String(id));
    if (!pedido) return;

    const janela = window.open('', '_blank', 'width=900,height=700');
    if (!janela) {
        definirStatusFornecedor('O navegador bloqueou a janela de impressao. Autorize pop-ups para imprimir.', true);
        return;
    }
    try { janela.opener = null; } catch (_) {}
    janela.document.open();
    janela.document.write('<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><title>A preparar impressao</title></head><body>A preparar impressão...</body></html>');
    janela.document.close();

    let produtosCompletos = [];
    try {
        produtosCompletos = await carregarProdutosCompletosPedidoFornecedor(pedido);
    } catch (error) {
        console.warn('Nao foi possivel carregar produtos completos para impressao.', error);
    }

    const produtosImpressao = produtosCompletos.length ? produtosCompletos : fornecedorProdutos;
    const doc = janela.document;
    const larguras = ['32%', '12%', '18%', '16%', '14%', '8%'];
    const titulos = ['Nome da figura', 'Tema', 'Subtema', 'Referência', 'Qtd.', 'Nota'];

    const aplicarEstiloCelula = (celula, indice, cabecalho = false) => {
        celula.style.boxSizing = 'border-box';
        celula.style.width = larguras[indice];
        celula.style.border = '0';
        celula.style.padding = '4px 6px';
        celula.style.margin = '0';
        celula.style.textAlign = 'left';
        celula.style.verticalAlign = 'top';
        celula.style.fontFamily = 'Arial, Helvetica, sans-serif';
        celula.style.fontSize = '11px';
        celula.style.lineHeight = '1.25';
        celula.style.fontWeight = cabecalho ? '700' : '400';
        celula.style.background = 'transparent';
        celula.style.color = '#000';
        celula.style.wordWrap = 'break-word';
        celula.style.overflowWrap = 'break-word';
        celula.style.whiteSpace = 'normal';
    };

    doc.open();
    doc.write('<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><title></title></head><body></body></html>');
    doc.close();
    doc.title = pedido.codigo || 'Encomenda';

    const estiloPagina = doc.createElement('style');
    estiloPagina.textContent = '@page{size:A4;margin:12mm}html,body{margin:0;padding:0;color:#000;background:#fff;font-family:Arial,Helvetica,sans-serif}table{width:100%;border-collapse:collapse;table-layout:fixed;border:0}thead{display:table-header-group}th,td{text-align:left!important;border:0!important;background:transparent!important}tr{background:transparent!important}';
    doc.head.appendChild(estiloPagina);

    const titulo = doc.createElement('h1');
    titulo.textContent = pedido.codigo || 'Encomenda';
    titulo.style.margin = '0 0 12px';
    titulo.style.fontSize = '20px';
    titulo.style.fontFamily = 'Arial, Helvetica, sans-serif';
    titulo.style.textAlign = 'left';
    doc.body.appendChild(titulo);

    const tabela = doc.createElement('table');
    const colgroup = doc.createElement('colgroup');
    larguras.forEach(largura => {
        const col = doc.createElement('col');
        col.style.width = largura;
        colgroup.appendChild(col);
    });
    tabela.appendChild(colgroup);

    const thead = doc.createElement('thead');
    const linhaCabecalho = doc.createElement('tr');
    titulos.forEach((texto, indice) => {
        // Usar td (nao th) para evitar o text-align:center por defeito do browser na impressao
        const celula = doc.createElement('td');
        celula.textContent = texto;
        aplicarEstiloCelula(celula, indice, true);
        linhaCabecalho.appendChild(celula);
    });
    thead.appendChild(linhaCabecalho);
    tabela.appendChild(thead);

    const tbody = doc.createElement('tbody');
    const itens = pedido.itens || [];
    if (!itens.length) {
        const linha = doc.createElement('tr');
        const celula = doc.createElement('td');
        celula.colSpan = 6;
        celula.textContent = 'Sem produtos.';
        aplicarEstiloCelula(celula, 0, false);
        celula.style.width = '100%';
        linha.appendChild(celula);
        tbody.appendChild(linha);
    } else {
        itens.forEach(item => {
            const produtoAtual = obterProdutoParaPedidoFornecedor(item, produtosImpressao) || item;
            const subtemaProduto = produtoAtual.subtema && produtoAtual.subtema !== 'semsubtema' ? produtoAtual.subtema : '';
            const subtemaItem = item.subtema && item.subtema !== 'semsubtema' ? item.subtema : '';
            const novidade = itemPedidoEhNovaNotaFornecedor(item);
            const valores = [
                produtoAtual.nome || item.nome || '',
                produtoAtual.tema || item.tema || '',
                subtemaProduto || subtemaItem || '',
                produtoAtual.referencia || item.referencia || '',
                String(item.quantidade || 0),
                novidade ? 'NOVA' : ''
            ];
            const linha = doc.createElement('tr');
            valores.forEach((valor, indice) => {
                const celula = doc.createElement('td');
                celula.textContent = valor;
                aplicarEstiloCelula(celula, indice, false);
                if (indice === 5) celula.style.fontWeight = '700';
                linha.appendChild(celula);
            });
            tbody.appendChild(linha);
        });
    }
    tabela.appendChild(tbody);
    doc.body.appendChild(tabela);

    janela.focus();
    setTimeout(() => janela.print(), 300);
}


async function receberPedidoFornecedor(id) {
    const pedido = fornecedorPedidos.find(item => item.id === id);
    if (!pedido) return;
    const linhas = Array.from(document.querySelectorAll(`.fornecedor-recebido-input[data-pedido="${CSS.escape(id)}"]`));
    const rececoes = linhas.map(input => {
        const produtoId = input.dataset.produto;
        const itemPedido = (pedido.itens || []).find(item => String(item.id) === String(produtoId));
        const pendente = Math.max(0, Number(itemPedido?.quantidade || 0) - Number(itemPedido?.recebido || 0));
        const quantidade = Math.min(pendente, Math.max(0, Math.floor(Number(input.value) || 0)));
        return { produto_id: produtoId, quantidade };
    }).filter(item => item.quantidade > 0);
    if (!rececoes.length) {
        definirStatusFornecedor('Indique pelo menos uma quantidade recebida (dentro do pendente).', true);
        return;
    }
    if (!window.confirm(`Atualizar stock de ${rececoes.length} produto(s) da encomenda ${obterTextoCodigoPedidoFornecedor(pedido)}?`)) return;
    try {
        definirStatusFornecedor('A atualizar stock...');
        const { data, error } = await fornecedoresClient.rpc('receber_stock_fornecedor_admin', {
            p_encomenda_id: id,
            p_recebidos: rececoes
        });
        if (error) throw error;
        if (data?.sucesso === false) {
            throw new Error(data?.erro || 'Nao foi possivel receber stock.');
        }

        const aplicado = Array.isArray(data?.recebido_aplicado) ? data.recebido_aplicado : rececoes;
        const ativarPorPrimeiraRececao = [];
        const limparNovidadeAposReceber = [];
        aplicado.forEach(rececao => {
            const produtoId = rececao.produto_id || rececao.id;
            const qtd = Math.max(0, Number(rececao.quantidade || 0));
            const produto = fornecedorProdutos.find(item => String(item.id) === String(produtoId));
            if (!produto || qtd <= 0) return;
            const stockAntes = Number.isFinite(Number(rececao.stock_antes))
                ? Number(rececao.stock_antes)
                : Number(produto.stock || 0);
            const stockDepois = Number.isFinite(Number(rececao.stock_depois))
                ? Number(rececao.stock_depois)
                : stockAntes + qtd;
            if (stockAntes <= 0 && stockDepois > 0 && obterBooleanoProdutoFornecedor(produto.novidade)) {
                produto.novidade = false;
                limparNovidadeAposReceber.push({
                    id: String(produto.id),
                    sku: String(produto.sku || "").trim()
                });
            }
            produto.stock = stockDepois;
            // Saída de stock <=0 para >0 (inclui stock negativo pré-encomenda): ativar
            if (stockAntes <= 0 && stockDepois > 0) {
                produto.ativo = true;
                ativarPorPrimeiraRececao.push({
                    id: String(produto.id),
                    sku: String(produto.sku || "").trim(),
                    stock: stockDepois
                });
            } else if (produto.ativo === false && stockDepois > 0) {
                produto.ativo = true;
            }
        });

        const encomendaAtualizada = data?.encomenda || data;
        const atualizado = normalizarPedidoFornecedor(encomendaAtualizada);
        fornecedorPedidos = fornecedorPedidos.map(item => item.id === id ? atualizado : item);
        guardarPedidosFornecedores();
        await carregarCatalogoFornecedores();

        // Se a RPC nao limpou novidade na 1.ª receção, gravar no catálogo
        for (const item of limparNovidadeAposReceber) {
            const produto = fornecedorProdutos.find(p =>
                String(p.id) === item.id || String(p.sku || "").trim().toUpperCase() === item.sku.toUpperCase()
            );
            if (!produto || !obterBooleanoProdutoFornecedor(produto.novidade)) continue;
            try {
                const { data: editado, error: erroNovidade } = await fornecedoresClient.rpc("editar_produto_admin_v2", {
                    p_id: String(produto.id),
                    p_sku_original: String(produto.sku || item.sku),
                    p_produto: {
                        ...produto,
                        novidade: false,
                        imagens: Array.isArray(produto.imagens) ? produto.imagens : []
                    }
                });
                if (!erroNovidade && editado?.id) {
                    produto.novidade = false;
                } else if (erroNovidade) {
                    console.warn("Não foi possível limpar novidade após receber:", item.sku, erroNovidade);
                }
            } catch (erroNovidade) {
                console.warn("Não foi possível limpar novidade após receber:", item.sku, erroNovidade);
            }
        }
        for (const item of ativarPorPrimeiraRececao) {
            const produto = fornecedorProdutos.find(p =>
                String(p.id) === item.id || String(p.sku || "").trim().toUpperCase() === item.sku.toUpperCase()
            );
            if (!produto || Number(produto.stock || 0) <= 0) continue;
            if (produto.ativo !== false) {
                produto.ativo = true;
                continue;
            }
            if (!item.sku) continue;
            const stockReal = Number.isFinite(Number(produto.stock))
                ? Math.floor(Number(produto.stock))
                : Math.floor(Number(item.stock || 0));
            const { error: erroAtivo } = await fornecedoresClient.rpc("atualizar_stock_produto_admin", {
                p_sku: item.sku,
                p_stock: Math.max(0, stockReal),
                p_ativo: true
            });
            if (!erroAtivo) produto.ativo = true;
            else console.warn("Não foi possível ativar após receber:", item.sku, erroAtivo);
        }

        renderizarResultadosFornecedor();
        renderizarPedidosFornecedores();
        const unidades = aplicado.reduce((soma, item) => soma + Math.max(0, Number(item.quantidade || 0)), 0);
        const avisoTeto = aplicado.some(item => Number(item.solicitada || 0) > Number(item.quantidade || 0))
            ? ' Quantidades acima do pendente foram ignoradas.'
            : '';
        const avisoAtivo = ativarPorPrimeiraRececao.length
            ? ` ${ativarPorPrimeiraRececao.length} produto(s) ativado(s) (stock saiu de zero/negativo).`
            : '';
        definirStatusFornecedor(`Stock atualizado (+${unidades} un.) para a encomenda ${atualizado.codigo || ''}.${avisoTeto}${avisoAtivo}`);
    } catch (error) {
        console.error(error);
        definirStatusFornecedor('Erro ao receber stock: ' + (error.message || 'erro desconhecido'), true);
    }
}


window.FornecedoresPrintReceive = {
  imprimir: imprimirPedidoFornecedor,
  exportarTxt: exportarTxtPedidoFornecedor,
  exportarTxtItens: exportarTxtItensFornecedor,
  exportarTxtTexto: exportarTxtTextoFornecedor,
  receber: receberPedidoFornecedor
};
})();
