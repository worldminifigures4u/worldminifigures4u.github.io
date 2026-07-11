// Carrinho minimo para paginas que so precisam de adicionar produtos.
function guardarCarrinho() {
    localStorage.setItem('carrinho', JSON.stringify(carrinho));
}

function adicionarAoCarrinho(prod) {
    const itemExistente = carrinho.find(item => item.id === prod.id);

    if (itemExistente) {
        itemExistente.quantidade++;
    } else {
        carrinho.push({
            id: prod.id,
            nome: prod.nome,
            preco: prod.preco,
            peso: Number(prod.peso || PESO_PADRAO_PRODUTO_GRAMAS),
            imagem: obterImagemPrincipalProduto(prod),
            quantidade: 1
        });
    }

    guardarCarrinho();
    atualizarCarrinhoSeDisponivel();
}
