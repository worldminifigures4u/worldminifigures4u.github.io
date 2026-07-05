const SUPABASE_URL = "https://gksndzxadndrsynvzgzb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrc25kenhhZG5kcnN5bnZ6Z3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc5NzMsImV4cCI6MjA5NDY2Mzk3M30.EHZgacYr27dqoc4CJHsOwkNnJFGlLIteSHBi4B1HfVE";
const URL_PUBLICO_FALLBACK = "https://figuresplanet.com/";
const ADMIN_EMAILS = ["worldminifigures4u@gmail.com"];
const PESO_PADRAO_PRODUTO_GRAMAS = 10;
const TABELA_PORTES_POR_PESO = {
    portugal: [
        { ate: 100, opcoes: [
            { id: 'entrega_tomar', nome: 'Entrega em Tomar (Portugal)', valor: 0 },
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 1.75 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 2.20 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 4.50 },
            { id: 'inpost_registado', nome: 'InPost Registado (com seguro de 25\u20ac)', valor: 4.95 }
        ]},
        { ate: 500, opcoes: [
            { id: 'entrega_tomar', nome: 'Entrega em Tomar (Portugal)', valor: 0 },
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 2.50 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 3.95 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 5.30 },
            { id: 'inpost_registado', nome: 'InPost Registado (com seguro de 25\u20ac)', valor: 4.95 }
        ]},
        { ate: Infinity, opcoes: [
            { id: 'entrega_tomar', nome: 'Entrega em Tomar (Portugal)', valor: 0 },
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

let dbClient = null;
let produtosClient = null;
let todosOsProdutos = [];
let catalogoAdminCarregado = false;
let carrinho = carregarCarrinhoLocal();
let favoritosProdutos = new Set(carregarFavoritosLocal());
let favoritosChaveAtual = 'figures-planet-favoritos';
let filtroTemaAtual = 'todos';
let emRecuperacaoPassword = false;
function obterUrlPublicoAtual() {
    if (window.location.protocol === 'file:') {
        return URL_PUBLICO_FALLBACK;
    }
    return new URL('.', window.location.href).href;
}

function obterParametrosAuthUrl() {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
    const hashParams = new URLSearchParams(hash);

    hashParams.forEach((valor, chave) => {
        if(!params.has(chave)) params.set(chave, valor);
    });

    return params;
}

function urlTemRecuperacaoPassword() {
    const params = obterParametrosAuthUrl();
    return params.get('type') === 'recovery' || params.has('code') || params.has('access_token');
}

async function prepararRecuperacaoPassword() {
    emRecuperacaoPassword = true;
    mostrarVista('conta', false);
    const params = obterParametrosAuthUrl();
    const code = params.get('code');

    if(code) {
        const { error } = await dbClient.auth.exchangeCodeForSession(code);
        if(error) {
            mostrarMensagem(
                document.getElementById('status-cliente'),
                'Erro ao validar o link de recuperação. Peça um novo link no Supabase.',
                'msg-erro'
            );
            console.error('Erro recovery code:', error);
            return;
        }
    }

    mostrarFormularioRecuperacaoPassword();
}

function carregarCarrinhoLocal() {
    try {
        const guardado = JSON.parse(localStorage.getItem('carrinho')) || [];
        if(!Array.isArray(guardado)) return [];
        return guardado
            .filter(item => item && item.id !== undefined && item.nome)
            .map(item => ({
                id: item.id,
                nome: String(item.nome),
                preco: Number(item.preco || 0),
                peso: Number(item.peso || PESO_PADRAO_PRODUTO_GRAMAS),
                imagem: String(item.imagem || ''),
                quantidade: Math.max(1, Number(item.quantidade || 1))
            }));
    } catch(e) {
        localStorage.removeItem('carrinho');
        return [];
    }
}

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

function carregarFavoritosUtilizador(userId = '') {
    favoritosChaveAtual = obterChaveFavoritos(userId);
    const favoritosConta = carregarFavoritosLocal(favoritosChaveAtual);
    const favoritosAnonimos = userId ? carregarFavoritosLocal(obterChaveFavoritos()) : [];
    favoritosProdutos = new Set([...favoritosConta, ...favoritosAnonimos]);
    if (userId && favoritosAnonimos.length) guardarFavoritosLocal();
    atualizarBotoesFavoritos();
    if (typeof renderizarFavoritosCliente === 'function') renderizarFavoritosCliente();
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
    if (typeof renderizarFavoritosCliente === 'function') renderizarFavoritosCliente();
    return !ativo;
}

function removerFavoritoProduto(id) {
    const chave = normalizarIdFavorito(id);
    if (!chave || !favoritosProdutos.has(chave)) return;
    favoritosProdutos.delete(chave);
    guardarFavoritosLocal();
    atualizarBotoesFavoritos();
    if (typeof renderizarFavoritosCliente === 'function') renderizarFavoritosCliente();
}

function obterProdutoPorIdLocal(id) {
    const chave = normalizarIdFavorito(id);
    return (todosOsProdutos || []).find(produto => normalizarIdFavorito(produto.id) === chave) || null;
}

const NOME_CONTA_CABECALHO_KEY = 'figures-planet-conta-primeiro-nome';

function atualizarCabecalhoCliente(nome = '') {
    const nomeEl = document.getElementById('nome-login-cabecalho');
    if (!nomeEl) return;

    const nomeLimpo = String(nome || '').trim();
    const primeiroNome = nomeLimpo.split(/\s+/)[0] || '';
    if (primeiroNome) {
        localStorage.setItem(NOME_CONTA_CABECALHO_KEY, primeiroNome);
    } else {
        localStorage.removeItem(NOME_CONTA_CABECALHO_KEY);
    }
    nomeEl.textContent = primeiroNome;
    nomeEl.classList.toggle('oculto', !primeiroNome);
}

function atualizarContadorCarrinhoCabecalho() {
    const contador = document.getElementById('contador-carrinho-cabecalho');
    if (!contador) return;

    const totalItens = carrinho.reduce((total, item) => total + Number(item.quantidade || 0), 0);
    contador.textContent = totalItens;
}

function existeAreaClientePagina() {
    return !!document.getElementById('painel-cliente');
}

function mostrarContaAnonimaSeExistir() {
    const autenticado = document.getElementById('conteudo-cliente-autenticado');
    const anonimo = document.getElementById('conteudo-cliente-anonimo');
    if (autenticado) autenticado.classList.add('oculto');
    if (anonimo) anonimo.classList.remove('oculto');
}

const PAGINAS_VISTA = {
    loja: 'index.html',
    favoritos: 'favoritos.html',
    conta: 'conta.html',
    carrinho: 'carrinho.html',
    sobre: 'sobre.html',
    contactos: 'contactos.html',
    politicas: 'politicas.html'
};

function obterVistaPagina() {
    const pagina = String(document.body?.dataset?.page || 'loja').toLowerCase();
    return Object.hasOwn(PAGINAS_VISTA, pagina) ? pagina : 'loja';
}

function obterVistaHash() {
    const hash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
    return Object.hasOwn(PAGINAS_VISTA, hash) ? hash : '';
}

function paginaPrecisaProdutosLoja() {
    return obterVistaPagina() === 'loja';
}

function paginaPrecisaCatalogoAdmin() {
    return document.body?.classList?.contains('pagina-gestao') || obterVistaPagina() === 'gestao';
}

function mostrarVista(vista, navegar = true) {
    const destino = Object.hasOwn(PAGINAS_VISTA, vista) ? vista : 'loja';
    const paginaAtual = obterVistaPagina();

    if (navegar && destino !== paginaAtual) {
        window.location.href = PAGINAS_VISTA[destino];
        return;
    }

    document.querySelectorAll('.vista').forEach(secao => {
        secao.classList.toggle('ativa', secao.id === 'vista-' + destino);
    });
    document.querySelectorAll('[data-vista-nav]').forEach(botao => {
        botao.classList.toggle('ativa', botao.dataset.vistaNav === destino);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function irParaPainelCliente() {
    mostrarVista('conta');
}

function irParaCarrinho() {
    mostrarVista('carrinho');
}

function pesquisarNoCabecalho() {
    if (obterVistaPagina() !== 'loja') {
        return;
    }
    if(typeof executarFiltrosCombinados === 'function') executarFiltrosCombinados();
}

function aplicarPesquisaUrl() {
    if (obterVistaPagina() !== 'loja') return;
    const pesquisa = new URLSearchParams(window.location.search).get('q') || '';
    const campo = document.getElementById('campo-pesquisa');
    if (campo && pesquisa) {
        campo.value = pesquisa;
        if(typeof executarFiltrosCombinados === 'function') executarFiltrosCombinados();
    }
}

let frameAtualizacaoStickyTemas = null;
let observadorTamanhoMenuTemas = null;
let folhaDinamicaTemas = null;

function definirCssDinamicoTemas(cssTexto) {
    try {
        if (!('adoptedStyleSheets' in document) || typeof CSSStyleSheet === 'undefined') return;
        if (!folhaDinamicaTemas) {
            folhaDinamicaTemas = new CSSStyleSheet();
            document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets || []).concat(folhaDinamicaTemas);
        }
        if (typeof folhaDinamicaTemas.replaceSync === 'function') {
            folhaDinamicaTemas.replaceSync(cssTexto || '');
        }
    } catch (error) {
        console.warn('CSS dinâmico ignorado:', error);
    }
}

function atualizarStickyTemas() {
    const coluna = document.querySelector('.coluna-esquerda');
    const menu = document.getElementById('menu-lateral-temas');
    const header = document.querySelector('header');
    if (!coluna || !menu) return;

    if (window.matchMedia && window.matchMedia('(max-width: 1100px)').matches) {
        definirCssDinamicoTemas('');
        return;
    }

    const margem = 20;
    const headerBottom = header ? header.getBoundingClientRect().bottom : 76;
    const topoNormal = Math.ceil(headerBottom + margem);
    const alturaMenu = Math.ceil(menu.offsetHeight);
    const topoComFundoVisivel = Math.floor(window.innerHeight - alturaMenu - margem);
    const stickyTop = Math.min(topoNormal, topoComFundoVisivel);

    definirCssDinamicoTemas(`.coluna-esquerda { --temas-sticky-top: ${stickyTop}px; }`);
}

function agendarAtualizacaoStickyTemas() {
    if(frameAtualizacaoStickyTemas !== null) {
        cancelAnimationFrame(frameAtualizacaoStickyTemas);
    }

    frameAtualizacaoStickyTemas = requestAnimationFrame(() => {
        frameAtualizacaoStickyTemas = null;
        atualizarStickyTemas();
    });
}

function observarTamanhoMenuTemas() {
    const menu = document.getElementById('menu-lateral-temas');
    if(!menu || typeof ResizeObserver === 'undefined') return;

    if(observadorTamanhoMenuTemas) {
        observadorTamanhoMenuTemas.disconnect();
    }

    observadorTamanhoMenuTemas = new ResizeObserver(() => {
        agendarAtualizacaoStickyTemas();
    });
    observadorTamanhoMenuTemas.observe(menu);
}

window.addEventListener('hashchange', () => {
    const vistaHash = obterVistaHash();
    if (vistaHash) mostrarVista(vistaHash);
});
window.addEventListener('resize', agendarAtualizacaoStickyTemas);
window.visualViewport?.addEventListener('resize', agendarAtualizacaoStickyTemas);
window.addEventListener('load', async () => {
    const vistaHash = obterVistaHash();
    if (vistaHash && vistaHash !== obterVistaPagina() && !urlTemRecuperacaoPassword()) {
        window.location.replace(PAGINAS_VISTA[vistaHash]);
        return;
    }
    mostrarVista(obterVistaPagina(), false);
    observarTamanhoMenuTemas();
    agendarAtualizacaoStickyTemas();
    document.fonts?.ready.then(agendarAtualizacaoStickyTemas);
    atualizarCarrinho();
    if(typeof supabase !== 'undefined'){
        dbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        produtosClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
                storageKey: 'world-minifigures-produtos-publicos'
            }
        });
        dbClient.auth.onAuthStateChange((event, session) => {
            setTimeout(async () => {
                if (event === 'PASSWORD_RECOVERY') {
                    emRecuperacaoPassword = true;
                    mostrarFormularioRecuperacaoPassword();
                    return;
                }

                if (emRecuperacaoPassword) {
                    mostrarFormularioRecuperacaoPassword();
                    return;
                }

                if (session?.user) {
                    if (session.user.email_confirmed_at === null) {
                        await dbClient.auth.signOut();
                        return;
                    }
                    await obterDadosPerfilDaTabela(session.user.id, session.user);
                } else {
                    atualizarVisibilidadeAdmin(null);
                    mostrarContaAnonimaSeExistir();
                    atualizarCabecalhoCliente();
                    carregarFavoritosUtilizador();
                }
            }, 0);
        });
        if (paginaPrecisaProdutosLoja()) {
            await carregarProdutosDaNuvem();
            aplicarPesquisaUrl();
        }
        if(urlTemRecuperacaoPassword()) {
            await prepararRecuperacaoPassword();
            return;
        }
        mostrarVista(obterVistaPagina(), false);
        await verificarSessaoSupabase();
    } else {
        definirEstadoVitrine('Erro: biblioteca Supabase não carregou. Verifique a ligação à internet.', 'erro');
    }
});

async function obterDadosPerfilDaTabela(userId, user = null) {
    try {
        const { data, error } = await dbClient
            .from('clientes')
            .select('*')
            .eq('id', userId)
            .single();

        if (!existeAreaClientePagina()) {
            atualizarCabecalhoCliente(data?.nome || user?.user_metadata?.nome || '');
            atualizarVisibilidadeAdmin(user);
            carregarFavoritosUtilizador(userId);
            restaurarCarrinhoGuardado();
            return;
        }

        if (error) {
            const anonimo = document.getElementById('conteudo-cliente-anonimo');
            const autenticado = document.getElementById('conteudo-cliente-autenticado');
            if (anonimo) anonimo.classList.add('oculto');
            if (autenticado) autenticado.classList.remove('oculto');
            if(typeof preencherFormularioDadosCliente === 'function') preencherFormularioDadosCliente({}, user);
            atualizarVisibilidadeAdmin(user);
            carregarFavoritosUtilizador(userId);
            restaurarCarrinhoGuardado();
            if(typeof carregarHistoricoEncomendas === 'function') carregarHistoricoEncomendas(userId);
            return;
        }

        if (data) {
            const anonimo = document.getElementById('conteudo-cliente-anonimo');
            const autenticado = document.getElementById('conteudo-cliente-autenticado');
            if (anonimo) anonimo.classList.add('oculto');
            if (autenticado) autenticado.classList.remove('oculto');
            if(typeof preencherFormularioDadosCliente === 'function') preencherFormularioDadosCliente(data, user);
            atualizarVisibilidadeAdmin(user);
            carregarFavoritosUtilizador(userId);
            restaurarCarrinhoGuardado();
            if(typeof carregarHistoricoEncomendas === 'function') carregarHistoricoEncomendas(userId);
        }
    } catch (e) {
        console.error(e);
    }
}

async function verificarSessaoSupabase() {
    const { data: { session } } = await dbClient.auth.getSession();
    if (session && session.user) {
        if (session.user.email_confirmed_at === null) {
            await dbClient.auth.signOut();
            return;
        }
        obterDadosPerfilDaTabela(session.user.id, session.user);
    }
}

function formatarEuro(valor){ return Number(valor || 0).toFixed(2).replace('.', ','); }

function normalizarTextoSku(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
}

function obterPalavrasSku(nomeProduto) {
    const palavrasIgnoradas = new Set(['A', 'O', 'OS', 'AS', 'E', 'DE', 'DA', 'DO', 'DAS', 'DOS', 'THE', 'OF', 'AND']);
    return normalizarTextoSku(nomeProduto)
        .replace(/[^A-Z0-9\s-]/g, ' ')
        .split(/[\s-]+/)
        .map(palavra => palavra.trim())
        .filter(palavra =>
            palavra.length > 0 &&
            !palavrasIgnoradas.has(palavra) &&
            !/^V\d+$/i.test(palavra) &&
            /[A-Z]/.test(palavra)
        );
}

function gerarPrefixoSku(nomeProduto) {
    const palavras = obterPalavrasSku(nomeProduto);
    if (palavras.length >= 2) {
        return (palavras[0][0] + palavras[1][0]).toUpperCase();
    }
    if (palavras.length === 1) {
        return palavras[0].slice(0, 2).padEnd(2, 'X').toUpperCase();
    }
    return 'PR';
}

function gerarSkuProduto(nomeProduto, produtosExistentes = todosOsProdutos) {
    const prefixo = gerarPrefixoSku(nomeProduto);
    const numerosUsados = (produtosExistentes || [])
        .map(produto => String(produto.sku || '').toUpperCase())
        .filter(sku => sku.startsWith(prefixo))
        .map(sku => Number(sku.slice(prefixo.length)))
        .filter(numero => Number.isInteger(numero) && numero > 0);

    const proximoNumero = numerosUsados.length > 0 ? Math.max(...numerosUsados) + 1 : 1;
    return prefixo + String(proximoNumero).padStart(2, '0');
}

window.gerarSkuProduto = gerarSkuProduto;

const FORNECEDORES_STORAGE_KEY = "figures-planet-fornecedores-pedidos";
const FORNECEDORES_FICHAS_KEY = "figures-planet-fornecedores-fichas";

function utilizadorAdmin(user) {
    const email = String(user?.email || '').toLowerCase();
    return ADMIN_EMAILS.includes(email);
}

function atualizarVisibilidadeAdmin(user) {
    const painel = document.getElementById('painel-admin');
    const adminAtivo = utilizadorAdmin(user);
    const atalhosAdmin = document.querySelectorAll('.acao-gestao-admin, .acao-plataforma-admin, .acao-anuncio-admin, .acao-mapas-admin, .acao-fornecedores-admin, .acao-encomendas-admin, .acao-estatisticas-admin, .acao-clientes-admin');
    atalhosAdmin.forEach(atalho => { atalho.hidden = !adminAtivo; });
    const navegacaoAdmin = document.querySelector('.navegacao-admin-cabecalho');
    if (navegacaoAdmin) navegacaoAdmin.hidden = !adminAtivo;
    document.body.classList.toggle('cabecalho-com-admin', adminAtivo);
    if (adminAtivo) {
        if (typeof window.atualizarCabecalhoAdmin === 'function') {
            window.atualizarCabecalhoAdmin();
        } else {
            const nomeEl = document.getElementById('nome-login-cabecalho');
            if (nomeEl) {
                nomeEl.textContent = 'Admin';
                nomeEl.classList.remove('oculto');
            }
        }
    }
    if (typeof window.sincronizarEspacamentoCabecalho === 'function') {
        requestAnimationFrame(() => window.sincronizarEspacamentoCabecalho());
    }
    const bloqueioGestao = document.getElementById('gestao-bloqueio');
    if (bloqueioGestao) {
        bloqueioGestao.hidden = adminAtivo;
        bloqueioGestao.textContent = adminAtivo ? '' : 'Acesso reservado ao administrador.';
    }
    if(!painel) return;
    const zonaEliminacao = document.getElementById('zona-eliminacao-conta');
    if(adminAtivo) {
        const autenticado = document.getElementById('conteudo-cliente-autenticado');
        const anonimo = document.getElementById('conteudo-cliente-anonimo');
        if(autenticado) autenticado.classList.remove('oculto');
        if(anonimo) anonimo.classList.add('oculto');
    }
    painel.classList.toggle('oculto', !adminAtivo);
    if(zonaEliminacao) zonaEliminacao.classList.toggle('oculto', adminAtivo);
    if(adminAtivo) {
        if(painel.querySelector('.gestao-tabs')) {
            carregarCatalogoAdminQuandoDisponivel();
            return;
        }

        const conteudoConta = document.getElementById('conteudo-cliente-autenticado');
        const dadosPessoais = document.getElementById('form-editar-dados-cliente')?.closest('.historico-encomendas');
        const gestaoProdutos = painel.querySelector('.admin-seccao');
        const tituloAdicionarProduto = painel.querySelector(':scope > h3');
        const formularioAdicionarProduto = document.getElementById('form-admin-produto');

        if(conteudoConta && dadosPessoais) {
            conteudoConta.insertBefore(painel, dadosPessoais);
        }

        if(gestaoProdutos && tituloAdicionarProduto && formularioAdicionarProduto) {
            const primeiraSeccaoAposProdutos = gestaoProdutos.querySelector(':scope > .admin-seccao');
            tituloAdicionarProduto.textContent = 'Adicionar produto';
            tituloAdicionarProduto.classList.add('admin-adicionar-produto-titulo');
            formularioAdicionarProduto.classList.add('admin-adicionar-produto-formulario');
            gestaoProdutos.insertBefore(tituloAdicionarProduto, primeiraSeccaoAposProdutos);
            gestaoProdutos.insertBefore(formularioAdicionarProduto, primeiraSeccaoAposProdutos);
        }
        carregarCatalogoAdminQuandoDisponivel();
    } else {
        catalogoAdminCarregado = false;
        if(typeof cancelarEdicaoProdutoAdmin === 'function') cancelarEdicaoProdutoAdmin();
    }
}

function carregarCatalogoAdminQuandoDisponivel(tentativas = 0) {
    if(!paginaPrecisaCatalogoAdmin()) return;
    if(typeof carregarProdutosAdminDaNuvem === 'function') {
        carregarProdutosAdminDaNuvem().catch(error => {
            console.error('Erro ao carregar catalogo administrativo:', error);
        });
        return;
    }
    if(tentativas < 40) {
        setTimeout(() => carregarCatalogoAdminQuandoDisponivel(tentativas + 1), 50);
    }
}

function mostrarMensagem(elemento, mensagem, tipo = '') {
    elemento.className = tipo ? `msg-status ${tipo}` : 'msg-status';
    elemento.replaceChildren();
    mensagem.split('\n').forEach((linha, index) => {
        if(index > 0) elemento.appendChild(document.createElement('br'));
        elemento.appendChild(document.createTextNode(linha));
    });
}

function definirHtmlSeguro(elemento, partes) {
    elemento.replaceChildren();
    partes.forEach(parte => {
        if (typeof parte === 'string') {
            elemento.appendChild(document.createTextNode(parte));
            return;
        }
        if (parte.br) {
            elemento.appendChild(document.createElement('br'));
            return;
        }
        if (parte.strong) {
            const strong = document.createElement('strong');
            strong.textContent = parte.strong;
            elemento.appendChild(strong);
        }
    });
}

function obterMetodoPagamentoSelecionado() {
    const radioSelecionado = document.querySelector('input[name="metodo-pagamento"]:checked');
    return radioSelecionado ? radioSelecionado.value : 'Não especificado';
}

function mensagemSucessoEncomenda(metodoPagamento, codigoEncomenda = '') {
    const referencia = codigoEncomenda ? `\nReferência da encomenda: ${codigoEncomenda}` : '';
    return `Encomenda registada com sucesso!${referencia}\nEnviámos um e-mail com os dados para pagamento.`;
}

function definirEstadoVitrine(mensagem, tipo = ''){
    const vitrine = document.getElementById('vitrine-produtos');
    if (!vitrine) return;
    vitrine.replaceChildren();
    const estado = document.createElement('div');
    estado.className = `estado-vitrine ${tipo}`.trim();
    estado.textContent = mensagem;
    vitrine.appendChild(estado);
}

function executarComTimeout(promessa, ms, mensagemErro){
    let timeout;
    const timeoutPromise = new Promise((_, reject) => { timeout = setTimeout(() => { reject(new Error(mensagemErro)); }, ms); });
    return Promise.race([promessa, timeoutPromise]).finally(() => clearTimeout(timeout));
}

function otimizarImagemCloudinary(url, largura = 700) {
    const urlOriginal = String(url || '').trim();
    if(!urlOriginal || !urlOriginal.includes('res.cloudinary.com/') || !urlOriginal.includes('/image/upload/')) {
        return urlOriginal;
    }

    const larguraSegura = Math.max(80, Math.min(1600, Math.round(Number(largura) || 700)));
    return urlOriginal.replace(
        '/image/upload/',
        `/image/upload/f_auto,q_auto,w_${larguraSegura},c_limit/`
    );
}

const imagensProdutoPrecarregadas = new Set();

function precarregarImagemProduto(url) {
    const src = String(url || '').trim();
    if (!src || imagensProdutoPrecarregadas.has(src)) return;

    imagensProdutoPrecarregadas.add(src);
    const imagem = new Image();
    imagem.decoding = 'async';
    imagem.src = src;
}

function obterImagemPrincipalProduto(prod = {}) {
    let listaImagens = [];

    if (prod.imagens) {
        if (Array.isArray(prod.imagens)) {
            listaImagens = prod.imagens;
        } else if (typeof prod.imagens === 'string') {
            const textoLimpo = prod.imagens.trim();
            if (textoLimpo.startsWith('[') && textoLimpo.endsWith(']')) {
                try {
                    listaImagens = JSON.parse(textoLimpo);
                } catch(e) {
                    listaImagens = textoLimpo.replace(/[\[\]"]/g, '').split(',').map(s => s.trim());
                }
            } else {
                listaImagens = [textoLimpo];
            }
        }
    }

    listaImagens = listaImagens.filter(url => url && typeof url === 'string' && url.trim() !== "");
    return listaImagens.length > 0 ? listaImagens[0] : 'img/sem-imagem.png';
}

function obterImagemAtualCarrinho(item, produtoCompleto) {
    const imagemAtual = produtoCompleto
        ? obterImagemPrincipalProduto(produtoCompleto)
        : '';

    if(imagemAtual && imagemAtual !== 'img/sem-imagem.png') {
        return imagemAtual;
    }

    return item?.imagem || 'img/sem-imagem.png';
}

async function carregarProdutosConformeUtilizador(){
    if (!paginaPrecisaProdutosLoja() && !paginaPrecisaCatalogoAdmin()) {
        return;
    }
    const { data:{ user } } = await dbClient.auth.getUser();
    if(utilizadorAdmin(user) && paginaPrecisaCatalogoAdmin() && typeof carregarProdutosAdminDaNuvem === 'function') {
        await carregarProdutosAdminDaNuvem();
        return;
    }
    await carregarProdutosDaNuvem();
}
