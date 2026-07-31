(function (global) {
    'use strict';

    const OPCOES_PAIS_CLIENTE = [
        { value: 'Portugal', label: 'Portugal' },
        { value: 'Espanha', label: 'Espanha' },
        { value: 'Alemanha', label: 'Alemanha' },
        { value: 'Áustria', label: 'Áustria' },
        { value: 'Bélgica', label: 'Bélgica' },
        { value: 'Bulgária', label: 'Bulgária' },
        { value: 'Chéquia', label: 'Chéquia' },
        { value: 'Chipre', label: 'Chipre' },
        { value: 'Croácia', label: 'Croácia' },
        { value: 'Dinamarca', label: 'Dinamarca' },
        { value: 'Eslováquia', label: 'Eslováquia' },
        { value: 'Eslovénia', label: 'Eslovénia' },
        { value: 'Estónia', label: 'Estónia' },
        { value: 'Finlândia', label: 'Finlândia' },
        { value: 'França', label: 'França' },
        { value: 'Grécia', label: 'Grécia' },
        { value: 'Hungria', label: 'Hungria' },
        { value: 'Irlanda', label: 'Irlanda' },
        { value: 'Itália', label: 'Itália' },
        { value: 'Letónia', label: 'Letónia' },
        { value: 'Lituânia', label: 'Lituânia' },
        { value: 'Luxemburgo', label: 'Luxemburgo' },
        { value: 'Malta', label: 'Malta' },
        { value: 'Países Baixos', label: 'Países Baixos' },
        { value: 'Polónia', label: 'Polónia' },
        { value: 'Roménia', label: 'Roménia' },
        { value: 'Suécia', label: 'Suécia' }
    ];

    const PAIS_POR_PLATAFORMA = {
        Wallapop: 'Espanha',
        OLX: 'Portugal',
        Vinted: 'França',
        Todocoleccion: 'Espanha'
    };

    const ALIAS_PAIS_CLIENTE = {
        pt: 'Portugal',
        portugal: 'Portugal',
        es: 'Espanha',
        espanha: 'Espanha',
        espana: 'Espanha',
        spain: 'Espanha',
        de: 'Alemanha',
        alemanha: 'Alemanha',
        germany: 'Alemanha',
        deutschland: 'Alemanha',
        at: 'Áustria',
        austria: 'Áustria',
        be: 'Bélgica',
        belgica: 'Bélgica',
        belgium: 'Bélgica',
        bg: 'Bulgária',
        bulgaria: 'Bulgária',
        cz: 'Chéquia',
        chequia: 'Chéquia',
        czechia: 'Chéquia',
        'czech republic': 'Chéquia',
        cy: 'Chipre',
        chipre: 'Chipre',
        cyprus: 'Chipre',
        hr: 'Croácia',
        croacia: 'Croácia',
        croatia: 'Croácia',
        dk: 'Dinamarca',
        dinamarca: 'Dinamarca',
        denmark: 'Dinamarca',
        sk: 'Eslováquia',
        eslovaquia: 'Eslováquia',
        slovakia: 'Eslováquia',
        si: 'Eslovénia',
        eslovenia: 'Eslovénia',
        slovenia: 'Eslovénia',
        ee: 'Estónia',
        estonia: 'Estónia',
        fi: 'Finlândia',
        finlandia: 'Finlândia',
        finland: 'Finlândia',
        fr: 'França',
        franca: 'França',
        france: 'França',
        gr: 'Grécia',
        grecia: 'Grécia',
        greece: 'Grécia',
        hu: 'Hungria',
        hungria: 'Hungria',
        hungary: 'Hungria',
        ie: 'Irlanda',
        irlanda: 'Irlanda',
        ireland: 'Irlanda',
        it: 'Itália',
        italia: 'Itália',
        italy: 'Itália',
        lv: 'Letónia',
        letonia: 'Letónia',
        latvia: 'Letónia',
        lt: 'Lituânia',
        lituania: 'Lituânia',
        lithuania: 'Lituânia',
        lu: 'Luxemburgo',
        luxemburgo: 'Luxemburgo',
        luxembourg: 'Luxemburgo',
        mt: 'Malta',
        malta: 'Malta',
        nl: 'Países Baixos',
        'paises baixos': 'Países Baixos',
        paises_baixos: 'Países Baixos',
        netherlands: 'Países Baixos',
        holland: 'Países Baixos',
        pl: 'Polónia',
        polonia: 'Polónia',
        poland: 'Polónia',
        ro: 'Roménia',
        romenia: 'Roménia',
        romania: 'Roménia',
        se: 'Suécia',
        suecia: 'Suécia',
        sweden: 'Suécia'
    };

    function normalizarTextoPaisCliente(valor) {
        return String(valor || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    function normalizarPaisParaOpcao(texto) {
        const alvo = normalizarTextoPaisCliente(texto);
        if (!alvo) return '';
        const alias = ALIAS_PAIS_CLIENTE[alvo] || ALIAS_PAIS_CLIENTE[alvo.replace(/\s+/g, '_')];
        if (alias) return alias;
        const opcao = OPCOES_PAIS_CLIENTE.find((item) => (
            normalizarTextoPaisCliente(item.value) === alvo
            || normalizarTextoPaisCliente(item.label) === alvo
        ));
        return opcao?.value || '';
    }

    function detetarPlataformaUrl(valor) {
        const texto = String(valor || '').trim();
        if (!texto) return null;
        let url;
        try {
            url = new URL(texto);
        } catch (_) {
            return null;
        }
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        const host = url.hostname.toLowerCase().replace(/^www\./, '');
        const dominioValido = (dominio) => host === dominio || host.endsWith(`.${dominio}`);
        if (dominioValido('wallapop.com')) return 'Wallapop';
        if (/^vinted\.[a-z.]+$/i.test(host)) return 'Vinted';
        if (dominioValido('olx.pt')) return 'OLX';
        if (dominioValido('todocoleccion.net')) return 'Todocoleccion';
        return null;
    }

    function paisPredefinidoPlataforma(plataforma) {
        return PAIS_POR_PLATAFORMA[plataforma] || '';
    }

    function criarSelectPaisCliente(criarElemento, valorAtual, nome = 'pais') {
        const campo = document.createElement('label');
        campo.className = 'admin-cliente-formulario-campo';
        campo.classList.add(`admin-cliente-campo-${nome}`);
        campo.appendChild(criarElemento('span', '', 'País'));

        const select = document.createElement('select');
        select.name = nome;
        select.autocomplete = 'country-name';

        const valorNormalizado = normalizarPaisParaOpcao(valorAtual);
        const valorFinal = valorNormalizado || (String(valorAtual || '').trim() ? String(valorAtual).trim() : 'Portugal');

        OPCOES_PAIS_CLIENTE.forEach((opcao) => {
            const option = document.createElement('option');
            option.value = opcao.value;
            option.textContent = opcao.label;
            select.appendChild(option);
        });

        if (valorFinal && ![...select.options].some((opcao) => opcao.value === valorFinal)) {
            const extra = document.createElement('option');
            extra.value = valorFinal;
            extra.textContent = valorFinal;
            select.appendChild(extra);
        }

        select.value = valorFinal;
        campo.appendChild(select);
        return campo;
    }

    function aplicarPaisPredefinidoNoFormulario(formulario, plataforma) {
        const paisDefault = paisPredefinidoPlataforma(plataforma);
        if (!paisDefault || !formulario) return;
        const select = formulario.querySelector('select[name="pais"]');
        if (!select) return;
        if (![...select.options].some((opcao) => opcao.value === paisDefault)) {
            const extra = document.createElement('option');
            extra.value = paisDefault;
            extra.textContent = paisDefault;
            select.appendChild(extra);
        }
        select.value = paisDefault;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function ligarPerfisAoPaisCliente(formulario) {
        if (!formulario || formulario.dataset.paisesClienteLigados === '1') return;
        formulario.dataset.paisesClienteLigados = '1';

        const aoAlterarLink = (evento) => {
            const input = evento.target;
            if (!input || !/^perfil_url_\d+$/.test(input.name || '')) return;
            const plataforma = detetarPlataformaUrl(input.value);
            if (!plataforma) return;
            aplicarPaisPredefinidoNoFormulario(formulario, plataforma);
        };

        formulario.addEventListener('change', aoAlterarLink);
        formulario.addEventListener('blur', aoAlterarLink, true);
    }

    global.PaisesCliente = {
        OPCOES: OPCOES_PAIS_CLIENTE,
        PAIS_POR_PLATAFORMA,
        detetarPlataformaUrl,
        paisPredefinidoPlataforma,
        normalizarPaisParaOpcao,
        criarSelectPaisCliente,
        aplicarPaisPredefinidoNoFormulario,
        ligarPerfisAoPaisCliente
    };
}(window));
