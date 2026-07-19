// Estado e funcoes de favoritos.
let favoritosProdutos = new Set(carregarFavoritosLocal());
let favoritosChaveAtual = 'figures-planet-favoritos';

function obterChaveFavoritos(userId = '') {
    const id = String(userId || '').trim();
    return id ? `figures-planet-favoritos-${id}` : 'figures-planet-favoritos';
}

function normalizarIdFavorito(id) {
    return String(id || '').trim();
}

function carregarFavoritosLocal(chave = obterChaveFavoritos()) {
    try {
        const guardados = JSON.parse(localStorage.getItem(chave)) || [];
        if (!Array.isArray(guardados)) return [];
        return [...new Set(guardados.map(normalizarIdFavorito).filter(Boolean))];
    } catch (_) {
        localStorage.removeItem(chave);
        return [];
    }
}

function guardarFavoritosLocal() {
    localStorage.setItem(favoritosChaveAtual, JSON.stringify([...favoritosProdutos]));
}

function obterChaveCacheFavoritos(chave = favoritosChaveAtual) {
    return String(chave || obterChaveFavoritos()).replace(
        'figures-planet-favoritos',
        'figures-planet-favoritos-cache'
    );
}

function extrairSnapshotFavoritoProduto(produto) {
    return {
        id: produto.id,
        sku: produto.sku || '',
        nome: produto.nome || 'Produto',
        preco: Number(produto.preco || 0),
        peso: Number(produto.peso || 0),
        tema: produto.tema || '',
        subtema: produto.subtema || '',
        imagens: produto.imagens ?? null,
        ativo: produto.ativo !== false
    };
}

function carregarCacheFavoritos(chave = favoritosChaveAtual) {
    try {
        const guardado = JSON.parse(localStorage.getItem(obterChaveCacheFavoritos(chave)));
        return guardado && typeof guardado === 'object' ? guardado : {};
    } catch (_) {
        localStorage.removeItem(obterChaveCacheFavoritos(chave));
        return {};
    }
}

function guardarCacheFavoritos(cache, chave = favoritosChaveAtual) {
    localStorage.setItem(obterChaveCacheFavoritos(chave), JSON.stringify(cache));
}

function atualizarCacheFavoritoProduto(produto) {
    const id = normalizarIdFavorito(produto?.id);
    if (!id) return;
    const cache = carregarCacheFavoritos();
    cache[id] = extrairSnapshotFavoritoProduto(produto);
    guardarCacheFavoritos(cache);
}

function removerCacheFavoritoProduto(id) {
    const chave = normalizarIdFavorito(id);
    if (!chave) return;
    const cache = carregarCacheFavoritos();
    delete cache[chave];
    guardarCacheFavoritos(cache);
}

function guardarProdutosFavoritosCache(produtos = []) {
    if (!Array.isArray(produtos) || !produtos.length) return;
    const cache = carregarCacheFavoritos();
    produtos.forEach(produto => {
        const id = normalizarIdFavorito(produto?.id);
        if (id) cache[id] = extrairSnapshotFavoritoProduto(produto);
    });
    guardarCacheFavoritos(cache);
}

function obterProdutosFavoritosCache(ids = obterFavoritosIds()) {
    const cache = carregarCacheFavoritos();
    return ids
        .map(id => cache[normalizarIdFavorito(id)])
        .filter(Boolean);
}

function mesclarCacheFavoritosAnonimos(userId = '') {
    if (!userId) return;
    const chaveConta = obterChaveFavoritos(userId);
    const chaveAnonima = obterChaveFavoritos();
    const cacheConta = carregarCacheFavoritos(chaveConta);
    const cacheAnonimo = carregarCacheFavoritos(chaveAnonima);
    guardarCacheFavoritos({ ...cacheAnonimo, ...cacheConta }, chaveConta);
    localStorage.removeItem(obterChaveCacheFavoritos(chaveAnonima));
}

function obterChaveRenderFavoritos(ids = obterFavoritosIds()) {
    return ids.map(String).filter(Boolean).sort().join('|');
}

function limparFavoritosAnonimosLocais() {
    const chaveAnonima = obterChaveFavoritos();
    localStorage.removeItem(chaveAnonima);
    localStorage.removeItem(obterChaveCacheFavoritos(chaveAnonima));
}

function removerFavoritoDaChaveLocal(chaveStorage, id) {
    const chave = normalizarIdFavorito(id);
    if (!chave || !chaveStorage) return;
    const restantes = carregarFavoritosLocal(chaveStorage).filter(item => item !== chave);
    localStorage.setItem(chaveStorage, JSON.stringify(restantes));
    const cache = carregarCacheFavoritos(chaveStorage);
    if (cache[chave]) {
        delete cache[chave];
        guardarCacheFavoritos(cache, chaveStorage);
    }
}

function carregarFavoritosUtilizador(userId = '') {
    const chaveAnterior = favoritosChaveAtual;
    const idsAnteriores = obterChaveRenderFavoritos(obterFavoritosIds());
    favoritosChaveAtual = obterChaveFavoritos(userId);
    const favoritosConta = carregarFavoritosLocal(favoritosChaveAtual);
    const favoritosAnonimos = userId ? carregarFavoritosLocal(obterChaveFavoritos()) : [];
    favoritosProdutos = new Set([...favoritosConta, ...favoritosAnonimos]);
    if (userId && favoritosAnonimos.length) {
        guardarFavoritosLocal();
        mesclarCacheFavoritosAnonimos(userId);
        // Evita que favoritos anónimos voltem a aparecer após remoção na conta.
        limparFavoritosAnonimosLocais();
    }
    atualizarBotoesFavoritos();

    const idsNovos = obterChaveRenderFavoritos(obterFavoritosIds());
    const favoritosMudaram = chaveAnterior !== favoritosChaveAtual || idsAnteriores !== idsNovos;
    if (!favoritosMudaram || typeof renderizarFavoritosCliente !== 'function') return;

    if (document.getElementById('lista-favoritos-cliente')) {
        renderizarFavoritosCliente();
    }
}

function obterFavoritosIds() {
    return [...favoritosProdutos];
}

function produtoEstaNosFavoritos(id) {
    return favoritosProdutos.has(normalizarIdFavorito(id));
}

function atualizarBotaoFavorito(botao, ativo) {
    if (!botao) return;
    botao.classList.toggle('is-favorite', ativo);
    botao.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    botao.title = ativo ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
    botao.setAttribute('aria-label', ativo ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
}

function atualizarBotoesFavoritos() {
    document.querySelectorAll('[data-favorito-produto-id]').forEach(botao => {
        atualizarBotaoFavorito(botao, produtoEstaNosFavoritos(botao.dataset.favoritoProdutoId));
    });
}

function alternarFavoritoProduto(produto) {
    const id = normalizarIdFavorito(produto?.id);
    if (!id) return false;
    const ativo = favoritosProdutos.has(id);
    if (ativo) {
        favoritosProdutos.delete(id);
        removerCacheFavoritoProduto(id);
        if (favoritosChaveAtual !== obterChaveFavoritos()) {
            removerFavoritoDaChaveLocal(obterChaveFavoritos(), id);
        }
    } else {
        favoritosProdutos.add(id);
        atualizarCacheFavoritoProduto(produto);
    }
    guardarFavoritosLocal();
    atualizarBotoesFavoritos();
    if (typeof renderizarFavoritosCliente === 'function' && document.getElementById('lista-favoritos-cliente')) {
        if (ativo && typeof removerCardFavoritoCliente === 'function') removerCardFavoritoCliente(id);
        else if (typeof adicionarCardFavoritoCliente === 'function') adicionarCardFavoritoCliente(produto);
        else renderizarFavoritosCliente({ forcar: true });
    } else if (typeof renderizarFavoritosCliente === 'function') {
        renderizarFavoritosCliente();
    }
    return !ativo;
}

function removerFavoritoProduto(id) {
    const chave = normalizarIdFavorito(id);
    if (!chave || !favoritosProdutos.has(chave)) return;
    favoritosProdutos.delete(chave);
    guardarFavoritosLocal();
    removerCacheFavoritoProduto(chave);
    if (favoritosChaveAtual !== obterChaveFavoritos()) {
        removerFavoritoDaChaveLocal(obterChaveFavoritos(), chave);
    }
    atualizarBotoesFavoritos();
    if (typeof removerCardFavoritoCliente === 'function' && document.getElementById('lista-favoritos-cliente')) {
        removerCardFavoritoCliente(chave);
    } else if (typeof renderizarFavoritosCliente === 'function') {
        renderizarFavoritosCliente();
    }
}

