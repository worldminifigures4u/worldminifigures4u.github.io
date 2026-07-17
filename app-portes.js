// Tabelas de portes usadas pelo carrinho (fallback local + carga remota com cache).
const PORTES_CACHE_KEY = 'figures-planet-portes-tarifas-v3';
const PORTES_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const PORTES_PESO_ABERTO_G = 999999;

const TABELA_PORTES_FALLBACK = {
    portugal: [
        { ate: 100, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 1.94 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 2.58 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 5.66 },
            { id: 'inpost_registado', nome: 'InPost Registado (com seguro de 25\u20ac)', valor: 5.85 }
        ]},
        { ate: 500, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 2.88 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 4.80 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 6.64 },
            { id: 'inpost_registado', nome: 'InPost Registado (com seguro de 25\u20ac)', valor: 5.85 }
        ]},
        { ate: 1000, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 6.83 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 9.59 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 10.98 },
            { id: 'inpost_registado', nome: 'InPost Registado (com seguro de 25\u20ac)', valor: 6.67 }
        ]},
        { ate: Infinity, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 6.83 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 9.59 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 10.98 },
            { id: 'inpost_registado', nome: 'InPost Registado (com seguro de 25\u20ac)', valor: 7.24 }
        ]}
    ],
    espanha: [
        { ate: 100, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 3.26 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 7.13 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 6.30 }
        ]},
        { ate: 250, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 5.23 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 9.29 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 6.30 }
        ]},
        { ate: 500, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 8.67 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 12.05 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 6.30 }
        ]},
        { ate: 1000, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 13.35 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 16.24 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 6.30 }
        ]},
        { ate: Infinity, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 22.72 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 26.08 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 7.15 }
        ]}
    ],
    europa: [
        { ate: 100, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 3.26 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 7.13 }
        ]},
        { ate: 250, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 5.23 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 9.29 }
        ]},
        { ate: 500, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 8.67 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 12.05 }
        ]},
        { ate: 1000, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 13.35 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 16.24 }
        ]},
        { ate: Infinity, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 22.72 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 26.08 }
        ]}
    ]
};

let TABELA_PORTES_POR_PESO = TABELA_PORTES_FALLBACK;

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

const LIMITE_SUBTOTAL_ENVIO_SEM_RASTREAMENTO = 15;
const METODOS_ENVIO_SEM_RASTREAMENTO = new Set(['ctt_normal', 'ctt_azul']);
const METODOS_ENVIO_REGISTADOS = new Set(['ctt_registado', 'inpost_registado']);

let promessaPortesRemotos = null;

function obterZonaPortesPorPais(paisEnvio) {
    return ZONA_PORTES_POR_PAIS[paisEnvio] || 'europa';
}

function pesoAteParaJs(pesoAteG) {
    const peso = Number(pesoAteG);
    if (!Number.isFinite(peso) || peso >= PORTES_PESO_ABERTO_G) return Infinity;
    return peso;
}

function montarTabelaPortesDeLinhas(linhas) {
    const tabela = { portugal: [], espanha: [], europa: [] };
    const porZonaPeso = new Map();

    (linhas || []).forEach((linha) => {
        if (!linha || linha.ativo === false) return;
        if (String(linha.metodo_id || '') === 'entrega_tomar') return;
        const zona = String(linha.zona || '');
        if (!tabela[zona]) return;
        const pesoAte = pesoAteParaJs(linha.peso_ate_g);
        const chave = zona + '|' + String(linha.peso_ate_g);
        if (!porZonaPeso.has(chave)) {
            const escalao = { ate: pesoAte, opcoes: [], _ordemPeso: Number(linha.peso_ate_g) || 0 };
            porZonaPeso.set(chave, escalao);
            tabela[zona].push(escalao);
        }
        porZonaPeso.get(chave).opcoes.push({
            id: String(linha.metodo_id || ''),
            nome: String(linha.nome_exibicao || linha.metodo_id || ''),
            valor: Math.round(Number(linha.preco || 0) * 100) / 100,
            _ordem: Number(linha.ordem || 0)
        });
    });

    Object.keys(tabela).forEach((zona) => {
        tabela[zona].sort((a, b) => a._ordemPeso - b._ordemPeso);
        tabela[zona].forEach((escalao) => {
            escalao.opcoes.sort((a, b) => a._ordem - b._ordem);
            escalao.opcoes.forEach((opcao) => {
                delete opcao._ordem;
            });
            delete escalao._ordemPeso;
        });
    });

    if (!tabela.portugal.length && !tabela.espanha.length && !tabela.europa.length) {
        return null;
    }
    return tabela;
}

function lerCachePortes() {
    try {
        const bruto = localStorage.getItem(PORTES_CACHE_KEY);
        if (!bruto) return null;
        const dados = JSON.parse(bruto);
        if (!dados || !dados.tabela || !dados.guardadoEm) return null;
        if (Date.now() - Number(dados.guardadoEm) > PORTES_CACHE_TTL_MS) return null;
        return dados.tabela;
    } catch (_) {
        return null;
    }
}

function guardarCachePortes(tabela) {
    try {
        localStorage.setItem(PORTES_CACHE_KEY, JSON.stringify({
            guardadoEm: Date.now(),
            tabela
        }));
    } catch (_) {
        /* ignore quota */
    }
}

function limparCachePortes() {
    try {
        localStorage.removeItem(PORTES_CACHE_KEY);
    } catch (_) {
        /* ignore */
    }
}

function aplicarTabelaPortes(tabela) {
    if (!tabela) return false;
    TABELA_PORTES_POR_PESO = tabela;
    return true;
}

async function obterClienteSupabasePortes() {
    if (typeof window.garantirDbClient === 'function') {
        return window.garantirDbClient();
    }
    if (typeof supabase === 'undefined' || typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined') {
        return null;
    }
    return supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function carregarTabelaPortesRemota(forcar = false) {
    if (!forcar) {
        const cache = lerCachePortes();
        if (cache && aplicarTabelaPortes(cache)) {
            return TABELA_PORTES_POR_PESO;
        }
    }

    const client = await obterClienteSupabasePortes();
    if (!client) return TABELA_PORTES_POR_PESO;

    const { data, error } = await client
        .from('portes_tarifas')
        .select('id, zona, peso_ate_g, metodo_id, nome_exibicao, preco, ativo, ordem, updated_at')
        .eq('ativo', true)
        .order('zona')
        .order('peso_ate_g')
        .order('ordem');

    if (error || !data || !data.length) {
        return TABELA_PORTES_POR_PESO;
    }

    const montada = montarTabelaPortesDeLinhas(data);
    if (montada && aplicarTabelaPortes(montada)) {
        guardarCachePortes(montada);
    }
    return TABELA_PORTES_POR_PESO;
}

function garantirTabelaPortesCarregada(forcar = false) {
    if (!forcar && promessaPortesRemotos) return promessaPortesRemotos;
    promessaPortesRemotos = carregarTabelaPortesRemota(forcar)
        .catch(() => TABELA_PORTES_POR_PESO)
        .finally(() => {
            if (forcar) promessaPortesRemotos = null;
        });
    return promessaPortesRemotos;
}

window.limparCachePortes = limparCachePortes;
window.garantirTabelaPortesCarregada = garantirTabelaPortesCarregada;
window.montarTabelaPortesDeLinhas = montarTabelaPortesDeLinhas;
