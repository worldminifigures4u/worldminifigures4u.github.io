const SUPABASE_URL = "https://gksndzxadndrsynvzgzb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrc25kenhhZG5kcnN5bnZ6Z3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc5NzMsImV4cCI6MjA5NDY2Mzk3M30.EHZgacYr27dqoc4CJHsOwkNnJFGlLIteSHBi4B1HfVE";
const CLOUDINARY_CLOUD_NAME = "ddzgmr4eb";
const CLOUDINARY_UPLOAD_PRESET = "worldminifigures4u_unsigned";
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

function atualizarCabecalhoCliente(nome = '') {
    const nomeEl = document.getElementById('nome-login-cabecalho');
    if (!nomeEl) return;

    const nomeLimpo = String(nome || '').trim();
    const primeiroNome = nomeLimpo.split(/\s+/)[0] || '';
    nomeEl.textContent = primeiroNome;
    nomeEl.style.display = primeiroNome ? 'inline' : 'none';
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
    if (autenticado) autenticado.style.display = 'none';
    if (anonimo) anonimo.style.display = 'block';
}

const PAGINAS_VISTA = {
    loja: 'index.html',
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
    executarFiltrosCombinados();
}

function aplicarPesquisaUrl() {
    if (obterVistaPagina() !== 'loja') return;
    const pesquisa = new URLSearchParams(window.location.search).get('q') || '';
    const campo = document.getElementById('campo-pesquisa');
    if (campo && pesquisa) {
        campo.value = pesquisa;
        executarFiltrosCombinados();
    }
}

let frameAtualizacaoStickyTemas = null;
let observadorTamanhoMenuTemas = null;

function atualizarStickyTemas() {
    const coluna = document.querySelector('.coluna-esquerda');
    const menu = document.getElementById('menu-lateral-temas');
    const header = document.querySelector('header');
    if (!coluna || !menu) return;

    if (window.matchMedia && window.matchMedia('(max-width: 1100px)').matches) {
        coluna.style.removeProperty('--temas-sticky-top');
        return;
    }

    const margem = 20;
    const headerBottom = header ? header.getBoundingClientRect().bottom : 76;
    const topoNormal = Math.ceil(headerBottom + margem);
    const alturaMenu = Math.ceil(menu.offsetHeight);
    const topoComFundoVisivel = Math.floor(window.innerHeight - alturaMenu - margem);
    const stickyTop = Math.min(topoNormal, topoComFundoVisivel);

    coluna.style.setProperty('--temas-sticky-top', `${stickyTop}px`);
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

function mudarAba(tipo) {
    const btnLogin = document.querySelectorAll('.tab-btn')[0];
    const btnRegisto = document.querySelectorAll('.tab-btn')[1];
    const formLogin = document.getElementById('form-login');
    const formRegisto = document.getElementById('form-registo');
    const formRecuperar = document.getElementById('form-recuperar-password');
    const statusDiv = document.getElementById('status-cliente');

    statusDiv.innerText = '';
    if(formRecuperar) formRecuperar.style.display = 'none';

    if (tipo === 'login') {
        btnLogin.classList.add('ativa');
        btnRegisto.classList.remove('ativa');
        formLogin.style.display = 'flex';
        formRegisto.style.display = 'none';
    } else {
        btnLogin.classList.remove('ativa');
        btnRegisto.classList.add('ativa');
        formLogin.style.display = 'none';
        formRegisto.style.display = 'flex';
    }
}

function mostrarFormularioRecuperacaoPassword() {
    if (!existeAreaClientePagina()) {
        window.location.href = 'conta.html' + (window.location.hash || '');
        return;
    }
    document.getElementById('conteudo-cliente-autenticado').style.display = 'none';
    document.getElementById('conteudo-cliente-anonimo').style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('ativa'));
    document.getElementById('form-login').style.display = 'none';
    document.getElementById('form-registo').style.display = 'none';
    document.getElementById('form-recuperar-password').style.display = 'flex';
    mostrarMensagem(
        document.getElementById('status-cliente'),
        'Defina a nova palavra-passe para concluir a recuperação da conta.',
        'msg-sucesso'
    );
}

async function pedirRecuperacaoPassword() {
    const statusDiv = document.getElementById('status-cliente');
    const emailInput = document.getElementById('login-email');
    const email = String(emailInput?.value || '').trim();

    if (!email) {
        mostrarMensagem(statusDiv, 'Introduza primeiro o seu endereço de email.', 'msg-erro');
        emailInput?.focus();
        return;
    }

    try {
        mostrarMensagem(statusDiv, 'A enviar o email de recuperação...');
        const redirectTo = new URL('conta.html', obterUrlPublicoAtual()).href;
        const { error } = await dbClient.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;

        mostrarMensagem(
            statusDiv,
            'Enviámos um email com o link para definir uma nova palavra-passe. Verifique também a pasta de spam.',
            'msg-sucesso'
        );
    } catch (error) {
        console.error('Erro ao pedir recuperação de password:', error);
        mostrarMensagem(
            statusDiv,
            'Erro: ' + (error.message || 'Não foi possível enviar o email de recuperação.'),
            'msg-erro'
        );
    }
}

async function fazerLogin(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('status-cliente');
    const botaoLogin = document.querySelector('#form-login button[type="submit"]');
    statusDiv.className = "msg-status";
    statusDiv.innerText = "A entrar...";

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if(!dbClient){
        mostrarMensagem(statusDiv, "Erro: ligação ao Supabase indisponível. Verifique a internet e recarregue a página.", "msg-erro");
        return;
    }

    if(!email || !password){
        mostrarMensagem(statusDiv, "Preencha o e-mail e a palavra-passe.", "msg-erro");
        return;
    }

    botaoLogin.disabled = true;
    botaoLogin.innerText = "A entrar...";

    try {
        const { data, error } = await executarComTimeout(
            dbClient.auth.signInWithPassword({
                email: email,
                password: password
            }),
            30000,
            "A ligação ao serviço de login demorou demasiado. Tente novamente."
        );

        if (error) throw error;

        if (data && data.user) {
            if (data.user.email_confirmed_at === null) {
                await dbClient.auth.signOut();
                mostrarMensagem(statusDiv, "E-mail não confirmado!\nPor favor, aceda à sua caixa de correio e clique no link de validação enviado para poder iniciar sessão.", "msg-erro");
                return;
            }
            await executarComTimeout(
                obterDadosPerfilDaTabela(data.user.id, data.user),
                15000,
                "Sessão iniciada, mas os dados do perfil demoraram demasiado a carregar."
            );
            statusDiv.innerText = "";
        }
    } catch (erro) {
        console.error(erro);
        mostrarMensagem(statusDiv, "Erro: " + (erro.message || "E-mail ou password inválidos."), "msg-erro");
    } finally {
        botaoLogin.disabled = false;
        botaoLogin.innerText = "Entrar na Conta";
    }
}

async function registarCliente(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('status-cliente');
    statusDiv.className = "msg-status";
    statusDiv.innerText = "A processar registo de segurança...";

    const nome = document.getElementById('registo-nome').value.trim();
    const email = document.getElementById('registo-email').value.trim();
    const password = document.getElementById('registo-password').value;
    const telemovel = document.getElementById('registo-telemovel').value.trim();
    const morada = document.getElementById('registo-morada').value.trim();
    const cp = document.getElementById('registo-cp').value.trim();
    const cidade = document.getElementById('registo-cidade').value.trim();
    const pais = document.getElementById('registo-pais').value.trim();

    try {
       const { data, error } = await dbClient.auth.signUp({
    email: email,
    password: password,
    options: {
        emailRedirectTo: obterUrlPublicoAtual(),
        data: {
            nome: nome,
            telemovel: telemovel,
            morada: morada,
            cp: cp,
            cidade: cidade,
            pais: pais
        }
    }
});

        if (error) throw error;

        if (data && data.user) {
            await dbClient.auth.signOut();

            mostrarMensagem(statusDiv, " Registo efetuado!\nEnviámos um link de confirmação para o seu e-mail. Ative a conta antes de tentar fazer login.", "msg-sucesso");
            
            document.getElementById('form-registo').reset();
            setTimeout(() => { mudarAba('login'); }, 5000);
        }
    } catch (erro) {
        console.error("Erro completo:", erro);
        statusDiv.className = "msg-status msg-erro";
        statusDiv.innerText = "Erro ao registar: " + (erro.message || "Verifique os dados informados.");
    }
}

async function atualizarPasswordRecuperacao(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('status-cliente');
    const novaPassword = document.getElementById('nova-password').value;
    const confirmarPassword = document.getElementById('confirmar-nova-password').value;

    if(novaPassword.length < 6) {
        mostrarMensagem(statusDiv, 'A nova password deve ter pelo menos 6 caracteres.', 'msg-erro');
        return;
    }

    if(novaPassword !== confirmarPassword) {
        mostrarMensagem(statusDiv, 'As passwords não coincidem.', 'msg-erro');
        return;
    }

    try {
        mostrarMensagem(statusDiv, 'A atualizar password...');
        const { error } = await dbClient.auth.updateUser({ password: novaPassword });
        if(error) throw error;

        document.getElementById('form-recuperar-password').reset();
        mostrarMensagem(statusDiv, 'Password atualizada com sucesso. Já pode iniciar sessão.', 'msg-sucesso');
        emRecuperacaoPassword = false;
        if(window.history && window.history.replaceState) {
            window.history.replaceState({}, document.title, obterUrlPublicoAtual());
        }
        await dbClient.auth.signOut();
        setTimeout(() => { mudarAba('login'); }, 1500);
    } catch(error) {
        console.error('Erro ao atualizar password:', error);
        mostrarMensagem(statusDiv, 'Erro: ' + (error.message || 'Não foi possível atualizar a password.'), 'msg-erro');
    }
}

async function alterarPasswordConta(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('status-alterar-password');
    const novaPassword = document.getElementById('conta-nova-password').value;
    const confirmarPassword = document.getElementById('conta-confirmar-password').value;

    if(novaPassword.length < 6) {
        mostrarMensagem(statusDiv, 'A nova password deve ter pelo menos 6 caracteres.', 'msg-erro');
        return;
    }

    if(novaPassword !== confirmarPassword) {
        mostrarMensagem(statusDiv, 'As passwords não coincidem.', 'msg-erro');
        return;
    }

    try {
        mostrarMensagem(statusDiv, 'A atualizar password...');
        const { error } = await dbClient.auth.updateUser({ password: novaPassword });
        if(error) throw error;

        document.getElementById('form-alterar-password').reset();
        mostrarMensagem(statusDiv, 'Password atualizada com sucesso.', 'msg-sucesso');
    } catch(error) {
        console.error('Erro ao alterar password:', error);
        mostrarMensagem(statusDiv, 'Erro: ' + (error.message || 'Não foi possível atualizar a password.'), 'msg-erro');
    }
}

async function eliminarContaUtilizador(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('status-eliminacao-conta');
    const passwordInput = document.getElementById('eliminar-conta-password');
    const confirmacaoInput = document.getElementById('eliminar-conta-confirmacao');
    const submitButton = event.currentTarget?.querySelector('button[type="submit"]');

    try {
        const password = String(passwordInput?.value || '');
        const confirmacao = String(confirmacaoInput?.value || '').trim().toUpperCase();

        if (!password) throw new Error('Introduza a sua palavra-passe atual.');
        if (confirmacao !== 'ELIMINAR') throw new Error('Escreva ELIMINAR exatamente como indicado.');

        const confirmou = window.confirm('Eliminar definitivamente a sua conta? Esta ação não pode ser anulada.');
        if (!confirmou) return;

        const { data: { session }, error: sessionError } = await dbClient.auth.getSession();
        if (sessionError || !session?.access_token) {
            throw new Error('A sessão terminou. Inicie sessão novamente antes de eliminar a conta.');
        }

        if (submitButton) submitButton.disabled = true;
        mostrarMensagem(statusDiv, 'A eliminar a conta...');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        let response;
        try {
            response = await fetch(`${SUPABASE_URL}/functions/v1/eliminar-conta`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': SUPABASE_KEY
                },
                body: JSON.stringify({ password, confirmacao }),
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
        }

        const resultado = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(resultado.error || 'Não foi possível eliminar a conta.');

        localStorage.removeItem('carrinho');
        await dbClient.auth.signOut().catch(() => {});
        mostrarMensagem(statusDiv, 'A sua conta foi eliminada com sucesso.', 'msg-sucesso');
        setTimeout(() => window.location.replace('index.html'), 1200);
    } catch (error) {
        console.error('Erro ao eliminar conta:', error);
        const mensagem = error?.name === 'AbortError'
            ? 'A eliminação demorou demasiado. Tente novamente.'
            : (error.message || 'Não foi possível eliminar a conta.');
        mostrarMensagem(statusDiv, 'Erro: ' + mensagem, 'msg-erro');
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

window.eliminarContaUtilizador = eliminarContaUtilizador;

function preencherFormularioDadosCliente(data = {}, user = null) {
    const nome = data.nome || user?.user_metadata?.nome || '';
    const email = data.email || user?.email || '';
    const morada = data.morada || '';
    const cp = data.cp || '';
    const cidade = data.cidade || '';
    const pais = data.pais || user?.user_metadata?.pais || '';

    document.getElementById('nome-perfil-logado').innerText = nome || 'Cliente Autenticado';
    atualizarCabecalhoCliente(nome || 'Cliente');
    document.getElementById('email-perfil-logado').innerText = '';
    const moradaResumo = [morada, [cp, cidade].filter(Boolean).join(' '), pais].filter(Boolean).join(', ');
    document.getElementById('cp-perfil-logado').innerText = '';

    const campoNome = document.getElementById('editar-nome');
    const campoEmail = document.getElementById('editar-email');
    const campoTelemovel = document.getElementById('editar-telemovel');
    const campoMorada = document.getElementById('editar-morada');
    const campoCp = document.getElementById('editar-cp');
    const campoCidade = document.getElementById('editar-cidade');
    const campoPais = document.getElementById('editar-pais');

    if (campoNome) campoNome.value = nome;
    if (campoEmail) campoEmail.value = email;
    if (campoTelemovel) campoTelemovel.value = data.telemovel || '';
    if (campoMorada) campoMorada.value = morada;
    if (campoCp) campoCp.value = cp;
    if (campoCidade) campoCidade.value = cidade;
    if (campoPais) campoPais.value = pais || 'Portugal';
}

async function guardarDadosCliente(event) {
    event.preventDefault();
    const statusDiv = document.getElementById('status-dados-cliente');
    const nome = document.getElementById('editar-nome').value.trim();
    const email = document.getElementById('editar-email').value.trim();
    const telemovel = document.getElementById('editar-telemovel').value.trim();
    const morada = document.getElementById('editar-morada').value.trim();
    const cp = document.getElementById('editar-cp').value.trim();
    const cidade = document.getElementById('editar-cidade').value.trim();
    const pais = document.getElementById('editar-pais').value.trim();

    if (!nome) {
        mostrarMensagem(statusDiv, 'Indique o nome.', 'msg-erro');
        return;
    }

    if (!email) {
        mostrarMensagem(statusDiv, 'Indique o e-mail.', 'msg-erro');
        return;
    }

    try {
        mostrarMensagem(statusDiv, 'A guardar dados...');
        const { data: { user }, error: userError } = await dbClient.auth.getUser();
        if (userError || !user) throw userError || new Error('Sessão não encontrada.');
        const emailAtual = String(user.email || '').toLowerCase();
        const emailNovo = email.toLowerCase();
        const emailAlterado = emailNovo !== emailAtual;

        if (emailAlterado) {
            const { error: emailError } = await dbClient.auth.updateUser(
                { email },
                { emailRedirectTo: obterUrlPublicoAtual() }
            );
            if (emailError) throw emailError;
        }

        const perfilAtualizado = {
            id: user.id,
            nome,
            email,
            telemovel,
            morada,
            cp,
            cidade,
            pais
        };

        const { error } = await dbClient
            .from('clientes')
            .upsert(perfilAtualizado, { onConflict: 'id' });

        if (error) throw error;

        preencherFormularioDadosCliente(perfilAtualizado, user);
        mostrarMensagem(
            statusDiv,
            emailAlterado
                ? 'Dados guardados. Confirme o novo e-mail através do link enviado pelo Supabase.'
                : 'Dados guardados com sucesso.',
            'msg-sucesso'
        );
    } catch(error) {
        console.error('Erro ao guardar dados do cliente:', error);
        mostrarMensagem(statusDiv, 'Erro: ' + (error.message || 'Não foi possível guardar os dados.'), 'msg-erro');
    }
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
            restaurarCarrinhoGuardado();
            return;
        }

        if (error) {
            const anonimo = document.getElementById('conteudo-cliente-anonimo');
            const autenticado = document.getElementById('conteudo-cliente-autenticado');
            if (anonimo) anonimo.style.display = 'none';
            if (autenticado) autenticado.style.display = 'block';
            preencherFormularioDadosCliente({}, user);
            atualizarVisibilidadeAdmin(user);
            restaurarCarrinhoGuardado();
            carregarHistoricoEncomendas(userId);
            return;
        }

        if (data) {
            const anonimo = document.getElementById('conteudo-cliente-anonimo');
            const autenticado = document.getElementById('conteudo-cliente-autenticado');
            if (anonimo) anonimo.style.display = 'none';
            if (autenticado) autenticado.style.display = 'block';
            preencherFormularioDadosCliente(data, user);
            atualizarVisibilidadeAdmin(user);
            restaurarCarrinhoGuardado();
            carregarHistoricoEncomendas(userId);
        }
    } catch (e) {
        console.error(e);
    }
}

async function fazerLogout() {
    await dbClient.auth.signOut();
    restaurarCarrinhoGuardado();
    atualizarVisibilidadeAdmin(null);
    mostrarContaAnonimaSeExistir();
    const statusCliente = document.getElementById('status-cliente');
    if (statusCliente) statusCliente.innerText = '';
    atualizarCabecalhoCliente();
    definirHistoricoVazio('Entre na conta para carregar o histórico.');
    if (existeAreaClientePagina()) mudarAba('login');
    if (paginaPrecisaProdutosLoja()) {
        await carregarProdutosDaNuvem();
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
    const tituloConta = document.querySelector('[data-vista-nav="conta"] .texto-acao strong');
    if (tituloConta) tituloConta.textContent = 'Conta';
    const atalhosAdmin = document.querySelectorAll('.acao-gestao-admin, .acao-plataforma-admin, .acao-anuncio-admin, .acao-mapas-admin, .acao-fornecedores-admin, .acao-encomendas-admin, .acao-clientes-admin');
    atalhosAdmin.forEach(atalho => { atalho.hidden = !adminAtivo; });
    const navegacaoAdmin = document.querySelector('.navegacao-admin-cabecalho');
    if (navegacaoAdmin) navegacaoAdmin.hidden = !adminAtivo;
    document.body.classList.toggle('cabecalho-com-admin', adminAtivo);
    const bloqueioGestao = document.getElementById('gestao-bloqueio');
    if (bloqueioGestao) {
        bloqueioGestao.hidden = adminAtivo;
        bloqueioGestao.textContent = adminAtivo ? '' : 'Acesso reservado ao administrador.';
    }
    if(!painel) return;
    const zonaEliminacao = document.getElementById('zona-eliminacao-conta');
    painel.style.display = adminAtivo ? 'block' : 'none';
    if(zonaEliminacao) zonaEliminacao.style.display = adminAtivo ? 'none' : 'block';
    if(adminAtivo) {
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

function definirHistoricoVazio(mensagem) {
    const lista = document.getElementById('lista-historico-encomendas');
    if(!lista) return;
    lista.replaceChildren();
    const vazio = document.createElement('p');
    vazio.className = 'historico-vazio';
    vazio.textContent = mensagem;
    lista.appendChild(vazio);
}

function resumirProdutosEncomenda(produtos) {
    if(!Array.isArray(produtos) || produtos.length === 0) return 'Sem artigos registados';
    const totalArtigos = produtos.reduce((total, item) => total + Number(item.quantidade || item.qtd || 1), 0);
    const primeiro = produtos[0];
    const primeiroNome = primeiro ? (primeiro.nome || primeiro.produto || 'Artigo') : 'Artigo';
    if(produtos.length === 1) return `${totalArtigos}x ${primeiroNome}`;
    return `${totalArtigos} artigos - clique para ver detalhes`;
}

function criarListaCompletaProdutos(produtos) {
    const lista = document.createElement('ul');
    lista.className = 'lista-artigos-encomenda';

    if(!Array.isArray(produtos) || produtos.length === 0) {
        const item = document.createElement('li');
        item.textContent = 'Sem artigos registados';
        lista.appendChild(item);
        return lista;
    }

    produtos.forEach(produto => {
        const item = document.createElement('li');
        const quantidade = Number(produto.quantidade || produto.qtd || 1);
        const nome = produto.nome || produto.produto || 'Artigo';
        const preco = produto.preco_unitario || produto.preco;
        item.textContent = preco !== undefined
            ? `${quantidade}x ${nome} - ${formatarEuro(preco)} €`
            : `${quantidade}x ${nome}`;
        lista.appendChild(item);
    });

    return lista;
}

function renderizarHistoricoEncomendas(encomendas) {
    const lista = document.getElementById('lista-historico-encomendas');
    if(!lista) return;
    lista.replaceChildren();

    if(!encomendas || encomendas.length === 0) {
        definirHistoricoVazio('Ainda não existem encomendas nesta conta.');
        return;
    }

    encomendas.forEach(encomenda => {
        const card = document.createElement('div');
        card.className = 'encomenda-card';

        const topo = document.createElement('div');
        topo.className = 'encomenda-topo';

        const id = document.createElement('span');
        id.className = 'encomenda-id';
        id.textContent = encomenda.codigo_encomenda || ('#' + (encomenda.id || 'sem-id'));

        const estadoAtual = String(encomenda.estado || 'Pendente');
        const estadoCliente = ['concluido', 'concluído'].includes(estadoAtual.trim().toLowerCase())
            ? 'Enviado'
            : estadoAtual;

        topo.appendChild(id);
        const estado = document.createElement('span');
        estado.className = 'encomenda-estado';
        estado.textContent = estadoCliente;
        topo.appendChild(estado);

        const data = document.createElement('div');
        const dataValor = encomenda.created_at || encomenda.data || encomenda.inserted_at;
        data.textContent = dataValor ? new Date(dataValor).toLocaleDateString('pt-PT') : 'Data indisponível';

        const produtosDaEncomenda = encomenda.produtos || encomenda.artigos;

        const produtos = document.createElement('div');
        produtos.className = 'encomenda-produtos-resumo';
        produtos.textContent = resumirProdutosEncomenda(produtosDaEncomenda);

        const listaCompleta = criarListaCompletaProdutos(produtosDaEncomenda);

        const botaoArtigos = document.createElement('button');
        botaoArtigos.className = 'btn-ver-artigos';
        botaoArtigos.type = 'button';
        botaoArtigos.textContent = 'Ver artigos';
        botaoArtigos.onclick = function(){
            const aberta = listaCompleta.classList.toggle('aberta');
            botaoArtigos.textContent = aberta ? 'Ocultar artigos' : 'Ver artigos';
        };

        const total = document.createElement('div');
        total.className = 'encomenda-total';
        total.textContent = formatarEuro(encomenda.total || 0) + ' €';

        card.appendChild(topo);
        card.appendChild(data);
        card.appendChild(produtos);
        card.appendChild(botaoArtigos);
        card.appendChild(listaCompleta);
        card.appendChild(total);
        lista.appendChild(card);
    });
}

async function carregarHistoricoEncomendas(userId) {
    definirHistoricoVazio('A carregar histórico...');
    try {
        let { data, error } = await dbClient
            .from('encomendas')
            .select('id, codigo_encomenda, produtos, total, metodo_pagamento, estado, created_at')
            .eq('id_cliente', userId)
            .order('created_at', { ascending:false })
            .limit(10);

        if(error && /created_at|column/i.test(error.message || '')) {
            const fallback = await dbClient
                .from('encomendas')
                .select('id, codigo_encomenda, produtos, total, metodo_pagamento, estado')
                .eq('id_cliente', userId)
                .limit(10);
            data = fallback.data;
            error = fallback.error;
        }

        if(error) throw error;
        renderizarHistoricoEncomendas(data);
    } catch(e) {
        console.error('Erro ao carregar histórico:', e);
        definirHistoricoVazio('Não foi possível carregar o histórico de encomendas.');
    }
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

async function carregarProdutosDaNuvem(){
    definirEstadoVitrine('A carregar minifiguras extraordinárias...');
    try{
        const clienteProdutos = produtosClient || dbClient;
        if(!clienteProdutos){
            throw new Error('Cliente Supabase indisponível.');
        }

        const listaProdutos = [];
        const tamanhoPagina = 500;
        let inicio = 0;

        while(true) {
            const query = clienteProdutos
                .from('produtos_loja')
                .select('id, sku, nome, preco, peso, tema, subtema, imagens, ativo, descontinuado')
                .order('tema', { ascending:true })
                .order('subtema', { ascending:true })
                .order('nome', { ascending:true })
                .order('id', { ascending:true })
                .range(inicio, inicio + tamanhoPagina - 1);

            const { data: pagina, error } = await executarComTimeout(
                query,
                20000,
                'Consulta de produtos demasiado lenta.'
            );

            if(error){ console.error(error); throw error; }
            if(!pagina || pagina.length === 0) break;

            listaProdutos.push(...pagina);
            if(pagina.length < tamanhoPagina) break;
            inicio += tamanhoPagina;
        }

        if(!listaProdutos || listaProdutos.length === 0){
            definirEstadoVitrine('Nenhum produto encontrado.', 'erro');
            return;
        }

        todosOsProdutos = listaProdutos;
        catalogoAdminCarregado = false;
        const produtosVisiveis = listaProdutos.filter(produto => produto.ativo !== false);
        gerarMenus(produtosVisiveis);
        gerarProdutos(produtosVisiveis);
        atualizarCarrinho();
    }catch(erro){
        console.error(erro);
        definirEstadoVitrine('Erro ao carregar produtos do Supabase: ' + (erro.message || 'sem detalhe disponível'), 'erro');
    }
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

function gerarMenus(listaProdutos){
    const menu = document.getElementById('menu-lateral-temas');
    if (!menu) return;
    menu.replaceChildren();

    const cabecalho = document.createElement('div');
    cabecalho.className = 'cabecalho-menu-temas';

    const tituloMenu = document.createElement('h2');
    tituloMenu.textContent = 'Temas';
    cabecalho.appendChild(tituloMenu);

    const toggleMenu = document.createElement('button');
    toggleMenu.className = 'btn-toggle-menu';
    toggleMenu.type = 'button';
    toggleMenu.textContent = 'Recolher';
    toggleMenu.onclick = function(){
        const recolhido = listaTemas.classList.toggle('recolhida');
        toggleMenu.textContent = recolhido ? 'Mostrar' : 'Recolher';
        agendarAtualizacaoStickyTemas();
    };
    cabecalho.appendChild(toggleMenu);
    menu.appendChild(cabecalho);

    const listaTemas = document.createElement('div');
    listaTemas.className = 'lista-temas';
    const iniciarRecolhido = window.matchMedia && window.matchMedia('(max-width: 560px)').matches;
    if (iniciarRecolhido) {
        listaTemas.classList.add('recolhida');
        toggleMenu.textContent = 'Mostrar';
    }
    menu.appendChild(listaTemas);

    const todosBtn = document.createElement('button');
    todosBtn.className = 'btn-tema ativo';
    todosBtn.textContent = 'Todos os Temas';
    todosBtn.onclick = function(){ filtrarTema('todos', this); };
    listaTemas.appendChild(todosBtn);

    const mapa = {};
    listaProdutos.forEach(prod => {
        const tema = (prod.tema || 'Outros').trim();
        const subtema = (prod.subtema && prod.subtema !== 'semsubtema') ? prod.subtema.trim() : '';
        if(!mapa[tema]){ mapa[tema] = []; }
        if(subtema && !mapa[tema].includes(subtema)){ mapa[tema].push(subtema); }
    });

    Object.keys(mapa).forEach(tema => {
        const temaId = tema.toLowerCase().replace(/\s+/g, '-');
        const linhaTema = document.createElement('div');
        linhaTema.className = 'linha-tema';

        const btnTema = document.createElement('button');
        btnTema.className = 'btn-tema';

        const nomeTema = document.createElement('span');
        nomeTema.textContent = tema;
        btnTema.appendChild(nomeTema);

        if(mapa[tema].length > 0){
            btnTema.classList.add('btn-tema-com-subtemas');
            const indicador = document.createElement('span');
            indicador.className = 'indicador-tema';
            indicador.textContent = '+';
            btnTema.appendChild(indicador);

            const group = document.createElement('div');
            group.className = 'grupo-subtemas';
            group.id = 'grupo-' + temaId;

            btnTema.onclick = function(){
                const estavaAberto = group.classList.contains('aberto');
                document.querySelectorAll('.grupo-subtemas').forEach(g => g.classList.remove('aberto'));
                document.querySelectorAll('.indicador-tema').forEach(i => i.textContent = '+');
                if(!estavaAberto){
                    group.classList.add('aberto');
                    indicador.textContent = '-';
                }
                filtrarTema(temaId, this);
                agendarAtualizacaoStickyTemas();
            };

            mapa[tema].forEach(subtema => {
                const subId = subtema.toLowerCase().replace(/\s+/g, '-');
                const btnSub = document.createElement('button');
                btnSub.className = 'btn-subtema';
                btnSub.textContent = subtema;
                btnSub.onclick = function(e){
                    e.stopPropagation();
                    filtrarTema(temaId + '|' + subId, this);
                };
                group.appendChild(btnSub);
            });
            linhaTema.appendChild(btnTema);
            linhaTema.appendChild(group);
        } else {
            btnTema.onclick = function(){ filtrarTema(temaId, this); };
            linhaTema.appendChild(btnTema);
        }

        listaTemas.appendChild(linhaTema);
    });

    observarTamanhoMenuTemas();
    agendarAtualizacaoStickyTemas();
}

function gerarProdutos(listaProdutos){
    const vitrine = document.getElementById('vitrine-produtos');
    if (!vitrine) return;
    vitrine.replaceChildren();

    listaProdutos.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'produto-card';
        card.dataset.id = prod.id;
        
        const nomeLimpo = (prod.nome || '').trim().toLowerCase();
        card.dataset.nome = nomeLimpo; 
        
        card.dataset.tema = (prod.tema || '').toLowerCase().replace(/\s+/g, '-');
        card.dataset.subtema = (prod.subtema || '').toLowerCase().replace(/\s+/g, '-');

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
        const imagemFallback = 'img/sem-imagem.png';
        const imagensOtimizadas = listaImagens.map(url => otimizarImagemCloudinary(url, 520));
        const imagemInicial = imagensOtimizadas[0] || imagemFallback;

        const imagemPrincipal = document.createElement('img');
        imagemPrincipal.className = 'produto-img';
        imagemPrincipal.loading = 'lazy';
        imagemPrincipal.decoding = 'async';
        imagemPrincipal.dataset.srcOriginal = imagemInicial;
        imagemPrincipal.addEventListener('load', () => {
            const iniciarPrecarregamento = () => {
                imagensOtimizadas.slice(1).forEach(precarregarImagemProduto);
            };
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(iniciarPrecarregamento, { timeout: 1200 });
            } else {
                setTimeout(iniciarPrecarregamento, 100);
            }
        }, { once:true });
        imagemPrincipal.src = imagemInicial;
        imagemPrincipal.onerror = () => {
            if (imagemPrincipal.src.indexOf(imagemFallback) === -1) {
                imagemPrincipal.src = imagemFallback;
            }
        };
        card.appendChild(imagemPrincipal);

        if (listaImagens.length > 1) {
            const miniaturasDiv = document.createElement('div');
            miniaturasDiv.className = 'produto-miniaturas';
            
            imagensOtimizadas.forEach((imagemOtimizada, index) => {
                const mini = document.createElement('button');
                mini.className = 'miniatura-img';
                mini.type = 'button';
                mini.title = 'Ver imagem ' + (index + 1);
                mini.textContent = index + 1;
                mini.addEventListener('pointerenter', () => precarregarImagemProduto(imagemOtimizada), { once:true });
                mini.addEventListener('focus', () => precarregarImagemProduto(imagemOtimizada), { once:true });
                mini.addEventListener('touchstart', () => precarregarImagemProduto(imagemOtimizada), { once:true, passive:true });
                mini.onclick = function() {
                    imagemPrincipal.dataset.srcOriginal = imagemOtimizada;
                    imagemPrincipal.src = imagemOtimizada;
                };
                miniaturasDiv.appendChild(mini);
            });
            card.appendChild(miniaturasDiv);
        }

        const category = document.createElement('div');
        category.className = 'categoria';
        category.innerText = prod.tema || 'Outros';
        card.appendChild(category);

        if(prod.subtema && prod.subtema !== 'semsubtema'){
            const subcategoria = document.createElement('div');
            subcategoria.className = 'subcategoria';
            subcategoria.innerText = prod.subtema;
            card.appendChild(subcategoria);
        }

        const titulo = document.createElement('h3');
        titulo.innerText = prod.nome || '';
        card.appendChild(titulo);

        const preco = document.createElement('div');
        preco.className = 'preco';
        preco.innerText = formatarEuro(prod.preco) + ' €';
        card.appendChild(preco);

        const btn = document.createElement('button');
        btn.className = 'btn-adicionar';
        btn.innerText = 'Adicionar ao Carrinho';
        btn.onclick = function(){ adicionarAoCarrinho(prod); };
        card.appendChild(btn);

        vitrine.appendChild(card);
    });

    executarFiltrosCombinados();
}

function guardarCarrinho() {
    localStorage.setItem('carrinho', JSON.stringify(carrinho));
}

function restaurarCarrinhoGuardado() {
    carrinho = carregarCarrinhoLocal();
    atualizarCarrinho();
}

function limparCarrinho() {
    carrinho = [];
    guardarCarrinho();
    atualizarCarrinho();
}



function recolherMenuTemasNoTelemovel() {
    if (!window.matchMedia || !window.matchMedia('(max-width: 560px)').matches) return;

    const listaTemas = document.querySelector('#menu-lateral-temas .lista-temas');
    const botaoToggle = document.querySelector('#menu-lateral-temas .btn-toggle-menu');
    if (!listaTemas) return;

    listaTemas.classList.add('recolhida');
    if (botaoToggle) botaoToggle.textContent = 'Mostrar';
    agendarAtualizacaoStickyTemas();
}

function filtrarTema(filtro, botao){
    document.querySelectorAll('.btn-tema, .btn-subtema').forEach(btn => { btn.classList.remove('ativo'); });
    botao.classList.add('ativo');

    filtroTemaAtual = filtro;

    if(filtro === 'todos'){
        document.querySelectorAll('.grupo-subtemas').forEach(g => { g.classList.remove('aberto'); });
        document.querySelectorAll('.indicador-tema').forEach(i => { i.textContent = '+'; });
    } else {
        const partes = filtro.split('|');
        const tema = partes[0];
        document.querySelectorAll('.grupo-subtemas').forEach(g => { if(g.id !== 'grupo-' + tema){ g.classList.remove('aberto'); } });
        document.querySelectorAll('.indicador-tema').forEach(i => {
            const linha = i.closest('.linha-tema');
            const grupo = linha ? linha.querySelector('.grupo-subtemas') : null;
            i.textContent = grupo && grupo.classList.contains('aberto') ? '-' : '+';
        });
        const grupoAlvo = document.getElementById('grupo-' + tema);
        if(grupoAlvo && partes.length === 1){ grupoAlvo.classList.add('aberto'); }
    }

    executarFiltrosCombinados();
    recolherMenuTemasNoTelemovel();
}

function verificarTeclaEnter(evento) {
    if (evento.key === "Enter") {
        evento.preventDefault();
        if (obterVistaPagina() !== 'loja') {
            const pesquisa = document.getElementById('campo-pesquisa')?.value.trim() || '';
            window.location.href = 'index.html' + (pesquisa ? '?q=' + encodeURIComponent(pesquisa) : '');
            return;
        }
        executarFiltrosCombinados();
    }
}

function atualizarContadorProdutos(totalVisiveis, totalProdutos, pesquisaAtiva) {
    const contador = document.getElementById('contador-produtos');
    if(!contador) return;

    const numero = pesquisaAtiva || filtroTemaAtual !== 'todos' ? totalVisiveis : totalProdutos;
    const legenda = pesquisaAtiva
        ? (numero === 1 ? 'produto encontrado' : 'produtos encontrados')
        : filtroTemaAtual !== 'todos'
            ? (numero === 1 ? 'produto neste filtro' : 'produtos neste filtro')
            : (numero === 1 ? 'produto na loja' : 'produtos na loja');

    contador.replaceChildren();
    const destaque = document.createElement('strong');
    destaque.textContent = Number(numero || 0).toLocaleString('pt-PT');
    contador.append(destaque, document.createTextNode(' ' + legenda));
}

function executarFiltrosCombinados() {
    const campoPesquisa = document.getElementById('campo-pesquisa');
    if (!campoPesquisa) return;
    const inputRaw = campoPesquisa.value || '';
    // Normaliza acentos e remove caracteres especiais
    const textoPesquisa = inputRaw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const pesquisaAtiva = textoPesquisa.length > 0;
    
    const todosOsCards = document.querySelectorAll('.produto-card');
    let totalVisiveis = 0;

    const partesTema = filtroTemaAtual.split('|');
    const temaAtivo = partesTema[0];
    const subtemaAtivo = partesTema[1] || null;

    todosOsCards.forEach(card => {
        let correspondeAoTema = false;
        if (pesquisaAtiva || filtroTemaAtual === 'todos') {
            correspondeAoTema = true;
        } else {
            const cardTema = card.dataset.tema || '';
            const cardSubtema = card.dataset.subtema || '';
            correspondeAoTema = subtemaAtivo 
                ? (cardTema === temaAtivo && cardSubtema === subtemaAtivo) 
                : (cardTema === temaAtivo);
        }

        const nomeCardBruto = card.dataset.nome || '';
        const nomeCardNormalizado = nomeCardBruto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const correspondeAoNome = nomeCardNormalizado.includes(textoPesquisa);

        const imagem = card.querySelector('.produto-img');

        if (correspondeAoTema && correspondeAoNome) {
            card.style.display = 'flex';
            if(imagem && imagem.dataset.srcOriginal && !imagem.src) {
                imagem.src = imagem.dataset.srcOriginal;
            }
            totalVisiveis++;
        } else {
            card.style.display = 'none';
            if(imagem) {
                imagem.removeAttribute('src');
            }
        }
    });

    const avisoExistente = document.getElementById('aviso-pesquisa-vazia');
    if (avisoExistente) avisoExistente.remove();

    atualizarContadorProdutos(totalVisiveis, todosOsCards.length, pesquisaAtiva);

    if (totalVisiveis === 0 && todosOsCards.length > 0) {
        const vitrine = document.getElementById('vitrine-produtos');
        const erroDiv = document.createElement('div');
        erroDiv.id = 'aviso-pesquisa-vazia';
        erroDiv.className = 'estado-vitrine erro';
        erroDiv.innerText = 'Nenhuma minifigura encontrada com esse nome.';
        vitrine.appendChild(erroDiv);
    }
}

function adicionarAoCarrinho(prod) {

    const itemExistente = carrinho.find(item => item.id === prod.id);

    if (itemExistente) {

        itemExistente.quantidade++;

    } else {

        carrinho.push({
            id: prod.id,
            nome: prod.nome,
            preco: prod.preco,
            peso: Number(prod.peso || PESO_PADRAO_PRODUTO_GRAMAS),
            imagem: obterImagemPrincipalProduto(prod),
            quantidade: 1
        });

    }

    guardarCarrinho();
    atualizarCarrinho();

}

function aumentarQuantidade(id) {

    const item = carrinho.find(p => p.id === id);

    if (item) {

        item.quantidade++;

        guardarCarrinho();

        atualizarCarrinho();

    }

}

function diminuirQuantidade(id) {

    const item = carrinho.find(p => p.id === id);

    if (!item) return;

    item.quantidade--;

    if (item.quantidade <= 0) {

        carrinho = carrinho.filter(
            p => p.id !== id
        );

    }

    guardarCarrinho();

    atualizarCarrinho();

}

function atualizarCarrinho() {
    atualizarContadorCarrinhoCabecalho();

const carrinhoDiv = document.getElementById("lista-carrinho");
    if (!carrinhoDiv) return;

    carrinhoDiv.replaceChildren();

    if(carrinho.length === 0){
        const vazio = document.createElement('p');
        vazio.id = 'carrinho-vazio';
        vazio.textContent = 'Nenhum produto adicionado.';
        carrinhoDiv.appendChild(vazio);
        atualizarOpcoesEnvio();
        return;
    }

    let subtotal = 0;

    let imagensCarrinhoAtualizadas = false;

    carrinho.forEach(item => {

        subtotal += Number(item.preco || 0) * item.quantidade;

        // linha principal
        const linha = document.createElement("div");
        linha.className = "linha-carrinho";

        const produtoCompleto = todosOsProdutos.find(produto => String(produto.id) === String(item.id));
        const imagemSrc = obterImagemAtualCarrinho(item, produtoCompleto);
        if(item.imagem !== imagemSrc) {
            item.imagem = imagemSrc;
            imagensCarrinhoAtualizadas = true;
        }

        const imagem = document.createElement("img");
        imagem.className = "imagem-carrinho";
        imagem.loading = "lazy";
        imagem.decoding = "async";
        imagem.src = otimizarImagemCloudinary(imagemSrc, 180);
        imagem.alt = item.nome;
        imagem.onerror = () => {
            if (imagem.src.indexOf('img/sem-imagem.png') === -1) {
                imagem.src = 'img/sem-imagem.png';
            }
        };

        // bloco nome + preço
        const info = document.createElement("div");
        info.className = "info-carrinho";

        const nome = document.createElement("strong");
        nome.textContent = item.nome;

        const preco = document.createElement("div");
        preco.className = "preco-carrinho";
        preco.textContent =
            formatarEuro(item.preco * item.quantidade) + " €";

        info.appendChild(nome);
        info.appendChild(document.createElement("br"));
        info.appendChild(preco);

        // bloco dos botões
        const botoes = document.createElement("div");
        botoes.className = "controlos-carrinho";

        // botão -
        const btnMenos = document.createElement("button");
        btnMenos.className = "btn-quantidade";
        btnMenos.textContent = "-";
        btnMenos.setAttribute("aria-label", "Diminuir quantidade");
        btnMenos.onclick = () => diminuirQuantidade(item.id);

        // quantidade
        const quantidade = document.createElement("span");
        quantidade.className = "quantidade-carrinho";
        quantidade.textContent = item.quantidade;

        // botão +
        const btnMais = document.createElement("button");
        btnMais.className = "btn-quantidade";
        btnMais.textContent = "+";
        btnMais.setAttribute("aria-label", "Aumentar quantidade");
        btnMais.onclick = () => aumentarQuantidade(item.id);

        // botão remover
        const btnRemover = document.createElement("button");
        btnRemover.className = "btn-remover";
        btnRemover.textContent = "X";
        btnRemover.setAttribute("aria-label", "Remover produto");
        btnRemover.onclick = () => removerCarrinho(item.id);

        botoes.appendChild(btnMenos);
        botoes.appendChild(quantidade);
        botoes.appendChild(btnMais);
        botoes.appendChild(btnRemover);

        linha.appendChild(imagem);
        linha.appendChild(info);
        linha.appendChild(botoes);

        carrinhoDiv.appendChild(linha);

    });

    if(imagensCarrinhoAtualizadas) {
        guardarCarrinho();
    }

document.getElementById("subtotal").textContent =
    formatarEuro(subtotal) + " €";

atualizarOpcoesEnvio();

}

function removerCarrinho(id) {

    carrinho = carrinho.filter(
        item => item.id !== id
    );

    guardarCarrinho();

    atualizarCarrinho();

}

function calcularPesoTotalCarrinho() {
    return carrinho.reduce((total, item) => {
        const pesoUnitario = Number(item.peso || PESO_PADRAO_PRODUTO_GRAMAS);
        const quantidade = Number(item.quantidade || 1);
        return total + (pesoUnitario * quantidade);
    }, 0);
}

function obterEscalaoEnvio(paisEnvio, pesoTotal) {
    const zonaEnvio = obterZonaPortesPorPais(paisEnvio);
    const tabela = TABELA_PORTES_POR_PESO[zonaEnvio] || TABELA_PORTES_POR_PESO.portugal;
    return tabela.find(linha => pesoTotal <= linha.ate) || tabela[tabela.length - 1];
}

function obterOpcoesEnvio(paisEnvio, pesoTotal) {
    if (pesoTotal <= 0) return [];
    return obterEscalaoEnvio(paisEnvio, pesoTotal).opcoes;
}

function obterOpcaoEnvioSelecionada(paisEnvio, pesoTotal, metodoEnvio) {
    const opcoes = obterOpcoesEnvio(paisEnvio, pesoTotal);
    return opcoes.find(opcao => opcao.id === metodoEnvio) || opcoes[0] || { id: '', nome: '', valor: 0 };
}

function valorPortesComIva(valorBase) {
    return Math.round(Number(valorBase || 0) * 100) / 100;
}

function atualizarAvisoEnvio(metodoEnvio) {
    const aviso = document.getElementById('aviso-envio-nao-registado');
    if(!aviso) return;

    const mostrarAviso = metodoEnvio === 'ctt_normal' || metodoEnvio === 'ctt_azul';
    aviso.textContent = mostrarAviso
        ? 'Recomendado o Envio Registado. Não nos responsabilizamos pelo extravio de encomendas.'
        : '';
}

function atualizarOpcoesEnvio() {
    const selectPais = document.getElementById('pais-envio');
    const selectMetodo = document.getElementById('metodo-envio');
    const infoEnvio = document.getElementById('info-envio');
    if(!selectPais || !selectMetodo) return;

    const metodoAnterior = selectMetodo.value;
    const pesoTotal = calcularPesoTotalCarrinho();
    const opcoes = obterOpcoesEnvio(selectPais.value, pesoTotal);
    selectMetodo.replaceChildren();

    if(opcoes.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Adicione produtos para calcular o envio';
        selectMetodo.appendChild(option);
        if(infoEnvio) infoEnvio.textContent = '';
        recalcularTotais();
        return;
    }

    opcoes.forEach(opcao => {
        const option = document.createElement('option');
        option.value = opcao.id;
        option.textContent = opcao.nome + ' - ' + formatarEuro(valorPortesComIva(opcao.valor)) + ' \u20ac';
        selectMetodo.appendChild(option);
    });

    const metodoAindaDisponivel = opcoes.some(opcao => opcao.id === metodoAnterior);
    const metodoRegistado = opcoes.find(opcao => opcao.id === 'ctt_registado');
    selectMetodo.value = metodoAindaDisponivel ? metodoAnterior : (metodoRegistado?.id || opcoes[0].id);
    if(infoEnvio) infoEnvio.textContent = '';
    recalcularTotais();
}

function recalcularTotais(){
    let subtotal = 0;
    carrinho.forEach(item => { subtotal += Number(item.preco || 0) * item.quantidade; });

    const paisEnvio = document.getElementById('pais-envio')?.value || 'portugal';
    const metodoEnvio = document.getElementById('metodo-envio')?.value || '';
    const pesoTotal = calcularPesoTotalCarrinho();
    const opcaoEnvio = obterOpcaoEnvioSelecionada(paisEnvio, pesoTotal, metodoEnvio);
    const portes = valorPortesComIva(opcaoEnvio.valor);
    atualizarAvisoEnvio(opcaoEnvio.id);

    document.getElementById('subtotal').innerText = formatarEuro(subtotal) + ' \u20ac';
    document.getElementById('portes').innerText = formatarEuro(portes) + ' \u20ac';
    document.getElementById('total').innerText = formatarEuro(subtotal + portes) + ' \u20ac';

    return {
        subtotal,
        portes,
        total: subtotal + portes,
        regiao: paisEnvio,
        paisEnvio,
        metodoEnvio: opcaoEnvio.id,
        metodoEnvioNome: opcaoEnvio.nome,
        pesoTotal
    };
}

async function criarNovaEncomenda() {
  const statusDiv = document.getElementById('status-encomenda');
  statusDiv.className = "msg-status";
  statusDiv.innerText = "A processar encomenda...";

  if (carrinho.length === 0) {
    statusDiv.className = "msg-status msg-erro";
    statusDiv.innerText = "O seu carrinho está vazio. Adicione pelo menos um produto antes de finalizar.";
    return;
  }

  const { data: { user }, error: authError } = await dbClient.auth.getUser();

  if (authError || !user) {
    console.error("Erro de Autenticação:", authError);
    statusDiv.className = "msg-status msg-erro";
    statusDiv.innerText = "Necessita de iniciar sessão ou registar-se na secção Minha Conta para finalizar a encomenda.";
    return;
  }

  if (user.email_confirmed_at === null) {
    statusDiv.className = "msg-status msg-erro";
    statusDiv.innerText = "Confirme o seu e-mail antes de finalizar a encomenda.";
    return;
  }

  const totais = recalcularTotais();

  const metodoPagamento = obterMetodoPagamentoSelecionado();

  const itensPedido = carrinho.map(item => ({
    id_produto: item.id,
    quantidade: Number(item.quantidade || 1)
  }));

  try {
    const { data: { session } } = await dbClient.auth.getSession();
    if(!session?.access_token){
      throw new Error("Sessão inválida. Faça login novamente.");
    }

    const resposta = await executarComTimeout(
      fetch(`${SUPABASE_URL}/functions/v1/criar-encomenda`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          itens: itensPedido,
          regiao: totais.paisEnvio,
          metodo_envio: totais.metodoEnvio,
          metodo_envio_nome: totais.metodoEnvioNome,
          metodo_pagamento: metodoPagamento
        })
      }),
      30000,
      "O checkout demorou demasiado. Tente novamente."
    );

    const resultado = await resposta.json().catch(() => ({}));

    if(!resposta.ok || !resultado.sucesso){
      const produtosSemStock = Array.isArray(resultado.produtos_sem_stock)
        ? resultado.produtos_sem_stock
            .map(item => String(item?.nome || '').trim())
            .filter(Boolean)
        : [];
      const mensagemStock = produtosSemStock.length > 0
        ? `Stock insuficiente para: ${produtosSemStock.join(', ')}. Atualize o carrinho e tente novamente.`
        : '';
      throw new Error(mensagemStock || resultado.error || "Não foi possível criar a encomenda.");
    }

    console.log("Encomenda gravada com sucesso:", resultado);
    mostrarMensagem(
      statusDiv,
      mensagemSucessoEncomenda(metodoPagamento, resultado.encomenda?.codigo_encomenda || ''),
      "msg-sucesso"
    );
    
    carrinho = [];
    guardarCarrinho();
    atualizarCarrinho();
    await carregarProdutosConformeUtilizador();
    carregarHistoricoEncomendas(user.id);

  } catch (err) {
    console.error("Erro ao gravar encomenda:", err.message);
    statusDiv.className = "msg-status msg-erro";
    statusDiv.innerText = "Erro ao guardar: " + err.message;
  }
}
