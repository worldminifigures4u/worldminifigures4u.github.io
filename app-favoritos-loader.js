// Carregamento partilhado de app-favoritos.js.
(function () {
    let promessaAppFavoritos = null;

    function garantirAppFavoritos() {
        if (typeof carregarFavoritosUtilizador === 'function') return Promise.resolve();
        if (promessaAppFavoritos) return promessaAppFavoritos;

        promessaAppFavoritos = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'app-favoritos.js?v=20260711-favoritos-unico';
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Falha ao carregar app-favoritos.js'));
            document.body.appendChild(script);
        });

        return promessaAppFavoritos;
    }

    window.garantirAppFavoritos = garantirAppFavoritos;
})();
