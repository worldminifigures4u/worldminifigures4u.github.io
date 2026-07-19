// Utilitarios de carrinho e checkout (pagina Carrinho).

function obterMetodoPagamentoSelecionado() {
    const radioSelecionado = document.querySelector('input[name="metodo-pagamento"]:checked');
    return radioSelecionado ? radioSelecionado.value : 'Não especificado';
}

function mensagemSucessoEncomenda(metodoPagamento, codigoEncomenda = '') {
    const referencia = codigoEncomenda ? `\nReferência da encomenda: ${codigoEncomenda}` : '';
    return `Encomenda registada com sucesso!${referencia}\nEnviámos um e-mail com os dados para pagamento.`;
}

function obterImagemAtualCarrinho(item, produtoCompleto) {
    const imagemAtual = produtoCompleto
        ? obterImagemPrincipalProduto(produtoCompleto)
        : '';

    if (imagemAtual && imagemAtual !== 'img/sem-imagem.png?v=20260719-silhueta') {
        return imagemAtual;
    }

    return item?.imagem || 'img/sem-imagem.png?v=20260719-silhueta';
}

async function garantirProdutosCarrinhoNoCatalogo() {
    const cliente = produtosClient || dbClient;
    if (!cliente) return;

    const ids = [...new Set(carrinho.map(item => String(item.id)).filter(Boolean))];
    const emFalta = ids.filter(id => !obterProdutoPorIdLocal(id));
    if (!emFalta.length) return;

    const { data, error } = await cliente
        .from('produtos_loja')
        .select('id, sku, nome, preco, peso, tema, subtema, imagens, ativo, descontinuado')
        .in('id', emFalta);

    if (error) throw error;
    if (!data?.length) return;

    const existentes = new Set((todosOsProdutos || []).map(produto => String(produto.id)));
    todosOsProdutos.push(...data.filter(produto => !existentes.has(String(produto.id))));
}

async function carregarProdutosConformeUtilizador() {
    if (typeof paginaPrecisaCatalogoAdmin === 'function' && paginaPrecisaCatalogoAdmin()) {
        const { data: { user } } = await dbClient.auth.getUser();
        if (utilizadorAdmin(user) && typeof carregarProdutosAdminDaNuvem === 'function') {
            await carregarProdutosAdminDaNuvem();
        }
        return;
    }
    if (typeof paginaPrecisaProdutosLoja === 'function' && paginaPrecisaProdutosLoja()) {
        return;
    }
    if ((typeof obterVistaPagina === 'function' && obterVistaPagina() === 'carrinho') || document.getElementById('lista-carrinho')) {
        await garantirProdutosCarrinhoNoCatalogo();
    }
}
