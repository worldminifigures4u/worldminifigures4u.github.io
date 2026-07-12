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

function formatarEuro(valor) {
    return Number(valor || 0).toFixed(2).replace('.', ',');
}

function utilizadorAdmin(user) {
    const email = String(user?.email || '').toLowerCase();
    return ADMIN_EMAILS.includes(email);
}

function garantirEstilosAdmin() {
    if (document.querySelector('link[href*="styles-admin.css"]')) return;
    const folha = document.createElement('link');
    folha.rel = 'stylesheet';
    folha.href = 'styles-admin.css?v=20260711-menu-admin';
    document.head.appendChild(folha);
}

function atualizarVisibilidadeAdmin(user) {
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
    } else if (!user) {
        const nomeCache = localStorage.getItem(NOME_CONTA_CABECALHO_KEY) || '';
        atualizarCabecalhoCliente(nomeCache);
    }
    if (typeof window.sincronizarEspacamentoCabecalho === 'function') {
        requestAnimationFrame(() => window.sincronizarEspacamentoCabecalho());
    }
}

function mostrarMensagem(elemento, mensagem, tipo = '') {
    if (!elemento) return;
    elemento.className = tipo ? `msg-status ${tipo}` : 'msg-status';
    elemento.replaceChildren();
    mensagem.split('\n').forEach((linha, index) => {
        if (index > 0) elemento.appendChild(document.createElement('br'));
        elemento.appendChild(document.createTextNode(linha));
    });
}

function executarComTimeout(promessa, ms, mensagemErro) {
    let timeout;
    const timeoutPromise = new Promise((_, reject) => {
        timeout = setTimeout(() => { reject(new Error(mensagemErro)); }, ms);
    });
    return Promise.race([promessa, timeoutPromise]).finally(() => clearTimeout(timeout));
}

function otimizarImagemCloudinary(url, largura = 700) {
    const urlOriginal = String(url || '').trim();
    if (!urlOriginal || !urlOriginal.includes('res.cloudinary.com/') || !urlOriginal.includes('/image/upload/')) {
        return urlOriginal;
    }
    const larguraSegura = Math.max(80, Math.min(1600, Math.round(Number(largura) || 700)));
    return urlOriginal.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${larguraSegura},c_limit/`);
}

function otimizarImagemCloudinarySrcset(url, larguras = [260, 520, 780]) {
    const urlOriginal = String(url || '').trim();
    const fallback = otimizarImagemCloudinary(urlOriginal, larguras[1] || 520);
    if (!urlOriginal || !urlOriginal.includes('res.cloudinary.com/') || !urlOriginal.includes('/image/upload/')) {
        return { src: fallback, srcset: '', sizes: '' };
    }
    const lista = (Array.isArray(larguras) ? larguras : [260, 520, 780])
        .map(largura => Math.max(80, Math.min(1600, Math.round(Number(largura) || 520))))
        .filter((largura, indice, arr) => arr.indexOf(largura) === indice);
    return {
        src: otimizarImagemCloudinary(urlOriginal, lista[Math.min(1, lista.length - 1)]),
        srcset: lista.map(largura => `${otimizarImagemCloudinary(urlOriginal, largura)} ${largura}w`).join(', '),
        sizes: '(max-width: 560px) calc(100vw - 64px), (max-width: 1100px) 280px, 320px'
    };
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
                } catch (e) {
                    listaImagens = textoLimpo.replace(/[\[\]"]/g, '').split(',').map(s => s.trim());
                }
            } else {
                listaImagens = [textoLimpo];
            }
        }
    }
    listaImagens = listaImagens.filter(url => url && typeof url === 'string' && url.trim() !== '');
    return listaImagens.length > 0 ? listaImagens[0] : 'img/sem-imagem.png';
}

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
    if (typeof renderizarFavoritosCliente === 'function') return;
    if (typeof window.garantirFavoritosUi === 'function') {
        await window.garantirFavoritosUi();
    }
}

window.addEventListener('load', async () => {
    atualizarCarrinhoSeDisponivel();
    const nomeCache = localStorage.getItem(NOME_CONTA_CABECALHO_KEY);
    if (nomeCache) atualizarCabecalhoCliente(nomeCache);

    try {
        await window.carregarScriptSupabase();
    } catch (erro) {
        console.error(erro);
        return;
    }

    if (typeof supabase === 'undefined') return;

    iniciarClientesSupabase();

    await aguardarModulosContaCliente();
    await aguardarAppFavoritos();
    await aguardarModulosFavoritos();

    if (urlTemRecuperacaoPassword()) {
        await prepararRecuperacaoPassword();
        return;
    }

    await verificarSessaoSupabase();
});

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js?v=20260711-leve-r16').catch(() => {});
    });
}
