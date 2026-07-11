// UI partilhada da pagina de favoritos.
let favoritosRenderizadosChave = '';
let favoritosRenderizacaoEmCurso = null;

function definirFavoritosVazio(mensagem) {
    const lista = document.getElementById('lista-favoritos-cliente');
    if (!lista) return;
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
    favoritosRenderizadosChave = '';
    atualizarResumoFavoritos(0);
}

function atualizarResumoFavoritos(total) {
    const resumo = document.getElementById('favoritos-resumo');
    if (!resumo) return;
    const n = Number(total || 0);
    resumo.textContent = n === 1 ? '1 favorito' : `${n.toLocaleString('pt-PT')} favoritos`;
}

async function aguardarClienteProdutosFavoritos(tentativas = 0) {
    if (produtosClient || dbClient) return produtosClient || dbClient;
    if (tentativas >= 80) return null;
    await new Promise(resolve => setTimeout(resolve, 50));
    return aguardarClienteProdutosFavoritos(tentativas + 1);
}

async function carregarProdutosFavoritosCliente(ids) {
    const idsNormalizados = ids.map(String).filter(Boolean);
    if (!idsNormalizados.length) return [];

    const locais = idsNormalizados
        .map(id => obterProdutoPorIdLocal(id))
        .filter(Boolean);
    if (locais.length === idsNormalizados.length) return locais;

    const clienteProdutos = await aguardarClienteProdutosFavoritos();
    if (!clienteProdutos) return locais;

    const { data, error } = await clienteProdutos
        .from('produtos_loja')
        .select('id, sku, nome, preco, peso, tema, subtema, imagens, ativo')
        .in('id', idsNormalizados);

    if (error) throw error;
    const produtos = data || [];
    return idsNormalizados
        .map(id => produtos.find(produto => String(produto.id) === String(id)) || locais.find(produto => String(produto.id) === String(id)))
        .filter(Boolean);
}

function criarCardFavoritoCliente(produto) {
    const card = document.createElement('article');
    card.className = 'favorito-card';
    card.dataset.favoritoProdutoId = normalizarIdFavorito(produto.id);

    const imagem = document.createElement('img');
    imagem.className = 'favorito-imagem';
    const responsivo = otimizarImagemCloudinarySrcset(obterImagemPrincipalProduto(produto), [180, 360, 540]);
    imagem.src = responsivo.src;
    if (responsivo.srcset) {
        imagem.srcset = responsivo.srcset;
        imagem.sizes = responsivo.sizes;
    }
    imagem.alt = produto.nome || 'Produto favorito';
    imagem.loading = 'lazy';
    imagem.onerror = () => { imagem.src = 'img/sem-imagem.png'; };

    const info = document.createElement('div');
    info.className = 'favorito-info';

    const nome = document.createElement('strong');
    nome.textContent = produto.nome || 'Produto';

    const detalhe = document.createElement('span');
    const temaDetalhe = [produto.tema, produto.subtema]
        .map(valor => String(valor || '').trim())
        .filter(valor => valor && !/^sem\s*subtema$/i.test(valor));
    detalhe.textContent = temaDetalhe.join(' - ') || 'Sem tema';

    const preco = document.createElement('span');
    preco.className = 'favorito-preco';
    preco.textContent = formatarEuro(produto.preco || 0) + ' €';

    const estado = document.createElement('small');
    estado.className = produto.ativo === false ? 'favorito-indisponivel' : 'stock-disponivel';
    estado.textContent = produto.ativo === false ? 'Sem stock / indisponível' : 'Disponível';

    info.append(nome, detalhe);

    const meta = document.createElement('div');
    meta.className = 'favorito-meta';
    meta.append(preco, estado);

    const acoes = document.createElement('div');
    acoes.className = 'favorito-acoes';

    const adicionar = document.createElement('button');
    adicionar.type = 'button';
    adicionar.className = 'btn-favorito-adicionar';
    const textoAdicionar = document.createElement('span');
    textoAdicionar.textContent = 'Adicionar ao carrinho';
    const iconeCarrinho = document.createElement('span');
    iconeCarrinho.className = 'icone-carrinho';
    iconeCarrinho.setAttribute('aria-hidden', 'true');
    adicionar.append(textoAdicionar, iconeCarrinho);
    adicionar.disabled = produto.ativo === false;
    adicionar.addEventListener('click', () => adicionarAoCarrinho(produto));

    const remover = document.createElement('button');
    remover.type = 'button';
    remover.className = 'btn-favorito-remover';
    remover.textContent = 'Remover';
    remover.addEventListener('click', () => removerFavoritoProduto(produto.id));

    acoes.append(adicionar, remover);
    card.append(imagem, info, meta, acoes);
    return card;
}

function removerCardFavoritoCliente(id) {
    const lista = document.getElementById('lista-favoritos-cliente');
    if (!lista) return;

    const chave = normalizarIdFavorito(id);
    const card = lista.querySelector(`[data-favorito-produto-id="${CSS.escape(chave)}"]`);
    if (card) card.remove();

    const restantes = obterFavoritosIds().length;
    favoritosRenderizadosChave = obterChaveRenderFavoritos();
    if (!restantes) {
        definirFavoritosVazio('Ainda não tens favoritos guardados.');
        return;
    }
    atualizarResumoFavoritos(restantes);
}

async function renderizarFavoritosCliente(opcoes = {}) {
    const lista = document.getElementById('lista-favoritos-cliente');
    if (!lista) return;

    const ids = obterFavoritosIds();
    const chave = obterChaveRenderFavoritos(ids);
    if (!ids.length) {
        definirFavoritosVazio('Ainda não tens favoritos guardados.');
        return;
    }

    const jaRenderizado = !opcoes.forcar
        && chave === favoritosRenderizadosChave
        && lista.querySelector('.favorito-card');
    if (jaRenderizado) {
        atualizarResumoFavoritos(ids.length);
        return;
    }

    if (favoritosRenderizacaoEmCurso) {
        await favoritosRenderizacaoEmCurso;
        if (!opcoes.forcar && chave === favoritosRenderizadosChave && lista.querySelector('.favorito-card')) {
            atualizarResumoFavoritos(ids.length);
            return;
        }
    }

    const temCards = !!lista.querySelector('.favorito-card');
    const jaMostraCarregamento = !!lista.querySelector('.favoritos-vazio')
        && lista.textContent.trim() === 'A carregar favoritos...';
    if (!temCards && !jaMostraCarregamento) {
        lista.replaceChildren();
        const carregamento = document.createElement('p');
        carregamento.className = 'favoritos-vazio';
        carregamento.textContent = 'A carregar favoritos...';
        lista.appendChild(carregamento);
    }
    atualizarResumoFavoritos(ids.length);

    favoritosRenderizacaoEmCurso = (async () => {
        try {
            const produtos = await carregarProdutosFavoritosCliente(ids);
            if (!produtos.length) {
                definirFavoritosVazio('Os favoritos guardados já não estão disponíveis na loja.');
                return;
            }
            lista.replaceChildren();
            produtos.forEach(produto => lista.appendChild(criarCardFavoritoCliente(produto)));
            favoritosRenderizadosChave = chave;
            atualizarResumoFavoritos(produtos.length);
        } catch (error) {
            console.error('Erro ao carregar favoritos:', error);
            definirFavoritosVazio('Não foi possível carregar os favoritos.');
        }
    })();

    try {
        await favoritosRenderizacaoEmCurso;
    } finally {
        favoritosRenderizacaoEmCurso = null;
    }
}
