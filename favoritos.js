function definirFavoritosVazio(mensagem) {
    const lista = document.getElementById('lista-favoritos-cliente');
    if(!lista) return;
    lista.replaceChildren();
    const vazio = document.createElement('p');
    vazio.className = 'favoritos-vazio';
    vazio.textContent = mensagem;
    const acoes = document.createElement('div');
    acoes.className = 'favoritos-vazio-acoes';
    const continuar = document.createElement('a');
    continuar.className = 'favoritos-continuar';
    continuar.href = 'index.html';
    continuar.textContent = 'Ver produtos';
    acoes.appendChild(continuar);
    lista.append(vazio, acoes);
    atualizarResumoFavoritos(0);
}

function atualizarResumoFavoritos(total) {
    const resumo = document.getElementById('favoritos-resumo');
    if(!resumo) return;
    resumo.textContent = total === 1
        ? '1 minifigura guardada nos favoritos.'
        : `${Number(total || 0).toLocaleString('pt-PT')} minifiguras guardadas nos favoritos.`;
}

async function aguardarClienteProdutosFavoritos(tentativas = 0) {
    if (produtosClient || dbClient) return produtosClient || dbClient;
    if (tentativas >= 80) return null;
    await new Promise(resolve => setTimeout(resolve, 50));
    return aguardarClienteProdutosFavoritos(tentativas + 1);
}

async function carregarProdutosFavoritosCliente(ids) {
    const idsNormalizados = ids.map(String).filter(Boolean);
    if(!idsNormalizados.length) return [];

    const locais = idsNormalizados
        .map(id => obterProdutoPorIdLocal(id))
        .filter(Boolean);
    if(locais.length === idsNormalizados.length) return locais;

    const clienteProdutos = await aguardarClienteProdutosFavoritos();
    if(!clienteProdutos) return locais;

    const { data, error } = await clienteProdutos
        .from('produtos_loja')
        .select('id, sku, nome, preco, peso, tema, subtema, imagens, ativo')
        .in('id', idsNormalizados);

    if(error) throw error;
    const produtos = data || [];
    return idsNormalizados
        .map(id => produtos.find(produto => String(produto.id) === String(id)) || locais.find(produto => String(produto.id) === String(id)))
        .filter(Boolean);
}

function criarCardFavoritoCliente(produto) {
    const card = document.createElement('article');
    card.className = 'favorito-card';

    const imagem = document.createElement('img');
    imagem.className = 'favorito-imagem';
    imagem.src = otimizarImagemCloudinary(obterImagemPrincipalProduto(produto), 360);
    imagem.alt = produto.nome || 'Produto favorito';
    imagem.loading = 'lazy';
    imagem.onerror = () => { imagem.src = 'img/sem-imagem.png'; };

    const info = document.createElement('div');
    info.className = 'favorito-info';

    const nome = document.createElement('strong');
    nome.textContent = produto.nome || 'Produto';

    const detalhe = document.createElement('span');
    detalhe.textContent = [produto.tema, produto.subtema].filter(Boolean).join(' - ') || 'Sem tema';

    const preco = document.createElement('span');
    preco.className = 'favorito-preco';
    preco.textContent = formatarEuro(produto.preco || 0) + ' €';

    const estado = document.createElement('small');
    estado.className = produto.ativo === false ? 'favorito-indisponivel' : 'favorito-disponivel';
    estado.textContent = produto.ativo === false ? 'Sem stock / indisponível' : 'Disponível';

    info.append(nome, detalhe, preco, estado);

    const acoes = document.createElement('div');
    acoes.className = 'favorito-acoes';

    const adicionar = document.createElement('button');
    adicionar.type = 'button';
    adicionar.className = 'btn-favorito-adicionar';
    adicionar.textContent = 'Adicionar';
    adicionar.disabled = produto.ativo === false;
    adicionar.addEventListener('click', () => adicionarAoCarrinho(produto));

    const remover = document.createElement('button');
    remover.type = 'button';
    remover.className = 'btn-favorito-remover';
    remover.textContent = 'Remover';
    remover.addEventListener('click', () => removerFavoritoProduto(produto.id));

    acoes.append(adicionar, remover);
    card.append(imagem, info, acoes);
    return card;
}

async function renderizarFavoritosCliente() {
    const lista = document.getElementById('lista-favoritos-cliente');
    if(!lista) return;

    const ids = obterFavoritosIds();
    if(!ids.length) {
        definirFavoritosVazio('Ainda não tens favoritos guardados.');
        return;
    }

    lista.replaceChildren();
    const carregamento = document.createElement('p');
    carregamento.className = 'favoritos-vazio';
    carregamento.textContent = 'A carregar favoritos...';
    lista.appendChild(carregamento);
    atualizarResumoFavoritos(ids.length);

    try {
        const produtos = await carregarProdutosFavoritosCliente(ids);
        lista.replaceChildren();
        if(!produtos.length) {
            definirFavoritosVazio('Os favoritos guardados já não estão disponíveis na loja.');
            return;
        }
        produtos.forEach(produto => lista.appendChild(criarCardFavoritoCliente(produto)));
        atualizarResumoFavoritos(produtos.length);
    } catch(error) {
        console.error('Erro ao carregar favoritos:', error);
        definirFavoritosVazio('Não foi possível carregar os favoritos.');
    }
}

window.addEventListener('load', () => {
    renderizarFavoritosCliente();
});
