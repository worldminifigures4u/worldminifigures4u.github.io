(function () {
    function carregarCarrinhoLocal() {
        try {
            const guardado = JSON.parse(localStorage.getItem('carrinho')) || [];
            return Array.isArray(guardado) ? guardado : [];
        } catch (erro) {
            localStorage.removeItem('carrinho');
            return [];
        }
    }

    function atualizarContadorCarrinhoCabecalho() {
        const contador = document.getElementById('contador-carrinho-cabecalho');
        if (!contador) return;
        const total = carregarCarrinhoLocal().reduce((soma, item) => soma + Number(item?.quantidade || 0), 0);
        contador.textContent = total;
    }

    window.pesquisarNoCabecalho = function pesquisarNoCabecalho() {
        return;
    };

    window.verificarTeclaEnter = function verificarTeclaEnter(evento) {
        if (evento.key !== 'Enter') return;
        evento.preventDefault();
        const pesquisa = document.getElementById('campo-pesquisa')?.value.trim() || '';
        window.location.href = 'index.html' + (pesquisa ? '?q=' + encodeURIComponent(pesquisa) : '');
    };

    document.addEventListener('DOMContentLoaded', atualizarContadorCarrinhoCabecalho);
    window.addEventListener('storage', atualizarContadorCarrinhoCabecalho);
})();
