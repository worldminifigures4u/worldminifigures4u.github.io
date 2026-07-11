// Tabelas de portes usadas pelo carrinho.
const TABELA_PORTES_POR_PESO = {
    portugal: [
        { ate: 100, opcoes: [
            { id: 'entrega_tomar', nome: 'Entrega em m\u00e3o em Tomar', valor: 0 },
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 1.75 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 2.20 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 4.50 },
            { id: 'inpost_registado', nome: 'InPost Registado (com seguro de 25\u20ac)', valor: 4.95 }
        ]},
        { ate: 500, opcoes: [
            { id: 'entrega_tomar', nome: 'Entrega em m\u00e3o em Tomar', valor: 0 },
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 2.50 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 3.95 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 5.30 },
            { id: 'inpost_registado', nome: 'InPost Registado (com seguro de 25\u20ac)', valor: 4.95 }
        ]},
        { ate: Infinity, opcoes: [
            { id: 'entrega_tomar', nome: 'Entrega em m\u00e3o em Tomar', valor: 0 },
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 5.75 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 7.95 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 8.95 },
            { id: 'inpost_registado', nome: 'InPost Registado (com seguro de 25\u20ac)', valor: 5.65 }
        ]}
    ],
    espanha: [
        { ate: 100, opcoes: [
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 5.80 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 5.12 }
        ]},
        { ate: 250, opcoes: [
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 7.55 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 5.12 }
        ]},
        { ate: 500, opcoes: [
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 9.80 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 5.12 }
        ]},
        { ate: 1000, opcoes: [
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 13.20 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 5.81 }
        ]},
        { ate: Infinity, opcoes: [
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 21.20 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 6.64 }
        ]}
    ],
    europa: [
        { ate: 100, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 5.80 }] },
        { ate: 250, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 7.55 }] },
        { ate: 500, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 9.80 }] },
        { ate: 1000, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 13.20 }] },
        { ate: Infinity, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 21.20 }] }
    ]
};

const ZONA_PORTES_POR_PAIS = {
    portugal: 'portugal',
    espanha: 'espanha',
    alemanha: 'europa',
    austria: 'europa',
    belgica: 'europa',
    bulgaria: 'europa',
    chequia: 'europa',
    chipre: 'europa',
    croacia: 'europa',
    dinamarca: 'europa',
    eslovaquia: 'europa',
    eslovenia: 'europa',
    estonia: 'europa',
    finlandia: 'europa',
    franca: 'europa',
    grecia: 'europa',
    hungria: 'europa',
    irlanda: 'europa',
    italia: 'europa',
    letonia: 'europa',
    lituania: 'europa',
    luxemburgo: 'europa',
    malta: 'europa',
    paises_baixos: 'europa',
    polonia: 'europa',
    romenia: 'europa',
    suecia: 'europa'
};

function obterZonaPortesPorPais(paisEnvio) {
    return ZONA_PORTES_POR_PAIS[paisEnvio] || 'europa';
}

const LIMITE_SUBTOTAL_ENVIO_SEM_RASTREAMENTO = 15;
const METODOS_ENVIO_SEM_RASTREAMENTO = new Set(['ctt_normal', 'ctt_azul']);
const METODOS_ENVIO_REGISTADOS = new Set(['ctt_registado', 'inpost_registado']);
