(function (global) {
    'use strict';

    function normalizarLinhas(texto) {
        return String(texto || '')
            .split(/\r?\n/)
            .map((linha) => linha.trim())
            .filter(Boolean);
    }

    function partirMoradaEmDuasLinhas(morada) {
        const linhas = normalizarLinhas(morada);
        if (linhas.length >= 2) return linhas.slice(0, 2);
        if (!linhas.length) return [];

        const texto = linhas[0];
        if (texto.length <= 52) return [texto];

        const virgula = texto.indexOf(',');
        if (virgula > 8 && virgula < texto.length - 8) {
            const antes = texto.slice(0, virgula + 1).trim();
            const depois = texto.slice(virgula + 1).trim();
            if (antes && depois) return [antes, depois];
        }

        const limite = Math.min(58, Math.max(32, Math.floor(texto.length / 2)));
        let indice = texto.lastIndexOf(' ', limite);
        if (indice < 12) indice = texto.indexOf(' ', limite);
        if (indice > 8 && indice < texto.length - 8) {
            return [texto.slice(0, indice).trim(), texto.slice(indice + 1).trim()];
        }

        return [texto];
    }

    function formatarLinhasMorada(dados = {}) {
        const morada = dados.morada ?? dados.morada_cliente ?? '';
        const cp = dados.cp ?? dados.cp_cliente ?? '';
        const cidade = dados.cidade ?? dados.cidade_cliente ?? '';
        const pais = dados.pais ?? dados.pais_cliente ?? '';

        const linhas = [...partirMoradaEmDuasLinhas(morada)];
        const cpCidade = [String(cp || '').trim(), String(cidade || '').trim()].filter(Boolean).join(' ');
        if (cpCidade) linhas.push(cpCidade);
        if (String(pais || '').trim()) linhas.push(String(pais).trim());
        return linhas;
    }

    function formatarMoradaTexto(dados = {}) {
        return formatarLinhasMorada(dados).join('\n');
    }

    function obterMoradaEdicao(morada) {
        const linhas = normalizarLinhas(morada);
        return {
            linha1: linhas[0] || '',
            linha2: linhas[1] || ''
        };
    }

    function juntarMoradaEdicao(linha1, linha2) {
        return [linha1, linha2]
            .map((valor) => String(valor || '').trim())
            .filter(Boolean)
            .join('\n');
    }

    function criarBlocoMorada(linhas, criarElemento) {
        const bloco = criarElemento('div', 'morada-formatada');
        if (!linhas.length) {
            bloco.appendChild(criarElemento('span', 'morada-formatada-linha', '\u2014'));
            return bloco;
        }
        linhas.forEach((texto) => {
            bloco.appendChild(criarElemento('span', 'morada-formatada-linha', texto));
        });
        return bloco;
    }

    function criarCampoMoradaEdicao(criarElemento, valores = {}) {
        const { linha1 = '', linha2 = '' } = valores;
        const contentor = criarElemento('div', 'morada-edicao-linhas');

        [
            ['Morada (linha 1)', 'morada_linha1', linha1],
            ['Morada (linha 2)', 'morada_linha2', linha2]
        ].forEach(([rotulo, nome, valor]) => {
            const campo = document.createElement('label');
            campo.className = 'admin-cliente-formulario-campo admin-cliente-campo-morada-linha';
            campo.appendChild(criarElemento('span', '', rotulo));
            const input = document.createElement('input');
            input.type = 'text';
            input.name = nome;
            input.value = valor || '';
            input.autocomplete = 'off';
            campo.appendChild(input);
            contentor.appendChild(campo);
        });

        return contentor;
    }

    function obterMoradaFormulario(formulario) {
        if (!formulario) return '';
        const campos = new FormData(formulario);
        if (campos.has('morada_linha1') || campos.has('morada_linha2')) {
            return juntarMoradaEdicao(campos.get('morada_linha1'), campos.get('morada_linha2'));
        }
        return String(campos.get('morada') || '').trim();
    }

    global.MoradaFormato = {
        formatarLinhasMorada,
        formatarMoradaTexto,
        obterMoradaEdicao,
        juntarMoradaEdicao,
        criarBlocoMorada,
        criarCampoMoradaEdicao,
        obterMoradaFormulario
    };
})(typeof window !== 'undefined' ? window : globalThis);
