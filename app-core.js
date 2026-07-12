let dbClient = null;
let produtosClient = null;
let todosOsProdutos = [];
let catalogoAdminCarregado = false;
let carrinho = carregarCarrinhoLocal();
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

function obterProdutoPorIdLocal(id) {
    const chave = normalizarIdFavorito(id);
    return (todosOsProdutos || []).find(produto => normalizarIdFavorito(produto.id) === chave) || null;
}

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

function atualizarCarrinhoSeDisponivel() {
    if (typeof atualizarCarrinho === 'function') {
        atualizarCarrinho();
        return;
    }
    atualizarContadorCarrinhoCabecalho();
}

function restaurarCarrinhoSeDisponivel() {
    if (typeof restaurarCarrinhoGuardado === 'function') {
        restaurarCarrinhoGuardado();
        return;
    }
    atualizarContadorCarrinhoCabecalho();
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
        const destinoContaEmGestao = document.body.classList.contains('pagina-gestao')
            && botao.dataset.vistaNav === 'conta';
        botao.classList.toggle('ativa', !destinoContaEmGestao && botao.dataset.vistaNav === destino);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function irParaPainelCliente() {
    mostrarVista('conta');
}

function irParaCarrinho() {
    mostrarVista('carrinho');
}


async function aguardarModulosLoja() {
    if (!paginaPrecisaProdutosLoja() && !document.getElementById('vitrine-produtos')) return;
    if (typeof carregarProdutosDaNuvem === 'function' && typeof inicializarPaginaLoja === 'function') return;
    if (typeof window.garantirModulosLoja === 'function') {
        await window.garantirModulosLoja();
    }
}

async function aguardarAppFavoritosSeNecessario() {
    const paginaLoja = document.body?.dataset?.page === 'loja' || !!document.getElementById('vitrine-produtos');
    const paginaFavoritos = document.body?.dataset?.page === 'favoritos';
    if (!paginaLoja && !paginaFavoritos) return;
    if (typeof carregarFavoritosUtilizador === 'function') return;
    if (typeof window.garantirAppFavoritos === 'function') {
        await window.garantirAppFavoritos();
    }
}

window.addEventListener('load', async () => {
    const vistaHash = obterVistaHash();
    if (vistaHash && vistaHash !== obterVistaPagina() && !urlTemRecuperacaoPassword()) {
        window.location.replace(PAGINAS_VISTA[vistaHash]);
        return;
    }
    mostrarVista(obterVistaPagina(), false);
    if (paginaPrecisaProdutosLoja()) {
        await aguardarModulosLoja();
        if (typeof inicializarPaginaLoja === 'function') inicializarPaginaLoja();
    }
    atualizarCarrinhoSeDisponivel();
    try {
        await window.carregarScriptSupabase();
    } catch (erro) {
        console.error(erro);
        if (document.getElementById('vitrine-produtos')) {
            definirEstadoVitrine('Erro: biblioteca Supabase não carregou. Verifique a ligação à internet.', 'erro');
        }
        return;
    }
    if(typeof supabase !== 'undefined'){
        dbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        window.dbClient = dbClient;
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
                    if (typeof carregarFavoritosUtilizador === 'function') carregarFavoritosUtilizador();
                }
            }, 0);
        });
        if (paginaPrecisaProdutosLoja()) {
            if (typeof carregarProdutosDaNuvem === 'function') {
                await carregarProdutosDaNuvem();
            }
            aplicarPesquisaUrl();
        }
        if(urlTemRecuperacaoPassword()) {
            await prepararRecuperacaoPassword();
            return;
        }
        await aguardarAppFavoritosSeNecessario();
        mostrarVista(obterVistaPagina(), false);
        await verificarSessaoSupabase();
        window.dispatchEvent(new Event('figures-planet-core-pronta'));
        if (obterVistaPagina() === 'carrinho' && typeof garantirProdutosCarrinhoNoCatalogo === 'function') {
            await garantirProdutosCarrinhoNoCatalogo();
            atualizarCarrinhoSeDisponivel();
        }
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
            if (typeof carregarFavoritosUtilizador === 'function') carregarFavoritosUtilizador(userId);
            restaurarCarrinhoSeDisponivel();
            return;
        }

        if (error) {
            const anonimo = document.getElementById('conteudo-cliente-anonimo');
            const autenticado = document.getElementById('conteudo-cliente-autenticado');
            if (anonimo) anonimo.classList.add('oculto');
            if (autenticado) autenticado.classList.remove('oculto');
            if(typeof preencherFormularioDadosCliente === 'function') preencherFormularioDadosCliente({}, user);
            atualizarVisibilidadeAdmin(user);
            if (typeof carregarFavoritosUtilizador === 'function') carregarFavoritosUtilizador(userId);
            restaurarCarrinhoSeDisponivel();
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
            if (typeof carregarFavoritosUtilizador === 'function') carregarFavoritosUtilizador(userId);
            restaurarCarrinhoSeDisponivel();
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


const FORNECEDORES_STORAGE_KEY = "figures-planet-fornecedores-pedidos";
const FORNECEDORES_FICHAS_KEY = "figures-planet-fornecedores-fichas";

function atualizarVisibilidadeAdmin(user) {
    const painel = document.getElementById('painel-admin');
    const adminAtivo = utilizadorAdmin(user);
    const atalhosAdmin = document.querySelectorAll('.acao-gestao-admin, .acao-plataforma-admin, .acao-anuncio-admin, .acao-mapas-admin, .acao-fornecedores-admin, .acao-encomendas-admin, .acao-estatisticas-admin, .acao-clientes-admin');
    atalhosAdmin.forEach(atalho => { atalho.hidden = !adminAtivo; });
    const navegacaoAdmin = document.querySelector('.navegacao-admin-cabecalho');
    if (navegacaoAdmin) navegacaoAdmin.hidden = !adminAtivo;
    document.body.classList.toggle('cabecalho-com-admin', adminAtivo);
    if (adminAtivo) {
        garantirEstilosAdmin();
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
        if (adminAtivo) {
            bloqueioGestao.hidden = true;
            bloqueioGestao.textContent = '';
        } else if (!user) {
            bloqueioGestao.hidden = true;
            mostrarContaAnonimaSeExistir();
        } else {
            bloqueioGestao.hidden = false;
            bloqueioGestao.textContent = 'Acesso reservado ao administrador.';
        }
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

function carregarCatalogoAdminQuandoDisponivel() {
    if (!paginaPrecisaCatalogoAdmin()) return;

    const iniciar = async () => {
        if (typeof window.garantirGestaoAdmin === 'function') {
            await window.garantirGestaoAdmin();
        }
        if (typeof carregarProdutosAdminDaNuvem === 'function') {
            await carregarProdutosAdminDaNuvem();
        }
    };

    iniciar().catch((error) => {
        console.error('Erro ao carregar catalogo administrativo:', error);
    });
}

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js?v=20260711-leve-r21').catch(() => {});
    });
}
