(function () {
    const pagina = document.body?.dataset?.page || '';
    const opcoes = { pesquisa: 'redirect' };

    if (pagina === 'contactos' || pagina === 'sobre' || pagina === 'politicas') {
        opcoes.contaCabecalhoLeve = true;
    }

    FiguresPlanetListeners.iniciarPaginaPublica(opcoes);
})();
