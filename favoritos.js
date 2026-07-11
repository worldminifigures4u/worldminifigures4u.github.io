// Arranque da pagina de favoritos.
function iniciarPaginaFavoritos() {
    if (document.body?.dataset?.page !== 'favoritos') return;
    renderizarFavoritosCliente();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarPaginaFavoritos);
} else {
    iniciarPaginaFavoritos();
}
