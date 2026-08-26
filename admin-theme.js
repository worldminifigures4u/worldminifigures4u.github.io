(function () {
    'use strict';

    const CHAVE_TEMA = 'figuresplanet-admin-theme';
    const CLASSE_CLARO = 'admin-light-mode';

    function temaGuardado() {
        try {
            return localStorage.getItem(CHAVE_TEMA) === 'light' ? 'light' : 'dark';
        } catch (erro) {
            return 'dark';
        }
    }

    function guardarTema(tema) {
        try {
            localStorage.setItem(CHAVE_TEMA, tema);
        } catch (erro) {
            // Sem localStorage, o botão continua a funcionar só nesta página.
        }
    }

    function aplicarTema(tema) {
        const claro = tema === 'light';
        document.documentElement.classList.toggle(CLASSE_CLARO, claro);
        if (document.body) {
            document.body.classList.toggle(CLASSE_CLARO, claro);
        }
    }

    function paginaAdmin() {
        return document.body && document.body.classList.contains('cabecalho-com-admin');
    }

    function criarBotaoTema() {
        if (!paginaAdmin()) return;
        const navegacao = document.querySelector('.navegacao-admin-cabecalho');
        if (!navegacao || document.getElementById('admin-theme-toggle')) return;

        const botao = document.createElement('button');
        botao.type = 'button';
        botao.id = 'admin-theme-toggle';
        botao.className = 'acao-cabecalho admin-theme-toggle';

        function atualizarBotao() {
            const claro = document.documentElement.classList.contains(CLASSE_CLARO);
            botao.textContent = claro ? 'Escuro' : 'Claro';
            botao.title = claro ? 'Usar modo escuro' : 'Usar modo claro';
            botao.setAttribute('aria-pressed', String(claro));
        }

        botao.addEventListener('click', () => {
            const proximoTema = document.documentElement.classList.contains(CLASSE_CLARO) ? 'dark' : 'light';
            aplicarTema(proximoTema);
            guardarTema(proximoTema);
            atualizarBotao();
        });

        atualizarBotao();
        navegacao.appendChild(botao);
    }

    aplicarTema(temaGuardado());

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            aplicarTema(temaGuardado());
            criarBotaoTema();
        });
    } else {
        aplicarTema(temaGuardado());
        criarBotaoTema();
    }
})();
