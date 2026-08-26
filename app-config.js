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
