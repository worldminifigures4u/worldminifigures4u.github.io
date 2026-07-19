// UI partilhada da pagina de favoritos.
let favoritosRenderizadosChave = '';
let favoritosRenderizacaoEmCurso = null;

function definirFavoritosVazio(mensagem) {
    const lista = document.getElementById('lista-favoritos-cliente');
    if (!lista) return;
    lista.classList.remove('favoritos-lista--preparar');
    lista.replaceChildren();

    const vazio = document.createElement('div');
    vazio.className = 'favoritos-vazio';

    const figura = document.createElement('img');
    figura.className = 'favoritos-vazio-figura';
    figura.src = 'img/sem-imagem.png?v=20260719-sem-texto';
    figura.alt = '';
    figura.width = 120;
    figura.height = 120;
    figura.decoding = 'async';

    const texto = document.createElement('p');
    texto.className = 'favoritos-vazio-texto';
    texto.textContent = mensagem || 'Ainda não tens favoritos guardados.';

    const dica = document.createElement('p');
    dica.className = 'favoritos-vazio-dica';
    dica.textContent = 'Guarda as minifiguras que queres acompanhar.';

    vazio.append(figura, texto, dica);
    lista.appendChild(vazio);
    favoritosRenderizadosChave = '';
    atualizarResumoFavoritos(0);
}

function atualizarResumoFavoritos(total) {
    const resumo = document.getElementById('favoritos-resumo');
    if (!resumo) return;
    const n = Number(total || 0);
    resumo.hidden = n === 0;
    if (!n) {
        resumo.replaceChildren();
        return;
    }
    resumo.replaceChildren();
    const destaque = document.createElement('strong');
    destaque.textContent = n.toLocaleString('pt-PT');
    resumo.append(
        destaque,
        document.createTextNode(` ${n === 1 ? 'favorito' : 'favoritos'}`)
    );
}

function definirListaFavoritosPreparacao(lista, ativa) {
    if (!lista) return;
    lista.classList.toggle('favoritos-lista--preparar', ativa);
}

async function aguardarClienteProdutosFavoritos(tentativas = 0) {
    if (produtosClient || dbClient) return produtosClient || dbClient;
    if (tentativas >= 24) return null;
    await new Promise(resolve => setTimeout(resolve, 25));
    return aguardarClienteProdutosFavoritos(tentativas + 1);
}

async function carregarProdutosFavoritosCliente(ids) {
    const idsNormalizados = ids.map(String).filter(Boolean);
    if (!idsNormalizados.length) return [];

    const emCache = obterProdutosFavoritosCache(idsNormalizados);
    if (emCache.length === idsNormalizados.length) return emCache;

    const locais = idsNormalizados
        .map(id => obterProdutoPorIdLocal(id))
        .filter(Boolean);
    if (locais.length === idsNormalizados.length) {
        guardarProdutosFavoritosCache(locais);
        return locais;
    }

    const clienteProdutos = await aguardarClienteProdutosFavoritos();
    if (!clienteProdutos) return emCache.length ? emCache : locais;

    const { data, error } = await clienteProdutos
        .from('produtos_loja')
        .select('id, sku, nome, preco, peso, tema, subtema, imagens, ativo')
        .in('id', idsNormalizados);

    if (error) throw error;
    const produtos = data || [];
    const ordenados = idsNormalizados
        .map(id => produtos.find(produto => String(produto.id) === String(id))
            || locais.find(produto => String(produto.id) === String(id))
            || emCache.find(produto => String(produto.id) === String(id)))
        .filter(Boolean);
    guardarProdutosFavoritosCache(ordenados);
    return ordenados;
}

async function resolverProdutosFavoritos(ids, forcarRede = false) {
    const idsNormalizados = ids.map(String).filter(Boolean);
    if (!forcarRede) {
        const emCache = obterProdutosFavoritosCache(idsNormalizados);
        if (emCache.length === idsNormalizados.length) return emCache;
    }
    return carregarProdutosFavoritosCliente(idsNormalizados);
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
    imagem.loading = 'eager';
    imagem.decoding = 'sync';
    imagem.onerror = () => { imagem.src = 'img/sem-imagem.png?v=20260719-sem-texto'; };

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

    const detalhes = document.createElement('div');
    detalhes.className = 'favorito-detalhes';

    const linhaPrincipal = document.createElement('div');
    linhaPrincipal.className = 'favorito-linha';

    const linhaSecundaria = document.createElement('div');
    linhaSecundaria.className = 'favorito-linha favorito-linha-secundaria';

    linhaPrincipal.append(nome, preco);
    linhaSecundaria.append(detalhe, estado);
    detalhes.append(linhaPrincipal, linhaSecundaria);

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
    remover.setAttribute('aria-label', 'Remover dos favoritos');

    const iconeRemover = document.createElement('span');
    iconeRemover.className = 'btn-favorito-remover-icone';
    iconeRemover.setAttribute('aria-hidden', 'true');
    iconeRemover.textContent = 'X';

    const textoRemover = document.createElement('span');
    textoRemover.className = 'btn-favorito-remover-texto';
    textoRemover.textContent = 'Remover';

    remover.append(iconeRemover, textoRemover);
    remover.addEventListener('click', () => removerFavoritoProduto(produto.id));

    acoes.append(adicionar, remover);
    card.append(imagem, detalhes, acoes);
    return card;
}

function montarFragmentoFavoritos(produtos, ids) {
    const fragmento = document.createDocumentFragment();
    const ordem = (ids || []).map(id => normalizarIdFavorito(id)).filter(Boolean);
    const mapa = new Map(produtos.map(produto => [normalizarIdFavorito(produto.id), produto]));

    ordem.forEach(id => {
        const produto = mapa.get(id);
        if (produto) fragmento.appendChild(criarCardFavoritoCliente(produto));
    });

    return fragmento;
}

function pintarListaFavoritos(lista, produtos, ids = produtos.map(produto => produto.id)) {
    lista.replaceChildren(montarFragmentoFavoritos(produtos, ids));
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

function mostrarCarregamentoFavoritos(lista) {
    if (lista.querySelector('.favorito-card') || lista.querySelector('.favoritos-a-carregar')) return;
    lista.replaceChildren();
    const carregamento = document.createElement('p');
    carregamento.className = 'favoritos-a-carregar';
    carregamento.textContent = 'A carregar favoritos...';
    lista.appendChild(carregamento);
}

function adicionarCardFavoritoCliente(produto) {
    const lista = document.getElementById('lista-favoritos-cliente');
    if (!lista || !produto) return;

    const id = normalizarIdFavorito(produto.id);
    if (lista.querySelector('.favoritos-vazio')) lista.replaceChildren();
    if (lista.querySelector(`[data-favorito-produto-id="${CSS.escape(id)}"]`)) return;

    lista.classList.remove('favoritos-lista--preparar');
    lista.appendChild(criarCardFavoritoCliente(produto));
    favoritosRenderizadosChave = obterChaveRenderFavoritos();
    atualizarResumoFavoritos(obterFavoritosIds().length);
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

    const precisaMensagemCarregamento = !lista.querySelector('.favorito-card');
    definirListaFavoritosPreparacao(lista, true);
    if (precisaMensagemCarregamento) mostrarCarregamentoFavoritos(lista);

    favoritosRenderizacaoEmCurso = (async () => {
        try {
            const produtos = await resolverProdutosFavoritos(ids, opcoes.forcar);
            if (!produtos.length) {
                definirFavoritosVazio('Os favoritos guardados já não estão disponíveis na loja.');
                return;
            }

            pintarListaFavoritos(lista, produtos, ids);
            favoritosRenderizadosChave = obterChaveRenderFavoritos(produtos.map(produto => produto.id));
            atualizarResumoFavoritos(produtos.length);
        } catch (error) {
            console.error('Erro ao carregar favoritos:', error);
            if (!lista.querySelector('.favorito-card')) {
                definirFavoritosVazio('Não foi possível carregar os favoritos.');
            }
        } finally {
            definirListaFavoritosPreparacao(lista, false);
        }
    })();

    try {
        await favoritosRenderizacaoEmCurso;
    } finally {
        favoritosRenderizacaoEmCurso = null;
    }
}
