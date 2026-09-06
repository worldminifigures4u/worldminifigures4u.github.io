// Constantes partilhadas do site (carregar antes dos modulos da app).
const SUPABASE_URL = 'https://gksndzxadndrsynvzgzb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrc25kenhhZG5kcnN5bnZ6Z3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc5NzMsImV4cCI6MjA5NDY2Mzk3M30.EHZgacYr27dqoc4CJHsOwkNnJFGlLIteSHBi4B1HfVE';
const URL_PUBLICO_FALLBACK = 'https://figuresplanet.com/';
const ADMIN_EMAILS = ['worldminifigures4u@gmail.com'];
const PESO_PADRAO_PRODUTO_GRAMAS = 10;
const NOME_CONTA_CABECALHO_KEY = 'figures-planet-conta-primeiro-nome';
const CONTA_BLOQUEADA_KEY = 'figures-planet-conta-bloqueada';

function emailEhAdmin(email) {
    const normalizado = String(email || '').toLowerCase();
    return ADMIN_EMAILS.map(item => String(item).toLowerCase()).includes(normalizado);
}

function bloquearAcessoAdminRapido(bloqueio, mensagem = 'Acesso reservado ao administrador. A regressar à conta...') {
    if (bloqueio) bloqueio.textContent = mensagem;
    setTimeout(() => window.location.replace('conta.html'), 1400);
}

async function confirmarAdminRemoto(client, bloqueio) {
    try {
        const { data: { user }, error } = await client.auth.getUser();
        if (error || !user || !emailEhAdmin(user.email)) {
            bloquearAcessoAdminRapido(bloqueio);
            return null;
        }
        return user;
    } catch (error) {
        console.warn('Nao foi possivel confirmar admin remotamente.', error);
        bloquearAcessoAdminRapido(bloqueio);
        return null;
    }
}

async function validarAdminRapido(client, bloqueio) {
    const { data: { session } } = await client.auth.getSession();
    const utilizadorLocal = session?.user || null;
    if (utilizadorLocal && emailEhAdmin(utilizadorLocal.email)) {
        confirmarAdminRemoto(client, bloqueio);
        return utilizadorLocal;
    }

    return confirmarAdminRemoto(client, bloqueio);
}

/** Fecha o modal só se o clique começar e acabar no fundo (evita fechar ao selecionar texto). */
function ligarFechoModalPorFundo(modal, fechar) {
    if (!modal || typeof fechar !== 'function') return;
    let pointerDownNoFundo = false;
    modal.addEventListener('pointerdown', (evento) => {
        pointerDownNoFundo = evento.target === modal;
    });
    modal.addEventListener('pointercancel', () => {
        pointerDownNoFundo = false;
    });
    modal.addEventListener('click', (evento) => {
        if (evento.target === modal && pointerDownNoFundo) fechar(evento);
        pointerDownNoFundo = false;
    });
}

function criarBotaoDialogoSite(texto, classe, acao) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = classe;
    botao.textContent = texto;
    botao.addEventListener('click', acao);
    return botao;
}

function abrirDialogoSite(opcoes = {}) {
    return new Promise(resolve => {
        document.getElementById('fp-dialogo-site')?.remove();

        const modal = document.createElement('div');
        modal.id = 'fp-dialogo-site';
        modal.className = 'fp-dialogo-site';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'fp-dialogo-site-titulo');

        const caixa = document.createElement('div');
        caixa.className = 'fp-dialogo-site-caixa';

        const titulo = document.createElement('h2');
        titulo.id = 'fp-dialogo-site-titulo';
        titulo.textContent = opcoes.titulo || 'Confirmar';
        caixa.appendChild(titulo);

        const mensagem = document.createElement('p');
        mensagem.className = 'fp-dialogo-site-mensagem';
        mensagem.textContent = opcoes.mensagem || '';
        caixa.appendChild(mensagem);

        let input = null;
        if (opcoes.tipo === 'prompt') {
            input = document.createElement('input');
            input.className = 'fp-dialogo-site-input';
            input.type = 'text';
            input.value = opcoes.valorInicial || '';
            input.autocomplete = 'off';
            input.spellcheck = false;
            caixa.appendChild(input);
        }

        const acoes = document.createElement('div');
        acoes.className = 'fp-dialogo-site-acoes';

        const fechar = valor => {
            modal.remove();
            document.body.classList.remove('fp-dialogo-site-aberto');
            resolve(valor);
        };

        if (opcoes.tipo !== 'alert') {
            acoes.appendChild(criarBotaoDialogoSite(
                opcoes.textoCancelar || 'Cancelar',
                'fp-dialogo-site-botao fp-dialogo-site-botao-secundario',
                () => fechar(opcoes.tipo === 'prompt' ? null : false)
            ));
        }

        acoes.appendChild(criarBotaoDialogoSite(
            opcoes.textoConfirmar || 'OK',
            'fp-dialogo-site-botao fp-dialogo-site-botao-principal',
            () => fechar(opcoes.tipo === 'prompt' ? String(input?.value || '') : true)
        ));

        caixa.appendChild(acoes);
        modal.appendChild(caixa);
        document.body.appendChild(modal);
        document.body.classList.add('fp-dialogo-site-aberto');

        modal.addEventListener('click', evento => {
            if (evento.target === modal) fechar(opcoes.tipo === 'alert' ? true : (opcoes.tipo === 'prompt' ? null : false));
        });
        modal.addEventListener('keydown', evento => {
            if (evento.key === 'Escape') fechar(opcoes.tipo === 'alert' ? true : (opcoes.tipo === 'prompt' ? null : false));
            if (evento.key === 'Enter' && input) fechar(String(input.value || ''));
        });

        (input || acoes.querySelector('.fp-dialogo-site-botao-principal'))?.focus();
    });
}

function mostrarConfirmacaoSite(mensagem, opcoes = {}) {
    return abrirDialogoSite({
        ...opcoes,
        tipo: 'confirm',
        mensagem,
        titulo: opcoes.titulo || 'Confirmar',
        textoConfirmar: opcoes.textoConfirmar || 'Confirmar',
        textoCancelar: opcoes.textoCancelar || 'Cancelar'
    });
}

function mostrarAvisoSite(mensagem, opcoes = {}) {
    return abrirDialogoSite({
        ...opcoes,
        tipo: 'alert',
        mensagem,
        titulo: opcoes.titulo || 'Aviso',
        textoConfirmar: opcoes.textoConfirmar || 'OK'
    });
}

function pedirTextoSite(mensagem, valorInicial = '', opcoes = {}) {
    return abrirDialogoSite({
        ...opcoes,
        tipo: 'prompt',
        mensagem,
        valorInicial,
        titulo: opcoes.titulo || 'Indicar valor',
        textoConfirmar: opcoes.textoConfirmar || 'Guardar',
        textoCancelar: opcoes.textoCancelar || 'Cancelar'
    });
}
