const SUPABASE_URL = "https://gksndzxadndrsynvzgzb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrc25kenhhZG5kcnN5bnZ6Z3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc5NzMsImV4cCI6MjA5NDY2Mzk3M30.EHZgacYr27dqoc4CJHsOwkNnJFGlLIteSHBi4B1HfVE";
const CLOUDINARY_CLOUD_NAME = "ddzgmr4eb";
const CLOUDINARY_UPLOAD_PRESET = "worldminifigures4u_unsigned";
const URL_PUBLICO_FALLBACK = "https://figuresplanet.com/";
const ADMIN_EMAILS = ["worldminifigures4u@gmail.com"];
const PESO_PADRAO_PRODUTO_GRAMAS = 10;
const IVA_PORTES = 0.23;
const TABELA_PORTES_POR_PESO = {
    portugal: [
        { ate: 100, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 1.58 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 2.10 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 4.60 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 4.76 }
        ]},
        { ate: 500, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 2.34 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 3.90 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 5.40 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 4.76 }
        ]},
        { ate: Infinity, opcoes: [
            { id: 'ctt_normal', nome: 'CTT Normal', valor: 5.55 },
            { id: 'ctt_azul', nome: 'CTT Azul', valor: 7.80 },
            { id: 'ctt_registado', nome: 'CTT Registado', valor: 8.93 },
            { id: 'inpost_registado', nome: 'InPost Registado', valor: 5.42 }
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
    ],
    resto_mundo: [
        { ate: 100, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 6.55 }] },
        { ate: 250, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 9.30 }] },
        { ate: 500, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 14.15 }] },
        { ate: 1000, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 23.95 }] },
        { ate: Infinity, opcoes: [{ id: 'ctt_registado', nome: 'CTT Registado', valor: 36.15 }] }
    ]
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
    nomeEl.textContent = nomeLimpo;
    nomeEl.style.display = nomeLimpo ? 'inline' : 'none';
}

function atualizarContadorCarrinhoCabecalho() {
    const contador = document.getElementById('contador-carrinho-cabecalho');
    if (!contador) return;

    const totalItens = carrinho.reduce((total, item) => total + Number(item.quantidade || 0), 0);
    contador.textContent = totalItens;
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
                    document.getElementById('conteudo-cliente-autenticado').style.display = 'none';
                    document.getElementById('conteudo-cliente-anonimo').style.display = 'block';
                    atualizarCabecalhoCliente();
                }
            }, 0);
        });
        await carregarProdutosDaNuvem();
        aplicarPesquisaUrl();
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
                mostrarMensagem(statusDiv, "⚠️ E-mail não confirmado!\nPor favor, aceda à sua caixa de correio e clique no link de validação enviado para poder iniciar sessão.", "msg-erro");
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

            mostrarMensagem(statusDiv, "📧 Registo efetuado!\nEnviámos um link de confirmação para o seu e-mail. Ative a conta antes de tentar fazer login.", "msg-sucesso");
            
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

        if (error) {
            document.getElementById('conteudo-cliente-anonimo').style.display = 'none';
            document.getElementById('conteudo-cliente-autenticado').style.display = 'block';
            preencherFormularioDadosCliente({}, user);
            atualizarVisibilidadeAdmin(user);
            restaurarCarrinhoGuardado();
            carregarHistoricoEncomendas(userId);
            return;
        }

        if (data) {
            document.getElementById('conteudo-cliente-anonimo').style.display = 'none';
            document.getElementById('conteudo-cliente-autenticado').style.display = 'block';
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
    document.getElementById('conteudo-cliente-autenticado').style.display = 'none';
    document.getElementById('conteudo-cliente-anonimo').style.display = 'block';
    document.getElementById('status-cliente').innerText = '';
    atualizarCabecalhoCliente();
    definirHistoricoVazio('Entre na conta para carregar o histórico.');
    mudarAba('login');
    await carregarProdutosDaNuvem();
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

let importacaoStockPendente = null;
let importacaoCatalogoPendente = null;

function utilizadorAdmin(user) {
    const email = String(user?.email || '').toLowerCase();
    return ADMIN_EMAILS.includes(email);
}

function atualizarVisibilidadeAdmin(user) {
    const painel = document.getElementById('painel-admin');
    const adminAtivo = utilizadorAdmin(user);
    const atalhosAnuncio = document.querySelectorAll('.acao-anuncio-admin');
    atalhosAnuncio.forEach(atalho => { atalho.hidden = !adminAtivo; });
    document.querySelector('.acoes-cabecalho')?.classList.toggle('com-anuncio-admin', adminAtivo);
    if(!painel) return;
    const zonaEliminacao = document.getElementById('zona-eliminacao-conta');
    painel.style.display = adminAtivo ? 'block' : 'none';
    if(zonaEliminacao) zonaEliminacao.style.display = adminAtivo ? 'none' : 'block';
    if(adminAtivo) {
        const conteudoConta = document.getElementById('conteudo-cliente-autenticado');
        const dadosPessoais = document.getElementById('form-editar-dados-cliente')?.closest('.historico-encomendas');
        const gestaoProdutos = painel.querySelector('.admin-seccao');
        const tituloAdicionarProduto = painel.querySelector(':scope > h3');

        if(conteudoConta && dadosPessoais) {
            conteudoConta.insertBefore(painel, dadosPessoais);
        }

        if(gestaoProdutos && tituloAdicionarProduto) {
            tituloAdicionarProduto.textContent = 'Adicionar produto';
            painel.insertBefore(gestaoProdutos, tituloAdicionarProduto);
        }

        carregarProdutosAdminDaNuvem().catch(error => {
            console.error('Erro ao carregar catálogo administrativo:', error);
        });
    } else {
        catalogoAdminCarregado = false;
        cancelarEdicaoProdutoAdmin();
    }
}

function normalizarCabecalhoStock(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function criarIndicadorImportacaoStock(valor, legenda) {
    const bloco = document.createElement('div');
    const numero = document.createElement('strong');
    numero.textContent = String(valor);
    const texto = document.createElement('span');
    texto.textContent = legenda;
    bloco.append(numero, texto);
    return bloco;
}

function renderizarResumoImportacaoStock(resultado) {
    const resumo = document.getElementById('resumo-importacao-stock');
    const detalhes = document.getElementById('detalhes-importacao-stock');
    if(!resumo || !detalhes) return;

    resumo.replaceChildren(
        criarIndicadorImportacaoStock(resultado.totalLinhas, 'SKUs no ficheiro'),
        criarIndicadorImportacaoStock(resultado.alteracoes.length, 'Alterações'),
        criarIndicadorImportacaoStock(resultado.aumentos, 'Aumentam'),
        criarIndicadorImportacaoStock(resultado.reducoes, 'Diminuem'),
        criarIndicadorImportacaoStock(resultado.desativados, 'Ficam inativos'),
        criarIndicadorImportacaoStock(resultado.naoEncontrados.length, 'Não encontrados')
    );
    resumo.style.display = 'grid';

    detalhes.replaceChildren();
    const linhas = [];
    resultado.alteracoes.slice(0, 60).forEach(item => {
        linhas.push(`${item.sku} | ${item.nome} | ${item.stockAtual} → ${item.stockNovo} | ${item.ativoNovo ? 'ativo' : 'inativo'}`);
    });
    resultado.naoEncontrados.slice(0, 30).forEach(item => {
        linhas.push(`${item.sku} | não encontrado no Supabase`);
    });
    if(resultado.ausentesNoFicheiro.length > 0) {
        linhas.push(`${resultado.ausentesNoFicheiro.length} produto(s) do Supabase não constam do ficheiro e não serão alterados.`);
    }
    if(resultado.invalidos.length > 0) {
        linhas.push(`${resultado.invalidos.length} linha(s) foram ignoradas por SKU ou stock inválido.`);
    }

    linhas.forEach(linha => {
        const div = document.createElement('div');
        div.textContent = linha;
        detalhes.appendChild(div);
    });
    detalhes.style.display = linhas.length ? 'block' : 'none';
}

async function analisarFicheiroStockAdmin(input) {
    const status = document.getElementById('status-importacao-stock');
    const botao = document.getElementById('btn-confirmar-importacao-stock');
    importacaoStockPendente = null;
    if(botao) botao.disabled = true;

    try {
        const ficheiro = input.files?.[0];
        if(!ficheiro) return;
        if(typeof XLSX === 'undefined') {
            throw new Error('O leitor de folhas de cálculo não foi carregado. Atualize a página e tente novamente.');
        }

        mostrarMensagem(status, 'A analisar o ficheiro de stock...');
        const conteudo = await ficheiro.arrayBuffer();
        const workbook = XLSX.read(conteudo, { type:'array' });
        const primeiraFolha = workbook.Sheets[workbook.SheetNames[0]];
        const linhas = XLSX.utils.sheet_to_json(primeiraFolha, { header:1, defval:null, raw:true });
        const indiceCabecalho = linhas.findIndex(linha => {
            const cabecalhos = linha.map(normalizarCabecalhoStock);
            return cabecalhos.includes('sku') && cabecalhos.includes('stock');
        });

        if(indiceCabecalho < 0) {
            throw new Error('Não foram encontradas as colunas sku e stock.');
        }

        const cabecalhos = linhas[indiceCabecalho].map(normalizarCabecalhoStock);
        const colunaSku = cabecalhos.indexOf('sku');
        const colunaStock = cabecalhos.indexOf('stock');
        const stockPorSku = new Map();
        const invalidos = [];

        linhas.slice(indiceCabecalho + 1).forEach((linha, indice) => {
            const sku = normalizarTextoSku(linha[colunaSku]).replace(/[^A-Z0-9]/g, '');
            const stock = Number(linha[colunaStock]);
            if(!sku || !Number.isInteger(stock) || stock < 0) {
                if(linha.some(valor => valor !== null && valor !== '')) invalidos.push(indice + indiceCabecalho + 2);
                return;
            }
            stockPorSku.set(sku, stock);
        });

        const produtosPorSku = new Map(todosOsProdutos.map(produto => [String(produto.sku || '').trim().toUpperCase(), produto]));
        const alteracoes = [];
        const naoEncontrados = [];
        let aumentos = 0;
        let reducoes = 0;
        let desativados = 0;

        stockPorSku.forEach((stockNovo, sku) => {
            const produto = produtosPorSku.get(sku);
            if(!produto) {
                naoEncontrados.push({ sku, stock:stockNovo });
                return;
            }

            const stockAtual = Number(produto.stock || 0);
            const ativoAtual = produto.ativo !== false;
            const ativoNovo = stockNovo > 0;
            if(stockAtual !== stockNovo || ativoAtual !== ativoNovo) {
                alteracoes.push({
                    sku,
                    nome:produto.nome || '',
                    stockAtual,
                    stockNovo,
                    ativoNovo
                });
                if(stockNovo > stockAtual) aumentos += 1;
                if(stockNovo < stockAtual) reducoes += 1;
                if(!ativoNovo) desativados += 1;
            }
        });

        const ausentesNoFicheiro = todosOsProdutos
            .filter(produto => !stockPorSku.has(String(produto.sku || '').trim().toUpperCase()))
            .map(produto => produto.sku);

        importacaoStockPendente = {
            nomeFicheiro:ficheiro.name,
            totalLinhas:stockPorSku.size,
            alteracoes,
            naoEncontrados,
            ausentesNoFicheiro,
            invalidos,
            aumentos,
            reducoes,
            desativados
        };

        renderizarResumoImportacaoStock(importacaoStockPendente);
        if(botao) botao.disabled = alteracoes.length === 0;
        mostrarMensagem(
            status,
            alteracoes.length > 0
                ? `Análise concluída. Confirme para atualizar ${alteracoes.length} produto(s).`
                : 'Análise concluída. O stock já está atualizado.',
            'msg-sucesso'
        );
    } catch(error) {
        console.error('Erro ao analisar stock:', error);
        mostrarMensagem(status, 'Erro: ' + (error.message || 'Não foi possível ler o ficheiro.'), 'msg-erro');
    }
}

async function confirmarImportacaoStockAdmin() {
    const status = document.getElementById('status-importacao-stock');
    const botao = document.getElementById('btn-confirmar-importacao-stock');
    const importacao = importacaoStockPendente;
    if(!importacao || importacao.alteracoes.length === 0) return;

    try {
        const { data: { user }, error: authError } = await dbClient.auth.getUser();
        if(authError || !utilizadorAdmin(user)) {
            throw new Error('Apenas o administrador pode atualizar o stock.');
        }

        botao.disabled = true;
        const erros = [];
        let atualizados = 0;
        const tamanhoLote = 8;

        for(let inicio = 0; inicio < importacao.alteracoes.length; inicio += tamanhoLote) {
            const lote = importacao.alteracoes.slice(inicio, inicio + tamanhoLote);
            const resultados = await Promise.all(lote.map(async item => {
                const { data, error } = await dbClient
                    .from('produtos')
                    .update({ stock:item.stockNovo, ativo:item.ativoNovo })
                    .eq('sku', item.sku)
                    .select('sku');
                if(error) throw error;
                if(!data || data.length === 0) throw new Error('Produto não atualizado.');
                return item.sku;
            }));

            resultados.forEach(sku => {
                if(sku) atualizados += 1;
                else erros.push('SKU desconhecido');
            });
            mostrarMensagem(status, `A atualizar stock: ${atualizados}/${importacao.alteracoes.length}`);
        }

        if(erros.length > 0) {
            throw new Error(`${erros.length} produto(s) não foram atualizados.`);
        }

        mostrarMensagem(status, `${atualizados} produto(s) atualizados com sucesso.`, 'msg-sucesso');
        importacaoStockPendente = null;
        await carregarProdutosAdminDaNuvem();
    } catch(error) {
        console.error('Erro ao atualizar stock:', error);
        botao.disabled = false;
        mostrarMensagem(status, 'Erro: ' + (error.message || 'Não foi possível atualizar o stock.'), 'msg-erro');
    }
}

function lerFolhaMapas(conteudo) {
    if(typeof XLSX === 'undefined') {
        throw new Error('O leitor de folhas de cálculo não foi carregado. Atualize a página e tente novamente.');
    }

    const workbook = XLSX.read(conteudo, { type:'array' });
    const primeiraFolha = workbook.Sheets[workbook.SheetNames[0]];
    const linhas = XLSX.utils.sheet_to_json(primeiraFolha, { header:1, defval:null, raw:true });
    const indiceCabecalho = linhas.findIndex(linha => {
        const cabecalhos = linha.map(normalizarCabecalhoStock);
        return cabecalhos.includes('sku') && cabecalhos.includes('stock') && cabecalhos.includes('nome');
    });

    if(indiceCabecalho < 0) {
        throw new Error('Não foram encontradas as colunas nome, sku e stock.');
    }

    return {
        linhas:linhas.slice(indiceCabecalho + 1),
        cabecalhos:linhas[indiceCabecalho].map(normalizarCabecalhoStock),
        primeiraLinhaDados:indiceCabecalho + 2
    };
}

function obterIndiceColuna(cabecalhos, nome, obrigatoria = true) {
    const indice = cabecalhos.indexOf(nome);
    if(indice < 0 && obrigatoria) {
        throw new Error(`Não foi encontrada a coluna ${nome}.`);
    }
    return indice;
}

function renderizarResumoImportacaoCatalogo(resultado) {
    const resumo = document.getElementById('resumo-importacao-catalogo');
    const detalhes = document.getElementById('detalhes-importacao-catalogo');
    if(!resumo || !detalhes) return;

    resumo.replaceChildren(
        criarIndicadorImportacaoStock(resultado.produtos.length, 'Produtos válidos'),
        criarIndicadorImportacaoStock(resultado.novos.length, 'Novos'),
        criarIndicadorImportacaoStock(resultado.existentes.length, 'Atualizados'),
        criarIndicadorImportacaoStock(resultado.remover.length, 'A remover'),
        criarIndicadorImportacaoStock(resultado.ativos, 'Ativos'),
        criarIndicadorImportacaoStock(resultado.inativos, 'Inativos')
    );
    resumo.style.display = 'grid';

    detalhes.replaceChildren();
    const linhas = [
        `${resultado.produtos.length} produtos serão importados do ficheiro.`,
        `${resultado.novos.length} produtos serão adicionados.`,
        `${resultado.existentes.length} produtos existentes serão atualizados por SKU.`,
        `${resultado.remover.length} produtos atuais não constam do ficheiro e serão removidos.`
    ];
    if(resultado.invalidos.length) linhas.push(`${resultado.invalidos.length} linha(s) inválida(s) foram ignoradas.`);
    resultado.remover.slice(0, 30).forEach(produto => linhas.push(`Remover: ${produto.sku} | ${produto.nome || ''}`));

    linhas.forEach(linha => {
        const div = document.createElement('div');
        div.textContent = linha;
        detalhes.appendChild(div);
    });
    detalhes.style.display = 'block';
}

function atualizarConfirmacaoCatalogoAdmin() {
    const botao = document.getElementById('btn-confirmar-importacao-catalogo');
    const confirmacao = document.getElementById('confirmacao-substituir-catalogo')?.value.trim().toUpperCase();
    if(botao) {
        botao.disabled = !importacaoCatalogoPendente || confirmacao !== 'SUBSTITUIR';
    }
}

async function analisarFicheiroCatalogoAdmin(input) {
    const status = document.getElementById('status-importacao-catalogo');
    importacaoCatalogoPendente = null;
    atualizarConfirmacaoCatalogoAdmin();

    try {
        const ficheiro = input.files?.[0];
        if(!ficheiro) return;
        mostrarMensagem(status, 'A analisar o catálogo completo...');

        const conteudo = await ficheiro.arrayBuffer();
        const { linhas, cabecalhos, primeiraLinhaDados } = lerFolhaMapas(conteudo);
        const colunas = {
            nome:obterIndiceColuna(cabecalhos, 'nome'),
            preco:obterIndiceColuna(cabecalhos, 'preco'),
            sku:obterIndiceColuna(cabecalhos, 'sku'),
            stock:obterIndiceColuna(cabecalhos, 'stock'),
            tema:obterIndiceColuna(cabecalhos, 'tema'),
            subtema:obterIndiceColuna(cabecalhos, 'subtema', false),
            peso:obterIndiceColuna(cabecalhos, 'peso')
        };

        const produtosPorSku = new Map();
        const invalidos = [];

        linhas.forEach((linha, indice) => {
            if(!linha.some(valor => valor !== null && valor !== '')) return;
            const nome = String(linha[colunas.nome] || '').trim();
            const sku = normalizarTextoSku(linha[colunas.sku]).replace(/[^A-Z0-9]/g, '');
            const preco = Number(linha[colunas.preco]);
            const stock = Number(linha[colunas.stock]);
            const tema = String(linha[colunas.tema] || '').trim();
            const subtema = colunas.subtema >= 0 ? String(linha[colunas.subtema] || '').trim() : '';
            const peso = Number(linha[colunas.peso]);

            if(!nome || !sku || !tema || !Number.isFinite(preco) || preco < 0 || !Number.isInteger(stock) || stock < 0 || !Number.isFinite(peso) || peso < 1 || produtosPorSku.has(sku)) {
                invalidos.push(indice + primeiraLinhaDados);
                return;
            }

            produtosPorSku.set(sku, {
                nome,
                preco,
                sku,
                stock,
                tema,
                subtema:subtema || 'semsubtema',
                peso,
                ativo:stock > 0
            });
        });

        if(produtosPorSku.size === 0) {
            throw new Error('O ficheiro não contém produtos válidos.');
        }
        if(invalidos.length > 0) {
            throw new Error(`Foram encontradas ${invalidos.length} linha(s) inválida(s). Corrija o ficheiro antes de substituir o catálogo.`);
        }

        const atuaisPorSku = new Map(todosOsProdutos.map(produto => [String(produto.sku || '').trim().toUpperCase(), produto]));
        const produtos = [...produtosPorSku.values()];
        const novos = produtos.filter(produto => !atuaisPorSku.has(produto.sku));
        const existentes = produtos.filter(produto => atuaisPorSku.has(produto.sku));
        const remover = todosOsProdutos.filter(produto => !produtosPorSku.has(String(produto.sku || '').trim().toUpperCase()));

        importacaoCatalogoPendente = {
            nomeFicheiro:ficheiro.name,
            produtos,
            novos,
            existentes,
            remover,
            invalidos,
            ativos:produtos.filter(produto => produto.ativo).length,
            inativos:produtos.filter(produto => !produto.ativo).length
        };

        renderizarResumoImportacaoCatalogo(importacaoCatalogoPendente);
        atualizarConfirmacaoCatalogoAdmin();
        mostrarMensagem(status, 'Análise concluída. Reveja o resumo antes de confirmar.', 'msg-sucesso');
    } catch(error) {
        console.error('Erro ao analisar catálogo:', error);
        mostrarMensagem(status, 'Erro: ' + (error.message || 'Não foi possível analisar o catálogo.'), 'msg-erro');
    }
}

function descarregarBackupCatalogoAdmin() {
    const conteudo = JSON.stringify({ criadoEm:new Date().toISOString(), produtos:todosOsProdutos }, null, 2);
    const blob = new Blob([conteudo], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `catalogo-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function confirmarImportacaoCatalogoAdmin() {
    const status = document.getElementById('status-importacao-catalogo');
    const botao = document.getElementById('btn-confirmar-importacao-catalogo');
    const importacao = importacaoCatalogoPendente;
    const confirmacao = document.getElementById('confirmacao-substituir-catalogo')?.value.trim().toUpperCase();
    if(!importacao || confirmacao !== 'SUBSTITUIR') return;

    try {
        const { data: { user }, error:authError } = await dbClient.auth.getUser();
        if(authError || !utilizadorAdmin(user)) {
            throw new Error('Apenas o administrador pode substituir o catálogo.');
        }

        botao.disabled = true;
        descarregarBackupCatalogoAdmin();
        mostrarMensagem(status, 'Backup criado. A importar o novo catálogo...');

        const tamanhoLote = 100;
        let importados = 0;
        for(let inicio = 0; inicio < importacao.produtos.length; inicio += tamanhoLote) {
            const lote = importacao.produtos.slice(inicio, inicio + tamanhoLote);
            const { data, error } = await dbClient.rpc('importar_produtos_admin', {
                p_produtos:lote
            });
            if(error) throw error;
            const quantidadeImportada = Number(data?.importados || 0);
            if(quantidadeImportada !== lote.length) {
                throw new Error('Nem todos os produtos do lote foram importados.');
            }
            importados += quantidadeImportada;
            mostrarMensagem(status, `A importar catálogo: ${importados}/${importacao.produtos.length}`);
        }

        let removidos = 0;
        const skusRemover = importacao.remover.map(produto => String(produto.sku || '').trim()).filter(Boolean);
        for(let inicio = 0; inicio < skusRemover.length; inicio += 50) {
            const lote = skusRemover.slice(inicio, inicio + 50);
            const { data, error } = await dbClient.rpc('remover_produtos_admin', {
                p_skus:lote
            });
            if(error) throw error;
            removidos += Number(data?.removidos || 0);
            mostrarMensagem(status, `Catálogo importado. A remover produtos antigos: ${removidos}/${skusRemover.length}`);
        }

        if(removidos !== skusRemover.length) {
            throw new Error('Alguns produtos antigos não foram removidos. Verifique a policy DELETE no Supabase.');
        }

        importacaoCatalogoPendente = null;
        document.getElementById('confirmacao-substituir-catalogo').value = '';
        await carregarProdutosAdminDaNuvem();
        mostrarMensagem(status, `${importados} produtos importados e ${removidos} produtos antigos removidos.`, 'msg-sucesso');
    } catch(error) {
        console.error('Erro ao substituir catálogo:', error);
        botao.disabled = false;
        mostrarMensagem(status, 'Erro: ' + (error.message || 'Não foi possível substituir o catálogo.'), 'msg-erro');
    }
}

function sugerirSkuAdmin() {
    const nomeInput = document.getElementById('admin-produto-nome');
    const skuInput = document.getElementById('admin-produto-sku');
    if(!nomeInput || !skuInput) return;

    const nome = nomeInput.value.trim();
    if(!nome) {
        skuInput.value = '';
        return;
    }

    skuInput.value = gerarSkuProduto(nome);
}

function obterUrlsImagensAdmin() {
    const textarea = document.getElementById('admin-produto-imagens');
    if(!textarea) return [];
    return textarea.value
        .split(/[\n,]+/)
        .map(url => url.trim())
        .filter(url => url.length > 0);
}

function reordenarUrlsImagensAdmin(textareaId, origem, destino, atualizarPreview) {
    const textarea = document.getElementById(textareaId);
    if(!textarea || origem === destino || origem < 0 || destino < 0) return;

    const urls = textarea.value
        .split(/[\n,]+/)
        .map(url => url.trim())
        .filter(Boolean);

    if(origem >= urls.length || destino >= urls.length) return;
    const [urlMovido] = urls.splice(origem, 1);
    urls.splice(destino, 0, urlMovido);
    textarea.value = urls.join('\n');
    atualizarPreview();
}

function criarPreviewOrdenavelImagens(preview, urls, textareaId, atualizarPreview) {
    preview.replaceChildren();

    urls.slice(0, 12).forEach((url, index) => {
        const item = document.createElement('div');
        item.className = 'item-preview-imagem-admin';
        item.draggable = true;
        item.dataset.indiceImagem = String(index);
        item.title = 'Arraste para alterar a ordem';

        const imagem = document.createElement('img');
        imagem.src = otimizarImagemCloudinary(url, 240);
        imagem.alt = 'Imagem ' + (index + 1);
        imagem.loading = 'lazy';
        imagem.onerror = () => { item.style.display = 'none'; };
        item.appendChild(imagem);

        if(index === 0) {
            const etiqueta = document.createElement('span');
            etiqueta.className = 'etiqueta-imagem-principal';
            etiqueta.textContent = 'Principal';
            item.appendChild(etiqueta);
        }

        item.addEventListener('dragstart', event => {
            item.classList.add('arrastando');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(index));
        });
        item.addEventListener('dragend', () => {
            preview.querySelectorAll('.item-preview-imagem-admin').forEach(elemento => {
                elemento.classList.remove('arrastando', 'destino-arrasto');
            });
        });
        item.addEventListener('dragover', event => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            preview.querySelectorAll('.destino-arrasto').forEach(elemento => elemento.classList.remove('destino-arrasto'));
            item.classList.add('destino-arrasto');
        });
        item.addEventListener('drop', event => {
            event.preventDefault();
            const origem = Number(event.dataTransfer.getData('text/plain'));
            reordenarUrlsImagensAdmin(textareaId, origem, index, atualizarPreview);
        });

        item.addEventListener('pointerdown', event => {
            if(event.pointerType === 'mouse') return;
            item.setPointerCapture(event.pointerId);
            item.dataset.indiceDestino = String(index);
            item.classList.add('arrastando');
        });
        item.addEventListener('pointermove', event => {
            if(event.pointerType === 'mouse' || !item.hasPointerCapture(event.pointerId)) return;
            const destino = document.elementFromPoint(event.clientX, event.clientY)?.closest('.item-preview-imagem-admin');
            preview.querySelectorAll('.destino-arrasto').forEach(elemento => elemento.classList.remove('destino-arrasto'));
            if(destino && destino.parentElement === preview) {
                destino.classList.add('destino-arrasto');
                item.dataset.indiceDestino = destino.dataset.indiceImagem;
            }
        });
        const terminarArrastoToque = event => {
            if(event.pointerType === 'mouse') return;
            const destino = Number(item.dataset.indiceDestino ?? index);
            item.classList.remove('arrastando');
            preview.querySelectorAll('.destino-arrasto').forEach(elemento => elemento.classList.remove('destino-arrasto'));
            reordenarUrlsImagensAdmin(textareaId, index, destino, atualizarPreview);
        };
        item.addEventListener('pointerup', terminarArrastoToque);
        item.addEventListener('pointercancel', terminarArrastoToque);

        preview.appendChild(item);
    });
}

function atualizarPreviewImagensAdmin() {
    const preview = document.getElementById('preview-imagens-admin');
    if(!preview) return;
    criarPreviewOrdenavelImagens(preview, obterUrlsImagensAdmin(), 'admin-produto-imagens', atualizarPreviewImagensAdmin);
}

function adicionarUrlsAoCampoImagens(textareaId, urls) {
    const textarea = document.getElementById(textareaId);
    if(!textarea || !urls.length) return;

    const atuais = textarea.value
        .split(/[\n,]+/)
        .map(url => url.trim())
        .filter(Boolean);
    const todas = [...atuais];

    urls.forEach(url => {
        if(!todas.includes(url)) {
            todas.push(url);
        }
    });

    textarea.value = todas.join('\n');
}

async function enviarFotosCloudinaryAdmin(input, textareaId, atualizarPreview, statusId) {
    const status = document.getElementById(statusId);
    const ficheiros = Array.from(input.files || []);
    if(ficheiros.length === 0) return;

    try {
        const { data: { user }, error: authError } = await dbClient.auth.getUser();
        if(authError || !utilizadorAdmin(user)) {
            throw new Error('Apenas o administrador pode enviar fotos.');
        }

        mostrarMensagem(status, `A enviar ${ficheiros.length} foto(s) para o Cloudinary...`);
        const urls = [];

        for(const ficheiro of ficheiros) {
            if(!ficheiro.type.startsWith('image/')) {
                throw new Error('Só pode enviar ficheiros de imagem.');
            }

            const formData = new FormData();
            formData.append('file', ficheiro);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

            const resposta = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData
            });
            const resultado = await resposta.json();

            if(!resposta.ok) {
                throw new Error(resultado?.error?.message || 'Falha no upload para o Cloudinary.');
            }

            urls.push(resultado.secure_url);
            mostrarMensagem(status, `Enviadas ${urls.length}/${ficheiros.length} foto(s)...`);
        }

        adicionarUrlsAoCampoImagens(textareaId, urls);
        if(typeof atualizarPreview === 'function') {
            atualizarPreview();
        }
        input.value = '';
        mostrarMensagem(status, `${urls.length} foto(s) adicionada(s) com sucesso.`, 'msg-sucesso');
    } catch(error) {
        console.error('Erro Cloudinary:', error);
        mostrarMensagem(status, 'Erro: ' + (error.message || 'Não foi possível enviar as fotos.'), 'msg-erro');
    }
}

function obterProdutoId(produto) {
    return String(produto?.id ?? produto?.sku ?? '');
}

function produtoCorrespondePesquisaAdmin(produto, termoNormalizado) {
    if(!termoNormalizado) return true;
    const textoProduto = [
        produto.nome,
        produto.sku,
        produto.tema,
        produto.subtema
    ].map(valor => normalizarTextoSku(valor)).join(' ');
    return textoProduto.includes(termoNormalizado);
}

function renderizarListaProdutosAdmin() {
    const lista = document.getElementById('lista-admin-produtos');
    if(!lista) return;

    lista.replaceChildren();
    const termo = normalizarTextoSku(document.getElementById('admin-pesquisa-produtos')?.value || '');
    const produtos = todosOsProdutos
        .filter(produto => produtoCorrespondePesquisaAdmin(produto, termo))
        .slice(0, 40);

    if(produtos.length === 0) {
        const vazio = document.createElement('p');
        vazio.className = 'ajuda-admin';
        vazio.textContent = todosOsProdutos.length === 0 ? 'Ainda não há produtos carregados.' : 'Nenhum produto encontrado.';
        lista.appendChild(vazio);
        return;
    }

    produtos.forEach(produto => {
        const item = document.createElement('div');
        item.className = 'item-admin-produto';

        const info = document.createElement('div');
        const nome = document.createElement('strong');
        nome.textContent = produto.nome || 'Produto sem nome';
        info.appendChild(nome);

        const detalhes = document.createElement('span');
        const estado = produto.ativo === false ? 'Inativo' : 'Ativo';
        detalhes.textContent = `${produto.sku || 'sem SKU'} | ${formatarEuro(produto.preco)} € | Stock: ${produto.stock ?? '-'} | ${estado}`;
        info.appendChild(detalhes);
        item.appendChild(info);

        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'btn-admin-secundario';
        botao.textContent = 'Editar';
        botao.onclick = () => preencherEdicaoProdutoAdmin(obterProdutoId(produto));
        item.appendChild(botao);

        lista.appendChild(item);
    });
}

function obterUrlsImagensEditarAdmin() {
    const textarea = document.getElementById('admin-editar-imagens');
    if(!textarea) return [];
    return textarea.value
        .split(/[\n,]+/)
        .map(url => url.trim())
        .filter(url => url.length > 0);
}

function atualizarPreviewEditarImagensAdmin() {
    const preview = document.getElementById('preview-editar-imagens-admin');
    if(!preview) return;
    criarPreviewOrdenavelImagens(preview, obterUrlsImagensEditarAdmin(), 'admin-editar-imagens', atualizarPreviewEditarImagensAdmin);
}

function imagensParaTextoAdmin(produto) {
    const imagens = Array.isArray(produto?.imagens) ? produto.imagens : [];
    return imagens.filter(url => typeof url === 'string' && url.trim()).join('\n');
}

function preencherEdicaoProdutoAdmin(produtoId) {
    const produto = todosOsProdutos.find(item => obterProdutoId(item) === String(produtoId));
    const form = document.getElementById('form-admin-editar-produto');
    const status = document.getElementById('status-admin-editar-produto');
    if(!produto || !form) return;

    document.getElementById('admin-editar-id').value = obterProdutoId(produto);
    document.getElementById('admin-editar-sku-original').value = produto.sku || '';
    document.getElementById('admin-editar-nome').value = produto.nome || '';
    document.getElementById('admin-editar-sku').value = produto.sku || '';
    document.getElementById('admin-editar-preco').value = Number(produto.preco || 0).toFixed(2);
    document.getElementById('admin-editar-peso').value = Number(produto.peso || PESO_PADRAO_PRODUTO_GRAMAS);
    document.getElementById('admin-editar-stock').value = Number(produto.stock ?? 1);
    document.getElementById('admin-editar-tema').value = produto.tema || '';
    document.getElementById('admin-editar-subtema').value = produto.subtema === 'semsubtema' ? '' : (produto.subtema || '');
    document.getElementById('admin-editar-imagens').value = imagensParaTextoAdmin(produto);
    document.getElementById('admin-editar-observacoes').value = produto.observacoes || '';
    document.getElementById('admin-editar-ativo').checked = produto.ativo !== false;

    if(status) status.textContent = '';
    atualizarPreviewEditarImagensAdmin();
    form.style.display = 'flex';
    form.scrollIntoView({ behavior:'smooth', block:'start' });
}

function cancelarEdicaoProdutoAdmin() {
    const form = document.getElementById('form-admin-editar-produto');
    const status = document.getElementById('status-admin-editar-produto');
    if(!form) return;
    form.reset();
    form.style.display = 'none';
    if(status) status.textContent = '';
    atualizarPreviewEditarImagensAdmin();
}

function lerProdutoEditadoAdmin() {
    const id = document.getElementById('admin-editar-id').value;
    const skuOriginal = document.getElementById('admin-editar-sku-original').value;
    const nome = document.getElementById('admin-editar-nome').value.trim();
    const sku = normalizarTextoSku(document.getElementById('admin-editar-sku').value).replace(/[^A-Z0-9]/g, '');
    const tema = document.getElementById('admin-editar-tema').value.trim();
    const subtema = document.getElementById('admin-editar-subtema').value.trim();
    const preco = Number(document.getElementById('admin-editar-preco').value);
    const peso = Number(document.getElementById('admin-editar-peso').value || PESO_PADRAO_PRODUTO_GRAMAS);
    const stock = Number(document.getElementById('admin-editar-stock').value || 0);
    const observacoes = document.getElementById('admin-editar-observacoes').value.trim();
    const ativo = document.getElementById('admin-editar-ativo').checked;
    const imagens = obterUrlsImagensEditarAdmin();

    if(!id || !nome || !sku || !tema || !Number.isFinite(preco) || preco < 0 || !Number.isFinite(peso) || peso < 1 || !Number.isInteger(stock) || stock < 0) {
        throw new Error('Preencha nome, SKU, tema, preço, peso e stock.');
    }

    return {
        id,
        skuOriginal,
        produto: {
            sku,
            nome,
            tema,
            subtema: subtema || 'semsubtema',
            preco,
            peso,
            stock,
            observacoes,
            ativo,
            imagens
        }
    };
}

async function guardarEdicaoProdutoAdmin(event) {
    event.preventDefault();
    const status = document.getElementById('status-admin-editar-produto');
    mostrarMensagem(status, 'A guardar alterações...');

    try {
        const { data: { user }, error: authError } = await dbClient.auth.getUser();
        if(authError || !utilizadorAdmin(user)) {
            throw new Error('Apenas o administrador pode editar produtos.');
        }

        const { id, skuOriginal, produto } = lerProdutoEditadoAdmin();
        const skuExistente = todosOsProdutos.some(item => {
            const skuItem = String(item.sku || '').toUpperCase();
            return skuItem !== String(skuOriginal || '').toUpperCase() && skuItem === produto.sku;
        });
        if(skuExistente) {
            throw new Error('Este SKU já existe noutro produto.');
        }

        let data = null;
        let error = null;

        if(id && id !== skuOriginal) {
            const resultadoPorId = await dbClient
                .from('produtos')
                .update(produto)
                .eq('id', id)
                .select('id, sku');
            data = resultadoPorId.data;
            error = resultadoPorId.error;
        }

        if(!error && (!data || data.length === 0) && skuOriginal) {
            const resultadoPorSku = await dbClient
                .from('produtos')
                .update(produto)
                .eq('sku', skuOriginal)
                .select('id, sku');
            data = resultadoPorSku.data;
            error = resultadoPorSku.error;
        }

        if(error) throw error;
        if(!data || data.length === 0) {
            throw new Error('Produto não atualizado. Verifique se existe uma policy UPDATE no Supabase para o administrador.');
        }

        const produtoAtualizado = { ...produto, id:data[0].id };

        todosOsProdutos = todosOsProdutos.map(item => String(item.sku || '').toUpperCase() === String(skuOriginal || '').toUpperCase() ? produtoAtualizado : item);
        document.getElementById('admin-editar-sku-original').value = produtoAtualizado.sku || produto.sku;
        mostrarMensagem(status, 'Produto atualizado com sucesso.', 'msg-sucesso');
        await carregarProdutosAdminDaNuvem();
        renderizarListaProdutosAdmin();
    } catch(error) {
        console.error('Erro admin:', error);
        mostrarMensagem(status, 'Erro: ' + (error.message || 'Não foi possível guardar o produto.'), 'msg-erro');
    }
}

async function criarProdutoAdmin(event) {
    event.preventDefault();
    const status = document.getElementById('status-admin-produto');
    mostrarMensagem(status, 'A criar produto...');

    try {
        const { data: { user }, error: authError } = await dbClient.auth.getUser();
        if(authError || !utilizadorAdmin(user)) {
            throw new Error('Apenas o administrador pode criar produtos.');
        }

        const nome = document.getElementById('admin-produto-nome').value.trim();
        const sku = normalizarTextoSku(document.getElementById('admin-produto-sku').value).replace(/[^A-Z0-9]/g, '');
        const tema = document.getElementById('admin-produto-tema').value.trim();
        const subtema = document.getElementById('admin-produto-subtema').value.trim();
        const preco = Number(document.getElementById('admin-produto-preco').value);
        const peso = Number(document.getElementById('admin-produto-peso').value || PESO_PADRAO_PRODUTO_GRAMAS);
        const stock = Number(document.getElementById('admin-produto-stock').value || 0);
        const observacoes = document.getElementById('admin-produto-observacoes').value.trim();
        const ativo = document.getElementById('admin-produto-ativo').checked;
        const imagens = obterUrlsImagensAdmin();

        if(!nome || !sku || !tema || !Number.isFinite(preco) || preco < 0 || !Number.isFinite(peso) || peso < 1 || !Number.isInteger(stock) || stock < 0) {
            throw new Error('Preencha nome, SKU, tema, preço, peso e stock.');
        }

        const skuExistente = todosOsProdutos.some(produto => String(produto.sku || '').toUpperCase() === sku);
        if(skuExistente) {
            throw new Error('Este SKU já existe. Ajuste o SKU antes de criar o produto.');
        }

        const novoProduto = {
            sku,
            nome,
            tema,
            subtema: subtema || 'semsubtema',
            preco,
            peso,
            stock,
            observacoes,
            ativo,
            imagens
        };

        const { data, error } = await dbClient
            .from('produtos')
            .insert([novoProduto])
            .select('id, sku')
            .single();

        if(error) throw error;

        todosOsProdutos.push({ ...novoProduto, id:data.id });
        document.getElementById('form-admin-produto').reset();
        document.getElementById('admin-produto-ativo').checked = true;
        atualizarPreviewImagensAdmin();
        mostrarMensagem(status, 'Produto criado com sucesso.', 'msg-sucesso');
        await carregarProdutosAdminDaNuvem();
    } catch(error) {
        console.error('Erro admin:', error);
        mostrarMensagem(status, 'Erro: ' + (error.message || 'Não foi possível criar o produto.'), 'msg-erro');
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

        const estado = document.createElement('span');
        estado.className = 'encomenda-estado';
        estado.textContent = encomenda.estado || 'Pendente';

        topo.appendChild(id);
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
                .select('id, sku, nome, preco, peso, tema, subtema, imagens, ativo')
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

async function carregarProdutosAdminDaNuvem(){
    if(!dbClient) return;

    const listaProdutos = [];
    const tamanhoPagina = 500;
    let inicio = 0;

    while(true) {
        const { data:pagina, error } = await executarComTimeout(
            dbClient.rpc('listar_produtos_admin', {
                p_limite:tamanhoPagina,
                p_offset:inicio
            }),
            20000,
            'Consulta administrativa de produtos demasiado lenta.'
        );

        if(error) throw error;
        if(!pagina || pagina.length === 0) break;

        listaProdutos.push(...pagina);
        if(pagina.length < tamanhoPagina) break;
        inicio += tamanhoPagina;
    }

    todosOsProdutos = listaProdutos;
    catalogoAdminCarregado = true;
    const produtosVisiveis = listaProdutos.filter(produto => produto.ativo !== false);
    gerarMenus(produtosVisiveis);
    gerarProdutos(produtosVisiveis);
    atualizarCarrinho();
    renderizarListaProdutosAdmin();
}

async function carregarProdutosConformeUtilizador(){
    const { data:{ user } } = await dbClient.auth.getUser();
    if(utilizadorAdmin(user)) {
        await carregarProdutosAdminDaNuvem();
        return;
    }
    await carregarProdutosDaNuvem();
}

function gerarMenus(listaProdutos){
    const menu = document.getElementById('menu-lateral-temas');
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
    todosBtn.textContent = '⭐ Todos os Temas';
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
                btnSub.textContent = '• ' + subtema;
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
        const imagemInicial = listaImagens.length > 0
            ? otimizarImagemCloudinary(listaImagens[0], 700)
            : imagemFallback;

        const imagemPrincipal = document.createElement('img');
        imagemPrincipal.className = 'produto-img';
        imagemPrincipal.loading = 'lazy';
        imagemPrincipal.decoding = 'async';
        imagemPrincipal.dataset.srcOriginal = imagemInicial;
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
            
            listaImagens.forEach((url, index) => {
                const mini = document.createElement('button');
                mini.className = 'miniatura-img';
                mini.type = 'button';
                mini.title = 'Ver imagem ' + (index + 1);
                mini.textContent = index + 1;
                mini.onclick = function() {
                    const imagemOtimizada = otimizarImagemCloudinary(url, 700);
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
    const inputRaw = document.getElementById('campo-pesquisa').value || '';
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
        erroDiv.innerText = '🔍 Nenhuma minifigura encontrada com esse nome.';
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
    const tabela = TABELA_PORTES_POR_PESO[paisEnvio] || TABELA_PORTES_POR_PESO.portugal;
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
    return Math.round((Number(valorBase || 0) * (1 + IVA_PORTES)) * 100) / 100;
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
    if(infoEnvio) infoEnvio.textContent = 'Peso estimado: ' + pesoTotal + 'g';
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
    statusDiv.innerText = "❌ O seu carrinho está vazio. Adicione pelo menos um produto antes de finalizar.";
    return;
  }

  const { data: { user }, error: authError } = await dbClient.auth.getUser();

  if (authError || !user) {
    console.error("Erro de Autenticação:", authError);
    statusDiv.className = "msg-status msg-erro";
    statusDiv.innerText = "⚠️ Necessita de iniciar sessão ou registar-se na secção Minha Conta para finalizar a encomenda.";
    return;
  }

  if (user.email_confirmed_at === null) {
    statusDiv.className = "msg-status msg-erro";
    statusDiv.innerText = "⚠️ Confirme o seu e-mail antes de finalizar a encomenda.";
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
