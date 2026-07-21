// Utilitarios partilhados (imagens, moeda, mensagens).
function obterUrlPublicoAtual() {
    try {
        const origem = window.location.origin;
        if (origem && origem !== 'null') {
            return `${origem}/`;
        }
    } catch (_) {}
    return URL_PUBLICO_FALLBACK;
}

function formatarEuro(valor) {
    return Number(valor || 0).toFixed(2).replace('.', ',');
}

const MENSAGEM_CONTA_SUSPENSA = 'Esta conta foi suspensa e nao pode iniciar sessao.';
const MENSAGEM_ERRO_GENERICA_CLIENTE = 'Não foi possível concluir o pedido. Tenta novamente dentro de momentos.';
const MENSAGEM_LIGACAO_INDISPONIVEL = 'Não foi possível ligar ao serviço. Verifique a internet e recarregue a página.';

function mensagemErroPareceTecnica(mensagem) {
    const texto = String(mensagem || '').toLowerCase();
    if (!texto) return true;
    return /supabase|postgres|postgrest|pgrst|jwt|rpc\b|cdn|sql\b|policy|row-level|rls|permission denied|violates|constraint|undefined|null is not|failed to fetch|networkerror|typeerror|syntaxerror|stack|at\s+\w+\s+\(|function public\.|schema cache/i.test(texto);
}

function extrairTextoErro(erro) {
    if (!erro) return '';
    let mensagem = erro.message || erro.error_description || erro.msg || erro.error || '';
    if (mensagem && typeof mensagem === 'object') {
        mensagem = mensagem.message || mensagem.error_description || '';
    }
    mensagem = String(mensagem || '').trim();
    if (!mensagem || mensagem === '{}' || mensagem === '[object Object]') return '';
    return mensagem;
}

function obterMensagemErroCliente(erro, fallback = MENSAGEM_ERRO_GENERICA_CLIENTE) {
    const mensagem = extrairTextoErro(erro);
    if (!mensagem || mensagemErroPareceTecnica(mensagem)) {
        return fallback;
    }
    return mensagem;
}

function obterMensagemErroAuth(erro, contexto = 'login') {
    const fallback = contexto === 'login'
        ? 'E-mail ou palavra-passe inválidos.'
        : MENSAGEM_ERRO_GENERICA_CLIENTE;

    if (!erro) return fallback;

    const codigo = String(erro.code || erro.error || '').toLowerCase();
    const mensagem = extrairTextoErro(erro);
    const texto = `${codigo} ${mensagem}`.toLowerCase();

    if (
        codigo === 'user_banned'
        || texto.includes('banned')
        || texto.includes('banido')
        || texto.includes('suspens')
        || texto.includes('bloquead')
    ) {
        return MENSAGEM_CONTA_SUSPENSA;
    }

    if (
        texto.includes('invalid login')
        || texto.includes('invalid credentials')
        || texto.includes('invalid_grant')
        || texto.includes('email not confirmed')
        || texto.includes('email_not_confirmed')
    ) {
        if (texto.includes('email not confirmed') || texto.includes('email_not_confirmed')) {
            return 'E-mail não confirmado. Verifique a caixa de correio e clique no link de validação.';
        }
        return 'E-mail ou palavra-passe inválidos.';
    }

    if (
        texto.includes('rate limit')
        || texto.includes('too many')
        || texto.includes('demorou')
        || texto.includes('timeout')
    ) {
        return 'O pedido demorou demasiado. Tente novamente dentro de momentos.';
    }

    if (mensagemErroPareceTecnica(mensagem) || !mensagem) {
        return fallback;
    }

    return mensagem;
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
    return listaImagens.length > 0 ? listaImagens[0] : 'img/sem-imagem.png?v=20260719-sem-texto';
}

function utilizadorAdmin(user) {
    const email = String(user?.email || '').toLowerCase();
    return ADMIN_EMAILS.includes(email);
}

function garantirEstilosAdmin() {
    if (document.querySelector('link[href*="styles-admin.css"]')) return;
    const folha = document.createElement('link');
    folha.rel = 'stylesheet';
    folha.href = 'styles-admin.css?v=20260712-leve-r23';
    document.head.appendChild(folha);
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

async function garantirDbClient() {
    if (window.dbClient) return window.dbClient;

    if (typeof window.carregarScriptSupabase === 'function') {
        await window.carregarScriptSupabase();
    }

    if (typeof supabase === 'undefined') {
        throw new Error('Biblioteca Supabase indisponível.');
    }

    if (typeof dbClient !== 'undefined' && dbClient) {
        window.dbClient = dbClient;
        return dbClient;
    }

    const cliente = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.dbClient = cliente;
    return cliente;
}

function definirEstadoVitrine(mensagem, tipo = '') {
    const vitrine = document.getElementById('vitrine-produtos');
    if (!vitrine) return;
    vitrine.replaceChildren();
    const contador = document.getElementById('contador-produtos');
    if (contador) contador.replaceChildren();
    const estado = document.createElement('div');
    estado.className = `estado-vitrine ${tipo}`.trim();

    const figura = document.createElement('img');
    figura.className = 'estado-vitrine-figura';
    figura.src = 'img/sem-imagem.png?v=20260719-sem-texto';
    figura.alt = '';
    figura.width = 120;
    figura.height = 120;
    figura.decoding = 'async';

    const texto = document.createElement('p');
    texto.className = 'estado-vitrine-texto';
    texto.textContent = mensagem;

    estado.append(figura, texto);
    vitrine.appendChild(estado);
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
