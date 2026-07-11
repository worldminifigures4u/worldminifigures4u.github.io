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

function obterChaveRenderFavoritos(ids = obterFavoritosIds()) {
    return ids.map(String).filter(Boolean).sort().join('|');
}

function carregarFavoritosUtilizador(userId = '') {
    const chaveAnterior = favoritosChaveAtual;
    const idsAnteriores = obterChaveRenderFavoritos(obterFavoritosIds());
    favoritosChaveAtual = obterChaveFavoritos(userId);
    const favoritosConta = carregarFavoritosLocal(favoritosChaveAtual);
    const favoritosAnonimos = userId ? carregarFavoritosLocal(obterChaveFavoritos()) : [];
    favoritosProdutos = new Set([...favoritosConta, ...favoritosAnonimos]);
    if (userId && favoritosAnonimos.length) guardarFavoritosLocal();
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
    if (ativo) favoritosProdutos.delete(id);
    else favoritosProdutos.add(id);
    guardarFavoritosLocal();
    atualizarBotoesFavoritos();
    if (typeof renderizarFavoritosCliente === 'function' && document.getElementById('lista-favoritos-cliente')) {
        if (ativo && typeof removerCardFavoritoCliente === 'function') removerCardFavoritoCliente(id);
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
    atualizarBotoesFavoritos();
    if (typeof removerCardFavoritoCliente === 'function' && document.getElementById('lista-favoritos-cliente')) {
        removerCardFavoritoCliente(chave);
    } else if (typeof renderizarFavoritosCliente === 'function') {
        renderizarFavoritosCliente();
    }
}

