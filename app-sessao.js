// Nucleo leve para paginas de conta e favoritos (sem catalogo da loja).
let dbClient = null;
let produtosClient = null;
let todosOsProdutos = [];
let carrinho = carregarCarrinhoLocal();
let emRecuperacaoPassword = false;

function obterParametrosAuthUrl() {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
    const hashParams = new URLSearchParams(hash);
    hashParams.forEach((valor, chave) => {
        if (!params.has(chave)) params.set(chave, valor);
    });
    return params;
}

function urlTemRecuperacaoPassword() {
    const params = obterParametrosAuthUrl();
    return params.get('type') === 'recovery' || params.has('code') || params.has('access_token');
}

async function prepararRecuperacaoPassword() {
    emRecuperacaoPassword = true;
    const params = obterParametrosAuthUrl();
    const code = params.get('code');

    if (code) {
        const { error } = await dbClient.auth.exchangeCodeForSession(code);
        if (error) {
            mostrarMensagem(
                document.getElementById('status-cliente'),
                'Erro ao validar o link de recuperação. Peça um novo link no Supabase.',
                'msg-erro'
            );
            console.error('Erro recovery code:', error);
            return;
        }
    }

    if (typeof mostrarFormularioRecuperacaoPassword === 'function') {
        mostrarFormularioRecuperacaoPassword();
    }
}

function carregarCarrinhoLocal() {
    try {
        const guardado = JSON.parse(localStorage.getItem('carrinho')) || [];
        if (!Array.isArray(guardado)) return [];
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
    } catch (e) {
        localStorage.removeItem('carrinho');
        return [];
    }
}

function obterProdutoPorIdLocal(id) {
    const chave = typeof normalizarIdFavorito === 'function' ? normalizarIdFavorito(id) : String(id || '').trim();
    return (todosOsProdutos || []).find(produto => {
        const idProduto = typeof normalizarIdFavorito === 'function' ? normalizarIdFavorito(produto.id) : String(produto.id || '').trim();
        return idProduto === chave;
    }) || null;
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
    if (document.body?.dataset?.page === 'carrinho') {
        atualizarContadorCarrinhoCabecalho();
        return;
    }
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
    mostrarAvisoContaBloqueadaSeExistir();
}

function mostrarAvisoContaBloqueadaSeExistir() {
    if (localStorage.getItem(CONTA_BLOQUEADA_KEY) !== '1') return;
    localStorage.removeItem(CONTA_BLOQUEADA_KEY);
    const statusDiv = document.getElementById('status-cliente');
    if (statusDiv && typeof mostrarMensagem === 'function') {
        mostrarMensagem(statusDiv, MENSAGEM_CONTA_SUSPENSA, 'msg-erro');
    }
}

async function verificarRestricoesContaClienteSite(user) {
    if (!dbClient || !user || utilizadorAdmin(user)) return false;
    try {
        const { data, error } = await dbClient.rpc('obter_restricoes_cliente_site');
        if (error) return false;
        if (!data?.bloquear_conta) return false;
        localStorage.removeItem(NOME_CONTA_CABECALHO_KEY);
        localStorage.setItem(CONTA_BLOQUEADA_KEY, '1');
        await dbClient.auth.signOut();
        return true;
    } catch (erro) {
        console.warn('Restricoes de conta nao verificadas:', erro);
        return false;
    }
}

function atualizarVisibilidadeAdmin(user) {
    const adminAtivo = utilizadorAdmin(user);
    const atalhosAdmin = document.querySelectorAll('.acao-plataforma-admin, .acao-anuncio-admin, .acao-mapas-admin, .acao-fornecedores-admin, .acao-encomendas-admin, .acao-estatisticas-admin, .acao-clientes-admin, .acao-conta-admin');
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
    } else if (!user) {
        const nomeCache = localStorage.getItem(NOME_CONTA_CABECALHO_KEY) || '';
        atualizarCabecalhoCliente(nomeCache);
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
    if (!document.body.classList.contains('pagina-gestao')) return;

    const aplicarPainel = () => {
        if (typeof window.aplicarPainelGestaoAdmin === 'function') {
            window.aplicarPainelGestaoAdmin(user);
        }
    };

    if (adminAtivo && typeof window.garantirAdminGestao === 'function') {
        window.garantirAdminGestao().then(aplicarPainel).catch(console.error);
        return;
    }

    aplicarPainel();
}

async function sincronizarFichaClienteSiteRemota() {
    if (!dbClient) return;
    try {
        const { data: { session } } = await dbClient.auth.getSession();
        if (!session?.user?.email_confirmed_at) return;
        const email = String(session.user.email || '').trim().toLowerCase();
        if (typeof ADMIN_EMAILS !== 'undefined' && ADMIN_EMAILS.map((e) => String(e).toLowerCase()).includes(email)) {
            return;
        }
        if (typeof window.sincronizarFichaClienteSite === 'function') {
            await window.sincronizarFichaClienteSite();
            return;
        }
        await dbClient.rpc('sincronizar_ficha_cliente_site');
    } catch (erro) {
        console.warn('Ficha cliente site nao sincronizada:', erro);
    }
}

async function obterDadosPerfilDaTabela(userId, user = null) {
    try {
        if (user && await verificarRestricoesContaClienteSite(user)) {
            atualizarVisibilidadeAdmin(null);
            mostrarContaAnonimaSeExistir();
            atualizarCabecalhoCliente();
            return;
        }

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
            if (typeof preencherFormularioDadosCliente === 'function') preencherFormularioDadosCliente({}, user);
            atualizarVisibilidadeAdmin(user);
            if (typeof carregarFavoritosUtilizador === 'function') carregarFavoritosUtilizador(userId);
            restaurarCarrinhoSeDisponivel();
            if (typeof carregarHistoricoEncomendas === 'function') carregarHistoricoEncomendas(userId);
            return;
        }

        if (data) {
            const anonimo = document.getElementById('conteudo-cliente-anonimo');
            const autenticado = document.getElementById('conteudo-cliente-autenticado');
            if (anonimo) anonimo.classList.add('oculto');
            if (autenticado) autenticado.classList.remove('oculto');
            if (typeof preencherFormularioDadosCliente === 'function') preencherFormularioDadosCliente(data, user);
            atualizarVisibilidadeAdmin(user);
            if (typeof carregarFavoritosUtilizador === 'function') carregarFavoritosUtilizador(userId);
            restaurarCarrinhoSeDisponivel();
            if (typeof carregarHistoricoEncomendas === 'function') carregarHistoricoEncomendas(userId);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await sincronizarFichaClienteSiteRemota();
    }
}

async function verificarSessaoSupabase() {
    const { data: { session } } = await dbClient.auth.getSession();
    if (session && session.user) {
        if (session.user.email_confirmed_at === null) {
            await dbClient.auth.signOut();
            return;
        }
        await obterDadosPerfilDaTabela(session.user.id, session.user);
    }
}

function iniciarClientesSupabase() {
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
                if (typeof mostrarFormularioRecuperacaoPassword === 'function') {
                    mostrarFormularioRecuperacaoPassword();
                }
                return;
            }

            if (emRecuperacaoPassword) {
                if (typeof mostrarFormularioRecuperacaoPassword === 'function') {
                    mostrarFormularioRecuperacaoPassword();
                }
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
}

async function aguardarAppFavoritos() {
    if (typeof carregarFavoritosUtilizador === 'function') return;
    if (typeof window.garantirAppFavoritos === 'function') {
        await window.garantirAppFavoritos();
    }
}

async function aguardarModulosContaCliente() {
    if (!existeAreaClientePagina()) return;
    if (typeof preencherFormularioDadosCliente === 'function') return;
    if (typeof window.garantirContaCliente === 'function') {
        await window.garantirContaCliente();
    }
}

function existePaginaFavoritos() {
    return document.body?.dataset?.page === 'favoritos' || !!document.getElementById('lista-favoritos-cliente');
}

async function aguardarModulosFavoritos() {
    if (!existePaginaFavoritos()) return;
    await aguardarAppFavoritos();
    if (typeof renderizarFavoritosCliente === 'function') return;
    if (typeof window.garantirFavoritosUi === 'function') {
        await window.garantirFavoritosUi();
    }
}

window.addEventListener('load', async () => {
    const paginaCarrinho = document.body?.dataset?.page === 'carrinho' || !!document.getElementById('lista-carrinho');

    if (paginaCarrinho) {
        atualizarContadorCarrinhoCabecalho();
        document.getElementById('lista-carrinho')?.classList.add('lista-carrinho--preparar');
    } else {
        atualizarCarrinhoSeDisponivel();
    }

    const nomeCache = localStorage.getItem(NOME_CONTA_CABECALHO_KEY);
    if (nomeCache) atualizarCabecalhoCliente(nomeCache);

    try {
        await window.carregarScriptSupabase();
    } catch (erro) {
        console.error(erro);
        window.dispatchEvent(new Event('figures-planet-sessao-erro'));
        return;
    }

    if (typeof supabase === 'undefined') return;

    iniciarClientesSupabase();
    window.dispatchEvent(new Event('figures-planet-sessao-pronta'));

    await aguardarModulosContaCliente();
    await aguardarAppFavoritos();
    await aguardarModulosFavoritos();

    if (urlTemRecuperacaoPassword()) {
        if (!existeAreaClientePagina()) {
            const destino = 'conta.html' + window.location.search + window.location.hash;
            window.location.replace(destino);
            return;
        }
        await prepararRecuperacaoPassword();
        return;
    }

    await verificarSessaoSupabase();

    if (paginaCarrinho) {
        if (typeof garantirProdutosCarrinhoNoCatalogo === 'function') {
            await garantirProdutosCarrinhoNoCatalogo();
        }
        if (typeof atualizarCarrinho === 'function') {
            atualizarCarrinho({ forcar: true });
        } else {
            atualizarCarrinhoSeDisponivel();
            if (typeof finalizarRenderCarrinho === 'function') {
                finalizarRenderCarrinho();
            }
        }
    }
});

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js?v=20260716-sem-rodape-admin').then((registo) => {
            registo.addEventListener('updatefound', () => {
                const novoWorker = registo.installing;
                if (!novoWorker) return;
                novoWorker.addEventListener('statechange', () => {
                    if (novoWorker.state === 'activated' && navigator.serviceWorker.controller) {
                        window.location.reload();
                    }
                });
            });
        }).catch(() => {});
    });
}
